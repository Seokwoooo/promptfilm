#!/usr/bin/env node
// From a changed film to "ready to deliver", in one command (SKILL.md step 6):
//   node ship.mjs <film-dir> [name]
// 1 builds the film (its own build.mjs), 2 serves its folder, 3 runs the FULL qa.mjs into <film>/qa — and stops there when a check fails
// (no review of a failing build), 4 makes the visual review's material (review.mjs → <film>/qa/review), 5 prints the brief to hand to a
// fresh reviewer (a subagent that did not build the film), 6 prints the gate. After the review is written: `node gate.mjs <film>/<name>.html`.
import fs from 'fs';
import path from 'path';
import http from 'http';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { gateStatus } from './gate.mjs';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.resolve(process.argv[2] || '.');
if (!fs.existsSync(path.join(dir, 'parts'))) { console.error('usage: node ship.mjs <film-dir> [name]   (a film folder: parts/, build.mjs)'); process.exit(2); }
const run = (args, opts = {}) => new Promise(res => { const p = spawn(process.execPath, args, { stdio: opts.quiet ? ['ignore', 'pipe', 'pipe'] : 'inherit' }); let o = '';
  if (opts.quiet) { p.stdout.on('data', d => o += d); p.stderr.on('data', d => o += d); } p.on('exit', code => res({ code, out: o })); });

// 1) build
const builder = fs.existsSync(path.join(dir, 'build.mjs')) ? path.join(dir, 'build.mjs') : path.join(SKILL, 'engine', 'build.mjs');
const b = await run([builder, dir, ...(process.argv[3] ? [process.argv[3]] : [])], { quiet: true });
const m = /built (.+?\.html)/.exec(b.out);
if (b.code || !m) { console.error('build failed:\n' + b.out); process.exit(1); }
const html = path.resolve(m[1]), name = path.basename(html, '.html');
console.log(`1/6 built ${path.relative(process.cwd(), html)}`);

// 2) serve the film's folder (module scripts need http)
const root = path.dirname(html), types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg' };
const srv = http.createServer((req, res) => { const p = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(root) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res); });
await new Promise(r => srv.listen(0, '127.0.0.1', r));
const url = `http://127.0.0.1:${srv.address().port}/${encodeURIComponent(path.basename(html))}`;
try {
  // 3) the full QA
  console.log(`2/6 serving ${url}\n3/6 the full QA (a few minutes) …`);
  const q = await run([path.join(SKILL, 'scripts', 'qa.mjs'), url, '--out', path.join(dir, 'qa')], { quiet: true });
  const rep = JSON.parse(fs.readFileSync(path.join(dir, 'qa', 'qa-report.json'), 'utf8'));
  console.log(fs.readFileSync(path.join(dir, 'qa', 'qa-report.md'), 'utf8').split('\n').filter(l => /^\| (?!check|---)/.test(l) || /Verdict/.test(l)).join('\n'));
  if (!rep.ready) { console.log(`\nNOT READY — fix the failing checks (${(rep.failing || []).join(', ')}), then run ship.mjs again. No visual review of a failing build.`); process.exitCode = 1; }
  else {
    // 4) the review material, 5) the brief
    console.log('4/6 the visual review material …');
    await run([path.join(SKILL, 'scripts', 'review.mjs'), url, '--out', path.join(dir, 'qa', 'review')], { quiet: true });
    const refs = fs.existsSync(path.join(dir, 'research', 'refs')) ? path.join(dir, 'research', 'refs') : '(none)';
    console.log(`5/6 hand this brief to a fresh reviewer — a subagent that did not build the film (references/visual-review.md §1):
----------------------------------------------------------------------------------------------------
You review a short 3D motion graphic before it is published. You did not make it.
Film folder: ${dir}
Skill folder: ${SKILL}
First read <skill>/references/visual-review.md (your instructions) and look at every image in <skill>/references/review-examples/
(rejected_* = what the requester rejected, good_* = what they praised). Then, BEFORE anything else about the film, open the bare frames
<film>/qa/review/stops/*_bare.png (text hidden) and fill in §1 of <film>/qa/review/template.md — what each frame shows. Only then read the
captions and fill in §2 (with the *_text.png frames), then open every sheet (<film>/qa/review/sheets/, §3 — copy each sheet's code from
its first frame) and every flagged frame (<film>/qa/review/flagged/, §4); use the reference photos in ${refs} where useful.
Do NOT read the film's code, parts/, plan.md, storyboard.json or anything else about how it was made.
Save the form as <film>/qa/visual-review.md. Look for what is wrong, not for what is right: a frame you would not post as a still is a
finding. Write every row; do not soften. Keep notes as you go.
Your final message: the Findings list, the verdict, and anything in visual-review.md that made the review harder than it should be.
----------------------------------------------------------------------------------------------------`);
  }
  // 6) the gate
  const g = gateStatus(html);
  console.log(`6/6 gate: ${g.ok ? 'READY' : 'NOT READY — ' + g.why.join('; ')}\n    after the review: node ${path.join(SKILL, 'scripts', 'gate.mjs')} ${html}`);
} finally { srv.close(); }
