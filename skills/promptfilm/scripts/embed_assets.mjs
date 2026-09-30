#!/usr/bin/env node
// Pack files into a film part as data URLs, so the film stays one self-contained HTML file.
//   node embed_assets.mjs <film>/parts/p3_assets.js logo=path/to/logo.png model=path/to/thing.glb photo=path/to/x.jpg
// Writes `const ASSET_LOGO = 'data:image/png;base64,...';` etc. Load them in the film with loadTextureData(ASSET_LOGO) or
// loadGLBData(ASSET_MODEL) (engine p2) and put the promises into READY. Keep the whole film under ~10 MB: downscale images to what
// the frame needs (a 1080-wide frame rarely needs textures over 2048 px) and decimate models first.
// Name the output p3_assets.js (build picks up p3*.js .. p6*.js in order, so it comes before the parts that use it).
import fs from 'fs';
import path from 'path';

const MIME = { '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ktx2': 'image/ktx2', '.json': 'application/json', '.hdr': 'image/vnd.radiance',
  '.gif': 'image/gif', '.avif': 'image/avif' };
const [out, ...pairs] = process.argv.slice(2);
if (!out || !pairs.length) { console.error('usage: node embed_assets.mjs <film>/parts/p3_assets.js name=path/to/file …'); process.exit(2); }
const lines = ['/* embedded assets (scripts/embed_assets.mjs) — sources and licences belong in the header comment of p1_head.html */'];
let total = 0;
for (const p of pairs) {
  const k = p.indexOf('='); if (k < 1) { console.error(`not name=path: ${p}`); process.exit(2); }
  const name = p.slice(0, k), file = p.slice(k + 1), mime = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const data = fs.readFileSync(file); total += data.length;
  lines.push(`const ASSET_${name.toUpperCase()} = 'data:${mime};base64,${data.toString('base64')}';`);
  console.log(`${name}: ${file} (${(data.length / 1e6).toFixed(2)} MB, ${mime})`);
}
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log(`wrote ${out} — ${(total / 1e6).toFixed(2)} MB of assets (${(total * 4 / 3 / 1e6).toFixed(2)} MB as base64)`);
