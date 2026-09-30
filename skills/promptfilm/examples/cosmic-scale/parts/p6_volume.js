
/* =====================================================================================
   6. VOLUMES — galaxies and the cosmic web, ray-marched in one half-resolution pass.
   One galaxy function for every large galaxy (P5): the Milky Way uses the arm fits of Reid et al. (2019);
   Andromeda and Triangulum use the same function with their own arm count, pitch and ring; the Magellanic Clouds
   use its irregular branch. The model is a picture built on those fits — not an image of our Galaxy from outside.
   Seen from inside (near the Sun) the same volume is the Milky Way band across the sky.
   The cosmic web beyond the 2MRS survey is a statistical simulation (a periodic Voronoi-filament field,
   sampled at two incommensurate scales), shown with a depth window centred on the camera's subject.
   ===================================================================================== */
const GAL_MAX = 5;
const GALAXIES = [];                       // { name, type, cKpc (Vector3, heliocentric Galactic), rot (Matrix3 local->world), scale, P, Q, box }
function orientFromSky(raDeg, decDeg, incDeg, paDeg) {
  // disc normal from inclination and position angle (PA of the major axis, north through east)
  const s = eqDir(raDeg, decDeg);                               // line of sight (Galactic)
  const ncp = V3(0, 0, 1).applyMatrix3(M_EQ2GAL);               // equatorial north pole in Galactic coordinates
  const north = ncp.clone().sub(s.clone().multiplyScalar(ncp.dot(s))).normalize(), east = north.clone().cross(s).negate().normalize();
  const major = north.clone().multiplyScalar(Math.cos(paDeg * deg)).addScaledVector(east, Math.sin(paDeg * deg));
  const minor = s.clone().cross(major).normalize();
  const n = s.clone().multiplyScalar(-Math.cos(incDeg * deg)).addScaledVector(minor, Math.sin(incDeg * deg)).normalize();
  const x = major.clone(), y = n.clone().cross(x).normalize();
  return new THREE.Matrix3().set(x.x, y.x, n.x, x.y, y.y, n.y, x.z, y.z, n.z);    // columns: local x, y, z(normal)
}
const kpcOf = name => UNGC_NAMED[name].clone().multiplyScalar(1 / KM.KPC);
GALAXIES.push({ name: 'Milky Way', type: 0, cKpc: GC.clone(), rot: new THREE.Matrix3(), scale: 1, P: [0, 0.0, 1.0, 1.0], Q: [0, 0, 0, 0], box: [17, 17, 1.4] });
GALAXIES.push({ name: 'Andromeda', type: 1, cKpc: kpcOf('MESSIER031'), rot: orientFromSky(10.6847, 41.2690, 77, 38), scale: 15 / 22.5, P: [1, 3.1, 1.05, 1.0], Q: [2, Math.tan(8 * deg), 0.6, 1.0], box: [17, 17, 1.4] });
GALAXIES.push({ name: 'Triangulum', type: 1, cKpc: kpcOf('MESSIER033'), rot: orientFromSky(23.4621, 30.6602, 54, 23), scale: 15 / 9.0, P: [1, 7.7, 0.95, 0.7], Q: [2, Math.tan(34 * deg), 2.1, 0.0], box: [17, 17, 1.4] });
GALAXIES.push({ name: 'Large Magellanic Cloud', type: 2, cKpc: kpcOf('LMC'), rot: orientFromSky(80.894, -69.756, 35, 150), scale: 1, P: [2, 4.4, 1.0, 0.8], Q: [0, 0, 0, 0], box: [6.5, 6.5, 2.0] });
GALAXIES.push({ name: 'Small Magellanic Cloud', type: 3, cKpc: kpcOf('SMC'), rot: orientFromSky(13.187, -72.829, 60, 45), scale: 1, P: [3, 9.2, 0.9, 0.6], Q: [0, 0, 0, 0], box: [4.5, 3.0, 3.0] });
GALAXIES.forEach(g => { g.rotT = g.rot.clone().transpose(); g.posKm = g.cKpc.clone().multiplyScalar(KM.KPC); });

