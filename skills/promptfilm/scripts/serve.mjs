#!/usr/bin/env node
// A static file server for QA and rendering (a film's module scripts need http://): the folder given, on 127.0.0.1 only.
//   node serve.mjs [root=.] [--port 8765]      keeps running — start it in the background, from a folder above the films
// Running it again for the same folder and port finds the one already running and exits.
import http from 'http';
import fs from 'fs';
import path from 'path';

const argv = process.argv.slice(2), opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const ROOT = path.resolve(argv.find((a, i) => !a.startsWith('--') && argv[i - 1] !== '--port') || '.'), PORT = +opt('port', 8765);
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.hdr': 'image/vnd.radiance',
  '.ktx2': 'image/ktx2', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.srt': 'text/plain; charset=utf-8' };

const server = http.createServer((req, res) => {
  let rel; try { rel = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); } catch (e) { res.writeHead(400); return res.end(); }
  if (rel === '/.promptfilm-serve') { res.writeHead(200, { 'Content-Type': MIME['.json'] }); return res.end(JSON.stringify({ root: ROOT })); }
  let abs = path.resolve(ROOT, '.' + rel);
  if (abs !== ROOT && !abs.startsWith(ROOT + path.sep)) { res.writeHead(403); return res.end(); }
  fs.stat(abs, (e, st) => {
    if (!e && st.isDirectory()) { abs = path.join(abs, 'index.html'); try { st = fs.statSync(abs); } catch (x) { e = x; } }
    if (e || !st.isFile()) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(abs).toLowerCase()] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': 'no-store' });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(abs).pipe(res);
  });
});
server.on('error', async e => {
  if (e.code === 'EADDRINUSE') {
    try { const j = await (await fetch(`http://127.0.0.1:${PORT}/.promptfilm-serve`, { signal: AbortSignal.timeout(3000) })).json();
      if (j.root === ROOT) { console.log(`already serving ${ROOT} at http://127.0.0.1:${PORT}/`); process.exit(0); }
      console.error(`port ${PORT} serves another folder (${j.root}) — pass another --port`); process.exit(1);
    } catch (x) { console.error(`port ${PORT} is taken by another program — pass another --port`); process.exit(1); }
  }
  console.error(e.message); process.exit(1);
});
server.listen(PORT, '127.0.0.1', () => console.log(`serving ${ROOT} at http://127.0.0.1:${PORT}/`));
