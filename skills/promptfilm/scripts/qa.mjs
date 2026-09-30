// The whole check-list in one run. Writes <out>/qa-report.json, <out>/qa-report.md and contact sheets.
//   node qa.mjs <url> [--out dir] [--only a,b] [--skip a,b] [--w 540 --h 960] [--loop 45,60]
//   (default viewport: the film's aspect, common.mjs SIZES; default loop target: the film's FORMAT.length)
// checks: load engine err pace read continuity inside presence nan seam empty surfaces flicker pops safe labels contact fps duration drift live
// Every number printed is measured; a check that cannot run on this page says so ("skipped: …").
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { open, realLogs, seek, shot, decode, writePng, diff, mkdir, argv, fs, path } from './common.mjs';
const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const url = process.argv[2];
if (!url || url.startsWith('--')) { console.error('usage: node qa.mjs <url> [--out dir] [--only a,b] [--skip a,b]'); process.exit(2); }
const out = mkdir(argv('out', 'qa'));
let W = argv('w', null), H = argv('h', null);          // null = the film's own aspect
const ALL = ['load', 'engine', 'err', 'pace', 'read', 'continuity', 'inside', 'presence', 'nan', 'seam', 'empty', 'surfaces', 'flicker', 'pops', 'safe', 'labels', 'contact', 'fps', 'duration', 'drift', 'live'];
const only = argv('only', null), skip = (argv('skip', '') || '').split(',');
const run = c => (only ? only.split(',').includes(c) : true) && !skip.includes(c);
let LOOP_MIN, LOOP_MAX;
const R = { url, when: new Date().toISOString(), checks: {} };
const note = (k, v) => { R.checks[k] = v; console.log(`\n[${k}]`, JSON.stringify(v, null, 0).slice(0, 1600)); };
const lum = (p, i) => 0.2126 * p.data[i] + 0.7152 * p.data[i + 1] + 0.0722 * p.data[i + 2];

