#!/usr/bin/env node
// Wait until the requester presses "Send to Claude" (or sends the storyboard) in Promptfilm Studio for this session's film, print
// what they sent, and exit. Claude Code runs this in the background after starting the Studio (run_in_background); when it exits,
// the session gets this output and does the work — then starts it again. Nothing else calls it: the Studio only delivers to a
// waiting session, and only the requests of the film named here — two sessions on two films never get each other's.
//   node await.mjs --film <id> [--port 4870] [--root <dir>]
// --film may be left out only while the Studio has a single film. The port is read from <root>/.promptfilm/studio.json (written by
// the server), root = the current folder by default.
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const root = path.resolve(opt('root', '.'));
let port = +opt('port', 0);
if (!port) { try { port = JSON.parse(fs.readFileSync(path.join(root, '.promptfilm', 'studio.json'), 'utf8')).port; } catch (e) { port = 4870; } }
let film = opt('film', '*');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fmtT = t => { const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s.toFixed(2).padStart(5, '0')}`; };

function printStoryboard(q) {
  const sb = q.storyboard, L = [], changes = sb.scenes.filter(x => x.status === 'change'), oks = sb.scenes.filter(x => x.status === 'ok');
  L.push(`PROMPTFILM STORYBOARD — the requester ${sb.approved ? 'approved' : 'reviewed'} the storyboard in the Studio (${new Date(q.at).toLocaleString()})`);
  L.push(`root      ${q.root}`);
  L.push(`film      ${q.name}   (folder ${q.dir}, storyboard ${sb.file}, version ${sb.version})`);
  if (q.note) L.push(`note      "${q.note}"`);
  L.push(`scenes    ${oks.length} fine · ${changes.length} to change · ${sb.scenes.length - oks.length - changes.length} not marked`);
  for (const c of changes) L.push(`  ${c.id}  ${c.name}: "${c.note}"`);
  const answers = Object.entries(sb.answers || {}).map(([i, v]) => typeof v === 'string' ? { q: (sb.open || [])[+i] || '', a: v } : v).filter(v => v && v.a);
  for (const v of answers) L.push(`answer    to "${v.q || '(a question)'}": "${v.a}"`);
  if (sb.approved && !changes.length) L.push('next      the plan is approved: start the build (SKILL.md step 5), then start this watcher again in the background.');
  else if (sb.approved) L.push('next      apply these changes to plan.md, then start the build right away — no second review (step 5); start this watcher again.');
  else { L.push('next      revise plan.md and storyboard.json (keep scene ids; version + 1; a short reply in review.reply saying what changed),');
    L.push('          then start this watcher again in the background — the requester reviews the new version.'); }
  console.log(L.join('\n'));
}

function print(q) {
  if (q.kind === 'storyboard') return printStoryboard(q);
  const L = [];
  L.push(`PROMPTFILM REQUEST — the requester pressed "Send to Claude" in the Studio (${new Date(q.at).toLocaleString()})`);
  L.push(`root      ${q.root}`);
  L.push(`film      ${q.name}   (folder ${q.dir}, html ${q.html}, comments ${q.review})`);
  if (q.note) L.push(`note      "${q.note}"`);
  L.push(`open comments (${q.pins.length}):`);
  for (const p of q.pins) {
    const n = String(p.id).replace(/\D/g, ''), where = p.x == null ? 'whole frame' : `at x ${p.x.toFixed(2)}, y ${p.y.toFixed(2)}`;
    const c = p.context || {};
    L.push(`  #${n}  ${fmtT(p.t)}  ${where}  "${p.text}"`);
    L.push(`       snapshot ${p.snap || '(not made yet)'}${c.tau != null ? ` · τ ${c.tau}` : ''}${c.beat ? ` · ${c.beat}` : ''}${c.caption ? ` · caption "${c.caption}"` : ''}`);
  }
  const pace = Object.entries(q.pace || {});
  if (pace.length) L.push(`pace edits in parts/p8z_pace.js (the requester's own; keep them): ${pace.map(([k, v]) => `${k}${v.speed ? ' ×' + v.speed : ''}${v.kind ? ' ' + v.kind : ''}`).join(', ')}`);
  L.push('next      open each snapshot, fix every comment and others of its kind, rebuild, run QA, answer each pin in the review file');
  L.push('          (status "done", reply in the requester\'s language, resolvedIn), then start this watcher again in the background.');
  console.log(L.join('\n'));
}

if (film === '*') {                                             // which film is this session's? with several, it must be named
  try {
    const r = await (await fetch(`http://127.0.0.1:${port}/api/films`)).json(), ids = (r.films || []).map(f => f.id);
    if (ids.length === 1) film = ids[0];
    else if (ids.length > 1) { console.log(`PROMPTFILM — name this session's film: node <skill>/studio/await.mjs --film <id>   (films: ${ids.join(', ')})`); process.exit(2); }
  } catch (e) {}                                                  // the Studio isn't up yet: the loop below waits for it
}

for (let fails = 0; ;) {
  let r;
  try { r = await fetch(`http://127.0.0.1:${port}/api/await?film=${encodeURIComponent(film)}`, { headers: { 'X-Promptfilm': 'await' } }); }
  catch (e) {
    if (++fails >= 40) { console.log(`PROMPTFILM — the Studio is not running on port ${port} (start it: node <skill>/studio/server.mjs <dir>, then this again)`); process.exit(3); }
    await sleep(1500); continue;
  }
  fails = 0;
  if (r.status === 204) continue;                               // nothing yet: wait again
  if (r.status !== 200) { console.log(`PROMPTFILM — the Studio answered ${r.status}: ${(await r.text()).slice(0, 200)}`); process.exit(4); }
  print(await r.json());
  process.exit(0);
}