// Reid et al. 2019 arms, as used by the Milky Way branch: βkink, ln Rkink, tanψ<, tanψ>, β0, β1 (radians), strength
const ARM_GL = ARM_TABLE;
const DARK_GLSL = `const float DCL[85] = float[85](-7.95602, 0.10314, 0.03231, 0.09000, 1.00000, -7.97946, 0.05541, 0.03649, 0.07000, 0.90000, -7.95861, 0.16060, 0.02952, 0.08000, 0.80000, -8.01663, -0.01167, 0.06173, 0.03500, 1.00000, -8.00555, 0.00000, 0.03344, 0.04000, 0.80000, -8.01090, -0.05340, 0.06352, 0.03000, 0.70000, -8.28391, 0.01882, -0.01543, 0.04500, 0.90000, -8.41655, 0.09702, -0.07687, 0.05000, 0.80000, -8.49391, -0.19856, -0.11594, 0.06000, 0.80000, -8.05731, -0.15427, 0.01766, 0.02500, 1.00000, -8.06708, -0.16273, -0.03157, 0.03000, 0.70000, -8.00448, 0.68460, 0.03302, 0.15000, 0.90000, -7.65000, 0.86603, 0.02080, 0.20000, 0.60000, -8.66614, 0.73712, 0.03651, 0.20000, 0.50000, -7.23075, -0.77135, 0.02080, 0.25000, 0.60000, -8.00788, 0.01243, -0.02555, 0.02500, 0.70000, -7.66821, -0.12909, 0.05568, 0.12000, 0.60000);`;
const ARM_GLSL = `const float ARMS[35] = float[35](${ARM_GL.flat().map(v => v.toFixed(5)).join(', ')});`;

/* ---------- a periodic cosmic-web density (Voronoi filaments), 96³, built once on the CPU ---------- */
const WEB_N = 96, WEB_CELLS = 8;
const webTex = (() => {
  const rnd = mulberry32(31337), C = WEB_CELLS, seeds = new Float32Array(C * C * C * 3);
  for (let i = 0; i < C * C * C; i++) { seeds[i * 3] = rnd(); seeds[i * 3 + 1] = rnd(); seeds[i * 3 + 2] = rnd(); }
  const data = new Uint8Array(WEB_N * WEB_N * WEB_N), d4 = new Float32Array(4);
  for (let z = 0; z < WEB_N; z++) for (let y = 0; y < WEB_N; y++) for (let x = 0; x < WEB_N; x++) {
    const px = (x + 0.5) / WEB_N * C, py = (y + 0.5) / WEB_N * C, pz = (z + 0.5) / WEB_N * C;
    const cx = Math.floor(px), cy = Math.floor(py), cz = Math.floor(pz);
    d4[0] = d4[1] = d4[2] = d4[3] = 1e9;
    for (let k = -1; k <= 1; k++) for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
      const gx = cx + i, gy = cy + j, gz = cz + k;
      const sx = ((gx % C) + C) % C, sy = ((gy % C) + C) % C, sz = ((gz % C) + C) % C, s = (sx + C * (sy + C * sz)) * 3;
      const dx = gx + seeds[s] - px, dy = gy + seeds[s + 1] - py, dz = gz + seeds[s + 2] - pz;
      const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (d < d4[3]) { let m = 3; while (m > 0 && d < d4[m - 1]) { d4[m] = d4[m - 1]; m--; } d4[m] = d; }
    }
    const w = 0.07;
    const wall = Math.exp(-Math.pow((d4[1] - d4[0]) / w, 2)), fil = Math.exp(-Math.pow((d4[2] - d4[0]) / (w * 1.3), 2)), node = Math.exp(-Math.pow((d4[3] - d4[0]) / (w * 1.8), 2));
    const v = 0.1 * wall + 0.55 * fil + 1.4 * node + 0.012;
    data[x + WEB_N * (y + WEB_N * z)] = Math.min(255, Math.round(Math.pow(Math.min(v / 2.0, 1), 1.2) * 255));   // stored linear: mip averages keep the mean brightness
  }
  const t = new THREE.Data3DTexture(data, WEB_N, WEB_N, WEB_N);
  t.format = THREE.RedFormat; t.type = THREE.UnsignedByteType; t.wrapS = t.wrapT = t.wrapR = THREE.RepeatWrapping;
  t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true; t.unpackAlignment = 1; t.needsUpdate = true;
  return t;
})();
const WEB_PERIOD_MPC = 8 * 60;           // eight cells of ~60 Mpc (~200 Mly between filaments) per texture period