const fileHash = async () => { try { return createHash('sha1').update((await (await fetch(url)).text()).replace(/^\uFEFF/, '')).digest('hex').slice(0, 12); } catch (e) { return null; } };
const HASH0 = await fileHash();
let { browser, page, logs, err } = await open(url, { w: W, h: H, q: '?freeze' });
({ width: W, height: H } = page.viewportSize());
const info = await page.evaluate(() => {
  const b = window.__bw; if (!b) return null;
  return { LOOP: b.LOOP, LOOP_T: b.LOOP_T, format: b.FORMAT || { aspect: '9x16', langs: ['en', 'ko'], length: [45, 60] },
    safe: b.SAFE || { top: 0.07, bottom: 0.20, side: [0.85, 0.45, 0.80] }, problems: b.PROBLEMS || [], hasBeats: typeof b.beats === 'function', hasCaps: typeof b.captions === 'function',
    hasPresence: typeof b.presenceCheck === 'function', hasNan: !!(b._dbg && b._dbg.nanScan), hasInside: typeof b.insideCheck === 'function',
    hasAbout: typeof b.aboutCheck === 'function', hasScan: !!(b._dbg && b._dbg.surfaceScan) };
});
if (!info) { console.error('no window.__bw on the page'); process.exit(1); }
const LOOP = info.LOOP;
[LOOP_MIN, LOOP_MAX] = argv('loop', null) ? argv('loop').split(',').map(Number) : info.format.length;
Object.assign(R, { viewport: [W, H], format: info.format });
if (run('load')) note('load', { errorBox: err, LOOP: +LOOP.toFixed(3), authored: info.LOOP_T && +info.LOOP_T.toFixed(2), problems: info.problems, pass: !err && info.problems.length === 0 });
// every check below runs inside one guard: a check that crashes (a film that breaks a hook, a page that dies) is a failure in the report,
// never a missing report
try {

/* ---------- err: seek across the loop, collect console / shader errors ---------- */
if (run('err')) {
  for (let i = 0; i < 48; i++) await seek(page, (i + 0.5) / 48 * LOOP);
  const r = realLogs(logs);
  note('err', { logs: r.length, first: r.slice(0, 5).map(l => l.slice(0, 600)), pass: r.length === 0 && !err });
}

/* ---------- engine: the film runs THIS skill's engine — the checks below live in it, so an older or edited copy would weaken them ---------- */
if (run('engine')) {
  let html = ''; try { html = await (await fetch(url)).text(); } catch (e) {}
  // the built page must contain each core part word for word, and the film's own copies in parts/ (next to --out) must be exactly them
  const core = path.join(SKILL, 'engine', 'core'), parts = ['p2_core.js', 'p7_post.js', 'p9_engine.js'], own = path.join(path.dirname(path.resolve(out)), 'parts');
  const differ = parts.filter(f => { try { const c = fs.readFileSync(path.join(core, f), 'utf8');
    if (!html.includes(c.trim())) return true;
    return fs.existsSync(path.join(own, f)) && fs.readFileSync(path.join(own, f), 'utf8') !== c; } catch (e) { return true; } });
  note('engine', { differ, pass: differ.length === 0,
    note: differ.length ? `the film's ${differ.join(', ')} differ from the skill's engine/core — copy them into parts/ (the film's own parts stay) and rebuild: QA measures with the current engine` : 'the film runs the current engine' });
}

/* ---------- the camera, sampled once for pace and read: zoom (e-folds/s), turn (°/s), travel of the target (views/s) ---------- */
// HELD: the picture can be taken in — the view barely grows or shrinks, turns slowly, and what is framed stays framed (turning about a
// fixed target, an orbit, keeps the subject in place; panning or travelling sweeps it away). FAST: the most any move may do outside the
// way back. From the requester's own edits (pacing.md §1): ~0.8 e-folds/s where they wanted people to look, 2.4 at their fastest.
const HELD = { zoom: 0.8, turn: 30, travel: 0.4 }, FAST = { zoom: 3, turn: 45, travel: 1.5 }, RETURN_ZOOM = 16;
const DT = 1 / 30;
const BEATS = info.hasBeats ? await page.evaluate(() => window.__bw.beats()) : null;
const CAPS = info.hasCaps ? await page.evaluate(() => window.__bw.captions()) : null;
const CAM = (run('pace') || run('read')) ? await page.evaluate(({ LOOP, dt }) => {
  const o = []; let p = null;
  for (let t = 0; t <= LOOP; t += dt) {
    const c = window.__bw.camAt(Math.min(t, LOOP - 1e-4));
    if (p) o.push({ t: +(t - dt / 2).toFixed(4), zoom: Math.abs(Math.log(c.field / p.field)) / dt,
      turn: c.q && p.q ? 2 * Math.acos(Math.min(1, Math.abs(c.q[0] * p.q[0] + c.q[1] * p.q[1] + c.q[2] * p.q[2] + c.q[3] * p.q[3]))) * 180 / Math.PI / dt : 0,
      travel: c.T && p.T ? Math.hypot(c.T[0] - p.T[0], c.T[1] - p.T[1], c.T[2] - p.T[2]) / Math.max(c.field, p.field) / dt : 0 });
    p = c;
  }
  return o;
}, { LOOP, dt: DT }) : null;
const held = s => s.zoom <= HELD.zoom && s.turn <= HELD.turn && s.travel <= HELD.travel;
const beatAt = t => (BEATS || []).find(b => t >= b.t0 && t < b.t1) || null;
// the way back is ONE run of 'return' beats at the end of the loop; a 'return' anywhere else is no exemption
const RET0 = (() => { if (!BEATS || !BEATS.length) return Infinity; let i = BEATS.length - 1; while (i >= 0 && BEATS[i].kind === 'return') i--; return i < BEATS.length - 1 ? BEATS[i + 1].t0 : Infinity; })();
const inReturn = t => t >= RET0;
// the requester's own pace edits (Studio → PACE_EDITS): what they changed is theirs — its effects are reported as accepted, not failed
const edited = b => !!(b && b.edited);

/* ---------- pace: the beats in playback time, how fast the camera moves, how much of the loop it holds ---------- */
if (run('pace')) {
  const rows = [], warn = [], accepted = [];
  if (LOOP < LOOP_MIN || LOOP > LOOP_MAX) warn.push(`loop ${LOOP.toFixed(1)} s is outside ${LOOP_MIN}–${LOOP_MAX} s`);
  const list = (a, f) => a.sort((x, y) => y[1] - x[1]).slice(0, 6).map(f).join(', ') + (a.length > 6 ? ', …' : '');
  const zOver = [], tOver = [], mOver = [], strayReturn = [];
  if (BEATS) for (const b of BEATS) {
    const seg = CAM.filter(s => s.t >= b.t0 && s.t < b.t1), zMax = Math.max(0, ...seg.map(s => s.zoom)), rMax = Math.max(0, ...seg.map(s => s.turn)), vMax = Math.max(0, ...seg.map(s => s.travel));
    rows.push({ ...b, zoomMax: +zMax.toFixed(2), zoomMean: +(seg.reduce((a, s) => a + s.zoom, 0) / Math.max(1, seg.length)).toFixed(2), rotMax: +rMax.toFixed(1), travelMax: +vMax.toFixed(2), edited: edited(b) });
    if (b.kind === 'return' && b.t0 < RET0) strayReturn.push(b.name);
    const ret = b.t0 >= RET0, bad = [];
    if (b.kind === 'hook' && b.dur > 3.5) bad.push(`hook '${b.name}' plays ${b.dur.toFixed(2)} s (> 3.5 s)`);
    // faster than this, the frame smears and a step is flown past instead of shown (the requester: "too much is skipped")
    if (zMax > (ret ? RETURN_ZOOM : FAST.zoom)) zOver.push([b.name, zMax, ret, edited(b)]);
    if (rMax > (ret ? 90 : FAST.turn)) tOver.push([b.name, rMax, ret, edited(b)]);
    if (!ret && vMax > FAST.travel) mOver.push([b.name, vMax, ret, edited(b)]);
    bad.forEach(x => (edited(b) ? accepted : warn).push(x));
  }
  const split = (arr, what) => { const mine = arr.filter(x => !x[3]), theirs = arr.filter(x => x[3]);
    if (mine.length) warn.push(what(mine)); if (theirs.length) accepted.push(what(theirs) + ' — the requester\'s own pace edit'); };
  split(zOver, a => `zooms faster than ${FAST.zoom} e-folds/s (the requester's fastest edit: 2.4; the way back: ${RETURN_ZOOM}) in ${a.length} beats: ${list(a, x => `'${x[0]}' ${x[1].toFixed(1)}`)}`);
  split(tOver, a => `turns faster than ${FAST.turn}°/s (90 on the way back) in ${a.length} beats: ${list(a, x => `'${x[0]}' ${x[1].toFixed(0)}°/s`)}`);
  split(mOver, a => `sweeps the view faster than ${FAST.travel} views/s in ${a.length} beats: ${list(a, x => `'${x[0]}' ${x[1].toFixed(1)}`)}`);
  if (strayReturn.length) warn.push(`'return' beats before the way back at the end: ${strayReturn.map(n => `'${n}'`).join(', ')} — only the last run of beats may be the return`);
  // sudden changes of pace: the zoom rate changing by more than 2.5 e-folds/s AND by more than half within 0.1 s reads as a jolt
  const zoomAt = CAM.map(s => s.zoom), jumps = [];
  for (let i = 3; i < zoomAt.length; i++) { const d = Math.abs(zoomAt[i] - zoomAt[i - 3]); if (d > 2.5 && d > 0.5 * Math.max(zoomAt[i], zoomAt[i - 3])) { const t = +CAM[i].t.toFixed(2); if (!jumps.length || t - jumps[jumps.length - 1] > 0.3) jumps.push(t); } }
  if (jumps.length) warn.push(`the zoom rate jumps ${jumps.length}× within 0.1 s (first at ${jumps.slice(0, 5).join(', ')} s)`);
  const byKind = {}; (BEATS || []).forEach(b => { byKind[b.kind] = +((byKind[b.kind] || 0) + b.dur).toFixed(2); });
  // the time budget: the way back is not new information; the rest must mostly be held, not flown through
  const ret = RET0 < Infinity ? LOOP - RET0 : 0, heldShare = CAM.filter(held).length / CAM.length;
  if (ret > 0.12 * LOOP + 1e-6) warn.push(`the way back plays ${ret.toFixed(1)} s = ${(ret / LOOP * 100).toFixed(0)}% of the loop (> 12%)`);
  if (heldShare < 0.5) warn.push(`the camera holds still enough to take things in for ${(heldShare * 100).toFixed(0)}% of the loop (< 50%)`);
  const v = { loop: +LOOP.toFixed(2), byKind, held: +(heldShare * 100).toFixed(0), returnFrom: RET0 < Infinity ? +RET0.toFixed(2) : null, beats: rows,
    zoomMax: +Math.max(...zoomAt).toFixed(2), rotMax: +Math.max(...CAM.map(s => s.turn)).toFixed(1), warnings: warn, accepted, pass: warn.length === 0 };
  if (!BEATS) { v.note = 'the page has no __bw.beats() — beats are required'; v.pass = false; }
  note('pace', v);
}

/* ---------- read: every caption is a stop — up long enough to read, while the camera holds on what it names, visible and large ---------- */
if (run('read')) {
  if (!CAPS || !info.hasAbout) note('read', { pass: false, note: 'the page has no __bw.captions() / aboutCheck() — the film runs an older engine: update parts/ from engine/core (QA engine)' });
  else {
    const langs = (info.format && info.format.langs) || ['en'], cjk = l => /^(ko|ja|zh)/.test(l || '');
    // what the viewer reads: with two languages the second line (the plain-words line for the audience) plus a glance at the title;
    // else the title and the line. Subtitle reading speeds: 12 characters/s for Korean, Japanese, Chinese, 17 for others; + 0.5 s to
    // find the text and 0.2 s for its fades
    const count = x => [...String(x || '').replace(/<[^>]+>/g, '').replace(/^\s*\(|\)\s*$/g, '').trim()].length;
    const readTime = c => { const two = langs.length > 1 && c.second;
      return 0.7 + (two ? count(c.second) / (cjk(langs[1]) ? 12 : 17) + count(c.title) / 25 : count(`${c.title || ''} ${c.line || ''}`) / (cjk(langs[0]) ? 12 : 17)); };
    const ABOUT = await page.evaluate(() => window.__bw.aboutCheck(0.1));
    const BIG = 0.4, SHARE = 0.005, OFF = 1.0, NONE = { about: [], declaredOnly: true, samples: [] };           // the subject's visible box ≥ 40% of the frame's side and ≥ 0.5% of its pixels
    const rows = [], warn = [], accepted = [], short = [], passed = [], unnamed = [], sphere = [], overMove = [];
    CAPS.forEach((c, i) => {
      const dur = c.t1 - c.t0, need = readTime(c), mid = (c.t0 + c.t1) / 2, b = beatAt(mid), kind = b ? b.kind : null, ret = inReturn(mid);
      const holdNeed = Math.max(kind === 'key' ? 2.4 : 1.8, need), a = (Array.isArray(ABOUT) && ABOUT[i] && Array.isArray(ABOUT[i].samples)) ? ABOUT[i] : NONE;
      const at = t => a.samples.length ? a.samples[Math.max(0, Math.min(a.samples.length - 1, Math.round((t - c.t0) / 0.1)))] : null;
      let stop = 0, run = 0, inStop = 0, biggest = 0;
      for (const x of CAM) {
        if (x.t < c.t0 || x.t >= c.t1) continue;
        const sm = at(x.t), ok = held(x) && sm && sm[1] && sm[2] >= BIG && sm[3] >= SHARE;
        run = ok ? run + DT : 0; stop = Math.max(stop, run); if (ok) inStop += DT;
        if (sm && sm[1]) biggest = Math.max(biggest, sm[2]);
      }
      rows.push({ title: c.title, t0: +c.t0.toFixed(2), dur: +dur.toFixed(2), read: +need.toFixed(2), stop: +stop.toFixed(2), outside: +(dur - inStop).toFixed(2),
        about: a.about, largest: +biggest.toFixed(2), beat: kind, edited: edited(b) });
      const mine = !edited(b);
      if (dur + 1e-3 < need) (mine ? short : accepted).push(`'${c.title}' ${dur.toFixed(1)}/${need.toFixed(1)} s`);
      if (ret) return;
      if (!a.about.length) { unnamed.push(`'${c.title}'`); return; }
      if (a.declaredOnly) { sphere.push(`'${c.title}' (${a.about.join(' + ')})`); return; }
      if (stop + 1e-3 < holdNeed) (mine ? passed : accepted).push(`'${c.title}' ${stop.toFixed(1)}/${holdNeed.toFixed(1)} s (${a.about.join(' + ')}: at most ${(biggest * 100).toFixed(0)}% of the frame while held)`);
      else if (dur - stop > OFF + 1e-3) (mine ? overMove : accepted).push(`'${c.title}' ${(dur - stop).toFixed(1)} s`);
    });
    if (short.length) warn.push(`${short.length} of ${CAPS.length} captions go before they can be read (up / reading time): ${short.join(', ')}`);
    if (unnamed.length) warn.push(`${unnamed.length} captions don't say what they show (caption(…, about)): ${unnamed.join(', ')}`);
    if (sphere.length) warn.push(`${sphere.length} captions are about a sphere with nothing drawn (subject() without { obj }): ${sphere.join(', ')} — name the object the viewer should see`);
    if (passed.length) warn.push(`${passed.length} of ${CAPS.length} captions are not a stop — the camera doesn't hold on what they name, visible, framed and ≥ ${BIG * 100}% of the frame, for their reading time (stop / needed): ${passed.join(', ')}`);
    if (overMove.length) warn.push(`${overMove.length} captions run over a move for more than ${OFF} s besides their stop: ${overMove.join(', ')}`);
    // long stretches that explain nothing (the way back aside)
    const gaps = []; let last = 0;
    for (const c of [...CAPS].sort((a, b) => a.t0 - b.t0)) { if (c.t0 - last > 5 && !inReturn(c.t0 - 0.01)) gaps.push([+last.toFixed(1), +c.t0.toFixed(1)]); last = Math.max(last, c.t1); }
    if (Math.min(LOOP, RET0) - last > 5) gaps.push([+last.toFixed(1), +Math.min(LOOP, RET0).toFixed(1)]);
    gaps.forEach(g => warn.push(`${(g[1] - g[0]).toFixed(1)} s without a caption (${g[0]}–${g[1]} s)`));
    if (accepted.length) accepted.unshift('in beats the requester re-paced:');
    note('read', { captions: rows, warnings: warn, accepted, pass: warn.length === 0,
      note: `a stop = the camera held (zoom ≤ ${HELD.zoom} e/s, turn ≤ ${HELD.turn}°/s, target ≤ ${HELD.travel} view/s) with the caption's subject visible, framed and ≥ ${BIG * 100}% of the frame, for max(1.8 s — 2.4 in key beats —, the reading time: 0.7 s + the audience's line at 12 characters/s in Korean, Japanese, Chinese, 17/s otherwise); ≤ ${OFF} s of the caption outside it` });
  }
}

/* ---------- continuity: the camera never jumps (the requester rejects cut-like jumps in every format) ---------- */
if (run('continuity')) {
  const r = await page.evaluate(LOOP => {
    const dt = 1 / 60, jumps = []; let p = null, n = 0;
    for (let t = 0; t <= LOOP; t += dt) {
      const c = window.__bw.camAt(Math.min(t, LOOP - 1e-4)); n++;
      if (p) {
        const dT = Math.hypot(c.T[0] - p.T[0], c.T[1] - p.T[1], c.T[2] - p.T[2]) / Math.max(c.field, p.field);
        const dz = Math.abs(Math.log(c.field / p.field));
        const dq = c.q && p.q ? 2 * Math.acos(Math.min(1, Math.abs(c.q[0] * p.q[0] + c.q[1] * p.q[1] + c.q[2] * p.q[2] + c.q[3] * p.q[3]))) * 180 / Math.PI : 0;
        if (dT > 0.25 || dz > 0.35 || dq > 12) jumps.push([+t.toFixed(3), +dT.toFixed(2), +dz.toFixed(2), +dq.toFixed(1)]);
      }
      p = c;
    }
    return { frames: n, jumps: jumps.length, first: jumps.slice(0, 10) };
  }, LOOP);
  note('continuity', { ...r, pass: r.jumps === 0, note: 'per 1/60 s: target move > 25% of the view, zoom > 0.35 e-folds or turn > 12° = a jump ([t, move, zoom, turn])' });
}

/* ---------- inside / presence / nan (page-side scans) ---------- */
if (run('inside')) note('inside', info.hasInside ? await page.evaluate(() => { const r = window.__bw.insideCheck(); return { ...r, pass: r.hits === 0 }; }) : { skipped: 'no insideCheck()' });
if (run('presence')) note('presence', info.hasPresence ? await page.evaluate(() => { const r = window.__bw.presenceCheck(); return { ...r, pass: r.hits === 0 }; }) : { skipped: 'no presenceCheck()' });
if (run('nan')) {
  if (!info.hasNan) note('nan', { skipped: 'no _dbg.nanScan()' });
  else {
    const r = await page.evaluate(LOOP => { const bad = []; let n = 0; for (let t = 0; t < LOOP; t += 1 / 15) { window.__bw.seek(t); const s = window.__bw._dbg.nanScan(); n++; if (s.nan || s.inf) bad.push([+t.toFixed(2), s.nan, s.inf]); } return { frames: n, bad: bad.length, first: bad.slice(0, 10) }; }, LOOP);
    note('nan', { ...r, pass: r.bad === 0 });
  }
}

/* ---------- seam: the last frame of the loop against the first ---------- */
if (run('seam')) {
  await seek(page, 0); await page.waitForTimeout(30); const a = decode(await shot(page));
  await seek(page, LOOP - 0.001); await page.waitForTimeout(30); const b = decode(await shot(page));
  const d = diff(a, b); note('seam', { mean: +d.mean.toFixed(2), max: d.max, pass: d.mean < 2 });
}

/* ---------- empty: moments with almost nothing to see (text hidden) — a flat colour, fog, a lone dot, the dark between two levels ----------
   (P9: the camera always looks at something. Two signals on a 320 px frame: the share of pixels with visible local contrast — the
   reference films never go below 4% — and the share covered by solid geometry at all) */
if (run('empty')) {
  const dir = mkdir(path.join(out, 'empty')), k = 320 / Math.max(W, H), EDGE = 0.015, SPARSE = 0.03, GEO = 0.01, STEP = 0.25;
  const sm = await open(url, { w: Math.round(W * k), h: Math.round(H * k), q: '?freeze&text=0' });
  const share = png => {
    const { width: w, height: h, data } = png, L = new Float32Array(w * h); let e = 0, n = 0;
    for (let i = 0; i < w * h; i++) L[i] = 0.2126 * data[i * 4] + 0.7152 * data[i * 4 + 1] + 0.0722 * data[i * 4 + 2];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (Math.hypot(L[i + 1] - L[i - 1], L[i + w] - L[i - w]) > 16) e++; n++; }
    return e / n;
  };
  const scan = info.hasScan, samples = [];
  for (let t = 0; t < LOOP; t += STEP) {
    await seek(sm.page, t); const buf = await shot(sm.page), s = share(decode(buf));
    const geo = scan ? (await sm.page.evaluate(() => window.__bw._dbg.surfaceScan(64))).geo : 1;
    samples.push({ t, s, geo, buf, empty: s < EDGE || (s < SPARSE && geo < GEO) });
  }
  await sm.browser.close();
  const stretches = []; let cur = null;
  for (const x of samples) {
    if (x.empty) { if (!cur) cur = { t0: x.t, t1: x.t + STEP, min: x.s, buf: x.buf }; else { cur.t1 = x.t + STEP; if (x.s < cur.min) { cur.min = x.s; cur.buf = x.buf; } } }
    else if (cur) { stretches.push(cur); cur = null; }
  }
  if (cur) stretches.push(cur);
  const bad = stretches.filter(x => x.t1 - x.t0 >= 0.5 - 1e-6);
  bad.slice(0, 12).forEach(x => fs.writeFileSync(path.join(dir, `empty_t${x.t0.toFixed(2)}.png`), x.buf));
  note('empty', { samples: samples.length, stretches: bad.map(x => [+x.t0.toFixed(2), +x.t1.toFixed(2), +(x.min * 100).toFixed(2)]), seconds: +bad.reduce((a, x) => a + x.t1 - x.t0, 0).toFixed(2),
    pass: bad.length === 0, note: `≥ 0.5 s with detail below ${EDGE * 100}% of the pixels, or below ${SPARSE * 100}% with solid geometry under ${GEO * 100}% of the frame ([from, to, lowest detail %]); images in empty/` });
}

