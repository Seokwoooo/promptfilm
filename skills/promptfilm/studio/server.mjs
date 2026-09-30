#!/usr/bin/env node
// Promptfilm Studio — a local server for looking at films the way an editor does: play and scrub them on a timeline (beats,
// captions, comments), change the pace of a beat, pin review comments on the frame (saved to review.json, with a snapshot, for
// Claude to read and answer), and render the MP4.
//   node studio/server.mjs [root=.] [--film <id>] [--view board|film] [--port 4870] [--no-open]
// It opens the page in the browser (on --film when given) — or, when a Studio page is already open, switches that page to the film.
// Run it again at any time: when a Studio for this root is already running, it only opens / switches the page and exits.
// Films are found under root: a folder with build.sh + parts/ (made by new_film.sh), or single .html films with the engine's hooks.
// Everything stays on this machine: the server listens on 127.0.0.1 only and reads and writes only under root.
import http from 'http';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { execFile } from 'child_process';
import { gateStatus } from '../scripts/gate.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const UI = path.join(HERE, 'ui');
const VERSION = crypto.createHash('sha1').update(fs.readFileSync(fileURLToPath(import.meta.url))).digest('hex').slice(0, 10);   // this server's code
const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf('--' + name); return i >= 0 ? argv[i + 1] : def; };
const ROOT = path.resolve(argv.find((a, i) => !a.startsWith('--') && !['--port', '--film', '--view'].includes(argv[i - 1])) || '.');
const PORT0 = +opt('port', 4870);
const OPEN = !argv.includes('--no-open'), FILM_ARG = opt('film', null), VIEW_ARG = opt('view', null);
let PORT = PORT0;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webm': 'video/webm', '.srt': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
const posix = p => p.split(path.sep).join('/');
const rel = abs => posix(path.relative(ROOT, abs));
const exists = p => fsp.stat(p).then(s => s, () => null);

/* ---------- finding films ---------- */
const SKIP = new Set(['node_modules', 'parts', 'qa', 'research', 'render', 'review', 'refs', 'tools', 'src', 'backups']);
async function tail(file, bytes) {
  const fh = await fsp.open(file, 'r');
  try { const { size } = await fh.stat(), n = Math.min(size, bytes), b = Buffer.alloc(n); await fh.read(b, 0, n, size - n); return b.toString('utf8'); }
  finally { await fh.close(); }
}
// what is read out of a file is kept until the file changes (a scan then reads only new or rebuilt files)
const SEEN = new Map();                                         // 'kind:abs' → { mtime, size, value }
async function cached(kind, file, fn) {
  const st = await exists(file); if (!st) return fn();
  const k = kind + ':' + file, c = SEEN.get(k);
  if (c && c.mtime === st.mtimeMs && c.size === st.size) return c.value;
  const value = await fn(); SEEN.set(k, { mtime: st.mtimeMs, size: st.size, value }); return value;
}
const isFilmHtml = f => cached('film', f, async () => { try { return /window\.__bw\s*=/.test(await tail(f, 400000)); } catch (e) { return false; } });
const versionOf = f => { const m = /\.v(\d+)\.html$/.exec(f); return m ? +m[1] : null; };
async function head(file, bytes) { const fh = await fsp.open(file, 'r'); try { const b = Buffer.alloc(bytes); const { bytesRead } = await fh.read(b, 0, bytes, 0); return b.toString('utf8', 0, bytesRead); } finally { await fh.close(); } }
// the frame's aspect: data-aspect (films from new_film.sh); older films: their #frame CSS (aspect-ratio: 9 / 16, or a square min(100vw, 100vh))
const aspectOf = file => cached('aspect', file, async () => {
  try {
    const h = await head(file, 80000);
    let m = /id="frame"[^>]*data-aspect="(9x16|16x9|1x1|4x5)"/.exec(h); if (m) return m[1];
    m = /#frame\s*\{[^}]*aspect-ratio:\s*(\d+)\s*\/\s*(\d+)/.exec(h); if (m) return `${m[1]}x${m[2]}`;
    if (/#frame\s*\{[^}]*width:\s*min\(100vw,\s*100vh\)/.test(h)) return '1x1';
  } catch (e) {}
  return '9x16';
});

async function describe(film) {                       // fill in what changes: the main file's time, versions, pins, renders
  const sb = film.storyboard ? await exists(path.join(ROOT, film.storyboard)) : null;
  film.sbTime = sb ? sb.mtimeMs : 0;
  if (sb) { try { const j = JSON.parse(await fsp.readFile(path.join(ROOT, film.storyboard), 'utf8')); film.sbApproved = !!(j.review && j.review.approved); film.sbVersion = j.version || 1; } catch (e) { film.sbApproved = false; } }
  const st = film.html ? await exists(path.join(ROOT, film.html)) : null;
  film.mtime = st ? st.mtimeMs : 0;
  if (st) film.aspect = await aspectOf(path.join(ROOT, film.html));
  try { const r = JSON.parse(await fsp.readFile(path.join(ROOT, film.review), 'utf8')); film.pins = r.pins.length; film.openPins = r.pins.filter(p => p.status !== 'done').length; }
  catch (e) { film.pins = 0; film.openPins = 0; }
  // the delivery gate for this build (full QA + visual review — scripts/gate.mjs), shown on the export card; recomputed when the film,
  // its QA report or its review change
  if (st) {
    const qd = path.join(ROOT, film.dir || path.dirname(film.html), 'qa'), m = async f => { const s = await exists(path.join(qd, f)); return s ? s.mtimeMs : 0; };
    const key = `${st.mtimeMs}|${await m('qa-report.json')}|${await m('visual-review.md')}`;
    if (film.gateKey !== key) { try { const g = gateStatus(path.join(ROOT, film.html)); film.gate = { ok: g.ok, codes: g.codes || [] }; } catch (e) { film.gate = null; } film.gateKey = key; }
  } else film.gate = null;
  film.renders = [];
  try {
    const dir = path.join(ROOT, film.renderDir);
    for (const f of await fsp.readdir(dir)) if (/\.(mp4|png)$/i.test(f) && f.startsWith(film.name)) {
      const s = await fsp.stat(path.join(dir, f)); film.renders.push({ file: posix(path.join(film.renderDir, f)), size: s.size, mtime: s.mtimeMs });
    }
    film.renders.sort((a, b) => b.mtime - a.mtime); film.renders = film.renders.slice(0, 12);
  } catch (e) {}
  return film;
}

async function scan() {
  const films = [];
  async function walk(dir, depth) {
    let ents; try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch (e) { return; }
    const names = new Set(ents.map(e => e.name)), d = rel(dir) || '.';
    const htmls = ents.filter(e => e.isFile() && e.name.endsWith('.html')).map(e => e.name);
    if (names.has('build.sh') && names.has('parts')) {        // a film folder (new_film.sh)
      let name = path.basename(dir);
      try { const m = /^NAME=\$\{2:-\$\{NAME:-([^}]+)\}\}/m.exec(await fsp.readFile(path.join(dir, 'build.sh'), 'utf8')); if (m) name = m[1]; } catch (e) {}
      let main = htmls.includes(name + '.html') ? name + '.html' : null;
      if (!main) for (const h of htmls) if (versionOf(h) === null && await isFilmHtml(path.join(dir, h))) { main = h; name = h.replace(/\.html$/, ''); break; }
      const versions = htmls.filter(h => h.startsWith(name + '.v') && versionOf(h) !== null).sort((a, b) => versionOf(b) - versionOf(a));
      if (!main && versions.length) main = versions[0];
      if (main || names.has('storyboard.json')) films.push({ id: d, name, kind: 'folder', dir: d, html: main ? posix(path.join(d, main)) : null, versions: versions.map(v => posix(path.join(d, v))),
        review: posix(path.join(d, 'review.json')), snapDir: posix(path.join(d, 'review')), renderDir: posix(path.join(d, 'render')),
        storyboard: posix(path.join(d, 'storyboard.json')) });
      return;                                                   // never look for films inside a film
    }
    const groups = new Map();                                   // single-file films in this folder, grouped by name
    for (const h of htmls) { const base = h.replace(/\.v\d+\.html$|\.html$/, ''); if (!groups.has(base)) groups.set(base, []); groups.get(base).push(h); }
    for (const [base, files] of groups) {
      const main = files.includes(base + '.html') ? base + '.html' : files.filter(f => versionOf(f) !== null).sort((a, b) => versionOf(b) - versionOf(a))[0];
      if (!main || !await isFilmHtml(path.join(dir, main))) continue;
      const vs = files.filter(f => f !== main && versionOf(f) !== null).sort((a, b) => versionOf(b) - versionOf(a));
      films.push({ id: posix(path.join(d, base)), name: base, kind: 'file', dir: d, html: posix(path.join(d, main)), versions: vs.map(v => posix(path.join(d, v))),
        review: posix(path.join(d, base + '.review.json')), snapDir: posix(path.join(d, base + '.review')), renderDir: posix(path.join(d, 'render')) });
    }
    if (depth < 4) for (const e of ents) if (e.isDirectory() && !e.name.startsWith('.') && !SKIP.has(e.name) && !/^v\d+$/.test(e.name)) await walk(path.join(dir, e.name), depth + 1);
  }
  await walk(ROOT, 0);
  for (const f of films) await describe(f);
  films.sort((a, b) => Math.max(b.mtime, b.sbTime || 0) - Math.max(a.mtime, a.sbTime || 0));   // the film worked on last first (a fresh storyboard too)
  return films;
}
let FILMS = [];
async function filmById(id) {
  let f = FILMS.find(x => x.id === id);
  if (!f) { FILMS = await scan(); f = FILMS.find(x => x.id === id); }
  if (!f) throw Object.assign(new Error('no such film: ' + id), { code: 404 });
  return f;
}
// a file of this film the client may view: the main file or one of its versions (never an arbitrary path)
const filmFile = (film, file) => (!file || file === film.html || film.versions.includes(file)) ? (file || film.html) : film.html;
const needBuild = film => { if (!film.html) throw Object.assign(new Error('this film has no build yet (only its storyboard)'), { code: 409 }); };

