
/* =====================================================================================
   4. POINTS — real stars (HYG), galaxies (UNGC, 2MRS), Kuiper-belt and Oort-cloud objects, markers.
   One star shader for every star (the Sun included): brightness is the star's apparent magnitude as seen from
   the camera, against a "map exposure" that deepens smoothly with the field of view (a function of the camera,
   never of time). Anything beyond the far plane is pushed onto the sky sphere in the same direction.
   ===================================================================================== */
const DPR_U = { value: 1 };                                   // device pixels per CSS pixel (all pixel sizes below are CSS px)
const PXR_U = { value: 500 };                                 // CSS pixels per radian at the screen centre
const POINT_COMMON = `
  uniform float uPxPerRad; uniform float uFade; uniform float uMaxPx; uniform float uDpr;
  ${FARPUSH_GLSL}
`;
// soft round sprite: a sharp core and a faint halo; the core never shrinks below ~1.3 px (area-preserving fade instead)
const SPRITE_FS = `
  varying vec3 vCol; varying float vA; varying float vSig;
  void main() {
    vec2 d = gl_PointCoord * 2.0 - 1.0; float r2 = dot(d, d); if (r2 > 1.0) discard;
    float core = exp(-r2 / (2.0 * vSig * vSig)), halo = exp(-r2 * 3.5) * 0.12;
    gl_FragColor = vec4(vCol * (core + halo) * vA, 1.0);
  }`;
// every sprite's core is at least ~0.75 device pixels wide (sigma), so a moving point keeps a steady brightness
const SIG_GLSL = `float spriteSigma(float sizeDev) { return clamp(0.75 / (0.5 * sizeDev), 0.12, 0.6); }`;
/* ---------- stars ---------- */
const starsGroup = new THREE.Group();
starsGroup.matrixAutoUpdate = false;
starsGroup.matrix.makeScale(KM.PC, KM.PC, KM.PC);          // positions in parsecs
universe.add(starsGroup);
const STAR_N = DATA_STARS.n;
const starBuf = b64bytes(DATA_STARS.b64), starDV = new DataView(starBuf.buffer);
const starPos = new Float32Array(STAR_N * 3), starMag = new Float32Array(STAR_N), starCi = new Float32Array(STAR_N), starExt = new Float32Array(STAR_N);
for (let i = 0; i < STAR_N; i++) {
  const o = i * 10;
  const dx = starDV.getInt16(o, true) / 32767, dy = starDV.getInt16(o + 2, true) / 32767, dz = starDV.getInt16(o + 4, true) / 32767;
  const n = Math.hypot(dx, dy, dz) || 1, d = Math.pow(10, starDV.getUint16(o + 6, true) / 65535 * 6 - 2);
  starPos[i * 3] = dx / n * d; starPos[i * 3 + 1] = dy / n * d; starPos[i * 3 + 2] = dz / n * d;
  starMag[i] = starDV.getUint8(o + 8) / 8 - 12;
  starCi[i] = starDV.getUint8(o + 9) / 80 - 0.5;
}
// the named stars keep their precise positions
Object.values(DATA_STARS.named).forEach(s => { starPos[s.i * 3] = s.pc[0]; starPos[s.i * 3 + 1] = s.pc[1]; starPos[s.i * 3 + 2] = s.pc[2]; });
const SUN_I = DATA_STARS.named.sun.i;
starPos[SUN_I * 3] = starPos[SUN_I * 3 + 1] = starPos[SUN_I * 3 + 2] = 0;
const starGeo = new THREE.BufferGeometry();
starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
starGeo.setAttribute('aMag', new THREE.BufferAttribute(starMag, 1));
starGeo.setAttribute('aCi', new THREE.BufferAttribute(starCi, 1));
starGeo.setAttribute('aExt', new THREE.BufferAttribute(starExt, 1));
const STARU = {
  uPxPerRad: PXR_U, uDpr: DPR_U, uFade: { value: 1 }, uMaxPx: { value: 9 }, uCamPc: { value: new THREE.Vector3() },
  uMref: { value: 6.5 }, uSunFade: { value: 1 }, uSunI: { value: SUN_I }, uGain: { value: 1 }, uFocus: { value: new THREE.Vector3() }, uFocusR: { value: 1e12 }, uExtAmt: { value: 1 },
};
const starMat = new THREE.ShaderMaterial({
  uniforms: STARU,
  vertexShader: `
    attribute float aMag; attribute float aCi; attribute float aExt; uniform float uExtAmt; uniform vec3 uCamPc; uniform float uMref; uniform float uSunFade; uniform int uSunI; uniform float uGain; uniform vec3 uFocus; uniform float uFocusR;
    varying vec3 vCol; varying float vA; varying float vSig;
    ${POINT_COMMON}${BB_GLSL}${SIG_GLSL}
    void main() {
      float d = max(distance(position, uCamPc), 1e-7);
      float m = aMag + 5.0 * log(d) / log(10.0) - 5.0 + aExt * uExtAmt;   // apparent magnitude from the camera (dust toward the Sun)
      float dm = uMref - m;                                          // magnitudes brighter than the current limit
      float a = clamp(dm / 2.5, 0.0, 1.0) * uFade * uGain;           // stars fade in over 2.5 mag above the limit
      float ex = max(dm - 2.5, 0.0);
      float px = clamp(0.9 + 0.42 * ex, 0.9, uMaxPx);                 // only genuinely bright stars grow
      if (gl_VertexID == uSunI) a *= uSunFade;
      a *= exp(-pow(distance(position, uFocus) / uFocusR, 2.0));
      vA = a * (0.62 + 0.1 * ex);
      vCol = bbColor(ciToT(aCi));
      vec4 mv = farPush(modelViewMatrix * vec4(position, 1.0));
      gl_Position = projectionMatrix * mv;
      float sz = max(px * 2.4 * uDpr, 3.2); vA *= min(1.0, px * 2.4 * uDpr / 3.2);
      gl_PointSize = a < 0.003 ? 0.0 : sz; vSig = spriteSigma(sz); vA *= pow(0.19 / vSig, 1.3);   // same light, spread wider
    }`,
  fragmentShader: SPRITE_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
});
const starPoints = new THREE.Points(starGeo, starMat);
starPoints.frustumCulled = false; starPoints.renderOrder = 3;
starsGroup.add(starPoints);