/* ---------- surfaces: what the camera really looks at, and where it goes — inside a model or through a missing face, a wall against
   the lens, the camera passing through something (P30: the camera never passes through anything; every model is closed where it is seen) */
if (run('surfaces')) {
  if (!info.hasScan) note('surfaces', { pass: false, note: 'the film runs an older engine without _dbg.surfaceScan() — update parts/ from engine/core (QA engine)' });
  else {
    const dir = mkdir(path.join(out, 'surfaces')), k = 320 / Math.max(W, H), STEP = 0.1, BACK = 0.004, NEAR = 0.25;
    const sm = await open(url, { w: Math.round(W * k), h: Math.round(H * k), q: '?freeze&text=0' });
    const samples = [];
    for (let t = 0; t < LOOP; t += STEP) samples.push({ t, ...(await sm.page.evaluate(t => { window.__bw.seek(t); return window.__bw._dbg.surfaceScan(96); }, t)) });
    const path_ = await sm.page.evaluate(() => window.__bw._dbg.pathScan ? window.__bw._dbg.pathScan(1 / 60) : { hits: 0, first: [], skipped: [], missing: true });
    await sm.browser.close();
    const stretches = (key, lim, minDur) => { const o = []; let cur = null;
      for (const x of samples) { if (x[key] >= lim) { if (!cur) cur = { t0: x.t, t1: x.t + STEP, worst: x[key], at: x.t }; else { cur.t1 = x.t + STEP; if (x[key] > cur.worst) { cur.worst = x[key]; cur.at = x.t; } } } else if (cur) { o.push(cur); cur = null; } }
      if (cur) o.push(cur); return o.filter(x => x.t1 - x.t0 >= minDur - 1e-6); };
    const back = stretches('back', BACK, STEP), near = stretches('near', NEAR, 0.2);
    // which meshes, at the worst moment of each stretch (name your meshes: o.name shows here)
    for (const x of back.slice(0, 6)) x.who = await page.evaluate(t => { window.__bw.seek(t); return window.__bw._dbg.surfaceWho(96); }, x.at);
    for (const [kind, list] of [['back', back], ['near', near]]) for (const x of list.slice(0, 8)) { await seek(page, x.at); await page.waitForTimeout(30); await shot(page, path.join(dir, `${kind}_t${x.at.toFixed(2)}.png`)); }
    for (const h of path_.first.slice(0, 6)) { await seek(page, h[0]); await page.waitForTimeout(30); await shot(page, path.join(dir, `through_t${h[0].toFixed(2)}.png`)); }
    const fmt = l => l.map(x => [+x.t0.toFixed(2), +x.t1.toFixed(2), +(x.worst * 100).toFixed(1), ...(x.who && x.who.length ? [x.who.map(w => `${w[0]} ${w[2]}%`).join(', ')] : [])]);
    note('surfaces', { samples: samples.length, back: fmt(back), near: fmt(near), through: path_.first, throughCount: path_.hits, notPathChecked: path_.skipped,
      pass: back.length === 0 && near.length === 0 && path_.hits === 0 && !path_.missing,
      note: `back = the camera inside a model or looking through a missing face (≥ ${BACK * 100}% of the frame); near = something closer than 8% of the distance to the target over ≥ ${NEAR * 100}% of the frame for ≥ 0.2 s ([from, to, worst %, meshes]); through = the camera's path crossing a solid mesh ([t, mesh]) — mark a surface it may cross userData.passable; images in surfaces/` });
  }
}

