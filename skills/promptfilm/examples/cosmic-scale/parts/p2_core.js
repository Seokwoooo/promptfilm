
/* =====================================================================================
   1. FACTS — every size, distance and count shown on screen is read from this one object.
   Radii in km. Exoplanets: NASA Exoplanet Archive default parameter set (pl_radj × 71,492 km or
   pl_rade × 6,378.1 km). Solar-system bodies: NASA fact-sheet mean radii (Jupiter/Saturn also carry
   equatorial and polar radii for their true flattened shape). Stars: R_sun = 695,700 km (IAU nominal).
   ===================================================================================== */
const KM = { AU: 149597870.7, LY: 9460730472580.8, PC: 30856775814913.67, RE: 6378.1, RJ: 71492, RSUN: 695700 };
KM.KPC = KM.PC * 1e3; KM.MPC = KM.PC * 1e6; KM.MLY = KM.LY * 1e6; KM.GLY = KM.LY * 1e9;
const EARTH_D = 12742;                                       // Earth's mean diameter (km): the reference "1×"
const FACTS = Object.freeze({
  earth:    { r: 6371.0, src: 'NASA Earth fact sheet (mean radius)' },
  cnc55e:   { r: 1.875 * KM.RE, teq: 1958, src: 'NASA Exoplanet Archive — Bourrier et al. 2018; Teq Demory et al. 2011' },
  kep22b:   { r: 2.10 * KM.RE, teq: 279, src: 'NASA Exoplanet Archive — Bonomo et al. 2023' },
  k218b:    { r: 2.37 * KM.RE, teq: 284, src: 'NASA Exoplanet Archive — Sarkis et al. 2018' },
  gj1214b:  { r: 2.733 * KM.RE, teq: 567, src: 'NASA Exoplanet Archive — Mahajan et al. 2024' },
  neptune:  { r: 24622, req: 24764, rpol: 24341, src: 'NASA Neptune fact sheet' },
  uranus:   { r: 25362, req: 25559, rpol: 24973, src: 'NASA Uranus fact sheet' },
  kep51b:   { r: 0.633 * KM.RJ, teq: 543, src: 'NASA Exoplanet Archive — Masuda 2014' },
  saturn:   { r: 58232, req: 60268, rpol: 54364, ring: [66900, 74510, 74658, 92000, 117580, 122170, 136775, 140180], src: 'NASA Saturn fact sheet; ring radii' },
  jupiter:  { r: 69911, req: 71492, rpol: 66854, src: 'NASA Jupiter fact sheet' },
  hd189733b:{ r: 1.13 * KM.RJ, teq: 1201, src: 'NASA Exoplanet Archive — Stassun et al. 2017; Teq Torres et al. 2008' },
  hatp7b:   { r: 1.51 * KM.RJ, teq: 2200, src: 'NASA Exoplanet Archive — Stassun et al. 2017; Teq Esteves et al. 2015' },
  wasp76b:  { r: 1.854 * KM.RJ, teq: 2228, src: 'NASA Exoplanet Archive — Ehrenreich et al. 2020' },
  wasp17b:  { r: 1.87 * KM.RJ, teq: 1740, src: 'NASA Exoplanet Archive — Stassun et al. 2017; Teq Sing et al. 2016' },
  wasp12b:  { r: 1.965 * KM.RJ, teq: 2580, src: 'NASA Exoplanet Archive — Leonardi et al. 2024; Teq Collins et al. 2017' },
  hatp67b:  { r: 2.14 * KM.RJ, teq: 1903, src: 'NASA Exoplanet Archive — Wang et al. 2025; Teq Zhou et al. 2017' },
  sun:      { r: 1.0 * KM.RSUN, T: 5772, src: 'IAU 2015 nominal solar radius' },
  siriusA:  { r: 1.711 * KM.RSUN, T: 9940, src: 'Kervella et al. 2003' },
  arcturus: { r: 25.4 * KM.RSUN, T: 4286, src: 'Ramírez & Allende Prieto 2011' },
  aldebaran:{ r: 44.2 * KM.RSUN, T: 3900, src: 'Richichi & Roccatagliata 2005' },
  rigel:    { r: 78.9 * KM.RSUN, T: 12100, src: 'Aufdenberg et al. 2008 (in Moravveji et al. 2012)' },
  deneb:    { r: 203 * KM.RSUN, T: 8525, src: 'Schiller & Przybilla 2008' },
  betelgeuse:{ r: 764 * KM.RSUN, T: 3600, src: 'Joyce et al. 2020 (702–880)' },
  antares:  { r: 680 * KM.RSUN, T: 3660, src: 'Ohnaka et al. 2013' },
  vycma:    { r: 1420 * KM.RSUN, T: 3490, src: 'Wittkowski et al. 2012 (±120)' },
  // the map
  neptuneA: 30.07,              // AU, semi-major axis
  kuiper: [30, 50],             // AU (NASA)
  ts: [94, 84], hp: [121.6, 119.0],     // AU: termination shock / heliopause crossings, Voyager 1 / 2
  voyager: [{ d: 172, ra: 258.3, dec: 12.0 }, { d: 144, ra: 302.3, dec: -60.0 }],  // AU (Sept 2026, approx.) and J2000 direction
  p9: { a: 700, e: 0.6, i: 30, O: 113, w: 150, mE: 10, rE: 3.7 },   // Batygin & Brown 2016 orbit; Linder & Mordasini 2016 size model
  oort: [2000, 100000],         // AU
  proxima: 4.24,                // ly
  localBubble: 1000,            // ly across (Zucker et al. 2022)
  radcliffe: { len: 2.7, amp: 0.16 },   // kpc (Alves et al. 2020)
  R0: 8.15, zSun: 0.0208,       // kpc (Reid et al. 2019; Bennett & Bovy 2019)
  mwDisk: 100000,               // ly, stellar disc diameter (rounded)
  localGroup: 10e6, virgoDist: 53.8e6, laniakea: 520e6, piscesCetus: 1.0e9, quipu: { len: 428, mass: 2.4e17 },
  obsUniverse: 93e9,            // ly, diameter (ESA)
});
const fmtInt = n => Math.round(n).toLocaleString('en-US');
// a star's light output from its measured size and temperature (Stefan–Boltzmann: L ∝ R² T⁴), in Suns
const lumSun = k => Math.pow(FACTS[k].r / FACTS.sun.r, 2) * Math.pow(FACTS[k].T / FACTS.sun.T, 4);
const xEarth = key => (2 * FACTS[key].r) / EARTH_D;          // diameter in Earth diameters
const xSun = key => FACTS[key].r / KM.RSUN;