/* ---------- review.json: the comments pinned on the film, and Claude's answers ---------- */
const locks = new Map();                                        // one read-modify-write at a time per film
function locked(id, fn) { const p = (locks.get(id) || Promise.resolve()).then(fn, fn); locks.set(id, p.catch(() => {})); return p; }
async function readReview(film) {
  try { const r = JSON.parse(await fsp.readFile(path.join(ROOT, film.review), 'utf8')); r.pins = Array.isArray(r.pins) ? r.pins : []; return r; }
  catch (e) { return { film: film.name, html: film.html, about: 'Review comments from Promptfilm Studio. Claude: read every open pin (time t in playback seconds, x/y = position as a fraction of the frame, snap = what the requester saw), fix it, then set status "done", reply (short, in the requester\'s language) and resolvedIn.', pins: [] }; }
}
async function writeReview(film, r) {
  r.updated = new Date().toISOString();
  const abs = path.join(ROOT, film.review), tmp = abs + '.tmp';
  await fsp.mkdir(path.dirname(abs), { recursive: true });
  await fsp.writeFile(tmp, JSON.stringify(r, null, 2) + '\n'); await fsp.rename(tmp, abs);
}
const PIN_FIELDS = ['text', 'status', 't', 'x', 'y', 'reply'];
async function reviewOp(film, body) {
  return locked(film.id, async () => {
    const r = await readReview(film);
    if (body.op === 'add') {
      const n = r.pins.reduce((m, p) => Math.max(m, +String(p.id).replace(/\D/g, '') || 0), 0) + 1;
      const pin = { id: 'p' + n, t: +(+body.t).toFixed(3), x: body.x == null ? null : +(+body.x).toFixed(4), y: body.y == null ? null : +(+body.y).toFixed(4),
        text: String(body.text || '').slice(0, 4000), status: 'open', author: 'requester', created: new Date().toISOString(), context: body.context || {} };
      r.pins.push(pin); await writeReview(film, r);
      snapPin(film, pin, body.file).catch(e => console.error('snapshot failed:', e.message));
      return r;
    }
    const pin = r.pins.find(p => p.id === body.id);
    if (!pin) throw Object.assign(new Error('no such pin'), { code: 404 });
    if (body.op === 'update') { for (const k of PIN_FIELDS) if (k in (body.patch || {})) pin[k] = body.patch[k]; pin.edited = new Date().toISOString(); }
    else if (body.op === 'delete') { r.pins = r.pins.filter(p => p !== pin); if (pin.snap) fsp.unlink(path.join(ROOT, pin.snap)).catch(() => {}); }
    else throw Object.assign(new Error('unknown op'), { code: 400 });
    await writeReview(film, r); return r;
  });
}