/* ---------- flicker: a pixel whose brightness alternates up / down / up over consecutive 1/60 s frames ----------
   (a moving edge changes one way; z-fighting, shimmering sub-pixel lines and per-frame noise alternate) */
// sampled at the calmest moments of the whole picture (at least one per beat): anything moving fast — the camera or an
// object — scrambles pixels from frame to frame by itself
if (run('flicker')) {
  const dir = mkdir(path.join(out, 'flicker')), res = [];
  const sm = await open(url, { w: Math.round(W / 4), h: Math.round(H / 4), q: '?freeze&text=0' });   // W, H: the viewport measured above
  const calm = [];
  for (let t = 0; t < LOOP - 0.1; t += 0.2) {
    await seek(sm.page, t); const a = decode(await shot(sm.page)); await seek(sm.page, t + 4 / 60); const b = decode(await shot(sm.page));
    calm.push([t, diff(a, b).mean]);
  }
  await sm.browser.close();
  const beatsF = info.hasBeats ? await page.evaluate(() => window.__bw.beats()) : [];
  const picks = [];
  const CALM = 2.5;                         // mean change over 4 frames (0..255) above which a moment is not calm
  for (const b of beatsF) { const inB = calm.filter(c => c[0] >= b.t0 && c[0] < b.t1 - 0.1 && c[1] < CALM); if (inB.length) picks.push(inB.sort((x, y) => x[1] - y[1])[0][0]); }
  for (const c of [...calm].sort((x, y) => x[1] - y[1])) { if (picks.length >= 24 || c[1] >= CALM) break; if (picks.every(p => Math.abs(p - c[0]) > 0.5)) picks.push(c[0]); }
  picks.sort((a, b) => a - b);
  await page.evaluate(() => document.getElementById('frame').classList.add('nolabels'));      // the picture only
  for (const t of picks) {
    const f = [];
    for (let k = 0; k < 5; k++) { await seek(page, t + k / 60); f.push(decode(await shot(page))); }
    const N = f[0].width * f[0].height; let bad = 0; const heat = Buffer.alloc(N * 4);
    for (let p = 0; p < N; p++) { const i4 = p * 4, L = f.map(g => lum(g, i4));
      const d = [L[2] - 2 * L[1] + L[0], L[3] - 2 * L[2] + L[1], L[4] - 2 * L[3] + L[2]];
      const alt = d.every(v => Math.abs(v) > 16) && Math.sign(d[0]) !== Math.sign(d[1]) && Math.sign(d[1]) !== Math.sign(d[2]);
      if (alt) { bad++; heat[i4] = 255; heat[i4 + 1] = 60; heat[i4 + 2] = 60; } else { heat[i4] = heat[i4 + 1] = heat[i4 + 2] = L[2] * 0.35; } heat[i4 + 3] = 255; }
    res.push({ t: +t.toFixed(2), px: bad, frac: +(bad / N * 1e4).toFixed(2) });
    if (bad / N > 1e-4) writePng(path.join(dir, `flicker_t${t.toFixed(2)}.png`), f[0].width, f[0].height, heat);
  }
  // what kind of flicker (for the worst two): the same moment rendered 5× (anything > 0 = per-frame noise or uninitialised data);
  // steps of 1/600 s (still alternating = static flicker: coplanar layers / z-fighting, sub-pixel shimmer; gone = motion stepping:
  // small detail stepping pixel by pixel under a moving camera)
  const alt = async times => { const f = []; for (const tt of times) { await seek(page, tt); f.push(decode(await shot(page))); }
    const N = f[0].width * f[0].height; let bad = 0;
    for (let p = 0; p < N; p++) { const i4 = p * 4, L = f.map(g => lum(g, i4)); const d = [L[2] - 2 * L[1] + L[0], L[3] - 2 * L[2] + L[1], L[4] - 2 * L[3] + L[2]];
      if (d.every(v => Math.abs(v) > 16) && Math.sign(d[0]) !== Math.sign(d[1]) && Math.sign(d[1]) !== Math.sign(d[2])) bad++; }
    return +(bad / N * 1e4).toFixed(2); };
  await page.evaluate(() => document.getElementById('frame').classList.add('nolabels'));
  for (const r of [...res].sort((x, y) => y.px - x.px).slice(0, 2)) {
    if (r.frac < 3) continue;
    const same = await alt([0, 0, 0, 0, 0].map(() => r.t)), fine = await alt([0, 1, 2, 3, 4].map(k => r.t + k / 600));
    r.same = same; r.fine = fine;
    r.cause = same > 0 ? 'nondeterministic: per-frame noise or uninitialised data' : fine >= 0.4 * r.frac ? 'static: coplanar layers (z-fighting) or sub-pixel shimmer' : 'motion stepping: small detail under a moving camera';
  }
  await page.evaluate(() => document.getElementById('frame').classList.remove('nolabels'));
  await page.evaluate(() => document.getElementById('frame').classList.remove('nolabels'));
  const worst = [...res].sort((x, y) => y.px - x.px).slice(0, 5);
  note('flicker', { samples: res.length, at: 'calmest moments', worst, pass: !worst.length || worst[0].frac < 3, review: !!worst.length && worst[0].frac >= 3 && worst[0].frac < 10, unit: 'frac = alternating pixels per 10,000', images: 'flicker/ (frames above 1 per 10,000; red = alternating). pass < 3; 3–10: look at the images; ≥ 10: fix', diagnose: 'node scripts/flicker_probe.mjs <url> <t> (references/qa.md §5)' });
}

