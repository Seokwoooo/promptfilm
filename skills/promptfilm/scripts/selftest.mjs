#!/usr/bin/env node
// The skill's own check: builds the engine's test films in a temporary folder and runs everything that must keep working —
// new film + build, QA (and that it catches planted faults), the plan's time budget, keeping itself up to date, the visual review and
// the delivery gate, frame-exact rendering, live pace, the Studio (films, pace edits, comments + snapshots, opening the page, Send to
// Claude reaching the right session, the storyboard).
//   node selftest.mjs [--keep]          (about 5 minutes with a GPU — two full QA runs; exit code 0 = every check passed)
// Needs what `sh setup.sh` installs (the packages, a Chrome, an ffmpeg). Writes nothing inside the skill.
import fs from 'fs';
import os from 'os';
import path from 'path';
import http from 'http';
import { spawn, execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { open, exePath, has, ffmpegBin } from './common.mjs';
import { build } from '../engine/build.mjs';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'promptfilm-selftest-'));
const rows = []; let failed = 0;
const check = (name, pass, detail) => { rows.push([pass ? 'pass' : 'FAIL', name, detail]); if (!pass) failed++; console.log(`${pass ? 'pass' : 'FAIL'}  ${name.padEnd(28)} ${detail}`); };
const step = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, e.message.split('\n')[0].slice(0, 240)); } };
const run = (cmd, args, opts = {}) => new Promise((res) => { const p = spawn(cmd, args, { ...opts }); let out = ''; p.stdout && p.stdout.on('data', d => out += d); p.stderr && p.stderr.on('data', d => out += d); p.on('exit', code => res({ code, out })); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const md5s = file => execFileSync(ffmpegBin(), ['-hide_banner', '-loglevel', 'error', '-i', file, '-f', 'framemd5', '-'], { encoding: 'utf8' }).split('\n').filter(l => l && !l.startsWith('#')).map(l => l.split(',').pop().trim());

// a static server for the temporary folder (QA and the renderer open films over http)
function serve(root) {
  const srv = http.createServer((req, res) => {
    const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': p.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ srv, base: `http://127.0.0.1:${srv.address().port}` })));
}

console.log(`promptfilm selftest · ${os.platform()}/${os.arch()} · node ${process.version} · temp ${TMP}\n`);
let web = null, studio = null;
try {
  await step('environment', async () => {
    const ff = execFileSync(ffmpegBin(), ['-hide_banner', '-version'], { encoding: 'utf8' }).split('\n')[0].slice(0, 40);
    check('environment', true, `chrome ${path.basename(exePath())} · ${ff}`);
  });
  // the environment notice: run under another coding agent — even one started from a Claude Code terminal, which inherits
  // CLAUDECODE=1 — it always shows
  await step('env notice elsewhere', async () => {
    const bin = path.join(TMP, 'fakebin'), fake = path.join(bin, 'gemini'); fs.mkdirSync(bin, { recursive: true });
    fs.writeFileSync(fake, `#!${process.execPath}\nrequire('child_process').execFileSync('/bin/sh', ['-c', ${JSON.stringify(`cd / && "${process.execPath}" "${path.join(SKILL, 'scripts', 'env_check.mjs')}" --json --model `)} + process.argv[2]], { stdio: 'inherit' });\n`);
    fs.chmodSync(fake, 0o755);
    if (process.platform === 'win32') return check('env notice elsewhere', true, 'skipped on Windows (no process tree via ps)');
    const r = await run(fake, ['claude-opus-5-5'], { env: { ...process.env, CLAUDECODE: '1' } }), j = JSON.parse(r.out);
    check('env notice elsewhere', j.host === 'gemini' && j.recommended === false, `under another agent (CLAUDECODE=1 inherited, a Claude model id): host ${j.host} · notice ${j.recommended ? 'NOT shown' : 'shown'}`);
  });

  // setup: this machine has what the skill needs (report only — the selftest installs nothing), and serve.mjs serves a folder
  await step('setup + serve', async () => {
    const r = await run(process.execPath, [path.join(SKILL, 'scripts', 'setup.mjs'), '--check']);
    fs.writeFileSync(path.join(TMP, 'probe.html'), '<!doctype html><title>probe</title>');
    const sp = 49000 + Math.floor(Math.random() * 900), srv = spawn(process.execPath, [path.join(SKILL, 'scripts', 'serve.mjs'), TMP, '--port', String(sp)], { stdio: 'ignore' });
    let got = null, type = null, outside = null;
    for (let i = 0; i < 40 && got === null; i++) { await sleep(150); try { const q = await fetch(`http://127.0.0.1:${sp}/probe.html`); type = q.headers.get('content-type'); got = await q.text(); } catch (e) {} }
    try { outside = (await fetch(`http://127.0.0.1:${sp}/%2e%2e/%2e%2e/etc/hosts`)).status; } catch (e) {}
    srv.kill();
    check('setup + serve', r.code === 0 && /setup: ready/.test(r.out) && /probe/.test(got || '') && /text\/html/.test(type || '') && outside >= 400,
      `${r.out.trim().split('\n').pop().slice(0, 120)} · serve.mjs: ${got ? 'served' : 'NOT served'} (${type}) · outside the folder → ${outside}`);
  });

  // 1) new_film.mjs + build.mjs; the engine's two test films built with the node build
  await step('new film + build', async () => {
    const r = await run(process.execPath, [path.join(SKILL, 'scripts', 'new_film.mjs'), path.join(TMP, 'fresh'), 'fresh', '--aspect', '16x9', '--langs', 'ja en', '--length', '25-35']);
    if (r.code) throw new Error(r.out);
    const b = build(path.join(TMP, 'fresh'), 'fresh'), html = fs.readFileSync(b.out, 'utf8');
    check('new film + build', /data-aspect="16x9" data-langs="ja en" data-length="25-35"/.test(html) && html.includes('Noto+Sans+JP'), `${(b.bytes / 1024).toFixed(0)} KB · 16x9 · ja en · 25-35 s`);
  });
  for (const d of ['demo', 'demo-ad']) {
    const dir = path.join(TMP, d); fs.mkdirSync(path.join(dir, 'parts'), { recursive: true });
    for (const src of ['core', d]) for (const f of fs.readdirSync(path.join(SKILL, 'engine', src))) fs.copyFileSync(path.join(SKILL, 'engine', src, f), path.join(dir, 'parts', f));
    const h = path.join(dir, 'parts', 'p1_head.html'); fs.writeFileSync(h, fs.readFileSync(h, 'utf8').replace('data-length="45-60"', 'data-length="12-20"'));
    fs.writeFileSync(path.join(dir, 'build.sh'), fs.readFileSync(path.join(SKILL, 'engine', 'build.sh'), 'utf8'));   // a standard film folder
    build(dir, d);
  }
  web = await serve(TMP);

  // 2) the FULL QA on both test films: every check passes (flicker may sit in its 'look' band — for the visual review), and the report
  //    says READY for the review. Only fps depends on this machine's GPU: reported, not failed.
  for (const d of ['demo', 'demo-ad']) await step(`qa ${d}`, async () => {
    await run(process.execPath, [path.join(SKILL, 'scripts', 'qa.mjs'), `${web.base}/${d}/${d}.html`, '--out', path.join(TMP, d, 'qa')]);
    const rep = JSON.parse(fs.readFileSync(path.join(TMP, d, 'qa', 'qa-report.json'), 'utf8'));
    const bad = (rep.failing || []).filter(k => k !== 'fps'), fps = rep.checks.fps && rep.checks.fps.pass === false ? ` · fps below 60 on this machine (${rep.checks.fps.min})` : '';
    check(`qa ${d}`, !bad.length && rep.full && (rep.ready || (rep.failing.length === 1 && rep.failing[0] === 'fps')),
      bad.length ? 'failed: ' + bad.join(', ') : `full run · ${Object.keys(rep.checks).length} checks · loop ${rep.checks.load.LOOP} s${rep.look && rep.look.length ? ' · to look at: ' + rep.look.join(', ') : ''}${fps}`);
  });

  // 2b) the checks catch what they are for: a copy of the demo with planted faults — each must fail its check, naming the right place
  await step('qa catches faults', async () => {
    const dir = path.join(TMP, 'demo-bad'); fs.mkdirSync(path.join(dir, 'parts'), { recursive: true });
    for (const f of fs.readdirSync(path.join(TMP, 'demo', 'parts'))) fs.copyFileSync(path.join(TMP, 'demo', 'parts', f), path.join(dir, 'parts', f));
    fs.copyFileSync(path.join(TMP, 'demo', 'build.sh'), path.join(dir, 'build.sh'));
    const tl = path.join(dir, 'parts', 'p8_timeline.js'); let s = fs.readFileSync(tl, 'utf8');
    const plant = (a, b) => { if (!s.includes(a)) throw new Error('the demo changed — cannot plant a fault at: ' + a.slice(0, 50)); s = s.replace(a, b); };
    plant("'Jupiter joins the row', 3);", "'Jupiter joins the row', 14);");                     // pace: a pull-back far over 3 e-folds/s
    plant(", S.jupiter);", ");");                                                                  // read: a caption that doesn't say what it shows
    plant("`(태양 — 지구의 ${ratio('sun', 'earth')}배 · 표면은 그림)`, S.sun);", "`(태양 — 지구의 ${ratio('sun', 'earth')}배 · 표면은 그림)`, subject(B.sun.pos, B.sun.r, { name: 'a sphere' }));");   // read: a subject with nothing drawn
    plant("beat(8.8, 13.4, 'key', 'Earth');", "beat(8.8, 13.4, 'return', 'Earth');");               // pace: a 'return' in the middle of the film
    plant('function applyScene(tau, tp, field) {', `const BAD_BOX = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x777777 })); universe.add(BAD_BOX);
const BAD_WALL = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ color: 0x555555, side: THREE.DoubleSide })); BAD_WALL.name = 'a wall in the way'; universe.add(BAD_WALL);
let BAD_AT = null;
function applyScene(tau, tp, field) {
  applySceneOk(tau, tp, field);
  if (tau > 20.4 && tau < 23.6) { ROW.forEach(k => { B[k].mesh.visible = false; if (B[k].glow) B[k].glow.visible = false; }); STARS.visible = false; } else STARS.visible = true;   // empty
  BAD_BOX.visible = tau < 3; BAD_BOX.position.copy(CAM_POS); BAD_BOX.scale.setScalar(CAM.D * 0.4);                                   // surfaces: inside a model
  if (tau > 15 && tau < 16) { if (!BAD_AT) BAD_AT = CAM_POS.clone(); BAD_WALL.visible = true; BAD_WALL.position.copy(BAD_AT); BAD_WALL.scale.set(CAM.D * 3, CAM.D * 3, CAM.D * 0.01); }
  else BAD_WALL.visible = false;                                                                  // surfaces: the camera passes through a wall
}
function applySceneOk(tau, tp, field) {`);
    fs.writeFileSync(tl, s);
    fs.appendFileSync(path.join(dir, 'parts', 'p9_engine.js'), '\n// an edited engine copy\n');   // engine: the film's copy differs from the skill's
    build(dir, 'demo-bad');
    try {
    await run(process.execPath, [path.join(SKILL, 'scripts', 'qa.mjs'), `${web.base}/demo-bad/demo-bad.html`, '--out', path.join(dir, 'qa'), '--only', 'engine,pace,read,empty,surfaces']);
    const rep = JSON.parse(fs.readFileSync(path.join(dir, 'qa', 'qa-report.json'), 'utf8')), c = rep.checks, J = x => JSON.stringify(x || '');
    const caught = ['engine', 'pace', 'read', 'empty', 'surfaces'].filter(k => c[k] && c[k].pass === false);
    const named = { fast: J(c.pace.warnings).includes('Jupiter joins the row'), stray: J(c.pace.warnings).includes("'Earth'"), unnamed: J(c.read.warnings).includes("'Jupiter'"),
      sphere: J(c.read.warnings).includes('a sphere'), inside: (c.surfaces.back || []).length > 0, through: J(c.surfaces.through).includes('a wall in the way') };
    const missed = Object.entries(named).filter(([, v]) => !v).map(([k]) => k);
    check('qa catches faults', caught.length === 5 && !missed.length && rep.ready === false,
      `planted: fast zoom, mid-film return, unnamed caption, bare sphere, empty stretch, inside a box, through a wall, edited engine → failing: ${caught.join(', ')}${missed.length ? ' · MISSED: ' + missed.join(', ') : ''}`);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  });

  // 2c) the plan's time budget (scripts/budget.mjs): a storyboard that fits passes; too many, too short stops, or a span that can't be
  //     travelled at 3 e-folds/s in the length, do not
  await step('budget', async () => {
    const d = path.join(TMP, 'plan'); fs.mkdirSync(d, { recursive: true });
    const card = (id, seconds, second, field, beat = 'normal') => ({ id, name: id, beat, seconds, field, caption: { title: 'T', line: 'L', second } });
    const write = scenes => fs.writeFileSync(path.join(d, 'storyboard.json'), JSON.stringify({ version: 1, format: { aspect: '9x16', length: '25-35', langs: 'en ko' }, scenes }));
    const B = path.join(SKILL, 'scripts', 'budget.mjs');
    write([card('s1', 3.2, '(짧은 한 줄)', 10, 'hook'), card('s2', 4.5, '(조금 더 긴 한 줄)', 3, 'key'), card('s3', 4, '(여기도)', 1), card('s4', 4, '(마지막 전)', 0.4), card('s5', 4.5, '(끝 카드)', 0.15, 'key'), card('s6', 3.5, '(또 하나)', 0.06), card('r', 3, '', 0.06, 'return')]);
    const ok = await run(process.execPath, [B, d]);
    write(Array.from({ length: 12 }, (_, i) => card('s' + (i + 1), 1.6, '(한 장면에 1.6초씩 지나가는 스토리보드)', 10 / (i + 1))));
    const many = await run(process.execPath, [B, d]);
    write(Array.from({ length: 5 }, (_, i) => card('s' + (i + 1), 5, '(짧게)', Math.pow(10, -8 * i))));                // 5 stops, 32 decades apart
    const deep = await run(process.execPath, [B, d]);
    fs.rmSync(d, { recursive: true, force: true });
    check('budget', ok.code === 0 && many.code === 1 && /12 stops/.test(many.out) && deep.code === 1 && /e-folds/.test(deep.out),
      `a fitting plan passes · 12 short cards: ${many.code === 1 ? 'refused' : 'NOT refused'} · 5 stops 32 decades apart in 35 s: ${deep.code === 1 ? 'refused' : 'NOT refused'}${ok.code ? ' · the fitting plan was refused: ' + ok.out.split('\n').slice(-4).join(' ') : ''}`);
  });

  // 2c') newer versions (scripts/update.mjs), with a Claude Code config and a home folder of its own: never set, an older plugin install
  //      announces the newer commit and installs nothing; --auto-off writes Claude Code's switch (marketplace record and settings) and
  //      nothing is asked again; with the switch on it would install; the newest install and a copy outside a plugin install are left
  //      alone; a newer version already installed is switched to
  await step('updates', async () => {
    const d = path.join(TMP, 'upd'), work = path.join(d, 'w'), repo = path.join(d, 'pf.git'), cfg = path.join(d, 'cfg'), g = (...a) => execFileSync('git', a, { cwd: work, encoding: 'utf8' }).trim();
    for (const x of [work, path.join(d, 'home'), path.join(cfg, 'plugins')]) fs.mkdirSync(x, { recursive: true });
    fs.writeFileSync(path.join(work, 'README.md'), 'test\n');
    g('init', '-q'); g('add', '-A'); g('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 't'); execFileSync('git', ['clone', '-q', '--bare', work, repo]);
    const head = g('rev-parse', 'HEAD').slice(0, 12), U = path.join(SKILL, 'scripts', 'update.mjs'), source = { source: 'git', url: 'file://' + repo };
    const KN = path.join(cfg, 'plugins', 'known_marketplaces.json'), ST = path.join(cfg, 'settings.json'), J = f => JSON.parse(fs.readFileSync(f, 'utf8'));
    fs.writeFileSync(KN, JSON.stringify({ pf: { source } }, null, 2)); fs.writeFileSync(ST, JSON.stringify({ extraKnownMarketplaces: { pf: { source } } }, null, 2) + '\n');
    const at = v => { const s = path.join(cfg, 'plugins', 'cache', 'pf', 'promptfilm', v, 'skills', 'promptfilm'); fs.mkdirSync(s, { recursive: true }); return s; };
    const env = { ...process.env, HOME: path.join(d, 'home'), USERPROFILE: path.join(d, 'home'), CLAUDE_CONFIG_DIR: cfg, PROMPTFILM_NO_UPDATE: '' }, old = at('000000000000');
    const u = async (...a) => (await run(process.execPath, [U, ...a], { env })).out.trim();
    const asked = await u('--skill', old), off = await u('--skill', old, '--auto-off'), offFlags = [J(KN).pf.autoUpdate, J(ST).extraKnownMarketplaces.pf.autoUpdate], quiet = await u('--skill', old);
    const kn = J(KN); kn.pf.autoUpdate = true; fs.writeFileSync(KN, JSON.stringify(kn, null, 2));                       // the /plugin switch turned on
    const st = J(ST); delete st.extraKnownMarketplaces.pf.autoUpdate; fs.writeFileSync(ST, JSON.stringify(st, null, 2) + '\n');
    const on = await u('--skill', old, '--dry'), cur = await u('--skill', at(head)), here = await u();
    fs.writeFileSync(path.join(at(head), 'SKILL.md'), '# test\n');
    const sw = await u('--skill', old);
    fs.rmSync(d, { recursive: true, force: true });
    const ok = { asked: asked.includes(`a newer promptfilm is out: 0000000 → ${head.slice(0, 7)}`) && asked.includes('not set'), off: /is off/.test(off) && offFlags.every(x => x === false) && !quiet,
      on: on.includes(`would update promptfilm@pf 000000000000 → ${head}`), cur: !cur, here: !here, sw: sw.includes(`PF_SKILL=${at(head)}`) };
    const bad = Object.entries(ok).filter(([, v]) => !v).map(([k]) => k);
    check('updates', !bad.length, bad.length ? `FAILED: ${bad.join(', ')} · ${asked} | ${off} ${offFlags} | ${quiet} | ${on}`
      : 'never set: asks, installs nothing · off: Claude Code\'s switch written, nothing asked again · on: updates · the newest and a copy outside a plugin: left alone · an installed newer version: switched to');
  });

  // 2d) the visual review's material, and the delivery gate: no final video of a build without a passing full QA and a passing review
  await step('review + gate', async () => {
    const html = path.join(TMP, 'demo', 'demo.html'), qa = path.join(TMP, 'demo', 'qa'), orig = fs.readFileSync(html, 'utf8');
    const { gateStatus, buildHash, codeHash } = await import('./gate.mjs'), hash = buildHash(orig);
    const r = await run(process.execPath, [path.join(SKILL, 'scripts', 'review.mjs'), `${web.base}/demo/demo.html`, '--out', path.join(qa, 'review')]);
    const tpl = fs.readFileSync(path.join(qa, 'review', 'template.md'), 'utf8'), meta = JSON.parse(fs.readFileSync(path.join(qa, 'review', 'meta.json'), 'utf8'));
    const nSheets = fs.readdirSync(path.join(qa, 'review', 'sheets')).length, nStops = fs.readdirSync(path.join(qa, 'review', 'stops')).length;
    const refused = await run(process.execPath, [path.join(SKILL, 'scripts', 'render.mjs'), html, '--out', path.join(TMP, 'gate.mp4')]);
    const rep = JSON.parse(fs.readFileSync(path.join(qa, 'qa-report.json'), 'utf8'));
    fs.writeFileSync(path.join(qa, 'qa-report.json'), JSON.stringify({ ...rep, build: hash, full: true, ready: true, failing: [] }));   // as a full passing run writes it (fps aside)
    // the sheets' real codes are only in their images: the test gives them known ones
    fs.writeFileSync(path.join(qa, 'review', 'meta.json'), JSON.stringify({ ...meta, sheets: meta.sheets.map(x => ({ ...x, code: codeHash('TEST', hash) })) }));
    const fill = (code, sheetSays, capSays, findings, verdict) => tpl
      .replace(/^(\| [^|]+\.jpg \|)\s*\|/gm, `$1 ${code} |`).replace(/^(\| review\/sheets\/[^|]+ \| [^|]* \| [^|]+ \|)\s*\|$/gm, `$1 ${sheetSays} |`)
      .replace(/^(\| \d+ \| review\/stops\/[^|]+_bare\.png \|)\s*\|$/gm, '$1 a body in space, large |').replace(/^(\| \d+ \|(?:[^|]*\|){4} review\/stops\/[^|]+_text\.png \|)\s*\|$/gm, `$1 ${capSays} |`)
      .replace(/^<one line each[^\n]*$/m, findings).replace(/^Verdict:.*$/m, `Verdict: ${verdict}`);
    const write = t => fs.writeFileSync(path.join(qa, 'visual-review.md'), t.replace(/^\| (review\/sheets[^|]+) \|/gm, '| $1 |'));
    const g0 = gateStatus(html);                                                     // QA ready, no review
    write(fill('TEST', 'nothing', 'yes', '- none', 'PASS')); const g1 = gateStatus(html);
    write(fill('ZZZZ', 'nothing', 'yes', '- none', 'PASS')); const g2 = gateStatus(html);             // codes not copied from the sheets
    write(fill('TEST', 'nothing', 'no — tiny', '- none', 'PASS')); const g3 = gateStatus(html);       // a caption that is not a stop, "PASS" anyway
    write(fill('TEST', 'nothing', 'yes', '- 3.5 s — a seam across the Moon — broken', 'PASS')); const g4 = gateStatus(html);   // PASS over a finding
    write(fill('TEST', '3.5 s — a seam', 'yes', '- 3.5 s — a seam', 'FAIL'));
    await run(process.execPath, [path.join(SKILL, 'scripts', 'review.mjs'), `${web.base}/demo/demo.html`, '--out', path.join(qa, 'review')]);   // archives the FAIL
    const meta2 = JSON.parse(fs.readFileSync(path.join(qa, 'review', 'meta.json'), 'utf8'));
    fs.writeFileSync(path.join(qa, 'review', 'meta.json'), JSON.stringify({ ...meta2, sheets: meta2.sheets.map(x => ({ ...x, code: codeHash('TEST', hash) })) }));
    write(fill('TEST', 'nothing', 'yes', '- none', 'PASS')); const g5 = gateStatus(html);             // the same build, reviewed again after a FAIL
    fs.rmSync(path.join(qa, 'reviews'), { recursive: true, force: true }); const g6 = gateStatus(html);
    fs.appendFileSync(html, '\n<!-- rebuilt -->'); const g7 = gateStatus(html);                     // the film changed after its checks
    fs.writeFileSync(html, orig); fs.rmSync(path.join(qa, 'visual-review.md'), { force: true });
    const want = [!g0.ok, g1.ok, !g2.ok, !g3.ok, !g4.ok, !g5.ok, g6.ok, !g7.ok], labels = ['no review', 'clean', 'wrong codes', 'caption "no"', 'PASS over a finding', 'after a FAIL', 'clean (no FAIL on record)', 'rebuilt'];
    const wrong = labels.filter((l, i) => !want[i]);
    check('review + gate', r.code === 0 && nSheets >= 2 && nStops === 10 && tpl.includes(`Build: ${hash}`) && refused.code === 3 && !wrong.length,
      wrong.length ? `gate wrong on: ${wrong.join(', ')}${g1.why ? ' · ' + (g1.why || []).join('; ').slice(0, 200) : ''}` : `${nSheets} sheets, ${nStops / 2} captions (bare + text) · final render refused (${refused.code}) · gate: no review ✗, clean ✓, wrong codes ✗, caption "no" ✗, PASS over a finding ✗, after a FAIL ✗, rebuilt ✗`);
  });

  // 3) rendering: 1.5 s at 60 fps with one browser and with three — the frames must be identical
  await step('render frame-exact', async () => {
    const { render } = await import('./render.mjs'), url = `${web.base}/demo-ad/demo-ad.html`;
    const a = await render({ url, out: path.join(TMP, 'r1.mp4'), workers: 1, seconds: 1.5 });              // the defaults: the MP4 only
    const b = await render({ url, out: path.join(TMP, 'r2.mp4'), seconds: 1.5, srt: true });   // this machine's default browsers; a subtitle file only when asked
    const m1 = md5s(a.out), m2 = md5s(b.out), diff = m1.filter((h, i) => h !== m2[i]).length + Math.abs(m1.length - m2.length);
    const srtOk = !a.srt && !fs.existsSync(path.join(TMP, 'r1.srt')) && !!b.srt && fs.existsSync(b.srt);
    check('render frame-exact', m1.length === 90 && diff === 0 && srtOk, `${m1.length} frames · ${a.size.join('×')} · 1 vs ${b.workers} browsers (the default here): ${diff} differ · ${(90 / a.renderSeconds).toFixed(1)} fps · .srt only with --srt: ${srtOk}`);
  });

  // 4) the engine's live pace: retime changes the loop, and retime({}) gives the authored loop back exactly
  await step('engine retime', async () => {
    const { browser, page } = await open(`${web.base}/demo-ad/demo-ad.html`);
    try {
      const r = await page.evaluate(() => { const b = window.__bw, L0 = b.LOOP, k = b.beats()[3].key, L1 = b.retime({ [k]: { speed: 8 } }).LOOP, st = b.retime({ nope: { speed: 2 } }).stale; return { L0, L1, back: b.LOOP, st }; });
      check('engine retime', r.L1 < r.L0 && Math.abs(r.back - r.L0) < 1e-9 && r.st[0] === 'nope', `loop ${r.L0.toFixed(2)} → ${r.L1.toFixed(2)} → ${r.back.toFixed(2)} s`);
    } finally { await browser.close(); }
  });

  // 5) the Studio: films, a pace edit (saved + built), a comment (+ its snapshot, and the snapshot browser closing when idle), opening
  //    the page, Send to Claude (to the right session when two wait), the storyboard
  const port = 49000 + Math.floor(Math.random() * 900);
  studio = spawn(process.execPath, [path.join(SKILL, 'studio', 'server.mjs'), TMP, '--port', String(port), '--no-open'], { stdio: 'ignore', env: { ...process.env, PF_SNAP_IDLE: '3000' } });
  const api = async (p, body) => { const r = await fetch(`http://127.0.0.1:${port}${p}`, body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}); return { status: r.status, json: await r.json().catch(() => null) }; };
  for (let i = 0; i < 40; i++) { try { await api('/api/films'); break; } catch (e) { await sleep(250); } }
  await step('studio films', async () => { const { json } = await api('/api/films'); const ids = json.films.map(f => f.id).sort().join(', ');
    const demo = json.films.find(f => f.id === 'demo'), gated = !!(demo && demo.gate && demo.gate.ok === false && demo.gate.codes.length);
    check('studio films', ids === 'demo, demo-ad, fresh' && gated, `${ids} · export card: ${gated ? 'unchecked build flagged (' + demo.gate.codes.join(', ') + ')' : 'NO gate status'}`); });
  await step('studio pace edit', async () => {
    const r = await api('/api/pace?id=demo-ad', { edits: { Inside: { speed: 4 } } }), html = fs.readFileSync(path.join(TMP, 'demo-ad', 'demo-ad.html'), 'utf8');
    const saved = r.status === 200 && fs.existsSync(path.join(TMP, 'demo-ad', 'parts', 'p8z_pace.js')) && html.includes('const PACE_EDITS');
    await api('/api/pace?id=demo-ad', { edits: {} });
    check('studio pace edit', saved && !fs.existsSync(path.join(TMP, 'demo-ad', 'parts', 'p8z_pace.js')), 'saved, built into the film, removed again');
  });
  await step('studio comment + snapshot', async () => {
    await api('/api/review?id=demo', { op: 'add', t: 3.2, x: 0.5, y: 0.4, text: 'selftest', context: {} });
    let snap = null; for (let i = 0; i < 120 && !snap; i++) { await sleep(500); const r = (await api('/api/review?id=demo')).json; snap = r.pins[0] && r.pins[0].snap; }
    check('studio comment + snapshot', !!snap && fs.existsSync(path.join(TMP, snap)), snap || 'no snapshot after 60 s');
  });
  await step('studio idle', async () => {                    // the headless Chrome for snapshots closes when there is nothing to do
    let open = true; for (let i = 0; i < 30 && open; i++) { await sleep(500); open = (await api('/api/studio')).json.snapshotBrowser; }
    check('studio idle', !open, open ? 'the snapshot browser is still running' : 'snapshot browser closed after its idle time');
  });
  await step('studio open', async () => {                    // with a page open, "open the Studio on a film" switches that page
    const ac = new AbortController(), r = await fetch(`http://127.0.0.1:${port}/api/events`, { signal: ac.signal }), rd = r.body.getReader(); let got = '';
    const reading = (async () => { for (;;) { const { value, done } = await rd.read(); if (done) break; got += Buffer.from(value).toString(); if (/event: goto/.test(got)) break; } })().catch(() => {});
    await sleep(300);
    const o = await (await fetch(`http://127.0.0.1:${port}/api/open?film=demo`, { headers: { 'X-Promptfilm': 'open' } })).json();
    await Promise.race([reading, sleep(3000)]); ac.abort();
    const again = spawn(process.execPath, [path.join(SKILL, 'studio', 'server.mjs'), TMP, '--port', String(port), '--no-open']); let out = '';
    again.stdout.on('data', d => out += d); const code = await Promise.race([new Promise(r => again.on('exit', r)), sleep(15000).then(() => 'timeout')]);
    check('studio open', !o.opened && o.pages === 1 && /"film":"demo"/.test(got) && code === 0 && /already running/.test(out),
      `page switched to demo · a second start reuses the running Studio (${code})`);
  });
  await step('right session', async () => {                  // two sessions wait — an old any-film watcher first; demo-ad's request goes to demo-ad's
    const anyAc = new AbortController();
    const any = fetch(`http://127.0.0.1:${port}/api/await?film=*`, { headers: { 'X-Promptfilm': 'await' }, signal: anyAc.signal }).then(r => r.status).catch(() => 'closed');
    await sleep(300);
    const aw = spawn(process.execPath, [path.join(SKILL, 'studio', 'await.mjs'), '--port', String(port), '--film', 'demo-ad']); let out = '';
    aw.stdout.on('data', d => out += d); const done = new Promise(r => aw.on('exit', r));
    for (let i = 0; i < 40 && !(await api('/api/studio')).json.waiting.includes('demo-ad'); i++) await sleep(150);
    let first = null; for (let i = 0; i < 40 && !(first && first.delivered); i++) { await sleep(250); first = (await api('/api/ask?id=demo-ad', {})).json; }
    const code = await Promise.race([done, sleep(30000).then(() => 'timeout')]);
    const second = (await api('/api/ask?id=demo-ad', {})).json;                  // pressed again while that session works
    const anyGot = await Promise.race([any, sleep(1500).then(() => 'still waiting')]);
    anyAc.abort();
    const bare = await run(process.execPath, [path.join(SKILL, 'studio', 'await.mjs'), '--port', String(port)]);   // no --film, several films
    check('right session', first.delivered && code === 0 && /film\s+demo-ad/.test(out) && second.busy && !second.delivered && anyGot === 'still waiting' && bare.code === 2 && /--film/.test(bare.out),
      first.delivered ? `to demo-ad's session only (the any-film watcher: ${anyGot}); again → ${second.busy ? 'already working' : JSON.stringify(second)}; no --film → exit ${bare.code}` : 'not delivered');
  });
  await step('send to claude', async () => {
    const aw = spawn(process.execPath, [path.join(SKILL, 'studio', 'await.mjs'), '--port', String(port), '--film', 'demo']); let out = '';
    aw.stdout.on('data', d => out += d); const done = new Promise(r => aw.on('exit', r));
    let delivered = false; for (let i = 0; i < 40 && !delivered; i++) { await sleep(250); delivered = (await api('/api/ask?id=demo', {})).json.delivered; }
    const code = await Promise.race([done, sleep(30000).then(() => 'timeout')]);
    check('send to claude', delivered && code === 0 && /PROMPTFILM REQUEST/.test(out) && /selftest/.test(out), delivered ? `watcher exited ${code} with the request` : 'not delivered');
  });
  await step('storyboard review', async () => {
    const dir = path.join(TMP, 'board'); fs.mkdirSync(path.join(dir, 'parts'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'build.sh'), fs.readFileSync(path.join(SKILL, 'engine', 'build.sh'), 'utf8'));
    fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify({ version: 1, title: 'selftest', format: { aspect: '9x16', length: '12-20', langs: 'en ko' },
      scenes: [{ id: 's1', name: 'one', beat: 'hook', seconds: 2 }, { id: 's2', name: 'two', beat: 'key', seconds: 3 }], open: ['a question?'] }));
    const latest = (await api('/api/films')).json.films[0].id;   // rescan: a film with only its storyboard — the newest, so the page opens on it
    const aw = spawn(process.execPath, [path.join(SKILL, 'studio', 'await.mjs'), '--port', String(port), '--film', 'board']); let out = '';
    aw.stdout.on('data', d => out += d); const done = new Promise(r => aw.on('exit', r));
    await api('/api/storyboard?id=board', { op: 'scene', id: 's2', status: 'change', note: 'closer please' });
    await api('/api/storyboard?id=board', { op: 'answer', i: 0, text: 'yes' });
    let sent = null; for (let i = 0; i < 40 && !(sent && sent.delivered); i++) { await sleep(250); sent = (await api('/api/storyboard?id=board', { op: 'send', approve: false, note: 'n' })).json; }
    const code = await Promise.race([done, sleep(30000).then(() => 'timeout')]);
    check('storyboard review', latest === 'board' && sent.delivered && code === 0 && /PROMPTFILM STORYBOARD/.test(out) && /closer please/.test(out) && /a question\?.*yes/.test(out),
      sent.delivered ? `change request delivered with the answer · listed first: ${latest}` : 'not delivered');
  });
  await step('storyboard frames', async () => {             // a built film's storyboard: each card gets the build's own frame at its moment
    fs.writeFileSync(path.join(TMP, 'demo-ad', 'storyboard.json'), JSON.stringify({ version: 1, title: 'selftest', format: { aspect: '9x16', length: '12-20', langs: 'en ko' },
      scenes: [{ id: 's1', name: 'one', beat: 'hook', seconds: 3 }, { id: 's2', name: 'two', beat: 'key', seconds: 4, at: 9.5 }, { id: 's3', name: 'three', beat: 'normal', seconds: 3 }], open: [] }));
    let r = null; for (let i = 0; i < 120; i++) { r = (await api('/api/sbframes?id=demo-ad')).json; if (r.stamp && !r.running && Object.keys(r.frames).length === 3) break; await sleep(500); }
    const files = Object.values(r.frames || {}).map(f => f.file), ok = files.length === 3 && files.every(f => fs.existsSync(path.join(TMP, f)) && fs.statSync(path.join(TMP, f)).size > 3000);
    const again = (await api('/api/sbframes?id=demo-ad')).json;                       // same build, same storyboard: nothing made again
    // an early build (a 16.9 s loop for a 60 s plan): only the card whose "at" the build reaches gets a frame — the rest keep their pictures
    await sleep(1100);
    fs.writeFileSync(path.join(TMP, 'demo-ad', 'storyboard.json'), JSON.stringify({ version: 2, title: 'selftest', format: { aspect: '9x16', length: '45-60', langs: 'en ko' },
      scenes: [{ id: 's1', name: 'one', beat: 'hook', seconds: 20, at: 2 }, { id: 's2', name: 'two', beat: 'key', seconds: 20 }, { id: 's3', name: 'three', beat: 'normal', seconds: 20, at: 40 }], open: [] }));
    let e = null; for (let i = 0; i < 120; i++) { e = (await api('/api/sbframes?id=demo-ad')).json; if (e.stamp && e.stamp !== r.stamp && !e.running) break; await sleep(500); }
    const early = Object.keys(e.frames || {}).join(',');
    check('storyboard frames', ok && r.frames.s2.t === 9.5 && !again.running && again.stamp === r.stamp && early === 's1',
      ok ? `3 frames at ${Object.values(r.frames).map(f => f.t).join(' · ')} s ("at" kept) · kept until the build changes · early build: only ${early}` : JSON.stringify(r).slice(0, 200));
  });
  await step('cross-site guard', async () => {
    const r = await fetch(`http://127.0.0.1:${port}/api/pace?id=demo-ad`, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: '{}' });
    // a page of another site: its GETs don't reach the API either (they could start snapshot work); the page itself still loads
    const g = await fetch(`http://127.0.0.1:${port}/api/sbframes?id=demo-ad`, { headers: { 'Sec-Fetch-Site': 'cross-site' } });
    const own = await fetch(`http://127.0.0.1:${port}/api/films`, { headers: { 'Sec-Fetch-Site': 'same-origin' } });
    const page = await fetch(`http://127.0.0.1:${port}/`, { headers: { 'Sec-Fetch-Site': 'cross-site' } });
    check('cross-site guard', r.status === 403 && g.status === 403 && own.status === 200 && page.status === 200,
      `a non-JSON POST → ${r.status} · another site's GET → ${g.status} · the page's own → ${own.status} · the page from a link → ${page.status}`);
  });
} finally {
  if (studio) studio.kill();
  if (web) web.srv.close();
  if (!has('keep')) fs.rmSync(TMP, { recursive: true, force: true });
}
console.log(`\n${failed ? `${failed} of ${rows.length} checks FAILED` : `all ${rows.length} checks passed`}${has('keep') ? ` · kept ${TMP}` : ''}`);
process.exit(failed ? 1 : 0);