/* ---------- headless snapshots of a pinned moment (what the requester saw, for Claude) ----------
   A headless Chrome runs only while there are snapshots to make: one page (the film last pinned), closed with the browser after
   SNAP_IDLE of nothing to do. The page draws only when asked (external drawing), and a snapshot draws just its own moment. */
let RENDER_MOD = null;
const renderMod = async () => RENDER_MOD || (RENDER_MOD = await import('../scripts/render.mjs'));
const commonMod = () => import('../scripts/common.mjs');
const SNAP = { browser: null, page: null, file: null, mtime: 0, chain: Promise.resolve(), idle: null };
const SNAP_IDLE = +process.env.PF_SNAP_IDLE || 60000;
async function snapPage(file) {
  clearTimeout(SNAP.idle);
  const abs = path.join(ROOT, file), mtime = (await fsp.stat(abs)).mtimeMs;
  if (SNAP.page && SNAP.file === file && SNAP.mtime === mtime && SNAP.browser && SNAP.browser.isConnected()) return SNAP.page;
  if (SNAP.page) { await SNAP.page.close().catch(() => {}); SNAP.page = null; }
  const { launch, SIZES } = await commonMod();
  if (!SNAP.browser || !SNAP.browser.isConnected()) SNAP.browser = await launch();
  const page = await SNAP.browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 1 });
  await page.goto(`http://127.0.0.1:${PORT}/f/${file.split('/').map(encodeURIComponent).join('/')}?freeze`);
  await page.waitForFunction(() => window.__started || (document.getElementById('err') && !document.getElementById('err').hidden), null, { timeout: 180000 });
  const aspect = await page.evaluate(() => (window.__bw && window.__bw.FORMAT && window.__bw.FORMAT.aspect) || '9x16');
  await page.addStyleTag({ content: '#frame, #frame * { will-change: auto !important; }' });
  const [w, h] = SIZES[aspect] || SIZES['9x16'];
  await page.setViewportSize({ width: w, height: h }); await page.waitForTimeout(150);
  // the film stops drawing by itself: external drawing, or — a film made before it, whose seek() draws — its own loop held
  await page.evaluate(() => { const b = window.__bw; if (typeof b.external === 'function') b.external(true); if (/render/i.test(String(b.seek))) window.requestAnimationFrame = () => 0; });
  Object.assign(SNAP, { page, file, mtime });
  return page;
}
function snapIdle() {                                            // nothing to do for a while: close the browser (queued after any work)
  clearTimeout(SNAP.idle);
  SNAP.idle = setTimeout(() => { SNAP.chain = SNAP.chain.then(async () => {
    const b = SNAP.browser; Object.assign(SNAP, { browser: null, page: null, file: null, mtime: 0 });
    if (b) await b.close().catch(() => {});
  }); }, SNAP_IDLE);
  SNAP.idle.unref();
}
function snapPin(film, pin, file) {
  const f = filmFile(film, file), out = posix(path.join(film.snapDir, pin.id + '.png'));
  SNAP.chain = SNAP.chain.then(async () => {
    const page = await snapPage(f);
    await fsp.mkdir(path.join(ROOT, film.snapDir), { recursive: true });
    await page.evaluate(async ({ t, x, y, n }) => {
      // this moment's text may need font subsets not loaded yet (Korean comes in many small ones): lay it out, wait for them, draw again
      window.__bw.seek(t); void document.body.offsetHeight;
      if (document.fonts) await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 8000))]);
      window.__bw.seek(t);
      if (x == null || y == null) return;
      const m = document.createElement('div'); m.id = '__pf_pin';
      m.style.cssText = `position:absolute;left:${x * 100}%;top:${y * 100}%;width:0;height:0;z-index:9999;pointer-events:none`;
      m.innerHTML = '<div style="position:absolute;left:-21px;top:-21px;width:36px;height:36px;border:3px solid #ff3b3b;border-radius:50%;box-shadow:0 0 0 2px rgba(0,0,0,.65),inset 0 0 0 2px rgba(0,0,0,.35)"></div>' +
        `<div style="position:absolute;left:20px;top:-32px;padding:2px 7px;background:#ff3b3b;color:#fff;font:600 13px/1.3 system-ui,sans-serif;border-radius:3px;white-space:nowrap">#${n}</div>`;
      document.getElementById('frame').appendChild(m);
    }, { t: pin.t, x: pin.x, y: pin.y, n: String(pin.id).replace(/\D/g, '') });
    await page.screenshot({ path: path.join(ROOT, out) });
    await page.evaluate(() => { const m = document.getElementById('__pf_pin'); if (m) m.remove(); });
    await locked(film.id, async () => { const r = await readReview(film); const p = r.pins.find(q => q.id === pin.id); if (p) { p.snap = out; p.snapFile = f; await writeReview(film, r); } });
  }).catch(e => console.error('snapshot failed:', e.message)).finally(snapIdle);
  return SNAP.chain;
}

/* ---------- storyboard frames: each card's moment in the current build, as the film really shows it ----------
   Made only while someone looks at a built film's storyboard, one headless frame per card (like a snapshot), kept in
   <review>/storyboard/ with the build and storyboard they were made from, and made again only when either changes. */