/* ---------- pops: a patch of the frame that changes in one step while steady before and after (something appearing) ---------- */
if (run('pops')) {
  // (the 3D picture only: text layers change by design and fade on their own clock)
  const pp = await open(url, { w: Math.round(W / 3), h: Math.round(H / 3), q: '?freeze&text=0' }), pg = pp.page;
  const GX = 9, GY = 16, dt = 1 / 30, series = [];
  for (let t = 0; t < LOOP; t += dt) {
    await seek(pg, t); const p = decode(await shot(pg)), cw = p.width / GX, ch = p.height / GY, cell = new Float32Array(GX * GY);
    for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) cell[Math.min(GY - 1, Math.floor(y / ch)) * GX + Math.min(GX - 1, Math.floor(x / cw))] += lum(p, (y * p.width + x) * 4);
    for (let k = 0; k < cell.length; k++) cell[k] /= cw * ch;
    series.push([t, cell]);
  }
  // (skipped while the camera moves fast: then every patch changes a lot between frames anyway)
  const speed = await page.evaluate(({ LOOP, dt }) => { const o = []; let p = null; for (let t = 0; t < LOOP; t += dt) { const c = window.__bw.camAt(t);
      o.push(p ? Math.abs(Math.log(c.field / p.field)) / dt + (c.q && p.q ? 2 * Math.acos(Math.min(1, Math.abs(c.q[0] * p.q[0] + c.q[1] * p.q[1] + c.q[2] * p.q[2] + c.q[3] * p.q[3]))) * 180 / Math.PI / dt / 20 : 0) : 0); p = c; } return o; }, { LOOP, dt });
  const sus = [];
  for (let i = 2; i < series.length - 1; i++) for (let k = 0; k < GX * GY; k++) {
    if (Math.max(speed[i - 1] || 0, speed[i] || 0, speed[i + 1] || 0) > 1.5) continue;
    const d0 = series[i - 1][1][k] - series[i - 2][1][k], d1 = series[i][1][k] - series[i - 1][1][k], d2 = series[i + 1][1][k] - series[i][1][k];
    if (Math.abs(d1) > 16 && Math.abs(d0) < 2.5 && Math.abs(d2) < 2.5) sus.push({ t: +series[i][0].toFixed(2), cell: [k % GX, Math.floor(k / GX)], jump: +d1.toFixed(1) });
  }
  await pp.browser.close();
  const byT = {}; sus.forEach(s => { (byT[s.t] = byT[s.t] || []).push(s.cell); });
  const times = Object.keys(byT).map(Number).sort((a, b) => a - b);
  const dir = mkdir(path.join(out, 'pops'));
  for (const t of times.slice(0, 12)) for (const d of [-dt, 0]) { await seek(page, t + d); await page.evaluate(() => document.getElementById('frame').classList.add('nolabels')); await shot(page, path.join(dir, `pop_t${t.toFixed(2)}_${d < 0 ? 'a' : 'b'}.png`)); }
  await page.evaluate(() => document.getElementById('frame').classList.remove('nolabels'));
  note('pops', { scanned: series.length, suspects: times.length, at: times.slice(0, 20), review: times.length > 0, note: 'heuristic on the 3D picture (text hidden): compare pops/*_a.png (1/30 s before) with *_b.png' });
}

