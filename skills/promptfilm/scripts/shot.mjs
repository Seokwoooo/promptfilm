// Screenshots at given playback times: node shot.mjs <url> [--out dir] [--w 540 --h 960] [--dpr 1] [--safe] [--text0] [--sheet cols] t1 t2 ...
// (default size: the film's own aspect, common.mjs SIZES)
// --sheet N also tiles all the shots into <out>/sheet.png, N per row (360 px wide each) — one image to look at instead of many.
import { execFileSync } from 'child_process';
import { open, realLogs, seek, shot, mkdir, argv, has, path, fs, ffmpegBin } from './common.mjs';
const url = process.argv[2], out = mkdir(argv('out', 'shots'));
const times = process.argv.slice(3).filter((a, i, all) => !a.startsWith('--') && !(all[i - 1] || '').match(/^--(out|w|h|dpr|sheet)$/)).map(Number);
const q = '?freeze' + (has('safe') ? '&safe' : '') + (has('text0') ? '&text=0' : '');
const { browser, page, logs, err } = await open(url, { w: argv('w', null), h: argv('h', null), dpr: +argv('dpr', 1), q });
const { width: VW, height: VH } = page.viewportSize();
if (err) console.log('ERROR BOX:', err);
const files = [];
for (const t of times) { await seek(page, t); await page.waitForTimeout(40); const f = path.resolve(out, `t${t.toFixed(2).padStart(7, '0')}.png`); await shot(page, f); files.push(f); }
const r = realLogs(logs); console.log('LOOP', await page.evaluate(() => window.__bw && window.__bw.LOOP), 'LOGS', r.length); r.slice(0, 8).forEach(l => console.log(l.slice(0, 3000)));
await browser.close();
const cols = +argv('sheet', 0);
if (cols > 0 && files.length) {
  const list = path.resolve(out, 'sheet_list.txt'); fs.writeFileSync(list, files.map(f => `file '${f}'`).join('\n'));
  const tw = 360, th = Math.round(tw * VH / VW);
  execFileSync(ffmpegBin(), ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', list, '-vf', `scale=${tw}:${th},tile=${cols}x${Math.ceil(files.length / cols)}:padding=4:color=0x202020`, '-frames:v', '1', path.resolve(out, 'sheet.png')]);
  console.log('sheet', path.resolve(out, 'sheet.png'));
}
