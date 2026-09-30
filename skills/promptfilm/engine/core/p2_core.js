
/* =====================================================================================
   2. CORE — renderer, floating origin, utilities, and the authoring API the film's timeline calls.
   Pick one world unit for the film (km for space, m for a building, nm for a chip) and use it everywhere.
   ===================================================================================== */
const frameEl = document.getElementById('frame');
// the film's format, chosen at kickoff and written onto #frame by new_film.sh: aspect, caption languages, target loop length (s)
const FORMAT = {
  aspect: frameEl.dataset.aspect || '9x16',
  langs: (frameEl.dataset.langs || 'en ko').trim().split(/\s+/),
  length: (frameEl.dataset.length || '45-60').split('-').map(Number),
};
const ASPECT = (([w, h]) => w / h)(FORMAT.aspect.split('x').map(Number));   // frame width / height
const SHORT = Math.min(ASPECT, 1);             // short side / height: 1 for landscape and square frames
const HFOV = 38;                               // default field of view across the frame's SHORT side (deg) — the width in 9:16
// where each platform's player draws its own UI over the video (fractions of the frame); text and the essential subject stay out.
// side: [x0, y0, y1] — a column of buttons on the right from x0, between heights y0 and y1
const SAFE_ZONES = {
  '9x16': { top: 0.07, bottom: 0.20, side: [0.85, 0.45, 0.80] },   // Shorts / Reels / TikTok: top bar, title + channel, buttons
  '16x9': { top: 0.08, bottom: 0.12, side: null },                 // YouTube: title bar on pause, controls and progress bar
  '1x1':  { top: 0.04, bottom: 0.08, side: null },                 // feed posts: small icons only
  '4x5':  { top: 0.04, bottom: 0.08, side: null },
};
const SAFE = SAFE_ZONES[FORMAT.aspect] || SAFE_ZONES['9x16'];
const canvas = document.createElement('canvas');
frameEl.prepend(canvas);
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', stencil: false, preserveDrawingBuffer: false });
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
// floating origin: every object hangs off `universe` in world units; each frame the engine sets
// universe.matrix = S(1/D)·T(−target), so the camera sits one unit from its target at any scale (nm … Gly)
const universe = new THREE.Group();
universe.matrixAutoUpdate = false;
scene.add(universe);
const camera = new THREE.PerspectiveCamera(50, ASPECT, 1e-3, 1e4);
const NEAR = 1e-3, FAR = 1e4;

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
const fmtInt = n => Math.round(n).toLocaleString('en-US');
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

const NOISE_GLSL = `
  float hash13(vec3 p) { p = fract(p * 0.1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float vnoise(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash13(i), hash13(i + vec3(1,0,0)), f.x), mix(hash13(i + vec3(0,1,0)), hash13(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash13(i + vec3(0,0,1)), hash13(i + vec3(1,0,1)), f.x), mix(hash13(i + vec3(0,1,1)), hash13(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float fbm(vec3 p, int oct) { float s = 0.0, a = 0.5; for (int i = 0; i < 6; i++) { if (i >= oct) break; s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }
`;
// anti-aliased line: once a line is thinner than a pixel it fades to its average value (no moiré or shimmer)
const AA_GLSL = `float lineAA(float x, float hw) { float fw = fwidth(x); float f = abs(fract(x) - 0.5);
  float l = 1.0 - smoothstep(hw - fw, hw + fw, f); return mix(l, 2.0 * hw, smoothstep(0.35, 0.9, fw)); }`;

/* ---------- camera orientation: yaw / pitch in named frames ---------- */
// a frame gives the directions yaw/pitch are measured in: yaw 0, pitch 0 puts the eye on +back looking at the target
const CAMFRAMES = { world: { right: V3(1, 0, 0), up: V3(0, 1, 0), back: V3(0, 0, 1) } };
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

/* =====================================================================================
   AUTHORING API — the film's timeline (p8) calls these. Times are authored time τ (seconds) at a comfortable
   pace; the engine plays them through the speed profile built from the beats (see beat()).
   ===================================================================================== */