/* ---------- safe: text layers clear of the player's UI (the film's SAFE zones: Shorts = top 7%, bottom 20%, buttons on the right) ---------- */
if (run('safe')) {
  const res = await page.evaluate(({ LOOP, S }) => {
    const f = document.getElementById('frame').getBoundingClientRect(), Wf = f.width, Hf = f.height;
    const zones = [[0, 0, Wf, S.top * Hf, 'top bar'], [0, (1 - S.bottom) * Hf, Wf, Hf, 'bottom (title, controls)']];
    if (S.side) zones.push([S.side[0] * Wf, S.side[1] * Hf, Wf, S.side[2] * Hf, 'buttons']);
    const bad = []; let n = 0;
    for (let t = 0.05; t < LOOP; t += LOOP / 120) {
      window.__bw.seek(t); n++;
      const els = [...document.querySelectorAll('#caption > div, .co .lab, .ld > div, .tag > div, #hud-val, #scale')].filter(e => { let o = e; while (o && o.id !== 'frame') { const op = +getComputedStyle(o).opacity; if (op < 0.2 || getComputedStyle(o).display === 'none') return false; o = o.parentElement; } return e.textContent.trim().length > 0; });
      for (const e of els) { const r = e.getBoundingClientRect(), x0 = r.left - f.left, y0 = r.top - f.top, x1 = r.right - f.left, y1 = r.bottom - f.top;
        for (const z of zones) if (x0 < z[2] && x1 > z[0] && y0 < z[3] && y1 > z[1]) bad.push([+t.toFixed(2), (e.id || e.className || e.parentElement.className), z[4], e.textContent.trim().slice(0, 30)]); }
    }
    return { samples: n, hits: bad.length, first: bad.slice(0, 12) };
  }, { LOOP, S: info.safe });
  note('safe', { ...res, pass: res.hits === 0 });
}

/* ---------- labels: each pinned label, callout and leader is actually on screen for most of its window ----------
   (the engine hides a label that has no room: outside the label zone, under the caption, on another label, behind the camera) */
if (run('labels')) {
  const L0 = await page.evaluate(() => window.__bw.labels ? window.__bw.labels() : null);
  if (!L0) note('labels', { skipped: 'no __bw.labels()' });
  else {
    const times = [];
    L0.forEach(l => l.wins.forEach(([a, b]) => { const m = Math.min(0.25, (b - a) / 4); for (let k = 0; k < 5; k++) times.push(+(a + m + (b - a - 2 * m) * (k + 0.5) / 5).toFixed(3)); }));
    const seen = L0.map(() => [0, 0]);
    for (const t of [...new Set(times)].sort((a, b) => a - b)) {
      await seek(page, t); const cur = await page.evaluate(() => window.__bw.labels().map(l => l.shown));
      L0.forEach((l, i) => { if (l.wins.some(([a, b]) => t >= a && t <= b)) { seen[i][1]++; if (cur[i]) seen[i][0]++; } });
    }
    const rows = L0.map((l, i) => ({ kind: l.kind, text: l.text, shown: seen[i][1] ? +(seen[i][0] / seen[i][1]).toFixed(2) : null }));
    const never = rows.filter(r => r.shown === 0), partly = rows.filter(r => r.shown > 0 && r.shown < 0.6);
    note('labels', { labels: rows.length, never: never.map(r => r.text), partly: partly.map(r => `${r.text} (${Math.round(r.shown * 100)}%)`), rows,
      pass: never.length === 0 && partly.length === 0, review: never.length === 0 && partly.length > 0,
      note: 'share of each window in which the engine found room for the label (label zone, clear of the caption and other labels, point in front of the camera)' });
  }
}

