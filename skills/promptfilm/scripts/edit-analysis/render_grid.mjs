// Render the film every STEP playback seconds over one loop (for matching an edited video against it).
//   node render_grid.mjs <url> <outdir> [--step 0.05] [--w 256 --h 455]
// writes <outdir>/NNNNN.jpg and meta.json { LOOP, step, n, beats }
import { open, seek, mkdir, argv, fs, path } from '../common.mjs';
const url = process.argv[2], out = mkdir(process.argv[3]);
const step = +argv('step', 0.05), w = argv('w', null), h = argv('h', null);   // null = the film's own aspect
const { browser, page } = await open(url, { w, h, q: '?freeze' });
const { width: VW, height: VH } = page.viewportSize();
await page.waitForTimeout(800);
const LOOP = await page.evaluate(() => window.__bw.LOOP);
const beats = await page.evaluate(() => (window.__bw.beats ? window.__bw.beats() : null));
const n = Math.floor(LOOP / step);
for (let i = 0; i < n; i++) { await seek(page, i * step); await page.screenshot({ path: path.join(out, `${String(i).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 85 }); }
fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify({ LOOP, step, n, w: VW, h: VH, beats }));
console.log('rendered', n, 'frames, LOOP', LOOP.toFixed(2));
await browser.close();