/* =====================================================================================
   2. RENDERER, SCENE, CAMERA — floating origin with the whole universe scaled by 1/D every frame,
   so the camera always sits one unit from its subject whatever the scale (10^4 km … 10^23 km).
   ===================================================================================== */
const frameEl = document.getElementById('frame');
const canvas = document.createElement('canvas');
frameEl.prepend(canvas);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false });
} catch (e) {
  window.__showError('WebGL is not available in this browser or device.');
  throw e;
}
if (!renderer.capabilities.isWebGL2) {
  window.__showError('This piece needs WebGL 2, which this browser does not provide.');
  throw new Error('WebGL2 unavailable');
}
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.autoClear = false;
const scene = new THREE.Scene();
scene.background = null;
const universe = new THREE.Group();          // every object hangs off this; units: km, heliocentric Galactic axes
universe.matrixAutoUpdate = false;
scene.add(universe);
const camera = new THREE.PerspectiveCamera(40, 1, 1e-3, 1e4);
const NEAR = 1e-3, FAR = 1e4, SKY_R = 5e3;    // far objects are pushed onto a sphere of radius SKY_R (keeps direction)

/* ---------- small utilities (pure functions of time — nothing accumulates between frames) ---------- */
const clamp01 = x => (x < 0 ? 0 : x > 1 ? 1 : x);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const lerp = (a, b, t) => a + (b - a) * t;
const range = (t, a, b) => clamp01((t - a) / (b - a));
const smoother = x => x * x * x * (x * (x * 6 - 15) + 10);
const easeIO = x => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const pulse = (t, a, b, c, d) => smoother(range(t, a, b)) * (1 - smoother(range(t, c, d)));
const lrange = (v, a, b) => clamp01((Math.log10(v) - Math.log10(a)) / (Math.log10(b) - Math.log10(a)));   // log-space ramp
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const deg = Math.PI / 180;
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
const gauss = rnd => { let u = 0, v = 0; while (u === 0) u = rnd(); v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
function b64bytes(s) { const bin = atob(s), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); return a; }

/* ---------- reference frames (all as rotations of the heliocentric Galactic frame) ---------- */
// ICRS/J2000 equatorial -> Galactic, and ecliptic (J2000, obliquity 23.4393°) -> Galactic
const M_EQ2GAL = new THREE.Matrix3().set(
  -0.0548755604162154, -0.8734370902348850, -0.4838350155487132,
  0.4941094278755837, -0.4448296299600112, 0.7469822444972189,
  -0.8676661490190047, -0.1980763734312015, 0.4559837761750669);
