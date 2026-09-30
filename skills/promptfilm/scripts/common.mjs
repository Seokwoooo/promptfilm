// Shared helpers for the QA scripts: a headless Chrome with the GPU on (or its software renderer), a viewport in the film's own aspect.
import { chromium } from 'playwright-core';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { PNG } from 'pngjs';

// Chrome: $CHROME, else Playwright's Chrome for Testing (newest first; `npx playwright install chromium` in scripts/), else an
// installed Chrome or Chromium — on macOS, Windows and Linux
export function findChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const home = os.homedir(), plat = process.platform, exists = p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } };
  const cache = plat === 'darwin' ? path.join(home, 'Library', 'Caches', 'ms-playwright')
    : plat === 'win32' ? path.join(process.env.LOCALAPPDATA || path.join(home, 'AppData', 'Local'), 'ms-playwright')
    : path.join(process.env.XDG_CACHE_HOME || path.join(home, '.cache'), 'ms-playwright');
  // chromium-<build>/chrome-<os>[-<arch>]/…: the folder names vary by OS and CPU (chrome-mac-arm64, chrome-linux-arm64, chrome-win64 …)
  const bin = plat === 'darwin' ? path.join('Google Chrome for Testing.app', 'Contents', 'MacOS', 'Google Chrome for Testing') : plat === 'win32' ? 'chrome.exe' : 'chrome';
  for (const base of [process.env.PLAYWRIGHT_BROWSERS_PATH, cache].filter(Boolean)) {
    let dirs = []; try { dirs = fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d)).sort((a, b) => +b.split('-')[1] - +a.split('-')[1]); } catch (e) {}
    for (const d of dirs) {
      let subs = []; try { subs = fs.readdirSync(path.join(base, d)).filter(x => x.startsWith('chrome-')); } catch (e) {}
      for (const sub of subs) { const p = path.join(base, d, sub, bin); if (exists(p)) return p; }
    }
  }
  const pf = process.env.PROGRAMFILES || 'C:\\Program Files', pf86 = process.env['PROGRAMFILES(X86)'] || 'C:\\Program Files (x86)', la = process.env.LOCALAPPDATA || '';
  const system = plat === 'darwin' ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium']
    : plat === 'win32' ? [pf, pf86, la].filter(Boolean).map(b => path.join(b, 'Google', 'Chrome', 'Application', 'chrome.exe'))
    : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium'];
  for (const p of system) if (exists(p)) return p;
  throw new Error('Chrome not found: run `npx playwright install chromium` in scripts/, or set CHROME=/path/to/chrome');
}
let EXE = null;
export const exePath = () => EXE || (EXE = findChrome());
// the GPU where there is one: Metal on macOS, Direct3D on Windows; on Linux Chrome picks the GPU, else its software renderer
// (SwiftShader — slow but exact). Extra flags: $PF_CHROME_ARGS
const GPU_ARGS = process.platform === 'darwin' ? ['--use-angle=metal'] : process.platform === 'win32' ? ['--use-angle=d3d11'] : ['--enable-unsafe-swiftshader'];
export const CHROME_ARGS = [...GPU_ARGS, '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', ...(process.env.PF_CHROME_ARGS || '').split(' ').filter(Boolean)];

// CSS px the QA opens a film at, by aspect (about half a million pixels each; 9x16 = 540 × 960)
export const SIZES = { '9x16': [540, 960], '16x9': [960, 540], '1x1': [720, 720], '4x5': [640, 800] };
// open the film: w × h CSS px (default: SIZES for the film's aspect × scale), device pixel ratio, extra query string (e.g. '?freeze')
export const launch = () => chromium.launch({ executablePath: exePath(), headless: true, args: CHROME_ARGS });
export async function open(url, { w, h, scale = 1, dpr = 1, q = '?freeze', timeout = 180000 } = {}) {
  const browser = await launch();
  const auto = !(w && h), sz = s => ({ width: Math.round(s[0] * scale), height: Math.round(s[1] * scale) });
  const page = await browser.newPage({ viewport: auto ? sz(SIZES['9x16']) : { width: +w, height: +h }, deviceScaleFactor: dpr });
  const logs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', e => logs.push(`[pageerror] ${e.message}`));
  await page.goto(url + q); page.setDefaultTimeout(1800000);
  await page.waitForFunction(() => window.__started || (document.getElementById('err') && !document.getElementById('err').hidden), null, { timeout });
  const err = await page.evaluate(() => { const e = document.getElementById('err'); return e && !e.hidden ? e.textContent : null; });
  if (auto && !err) {                            // resize to the film's aspect (the engine follows the window's resize event)
    const aspect = await page.evaluate(() => (window.__bw && window.__bw.FORMAT && window.__bw.FORMAT.aspect) || '9x16');
    if (aspect !== '9x16' && SIZES[aspect]) { await page.setViewportSize(sz(SIZES[aspect])); await page.waitForTimeout(100); }
  }
  return { browser, page, logs, err };
}
// console noise that is not the film's fault
export const realLogs = logs => logs.filter(l => !/favicon|404 \(File not found\)|status of 404|GPU stall|Automatic fallback to software WebGL/.test(l));

export const seek = (page, t) => page.evaluate(t => window.__bw.seek(t), t);
export async function shot(page, file) { const b = await page.screenshot({ type: 'png' }); if (file) fs.writeFileSync(file, b); return b; }
export const decode = buf => PNG.sync.read(buf);               // { width, height, data: RGBA }
export function writePng(file, w, h, rgba) { const p = new PNG({ width: w, height: h }); rgba.copy ? rgba.copy(p.data) : p.data.set(rgba); fs.writeFileSync(file, PNG.sync.write(p)); }
// mean / max absolute difference (0..255) over a region [x0, y0, x1, y1] in fractions of the frame
export function diff(a, b, reg = [0, 0, 1, 1]) {
  const W = a.width, H = a.height, x0 = Math.floor(reg[0] * W), y0 = Math.floor(reg[1] * H), x1 = Math.ceil(reg[2] * W), y1 = Math.ceil(reg[3] * H);
  let s = 0, m = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * W + x) * 4;
    for (let c = 0; c < 3; c++) { const d = Math.abs(a.data[i + c] - b.data[i + c]); s += d; if (d > m) m = d; n++; } }
  return { mean: s / n, max: m };
}
export const mkdir = d => { fs.mkdirSync(d, { recursive: true }); return d; };
export const argv = (name, def) => { const i = process.argv.indexOf('--' + name); return i > 0 ? process.argv[i + 1] : def; };
export const has = name => process.argv.includes('--' + name);
export { fs, path };
export { ffmpegBin } from './tools.mjs';       // ffmpeg: $FFMPEG, else on PATH, else the local copy setup.mjs installs