/* ---------- the galaxies of the observable universe, one speck each (illustrative positions) ----------
   ~450,000 points strewn through the observable sphere along the same web as the volume (the real sky holds an
   estimated few hundred billion to two trillion galaxies; each speck here stands for millions of them). Farther ones
   are dimmer and redder, as the light of distant galaxies is. Inside ~1.3 billion ly the real 2MRS galaxies take over. */
const GAL_FIELD = (() => {
  const data = webTex.image.data, N = WEB_N, P = WEB_PERIOD_MPC, R = 14250, RIN = 400;     // Mpc: the observable radius; the 2MRS region
  // draw voxels of the web texture in proportion to their density (a cumulative table), then drop each into a random
  // period tile inside the sphere: the same web, without wasting draws on empty space
  const cdf = new Float64Array(N * N * N); let acc = 0;
  for (let i = 0; i < cdf.length; i++) { acc += Math.pow(data[i] / 255, 1.4); cdf[i] = acc; }
  const tex = (x, y, z) => data[((Math.floor(x * N) % N + N) % N) + N * (((Math.floor(y * N) % N + N) % N) + N * ((Math.floor(z * N) % N + N) % N))] / 255;
  const rnd = mulberry32(90210), COUNT = 450000;
  const pos = new Float32Array(COUNT * 3), size = new Float32Array(COUNT), bri = new Float32Array(COUNT), col = new Float32Array(COUNT * 3);
  let n = 0;
  while (n < COUNT) {
    const v = rnd() * acc; let lo = 0, hi = cdf.length - 1;
    while (lo < hi) { const m = (lo + hi) >> 1; if (cdf[m] < v) lo = m + 1; else hi = m; }
    const vx = lo % N, vy = Math.floor(lo / N) % N, vz = Math.floor(lo / (N * N));
    // a random tile of the periodic web inside the sphere
    const u = Math.cbrt(rnd()) * R, cz = 2 * rnd() - 1, ph = 2 * Math.PI * rnd(), sz = Math.sqrt(1 - cz * cz);
    const ox = Math.floor(u * sz * Math.cos(ph) / P) * P, oy = Math.floor(u * sz * Math.sin(ph) / P) * P, oz = Math.floor(u * cz / P) * P;
    const x = ox + (vx + rnd()) / N * P, y = oy + (vy + rnd()) / N * P, z = oz + (vz + rnd()) / N * P;
    const r = Math.hypot(x, y, z);
    if (r < RIN || r > R) continue;
    // the second, rotated layer of the shader's web modulates it (as in webDensity())
    const rx = 0.8 * x - 0.6 * y, ry = 0.36 * x + 0.48 * y + 0.8 * z, rz = -0.48 * x - 0.64 * y + 0.6 * z;
    if (rnd() * 1.65 > 0.35 + 1.3 * tex(rx / (P * 1.37) + 0.31, ry / (P * 1.37) + 0.31, rz / (P * 1.37) + 0.31)) continue;
    pos[n * 3] = x; pos[n * 3 + 1] = y; pos[n * 3 + 2] = z;
    size[n] = 0.02 + 0.03 * rnd();
    const far = Math.min(1, r / R), red = 0.85 * far * far * far;
    const kind = rnd() < 0.6 ? [0.72, 0.82, 1.0] : [1.0, 0.86, 0.62];                     // blue spirals, golden ellipticals
    col[n * 3] = kind[0] * (1 - red) + 1.0 * red; col[n * 3 + 1] = kind[1] * (1 - red) + 0.5 * red; col[n * 3 + 2] = kind[2] * (1 - red) + 0.32 * red;
    bri[n] = (0.06 + 1.5 * Math.pow(rnd(), 4)) * (1 - 0.55 * far);                             // mostly faint, a few bright (as in a deep field)
    n++;
  }
  const c = makeCloud({ positions: pos, sizes: size, brights: bri, colors: col, unitKm: KM.MPC, minPx: 0.9, maxPx: 3, gain: 0, order: 3, shape: 'soft' });
  c.U.uFade.value = 0; c.points.visible = false;
  return c;
})();

/* the Milky Way's arm field (Reid et al. 2019 arms), baked once into a 768² half-float map over ±17 kpc — the same
   armStrength() the sampled stars use — so the ray-march reads it instead of evaluating fifteen spiral segments per step */