const EPS = 23.4392911 * deg;
const M_ECL2EQ = new THREE.Matrix3().set(1, 0, 0, 0, Math.cos(EPS), -Math.sin(EPS), 0, Math.sin(EPS), Math.cos(EPS));
const M_ECL2GAL = new THREE.Matrix3().multiplyMatrices(M_EQ2GAL, M_ECL2EQ);
const eqDir = (raDeg, decDeg) => V3(Math.cos(decDeg * deg) * Math.cos(raDeg * deg), Math.cos(decDeg * deg) * Math.sin(raDeg * deg), Math.sin(decDeg * deg)).applyMatrix3(M_EQ2GAL);
const eclDir = (lonDeg, latDeg) => V3(Math.cos(latDeg * deg) * Math.cos(lonDeg * deg), Math.cos(latDeg * deg) * Math.sin(lonDeg * deg), Math.sin(latDeg * deg)).applyMatrix3(M_ECL2GAL);
const galDir = (lDeg, bDeg) => V3(Math.cos(bDeg * deg) * Math.cos(lDeg * deg), Math.cos(bDeg * deg) * Math.sin(lDeg * deg), Math.sin(bDeg * deg));
function basisMatrix(ex, ey, ez) { return new THREE.Matrix4().makeBasis(ex.clone().normalize(), ey.clone().normalize(), ez.clone().normalize()); }
// ecliptic frame: x -> λ=0, y -> λ=90, z -> ecliptic north
const ECL = { x: eclDir(0, 0), y: eclDir(90, 0), z: eclDir(0, 90) };
// the size LINEUP frame: bodies run along +x (ecliptic λ = 180°), "up" is ecliptic north, and the camera looks from +z
// (λ = 90°) toward −z (λ = 270°, Sagittarius): the Milky Way's bright centre and its dark dust lanes cross behind the row
const LINE = { x: ECL.x.clone().negate(), y: ECL.z.clone(), z: ECL.y.clone() };
const M_LINE = basisMatrix(LINE.x, LINE.y, LINE.z);
const GAL = { x: V3(1, 0, 0), y: V3(0, 1, 0), z: V3(0, 0, 1) };
// a camera "frame" gives the directions used by yaw/pitch keys: fwd (yaw 0 looks along −fwd... see oriFrom), up
const CAMFRAMES = {
  line: { right: LINE.x, up: LINE.y, back: LINE.z },          // yaw 0, pitch 0: camera on +z of the lineup, looking at it
  ecl:  { right: LINE.x, up: LINE.y, back: LINE.z },          // the solar-system map uses the lineup's axes (pitch up = look down on the ecliptic)
  gal:  { right: V3(0, -1, 0), up: V3(0, 0, 1), back: V3(-1, 0, 0) },   // yaw 0: camera on the anticentre side looking toward the Galactic centre
};
// camera direction (from target to eye) and up, for yaw/pitch in degrees in a named frame
function eyeDir(frame, yaw, pitch) {
  const f = CAMFRAMES[frame], cp = Math.cos(pitch * deg);
  return f.back.clone().multiplyScalar(cp * Math.cos(yaw * deg)).addScaledVector(f.right, cp * Math.sin(yaw * deg)).addScaledVector(f.up, Math.sin(pitch * deg)).normalize();
}
const _lm = new THREE.Matrix4();
function oriQuat(frame, yaw, pitch, roll = 0) {
  const e = eyeDir(frame, yaw, pitch), up = CAMFRAMES[frame].up.clone();
  if (Math.abs(e.dot(up)) > 0.999) up.copy(CAMFRAMES[frame].back).negate();
  _lm.lookAt(e, V3(0, 0, 0), up);                          // camera at e looking at the origin
  const q = new THREE.Quaternion().setFromRotationMatrix(_lm);
  if (roll) q.multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 0, 1), roll * deg));
  return q;
}