/* ---------- the rest of the Galaxy's stars: sampled from the same model as the Milky Way volume ----------
   The catalogue covers the Sun's neighbourhood; beyond ~600 pc the stars are drawn from the Galaxy model (old disc,
   young arm population on the Reid et al. arms, bar and bulge) — each point stands for a bright star or a cluster.
   Their dimming by dust toward the Sun is integrated through the model's dust layer, so the band shows its dark lanes. */
const armStrength = (R, beta) => {                 // same arm field as the volume shader (Gaussian distance to each arm)
  const lnR = Math.log(Math.max(R, 0.05)), w = Math.max(0.16, 0.30 + 0.036 * (R - 8.15)) * 1.15; let acc = 0;
  ARM_TABLE.forEach(([bk, lnRk, t1, t2, b0, b1, st]) => {
    for (let k = -1; k <= 1; k++) {
      const b = beta + 2 * Math.PI * k; if (b < b0 - 0.4 || b > b1 + 0.4) continue;
      const tp = b < bk ? t1 : t2, d = R * Math.abs(lnR - (lnRk - (b - bk) * tp)) / Math.sqrt(1 + tp * tp);
      const taper = smoother(clamp01((b - (b0 - 0.4)) / 0.4)) * (1 - smoother(clamp01((b - b1) / 0.4)));
      acc += st * taper * Math.exp(-d * d / (w * w));
    }
  });
  return acc;
};
const dustAt = (X, Y, Z) => {                        // heliocentric kpc -> the model's dust extinction per kpc (mean of its noise)
  const gx = X - FACTS.R0, gy = Y, gz = Z + FACTS.zSun, R = Math.hypot(gx, gy), beta = Math.atan2(gy, -gx);
  return 5.5 * Math.exp(-R / 5) * Math.exp(-Math.abs(gz) / 0.1) * (0.18 + armStrength(R, beta)) * smoother(clamp01((R - 1.2) / 1.8)) * smoother(clamp01((17 - R) / 5));
};
const MW_STARS = (() => {
  const rnd = mulberry32(2718), N = 240000;
  const P = new Float32Array(N * 3), Mg = new Float32Array(N), Ci = new Float32Array(N), Ex = new Float32Array(N);
  const gamma2 = sc => -sc * Math.log(rnd() * rnd() + 1e-12), laplace = sc => (rnd() < 0.5 ? -1 : 1) * -sc * Math.log(rnd() + 1e-12);
  const cb = Math.cos(27 * deg), sb = Math.sin(27 * deg);
  let k = 0, guard = 0;
  while (k < N && guard++ < N * 60) {
    const u = rnd(); let gx, gy, gz, M, ci;
    if (u < 0.52) {                                            // old disc
      const R = gamma2(2.6), ph = rnd() * 2 * Math.PI; if (R > 15.5) continue;
      gx = -R * Math.cos(ph); gy = R * Math.sin(ph); gz = laplace(0.3);
      M = -1.8 + 4.2 * Math.pow(rnd(), 0.6); ci = 0.75 + 0.75 * rnd();
    } else if (u < 0.86) {                                     // young stars and clusters on the arms
      const R = 2.5 + 13 * rnd(), ph = rnd() * 2 * Math.PI;
      if (rnd() > armStrength(R, ph) * 0.85 * Math.exp(-(R - 2.5) / 9)) continue;
      gx = -R * Math.cos(ph); gy = R * Math.sin(ph); gz = laplace(0.09);
      M = -6.5 + 5.5 * Math.pow(rnd(), 1.4); ci = -0.28 + 0.55 * rnd();
    } else {                                                   // bar and bulge
      const a = gauss(rnd) * 1.7, b = gauss(rnd) * 0.62, c = gauss(rnd) * 0.45;
      gx = -a * cb - b * sb; gy = a * sb - b * cb; gz = c;      // near end of the bar toward positive longitude
      M = -2.2 + 3.4 * rnd(); ci = 1.0 + 0.55 * rnd();
    }
    const X = FACTS.R0 + gx, Y = gy, Z = gz - FACTS.zSun, d = Math.hypot(X, Y, Z);
    if (d < 0.6) continue;                                     // the catalogue (HYG) holds the real stars there
    let tau = 0; const NS = 14;
    for (let j = 0; j < NS; j++) { const f = (j + 0.5) / NS; tau += dustAt(X * f, Y * f, Z * f) * d / NS; }
    P[k * 3] = X * 1000; P[k * 3 + 1] = Y * 1000; P[k * 3 + 2] = Z * 1000;      // pc
    Mg[k] = M; Ci[k] = ci; Ex[k] = 1.086 * tau; k++;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P.subarray(0, k * 3), 3));
  geo.setAttribute('aMag', new THREE.BufferAttribute(Mg.subarray(0, k), 1));
  geo.setAttribute('aCi', new THREE.BufferAttribute(Ci.subarray(0, k), 1));
  geo.setAttribute('aExt', new THREE.BufferAttribute(Ex.subarray(0, k), 1));
  // the same star shader and parameters as the catalogue; only the fade and the Sun index are its own
  const mat = new THREE.ShaderMaterial({ uniforms: { ...STARU, uSunI: { value: -1 }, uFade: { value: 1 } },
    vertexShader: starMat.vertexShader, fragmentShader: starMat.fragmentShader, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = 3;
  starsGroup.add(pts);
  return { points: pts, U: mat.uniforms, n: k };
})();
const STAR_NAMED = {};
Object.entries(DATA_STARS.named).forEach(([k, s]) => { STAR_NAMED[k] = V3(...s.pc).multiplyScalar(KM.PC); });

/* ---------- a generic "object" point cloud: physical size where resolved, never below a minimum pixel size ---------- */
// attributes: position (cloud units), aSize (physical radius, cloud units), aBright (0..n), aCol (rgb)
function makeCloud({ positions, sizes, brights, colors, unitKm, minPx = 1.2, maxPx = 40, gain = 1, order = 4, shape = 'soft', shapes = null }) {
  const g = new THREE.Group(); g.matrixAutoUpdate = false; g.matrix.makeScale(unitKm, unitKm, unitKm);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geo.setAttribute('aBright', new THREE.BufferAttribute(brights, 1));
  geo.setAttribute('aCol', new THREE.BufferAttribute(colors, 3));
  geo.setAttribute('aShape', new THREE.BufferAttribute(shapes || new Float32Array(sizes.length * 3).fill(1), 3));
  const U = { uPxPerRad: PXR_U, uDpr: DPR_U, uFade: { value: 1 }, uMaxPx: { value: maxPx }, uMinPx: { value: minPx }, uGain: { value: gain },
    uCamU: { value: new THREE.Vector3() }, uFocus: { value: new THREE.Vector3() }, uFocusR: { value: 1e30 }, uUnitPx: { value: 1 } };
  const mat = new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: `
      attribute float aSize; attribute float aBright; attribute vec3 aCol; attribute vec3 aShape; varying vec3 vShape; uniform float uMinPx; uniform float uGain; uniform vec3 uCamU;
      uniform vec3 uFocus; uniform float uFocusR;
      varying vec3 vCol; varying float vA; varying float vSig;
      ${POINT_COMMON}${SIG_GLSL}
      void main() {
        vec4 mv0 = modelViewMatrix * vec4(position, 1.0);
        float d = max(distance(position, uCamU), 1e-9);
        float physPx = aSize / d * uPxPerRad;                        // true radius in pixels
        float px = clamp(max(physPx, uMinPx), 0.0, uMaxPx);
        // light is conserved when a resolved object shrinks below the minimum size: dim instead of shrinking
        float cover = clamp(physPx / uMinPx, 0.0, 1.0);
        float foc = exp(-pow(distance(position, uFocus) / uFocusR, 2.0));   // depth window around the camera's subject
        vA = uFade * uGain * aBright * mix(cover, 1.0, 0.35) * foc;
        vCol = aCol; vShape = aShape;
        gl_Position = projectionMatrix * farPush(mv0);
        float sz = max(px * 2.0 * uDpr, 3.2); vA *= min(1.0, px * 2.0 * uDpr / 3.2);
        gl_PointSize = vA < 0.002 ? 0.0 : sz; vSig = spriteSigma(sz); vA *= pow(0.19 / vSig, 1.3);
      }`,
    fragmentShader: shape === 'disc' ? `
      varying vec3 vCol; varying float vA; varying float vSig;
      void main() { vec2 d = gl_PointCoord * 2.0 - 1.0; float r2 = dot(d, d); if (r2 > 1.0) discard;
        float e = exp(-r2 * 3.2); gl_FragColor = vec4(vCol * e * vA, 1.0); }` : shape === 'galaxy' ? `
      varying vec3 vCol; varying float vA; varying float vSig; varying vec3 vShape;
      void main() {                                   // an inclined disc with a warm bulge; tiny ones stay a soft blob
        vec2 d = gl_PointCoord * 2.0 - 1.0; float c = cos(vShape.y), s = sin(vShape.y);
        vec2 e = mat2(c, -s, s, c) * d; e.y /= max(vShape.x, 0.18);
        float r = length(e); if (r > 1.0 && dot(d, d) > 1.0) discard;
        float disc = exp(-r * 5.0) * (1.0 - smoothstep(0.8, 1.0, r)), bulge = exp(-dot(d, d) / (2.0 * vSig * vSig));
        vec3 col = vCol * disc * (1.0 - vShape.z) + vec3(1.0, 0.86, 0.66) * bulge * (0.35 + vShape.z);
        gl_FragColor = vec4(col * vA * 1.4, 1.0); }` : SPRITE_FS,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = order;
  g.add(pts); universe.add(g);
  return { group: g, points: pts, U, unitKm };
}

/* ---------- Kuiper belt (illustrative objects; the region 30–50 AU is NASA's) and the scattered disc ---------- */
const kuiper = (() => {
  const rnd = mulberry32(4401), N = 14000, P = new Float32Array(N * 3), S = new Float32Array(N), B = new Float32Array(N), C = new Float32Array(N * 3);
  for (let k = 0; k < N; k++) {
    const u = rnd(); let a, e, inc;
    if (u < 0.5) { a = 42 + rnd() * 6; e = rnd() * 0.1; inc = Math.abs(gauss(rnd)) * 3; }           // classical belt
    else if (u < 0.72) { a = 39.4 + gauss(rnd) * 0.3; e = 0.1 + rnd() * 0.2; inc = Math.abs(gauss(rnd)) * 10; }   // plutinos (3:2)
    else if (u < 0.85) { a = 30 + rnd() * 20; e = rnd() * 0.15; inc = Math.abs(gauss(rnd)) * 12; }
    else { a = 50 + Math.pow(rnd(), 2) * 60; e = 0.2 + rnd() * 0.4; inc = Math.abs(gauss(rnd)) * 15; }      // scattered disc
    const M = rnd() * 2 * Math.PI, w = rnd() * 2 * Math.PI, O = rnd() * 2 * Math.PI;
    let E = M; for (let it = 0; it < 6; it++) E = M + e * Math.sin(E);
    const xo = a * (Math.cos(E) - e), yo = a * Math.sqrt(1 - e * e) * Math.sin(E);
    const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), ci = Math.cos(inc * deg), si = Math.sin(inc * deg);
    const x = (cO * cw - sO * sw * ci) * xo + (-cO * sw - sO * cw * ci) * yo, y = (sO * cw + cO * sw * ci) * xo + (-sO * sw + cO * cw * ci) * yo, z = (sw * si) * xo + (cw * si) * yo;
    const g = V3(x, y, z).applyMatrix3(M_ECL2GAL);
    P.set([g.x, g.y, g.z], k * 3); S[k] = 1e-6; B[k] = 0.45 + 0.5 * rnd(); C.set([0.78, 0.8, 0.84], k * 3);
  }
  return makeCloud({ positions: P, sizes: S, brights: B, colors: C, unitKm: KM.AU, minPx: 1.15, gain: 1, order: 4 });
})();