const ARM_TEX = (() => {
  const N = 768, E = 17, data = new Uint16Array(N * N);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const gx = ((i + 0.5) / N * 2 - 1) * E, gy = ((j + 0.5) / N * 2 - 1) * E;
    data[j * N + i] = THREE.DataUtils.toHalfFloat(armStrength(Math.hypot(gx, gy), Math.atan2(gy, -gx)));
  }
  const t = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.HalfFloatType);
  t.minFilter = t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.needsUpdate = true;
  return t;
})();
const VOL_FS = `
  precision highp float; precision highp sampler3D;
  uniform mat3 uCamRot; uniform vec2 uTan; uniform int uGN; uniform vec3 uGO[${GAL_MAX}]; uniform mat3 uGR[${GAL_MAX}]; uniform vec4 uGP[${GAL_MAX}]; uniform vec4 uGQ[${GAL_MAX}];
  uniform vec3 uGB[${GAL_MAX}]; uniform float uGA[${GAL_MAX}]; uniform float uGain; uniform float uInside;
  uniform float uWebOn; uniform vec3 uWebO; uniform vec3 uWebT; uniform float uWebWin; uniform float uWebR; uniform float uWebGain; uniform sampler3D uWebTex; uniform float uWebPx; uniform float uWebInner; uniform float uWebDepth;
  varying vec2 vUv;
  ${NOISE_GLSL}
  ${ARM_GLSL}
  ${DARK_GLSL}
  uniform float uLocalHole; uniform float uClouds; uniform sampler2D uArmTex;
  const mat3 NROT = mat3(0.6, -0.64, 0.48, 0.8, 0.48, -0.36, 0.0, 0.6, 0.8);   // noise lattice turned away from the disc's axes
  float armsMW(float R, float beta) {
    float lnR = log(max(R, 0.05)), acc = 0.0;
    float w = max(0.16, 0.30 + 0.036 * (R - 8.15)) * 1.15;
    for (int a = 0; a < 5; a++) {
      float bk = ARMS[a * 7], lnRk = ARMS[a * 7 + 1], t1 = ARMS[a * 7 + 2], t2 = ARMS[a * 7 + 3], b0 = ARMS[a * 7 + 4], b1 = ARMS[a * 7 + 5], st = ARMS[a * 7 + 6];
      for (int k = -1; k <= 1; k++) {
        float b = beta + 6.2831853 * float(k);
        if (b < b0 - 0.4 || b > b1 + 0.4) continue;
        float tp = b < bk ? t1 : t2;
        float d = R * abs(lnR - (lnRk - (b - bk) * tp)) / sqrt(1.0 + tp * tp);
        float taper = smoothstep(b0 - 0.4, b0, b) * (1.0 - smoothstep(b1, b1 + 0.4, b));
        acc += st * taper * exp(-d * d / (w * w));
      }
    }
    return acc;
  }
  float armsGen(float R, float beta, vec4 Q) {
    float n = Q.x, tp = Q.y, lnR = log(max(R, 0.05)), acc = 0.0, w = 0.55 + 0.03 * R;
    for (int a = 0; a < 4; a++) {
      if (float(a) >= n) break;
      float ph = Q.z + 6.2831853 * float(a) / n;
      // log spiral lnR = lnR0 + (beta - ph) tanψ : nearest winding
      float u = lnR - (log(2.0) + (beta - ph) * tp); float step_ = 6.2831853 * tp;
      u -= step_ * floor(u / step_ + 0.5);
      float d = R * abs(u) / sqrt(1.0 + tp * tp);
      acc += exp(-d * d / (w * w)) * smoothstep(1.5, 3.0, R);
    }
    return acc + Q.w * 1.2 * exp(-pow((R - 10.0) / 1.4, 2.0));          // Andromeda's 10-kpc ring
  }
  void galSample(vec3 p, vec4 P, vec4 Q, out vec3 em, out float ext) {
    int type = int(P.x + 0.5); float seed = P.y;
    float R = length(p.xy), az = abs(p.z);
    if (type <= 1) {
      float beta = type == 0 ? atan(p.y, -p.x) : atan(p.y, p.x);
      float arms = type == 0 ? texture2D(uArmTex, p.xy / 34.0 + 0.5).r : armsGen(R, beta, Q);
      vec3 pr = NROT * p;
      float n1 = fbm(pr * 1.9 + seed, 2), n2 = fbm(pr * 5.3 + seed * 2.1, 2), n3 = vnoise(pr * 14.0 + seed);
      float old = exp(-R / 2.6) * (exp(-az / 0.3) + 0.05 * exp(-az / 0.9)) * smoothstep(17.0, 12.0, R);
      vec2 bp = type == 0 ? mat2(0.891, 0.454, -0.454, 0.891) * p.xy : p.xy;          // the bar, 27° from the Sun–centre line
      float bar = exp(-pow(pow(bp.x / 3.4, 2.0) + pow(bp.y / 1.1, 2.0) + pow(p.z / 0.55, 2.0), 0.8) * 2.4) * (type == 0 ? 1.0 : 0.35);
      float bulge = exp(-length(vec3(p.xy, p.z / 0.72)) / 0.5) * (type == 0 ? 1.0 : 1.9);
      float young = arms * exp(-R / 5.5) * exp(-az / 0.13) * smoothstep(2.0, 4.0, R) * smoothstep(17.0, 13.0, R) * (0.3 + 1.4 * n1 * n1);
      float clouds = (0.7 + 0.6 * n3) * (0.55 + 0.9 * n1);                              // star clouds: patchy, not smooth
      em = (vec3(1.0, 0.84, 0.66) * old * 1.1 * clouds + vec3(1.0, 0.78, 0.52) * (bar + bulge) * 2.3 + vec3(0.6, 0.74, 1.0) * young * 1.6
         + vec3(1.0, 0.42, 0.62) * young * pow(n2, 4.0) * 6.0);
      float dustArms = arms * (0.25 + 1.5 * n2 * n2);
      ext = 5.5 * exp(-R / 5.0) * exp(-az / 0.1) * (0.18 + dustArms) * (0.6 + 0.8 * n3) * smoothstep(1.2, 3.0, R) * smoothstep(17.0, 12.0, R);
      if (type == 0) {
        // the Sun's neighbourhood is drawn as resolved stars: its light leaves the diffuse glow while we are near it
        vec3 sunL = vec3(-8.15, 0.0, 0.0208);
        em *= mix(1.0, smoothstep(0.45, 1.6, distance(p, sunL)), uLocalHole);
        if (uClouds > 0.001) for (int c = 0; c < 17; c++) {                           // nearby dark clouds (Great Rift, Ophiuchus, Taurus, Coalsack …)
          vec3 cc = vec3(DCL[c * 5], DCL[c * 5 + 1], DCL[c * 5 + 2]); float r = DCL[c * 5 + 3];
          vec3 dd = (p - cc) * vec3(1.0, 1.0, 2.4); float q = dot(dd, dd) / (r * r);        // flattened toward the plane
          if (q < 4.0) { float fil = smoothstep(0.42, 0.72, fbm(NROT * p * 90.0 + float(c), 3));  // filamentary, not a ball
            ext += DCL[c * 5 + 4] * 26.0 * exp(-q * 1.8) * fil * uClouds; }
        }
      }
    } else if (type == 2) {                 // Large Magellanic Cloud: an offset bar in a clumpy disc, 30 Doradus
      float n1 = vnoise(p * 2.4 + seed), n2 = vnoise(p * 6.0 + seed);
      float disc = exp(-R / 1.45) * exp(-az / 0.35);
      vec2 bp = mat2(0.94, -0.34, 0.34, 0.94) * (p.xy - vec2(-0.4, 0.2));
      float bar = exp(-(pow(bp.x / 1.7, 2.0) + pow(bp.y / 0.45, 2.0) + pow(p.z / 0.4, 2.0)));
      float clumps = pow(n1, 3.0) * disc * 2.0;
      float dor = exp(-dot(p - vec3(1.3, 0.9, 0.0), p - vec3(1.3, 0.9, 0.0)) / 0.08);
      em = vec3(0.95, 0.9, 0.85) * (disc * 1.3 + bar * 2.6) + vec3(0.6, 0.72, 1.0) * clumps + vec3(1.0, 0.45, 0.7) * (dor * 9.0 + clumps * pow(n2, 4.0) * 4.0);
      ext = 1.2 * disc * n2;
    } else {                                 // Small Magellanic Cloud: an elongated, clumpy body
      float n1 = vnoise(p * 2.6 + seed), n2 = vnoise(p * 7.0 + seed);
      float b = exp(-length(p / vec3(1.9, 0.95, 0.95)) * 1.7);
      em = (vec3(0.95, 0.9, 0.88) * 1.8 + vec3(0.55, 0.7, 1.0) * pow(n1, 3.0) * 2.5 + vec3(1.0, 0.45, 0.7) * pow(n2, 6.0) * 3.0) * b;
      ext = 0.5 * b * n2;
    }
  }
  vec2 boxHit(vec3 o, vec3 d, vec3 b) {
    vec3 inv = 1.0 / d, t0 = (-b - o) * inv, t1 = (b - o) * inv;
    vec3 tmin = min(t0, t1), tmax = max(t0, t1);
    return vec2(max(max(tmin.x, tmin.y), max(tmin.z, 0.0)), min(min(tmax.x, tmax.y), tmax.z));
  }
  float webDensity(vec3 q, float lod) {        // q in Mpc
    float a = textureLod(uWebTex, q / ${WEB_PERIOD_MPC.toFixed(1)}, lod).r;
    vec3 r = mat3(0.80, 0.36, -0.48, -0.60, 0.48, -0.64, 0.0, 0.8, 0.6) * q;
    float b = textureLod(uWebTex, r / ${(WEB_PERIOD_MPC * 1.37).toFixed(1)} + 0.31, lod).r;
    return a * (0.35 + 1.3 * b);
  }
  void main() {
    vec2 ndc = vUv * 2.0 - 1.0;
    vec3 dir = normalize(uCamRot * vec3(ndc.x * uTan.x, ndc.y * uTan.y, -1.0));
    vec3 col = vec3(0.0); float T = 1.0;
    // galaxies, nearest first
    for (int g = 0; g < ${GAL_MAX}; g++) {
      if (g >= uGN || T < 0.01) break;
      if (uGA[g] < 0.001) continue;
      vec3 o = uGO[g], d = uGR[g] * dir;
      vec2 h = boxHit(o, d, uGB[g]);
      if (h.y <= h.x) continue;
      bool inside = all(lessThan(abs(o), uGB[g]));
      int N = int(clamp((h.y - h.x) / 0.14, 18.0, inside ? 40.0 : 44.0));      // steps follow the path length
      float dl = (h.y - h.x) / float(N);
      float t = h.x + dl * 0.5;
      for (int i = 0; i < 44; i++) {
        if (i >= N || T < 0.01) break;
        vec3 p = o + d * t; vec3 em; float ext;
        galSample(p, uGP[g], uGQ[g], em, ext);
        float x = ext * dl * uGP[g].w, a = exp(-x);
        float within = x > 1e-3 ? (1.0 - a) / x : 1.0 - 0.5 * x;          // light emitted inside the step, dimmed by its own dust
        col += T * em * uGP[g].z * dl * uGA[g] * within;
        T *= a;
        t += dl;
      }
    }
    // the cosmic web, inside the observable sphere, around the camera's subject
    if (uWebOn > 0.001 && T > 0.01) {
      vec3 o = uWebO;                                    // Mpc, centred on us
      float B = dot(o, dir), C = dot(o, o) - uWebR * uWebR, disc = B * B - C;
      if (disc > 0.0) {
        float t0 = max(-B - sqrt(disc), 0.0), t1 = -B + sqrt(disc);
        // a slab-shaped depth window around the subject: thin along the line of sight (so filaments and voids read), wide across
        float tc = dot(uWebT - o, dir); t0 = max(t0, tc - uWebDepth * 2.2); t1 = min(t1, tc + uWebDepth * 2.2);
        if (t1 > t0) {
          const int N = 44; float dl = (t1 - t0) / float(N);
          float t = t0 + dl * 0.5; vec3 acc = vec3(0.0);
          for (int i = 0; i < N; i++) {
            vec3 q = o + dir * t; float r = length(q);
            float along = (t - tc) / uWebDepth;
            vec3 perp = q - uWebT - dir * (t - tc);
            float win = exp(-along * along) * exp(-dot(perp, perp) / (uWebWin * uWebWin));
            float inner = mix(1.0, smoothstep(180.0, 420.0, r), uWebInner);   // the 2MRS sphere shows real galaxies instead (while it is drawn)
            float edge = 1.0 - smoothstep(uWebR * 0.4, uWebR, r);             // no wall: what we can map thins out toward the horizon
            float lodT = clamp(log2(max(dl * 0.5, uWebPx * t) / (${WEB_PERIOD_MPC.toFixed(1)} / ${WEB_N.toFixed(1)})), 0.0, 6.0);
            acc += webDensity(q, lodT) * win * inner * edge * dl;
            t += dl;
          }
          col += T * acc * vec3(0.72, 0.82, 1.0) * uWebGain * uWebOn;
        }
      }
    }
    gl_FragColor = vec4(col * uGain, 1.0 - T);
  }`;

