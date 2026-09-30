// Find what flickers at one moment: node flicker_probe.mjs <url> <t> [--out dir] [--dpr 1] [--list]
//                                      [--hide "name=<JS predicate on a scene object o>"] …
// Measures alternating pixels per 10,000 (the qa.mjs flicker metric) at playback time t with three step patterns:
//   1/60 s steps (what qa measures) · the same moment ×5 (> 0 = nondeterministic: per-frame noise, uninitialised data)
//   1/600 s steps (still high = static flicker: coplanar layers / z-fighting, sub-pixel shimmer; low = motion stepping)
// then again with each --hide group hidden (restored after), so the share of each group shows. Writes heat maps
// (red = alternating) to --out. --list prints the scene's objects (index, type, name, material, vertices) to write predicates.
// Predicate examples: "trees=o.isInstancedMesh && o.count > 1000"   "floor=o.name === 'floor'"   "glass=o.material && o.material.transmission > 0"
import { open, seek, shot, decode, writePng, mkdir, argv, has, path } from './common.mjs';
const url = process.argv[2], T = parseFloat(process.argv[3]);
if (!url || Number.isNaN(T)) { console.error('usage: node flicker_probe.mjs <url> <t> [--out dir] [--dpr 1] [--list] [--hide "name=predicate"] …'); process.exit(2); }
const out = mkdir(argv('out', 'flicker_probe'));
const hides = process.argv.map((a, i) => a === '--hide' ? process.argv[i + 1] : null).filter(Boolean).map(s => { const k = s.indexOf('='); return [s.slice(0, k), s.slice(k + 1)]; });
const lum = (p, i) => 0.2126 * p.data[i] + 0.7152 * p.data[i + 1] + 0.0722 * p.data[i + 2];
const { browser, page } = await open(url, { q: '?freeze&text=0', dpr: +argv('dpr', 1) });
async function measure(times, file) {
  const f = []; for (const t of times) { await seek(page, t); f.push(decode(await shot(page))); }
  const N = f[0].width * f[0].height; let bad = 0; const heat = Buffer.alloc(N * 4);
  for (let p = 0; p < N; p++) { const i4 = p * 4, L = f.map(g => lum(g, i4)); const d = [L[2] - 2 * L[1] + L[0], L[3] - 2 * L[2] + L[1], L[4] - 2 * L[3] + L[2]];
    const a = d.every(v => Math.abs(v) > 16) && Math.sign(d[0]) !== Math.sign(d[1]) && Math.sign(d[1]) !== Math.sign(d[2]);
    if (a) { bad++; heat[i4] = 255; heat[i4 + 1] = 40; heat[i4 + 2] = 40; } else { heat[i4] = heat[i4 + 1] = heat[i4 + 2] = L[2] * 0.45; } heat[i4 + 3] = 255; }
  if (file) writePng(path.join(out, file), f[0].width, f[0].height, heat);
  return +(bad / N * 1e4).toFixed(2);
}
const steps = k => [0, 1, 2, 3, 4].map(i => T + i * k);
if (has('list')) {
  const rows = await page.evaluate(() => { const r = []; let i = 0; __bw._dbg.universe.traverse(o => { if (o.isMesh || o.isPoints || o.isLine) {
    const g = o.geometry, n = g && g.attributes.position ? g.attributes.position.count : 0;
    r.push(`${i++}\t${o.type}${o.isInstancedMesh ? '×' + o.count : ''}\t${o.name || '-'}\t${o.material ? o.material.type : '-'}\t${n} verts\t${o.visible ? '' : '(hidden)'}`); } }); return r; });
  console.log(rows.join('\n'));
}
const t60 = await measure(steps(1 / 60), `probe_t${T}_all.png`), same = await measure(steps(0)), t600 = await measure(steps(1 / 600));
console.log(`t=${T}  1/60 s steps: ${t60}   same moment ×5: ${same}   1/600 s steps: ${t600}`);
console.log('  →', same > 0 ? 'nondeterministic: something changes per render (per-frame noise, uninitialised data)'
  : t600 >= 0.4 * t60 ? 'static flicker: coplanar layers (z-fighting) or sub-pixel shimmer — look for surfaces closer than the depth buffer resolves (references/engine.md, layer gap)'
  : 'motion stepping: small detail steps pixel by pixel under the moving camera — thicker or fewer sub-pixel parts, lower contrast, less gloss on bevels (references/techniques.md §10)');
for (const [name, pred] of hides) {
  const n = await page.evaluate(p => { const f = new Function('o', 'return (' + p + ')'); window.__probeHidden = [];
    __bw._dbg.universe.traverse(o => { if ((o.isMesh || o.isPoints || o.isLine) && o.visible && f(o)) { o.visible = false; __probeHidden.push(o); } }); return __probeHidden.length; }, pred);
  const v = await measure(steps(1 / 60), `probe_t${T}_no-${name}.png`);
  console.log(`  without ${name} (${n} objects): ${v}   (its share ≈ ${(t60 - v).toFixed(2)})`);
  await page.evaluate(() => { (window.__probeHidden || []).forEach(o => { o.visible = true; }); });
}
console.log(`heat maps: ${out}`);
await browser.close();
