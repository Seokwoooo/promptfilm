// The visual review's material, for a reviewer who did not build the film (references/visual-review.md):
//   node review.mjs <url> --out <film>/qa/review
// writes, for THIS build (after the full qa.mjs, so its flags are in):
//   sheets/sheet_NN.jpg   every 0.5 s of the loop, the time printed on each frame; the sheet's code on its first frame
//   stops/cNN_…_bare.png  full size (1920 on the long side), text hidden: the middle of every caption — looked at first, before its words
//   stops/cNN_…_text.png  the same moment with its text — for legibility
//   flagged/…png          full size: every moment the QA run flagged (empty, surfaces, the path, flicker and pops to look at)
//   template.md, meta.json  the form the reviewer fills in and saves as <film>/qa/visual-review.md; the build and the sheet codes
// An earlier qa/visual-review.md is moved to qa/reviews/ first (the gate keeps a failed build failed).
import { execFileSync } from 'child_process';
import { randomInt } from 'crypto';
import { open, seek, shot, mkdir, argv, fs, path, ffmpegBin } from './common.mjs';
import { buildHash, codeHash, parseReview } from './gate.mjs';

const url = process.argv[2];
if (!url || url.startsWith('--') || !argv('out', null)) { console.error('usage: node review.mjs <url> --out <film>/qa/review'); process.exit(2); }
const out = mkdir(argv('out')), qaDir = path.dirname(path.resolve(out));
for (const d of ['sheets', 'stops', 'flagged']) { fs.rmSync(path.join(out, d), { recursive: true, force: true }); mkdir(path.join(out, d)); }
const hash = buildHash(await (await fetch(url)).text());
const fmt = t => t.toFixed(2);
{ const prev = path.join(qaDir, 'visual-review.md');
  if (fs.existsSync(prev)) { const p = parseReview(fs.readFileSync(prev, 'utf8')); mkdir(path.join(qaDir, 'reviews'));
    fs.renameSync(prev, path.join(qaDir, 'reviews', `${p.build || 'unknown'}-${new Date().toISOString().replace(/[-:.]/g, '').slice(0, 17)}.md`)); } }

// full-size frames: the film's own aspect at device pixel ratio 2 (960 × 540 → 1920 × 1080)
const big = await open(url, { dpr: 2, q: '?freeze' });
const info = await big.page.evaluate(() => { const b = window.__bw; return { LOOP: b.LOOP, caps: b.captions ? b.captions() : [], beats: b.beats ? b.beats() : [] }; });
const { LOOP, caps, beats } = info;
let retFrom = Infinity; for (let i = beats.length - 1; i >= 0 && beats[i].kind === 'return'; i--) retFrom = beats[i].t0;
const bare = on => big.page.evaluate(on => document.getElementById('frame').classList.toggle('nolabels', on), on);
const stops = [];
for (const [i, c] of caps.entries()) {
  const t = (c.t0 + c.t1) / 2, n = String(i + 1).padStart(2, '0'), fb = `stops/c${n}_t${fmt(t)}_bare.png`, ft = `stops/c${n}_t${fmt(t)}_text.png`;
  await seek(big.page, t); await bare(true); await big.page.waitForTimeout(30); await shot(big.page, path.join(out, fb));
  await bare(false); await big.page.waitForTimeout(30); await shot(big.page, path.join(out, ft));
  stops.push({ i: i + 1, t0: c.t0, t1: c.t1, title: c.title, second: c.second, about: (c.about || []).join(' + '), bare: fb, text: ft, ret: t >= retFrom });
}
// what the QA run flagged (only when its report is for this build) — frames to look at, and what QA measured on each caption
const flagged = [], qaCap = new Map();
try {
  const r = JSON.parse(fs.readFileSync(path.join(qaDir, 'qa-report.json'), 'utf8')), c = r.checks || {};
  if (r.build === hash) {
    (c.empty && c.empty.stretches || []).forEach(x => flagged.push([x[0], `empty ${x[0]}–${x[1]} s`]));
    (c.surfaces && c.surfaces.back || []).forEach(x => flagged.push([(x[0] + x[1]) / 2, `inside a model / a missing face ${x[0]}–${x[1]} s`]));
    (c.surfaces && c.surfaces.near || []).forEach(x => flagged.push([(x[0] + x[1]) / 2, `a surface against the lens ${x[0]}–${x[1]} s`]));
    (c.surfaces && c.surfaces.through || []).slice(0, 6).forEach(x => flagged.push([x[0], `the camera passes through ${x[1]}`]));
    (c.flicker && c.flicker.worst || []).filter(x => x.frac >= 3).forEach(x => flagged.push([x.t, `flicker ${x.frac} per 10,000 px`]));
    (c.pops && c.pops.at || []).forEach(t => flagged.push([+t, 'pops: a patch changed in one step']));
    (c.read && c.read.captions || []).forEach(x => { const s = [];
      if (x.beat !== 'return' && !(x.about && x.about.length)) s.push('no subject declared — QA fails it and can\'t measure it');
      else if (x.stop !== undefined && x.beat !== 'return') s.push(`stop ${x.stop}/${Math.max(x.beat === 'key' ? 2.4 : 1.8, x.read).toFixed(1)} s, at most ${Math.round((x.largest || 0) * 100)}% of the frame`);
      if (x.dur < x.read) s.push(`up ${x.dur}/${x.read.toFixed(1)} s`);
      qaCap.set(Math.round(x.t0 * 100), s.join('; ') || 'ok'); });
  }
} catch (e) { /* no QA report */ }
flagged.sort((a, b) => a[0] - b[0]); for (let i = flagged.length - 1; i > 0; i--) if (flagged[i][0] - flagged[i - 1][0] < 0.25) flagged.splice(i, 1);   // one frame per moment
for (const x of flagged) { const f = `flagged/t${fmt(x[0])}_${x[1].split(' ')[0].replace(/[^A-Za-z0-9]+/g, '')}.png`; await seek(big.page, x[0]); await big.page.waitForTimeout(30); await shot(big.page, path.join(out, f)); x.push(f); }
await big.browser.close();

