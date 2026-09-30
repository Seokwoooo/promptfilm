// The time budget of a plan, from its storyboard — before the requester sees it and before any scene code (pacing.md §2):
//   node budget.mjs <film-dir>        (reads <film-dir>/storyboard.json; exit 0 = the plan fits)
// Every card is a stop: its caption up for its reading time while the camera holds on what it names. Between stops the camera moves at
// most 3 e-folds/s (budgeted at 2.4 with the easing); a stop may itself push in slowly (≤ 0.8 e-folds/s). The way back (the last run of
// 'return' cards, or none) retraces the journey at up to 16 e-folds/s and takes ≤ 12% of the loop. Each card gives `field`: the view's
// width at that stop, in metres (a product film: the view's width across the product) — the moves are the e-folds between them.
import fs from 'fs';
import path from 'path';

const dir = process.argv[2];
if (!dir) { console.error('usage: node budget.mjs <film-dir>'); process.exit(2); }
let sb; try { sb = JSON.parse(fs.readFileSync(path.join(dir, 'storyboard.json'), 'utf8')); } catch (e) { console.error('no readable storyboard.json in ' + dir + ': ' + e.message); process.exit(2); }
const fmt = sb.format || {}, langs = String(fmt.langs || 'en ko').split(/[\s,]+/).filter(Boolean);
const [lo, hi] = String(fmt.length || '45-60').split('-').map(Number);
const cjk = l => /^(ko|ja|zh)/.test(l || '');
const count = x => [...String(x || '').replace(/^\s*\(|\)\s*$/g, '').trim()].length;
// the same reading time as QA 'read': 0.7 s + the audience's line at 12 characters/s (Korean, Japanese, Chinese) or 17/s, + a glance
// at the title when there are two languages
const readTime = c => { if (!c) return 0; const two = langs.length > 1 && c.second;
  return 0.7 + (two ? count(c.second) / (cjk(langs[1]) ? 12 : 17) + count(c.title) / 25 : count(`${c.title || ''} ${c.line || ''}`) / (cjk(langs[0]) ? 12 : 17)); };
const MOVE = 2.4, STOP_ZOOM = 0.8, RET_ZOOM = 12, EASE = 0.4;
const all = sb.scenes || [];
let r0 = all.length; while (r0 > 0 && all[r0 - 1].beat === 'return') r0--;
const stops = all.slice(0, r0), back = all.slice(r0), problems = [], notes = [], rows = [];
const strayReturn = stops.filter(x => x.beat === 'return').map(x => x.id);
if (strayReturn.length) problems.push(`'return' cards before the end (${strayReturn.join(', ')}): only the way back at the end is a return`);
const missingField = stops.filter(x => !(+x.field > 0)).map(x => x.id);
if (missingField.length) problems.push(`no \`field\` (the view's width at the stop, in metres) on ${missingField.join(', ')} — the moves between stops can't be budgeted`);
let sum = 0, need = 0, spanMax = 0, spanMin = Infinity;
stops.forEach((x, i) => {
  const sec = +x.seconds || 0, rt = readTime(x.caption), hold = Math.max(x.beat === 'key' ? 2.4 : 1.8, rt);
  const f = +x.field, fp = i ? +stops[i - 1].field : f, e = f > 0 && fp > 0 ? Math.abs(Math.log(f / fp)) : 0;
  const move = i ? Math.max(0, e - STOP_ZOOM * hold) / MOVE + EASE : 0, want = hold + move;
  if (f > 0) { spanMax = Math.max(spanMax, f); spanMin = Math.min(spanMin, f); }
  sum += sec; need += want;
  rows.push([x.id, (x.name || '').slice(0, 20), x.beat || '', sec.toFixed(1), rt.toFixed(1), e.toFixed(1), want.toFixed(1), sec + 1e-6 < want ? 'SHORT' : '']);
  if (!x.caption || !(x.caption.title || x.caption.second)) problems.push(`${x.id}: no caption — every card before the way back is a stop with its caption`);
  else if (sec + 1e-6 < want) problems.push(`${x.id} '${x.name}': ${sec.toFixed(1)} s — the caption takes ${rt.toFixed(1)} s to read (held ≥ ${hold.toFixed(1)} s)${e > 0.1 ? ` and the move in is ${e.toFixed(1)} e-folds (≥ ${move.toFixed(1)} s)` : ''}: needs ≥ ${want.toFixed(1)} s`);
  const n = count(x.caption && (langs.length > 1 ? x.caption.second : x.caption.line));
  if (n > (cjk(langs[langs.length > 1 ? 1 : 0]) ? 26 : 45)) notes.push(`${x.id}: the audience's line has ${n} characters — ≤ 24 (Korean) keeps a stop short`);
});
// the way back: from the last stop up (or down) to the journey's widest view and back to the first stop, at up to 16 e-folds/s
const first = stops.length ? +stops[0].field : 0, last = stops.length ? +stops[stops.length - 1].field : 0;
const eBack = first > 0 && last > 0 ? Math.log(spanMax / last) + Math.log(spanMax / first) : 0;
const backNeed = Math.max(2.5, eBack / RET_ZOOM + 1.0), backSec = back.reduce((a, x) => a + (+x.seconds || 0), 0) || backNeed;
const total = Math.max(sum, need) + Math.max(backSec, backNeed);
const maxStops = Math.max(3, Math.floor(hi * 0.55 / 3));
if (stops.length > maxStops) problems.push(`${stops.length} stops — ${lo}–${hi} s holds about ${maxStops}: merge neighbours into one stop with labels, cut detours and near-duplicates (pacing.md §2)`);
if (need + backNeed > hi + 0.5) problems.push(`the stops, the moves between them and the way back need ≈ ${(need + backNeed).toFixed(1)} s — over ${hi} s: fewer stops or a shorter span (the journey spans ${spanMax > 0 && spanMin < Infinity ? Math.log(spanMax / spanMin).toFixed(1) : '?'} e-folds), never faster moves or shorter stops`);
if (Math.max(backSec, backNeed) > 0.12 * Math.max(total, lo) + 0.3) problems.push(`the way back needs ≈ ${Math.max(backSec, backNeed).toFixed(1)} s of ≈ ${total.toFixed(1)} s (> 12%)`);
if (total < lo - 0.5) notes.push(`the plan plays ≈ ${total.toFixed(1)} s — under ${lo} s`);
if (sb.estimate !== undefined && Math.abs(sb.estimate - (sum + backSec)) > 0.6) notes.push(`"estimate" (${sb.estimate}) is not the sum of the cards' seconds (${(sum + backSec).toFixed(1)})`);
const w = [4, 20, 7, 6, 6, 7, 7, 6];
console.log(['id', 'scene', 'beat', 'secs', 'read', 'e-fold', 'needs', ''].map((h, i) => h.padEnd(w[i])).join(' '));
rows.forEach(r => console.log(r.map((c, i) => String(c).padEnd(w[i])).join(' ')));
console.log(`\n${stops.length} stops (≤ ${maxStops} for ${lo}–${hi} s) · stops and moves need ≈ ${need.toFixed(1)} s (cards give ${sum.toFixed(1)} s) · the way back ≈ ${Math.max(backSec, backNeed).toFixed(1)} s (${eBack.toFixed(1)} e-folds) · ≈ ${total.toFixed(1)} s in all (target ${lo}–${hi} s)`);
notes.forEach(x => console.log('note: ' + x));
if (problems.length) { console.log('\nDOES NOT FIT:\n  - ' + problems.join('\n  - ')); process.exit(1); }
console.log('\nthe plan fits');