/* ---------- the Milky Way as seen from the Sun, baked once at high quality (equirectangular, Galactic l/b) ----------
   The same galSample() integrated with 320 steps (denser near the Sun). Used while the camera is within a few hundred
   light-years of the Sun, where the sky is the same as seen from the Sun; beyond that the live volume takes over. */
const SKY_W = 3072, SKY_H = 1536;
const skyRT = new THREE.WebGLRenderTarget(SKY_W, SKY_H, { type: THREE.HalfFloatType, depthBuffer: false, generateMipmaps: false });
skyRT.texture.wrapS = THREE.RepeatWrapping; skyRT.texture.minFilter = THREE.LinearFilter; skyRT.texture.magFilter = THREE.LinearFilter;
// the real Milky Way as seen from the Sun (Gaia DR2 light without the bright stars — those are our catalogue points)
const SKY_PHOTO = { tex: null };
const SKY_READY = loadTex(DATA_TEX_MILKYWAY).then(t => { t.wrapS = THREE.RepeatWrapping; t.anisotropy = 4; SKY_PHOTO.tex = t; volBgMat.uniforms.tSky.value = t; });
const SKYBAKE_FS = VOL_FS.slice(0, VOL_FS.indexOf('  void main() {')) + `
  void main() {
    float l = (vUv.x - 0.5) * 6.2831853, b = (vUv.y - 0.5) * 3.1415927;
    vec3 d = vec3(cos(b) * cos(l), cos(b) * sin(l), sin(b));
    vec3 o = vec3(-${FACTS.R0.toFixed(4)}, 0.0, ${FACTS.zSun.toFixed(4)});
    vec2 h = boxHit(o, d, vec3(17.0, 17.0, 1.4));
    vec3 col = vec3(0.0); float T = 1.0;
    float t0 = 0.0, t1 = max(h.y, 0.0); const int N = 320;
    float prev = 0.0;
    for (int i = 1; i <= N; i++) {
      float f = float(i) / float(N); float t = t1 * f * f; float dl = t - prev; float tm = (t + prev) * 0.5; prev = t;
      vec3 em; float ext; galSample(o + d * tm, vec4(0.0, 0.0, 1.0, 1.0), vec4(0.0), em, ext);
      float x = ext * dl, a = exp(-x); float within = x > 1e-3 ? (1.0 - a) / x : 1.0 - 0.5 * x;
      col += T * em * dl * within; T *= a;
    }
    gl_FragColor = vec4(col, 1.0);
  }`;