const SBF = new Map();                                          // film id → { stamp, frames: { sceneId: { file, t } }, running, again }
// a scene's moment: its "at" (playback s) when the build reaches it; else its place in the planned seconds — but only when the build
// is about as long as planned: an early build (a few scenes, a short loop) would put every card on the same few seconds
function sbTimes(sb, loop) {
  const sc = sb.scenes || [], total = sc.reduce((a, x) => a + Math.max(0, +x.seconds || 0), 0) || 1, whole = loop >= total * 0.8, out = {}; let acc = 0;
  for (const x of sc) {
    const sec = Math.max(0, +x.seconds || 0), at = x.at === '' || x.at == null ? NaN : +x.at;
    if (isFinite(at) && at >= 0 && at < loop) out[x.id] = at;
    else if (whole && !isFinite(at)) out[x.id] = Math.max(0, Math.min(loop - 0.02, loop * (acc + sec * 0.6) / total));
    acc += sec;
  }
  return out;
}
async function sbFrames(film) {
  if (!film.html || !film.sbTime) return { stamp: null, frames: {}, running: false };
  const dir = posix(path.join(film.snapDir, 'storyboard')), build = (await fsp.stat(path.join(ROOT, film.html))).mtimeMs;
  const stamp = `${Math.round(build)}-${Math.round(film.sbTime)}`;
  let st = SBF.get(film.id);
  if (!st) { st = { stamp: null, frames: {}, running: false, again: false }; SBF.set(film.id, st);
    try { const j = JSON.parse(await fsp.readFile(path.join(ROOT, dir, 'index.json'), 'utf8')); st.stamp = j.stamp; st.frames = j.frames || {}; } catch (e) {} }
  if (st.stamp === stamp) return st;
  if (st.running) { st.again = true; return st; }
  st.running = true;
  SNAP.chain = SNAP.chain.then(async () => {
    const sb = await readStoryboard(film), page = await snapPage(film.html);
    const times = sbTimes(sb, await page.evaluate(() => window.__bw.LOOP)), frames = {};
    await fsp.mkdir(path.join(ROOT, dir), { recursive: true });
    for (const x of sb.scenes || []) {
      if (!(x.id in times)) continue;                              // not in this build yet: the card keeps its look frame or photo
      const t = times[x.id], out = posix(path.join(dir, String(x.id).replace(/[^\w-]/g, '_') + '.jpg'));
      await page.evaluate(async t => { window.__bw.seek(t); void document.body.offsetHeight;
        if (document.fonts) await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 8000))]); window.__bw.seek(t); }, t);
      await page.screenshot({ path: path.join(ROOT, out), type: 'jpeg', quality: 84 });
      frames[x.id] = { file: out, t: +t.toFixed(2) };
      broadcast('sbframe', { stamp, id: x.id, ...frames[x.id] }, film.id);
    }
    Object.assign(st, { stamp, frames });
    const keep = new Set(Object.values(frames).map(f => path.basename(f.file)));      // frames of scenes this build no longer shows go
    for (const f of await fsp.readdir(path.join(ROOT, dir))) if (f.endsWith('.jpg') && !keep.has(f)) await fsp.unlink(path.join(ROOT, dir, f)).catch(() => {});
    await fsp.writeFile(path.join(ROOT, dir, 'index.json'), JSON.stringify({ stamp, frames }, null, 1) + '\n');
    broadcast('sbframes', { stamp }, film.id);
  }).catch(e => console.error('storyboard frames failed:', e.message)).finally(() => {
    st.running = false; snapIdle();
    if (st.again) { st.again = false; describe(film).then(sbFrames).catch(() => {}); }
  });
  return st;
}

/* ---------- live updates (server-sent events) ---------- */
const CLIENTS = new Set();                                      // { res, id } — id null: a page with no film open yet
function send(res, event, data) { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); }
function broadcast(event, data, id) { for (const c of CLIENTS) if (!id || c.id === id) send(c.res, event, data); }
// a file changed: the system's file events on its folder (one watcher per folder, shared), settled for 150 ms and confirmed by its
// mtime; where those events aren't available, a stat every 2 s
const FOLDERS = new Map();                                      // abs dir → { subs: Map(name → Set(fn)), last: Map(name → mtime), timers, w, poll }
function watch(abs, onChange) {
  const dir = path.dirname(abs), name = path.basename(abs);
  let d = FOLDERS.get(dir);
  if (!d) {
    d = { subs: new Map(), last: new Map(), timers: new Map(), w: null, poll: null };
    const fire = async n => { const set = d.subs.get(n); if (!set) return; const st = await exists(path.join(dir, n)), m = st ? st.mtimeMs : 0;
      if (m === d.last.get(n)) return; d.last.set(n, m); if (st) for (const fn of set) fn(st); };
    d.kick = n => { clearTimeout(d.timers.get(n)); d.timers.set(n, setTimeout(() => fire(n), 150)); };
    const poll = () => { if (d.w) { try { d.w.close(); } catch (e) {} d.w = null; } if (!d.poll) d.poll = setInterval(() => { for (const n of d.subs.keys()) fire(n); }, 2000); };
    try { d.w = fs.watch(dir, { persistent: false }, (ev, n) => { if (n != null && d.subs.has(String(n))) d.kick(String(n)); else if (n == null) for (const k of d.subs.keys()) d.kick(k); });
      d.w.on('error', poll); }
    catch (e) { poll(); }
    FOLDERS.set(dir, d);
  }
  if (!d.subs.has(name)) { d.subs.set(name, new Set()); try { d.last.set(name, fs.statSync(abs).mtimeMs); } catch (e) { d.last.set(name, 0); } }
  d.subs.get(name).add(onChange);
  return () => {
    const set = d.subs.get(name); if (!set) return; set.delete(onChange);
    if (!set.size) { d.subs.delete(name); d.last.delete(name); clearTimeout(d.timers.get(name)); d.timers.delete(name); }
    if (!d.subs.size) { if (d.w) try { d.w.close(); } catch (e) {} clearInterval(d.poll); FOLDERS.delete(dir); }
  };
}

/* ---------- rendering (one job at a time) ---------- */
let JOB = null;
const pub = j => j && ({ id: j.id, film: j.film, file: j.file, quality: j.quality, text: j.text, status: j.status, frame: j.frame, total: j.total,
  elapsed: j.elapsed, out: j.out, srt: j.srt, error: j.error, workers: j.workers, seconds: j.seconds, started: j.started });