/* ---------- contact sheets: every second, and every half second in parts ---------- */
if (run('contact')) {
  const dir = mkdir(path.resolve(out, 'frames')); fs.readdirSync(dir).forEach(f => fs.unlinkSync(path.join(dir, f)));
  const step = 0.5, n = Math.floor(LOOP / step) + 1;
  for (let i = 0; i < n; i++) { const t = Math.min(i * step, LOOP - 0.01); await seek(page, t); await shot(page, path.join(dir, `f${String(i).padStart(4, '0')}.png`)); }
  const tw = 216, th = Math.round(tw * H / W), sheets = [];
  try {
    const every2 = fs.readdirSync(dir).filter((f, i) => i % 2 === 0).map(f => path.join(dir, f));
    const listFile = path.join(out, 'list1s.txt'); fs.writeFileSync(listFile, every2.map(f => `file '${f}'`).join('\n'));
    const cols = 10, rows = Math.ceil(every2.length / cols);
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-vf', `scale=${tw}:${th},tile=${cols}x${rows}:padding=4:color=0x202020`, '-frames:v', '1', path.join(out, 'sheet_1s.png')]);
    sheets.push('sheet_1s.png');
    const all = fs.readdirSync(dir).map(f => path.join(dir, f));
    for (let s = 0; s * 40 < all.length; s++) {
      const part = all.slice(s * 40, s * 40 + 40), lf = path.join(out, `list05_${s}.txt`); fs.writeFileSync(lf, part.map(f => `file '${f}'`).join('\n'));
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lf, '-vf', `scale=${tw}:${th},tile=10x${Math.ceil(part.length / 10)}:padding=4:color=0x202020`, '-frames:v', '1', path.join(out, `sheet_05s_${s + 1}.png`)]);
      sheets.push(`sheet_05s_${s + 1}.png`);
    }
  } catch (e) { sheets.push('ffmpeg failed: ' + e.message.slice(0, 200)); }
  note('contact', { frames: n, sheets, note: 'LOOK at every sheet: sheet_1s is frame i = i seconds; sheet_05s_k frame j = (k-1)*20 + j*0.5 s' });
}
await browser.close();

/* ---------- live playback: fps, duration, drift ---------- */
if (run('fps') || run('duration') || run('drift') || run('live')) {
  ({ browser, page, logs } = await open(url, { w: W, h: H, dpr: 2, q: '' }));
  await page.waitForTimeout(1500);
  if (run('fps')) {
    const segs = [];
    for (let i = 0; i < 10; i++) {
      const t = (i + 0.2) / 10 * LOOP;
      await page.evaluate(t => { window.__bw.seek(t); window.__bw.play(); }, t); await page.waitForTimeout(300);
      await page.evaluate(() => window.__bw.resetStats()); await page.waitForTimeout(1500);
      const s = await page.evaluate(() => window.__bw.stats()); segs.push({ t: +t.toFixed(1), fps: s.fps, p95Ms: s.p95Ms });
    }
    const min = Math.min(...segs.map(s => s.fps)), mean = segs.reduce((a, s) => a + s.fps, 0) / segs.length;
    note('fps', { viewport: `${W}×${H} @2x`, mean: +mean.toFixed(1), min, segments: segs, pass: min >= 60, note: 'headless GPU; a real browser is usually similar or faster' });
  }
  if (run('duration')) {
    await page.evaluate(() => { window.__bw.seek(1); window.__bw.play(); });
    const a = await page.evaluate(() => [window.__bw.time(), performance.now()]); await page.waitForTimeout(6000);
    const b = await page.evaluate(() => [window.__bw.time(), performance.now()]);
    let d = b[0] - a[0]; if (d < 0) d += LOOP;
    const rate = d / ((b[1] - a[1]) / 1000); note('duration', { rate: +rate.toFixed(4), pass: Math.abs(rate - 1) < 0.01 });
  }
  if (run('drift')) {
    await seek(page, 2); await page.waitForTimeout(50); const a = decode(await shot(page));
    await page.evaluate(() => { window.__bw.seek(1.5); window.__bw.play(); }); await page.waitForTimeout((LOOP + 1) * 1000);
    await seek(page, 2); await page.waitForTimeout(50); const b = decode(await shot(page));
    const d = diff(a, b, [0, 0, 1, 0.6]); note('drift', { afterSeconds: +(LOOP + 1).toFixed(1), maxTop60: d.max, mean: +d.mean.toFixed(3), pass: d.max === 0 });
  }
  // live: real-time playback captured as fast as possible — black blocks (a dark hole inside a bright area) that seek-mode scans can miss
  if (run('live')) {
    const dir = mkdir(path.join(out, 'live')); let frames = 0; const bad = [];
    await page.evaluate(() => { document.getElementById('frame').classList.add('nolabels'); window.__bw.seek(0); window.__bw.play(); });   // the picture only (letter counters look like holes)
    const t0 = Date.now();
    while (Date.now() - t0 < LOOP * 1000) {
      const buf = await page.screenshot({ type: 'png' }); const p = decode(buf), Wp = p.width, Hp = p.height; frames++;
      // a hole = a dark square (≥ 6 px) with bright picture on all four sides (a thin dark band, e.g. an edge, has dark ends)
      let holes = 0; const L = (x, y) => lum(p, (y * Wp + x) * 4);
      for (let y = 12; y < Hp - 12; y += 3) for (let x = 12; x < Wp - 12; x += 3) {
        if (L(x, y) > 3) continue;
        let dark = true; for (let dy = -3; dy <= 3 && dark; dy += 2) for (let dx = -3; dx <= 3; dx += 2) if (L(x + dx, y + dy) > 4) { dark = false; break; }
        if (!dark) continue;
        if (L(x + 9, y) > 60 && L(x - 9, y) > 60 && L(x, y + 9) > 60 && L(x, y - 9) > 60) holes++;
      }
      if (holes > 2) { const t = await page.evaluate(() => window.__bw.time()); bad.push([+t.toFixed(2), holes]); if (bad.length <= 6) fs.writeFileSync(path.join(dir, `hole_t${t.toFixed(2)}.png`), buf); }
    }
    await page.evaluate(() => document.getElementById('frame').classList.remove('nolabels'));
    note('live', { frames, suspect: bad.length, first: bad.slice(0, 10), pass: bad.length === 0, note: 'dark holes inside bright areas during real playback; images in live/' });
  }
  const r = realLogs(logs); if (r.length) note('liveErrors', { logs: r.length, first: r.slice(0, 3) });
  await browser.close();
}

} catch (e) {
  const where = Object.keys(R.checks).pop();
  note('crash', { pass: false, after: where || null, note: `QA stopped with an error${where ? ` after '${where}'` : ''}: ${String(e && e.message || e).split('\n')[0].slice(0, 300)} — the film breaks a check's hook, or the page died` });
} finally { try { await browser.close(); } catch (e) {} }

