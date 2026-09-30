#!/usr/bin/env node
// Start a new film — the same as new_film.sh, without a shell (Windows included):
//   node new_film.mjs <film-dir> <name> [--aspect 9x16|16x9|1x1|4x5] [--length 45-60] [--langs "en ko"]
// Copies the engine (core parts) and the empty film template into <film-dir>/parts, adds build.mjs + build.sh, research/, qa/ and
// plan.md, and writes the kickoff answers (aspect, target loop length in seconds, caption languages) onto the frame in p1_head.html.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const [DIR, NAME] = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] || '').startsWith('--'));
const fail = m => { console.error(m); process.exit(2); };
if (!DIR || !NAME) fail('usage: node new_film.mjs <film-dir> <name> [--aspect 9x16] [--length 45-60] [--langs "en ko"]');
const ASPECT = opt('aspect', '9x16'), LENGTH = opt('length', '45-60'), LANGS = opt('langs', 'en ko').trim().split(/\s+/).join(' ');
if (!['9x16', '16x9', '1x1', '4x5'].includes(ASPECT)) fail(`--aspect must be 9x16, 16x9, 1x1 or 4x5 (got ${ASPECT})`);
if (!/^\d+-\d+$/.test(LENGTH)) fail(`--length must be MIN-MAX seconds, e.g. 45-60 (got ${LENGTH})`);
if (!/^[A-Za-z0-9_-]+$/.test(NAME)) fail(`the name must be letters, digits, - or _ (got ${NAME})`);
if (fs.existsSync(path.join(DIR, 'parts'))) fail(`${DIR}/parts already exists — not overwriting`);

// a Noto family for every language whose script Barlow does not cover (Barlow covers Latin, incl. Vietnamese)
const FONT = [[/^ko/, 'Noto Sans KR'], [/^ja/, 'Noto Sans JP'], [/^zh-(TW|HK|Hant)/, 'Noto Sans TC'], [/^zh/, 'Noto Sans SC'], [/^th/, 'Noto Sans Thai'],
  [/^(hi|mr|ne)/, 'Noto Sans Devanagari'], [/^(ar|fa|ur)/, 'Noto Sans Arabic'], [/^he/, 'Noto Sans Hebrew'], [/^(ru|uk|bg|sr|el|kk)/, 'Noto Sans']];
const faces = [...new Set(LANGS.split(' ').map(l => (FONT.find(([re]) => re.test(l)) || [])[1]).filter(Boolean))];
if (LANGS.split(' ').some(l => /^(ar|fa|ur|he)/.test(l))) console.log('note: right-to-left lines are set right to left; look at the captions and labels once by eye');

const parts = path.join(DIR, 'parts');
for (const d of [parts, path.join(DIR, 'research', 'refs'), path.join(DIR, 'qa')]) fs.mkdirSync(d, { recursive: true });
for (const from of ['core', 'film-template']) for (const f of fs.readdirSync(path.join(SKILL, 'engine', from))) fs.copyFileSync(path.join(SKILL, 'engine', from, f), path.join(parts, f));
const headFile = path.join(parts, 'p1_head.html');
let head = fs.readFileSync(headFile, 'utf8');
head = head.replace('data-aspect="9x16" data-langs="en ko" data-length="45-60"', `data-aspect="${ASPECT}" data-langs="${LANGS}" data-length="${LENGTH}"`)
  .replace('&family=Noto+Sans+KR:wght@500', faces.map(f => `&family=${f.replace(/ /g, '+')}:wght@500`).join(''))
  .replace('--face-lang: "Noto Sans KR";', `--face-lang: ${faces.length ? faces.map(f => `"${f}"`).join(', ') : 'sans-serif'};`);
fs.writeFileSync(headFile, head);
fs.writeFileSync(path.join(DIR, 'build.mjs'), fs.readFileSync(path.join(SKILL, 'engine', 'build.mjs'), 'utf8').replace("const NAME = 'film';", `const NAME = '${NAME}';`));
fs.writeFileSync(path.join(DIR, 'build.sh'), fs.readFileSync(path.join(SKILL, 'engine', 'build.sh'), 'utf8').replace(/^NAME=\$\{2:-\$\{NAME:-film\}\}/m, `NAME=\${2:-\${NAME:-${NAME}}}`));
const plan = path.join(DIR, 'plan.md');
if (!fs.existsSync(plan)) fs.writeFileSync(plan, fs.readFileSync(path.join(SKILL, 'references', 'plan-template.md'), 'utf8')
  .replace(/^- Aspect \/ length \/ languages \(kickoff\):.*$/m, `- Aspect / length / languages (kickoff): ${ASPECT} · ${LENGTH} s · ${LANGS}`));
console.log(`new film in ${DIR}  (${ASPECT} · one loop ${LENGTH} s · captions: ${LANGS})
  parts/     p1_head.html (title + header comment), p3_scene.js, p8_timeline.js are yours; p2/p7/p9/p10 are the engine
  build:     node ${path.join(DIR, 'build.mjs')}   (or sh build.sh)  ->  ${path.join(DIR, NAME + '.html')}
  QA:        node ${path.join(SKILL, 'scripts', 'qa.mjs')} http://127.0.0.1:8765/<path to ${NAME}.html> --out ${path.join(DIR, 'qa')}`);