const stampNow = () => { const d = new Date(), p = n => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
async function startRender(film, body) {
  if (JOB && JOB.status === 'running') throw Object.assign(new Error('a render is already running'), { code: 409 });
  const file = filmFile(film, body.file), draft = body.quality === 'draft', text = body.text !== false, loops = Math.max(1, Math.min(4, +body.loops || 1));
  // the requester may export any build (their call); a final video of a build that has not passed its checks says so in its name
  let unchecked = false; if (!draft) { try { unchecked = !gateStatus(path.join(ROOT, file)).ok; } catch (e) { unchecked = true; } }
  const out = path.join(ROOT, film.renderDir, `${film.name}_${stampNow()}${draft ? '_draft' : ''}${text ? '' : '_notext'}${unchecked ? '_unchecked' : ''}.mp4`);
  const ac = new AbortController();
  JOB = { id: stampNow(), film: film.id, file, quality: draft ? 'draft' : 'final', text, status: 'running', frame: 0, total: 0, elapsed: 0, started: Date.now(), abort: ac };
  const job = JOB; let last = 0;
  broadcast('render', pub(job));
  (async () => {
    try {
      const { render } = await renderMod();
      const r = await render({ url: `http://127.0.0.1:${PORT}/f/${file.split('/').map(encodeURIComponent).join('/')}`, out, draft, text, loops, srt: false, signal: ac.signal,   // the MP4 only
        onProgress: ({ frame, total, elapsed }) => { job.frame = frame; job.total = total; job.elapsed = elapsed;
          if (Date.now() - last > 250 || frame === total) { last = Date.now(); broadcast('render', pub(job)); } } });
      Object.assign(job, { status: 'done', out: rel(r.out), srt: r.srt ? rel(r.srt) : null, workers: r.workers, seconds: r.seconds, elapsed: r.renderSeconds });
    } catch (e) { Object.assign(job, { status: /cancelled/.test(e.message) ? 'cancelled' : 'error', error: e.message }); }
    broadcast('render', pub(job));
  })();
  return pub(job);
}

/* ---------- pace edits: the requester's speed edits → parts/p8z_pace.js (PACE_EDITS) → rebuild ---------- */
const PACE_FILE = 'p8z_pace.js', KINDS = ['hook', 'key', 'normal', 'transit', 'return'];
async function paceInfo(film) {
  if (film.kind !== 'folder') return { supported: false, why: 'file' };
  const parts = path.join(ROOT, film.dir, 'parts');
  let eng = ''; try { eng = await fsp.readFile(path.join(parts, 'p9_engine.js'), 'utf8'); } catch (e) { return { supported: false, why: 'parts' }; }
  if (!eng.includes('paceApply')) return { supported: false, why: 'engine' };
  let edits = {};
  try { const m = /const PACE_EDITS = (\{[\s\S]*\});/.exec(await fsp.readFile(path.join(parts, PACE_FILE), 'utf8')); if (m) edits = JSON.parse(m[1]); } catch (e) {}
  return { supported: true, edits };
}
function cleanEdits(raw) {
  const out = {};
  for (const [k, v] of Object.entries(raw && typeof raw === 'object' ? raw : {})) {
    if (typeof k !== 'string' || k.length > 200 || !v || typeof v !== 'object') continue;
    const e = {};
    if (KINDS.includes(v.kind)) e.kind = v.kind;
    if (isFinite(+v.speed) && +v.speed > 0) e.speed = Math.round(Math.min(16, Math.max(0.25, +v.speed)) * 1000) / 1000;
    if (Object.keys(e).length) out[k] = e;
  }
  return out;
}
async function buildFilm(film) {                                // the node build (same as build.sh); a film with its own build.sh uses that
  const dir = path.join(ROOT, film.dir);
  let sh = ''; try { sh = await fsp.readFile(path.join(dir, 'build.sh'), 'utf8'); } catch (e) {}
  const standard = !sh || sh.includes("Assemble a film's parts into one HTML file");
  if (standard) { const { build } = await import('../engine/build.mjs'); return build(dir, film.name); }
  if (process.platform === 'win32') throw new Error('this film has its own build.sh — rebuild it from a shell');
  await new Promise((res, rej) => execFile('sh', ['build.sh'], { cwd: dir }, (e, out, err) => e ? rej(new Error((err || out || e.message).trim().slice(-400))) : res()));
  return { out: path.join(ROOT, film.html) };
}
async function savePace(film, raw) {
  return locked(film.id + ':pace', async () => {
    const info = await paceInfo(film); if (!info.supported) throw Object.assign(new Error('pace editing needs a film made with the current engine'), { code: 400 });
    const edits = cleanEdits(raw), abs = path.join(ROOT, film.dir, 'parts', PACE_FILE);
    const before = await fsp.readFile(abs, 'utf8').catch(() => null);
    if (Object.keys(edits).length) await fsp.writeFile(abs, `/* PACE EDITS — the requester's speed edits from Promptfilm Studio (${new Date().toISOString()}). Keep this file: the
   engine applies it after p8's beats. Keys are beat names ('Name#2' = the second beat with that name); speed = playback speed
   (authored seconds per played second), kind = the beat's class. When you rename or restructure beats, carry these over. */
const PACE_EDITS = ${JSON.stringify(edits, null, 2)};
`);
    else await fsp.unlink(abs).catch(() => {});
    try { await buildFilm(film); }
    catch (e) { if (before === null) await fsp.unlink(abs).catch(() => {}); else await fsp.writeFile(abs, before); throw Object.assign(new Error('build failed: ' + e.message), { code: 500 }); }
    const st = await fsp.stat(path.join(ROOT, film.html));
    return { edits, mtime: st.mtimeMs };
  });
}

/* ---------- storyboard.json: Claude's plan as scene cards (before the build) and the requester's review of it ---------- */
async function readStoryboard(film) {
  if (!film.storyboard) throw Object.assign(new Error('no storyboard'), { code: 404 });
  try { return JSON.parse(await fsp.readFile(path.join(ROOT, film.storyboard), 'utf8')); }
  catch (e) { throw Object.assign(new Error(e.code === 'ENOENT' ? 'no storyboard yet' : 'storyboard.json is not valid JSON: ' + e.message), { code: e.code === 'ENOENT' ? 404 : 500 }); }
}
async function storyboardOp(film, body) {
  const res = await locked(film.id + ':sb', async () => {
    const sb = await readStoryboard(film), r = sb.review = sb.review || {};
    r.scenes = r.scenes || {};
    const now = new Date().toISOString();
    if (body.op === 'scene') {
      if (!(sb.scenes || []).some(x => x.id === body.id)) throw Object.assign(new Error('no such scene'), { code: 404 });
      if (!body.status) delete r.scenes[body.id];
      else r.scenes[body.id] = { status: body.status === 'change' ? 'change' : 'ok', note: String(body.note || '').slice(0, 2000), at: now, version: sb.version || 1 };
    } else if (body.op === 'note') r.note = String(body.note || '').slice(0, 4000);
    else if (body.op === 'answer') { r.answers = r.answers || {}; r.answers[String(body.i)] = { q: String((sb.open || [])[+body.i] || ''), a: String(body.text || '').slice(0, 2000) }; }
    else if (body.op === 'send') { r.sent = now; r.approved = body.approve ? now : null; if (body.note != null) r.note = String(body.note).slice(0, 4000); }
    else throw Object.assign(new Error('unknown op'), { code: 400 });
    r.updated = now;
    const abs = path.join(ROOT, film.storyboard), tmp = abs + '.tmp';
    await fsp.writeFile(tmp, JSON.stringify(sb, null, 2) + '\n'); await fsp.rename(tmp, abs);
    return sb;
  });
  if (body.op === 'send') { const d = await ask(film, { kind: 'storyboard', note: res.review.note }); return { storyboard: res, delivered: d.delivered }; }
  return { storyboard: res };
}

/* ---------- Claude: the requester's "Send to Claude" reaches the Claude Code session working on that film ----------
   Each session waits on /api/await (studio/await.mjs) for its own film. A request goes to the session waiting on exactly that film;
   a session waiting on any film ('*', an older watcher) gets it only while no session has claimed the film by name — so with two
   sessions on two films, one film's request can never reach the other session. */
const CLAUDE = { waiters: new Set(), active: new Map(), seen: new Map(), owners: new Map() };   // active: film → { kind, pins, at } delivered, not re-armed
const OWNED_FOR = 6 * 3600e3, sleep = ms => new Promise(r => setTimeout(r, ms));
const owned = id => Date.now() - (CLAUDE.owners.get(id) || 0) < OWNED_FOR;
const waiterFor = id => { const ws = [...CLAUDE.waiters]; return ws.find(w => w.film === id) || (owned(id) ? null : ws.find(w => w.film === '*')) || null; };
const seenLately = (id, ms) => Date.now() - (CLAUDE.seen.get(id) || 0) < ms || (!owned(id) && Date.now() - (CLAUDE.seen.get('*') || 0) < ms);
const activeFor = id => { const a = CLAUDE.active.get(id); return a && Date.now() - a.at < 3600e3 ? a : null; };
function claudeState(id) {
  const a = id ? activeFor(id) : null;
  const listening = id ? (waiterFor(id) || seenLately(id, 6000) ? 1 : 0) : CLAUDE.waiters.size;
  return { listening, active: a && { film: id, kind: a.kind, pins: a.pins, since: a.at } };
}
function claudeChanged() { for (const c of CLIENTS) send(c.res, 'claude', claudeState(c.id)); }
function awaitRequest(req, res, film) {
  const now = Date.now(); CLAUDE.seen.set(film, now);
  if (film !== '*') { CLAUDE.owners.set(film, now); CLAUDE.active.delete(film); }       // the film's session re-arms: its last request is done
  else if (CLAUDE.active.size) for (const [id] of CLAUDE.active) if (!owned(id)) CLAUDE.active.delete(id);
  const w = { res, film, timer: null };
  w.timer = setTimeout(() => { if (CLAUDE.waiters.delete(w)) { CLAUDE.seen.set(film, Date.now()); res.writeHead(204); res.end(); } }, 240000);
  CLAUDE.waiters.add(w);
  req.on('close', () => { if (CLAUDE.waiters.delete(w)) { clearTimeout(w.timer); CLAUDE.seen.set(film, Date.now()); if (film !== '*') CLAUDE.owners.set(film, Date.now()); setTimeout(claudeChanged, 6500); claudeChanged(); } });
  claudeChanged();
}
async function ask(film, body) {
  if (activeFor(film.id) && !waiterFor(film.id)) return { delivered: false, busy: true };   // already delivered: that session is on it
  let w = waiterFor(film.id);
  for (let i = 0; !w && i < 40 && seenLately(film.id, 10000); i++) { await sleep(200); w = waiterFor(film.id); }   // re-arming between two polls
  if (!w) return { delivered: false };
  await Promise.race([SNAP.chain, sleep(20000)]);                 // the snapshots of fresh comments first
  w = waiterFor(film.id);
  if (!w) return { delivered: false };
  const r = await readReview(film), pace = await paceInfo(film).catch(() => ({}));
  const request = { id: stampNow(), kind: body.kind === 'storyboard' ? 'storyboard' : 'review', root: ROOT, film: film.id, name: film.name, dir: film.dir, html: film.html, review: film.review,
    note: String(body.note || '').slice(0, 2000), at: new Date().toISOString(), pace: pace.edits || {},
    pins: body.kind === 'storyboard' ? [] : r.pins.filter(p => p.status !== 'done').map(p => ({ id: p.id, t: p.t, x: p.x, y: p.y, text: p.text, snap: p.snap || null, context: p.context || {} })) };
  if (request.kind === 'storyboard') {
    const sb = await readStoryboard(film), rv = sb.review || {};
    request.storyboard = { file: film.storyboard, version: sb.version || 1, approved: !!rv.approved, answers: rv.answers || {}, open: sb.open || [],
      scenes: (sb.scenes || []).map(x => ({ id: x.id, name: x.name, ...(rv.scenes && rv.scenes[x.id] ? { status: rv.scenes[x.id].status, note: rv.scenes[x.id].note } : {}) })) };
  }
  CLAUDE.waiters.delete(w); clearTimeout(w.timer); CLAUDE.seen.set(w.film, Date.now());
  try { json(w.res, 200, request); } catch (e) { return { delivered: false }; }
  CLAUDE.active.set(film.id, { kind: request.kind, pins: request.pins.length, at: Date.now() });
  claudeChanged();
  return { delivered: true, pins: request.pins.length };
}

/* ---------- opening the page: in the browser, unless a Studio page is open — then that page switches to the film ---------- */
const pageUrl = film => `http://127.0.0.1:${PORT}/` + (film ? '#film=' + encodeURIComponent(film) : '');
function openBrowser(url) {
  const [cmd, args] = process.platform === 'darwin' ? ['open', [url]] : process.platform === 'win32' ? ['explorer', [url]] : ['xdg-open', [url]];
  execFile(cmd, args, () => {});
}
async function openPage(film, view) {
  if (film) film = (await filmById(film)).id;
  view = view === 'board' || view === 'film' ? view : null;
  const url = pageUrl(film) + (film && view ? '&view=' + view : '');
  if (CLIENTS.size) { broadcast('goto', { film, view }); return { opened: false, pages: CLIENTS.size, url }; }
  openBrowser(url); return { opened: true, pages: 0, url };
}

/* ---------- http ---------- */
async function body(req) { let s = ''; for await (const c of req) { s += c; if (s.length > 1e6) throw Object.assign(new Error('too large'), { code: 413 }); } return s ? JSON.parse(s) : {}; }
function json(res, code, data) { res.writeHead(code, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' }); res.end(JSON.stringify(data)); }
async function sendFile(req, res, abs) {
  const st = await exists(abs);
  if (!st || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
  const type = MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream';
  const head = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': /\.(html|json|srt|mp4|png)$/i.test(abs) ? 'no-store' : 'no-cache' };
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m) {
    const start = m[1] ? +m[1] : Math.max(0, st.size - +m[2]), end = m[1] && m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1;
    if (start > end || start >= st.size) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end(); }
    res.writeHead(206, { ...head, 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 });
    return fs.createReadStream(abs, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...head, 'Content-Length': st.size });
  fs.createReadStream(abs).pipe(res);
}
function underRoot(relPath) {
  const parts = relPath.split('/').filter(Boolean);
  if (parts.some(p => p === '..' || (p.startsWith('.') && p !== '.promptfilm'))) return null;
  const abs = path.resolve(ROOT, ...parts);
  return abs === ROOT || abs.startsWith(ROOT + path.sep) ? abs : null;
}

// the page's code as served now: a page that was loaded from other code reloads itself when it reconnects (after an update)
const uiVersion = () => VERSION + ':' + ['index.html', 'studio.js', 'studio.css'].map(f => { try { return Math.round(fs.statSync(path.join(UI, f)).mtimeMs); } catch (e) { return 0; } }).join('.');
for (const f of ['index.html', 'studio.js', 'studio.css']) watch(path.join(UI, f), () => broadcast('ui', { ui: uiVersion() }));   // the page's code changed (the skill was updated)

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://127.0.0.1'), p = decodeURIComponent(u.pathname), q = u.searchParams;
  try {
    if (req.headers.host && !/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host)) { res.writeHead(403); return res.end(); }   // no DNS rebinding
    // a page of another site can't reach the API, not even with a GET that only starts work (browsers name the caller in
    // Sec-Fetch-Site; this page is same-origin, the scripts send none)
    if (p.startsWith('/api/') && /^(cross-site|same-site)$/.test(req.headers['sec-fetch-site'] || '')) { res.writeHead(403); return res.end(); }
    // only this page may change things: a POST must be JSON (a cross-site form can't send that without a preflight we never answer)
    // and, when the browser names its origin, come from this server
    if (req.method === 'POST' && (!/^application\/json/.test(req.headers['content-type'] || '') ||
        (req.headers.origin && !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(req.headers.origin)))) { res.writeHead(403); return res.end('forbidden'); }
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');                    // other sites can't embed or read these files
    if (req.method === 'GET' && (p === '/' || p === '/index.html')) return sendFile(req, res, path.join(UI, 'index.html'));
    if (req.method === 'GET' && p.startsWith('/ui/')) { const abs = path.resolve(UI, p.slice(4)); if (!abs.startsWith(UI + path.sep)) { res.writeHead(403); return res.end(); } return sendFile(req, res, abs); }
    if (req.method === 'GET' && p.startsWith('/f/')) { const abs = underRoot(p.slice(3)); if (!abs) { res.writeHead(403); return res.end(); } return sendFile(req, res, abs); }

    if (p === '/api/films') { FILMS = await scan(); return json(res, 200, { root: ROOT, rootName: path.basename(ROOT), films: FILMS, job: pub(JOB) }); }
    if (p === '/api/film') return json(res, 200, await describe(await filmById(q.get('id'))));
    if (p === '/api/review' && req.method === 'GET') return json(res, 200, await readReview(await filmById(q.get('id'))));
    if (p === '/api/review' && req.method === 'POST') return json(res, 200, await reviewOp(await filmById(q.get('id')), await body(req)));
    if (p === '/api/storyboard' && req.method === 'GET') { const film = await filmById(q.get('id')), st = await exists(path.join(ROOT, film.storyboard || ''));
      return json(res, 200, { mtime: st ? st.mtimeMs : 0, storyboard: await readStoryboard(film) }); }
    if (p === '/api/sbframes') { const film = await describe(await filmById(q.get('id'))), st = await sbFrames(film); return json(res, 200, { stamp: st.stamp, frames: st.frames, running: st.running }); }
    if (p === '/api/storyboard' && req.method === 'POST') return json(res, 200, await storyboardOp(await filmById(q.get('id')), await body(req)));
    if (p === '/api/pace' && req.method === 'GET') return json(res, 200, await paceInfo(await filmById(q.get('id'))));
    if (p === '/api/pace' && req.method === 'POST') return json(res, 200, await savePace(await filmById(q.get('id')), (await body(req)).edits));
    if (p === '/api/await') {                                   // only studio/await.mjs: a web page can't send this header without a preflight
      if (req.headers['x-promptfilm'] !== 'await') { res.writeHead(403); return res.end(); }
      const f = q.get('film') || '*'; if (f !== '*') await filmById(f); return awaitRequest(req, res, f);
    }
    if (p === '/api/ask' && req.method === 'POST') return json(res, 200, await ask(await filmById(q.get('id')), await body(req)));
    if (p === '/api/claude') return json(res, 200, claudeState(q.get('id')));
    if (p === '/api/studio') return json(res, 200, { studio: 'promptfilm', version: VERSION, root: ROOT, port: PORT, pid: process.pid, pages: CLIENTS.size,
      waiting: [...CLAUDE.waiters].map(w => w.film), snapshotBrowser: !!SNAP.browser });
    if (p === '/api/open') {                                    // open the page, or switch the open one (server.mjs run again; a page can't send this header)
      if (req.headers['x-promptfilm'] !== 'open') { res.writeHead(403); return res.end(); }
      return json(res, 200, await openPage(q.get('film'), q.get('view')));
    }
    if (p === '/api/render' && req.method === 'POST') { const rf = await filmById(q.get('id')); needBuild(rf); return json(res, 200, await startRender(rf, await body(req))); }
    if (p === '/api/render' && req.method === 'GET') return json(res, 200, pub(JOB));
    if (p === '/api/render/cancel' && req.method === 'POST') { if (JOB && JOB.status === 'running') JOB.abort.abort(); return json(res, 200, pub(JOB)); }
    if (p === '/api/still' && req.method === 'POST') {
      const film = await filmById(q.get('id')), b = await body(req), t = Math.max(0, +b.t || 0); needBuild(film);
      const { still } = await renderMod(), file = filmFile(film, b.file);
      const out = path.join(ROOT, film.renderDir, `${film.name}_t${t.toFixed(2)}${b.text === false ? '_notext' : ''}.png`);
      const r = await still({ url: `http://127.0.0.1:${PORT}/f/${file.split('/').map(encodeURIComponent).join('/')}`, out, t, text: b.text !== false });
      return json(res, 200, { out: rel(r.out), size: r.size });
    }
    if (p === '/api/reveal' && req.method === 'POST') {
      const abs = underRoot(String((await body(req)).path || '')); if (!abs) return json(res, 403, { error: 'outside root' });
      const [cmd, args] = process.platform === 'darwin' ? ['open', ['-R', abs]] : process.platform === 'win32' ? ['explorer', ['/select,' + abs]] : ['xdg-open', [path.dirname(abs)]];
      execFile(cmd, args, () => {}); return json(res, 200, { ok: true });
    }
    if (p === '/api/events') {                                  // one page's live updates: its film's files, renders, Claude, "open this film"
      const film = q.get('id') ? await filmById(q.get('id')) : null, file = film ? filmFile(film, q.get('file')) : null;
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write('retry: 1000\n\n');                            // a page reconnects within a second when the server restarts
      const client = { res, id: film ? film.id : null }; CLIENTS.add(client);
      const stops = !film ? [] : [
        watch(path.join(ROOT, file || film.dir + '/' + film.name + '.html'), s => send(res, 'html', { file, mtime: s.mtimeMs, first: !file })),
        ...(film.storyboard ? [watch(path.join(ROOT, film.storyboard), s => send(res, 'storyboard', { mtime: s.mtimeMs }))] : []),
        watch(path.join(ROOT, film.review), () => send(res, 'review', {})),
        // the export card's gate line follows QA and the visual review as they are written
        ...['qa-report.json', 'visual-review.md'].map(f => watch(path.join(ROOT, film.dir || path.dirname(film.html || ''), 'qa', f), () => send(res, 'gate', {}))),
      ];
      send(res, 'hello', { film: film && film.id, file, job: pub(JOB), claude: claudeState(film && film.id), ui: uiVersion() });
      const ping = setInterval(() => res.write(': ping\n\n'), 20000);
      req.on('close', () => { clearInterval(ping); CLIENTS.delete(client); stops.forEach(s => s()); });
      return;
    }
    res.writeHead(404); res.end('not found');
  } catch (e) {
    if (!res.headersSent) json(res, e.code >= 400 && e.code < 600 ? e.code : 500, { error: e.message });
    else res.end();
  }
});