function bakeSky() {
  const m = new THREE.ShaderMaterial({ uniforms: VOLU, vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }', fragmentShader: SKYBAKE_FS, depthTest: false, depthWrite: false });
  const sc = new THREE.Scene(); sc.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m));
  renderer.setRenderTarget(skyRT); renderer.render(sc, volCam); renderer.setRenderTarget(null);
  m.dispose();
}
const volRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false });
const VOLU = {
  uCamRot: { value: new THREE.Matrix3() }, uTan: { value: new THREE.Vector2(1, 1) }, uGN: { value: 0 },
  uGO: { value: Array.from({ length: GAL_MAX }, () => new THREE.Vector3()) }, uGR: { value: Array.from({ length: GAL_MAX }, () => new THREE.Matrix3()) },
  uGP: { value: Array.from({ length: GAL_MAX }, () => new THREE.Vector4()) }, uGQ: { value: Array.from({ length: GAL_MAX }, () => new THREE.Vector4()) },
  uGB: { value: Array.from({ length: GAL_MAX }, () => new THREE.Vector3()) }, uGA: { value: new Array(GAL_MAX).fill(0) },
  uGain: { value: 1 }, uInside: { value: 0 },
  uWebOn: { value: 0 }, uWebO: { value: new THREE.Vector3() }, uWebT: { value: new THREE.Vector3() }, uWebWin: { value: 1 }, uWebR: { value: 14260 },
  uWebGain: { value: 1 }, uWebTex: { value: webTex }, uWebPx: { value: 0.002 }, uWebInner: { value: 1 }, uWebDepth: { value: 100 }, uLocalHole: { value: 1 }, uClouds: { value: 1 }, uArmTex: { value: ARM_TEX },
};
const volMat = new THREE.ShaderMaterial({ uniforms: VOLU, vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
  fragmentShader: VOL_FS, depthTest: false, depthWrite: false });