/* ---------- Oort cloud (inferred region 2,000–100,000 AU; objects illustrative) ---------- */
const oort = (() => {
  const rnd = mulberry32(90210), N = 42000, P = new Float32Array(N * 3), S = new Float32Array(N), B = new Float32Array(N), C = new Float32Array(N * 3);
  for (let k = 0; k < N; k++) {
    // spread evenly in log r between 2,000 and 100,000 AU (so the extent reads), the inner part flattened toward the ecliptic
    const r = 2000 * Math.pow(50, Math.pow(rnd(), 0.75));
    const flat = 1 - 0.6 * clamp01((20000 - r) / 18000);
    let v = V3(gauss(rnd), gauss(rnd), gauss(rnd) * flat).normalize().multiplyScalar(r);
    v.applyMatrix3(M_ECL2GAL);
    P.set([v.x, v.y, v.z], k * 3); S[k] = 1e-6; B[k] = (0.26 + 0.3 * rnd()) * Math.pow(r / 20000, 0.25); C.set([0.72, 0.8, 0.9], k * 3);
  }
  return makeCloud({ positions: P, sizes: S, brights: B, colors: C, unitKm: KM.AU, minPx: 1.1, gain: 1, order: 4 });
})();

/* ---------- galaxies: UNGC (Local Volume, kpc) and 2MRS (beyond 11 Mpc, Mpc) ---------- */
const galCol = T => (T < 0 ? [1.0, 0.82, 0.62] : T < 4 ? [1.0, 0.9, 0.78] : T < 8 ? [0.86, 0.9, 1.0] : [0.72, 0.84, 1.0]);
// the five galaxies drawn as volumes are left out of the sprite catalogue (one representation each)
const VOLUME_GALAXIES = new Set(['MESSIER031', 'MESSIER033', 'LMC', 'SMC']);
const UNGC_NAMED = {};
const ungc = (() => {
  const L = DATA_UNGC.filter(g => !VOLUME_GALAXIES.has(g.n));
  const N = L.length, P = new Float32Array(N * 3), S = new Float32Array(N), B = new Float32Array(N), C = new Float32Array(N * 3);
  const SH = new Float32Array(N * 3), hsh = k => { const x = Math.sin(k * 12.9898) * 43758.5453; return x - Math.floor(x); };
  L.forEach((g, k) => {
    const q = g.t < 0 ? 0.65 + 0.3 * hsh(k + 7) : Math.sqrt(Math.pow(Math.cos((g.i || 60) * deg), 2) * 0.96 + 0.04);
    SH.set([q, hsh(k) * Math.PI, g.t < 0 ? 0.85 : g.t < 4 ? 0.45 : g.t < 9 ? 0.22 : 0.06], k * 3);
    P.set([g.x, g.y, g.z], k * 3); S[k] = g.D * 0.5;                 // radius (kpc)
    const lum = Math.pow(10, -0.4 * (g.MB + 20.5));                      // relative to an L* galaxy
    B[k] = clamp(1.4 + 2.2 * Math.pow(lum, 0.35), 1.2, 4.0); C.set(galCol(g.t), k * 3);
  });
  DATA_UNGC.forEach(g => { UNGC_NAMED[g.n] = V3(g.x, g.y, g.z).multiplyScalar(KM.KPC); });
  return makeCloud({ positions: P, sizes: S, brights: B, colors: C, unitKm: KM.KPC, minPx: 1.6, maxPx: 60, gain: 1, order: 5, shape: 'galaxy', shapes: SH });
})();
const tmrs = (() => {
  const N = DATA_TMRS.n, buf = b64bytes(DATA_TMRS.b64), dv = new DataView(buf.buffer);
  const P = new Float32Array(N * 3), S = new Float32Array(N), B = new Float32Array(N), C = new Float32Array(N * 3), SH = new Float32Array(N * 3);
  for (let k = 0; k < N; k++) {
    const o = k * 9, u = DATA_TMRS.unitMpc;
    P[k * 3] = dv.getInt16(o, true) * u; P[k * 3 + 1] = dv.getInt16(o + 2, true) * u; P[k * 3 + 2] = dv.getInt16(o + 4, true) * u;
    const MK = dv.getUint8(o + 6) / 20 - 28, T = dv.getInt8(o + 7);
    const lum = Math.pow(10, -0.4 * (MK + 24.2));
    S[k] = 0.012 * Math.pow(lum, 0.4);                                    // ~ 25 kpc radius for an L* galaxy (Mpc)
    B[k] = clamp(0.35 + 0.6 * Math.pow(lum, 0.35), 0.3, 1.5); C.set(galCol(T === 99 ? 5 : T), k * 3);
    const ba = Math.max(0.15, dv.getUint8(o + 8) / 255), hx = Math.sin(k * 78.233) * 43758.5453;
    SH.set([ba, (hx - Math.floor(hx)) * Math.PI, T < 0 ? 0.85 : T < 4 ? 0.45 : T < 9 ? 0.22 : 0.08], k * 3);
  }
  // 2MRS is flux-limited: fewer galaxies are caught far away. Weight each by the inverse of the survey's radial
  // density (measured from the catalogue itself) so a wide view does not look like a dense ball centred on us.
  const SHW = 10, NB = 60, cnt = new Float64Array(NB);
  for (let k = 0; k < N; k++) { const r = Math.hypot(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]); const b = Math.min(NB - 1, Math.floor(r / SHW)); cnt[b]++; }
  const dens = Array.from(cnt, (c, b) => c / (4 / 3 * Math.PI * (Math.pow((b + 1) * SHW, 3) - Math.pow(b * SHW, 3))));
  const n0 = (dens[2] + dens[3] + dens[4] + dens[5]) / 4;
  for (let k = 0; k < N; k++) { const r = Math.hypot(P[k * 3], P[k * 3 + 1], P[k * 3 + 2]); const b = Math.min(NB - 1, Math.floor(r / SHW));
    B[k] *= Math.pow(clamp(n0 / Math.max(dens[b], 1e-9), 1, 14), 0.75); }
  return makeCloud({ positions: P, sizes: S, brights: B, colors: C, unitKm: KM.MPC, minPx: 1.25, maxPx: 30, gain: 1, order: 5, shape: 'galaxy', shapes: SH });
})();

