
/* =====================================================================================
   3. STUDIO (engine test film #2: a product film) — a fictional smart speaker "AURA" in a photo studio. World unit: cm.
   Built to the bar of the reference films, not as a mock-up: real product proportions; detail at three levels — form,
   secondary detail (bevels, chamfers, parting lines, seams), surface micro-structure (knit, brushing, paper fibre);
   physically based materials lit by softboxes whose reflections read on metal and glass; a floor with a contact shadow;
   shallow depth of field close up. Every number is invented for the test and says so.
   ===================================================================================== */
const FACTS = Object.freeze({
  body:    { r: 6.0, h: 16.0, src: 'fictional test product' },
  woofer:  { d: 9, src: 'fictional' },
  tweeter: { n: 3, src: 'fictional' },
  battery: { hours: 20, src: 'fictional' },
});

/* ---------- canvas textures, drawn once (deterministic; mipmapped so they never shimmer) ---------- */
function canvas2d(w, h, draw) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; }
// a normal map from a height canvas (Sobel), strength in "height units per pixel"
function normalFromHeight(hc, strength = 2) {
  const w = hc.width, h = hc.height, src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const out = canvas2d(w, h, () => {}), g = out.getContext('2d'), img = g.createImageData(w, h), d = img.data;
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y - 1) + 2 * H(x + 1, y) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x - 1, y) - H(x - 1, y + 1)) * strength;
    const dy = (H(x - 1, y + 1) + 2 * H(x, y + 1) + H(x + 1, y + 1) - H(x - 1, y - 1) - 2 * H(x, y - 1) - H(x + 1, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    d[i] = 128 + 127 * (-dx / l); d[i + 1] = 128 + 127 * (dy / l); d[i + 2] = 128 + 127 * (1 / l); d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0); return out;
}
const texOf = (c, { srgb = false, repeat = null, aniso = 8 } = {}) => {
  const t = new THREE.CanvasTexture(c); t.anisotropy = aniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); } return t;
};
const rndT = mulberry32(11);

// knit fabric: jersey stitches (two slanted loops each), heathered two-tone yarn. One tile = 16 × 24 stitches.
const KNIT = (() => {
  const W = 512, H = 512, SX = 16, SY = 24, sw = W / SX, sh = H / SY;
  const height = canvas2d(W, H, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    for (let j = 0; j < SY; j++) for (let i = 0; i < SX; i++) for (const side of [-1, 1]) {
      // (a little irregularity per stitch: a perfectly regular pattern turns into moiré at a distance)
      const cx = (i + 0.5) * sw + side * sw * 0.22 + (rndT() - 0.5) * sw * 0.08, cy = (j + 0.5) * sh + (rndT() - 0.5) * sh * 0.1;
      for (const ox of [-W, 0, W]) for (const oy of [-H, 0, H]) {
        const gr = g.createRadialGradient(cx + ox, cy + oy, 0, cx + ox, cy + oy, sw * 0.42);
        gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.6, 'rgba(200,200,200,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.save(); g.translate(cx + ox, cy + oy); g.rotate(side * 0.55); g.scale(0.55, 1.15); g.translate(-(cx + ox), -(cy + oy));
        g.fillStyle = gr; g.beginPath(); g.arc(cx + ox, cy + oy, sw * 0.42, 0, Math.PI * 2); g.fill(); g.restore();
      }
    }
  });
  const color = canvas2d(W, H, (g) => {
    g.drawImage(height, 0, 0); const img = g.getImageData(0, 0, W, H), d = img.data;
    const heather = new Float32Array(SX * SY * 2).map(() => rndT());
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, h = d[i] / 255, s = Math.floor(y / sh) * SX * 2 + Math.floor(x / sw) * 2 + (x % sw > sw / 2 ? 1 : 0);
      const light = heather[s] > 0.9 ? 1.18 : heather[s] < 0.12 ? 0.86 : 1.0;          // a few slightly lighter and darker yarns (subtle)
      const v = (46 + 34 * h) * light;                                   // a mid charcoal: dark enough to feel premium, light enough to show its form
      d[i] = v * 0.97; d[i + 1] = v; d[i + 2] = v * 1.07; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  });
  return { color, normal: normalFromHeight(height, 1.6) };
})();