/* ---------- report ---------- */
{ const h1 = await fileHash(); if (HASH0 && h1 && h1 !== HASH0) note('stable', { pass: false, note: 'the film changed while QA ran (rebuilt mid-run?) — results mix two versions: run again' }); }
// the verdict for THIS build (the html's exact bytes): the delivery gate (gate.mjs — render.mjs, the Studio) reads it. A 'look' result
// (flicker 3–10, pops) is not a failure but must be looked at in the visual review; a failure the requester explicitly accepted
// (qa/accepted.json: { check, why, requester: their words, build: hash or '*' }) is reported, not failed.
let ACCEPTED = []; try { ACCEPTED = JSON.parse(fs.readFileSync(path.join(out, 'accepted.json'), 'utf8')).filter(a => a && a.check && String(a.requester || '').trim() && (a.build === '*' || a.build === HASH0)); } catch (e) {}
const FAILING = Object.entries(R.checks).filter(([k, v]) => v && v.pass === false && !v.review && !ACCEPTED.some(a => a.check === k)).map(([k]) => k);
const LOOKS = Object.entries(R.checks).filter(([, v]) => v && v.review).map(([k]) => k);
const partial = !!(only || (argv('skip', '') || '') || argv('loop', null) || argv('w', null) || argv('h', null));
Object.assign(R, { build: HASH0, full: !partial && ALL.every(c => run(c)), failing: FAILING, look: LOOKS, accepted: ACCEPTED.filter(a => R.checks[a.check] && R.checks[a.check].pass === false) });
R.ready = R.full && FAILING.length === 0;
fs.writeFileSync(path.join(out, 'qa-report.json'), JSON.stringify(R, null, 1));
const line = (k, v) => `| ${k} | ${v.skipped ? 'skipped' : v.review ? '**look**' : v.pass === undefined ? (v.review === false ? 'pass' : '—') : v.pass ? 'pass' : '**FAIL**'} | ${summary(k, v)} |`;
function summary(k, v) {
  if (v.skipped) return v.skipped;
  switch (k) {
    case 'load': return `LOOP ${v.LOOP} s${v.problems.length ? ' · problems: ' + v.problems.join('; ') : ''}${v.errorBox ? ' · error box: ' + v.errorBox : ''}`;
    case 'err': return `${v.logs} console errors`;
    case 'pace': return `loop ${v.loop} s · ${Object.entries(v.byKind).map(([a, b]) => a + ' ' + b + ' s').join(', ')} · held ${v.held}% · max zoom ${v.zoomMax} e/s · max turn ${v.rotMax}°/s${v.warnings.length ? ' · ' + v.warnings.join('; ') : ''}`;
    case 'read': return v.captions ? `${v.captions.length} captions${v.warnings.length ? ' · ' + v.warnings.join('; ') : ' · each a stop, readable'}${v.accepted && v.accepted.length ? ' · accepted: ' + v.accepted.join(' ') : ''}` : v.note;
    case 'surfaces': if (!v.back) return v.note; return (v.back.length || v.near.length || v.throughCount) ? [v.back.length ? `inside a model / through a missing face at ${v.back.slice(0, 6).map(x => `${x[0]}–${x[1]} s (${x[2]}%${x[3] ? ': ' + x[3] : ''})`).join(', ')}` : '', v.near.length ? `a surface against the lens at ${v.near.slice(0, 6).map(x => `${x[0]}–${x[1]} s (${x[2]}%)`).join(', ')}` : '', v.throughCount ? `the camera passes through ${[...new Set(v.through.map(x => x[1]))].slice(0, 5).join(', ')} at ${v.through.slice(0, 5).map(x => x[0] + ' s').join(', ')}` : ''].filter(Boolean).join(' · ') + ' (look at surfaces/)' : `nothing passed through, seen from inside or pressed against the lens (${v.samples} frames)`;
    case 'engine': return v.note;
    case 'crash': return v.note;
    case 'empty': return v.stretches.length ? `${v.stretches.length} stretches, ${v.seconds} s with almost nothing to see: ` + v.stretches.slice(0, 8).map(x => `${x[0]}–${x[1]} s`).join(', ') + ' (look at empty/)' : `no empty moment (${v.samples} frames)`;
    case 'continuity': return `${v.jumps} camera jumps in ${v.frames} frames` + (v.first.length ? ' · ' + JSON.stringify(v.first.slice(0, 3)) : '');
    case 'inside': return `${v.hits} hits in ${v.samples} samples (${v.solids} solids)`;
    case 'presence': return `${v.hits} fades in view` + (v.first && v.first.length ? ' · ' + JSON.stringify(v.first.slice(0, 4)) : '');
    case 'nan': return `${v.bad} of ${v.frames} frames with NaN/Inf`;
    case 'seam': return `mean ${v.mean}/255, max ${v.max}`;
    case 'flicker': return v.worst.length ? `worst ${v.worst[0].frac} per 10,000 px at ${v.worst[0].t} s (${v.samples} calm moments)${v.worst[0].cause ? ' · ' + v.worst[0].cause + ` (same moment ×5: ${v.worst[0].same}, 1/600 s steps: ${v.worst[0].fine})` : ''}` : 'no calm moment to sample';
    case 'pops': return `${v.suspects} suspect moments${v.at.length ? ': ' + v.at.slice(0, 8).join(', ') + ' s' : ''} (look at pops/)`;
    case 'safe': return `${v.hits} text boxes in the player's UI zones` + (v.first.length ? ' · ' + JSON.stringify(v.first.slice(0, 3)) : '');
    case 'labels': return `${v.labels} labels` + (v.never.length ? ' · never on screen: ' + v.never.join(', ') : '') + (v.partly.length ? ' · partly: ' + v.partly.join(', ') : '');
    case 'stable': return v.note;
    case 'contact': return v.sheets.join(', ');
    case 'fps': return `mean ${v.mean}, min ${v.min} (${v.viewport})`;
    case 'duration': return `rate ${v.rate}`;
    case 'drift': return `max diff ${v.maxTop60} after ${v.afterSeconds} s`;
    case 'live': return `${v.suspect} of ${v.frames} live frames with dark holes`;
    default: return JSON.stringify(v).slice(0, 200);
  }
}
const md = ['| check | result | measured |', '|---|---|---|', ...Object.entries(R.checks).map(([k, v]) => line(k, v))].join('\n');
const verdict = R.ready ? `**Verdict: the full QA passes on build ${HASH0}**${LOOKS.length ? ` (to look at in the visual review: ${LOOKS.join(', ')})` : ''}${R.accepted.length ? ` (accepted by the requester: ${R.accepted.map(a => a.check).join(', ')})` : ''} — next: the visual review (scripts/review.mjs, references/visual-review.md)`
  : `**Verdict: NOT READY (build ${HASH0})** — ${FAILING.length ? 'failing: ' + FAILING.join(', ') : ''}${FAILING.length && !R.full ? '; ' : ''}${R.full ? '' : 'a partial run (--only / --skip): the gate needs the full run'}`;
fs.writeFileSync(path.join(out, 'qa-report.md'), `# QA — ${url}\n\n${md}\n\n${verdict}\n`);
console.log('\n' + md + `\n\n${verdict}\nreport: ${path.join(out, 'qa-report.md')}`);
process.exitCode = FAILING.length ? 1 : 0;