// the sheets: every 0.5 s, the time printed on the frame; each sheet's first frame also carries its code (the reviewer copies it)
const sm = await open(url, { scale: 2 / 3, q: '?freeze' });
const { width: SW, height: SH } = sm.page.viewportSize();
await sm.page.evaluate(() => document.body.insertAdjacentHTML('beforeend', '<div id="pf-rt" style="position:fixed;left:6px;top:6px;z-index:2147483647;font:600 20px/1.2 ui-monospace,Menlo,monospace;color:#ffe14d;background:rgba(0,0,0,.72);padding:2px 7px;border-radius:4px"></div>'));
const per = SW >= SH ? 12 : 10, cols = SW >= SH ? 3 : 5, ABC = 'ACDEFHJKMNPRTUVWXY34679';
const kindAt = t => { let k = ''; for (const b of beats) if (t >= b.t0 - 1e-9) k = b.kind; return k; };
const times = []; for (let t = 0; t < LOOP - 1e-6; t += 0.5) times.push(t);
const sheets = [];
for (let k = 0; k * per < times.length; k++) {
  const part = times.slice(k * per, (k + 1) * per), code = Array.from({ length: 4 }, () => ABC[randomInt(ABC.length)]).join(''), files = [];
  for (const [j, t] of part.entries()) {
    await seek(sm.page, t);
    await sm.page.evaluate(([t, code, kind]) => { document.getElementById('pf-rt').textContent = t.toFixed(1) + ' s · ' + kind + (code ? ` · code ${code}` : ''); }, [t, j === 0 ? code : '', kindAt(t)]);
    const f = path.join(out, 'sheets', `f${fmt(t).padStart(7, '0')}.png`); await shot(sm.page, f); files.push(f);
  }
  const list = path.join(out, 'sheets', `list${k}.txt`), name = `sheets/sheet_${String(k + 1).padStart(2, '0')}.jpg`;
  fs.writeFileSync(list, files.map(f => `file '${path.basename(f)}'`).join('\n'));   // relative to the list's own folder
  execFileSync(ffmpegBin(), ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `tile=${cols}x${Math.ceil(per / cols)}:padding=4:color=0x202020`, '-frames:v', '1', '-q:v', '3', path.join(out, name)]);
  sheets.push({ name, from: part[0], to: part[part.length - 1], code: codeHash(code, hash) });
  files.forEach(f => fs.rmSync(f)); fs.rmSync(list);
}
await sm.browser.close();
fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify({ build: hash, captions: stops.length,
  note: 'codeHash is a HASH of the 4 characters printed on each sheet\'s first frame, not the code. Read the code off the image; copying this value into the form fails the gate.',
  sheets: sheets.map(s => ({ name: s.name, codeHash: s.code })) }, null, 1));


/* ---------- what the automated checks already measured on THIS build, and what the requester has settled ----------
   Added by ~/.config/promptfilm/patch.py. Reviewers were reporting "there is a hard cut" against a continuity
   check that had measured 0 jumps in 2074 frames, and re-opening decisions the requester had already made. */
let MEASURED = '- (no QA report for this build — nothing has been measured)';
try {
  const r0 = JSON.parse(fs.readFileSync(path.join(qaDir, 'qa-report.json'), 'utf8'));
  if (r0.build === hash) {
    const c0 = r0.checks || {}, L = [];
    if (c0.continuity) L.push(`camera cuts or jumps: **${c0.continuity.jumps}** in ${c0.continuity.frames} frames (checked every 1/60 s)`);
    if (c0.seam) L.push(`the loop's seam, last frame against first: mean **${c0.seam.mean}/255** (under 2 = it closes)`);
    if (c0.pace) L.push(`loop ${c0.pace.loop} s · the camera holds **${c0.pace.held}%** of it · fastest zoom ${c0.pace.zoomMax} e-folds/s, fastest turn ${c0.pace.rotMax}°/s`);
    if (c0.drift) L.push(`replaying the loop gives the same pixels: max difference **${c0.drift.maxTop60}**`);
    if (c0.presence) L.push(`subjects fading in or out while in view: **${c0.presence.hits}**`);
    if (c0.inside) L.push(`the camera inside a solid: **${c0.inside.hits}** of ${c0.inside.samples} samples`);
    if (c0.empty) L.push(`frames with almost nothing to see: **${c0.empty.seconds} s**`);
    if (L.length) MEASURED = L.map(s => '- ' + s).join('\n');
  }
} catch (e) { /* no report */ }
let SETTLED_LIST = [];
try { SETTLED_LIST = JSON.parse(fs.readFileSync(path.join(qaDir, 'review-accepted.json'), 'utf8')) || []; } catch (e) {}
const SETTLED = SETTLED_LIST.length
  ? SETTLED_LIST.map(s => `- **${s.match}**${s.why ? ' — ' + s.why : ''}${s.requester ? ` (the requester: “${s.requester}”)` : ''}`).join('\n')
  : '- (nothing settled yet)';

