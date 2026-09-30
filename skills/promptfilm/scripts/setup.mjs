#!/usr/bin/env node
// Is this machine ready to make films? Checks what the skill needs and installs what is missing, all inside the user's own folders
// (no admin rights), then says READY — or, for what it can't install, SETUP MISSING with the command that installs it.
//   node setup.mjs [--check] [--install-chromium]        (setup.sh runs it at step 0; Node.js itself is setup.sh's job)
//     --check              report only: install nothing
//     --install-chromium   install Playwright's Chromium even when a Chrome is found (for a Chrome that won't start headless)
// What it installs when missing:
//   packages  playwright-core, pngjs, ffmpeg-static — `npm ci` in this folder (a plugin install usually brought them already)
//   browser   Playwright's Chromium, matched to playwright-core, into its browser cache (~150 MB; nothing else is removed)
//   ffmpeg    only when there is none on PATH: the local build that ffmpeg-static downloads into node_modules (~45 MB)
// A run where everything is there takes about a second and prints one line.
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), CHECK = args.includes('--check'), FORCE_CHROMIUM = args.includes('--install-chromium');
const WIN = process.platform === 'win32';
const req = () => createRequire(path.join(HERE, 'package.json'));      // fresh each time: packages may appear during the run
const installed = [], missing = [], notes = [];
let ffmpeg = null, chrome = null;                                     // what was found (report() may run early)

function run(cmd, argv, opts = {}) {
  const r = spawnSync(cmd, argv, { cwd: HERE, stdio: 'pipe', encoding: 'utf8', timeout: 20 * 60e3, shell: WIN, ...opts });
  return { ok: r.status === 0, out: `${r.stdout || ''}${r.stderr || ''}${r.error ? r.error.message : ''}`.trim() };
}
const tail = s => s.split('\n').filter(Boolean).slice(-6).map(l => '    ' + l.slice(0, 200)).join('\n');

// 0) Node.js
const major = +process.versions.node.split('.')[0];
if (major < 20) {
  console.log(`SETUP MISSING node: Node.js 20 or newer is needed (now ${process.version}) — https://nodejs.org (LTS), or: brew install node`);
  process.exit(3);
}

// 1) the scripts' packages
const PKGS = ['playwright-core', 'pngjs', 'ffmpeg-static'];
const absent = () => PKGS.filter(p => { try { req().resolve(p); return false; } catch (e) { return true; } });
let gone = absent();
if (gone.length && !CHECK) {
  console.log(`setup: installing the scripts' packages (${gone.join(', ')}) with npm …`);
  let r = run(WIN ? 'npm.cmd' : 'npm', ['ci', '--ignore-scripts', '--no-audit', '--no-fund']);
  if (!r.ok) r = run(WIN ? 'npm.cmd' : 'npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund']);
  if (!r.ok) notes.push('npm failed:\n' + tail(r.out));
  gone = absent();
  if (!gone.length) installed.push('packages (npm)');
}
if (gone.length) {
  missing.push(`packages: ${gone.join(', ')} — run: cd "${HERE}" && npm install` + (CHECK ? '' : ' (npm is part of Node.js: https://nodejs.org)'));
  report();
}
const version = p => { try { return JSON.parse(fs.readFileSync(path.join(path.dirname(req().resolve(p + '/package.json')), 'package.json'), 'utf8')).version; } catch (e) { return '?'; } };

// 2) ffmpeg: on PATH (or $FFMPEG), else the local copy
const tools = await import(pathToFileURL(path.join(HERE, 'tools.mjs')).href);
if (process.env.FFMPEG && tools.runs(process.env.FFMPEG)) ffmpeg = `$FFMPEG (${process.env.FFMPEG})`;
else if (tools.runs('ffmpeg')) ffmpeg = 'on PATH';
else {
  const local = tools.localFfmpegPath();
  if (!local) missing.push(`ffmpeg: no ffmpeg on PATH and no ffmpeg-static build for ${process.platform}/${process.arch} — install ffmpeg (https://ffmpeg.org/download.html)`);
  else {
    if (!fs.existsSync(local) && !CHECK) {
      console.log('setup: no ffmpeg on PATH — downloading a local copy for the skill (ffmpeg-static, about 45 MB) …');
      const r = run(process.execPath, ['install.js'], { cwd: path.dirname(req().resolve('ffmpeg-static')), shell: false });
      if (!r.ok) notes.push('ffmpeg-static download failed:\n' + tail(r.out));
      else installed.push('a local ffmpeg (ffmpeg-static)');
    }
    if (fs.existsSync(local) && tools.runs(local)) ffmpeg = `local copy (${local})`;
    else missing.push(`ffmpeg: none on PATH and the local copy isn't there — ${CHECK ? 'run setup without --check' : 'install ffmpeg (macOS: brew install ffmpeg · Linux: sudo apt install ffmpeg · Windows: winget install ffmpeg)'}`);
  }
}

// 3) a Chrome that starts headless: $CHROME, Playwright's Chromium, or an installed Chrome / Chromium
const common = await import(pathToFileURL(path.join(HERE, 'common.mjs')).href);
const { chromium } = await import('playwright-core');
async function starts(exe) {
  try { const b = await chromium.launch({ executablePath: exe, headless: true, args: common.CHROME_ARGS, timeout: 60000 }); await b.close(); return true; }
  catch (e) { return false; }
}
try { chrome = common.findChrome(); } catch (e) {}
let chromeOk = chrome && !FORCE_CHROMIUM ? await starts(chrome) : false;
if (!chromeOk && !CHECK && !process.env.CHROME) {
  console.log(`setup: ${chrome ? (FORCE_CHROMIUM ? 'installing' : 'the Chrome found does not start headless — installing') : 'no Chrome or Chromium found — installing'} Playwright's Chromium (about 150 MB) …`);
  const cli = path.join(path.dirname(req().resolve('playwright-core/package.json')), 'cli.js');
  const r = run(process.execPath, [cli, 'install', '--no-shell', '--no-remove', '--no-progress', 'chromium'], { shell: false });
  if (!r.ok) notes.push('Chromium download failed:\n' + tail(r.out));
  try { chrome = common.findChrome(); } catch (e) { chrome = null; }
  chromeOk = chrome ? await starts(chrome) : false;
  if (chromeOk) installed.push("Playwright's Chromium");
}
if (!chromeOk) missing.push(process.env.CHROME ? `browser: CHROME=${process.env.CHROME} does not start headless — fix the path or unset CHROME`
  : `browser: no Chrome that starts headless${CHECK ? ' — run setup without --check' : ` — run: node "${path.join(path.dirname(req().resolve('playwright-core/package.json')), 'cli.js')}" install --no-shell chromium`}` +
    (process.platform === 'linux' ? ' (on Linux its system libraries may be missing: add --with-deps, which uses sudo)' : ''));

report();

function report() {
  const ready = !missing.length;
  const chromeName = chrome ? path.basename(chrome) : 'none';
  if (ready && !installed.length && !notes.length) {
    console.log(`setup: ready — node ${process.versions.node} · packages · ${chromeName} · ffmpeg ${ffmpeg ? ffmpeg.split(' (')[0] : '?'}`);
    process.exit(0);
  }
  if (installed.length) console.log(`setup: installed ${installed.join(', ')}`);
  for (const n of notes) console.log('setup: ' + n);
  if (ready) {
    console.log(`setup: ready — node ${process.versions.node} · playwright-core ${version('playwright-core')} · ${chromeName} · ffmpeg ${ffmpeg || '?'}`);
    process.exit(0);
  }
  for (const m of missing) console.log('SETUP MISSING ' + m);
  process.exit(3);
}