const volScene = new THREE.Scene(), volCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
volScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), volMat));
// composite of the volume layer under everything else
const volBgMat = new THREE.ShaderMaterial({ uniforms: { tVol: { value: volRT.texture }, tSky: { value: skyRT.texture }, uSkyMix: { value: 1 }, uSkyGain: { value: 1 },
    uCamRot: VOLU.uCamRot, uTan: VOLU.uTan },
  vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }',
  fragmentShader: `uniform sampler2D tVol; uniform sampler2D tSky; uniform float uSkyMix; uniform float uSkyGain; uniform mat3 uCamRot; uniform vec2 uTan; varying vec2 vUv;
    void main() {
      vec4 c = texture2D(tVol, vUv);
      if (uSkyMix > 0.001) {
        vec2 ndc = vUv * 2.0 - 1.0; vec3 d = normalize(uCamRot * vec3(ndc.x * uTan.x, ndc.y * uTan.y, -1.0));
        vec2 uv = vec2(0.5 - atan(d.y, d.x) / 6.2831853, asin(clamp(d.z, -1.0, 1.0)) / 3.1415927 + 0.5);   // Galactic longitude grows to the left
        c.rgb += max(texture2D(tSky, uv).rgb - 0.004, 0.0) * uSkyMix * uSkyGain;
      }
      gl_FragColor = vec4(c.rgb, 1.0);
    }`,
  depthTest: false, depthWrite: false });