const rel = f => path.relative(qaDir, path.join(out, f));
const T = `# Visual review — ${path.basename(new URL(url).pathname)}

Build: ${hash}
Reviewer: <who — a fresh reviewer who did not build this film (references/visual-review.md §1)>
Loop ${LOOP.toFixed(1)} s · ${caps.length} captions · ${sheets.length} sheets (every 0.5 s) · ${flagged.length} frames flagged by QA

Fill in every row. Look for what is wrong, not for confirmation: a frame you would not post as a still is a finding.

## 0. Settled — already decided, and NOT findings
These were put to the requester and answered. Do not raise them again; if you think one is now wrong, say so under §5 as a note,
not as a finding. (\`<film>/qa/review-accepted.json\` — only the requester's own words go in it, never the builder's judgement.)

${SETTLED}

## 0b. Already measured on this build — do not assert the opposite without naming the frame
Every one of these was measured on every frame, not sampled. The sheets are 0.5 s apart, so a fast camera move looks like a jump
between two cells — that is the sampling, not a cut. If your eye still disagrees with a number here, write it in §5 with the exact
frame and what you see, and do not put it in Findings.

${MEASURED}

## 1. Bare frames — FIRST, before reading any caption or opening the sheets (references/visual-review.md §2)
Each is the middle of a caption, with the text hidden. Write what the frame shows, in plain words.

| # | frame, text hidden | what the frame shows |
|---|---|---|
${stops.map(s => `| ${s.i} | ${rel(s.bare)} |  |`).join('\n')}

## 2. Every caption — is it a stop? (only after §1)
"tells about" = what the maker declared the caption to be about; "QA" = what the automated check measured — neither replaces your
look. Last column: "yes" only if the thing named is there — clearly, large (its longer side ≥ ~40% of the frame; a thin thing long
across the frame, or cut open with a scale) and held; else "no — why".

| # | time (s) | caption | tells about | QA | frame with text | the thing named — clearly, large, held? |
|---|---|---|---|---|---|---|
${stops.map(s => `| ${s.i} | ${fmt(s.t0)}–${fmt(s.t1)}${s.ret ? ' (way back)' : ''} | ${s.title}${s.second ? ' ' + s.second : ''} | ${s.about || '— (not declared)'} | ${qaCap.get(Math.round(s.t0 * 100)) || '—'} | ${rel(s.text)} |  |`).join('\n')}

## 3. Every sheet — the time of anything wrong (references/visual-review.md §3)
Each frame is labelled \`time · beat\`. **hook / key = the camera is holding; normal / transit / return = it is moving** — between
two cells of a moving stretch the picture changes a lot because they are 0.5 s apart, which is not a cut (see §0b).
"code": the 4 characters printed on the sheet's first frame (letters and digits; never 0, O, 1, I or L). Last column: "nothing", or
every problem as "time — what", separated by " · ".

| sheet | code | time (s) | what is wrong |
|---|---|---|---|
${sheets.map(s => `| ${rel(s.name)} |  | ${fmt(s.from)}–${fmt(s.to)} |  |`).join('\n')}

## 4. Flagged by QA — what each is
| frame | flag | what it is |
|---|---|---|
${flagged.length ? flagged.map(x => `| ${rel(x[2])} | ${x[1]} |  |`).join('\n') : '| — | (no QA report for this build, or nothing flagged) | |'}

## 5. The list — one line each (references/visual-review.md §3)
- Broken-looking geometry:
- Skipped steps:
- Empty or smeared frames:
- Captions over something else:
- Quality bar (mock-up, plastic, wrong object):
- Appearing without a reason / popping:

## Findings
<one line each: "- time — what — kind — blocking|minor".
 kind: broken · skipped · empty · smeared · mock-up · wrong · appearing · text
 blocking = you would not post the video with this in it. minor = you would post it and fix this later.
 Exactly "- none" if there are none.>

Verdict: <PASS or FAIL — PASS only when every caption is "yes", every sheet "nothing" and Findings is "- none">
`;
fs.writeFileSync(path.join(out, 'template.md'), T);
console.log(`review material for build ${hash}: ${sheets.length} sheets, ${stops.length} captions (bare + with text), ${flagged.length} flagged frames\n  ${path.join(out, 'template.md')}\n  → the reviewer fills it in and saves it as ${path.join(qaDir, 'visual-review.md')}`);
