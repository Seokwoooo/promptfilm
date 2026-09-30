// Render a film to an MP4, frame by frame: seek(t) → screenshot → ffmpeg. The film is a pure function of playback time
// (motion blur and grain included), so the video is the film exactly — no dropped frames, whatever the machine's speed.
//   node render.mjs <film.html | url> [--out file.mp4] [--fps 60] [--draft] [--text0] [--loops 1] [--srt] [--workers K] [--seconds S] [--unchecked]
//   (--seconds S: only the first S seconds — a quick look or a test; the full loop otherwise)
//   node render.mjs <url | film.html> --still 12.5 [--out frame.png] [--text0]
// Output size follows the film's aspect: 9x16 → 1080 × 1920, 16x9 → 1920 × 1080, 1x1 → 1080 × 1080, 4x5 → 1080 × 1350.
// Final (default): lossless PNG frames, x264 CRF 14 (slow), BT.709. Draft (--draft): 30 fps, JPEG frames, CRF 20 (veryfast).
// One loop by default, frames at t = i · LOOP / N (N = round(LOOP · fps)), so the video loops seamlessly on auto-replay.
// The video only: the captions are already in the picture. --srt also writes them as an .srt next to the video (same lines and
// timing) — only when the requester asks for a subtitle file.
// The final video (not --draft, --seconds or --still) is made only of a build that passed its full QA run and its visual review
// (gate.mjs); --unchecked renders anyway — then the requester must be told the video is unchecked.
import { spawn } from 'child_process';
import { once } from 'events';
import http from 'http';
import os from 'os';
import { pathToFileURL } from 'url';
import { open, realLogs, argv, has, fs, path, ffmpegBin } from './common.mjs';
import { gateStatus } from './gate.mjs';

export const OUT_SIZES = { '9x16': [1080, 1920], '16x9': [1920, 1080], '1x1': [1080, 1080], '4x5': [1080, 1350] };

// open the film at its own aspect, then at the output size with device pixel ratio 1; the host draws every frame
async function prepare(url, text) {
  const { browser, page, logs, err } = await open(url, { q: '?freeze' + (text ? '' : '&text=0') });
  try {
    if (err) throw new Error('the film shows an error: ' + err.trim());
    const info = await page.evaluate(() => {
      const b = window.__bw;
      return b && b.LOOP ? { LOOP: b.LOOP, format: b.FORMAT || null, external: typeof b.external === 'function', captions: typeof b.captions === 'function' } : null;
    });
    if (!info) throw new Error('no window.__bw.LOOP on the page — is this a Promptfilm film?');
    const aspect = (info.format && info.format.aspect) || await page.evaluate(() => {   // older films: measure the frame
      const f = document.getElementById('frame') || document.querySelector('canvas'); if (!f) return '9x16';
      const r = f.getBoundingClientRect(), ar = r.width / r.height, known = { '9x16': 9 / 16, '16x9': 16 / 9, '1x1': 1, '4x5': 0.8 };
      return Object.keys(known).sort((a, b) => Math.abs(Math.log(ar / known[a])) - Math.abs(Math.log(ar / known[b])))[0]; });
    const [W, H] = OUT_SIZES[aspect] || OUT_SIZES['9x16'];
    // text layers are promoted (will-change) for smooth live playback, and the browser then reuses their raster, whose subpixel
    // position depends on how the page got to this frame. Captured frames must depend on t alone: paint them fresh every frame
    await page.addStyleTag({ content: '#frame, #frame * { will-change: auto !important; }' });
    if (info.external) await page.evaluate(() => window.__bw.external(true));
    // films made before the engine preloaded its fonts (those without external()) would draw a caption's first frames in a fallback
    // face: show every moment once — still at the small size, where each frame is cheap — so every font subset is requested
    else await page.evaluate(async LOOP => { for (let t = 0; t < LOOP; t += 0.2) { window.__bw.seek(t); void document.body.offsetHeight; } }, info.LOOP);
    if (await page.evaluate(() => !!document.fonts)) await page.evaluate(() => Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 8000))]));
    await page.setViewportSize({ width: W, height: H });
    await page.waitForTimeout(300);
    const canvas = await page.evaluate(() => { const c = document.querySelector('#frame canvas') || document.querySelector('canvas'); return c ? [c.width, c.height] : null; });
    const cdp = await page.context().newCDPSession(page);
    return { browser, page, logs, cdp, info, aspect, W, H, canvas };
  } catch (e) { await browser.close(); throw e; }
}

async function capture(cdp, page, t, format) {
  await page.evaluate(t => window.__bw.seek(t), t);
  const { data } = await cdp.send('Page.captureScreenshot', format === 'jpeg' ? { format: 'jpeg', quality: 92, optimizeForSpeed: true } : { format: 'png', optimizeForSpeed: true });
  return Buffer.from(data, 'base64');
}