const volBg = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), volBgMat);
volBg.frustumCulled = false; volBg.renderOrder = -10; scene.add(volBg);

const _mv3 = new THREE.Matrix3(), _cp = new THREE.Vector3();
function updateVolumes(camPosKm, targetKm, fieldKm, galAmt, webAmt, skyMix = 0) {
  VOLU.uCamRot.value.setFromMatrix4(camera.matrixWorld);
  const ty = Math.tan(camera.fov * deg / 2); VOLU.uTan.value.set(ty * camera.aspect, ty);
  // galaxies sorted by distance from the camera
  const order = GALAXIES.map((g, i) => [i, camPosKm.distanceTo(g.posKm)]).sort((a, b) => a[1] - b[1]);
  let n = 0;
  for (const [i] of order) {
    const g = GALAXIES[i];
    _cp.copy(camPosKm).multiplyScalar(1 / KM.KPC).sub(g.cKpc).applyMatrix3(g.rotT).multiplyScalar(g.scale);
    VOLU.uGO.value[n].copy(_cp);
    VOLU.uGR.value[n].copy(g.rotT);
    VOLU.uGP.value[n].set(...g.P); VOLU.uGQ.value[n].set(...g.Q); VOLU.uGB.value[n].set(...g.box);
    VOLU.uGA.value[n] = g.type === 0 ? galAmt * (1 - skyMix) : galAmt;
    n++;
  }
  VOLU.uGN.value = n;
  VOLU.uWebOn.value = webAmt;
  VOLU.uWebO.value.copy(camPosKm).multiplyScalar(1 / KM.MPC);
  VOLU.uWebT.value.copy(targetKm).multiplyScalar(1 / KM.MPC);
  VOLU.uWebWin.value = Math.max(fieldKm / KM.MPC * 0.9, 1);
  VOLU.uWebDepth.value = Math.max(fieldKm / KM.MPC * 0.11, 60);
  VOLU.uWebPx.value = 1 / PXR_U.value;
}