/* ---------- markers (planets on their orbits, probes, cluster nodes): fixed pixel size, soft glow ---------- */
function makeMarkers(list, unitKm, px = 4, order = 7) {
  // list: [{ p: Vector3 (units), col: [r,g,b], a: 1 }]
  const N = list.length, P = new Float32Array(N * 3), C = new Float32Array(N * 3), A = new Float32Array(N);
  list.forEach((m, k) => { P.set([m.p.x, m.p.y, m.p.z], k * 3); C.set(m.col, k * 3); A[k] = m.a ?? 1; });
  const g = new THREE.Group(); g.matrixAutoUpdate = false; g.matrix.makeScale(unitKm, unitKm, unitKm);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('aCol', new THREE.BufferAttribute(C, 3)); geo.setAttribute('aA', new THREE.BufferAttribute(A, 1));
  const U = { uFade: { value: 0 }, uPx: { value: px }, uDpr: DPR_U };
  const mat = new THREE.ShaderMaterial({ uniforms: U,
    vertexShader: `attribute vec3 aCol; attribute float aA; uniform float uFade; uniform float uPx; uniform float uDpr; varying vec3 vCol; varying float vA; ${FARPUSH_GLSL}
      void main() { vCol = aCol; vA = aA * uFade; gl_Position = projectionMatrix * farPush(modelViewMatrix * vec4(position, 1.0)); gl_PointSize = vA < 0.002 ? 0.0 : uPx * 2.0 * uDpr; }`,
    fragmentShader: `varying vec3 vCol; varying float vA; void main() { vec2 d = gl_PointCoord * 2.0 - 1.0; float r = length(d); if (r > 1.0) discard;
      float e = smoothstep(1.0, 0.55, r) * 0.9 + exp(-r * r * 6.0) * 0.6; gl_FragColor = vec4(vCol * e * vA, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false; pts.renderOrder = order;
  g.add(pts); universe.add(g);
  return { group: g, points: pts, U };
}