// Is a Studio already on this port? (null: something else, or nothing)
async function occupant(port) {
  const get = async p => { try { const r = await fetch(`http://127.0.0.1:${port}${p}`, { signal: AbortSignal.timeout(3000) }); return r.ok ? await r.json() : null; } catch (e) { return null; } };
  const s = await get('/api/studio'); if (s && s.studio === 'promptfilm') return s;
  const f = await get('/api/films'); if (f && f.root && Array.isArray(f.films)) return { studio: 'promptfilm', version: null, root: f.root };   // one from before /api/studio
  return null;
}
const freed = async port => { for (let i = 0; i < 50; i++) { if (!await occupant(port)) return true; await new Promise(r => setTimeout(r, 100)); } return false; };
function listen(port) {                                         // one attempt: its 'listening' and 'error' handlers never outlive it
  const onListen = () => { server.off('error', onError); PORT = port; started(port); };
  const onError = async e => {
    server.off('listening', onListen);
    if (e.code !== 'EADDRINUSE') { console.error(e.message); process.exit(1); }
    const o = await occupant(port);
    if (o && o.root === ROOT && o.version === VERSION) {        // this folder's Studio is running already: use it
      const ask = async film => { try { return await (await fetch(`http://127.0.0.1:${port}/api/open?${film ? 'film=' + encodeURIComponent(film) + '&' : ''}view=${VIEW_ARG || ''}`, { headers: { 'X-Promptfilm': 'open' } })).json(); } catch (err) { return null; } };
      let r = OPEN ? await ask(FILM_ARG) : null, note = '';
      if (r && r.error) { note = ' — ' + r.error; r = await ask(null); }
      console.log(`Promptfilm Studio  http://127.0.0.1:${port}/  (already running for ${ROOT}${note}${r ? r.opened ? ' — opened the page' : ' — a Studio page is open: switched it' + (FILM_ARG && !note ? ' to ' + FILM_ARG : '') : ''})`);
      process.exit(0);
    }
    if (o && o.root === ROOT) {                                 // this folder's Studio, from older code: replace it
      let pid = o.pid; if (!pid) try { const j = JSON.parse(fs.readFileSync(path.join(ROOT, '.promptfilm', 'studio.json'), 'utf8')); if (j.port === port) pid = j.pid; } catch (err) {}
      if (pid) { try { process.kill(pid, 'SIGTERM'); } catch (err) {} if (await freed(port)) return listen(port); }
    }
    if (port < PORT0 + 10) listen(port + 1); else { console.error(e.message); process.exit(1); }
  };
  server.once('error', onError); server.once('listening', onListen);
  server.listen(port, '127.0.0.1');
}
async function started(port) {
  try { await fsp.mkdir(path.join(ROOT, '.promptfilm'), { recursive: true });
    await fsp.writeFile(path.join(ROOT, '.promptfilm', 'studio.json'), JSON.stringify({ port, pid: process.pid, root: ROOT, url: pageUrl(), version: VERSION, started: new Date().toISOString() }, null, 2) + '\n'); } catch (e) {}
  FILMS = await scan();
  const url = pageUrl();
  console.log(`Promptfilm Studio  ${url}\n  root   ${ROOT}\n  films  ${FILMS.length ? FILMS.map(f => f.id).join(', ') : '(none yet — films appear here as they are made)'}`);
  // open the page — after a moment, so a page left open from before (it reconnects within a second or three) is used instead
  if (OPEN) setTimeout(() => openPage(FILM_ARG, VIEW_ARG).then(r => console.log(r.opened ? `  opened ${r.url}` : `  a Studio page is open${FILM_ARG ? ' — switched it to ' + FILM_ARG : ''}`),
    e => { console.log(`  ${e.message}`); openBrowser(pageUrl()); }), 3000);
}
listen(PORT0);
const bye = async () => { try { if (SNAP.browser) await SNAP.browser.close(); } catch (e) {} process.exit(0); };
process.on('SIGINT', bye); process.on('SIGTERM', bye);