// `field` everywhere = the view's extent across the frame's SHORT side at the target (the width in 9:16, the height in 16:9);
// `hfov` = the field of view across that short side
const vfovOf = hfov => 2 * Math.atan(Math.tan(hfov * deg / 2) / SHORT) / deg;
const fieldToD = (field, hfov = HFOV) => field / (2 * Math.tan(hfov * deg / 2));
const KEYS = [], CAPS = [], TAGS_DEF = [], LEADER_DEF = [], CALLOUTS = [], BEATS = [], SOLIDS = [], SUBJECTS = [];
// a subject: something the text layers can point at and the camera must stay out of. pos in world units (a Vector3 or a
// function returning one), r = radius.
// o.fade(τ) → 0..1: how much of it is drawn at authored time τ (a subject that arrives or leaves); o.on(τ) instead, for
// an on/off switch. o.rv: the radius it looks on screen (with its glow), if larger than r. __bw.presenceCheck() then
// verifies it only ever fades in or out while it is outside the view. o.obj: the object drawn for it (a mesh or group) — what a caption
// about this subject is measured on (QA 'read'); without it the subject is only a sphere, and a caption can't be about it.
function subject(pos, r, o = {}) {
  const fade = o.fade || null;
  const s = { pos: typeof pos === 'function' ? pos : () => pos, r, rv: o.rv || r, fade, on: o.on || (fade ? (tau => fade(tau) > 0.001) : (() => true)), name: o.name || '', obj: o.obj || null };
  SUBJECTS.push(s); return s;
}
// a camera key: point T (world units), the view's short-side extent `field` there, direction yaw/pitch in a named frame.
// o: { frame, yaw, pitch, roll, hfov, flow (keep moving through this key; false = come to rest), ease: 'reveal',
//      at: where T sits on screen, as a fraction of the frame height from the top (default 0.5 = centre). Heroes go at ~0.35–0.42 so
//      the caption band below them stays clear (layout.md) }
function key(t, T, field, o = {}) {
  const hfov = o.hfov ?? HFOV, q = oriQuat(o.frame ?? 'world', o.yaw ?? 0, o.pitch ?? 0, o.roll ?? 0), T2 = T.clone();
  if (o.at !== undefined) T2.addScaledVector(V3(0, 1, 0).applyQuaternion(q), -(0.5 - o.at) * field / SHORT);   // move the aim point down → T rises on screen
  const k = { t, T: T2, D: fieldToD(field, hfov), q, hfov, flow: o.flow ?? true, ease: o.ease || null };
  KEYS.push(k); return k;
}
// a camera key from an explicit eye position (world units) looking at T, with the frame's up
function keyEye(t, eye, T, o = {}) {
  const d = eye.clone().sub(T), up = CAMFRAMES[o.frame ?? 'world'].up;
  _lm.lookAt(d.clone().normalize(), V3(0, 0, 0), up);
  const k = { t, T: T.clone(), D: d.length(), q: new THREE.Quaternion().setFromRotationMatrix(_lm), hfov: o.hfov ?? HFOV, flow: o.flow ?? true, ease: o.ease || null };
  KEYS.push(k); return k;
}
// caption: title and line in the film's first language, then `second` — the second language in plain words, written with its
// parentheses, e.g. '(…)'; '' when the film has one language. One at a time, never overlapping. tag / leader / callout take the same
// `second` argument and add the parentheses themselves (none when it is ''). (Stored as en / sub / ko inside the engine: older films
// and the QA hooks use those names.)
// about: what the caption tells about — the object drawn for it (a mesh or group), or a subject() made with { obj } — or a list of them.
// QA 'read' measures it on the pixels: visible (not hidden behind something), framed and large while the camera holds; every caption
// outside the way back needs one. (Meshes only: a line or points can't be measured — draw a thin thing as a tube.)
const caption = (t0, t1, title, line, second, about) => { CAPS.push([t0, t1, title, line, second, about || null]); };
// a label pinned to a 3D point: English name + (Korean). cls 'hyp' = hypothetical (dashed), 'below' = hangs under the point.
const tag = (t0, t1, pos, name, second, cls) => { TAGS_DEF.push({ t0, t1, p: typeof pos === 'function' ? pos : () => pos, en: name, ko: second, cls }); };
// a ring + line + name on a subject too small to see well; add showing windows with leader(...).wins.push([t0, t1])
function leader(subj, name, second) { let d = LEADER_DEF.find(l => l.subj === subj); if (!d) { d = { subj, en: name, ko: second, wins: [] }; LEADER_DEF.push(d); } return d; }
// the ratio beside a subject right after a reveal: big text (e.g. '×11.2'), an English line, a Korean line.
// side: 'above' | 'left' | 'right' (moved above automatically when there is no room)
const callout = (t0, t1, subj, big, line, second, side = 'above') => { CALLOUTS.push({ t0, t1, subj, big, sub: line, ko: second, side }); };
// pacing: every stretch of authored time belongs to one beat. kind sets how fast it plays (see SPEED_CLASS in the engine):
//   'hook' (the first seconds), 'key' (what people stay for), 'normal' (steady progress), 'transit' (a long move where nothing new
//   appears), 'return' (the way back to the first frame). speed overrides the class for one beat.
const beat = (t0, t1, kind, name, speed) => { BEATS.push({ t0, t1, kind, name, speed }); };
// the camera must never be inside this subject while it is drawn (checked by __bw.insideCheck)
const solid = subj => { SOLIDS.push(subj); return subj; };

/* ---------- keyframed values for anything that moves (objects, lights, materials) ---------- */
// tween(t, [[t0, v0, ease], [t1, v1, ease], ...]) → the value at t. Values: numbers or arrays of numbers. The ease of a key applies
// to the segment that starts there: 'smooth' (default), 'linear', 'in', 'out', 'hold'. Before the first / after the last key: held.
const EASES = { smooth: smoother, linear: x => x, in: x => x * x * x, out: x => 1 - Math.pow(1 - x, 3), hold: () => 0 };
function tween(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 0; i < keys.length - 1; i++) {
    const [ta, va, e = 'smooth'] = keys[i], [tb, vb] = keys[i + 1];
    if (t < tb) { const u = EASES[e](clamp01((t - ta) / (tb - ta)));
      return Array.isArray(va) ? va.map((a, k) => a + (vb[k] - a) * u) : va + (vb - va) * u; }
  }
  return keys[keys.length - 1][1];
}

/* ---------- embedded assets (logos, photos, 3D models the requester supplies; see scripts/embed_assets.py) ---------- */
const loadTextureData = (dataUrl, srgb = true) => new Promise((res, rej) => new THREE.TextureLoader().load(dataUrl, t => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; res(t); }, undefined, rej));
const loadGLBData = dataUrl => new Promise((res, rej) => new GLTFLoader().load(dataUrl, g => res(g.scene), undefined, rej));
// a soft studio environment for reflections on products and materials (scene.environment = studioEnv(); keep the background dark)
function studioEnv(blur = 0.04) { const pm = new THREE.PMREMGenerator(renderer); const t = pm.fromScene(new RoomEnvironment(), blur).texture; pm.dispose(); return t; }