// concentric hairline brushing for the aluminium top ring (a normal map around the centre)
const BRUSH = (() => {
  const W = 1024, bins = new Float32Array(2048).map(() => rndT() - 0.5);
  const height = canvas2d(W, W, (g) => { const img = g.createImageData(W, W), d = img.data;
    for (let y = 0; y < W; y++) for (let x = 0; x < W; x++) { const r = Math.hypot(x - W / 2, y - W / 2) * 2, i = (y * W + x) * 4;
      const v = 128 + 90 * bins[Math.floor(r) % 2048] + 30 * bins[Math.floor(r * 3.1) % 2048]; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    g.putImageData(img, 0, 0); });
  return { normal: normalFromHeight(height, 0.6) };
})();

// speaker-cone paper: pressed fibres
const PAPER = canvas2d(512, 512, (g, W, H) => {
  g.fillStyle = '#26282b'; g.fillRect(0, 0, W, H);
  for (let k = 0; k < 2600; k++) { const x = rndT() * W, y = rndT() * H, a = rndT() * Math.PI, l = 4 + rndT() * 18;
    g.strokeStyle = `rgba(${rndT() > 0.5 ? '255,255,255' : '0,0,0'},${0.04 + rndT() * 0.06})`; g.lineWidth = 0.6 + rndT();
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); }
});

/* ---------- the studio: softboxes and strip lights (seen in reflections), a graded backdrop, the key and rim lights ---------- */
function makeStudioEnv() {
  const env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), new THREE.ShaderMaterial({ side: THREE.BackSide,
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'varying vec3 vD; void main(){ float y = vD.y; vec3 c = mix(vec3(0.020, 0.022, 0.026), vec3(0.055, 0.060, 0.068), smoothstep(-0.2, 0.15, y)); c = mix(c, vec3(0.012, 0.013, 0.015), smoothstep(0.2, 0.9, y)); gl_FragColor = vec4(c, 1.0); }' })));
  const panel = (w, h, pos, I, tint = [1, 1, 1]) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(I * tint[0], I * tint[1], I * tint[2]), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 8, 0); env.add(m); };
  panel(46, 34, [-42, 48, 38], 5.0);                  // key softbox, high front left
  panel(8, 70, [55, 18, -32], 7.0, [0.92, 0.96, 1.0]);  // strip light, back right (the long highlight on the metal)
  panel(8, 60, [-58, 14, -26], 4.0, [1.0, 0.97, 0.92]); // strip light, back left
  panel(36, 36, [0, 75, 0], 1.6);                     // overhead
  panel(60, 20, [20, 6, 60], 0.35);                   // low front fill (bounce)
  const pm = new THREE.PMREMGenerator(renderer); const t = pm.fromScene(env, 0.02).texture; pm.dispose(); return t;
}
scene.environment = makeStudioEnv();
const KEY = new THREE.DirectionalLight(0xfff6ec, 1.9); KEY.position.set(-0.62, 0.72, 0.6); scene.add(KEY);   // (directional lights live in
const RIM = new THREE.DirectionalLight(0xdce8ff, 2.6); RIM.position.set(0.85, 0.25, -0.75); scene.add(RIM);    //  `scene`: with the floating
const RIM2 = new THREE.DirectionalLight(0xfff0e0, 1.3); RIM2.position.set(-0.9, 0.18, -0.6); scene.add(RIM2);  //  origin only direction matters)

// the backdrop around the whole set, and the floor that melts into it; a soft contact shadow under the product
const BACKDROP = new THREE.Mesh(new THREE.SphereGeometry(800, 48, 24), new THREE.ShaderMaterial({ side: THREE.BackSide, depthWrite: false,
  vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: 'varying vec3 vD; void main(){ float y = vD.y; vec3 c = mix(vec3(0.036, 0.040, 0.047), vec3(0.012, 0.013, 0.016), smoothstep(0.0, 0.6, y)); gl_FragColor = vec4(c, 1.0); }' }));
BACKDROP.renderOrder = -2; universe.add(BACKDROP);
// the floor: unlit (lights would give it a hard bright half), a soft pool of light under the product that fades into the backdrop's
// own colour at the edge (no horizon line), and a contact shadow — a wide soft falloff and a tight dark core under the base
const FLOOR = new THREE.Mesh(new THREE.CircleGeometry(160, 128).rotateX(-Math.PI / 2), new THREE.ShaderMaterial({ transparent: true, depthWrite: true,
  vertexShader: 'varying vec2 vP; void main(){ vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `varying vec2 vP;
    void main(){ float d = length(vP);
      vec3 col = mix(vec3(0.060, 0.064, 0.072), vec3(0.030, 0.034, 0.040), smoothstep(8.0, 70.0, d));     // the pool of light → the backdrop colour
      float sh = 0.55 * exp(-pow(max(d - 5.2, 0.0) / 5.0, 2.0)) + 0.35 * exp(-pow(max(d - 5.8, 0.0) / 0.9, 2.0));   // contact shadow
      col *= 1.0 - clamp(sh, 0.0, 0.9) * step(d, 20.0);
      gl_FragColor = vec4(col, 1.0 - smoothstep(110.0, 160.0, d)); }` }));
universe.add(FLOOR);

// depth of field like a real lens: shallow in the close-ups, gentle on the wide shots (focus is always the camera target)
const FILM_DOF = (tau, field) => ({ aperture: clamp(0.22 / field, 0.004, 0.028), maxblur: 0.009 });