const stamp = (s) => { const ms = Math.max(0, Math.round(s * 1000)), p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`; };

// render one or more loops to `out` (.mp4). Several browsers capture frames in parallel (frame i on worker i mod K; lossless PNG
// capture is the slow step and scales with them) and one ffmpeg encodes them in order. onProgress({ frame, total, elapsed }) as
// frames reach the encoder; `signal` (AbortSignal) cancels.
export async function render({ url, out, fps = 60, draft = false, text = true, loops = 1, srt = false, workers = 0, seconds = 0, gateFile = null, onProgress = () => {}, signal } = {}) {
  if (draft && fps === 60) fps = 30;
  const K = Math.max(1, Math.min(8, workers || (draft ? 2 : Math.max(1, Math.min(4, Math.floor(os.cpus().length / 3))))));
  const settled = await Promise.allSettled([...Array(K)].map(() => prepare(url, text)));
  const P = settled.filter(r => r.status === 'fulfilled').map(r => r.value);
  let ff = null, ok = false;
  try {
    if (P.length < K) throw settled.find(r => r.status === 'rejected').reason;
    const { info, W, H } = P[0];
    const N = Math.max(1, Math.round(info.LOOP * fps)), dt = info.LOOP / N;
    // --seconds as long as the loop is the whole film: a final video, gated like one
    if (gateFile && seconds >= info.LOOP - 1e-3) { const g = gateStatus(gateFile); if (!g.ok) throw new Error(`NOT RENDERED — ${seconds} s is the whole loop, a final video, and build ${g.hash} is not ready:\n  - ${g.why.join('\n  - ')}`); }
    const total = seconds > 0 ? Math.max(1, Math.min(N * Math.max(1, loops), Math.round(seconds * fps))) : N * Math.max(1, loops);
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    ff = spawn(ffmpegBin(), ['-hide_banner', '-loglevel', 'error', '-y',
      '-f', 'image2pipe', '-framerate', String(fps), '-c:v', draft ? 'mjpeg' : 'png', '-i', '-',
      '-vf', 'scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,setparams=range=tv:color_primaries=bt709:color_trc=bt709:colorspace=bt709',
      '-c:v', 'libx264', '-preset', draft ? 'veryfast' : 'slow', '-crf', draft ? '20' : '14', '-x264-params', 'aq-mode=3',
      '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
      '-movflags', '+faststart', '-r', String(fps), out], { stdio: ['pipe', 'ignore', 'pipe'] });
    let ffErr = ''; ff.stderr.on('data', d => { ffErr += d; });
    const ffDone = once(ff, 'close');
    ff.stdin.on('error', () => {});                            // ffmpeg died: reported by its exit code below
    const t0 = Date.now(), ready = new Map(), wake = [], AHEAD = 3 * K;
    let next = 0, flushing = false, failed = null;
    const flush = async () => {                                // write every frame that is next in line, in order
      if (flushing) return; flushing = true;
      try {
        while (ready.has(next) && !failed) {
          const buf = ready.get(next); ready.delete(next);
          if (ff.exitCode !== null) throw new Error('ffmpeg stopped early: ' + ffErr.trim().slice(-400));
          if (!ff.stdin.write(buf)) await Promise.race([once(ff.stdin, 'drain'), ffDone]);
          next++; onProgress({ frame: next, total, elapsed: (Date.now() - t0) / 1000 });
          wake.splice(0).forEach(r => r());
        }
      } finally { flushing = false; }
    };
    await Promise.all(P.map(async (w, k) => {
      try {
        for (let i = k; i < total && !failed; i += K) {
          while (i - next > AHEAD && !failed) await new Promise(r => wake.push(r));   // don't run far ahead of the encoder
          if (signal && signal.aborted) throw new Error('cancelled');
          ready.set(i, await capture(w.cdp, w.page, (i % N) * dt, draft ? 'jpeg' : 'png'));
          await flush();
        }
      } catch (e) { failed = failed || e; wake.splice(0).forEach(r => r()); }
    }));
    if (failed) throw failed;
    await flush();
    ff.stdin.end();
    const [code] = await ffDone;
    if (code !== 0 || next !== total) throw new Error(`ffmpeg failed (${code}, ${next}/${total} frames): ` + ffErr.trim().slice(-600));
    let srtFile = null;
    if (srt && info.captions) {
      const caps = await P[0].page.evaluate(() => window.__bw.captions());
      const loopV = N / fps, rows = [];                         // the video's own loop length (N frames)
      const end = total / fps;                                  // a partial render (--seconds) keeps only the captions it shows
      for (let L = 0; L < Math.max(1, loops); L++) for (const c of caps) {
        const lines = [c.en, c.sub, c.ko].filter(x => x && String(x).trim()), a = c.t0 * loopV / info.LOOP + L * loopV, b = Math.min(end, c.t1 * loopV / info.LOOP + L * loopV);
        if (lines.length && a < end) rows.push(`${rows.length + 1}\n${stamp(a)} --> ${stamp(b)}\n${lines.join('\n')}\n`);
      }
      if (rows.length) { srtFile = out.replace(/\.mp4$/i, '') + '.srt'; fs.writeFileSync(srtFile, rows.join('\n')); }
    }
    ok = true;
    return { out, srt: srtFile, frames: total, fps, workers: K, size: [W, H], canvas: P[0].canvas, loop: info.LOOP, seconds: +(total / fps).toFixed(3),
      renderSeconds: +((Date.now() - t0) / 1000).toFixed(1), logs: realLogs(P.flatMap(w => w.logs)) };
  } finally {
    if (ff && ff.exitCode === null && !ok) ff.kill('SIGKILL');
    if (!ok) { try { fs.unlinkSync(out); } catch (e) {} }
    await Promise.all(P.map(w => w.browser.close().catch(() => {})));
  }
}

// one full-size PNG of playback time t
export async function still({ url, out, t = 0, text = true } = {}) {
  const P = await prepare(url, text);
  try {
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, await capture(P.cdp, P.page, t, 'png'));
    return { out, t, size: [P.W, P.H] };
  } finally { await P.browser.close(); }
}

// a local file → a throwaway static server for its folder (the film loads its fonts and three.js over the network either way)
function serveFolder(file) {
  const dir = path.dirname(path.resolve(file)), types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary' };
  const srv = http.createServer((req, res) => {
    const p = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!p.startsWith(dir) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { 'Content-Type': types[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
  });
  return new Promise(r => srv.listen(0, '127.0.0.1', () => r({ srv, url: `http://127.0.0.1:${srv.address().port}/${encodeURIComponent(path.basename(file))}` })));
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const target = process.argv[2];
  if (!target || target.startsWith('--')) { console.error('usage: node render.mjs <film.html | url> [--out file.mp4] [--fps 60] [--draft] [--text0] [--loops 1] [--srt] [--unchecked] | --still <t>'); process.exit(2); }
  let url = target, srv = null;
  // a final video = not a --draft, not a --still, not a few --seconds shorter than the loop (render() checks that once it knows the loop)
  const final = !has('still') && !has('draft'), partial = +argv('seconds', 0) > 0;
  if (final && !partial && !has('unchecked')) {
    const g = /^https?:/.test(target) ? { ok: false, hash: '?', why: ['a final video is made from the film file (<film>/<name>.html), so its QA report and visual review can be checked'] } : gateStatus(target);
    if (!g.ok) { console.error(`NOT RENDERED — build ${g.hash} is not ready for its final video:\n  - ${g.why.join('\n  - ')}\n(--draft: a quick look without the gate · --unchecked: render anyway, and tell the requester the video is unchecked)`); process.exit(3); }
  }
  if (final && has('unchecked')) console.log('UNCHECKED — rendering a build that has not passed its full QA and visual review: say so to the requester (the file is named …_unchecked).');
  if (!/^https?:/.test(target)) { if (!fs.existsSync(target)) { console.error('no such file: ' + target); process.exit(2); } ({ srv, url } = await serveFolder(target)); }
  const base = path.basename(new URL(url).pathname).replace(/\.html$/, '') || 'film';
  const when = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
  try {
    if (has('still')) {
      const t = +argv('still', 0), out = argv('out', `render/${base}-t${t.toFixed(2)}.png`);
      const r = await still({ url, out, t, text: !has('text0') });
      console.log(`still ${r.out} (${r.size.join(' × ')}, t = ${r.t} s)`);
    } else {
      // the file says what it is: a draft, or a video of a build that has not passed its checks
      let out = argv('out', `render/${base}_${when}${has('draft') ? '_draft' : ''}.mp4`);
      if (final && has('unchecked') && !/_unchecked\.mp4$/.test(out)) out = out.replace(/\.mp4$/, '') + '_unchecked.mp4';
      let last = 0;
      const r = await render({ url, out, fps: +argv('fps', has('draft') ? 30 : 60), draft: has('draft'), text: !has('text0'), loops: +argv('loops', 1), srt: has('srt'), workers: +argv('workers', 0), seconds: +argv('seconds', 0),
        gateFile: final && partial && !has('unchecked') && !/^https?:/.test(target) ? target : null,
        onProgress: ({ frame, total, elapsed }) => { if (frame === total || Date.now() - last > 2000) { last = Date.now();
          process.stdout.write(`\r  frame ${frame}/${total} · ${(frame / Math.max(elapsed, 1e-3)).toFixed(1)} fps · ${Math.round((total - frame) / Math.max(frame / Math.max(elapsed, 1e-3), 1e-3))} s left   `); } } });
      console.log(`\nrendered ${r.out}  ${r.size.join(' × ')} · ${r.fps} fps · ${r.frames} frames = ${r.seconds} s (loop ${r.loop.toFixed(3)} s) · ${r.workers} workers · took ${r.renderSeconds} s` +
        (r.srt ? `\ncaptions ${r.srt}` : '') + (r.logs.length ? `\nconsole: ${r.logs.slice(0, 3).join(' | ')}` : ''));
    }
  } catch (e) { console.error('\nrender failed: ' + e.message); process.exitCode = 1; }
  finally { if (srv) srv.close(); }
}
