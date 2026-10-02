// The delivery gate: a film is ready for its final video only when THIS build (the html's exact bytes) has passed the full QA run
// and a visual review of it (references/visual-review.md) has passed. Read by render.mjs (final renders) and the Studio (export card).
//   node gate.mjs <film.html>        prints the status; exit 0 = READY
//   <film>/qa/qa-report.json         qa.mjs: { build, full, ready, failing, look, accepted }
//   <film>/qa/review/meta.json       review.mjs: the build it was made for and one code per sheet (hashed)
//   <film>/qa/visual-review.md       the reviewer's form: "Build: <hash>", every row filled, each sheet's code, "Verdict: PASS"
//   <film>/qa/reviews/               earlier reviews (review.mjs moves them there): a build that failed a review stays failed
import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { pathToFileURL } from 'url';

export const buildHash = text => createHash('sha1').update(String(text).replace(/^﻿/, '')).digest('hex').slice(0, 12);
export const codeHash = (code, build) => createHash('sha256').update(`${String(code).trim().toUpperCase()}|${build}`).digest('hex').slice(0, 16);

// the parts of a review form: its build, verdict, tables and findings (also used to archive and to lock failed builds)
export function parseReview(text) {
  const b = /^\s*Build:\s*([0-9a-f]{12})\b/mi.exec(text), v = /^\s*Verdict:\s*(PASS|FAIL)\b/mi.exec(text);
  const section = n => { const m = new RegExp(`^##\\s*${n}\\.[^\\n]*$([\\s\\S]*?)(?=^##\\s)`, 'mi').exec(text); return m ? m[1] : ''; };
  const rows = s => s.split('\n').map(l => l.trim()).filter(l => l.startsWith('|') && !/^\|\s*-{2,}/.test(l)).slice(1)
    .map(l => l.replace(/^\||\|$/g, '').split('|').map(c => c.trim()));
  const fsec = (/^##\s*Findings\s*$([\s\S]*?)(^##\s|^\s*Verdict:)/mi.exec(text) || [])[1] || '';
  const flines = fsec.split('\n').map(l => l.trim()).filter(l => l && !/^<.*>$/.test(l));
  return { build: b ? b[1] : null, verdict: v ? v[1].toUpperCase() : null, bare: rows(section('1')), captions: rows(section('2')), sheets: rows(section('3')), findings: flines };
}

// decisions the requester has already made (qa/review-accepted.json) — same discipline as qa/accepted.json:
// only their own words, never the builder's judgement. A review line that matches one stops counting against the gate.
const settledFor = qaDir => { try { return JSON.parse(fs.readFileSync(path.join(qaDir, 'review-accepted.json'), 'utf8')) || []; } catch (e) { return []; } };
const settledHit = (list, text) => list.some(a => a && a.match && String(text).toLowerCase().includes(String(a.match).toLowerCase()));

export function gateStatus(htmlFile) {
  const dir = path.dirname(path.resolve(htmlFile)), qaDir = path.join(dir, 'qa');
  let hash = null; try { hash = buildHash(fs.readFileSync(htmlFile, 'utf8')); } catch (e) { return { ok: false, codes: ['no-film'], why: ['no such film: ' + htmlFile] }; }
  const SETTLED = settledFor(qaDir);
  const st = { hash, qa: { exists: false }, review: { exists: false }, why: [], codes: [] };
  const no = (code, why) => { st.codes.push(code); st.why.push(why); };
  try {
    const r = JSON.parse(fs.readFileSync(path.join(qaDir, 'qa-report.json'), 'utf8'));
    st.qa = { exists: true, when: r.when, sameBuild: r.build === hash, full: !!r.full, ready: !!r.ready, failing: r.failing || [], look: r.look || [], accepted: r.accepted || [] };
  } catch (e) { /* no report yet */ }
  if (!st.qa.exists) no('qa-none', 'no QA report — run qa.mjs (the full run) on this build');
  else if (!st.qa.sameBuild) no('qa-old', 'the QA report is for another build — the film changed since: run the full qa.mjs again');
  else if (!st.qa.full) no('qa-partial', 'the last QA run was partial (--only / --skip / --loop / --w / --h) — run the full qa.mjs');
  else if (!st.qa.ready) no('qa-fail:' + st.qa.failing.join(','), 'QA fails: ' + (st.qa.failing.join(', ') || 'see qa-report.md'));
  // a build that failed a review stays failed: fix it, rebuild (a new build), review again
  let failedBefore = false;
  try { for (const f of fs.readdirSync(path.join(qaDir, 'reviews'))) { const p = parseReview(fs.readFileSync(path.join(qaDir, 'reviews', f), 'utf8')); if (p.build === hash && p.verdict === 'FAIL') failedBefore = true; } } catch (e) {}
  try {
    const p = parseReview(fs.readFileSync(path.join(qaDir, 'visual-review.md'), 'utf8'));
    let meta = null; try { meta = JSON.parse(fs.readFileSync(path.join(qaDir, 'review', 'meta.json'), 'utf8')); } catch (e) {}
    const problems = [];
    if (!meta || meta.build !== hash) problems.push('the review material (review.mjs) is not for this build');
    else {
      if (p.sheets.length !== meta.sheets.length) problems.push(`§3 has ${p.sheets.length} sheet rows, the material ${meta.sheets.length}`);
      p.sheets.forEach((r, i) => { const m = meta.sheets[i]; if (!m) return;
        if (codeHash(r[1] || '', hash) !== (m.codeHash || m.code)) problems.push(`sheet ${i + 1}: its code is missing or wrong (the code is printed on the sheet's first frame)`);
        const live = (r[3] || '').split('·').map(x => x.trim()).filter(x => x && !settledHit(SETTLED, x));
        if (!/^nothing\b/i.test(r[3] || '') && live.length) problems.push(`sheet ${i + 1}: "${live.join(' · ').slice(0, 60)}"`); });
      if (p.bare.length !== meta.captions) problems.push(`§1 has ${p.bare.length} bare-frame rows, the film ${meta.captions} captions`);
      p.bare.forEach((r, i) => { if ((r[2] || '').length < 4) problems.push(`§1 frame ${i + 1}: "what the frame shows" is not written`); });
      if (p.captions.length !== meta.captions) problems.push(`§2 has ${p.captions.length} caption rows, the film ${meta.captions}`);
      p.captions.forEach((r, i) => { if (/way back/i.test(r[1] || '')) return; const a = r[r.length - 1] || '';
        if (!/^yes\b/i.test(a) && !settledHit(SETTLED, a)) problems.push(`caption ${i + 1}: "${(a || '(empty)').slice(0, 60)}"`); });
    }
    const noneLine = p.findings.length === 1 && /^[-*]\s*none\.?$/i.test(p.findings[0]);
    const liveF = noneLine ? [] : p.findings.filter(l => !settledHit(SETTLED, l));
    const sevOf = l => { const tail = (String(l).split('\u2014').pop() || '').trim().toLowerCase();
      return /^blocking\b/.test(tail) ? 'blocking' : /^minor\b/.test(tail) ? 'minor' : /\bblocking\s*\.?$/i.test(l) ? 'blocking' : ''; };
    const blockingN = liveF.filter(l => sevOf(l) === 'blocking').length, minorN = liveF.length - blockingN;
    const settledN = noneLine ? 0 : p.findings.length - liveF.length;
    if (!p.findings.length) problems.push('no Findings section');
    else if (liveF.length) problems.push(`${liveF.length} finding line(s)`
      + (blockingN ? ` — ${blockingN} blocking, ${minorN} minor` : '')
      + (settledN ? ` (${settledN} settled)` : ''));
    st.review = { exists: true, blocking: blockingN, minor: minorN, settled: settledN, sameBuild: p.build === hash, verdict: p.verdict, pass: p.build === hash && p.verdict === 'PASS' && problems.length === 0 && !failedBefore, problems: problems.slice(0, 8) };
  } catch (e) { /* no review yet */ }
  if (failedBefore) no('review-failed', 'this build already failed a visual review — fix what it found, rebuild, full QA, review again');
  else if (!st.review.exists) no('review-none', 'no visual review — scripts/review.mjs, then a fresh reviewer fills in the form (references/visual-review.md) as qa/visual-review.md');
  else if (!st.review.sameBuild) no('review-old', 'the visual review is for another build — review this one');
  else if (!st.review.pass) no('review-fail', `the visual review does not pass: ${st.review.verdict !== 'PASS' ? 'Verdict ' + (st.review.verdict || 'missing') : st.review.problems.join('; ')}`);
  st.ok = st.codes.length === 0;
  return st;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const f = process.argv[2];
  if (!f) { console.error('usage: node gate.mjs <film.html>'); process.exit(2); }
  const s = gateStatus(f);
  const extra = s.qa && s.qa.exists && s.qa.sameBuild ? [s.qa.look.length ? `looked at in the review: ${s.qa.look.join(', ')}` : '', s.qa.accepted.length ? `accepted by the requester: ${s.qa.accepted.map(a => `${a.check} ("${a.requester}")`).join(', ')}` : ''].filter(Boolean) : [];
  console.log(s.ok ? `READY — build ${s.hash}: the full QA and the visual review passed${extra.length ? ' · ' + extra.join(' · ') : ''}` : `NOT READY — build ${s.hash || '?'}:\n  - ` + s.why.join('\n  - '));
  process.exit(s.ok ? 0 : 1);
}