/* ---------- colour of a black body (approximation for 1000–40000 K), linear sRGB, max channel = 1 ---------- */
function bbColor(T) {
  const t = T / 100; let r, g, b;
  if (t <= 66) { r = 255; g = 99.4708025861 * Math.log(t) - 161.1195681661; b = t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307; }
  else { r = 329.698727446 * Math.pow(t - 60, -0.1332047592); g = 288.1221695283 * Math.pow(t - 60, -0.0755148492); b = 255; }
  const c = new THREE.Color(clamp(r, 0, 255) / 255, clamp(g, 0, 255) / 255, clamp(b, 0, 255) / 255);
  c.convertSRGBToLinear(); const m = Math.max(c.r, c.g, c.b); return c.multiplyScalar(1 / m);
}
const BB_GLSL = `
  vec3 bbColor(float T) {              // approximate black-body colour (linear), max channel 1
    float t = T / 100.0; vec3 c;
    if (t <= 66.0) { c.r = 1.0; c.g = clamp((99.4708 * log(t) - 161.1196) / 255.0, 0.0, 1.0);
      c.b = t <= 19.0 ? 0.0 : clamp((138.5177 * log(t - 10.0) - 305.0448) / 255.0, 0.0, 1.0); }
    else { c.r = clamp(329.6987 * pow(t - 60.0, -0.1332) / 255.0, 0.0, 1.0); c.g = clamp(288.1222 * pow(t - 60.0, -0.0755) / 255.0, 0.0, 1.0); c.b = 1.0; }
    c = pow(c, vec3(2.2)); return c / max(c.r, max(c.g, c.b));
  }
  float ciToT(float ci) { return 4600.0 * (1.0 / (0.92 * ci + 1.7) + 1.0 / (0.92 * ci + 0.62)); }   // Ballesteros 2012
`;
const NOISE_GLSL = `
  float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float vnoise(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm(vec3 p, int oct) { float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { if (i >= oct) break; s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
  // cellular noise: x = distance to nearest feature, y = to second nearest (for granulation / convection cells)
  vec2 cells(vec3 p) { vec3 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
    for (int z = -1; z <= 1; z++) for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec3 g = vec3(float(x), float(y), float(z)); vec3 o = vec3(hash13(i + g), hash13(i + g + 11.7), hash13(i + g + 23.1));
      float d = length(g + o - f); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
    return vec2(d1, d2); }
`;
// push anything beyond the far plane onto a sphere of radius SKY_R in view space (same direction, depth = background)
const FARPUSH_GLSL = `
  vec4 farPush(vec4 mv) { float L = length(mv.xyz); if (L > ${SKY_R.toFixed(1)}) mv.xyz *= ${SKY_R.toFixed(1)} / L; return mv; }
`;

/* ---------- Milky Way spiral arms (Reid et al. 2019, table 2; R0 = 8.15 kpc), shared by every layer that draws the Galaxy ---------- */
const ARMS = [   // name, βkink, Rkink, ψ<, ψ>, β range drawn (deg)
  { n: 'Norma–Outer', bk: 18, Rk: 4.46, p1: -1.0, p2: 19.5, b0: 5, b1: 270, col: 0xff9b8a },
  { n: 'Scutum–Centaurus', bk: 23, Rk: 4.91, p1: 14.1, p2: 12.1, b0: -10, b1: 300, col: 0x8ab8ff },
  { n: 'Sagittarius–Carina', bk: 24, Rk: 6.04, p1: 17.1, p2: 1.0, b0: -30, b1: 200, col: 0xd9a8ff },
  { n: 'Local (Orion Spur)', bk: 9, Rk: 8.26, p1: 11.4, p2: 11.4, b0: -14, b1: 40, col: 0x9fffd8 },
  { n: 'Perseus', bk: 40, Rk: 8.87, p1: 10.3, p2: 8.7, b0: -60, b1: 190, col: 0xffe08a },
];
const armR = (A, b) => A.Rk * Math.exp(-(b - A.bk) * deg * Math.tan((b < A.bk ? A.p1 : A.p2) * deg));
// galactocentric (R, β) -> heliocentric Galactic kpc: the Sun at β = 0, Galactic rotation toward +β (toward l = 90°)
const GC = V3(FACTS.R0, 0, -FACTS.zSun);
const armXYZ = (R, b) => V3(FACTS.R0 - R * Math.cos(b * deg), R * Math.sin(b * deg), -FACTS.zSun);
// the arms as used by the Galaxy model (volume shader and sampled stars): βkink, ln Rkink, tanψ<, tanψ>, β0, β1 (rad), strength
const ARM_TABLE = ARMS.map((A, k) => [A.bk * deg, Math.log(A.Rk), Math.tan(A.p1 * deg), Math.tan(A.p2 * deg),
  ({ 0: -5, 1: -25, 2: -45, 3: -25, 4: -85 })[k] * deg, ({ 0: 330, 1: 330, 2: 250, 3: 60, 4: 250 })[k] * deg, [0.75, 1.0, 0.75, 0.45, 1.0][k]]);
