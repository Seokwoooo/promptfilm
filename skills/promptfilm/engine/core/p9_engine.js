
/* =====================================================================================
   9. ENGINE — camera evaluation, the speed profile, text layers, clock, render loop and QA hooks.
   Generic: nothing here knows the film's subject. The film (p8) must define before this part:
     LOOP_T                  authored length (s); the last camera key equals the first, so the loop closes on itself
     applyScene(τ, tp, field) sets every layer's state for authored time τ (tp = playback time, for ambient motion that
                             should keep its natural speed; field = the view's short-side extent at the target, world units)
   and may define:
     FILM_SPEED   { key: 2, ... }   overrides of SPEED_CLASS
     RULER        { min, max, ticks: [[value, label], ...], fmt: v => text } field-of-view ruler (world units), or null
     SCALE_PANEL  (field, τ) => null | { on: 0..1, k, v, r, n }  (HTML strings for the human-scale panel)
     EXPOSURE     (τ, field) => exposure multiplier (default 1)
     WARMUP_TAUS  [τ, ...] moments to pre-render before the first frame (every material / layer variant)
     READY        a promise to wait for (textures) before starting
   ===================================================================================== */
const params = new URLSearchParams(location.search);
const PROBLEMS = [];                       // authoring problems found at start-up (read by QA; the film still plays)

/* ---------- keys: order, hemisphere continuity ---------- */
KEYS.sort((a, b) => a.t - b.t);
KEYS.forEach((k, i) => { if (i && k.t <= KEYS[i - 1].t) throw new Error('camera keys out of order at ' + k.t.toFixed(2) + ' after ' + KEYS[i - 1].t.toFixed(2)); });
KEYS.forEach((k, i) => { if (i && KEYS[i - 1].q.dot(k.q) < 0) { k.q.x *= -1; k.q.y *= -1; k.q.z *= -1; k.q.w *= -1; } });
if (Math.abs(KEYS[KEYS.length - 1].t - LOOP_T) > 1e-6) PROBLEMS.push(`the last camera key (${KEYS[KEYS.length - 1].t.toFixed(2)}) is not at LOOP_T (${LOOP_T})`);

/* ---------- camera evaluation: log-distance, monotone Hermite, quaternions in the tangent space ---------- */
function monoTan(p0, p1, p2, t0, t1, t2) {                    // Fritsch–Carlson style tangent at the middle point
  const d0 = (p1 - p0) / (t1 - t0), d1 = (p2 - p1) / (t2 - t1);
  if (d0 * d1 <= 0) return 0;
  return 2 / (1 / d0 + 1 / d1);
}
const herm = (p0, p1, m0, m1, u, dt) => { const u2 = u * u, u3 = u2 * u; return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 * dt + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1 * dt; };
function qlog(q) { const v = V3(q.x, q.y, q.z), s = v.length(); if (s < 1e-9) return V3(0, 0, 0); const a = 2 * Math.atan2(s, q.w); return v.multiplyScalar(a / s); }
function qexp(v) { const a = v.length(); if (a < 1e-9) return new THREE.Quaternion(); const s = Math.sin(a / 2) / a; return new THREE.Quaternion(v.x * s, v.y * s, v.z * s, Math.cos(a / 2)); }
const KV = KEYS.map(k => ({ lnD: Math.log(k.D), hfov: k.hfov }));
const CAM = { T: new THREE.Vector3(), D: 1, q: new THREE.Quaternion(), hfov: HFOV };
function evalCamera(tau) {
  let i = 0; while (i < KEYS.length - 2 && tau >= KEYS[i + 1].t) i++;
  const k0 = KEYS[i], k1 = KEYS[i + 1], dt = k1.t - k0.t, u = clamp01((tau - k0.t) / dt);
  if (k1.ease === 'reveal') return evalReveal(k0, k1, u, i);
  const kp = KEYS[i - 1], kn = KEYS[i + 2];
  const tanOf = (fn, j) => {                                     // tangent at key j for scalar channel fn
    const a = KEYS[j - 1], b = KEYS[j], c = KEYS[j + 1];
    if (!a || !c || !b.flow) return 0;
    return monoTan(fn(j - 1), fn(j), fn(j + 1), a.t, b.t, c.t);
  };
  const lnD = j => KV[j].lnD, hf = j => KV[j].hfov;
  CAM.D = Math.exp(herm(KV[i].lnD, KV[i + 1].lnD, tanOf(lnD, i), tanOf(lnD, i + 1), u, dt));
  CAM.hfov = herm(k0.hfov, k1.hfov, tanOf(hf, i), tanOf(hf, i + 1), u, dt);
  // target: while the distance changes a lot, move the target in proportion to the zoom (keeps the subject framed)
  if (Math.abs(KV[i + 1].lnD - KV[i].lnD) > 0.7) {
    const D0 = Math.exp(KV[i].lnD), D1 = Math.exp(KV[i + 1].lnD);
    CAM.T.copy(k0.T).lerp(k1.T, clamp01((CAM.D - D0) / (D1 - D0)));
  } else {
    for (const ax of ['x', 'y', 'z']) {
      const f = k => k.T[ax];
      const m0 = (k0.flow && kp) ? monoTan(f(kp), f(k0), f(k1), kp.t, k0.t, k1.t) : 0;
      const m1 = (k1.flow && kn) ? monoTan(f(k0), f(k1), f(kn), k0.t, k1.t, kn.t) : 0;
      CAM.T[ax] = herm(k0.T[ax], k1.T[ax], m0, m1, u, dt);
    }
  }
  // orientation: Hermite on rotation vectors in the tangent space of k0
  const q0i = k0.q.clone().invert();
  const r1 = qlog(q0i.clone().multiply(k1.q));
  const rp = kp ? qlog(q0i.clone().multiply(kp.q)) : null, rn = kn ? qlog(q0i.clone().multiply(kn.q)) : null;
  const r = V3(0, 0, 0);
  for (const ax of ['x', 'y', 'z']) {
    const m0 = (k0.flow && rp) ? monoTan(rp[ax], 0, r1[ax], kp.t, k0.t, k1.t) : 0;
    const m1 = (k1.flow && rn) ? monoTan(0, r1[ax], rn[ax], k0.t, k1.t, kn.t) : 0;
    r[ax] = herm(0, r1[ax], m0, m1, u, dt);
  }
  CAM.q.copy(k0.q).multiply(qexp(r));
  return CAM;
}
// a reveal ('reveal' on the arriving key): one front-loaded curve — eases in over the first 20%, then settles exponentially
const revealCurve = (() => {
  const N = 400, a = 0.2, e = 2.4, arr = new Float64Array(N + 1); let acc = 0;
  for (let k = 1; k <= N; k++) { const u = (k - 0.5) / N; acc += smoother(clamp01(u / a)) * Math.exp(-e * Math.max(u - a, 0)) / N; arr[k] = acc; }
  for (let k = 0; k <= N; k++) arr[k] /= acc;
  return u => { const f = clamp01(u) * N, k = Math.min(N - 1, Math.floor(f)); return arr[k] + (arr[k + 1] - arr[k]) * (f - k); };
})();
function evalReveal(k0, k1, u, i) {
  const w = revealCurve(u);
  CAM.D = Math.exp(lerp(KV[i].lnD, KV[i + 1].lnD, w)); CAM.hfov = lerp(k0.hfov, k1.hfov, w);
  const D0 = Math.exp(KV[i].lnD), D1 = Math.exp(KV[i + 1].lnD);
  CAM.T.copy(k0.T).lerp(k1.T, Math.abs(D1 - D0) > 1e-9 * D0 ? clamp01((CAM.D - D0) / (D1 - D0)) : w);
  CAM.q.copy(k0.q).slerp(k1.q, smoother(clamp01(0.55 * u + 0.45 * w)));        // the turn is spread over the whole reveal
  return CAM;
}
const CAM_POS = new THREE.Vector3(), _eye = new THREE.Vector3();
let PXR = 1;                                                     // CSS pixels per radian at the centre of the view
function placeCamera(tau) {
  const c = evalCamera(tau);
  _eye.set(0, 0, 1).applyQuaternion(c.q);                        // unit vector from target to eye
  CAM_POS.copy(c.T).addScaledVector(_eye, c.D);                  // the eye in world units
  universe.matrix.makeScale(1 / c.D, 1 / c.D, 1 / c.D).multiply(new THREE.Matrix4().makeTranslation(-c.T.x, -c.T.y, -c.T.z));
  universe.matrixWorldNeedsUpdate = true;
  camera.position.copy(_eye); camera.quaternion.copy(c.q);
  camera.fov = vfovOf(c.hfov); camera.near = NEAR; camera.far = FAR; camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  scene.updateMatrixWorld(true);
  PXR = ((frameEl.__H || 1) / 2) / Math.tan(camera.fov * deg / 2);
  return c;
}
const fieldNow = () => 2 * CAM.D * Math.tan(CAM.hfov * deg / 2);    // the view's short-side extent at the target (world units)

/* ---------- the speed profile: every beat plays at its class's speed (the user's own editing: what people stay for at
   ×2, steady progress at ×3–4, long empty moves at ×8), with short eased changes ---------- */
const SPEED_CLASS = Object.assign({ hook: 2, key: 2, normal: 3.5, transit: 8, return: 3 }, typeof FILM_SPEED !== 'undefined' ? FILM_SPEED : {});
const SPEED_EASE = 0.3;                     // playback seconds over which the speed changes at a beat boundary (each side)
BEATS.sort((a, b) => a.t0 - b.t0);
// the requester's pace edits (Promptfilm Studio writes them to parts/p8z_pace.js as PACE_EDITS): per beat, by name — 'Inside#2'
// is the second beat named 'Inside' — { speed, kind }. The authored values stay in b.authored; paceApply(edits) sets them again.
BEATS.forEach((b, i) => { const n = BEATS.slice(0, i).filter(x => x.name === b.name).length; b.key = n ? `${b.name}#${n + 1}` : b.name; b.authored = { kind: b.kind, speed: b.speed }; });
function paceApply(edits) {
  const e = edits || {};
  for (const b of BEATS) { const x = e[b.key]; b.kind = (x && x.kind) || b.authored.kind; b.speed = x && +x.speed > 0 ? +x.speed : b.authored.speed; }
  return Object.keys(e).filter(k => !BEATS.some(b => b.key === k));            // edits that match no beat any more
}
paceApply(typeof PACE_EDITS !== 'undefined' ? PACE_EDITS : null).forEach(k => PROBLEMS.push(`pace edit '${k}' matches no beat (the beats were renamed or removed)`));
{
  let t = 0;
  for (const b of BEATS) {
    if (b.t0 > t + 1e-6) PROBLEMS.push(`no beat covers τ ${t.toFixed(2)}–${b.t0.toFixed(2)} (played as 'normal')`);
    if (b.t0 < t - 1e-6) PROBLEMS.push(`beats overlap at τ ${b.t0.toFixed(2)} (${b.name})`);
    if (!(b.kind in SPEED_CLASS) && !b.speed) PROBLEMS.push(`beat '${b.name}' has an unknown kind '${b.kind}'`);
    t = Math.max(t, b.t1);
  }
  if (t < LOOP_T - 1e-6) PROBLEMS.push(`no beat covers τ ${t.toFixed(2)}–${LOOP_T} (played as 'normal')`);
}
const beatSpeed = b => b.speed || SPEED_CLASS[b.kind] || SPEED_CLASS.normal;
function speedAt(tau) {                    // authored seconds per playback second at τ
  let i = BEATS.findIndex(b => tau >= b.t0 && tau < b.t1);
  if (i < 0) return SPEED_CLASS.normal;
  const b = BEATS[i], s = beatSpeed(b);
  const blend = (nb, edge) => {            // blend (in log speed) towards the neighbour across the boundary at `edge`
    if (!nb) return s;
    const s2 = beatSpeed(nb), h = Math.min(SPEED_EASE * (s + s2) / 2, 0.45 * (b.t1 - b.t0), 0.45 * (nb.t1 - nb.t0));
    const d = Math.abs(tau - edge); if (d >= h) return s;
    const w = 0.5 * (1 - smoother(d / h));  // 0.5 at the boundary, 0 at distance h
    return Math.exp(lerp(Math.log(s), Math.log(s2), w));
  };
  const toPrev = BEATS[i - 1] && BEATS[i - 1].t1 >= b.t0 - 1e-6 ? BEATS[i - 1] : null;
  const toNext = BEATS[i + 1] && BEATS[i + 1].t0 <= b.t1 + 1e-6 ? BEATS[i + 1] : null;
  return tau - b.t0 < b.t1 - tau ? blend(toPrev, b.t0) : blend(toNext, b.t1);
}
function warpBuild() {
  const dT = 0.002, N = Math.round(LOOP_T / dT), tt = new Float64Array(N + 1);
  for (let i = 0; i < N; i++) tt[i + 1] = tt[i] + dT / speedAt((i + 0.5) * dT);
  const len = tt[N];
  const toTau = tp => { tp = Math.min(Math.max(tp, 0), len); let lo = 0, hi = N;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tt[m] <= tp) lo = m; else hi = m; }
    return (lo + (tp - tt[lo]) / Math.max(1e-12, tt[hi] - tt[lo])) * dT; };
  const toT = tau => { const f = Math.min(Math.max(tau, 0), LOOP_T) / dT, i = Math.min(N - 1, Math.floor(f)); return tt[i] + (tt[i + 1] - tt[i]) * (f - i); };
  return { len, toTau, toT };
}
let WARP = warpBuild();
let LOOP = WARP.len;                       // playback seconds per loop (retime() may change it: read it when needed, never copy it)
const toPlay = tau => WARP.toT(tau);       // authored -> playback time

/* ---------- text layers: all fades in playback seconds, so they stay readable however fast a stretch plays ---------- */
CAPS.sort((a, b) => a[0] - b[0]);
CAPS.forEach((l, i) => { if (i && l[0] < CAPS[i - 1][1] - 1e-6) throw new Error('captions overlap at τ ' + l[0].toFixed(2) + ' (' + l[2] + ')'); });
const CAPS_T = CAPS.map(l => ({ tau0: l[0], tau1: l[1], t0: toPlay(l[0]), t1: toPlay(l[1]), en: l[2], sub: l[3], ko: l[4], about: l[5] ? [].concat(l[5]) : [] }));
CAPS_T.forEach(c => { if (c.t1 - c.t0 < 1.0) PROBLEMS.push(`caption '${c.en}' is on screen ${(c.t1 - c.t0).toFixed(2)} s (< 1.0 s)`); });
const FADE = { cap: 0.2, tag: 0.2, lead: 0.15, co: 0.15 };
const capEl = document.getElementById('caption'), capMain = document.getElementById('cap-main'), capSub = document.getElementById('cap-sub'), capKo = document.getElementById('cap-ko');
// the film's languages (FORMAT.langs): the first for titles and lines, the second (optional) for the plain-words line in parentheses
const L1 = FORMAT.langs[0] || 'en', L2 = FORMAT.langs[1] || '';
document.documentElement.lang = L1; capMain.lang = capSub.lang = L1; capKo.lang = L2 || L1;
// right-to-left scripts (Arabic, Persian, Urdu, Hebrew …): those lines run right to left; the layout stays as it is
const isRTL = l => /^(ar|fa|ur|he|yi|ps|sd|ug|dv)(-|$)/.test(l || '');
const DIR1 = isRTL(L1) ? ' dir="rtl"' : '', DIR2 = isRTL(L2) ? ' dir="rtl"' : '';
if (DIR1) capMain.dir = capSub.dir = 'rtl';
if (isRTL(L2 || L1)) capKo.dir = 'rtl';
let capCurrent = null, CAP_A = 0;
function applyCaption(tp) {
  const L = CAPS_T.find(l => tp >= l.t0 && tp <= l.t1) || null;
  if (L !== capCurrent) { capCurrent = L; if (L) { capMain.textContent = L.en; capSub.textContent = L.sub; capKo.textContent = L.ko; } }
  const a = L ? smoother(range(tp, L.t0, L.t0 + FADE.cap)) * (1 - smoother(range(tp, L.t1 - FADE.cap, L.t1))) : 0;
  CAP_A = a;
  capEl.style.opacity = a.toFixed(3);
  capEl.style.transform = `translateY(${((1 - a) * 0.6).toFixed(3)}cqmin)`;
}
// where the text boxes are, so pinned labels keep off them (CSS px, relative to the frame)
let FRAME_RECT = null;
const rectOf = el => { const a = el.getBoundingClientRect(), f = FRAME_RECT; return [a.left - f.left, a.top - f.top, a.right - f.left, a.bottom - f.top]; };
const HUD_EL = document.getElementById('hud'), SCALE_EL = document.getElementById('scale');
function textObstacles() {
  FRAME_RECT = frameEl.getBoundingClientRect();
  const o = [];
  if (CAP_A > 0.05) o.push(rectOf(capEl));
  if (HUD_EL.style.display !== 'none' && +(HUD_EL.style.opacity || 1) > 0.2) { const r = rectOf(HUD_EL), m = Math.min(FRAME_RECT.width, FRAME_RECT.height); r[1] -= 0.04 * m; r[0] -= 0.02 * m; o.push(r); }
  if (+(SCALE_EL.style.opacity || 0) > 0.05) o.push(rectOf(SCALE_EL));
  return o;
}
// the area pinned labels may use: clear of the player's own UI (SAFE: top bar, bottom band, buttons on the right)
const LABEL_Y1 = 1 - SAFE.bottom - 0.02;
const inLabelZone = (x, y, W, H) => x > 0.04 * W && x < 0.96 * W && y > SAFE.top * H && y < LABEL_Y1 * H && !(SAFE.side && x > (SAFE.side[0] - 0.01) * W && y > SAFE.side[1] * H);
const overlaps = (r, list) => list.some(o => r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1]);
// a label's box [x0, y0, x1, y1] (CSS px) stays clear of the player's UI zones too, not only its anchor point
const boxClear = (r, W, H) => r[0] > 0 && r[2] < W && r[1] > SAFE.top * H && r[3] < (1 - SAFE.bottom) * H &&
  !(SAFE.side && r[2] > SAFE.side[0] * W && r[3] > SAFE.side[1] * H && r[1] < SAFE.side[2] * H);

const _cv = new THREE.Vector3();
function screenOf(s) {                              // screen position (CSS px) and radius of a subject, or null (behind the camera)
  const p = s.pos();
  _cv.copy(p).sub(CAM.T).multiplyScalar(1 / CAM.D).project(camera);
  if (_cv.z >= 1) return null;
  const W = frameEl.__W, H = frameEl.__H;
  return { x: (_cv.x * 0.5 + 0.5) * W, y: (-_cv.y * 0.5 + 0.5) * H, r: s.r / Math.max(1e-30, CAM_POS.distanceTo(p)) * PXR };
}

// how much of the frame a subject's disc covers (0..1), counting only the part inside the frame (for exposure: a bright
// body just outside the view must not darken the picture)
function screenCover(s, rScale = 1) {
  const sp = screenOf(s); if (!sp) return 0;
  const W = frameEl.__W, H = frameEl.__H, r = sp.r * rScale;
  const ox = Math.max(0, Math.min(W, sp.x + r) - Math.max(0, sp.x - r)), oy = Math.max(0, Math.min(H, sp.y + r) - Math.max(0, sp.y - r));
  return clamp01(ox * oy * (Math.PI / 4) / (W * H));
}

const tagsEl = document.getElementById('tags');
const TAGS = TAGS_DEF.map(d => {
  const el = document.createElement('div'); el.className = 'tag' + (d.cls ? ' ' + d.cls : '');
  const box = document.createElement('div'), b = document.createElement('b'), k = document.createElement('i');
  b.textContent = d.en; if (DIR1) b.dir = 'rtl'; box.append(b); if (d.ko) { k.textContent = '(' + d.ko + ')'; if (DIR2) k.dir = 'rtl'; box.append(k); } el.appendChild(box); tagsEl.appendChild(el);
  return { ...d, tp0: toPlay(d.t0), tp1: toPlay(d.t1), el, box, shown: false };
});
function applyTags(tp, obst) {
  const W = frameEl.__W, H = frameEl.__H, placed = [];
  TAGS.forEach(g => {
    const a = pulse(tp, g.tp0, g.tp0 + FADE.tag, g.tp1 - FADE.tag, g.tp1);
    if (a > 0.001) {
      _cv.copy(g.p()).sub(CAM.T).multiplyScalar(1 / CAM.D).project(camera);
      const x = (_cv.x * 0.5 + 0.5) * W, y = (-_cv.y * 0.5 + 0.5) * H;
      const w = g.box.offsetWidth || 80, h = g.box.offsetHeight || 30, below = g.el.classList.contains('below');
      const r = below ? [x - w / 2, y + 12, x + w / 2, y + 12 + h] : [x - w / 2, y - 12 - h, x + w / 2, y - 12];
      if (_cv.z < 1 && inLabelZone(x, y, W, H) && boxClear(r, W, H) && !overlaps(r, obst) && !overlaps(r, placed)) {
        placed.push([r[0] - 6, r[1] - 6, r[2] + 6, r[3] + 6]);
        g.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
        g.el.style.opacity = a.toFixed(3); g.shown = true; return;
      }
    }
    if (g.shown) { g.el.style.opacity = '0'; g.shown = false; }
  });
  obst.push(...placed);
}

const coEl = document.getElementById('callouts'), svgNS = 'http://www.w3.org/2000/svg', ldSvg = document.getElementById('leaders');
const COS = CALLOUTS.map(c => {
  const el = document.createElement('div'); el.className = 'co';
  const lab = document.createElement('div'); lab.className = 'lab';
  lab.innerHTML = `<b>${c.big}</b>${c.sub ? `<span${DIR1}>${c.sub}</span>` : ''}${c.ko ? `<i${DIR2}>(${c.ko})</i>` : ''}`;
  el.append(lab); coEl.appendChild(el);
  const line = document.createElementNS(svgNS, 'polyline'); line.style.opacity = '0'; ldSvg.appendChild(line);
  return { ...c, tp0: toPlay(c.t0), tp1: toPlay(c.t1), el, lab, line, shown: false };
});
function applyCallouts(tp, obst) {
  const W = frameEl.__W, H = frameEl.__H;
  COS.forEach(c => {
    const a = pulse(tp, c.tp0, c.tp0 + FADE.co, c.tp1 - FADE.co, c.tp1);
    const sp = a > 0.001 ? screenOf(c.subj) : null;
    if (sp) {
      const w = c.lab.offsetWidth || 160, h = c.lab.offsetHeight || 50;
      const place = side => side === 'left' ? [sp.x - sp.r - 18 - w / 2, sp.y - sp.r * 0.15] : side === 'right' ? [sp.x + sp.r + 18 + w / 2, sp.y - sp.r * 0.15] : [sp.x, sp.y - sp.r - 16 - h / 2];
      let best = null, bestPen = Infinity;
      for (const side of [c.side, 'above', 'left', 'right']) {       // the preferred side first; move when it is crowded or off-frame
        let [lx, ly] = place(side);
        const pen0 = (lx - w / 2 < 8 || lx + w / 2 > W - 8 || ly - h / 2 < SAFE.top * H) ? 1 : 0;
        lx = clamp(lx, w / 2 + 10, W - w / 2 - 10); ly = clamp(ly, SAFE.top * H + h / 2, (LABEL_Y1 - 0.04) * H - h / 2);
        const r = [lx - w / 2 - 6, ly - h / 2 - 6, lx + w / 2 + 6, ly + h / 2 + 6];
        const pen = pen0 + (overlaps(r, obst) ? 2 : 0) + (side === c.side ? 0 : 0.1);
        if (pen < bestPen) { bestPen = pen; best = [lx, ly, r]; }
        if (pen < 0.05) break;
      }
      const [lx, ly, r] = best;
      c.el.style.transform = `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px) scale(${(0.94 + 0.06 * a).toFixed(3)})`;
      c.el.style.opacity = a.toFixed(3); c.shown = true;
      obst.push(r);
      // a short connector from the subject's edge to the label
      const ux = lx - sp.x, uy = ly - sp.y, ul = Math.hypot(ux, uy) || 1;
      const sx = sp.x + ux / ul * (sp.r + 4), sy = sp.y + uy / ul * (sp.r + 4);
      const ex = clamp(sx, lx - w / 2, lx + w / 2), ey = clamp(sy, ly - h / 2, ly + h / 2);
      if (Math.hypot(ex - sx, ey - sy) > 6) { c.line.setAttribute('points', `${sx.toFixed(1)},${sy.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`); c.line.style.opacity = a.toFixed(3); }
      else c.line.style.opacity = '0';
      return;
    }
    if (c.shown) { c.el.style.opacity = '0'; c.line.style.opacity = '0'; c.shown = false; }
  });
}

const ldBox = document.getElementById('leadlabs');
const LDS = LEADER_DEF.map(d => {
  const g = document.createElementNS(svgNS, 'g'), ring = document.createElementNS(svgNS, 'circle'), line = document.createElementNS(svgNS, 'polyline');
  g.append(line, ring); g.style.opacity = '0'; ldSvg.appendChild(g);
  const lab = document.createElement('div'); lab.className = 'ld';
  const box = document.createElement('div'); box.innerHTML = `<b${DIR1}>${d.en}</b>${d.ko ? `<i${DIR2}>(${d.ko})</i>` : ''}`; lab.appendChild(box); ldBox.appendChild(lab);
  return { ...d, winsT: d.wins.map(([a, b]) => [toPlay(a), toPlay(b)]), g, ring, line, lab, box, shown: false };
});
const LEAD_CANDS = [[0, -0.05], [-0.1, -0.08], [0.1, -0.08], [0, -0.11], [-0.16, -0.13], [0.16, -0.13], [0, -0.17], [0, 0.07]];
let TAU_NOW = 0;
function applyLeaders(tp, obst) {
  const W = frameEl.__W, H = frameEl.__H;
  let discs = null;
  LDS.forEach(d => {
    let a = 0; for (const [t0, t1] of d.winsT) a = Math.max(a, pulse(tp, t0, t0 + FADE.lead, t1 - FADE.lead, t1));
    const sp = a > 0.001 && d.subj.on(TAU_NOW) ? screenOf(d.subj) : null;
    if (sp && sp.x > -4 && sp.x < W + 4 && sp.y > (SAFE.top - 0.02) * H && sp.y < (1 - SAFE.bottom) * H) {
      if (!discs) discs = SUBJECTS.filter(s => s.on(TAU_NOW)).map(screenOf).filter(q => q && q.r > 6);
      const rr = sp.r < 36 ? Math.max(sp.r + 5, 7) : 0, top = sp.y - (rr || sp.r);
      const w = d.box.offsetWidth || 70, h = d.box.offsetHeight || 34;
      // the spot with the least clutter: overlapping another text box (worst), the line crossing one, a subject under the label
      let best = null, bestPen = Infinity;
      const segHits = (x0, y0, x1, y1, r) => { for (let k = 1; k < 12; k++) { const u = k / 12, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u; if (x > r[0] && x < r[2] && y > r[1] && y < r[3]) return true; } return false; };
      for (let ci = 0; ci < LEAD_CANDS.length; ci++) {
        const [dx, dy] = LEAD_CANDS[ci];
        const cx = clamp(sp.x + dx * W, w / 2 + 8, W - w / 2 - 8), cy = clamp(top + dy * H, SAFE.top * H + h, (LABEL_Y1 - 0.02) * H);
        const box = [cx - w / 2, cy - h, cx + w / 2, cy];
        let pen = ci * 0.01 + (inLabelZone(cx, cy - h / 2, W, H) ? 0 : 2);
        for (const o of obst) { const ox = Math.max(0, Math.min(o[2], box[2]) - Math.max(o[0], box[0])), oy = Math.max(0, Math.min(o[3], box[3]) - Math.max(o[1], box[1]));
          pen += 4 * ox * oy / (w * h); if (segHits(sp.x, top, cx, cy, o)) pen += 1.5; }
        for (const q of discs) if ((clamp(q.x, box[0], box[2]) - q.x) ** 2 + (clamp(q.y, box[1], box[3]) - q.y) ** 2 < (q.r + 4) ** 2) pen += 1;
        if (pen < bestPen) { bestPen = pen; best = [cx, cy, box]; }
        if (pen < 0.1) break;
      }
      const [cx, cy, box] = best;
      obst.push(box);
      const ux = cx - sp.x, uy = cy - sp.y, ul = Math.hypot(ux, uy) || 1;
      const x0 = sp.x + ux / ul * (rr || sp.r), y0 = sp.y + uy / ul * (rr || sp.r);
      d.line.setAttribute('points', `${x0.toFixed(1)},${y0.toFixed(1)} ${cx.toFixed(1)},${cy.toFixed(1)}`);
      if (rr) { d.ring.setAttribute('cx', sp.x.toFixed(1)); d.ring.setAttribute('cy', sp.y.toFixed(1)); d.ring.setAttribute('r', rr.toFixed(1)); d.ring.style.display = ''; }
      else d.ring.style.display = 'none';
      d.lab.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px)`;
      d.g.style.opacity = d.lab.style.opacity = a.toFixed(3); d.shown = true;
      return;
    }
    if (d.shown) { d.g.style.opacity = d.lab.style.opacity = '0'; d.shown = false; }
  });
}

/* ---------- field-of-view ruler (log scale) and the human-scale panel ---------- */
const HUD = { mark: document.getElementById('hud-mark'), val: document.getElementById('hud-val'), last: '' };
const HAS_RULER = typeof RULER !== 'undefined' && RULER;
if (HAS_RULER) {
  // the ruler's title in the film's languages: RULER.title = [first, second]; the default is English + (Korean)
  const tt = RULER.title || (L1 === 'en' ? ['Field of view', L2 === 'ko' ? '화면 폭' : ''] : null);
  if (!tt) PROBLEMS.push(`RULER.title is missing: the default is English, the film's languages are ${FORMAT.langs.join(' ')}`);
  else document.getElementById('hud-title').innerHTML = tt[0] + (tt[1] ? ` <span>(${tt[1]})</span>` : '');
  RULER.ticks.forEach(([v, n]) => {
    const d = document.createElement('div'); d.className = 'tick'; d.style.top = (lrange(v, RULER.min, RULER.max) * 100).toFixed(3) + '%';
    const s = document.createElement('span'); s.textContent = n; d.appendChild(s); HUD_EL.appendChild(d);
  });
} else HUD_EL.style.display = 'none';
function applyHud(field) {
  if (!HAS_RULER) return;
  const top = (lrange(field, RULER.min, RULER.max) * 100).toFixed(2) + '%'; HUD.mark.style.top = top; HUD.val.style.top = top;
  const txt = '≈ ' + RULER.fmt(field); if (txt !== HUD.last) { HUD.val.textContent = txt; HUD.last = txt; }
}
const SCALE = { k: SCALE_EL.querySelector('.k'), v: SCALE_EL.querySelector('.v'), r: SCALE_EL.querySelector('.r'), n: SCALE_EL.querySelector('.n'), last: '' };
function applyScale(field, tau) {
  const p = typeof SCALE_PANEL === 'function' ? SCALE_PANEL(field, tau) : null;
  const on = p ? clamp01(p.on ?? 1) : 0;
  SCALE_EL.style.opacity = on.toFixed(3);
  if (on < 0.002) return;
  const key = p.k + p.v + p.r + p.n; if (key === SCALE.last) return; SCALE.last = key;
  SCALE.k.innerHTML = p.k || ''; SCALE.v.innerHTML = p.v || ''; SCALE.r.innerHTML = p.r || ''; SCALE.n.innerHTML = p.n || '';
}

/* ---------- clock, input, resize ---------- */
const startT = Math.min(Math.max(parseFloat(params.get('t')) || 0, 0), LOOP - 0.001);
let playing = !params.has('freeze'), base0 = performance.now(), offset = startT;
const nowT = now => playing ? (((offset + (now - base0) / 1000) % LOOP) + LOOP) % LOOP : offset;
function pause(now) { offset = nowT(now); playing = false; }
function play(now) { base0 = now; playing = true; }
window.addEventListener('keydown', e => {
  const now = performance.now();
  if (e.code === 'Space') { e.preventDefault(); playing ? pause(now) : play(now); }
  else if (e.code === 'KeyR') { offset = 0; base0 = now; }
  else if (e.code === 'KeyH') frameEl.classList.toggle('nolabels');
});
if (params.get('text') === '0') frameEl.classList.add('nolabels');
if (params.has('safe')) {                         // draw the player's UI zones (SAFE) for a look at the layout
  const box = document.getElementById('safe'), z = (css) => { const d = document.createElement('div'); d.style.cssText = css; box.appendChild(d); };
  z(`left:0;right:0;top:0;height:${SAFE.top * 100}%`); z(`left:0;right:0;bottom:0;height:${SAFE.bottom * 100}%`);
  if (SAFE.side) z(`right:0;width:${(1 - SAFE.side[0]) * 100}%;top:${SAFE.side[1] * 100}%;bottom:${(1 - SAFE.side[2]) * 100}%`);
  box.hidden = false;
}
function resize() {
  const W = Math.max(1, Math.floor(frameEl.clientWidth)), H = Math.max(1, Math.floor(frameEl.clientHeight));
  const pr = Math.min(window.devicePixelRatio || 1, 2, 1920 / Math.max(W, H));   // the long side never more than 1920 device pixels
  renderer.setPixelRatio(pr); renderer.setSize(W, H, false);
  ldSvg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  resizePost(W, H, pr);
  camera.aspect = W / H; camera.updateProjectionMatrix();
  frameEl.__W = W; frameEl.__H = H; frameEl.__pr = pr;
}
window.addEventListener('resize', resize);
resize();

/* ---------- one frame ---------- */
const SHUTTER = 1 / 50;                     // playback seconds: the motion-blur shutter
const PREV = { T: new THREE.Vector3(), D: 1, q: new THREE.Quaternion() }, _fw = new THREE.Vector3();
function renderAt(tp) {
  const tau = WARP.toTau(tp);
  { const c = evalCamera(WARP.toTau((((tp - SHUTTER) % LOOP) + LOOP) % LOOP)); PREV.T.copy(c.T); PREV.D = c.D; PREV.q.copy(c.q); }
  placeCamera(tau);
  TAU_NOW = tau;
  const field = fieldNow();
  applyScene(tau, tp, field);
  scene.updateMatrixWorld(true);
  applyCaption(tp); applyHud(field); applyScale(field, tau);
  const obst = textObstacles(); applyCallouts(tp, obst); applyLeaders(tp, obst); applyTags(tp, obst);
  // motion blur: zoom about the previous target, plus the turn of the view direction
  {
    const zoom = 1 - CAM.D / PREV.D;                                   // > 0 when pulling back
    _cv.copy(PREV.T).sub(CAM.T).multiplyScalar(1 / CAM.D).project(camera);
    const c = V3(_cv.x * 0.5 + 0.5, _cv.y * 0.5 + 0.5, 0);
    _fw.set(0, 0, -1).applyQuaternion(PREV.q).add(camera.position);    // where the view pointed before, projected now
    _fw.project(camera);
    const sh = new THREE.Vector2(_fw.x * 0.5, _fw.y * 0.5);
    const mag = Math.abs(zoom) * 0.7 + sh.length();
    mblurPass.uniforms.uC.value.set(clamp(c.x, -0.5, 1.5), clamp(c.y, -0.5, 1.5));
    // a real 1/50 s shutter at 60 fps streaks ~1.2 frames of motion. Small moves get that full streak — without it a detailed
    // scene under a slowly moving camera (~1 px per frame) steps pixel by pixel and reads as shimmer (QA flicker); large moves
    // keep the shorter, calmer streak (0.6)
    const big = smoother(clamp01((mag - 0.004) / 0.02)), k = lerp(1.2, typeof FILM_MB_BIG === 'number' ? FILM_MB_BIG : 0.6, big);   // (FILM_MB_BIG: a film may keep the full streak on big moves)
    mblurPass.uniforms.uZoom.value = zoom * 0.75 * k / 0.6; mblurPass.uniforms.uShift.value.copy(sh).multiplyScalar(k);
    mblurPass.uniforms.uAmt.value = __bw._dbg.flags.noMB ? 0 : lerp(0.95, 0.85, big) * smoother(clamp01((mag - 0.0002) / 0.001));
  }
  mblurPass.uniforms.uExposure.value = typeof EXPOSURE === 'function' ? EXPOSURE(tau, field) : 1;
  if (bokehPass) { const d = FILM_DOF(tau, field); bokehPass.uniforms.focus.value = 1.0; bokehPass.uniforms.aperture.value = d.aperture; bokehPass.uniforms.maxblur.value = d.maxblur; }
  renderer.toneMappingExposure = 1;
  grainPass.uniforms.uSeed.value = (Math.floor(tp * 24) % 97) * 1.37;
  composer.render();
}
const FT = new Float32Array(20000); let ftN = 0, lastNow = 0;
let HOST_DRAWS = false, LOOP_ON = true;     // a host (the Studio, the MP4 renderer) draws every frame through seek(); the loop then rests
function frame(now) {
  if (HOST_DRAWS) { LOOP_ON = false; lastNow = 0; return; }
  if (lastNow) { FT[ftN % FT.length] = now - lastNow; ftN++; }
  lastNow = now;
  renderAt(nowT(now));
  requestAnimationFrame(frame);
}

/* ---------- what the camera really sees, for QA: the scene drawn once more with plain materials into a small float target ----------
   R = the nearest opaque surface is the BACK of a surface that should never be seen from behind — the camera is inside a model, or
       looks through a missing roof, wall, lid or face (one-sided: the real picture shows a hole there; two-sided and not marked thin:
       a hollow model). Parts meant to be seen from both sides say so: material.userData.thin = true (or the mesh's userData.thin).
   G = its distance along the view, in target distances (the target is always at 1): a wall against the lens is < 0.08
   B = one of the marked meshes (a caption's subject, for aboutCheck) is the nearest surface there — occlusion included */
const SCAN = {};
function scanRender(w, marks) {
  const h = Math.max(1, Math.round(w * frameEl.__H / frameEl.__W));
  if (!SCAN.rt) {
    const mk = (back, mark) => { const m = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
      m.onBeforeCompile = sh => {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vScanZ;').replace('#include <project_vertex>', '#include <project_vertex>\nvScanZ = -mvPosition.z;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vScanZ;').replace(/}\s*$/, `  gl_FragColor = vec4(${back ? '(gl_FrontFacing ? 0.0 : 1.0)' : '0.0'}, vScanZ, ${mark ? '1.0' : '0.0'}, 1.0);\n}`);
      };
      m.customProgramCacheKey = () => `pf-scan-${back}-${mark}`; return m; };
    SCAN.back = mk(1, 0); SCAN.plain = mk(0, 0); SCAN.mark = mk(0, 1); SCAN.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.FloatType });
  }
  SCAN.rt.setSize(w, h);
  const undo = [];
  scene.traverse(o => {
    const marked = !!(marks && marks.has(o));
    if (o.isPoints || o.isLine || o.isSprite) { if (o.visible) { undo.push(() => { o.visible = true; }); o.visible = false; } return; }
    if (!o.isMesh) return;
    const m = Array.isArray(o.material) ? o.material[0] : o.material, was = o.material;
    const opaque = m && m.visible !== false && m.colorWrite !== false &&
      !(m.transparent && (m.opacity < 0.98 || m.depthWrite === false || (m.blending !== undefined && m.blending !== THREE.NormalBlending)));
    if (!opaque && !marked) { if (o.visible) { undo.push(() => { o.visible = true; }); o.visible = false; } return; }
    const thin = !m || m.side === THREE.BackSide || m.alphaTest > 0 || !!(m.userData && m.userData.thin) || !!o.userData.thin;
    o.material = marked ? SCAN.mark : thin ? SCAN.plain : SCAN.back;
    undo.push(() => { o.material = was; });
  });
  const bg = scene.background, cc = renderer.getClearColor(new THREE.Color()), ca = renderer.getClearAlpha();
  scene.background = null;
  renderer.setRenderTarget(SCAN.rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, camera);
  renderer.setRenderTarget(null); renderer.setClearColor(cc, ca); scene.background = bg;
  undo.forEach(f => f());
  const buf = new Float32Array(w * h * 4); renderer.readRenderTargetPixels(SCAN.rt, 0, 0, w, h, buf);
  return { buf, w, h };
}
// the scene's state at playback time tp without drawing the picture (the checks below measure many moments)
function stateAt(tp) { const tau = WARP.toTau(tp); placeCamera(tau); TAU_NOW = tau; applyScene(tau, tp, fieldNow()); scene.updateMatrixWorld(true); return tau; }
// a caption's subject → the object to measure: an Object3D, or a subject() made with { obj }; null = a sphere with nothing drawn behind it
const aboutObj = a => (a && a.isObject3D) ? a : (a && a.obj && a.obj.isObject3D) ? a.obj : null;
const aboutName = a => (a && a.isObject3D) ? (a.name || a.type) : (a && a.name) || '?';
const PASS_RC = new THREE.Raycaster();

/* ---------- QA hooks (read by the skill's scripts; the future video recorder uses seek() + a screenshot per frame) ---------- */
window.__bw = {
  LOOP, LOOP_T, KEYS, CAPS, BEATS, PROBLEMS, SPEED_CLASS, FORMAT, SAFE,
  seek(tp) { offset = ((tp % LOOP) + LOOP) % LOOP; playing = false; renderAt(offset); return offset; },
  play() { play(performance.now()); },
  // external(true): stop drawing on its own — the host calls seek(t) for every frame it wants (Studio playback, frame-exact render)
  external(on = true) { HOST_DRAWS = !!on; if (!HOST_DRAWS && !LOOP_ON) { LOOP_ON = true; requestAnimationFrame(frame); } },
  // retime(edits): play the beats with these pace edits ({ key: { speed, kind } }, as in PACE_EDITS) — the speed profile and every
  // text layer's playback times are rebuilt; returns the new loop length and the edits that match no beat
  retime(edits) {
    const stale = paceApply(edits);
    WARP = warpBuild(); LOOP = WARP.len; window.__bw.LOOP = LOOP;
    for (const c of CAPS_T) { c.t0 = toPlay(c.tau0); c.t1 = toPlay(c.tau1); }
    for (const g of TAGS) { g.tp0 = toPlay(g.t0); g.tp1 = toPlay(g.t1); }
    for (const c of COS) { c.tp0 = toPlay(c.t0); c.tp1 = toPlay(c.t1); }
    for (const d of LDS) d.winsT = d.wins.map(([a, b]) => [toPlay(a), toPlay(b)]);
    offset = Math.min(offset, LOOP - 1e-3);
    return { LOOP, stale };
  },
  resetStats() { ftN = 0; },
  time() { return nowT(performance.now()); },
  field() { return fieldNow(); },
  tauOf: tp => WARP.toTau(tp), tOf: tau => WARP.toT(tau),
  stats() {
    const n = Math.min(ftN, FT.length), a = Array.from(FT.slice(0, n)).sort((x, y) => x - y);
    const mean = a.reduce((s, v) => s + v, 0) / Math.max(1, n);
    return { frames: ftN, meanMs: +mean.toFixed(2), fps: +(1000 / mean).toFixed(1), p95Ms: +(a[Math.floor(n * 0.95)] || 0).toFixed(2),
      over25ms: a.filter(v => v > 25).length, pixelRatio: renderer.getPixelRatio(), drawCalls: renderer.info.render.calls };
  },
  // the camera at playback time tp: target and eye in world units, distance, view (short-side) extent, orientation
  camAt(tp) { const tau = WARP.toTau(tp); placeCamera(tau); return { tau, pos: CAM_POS.toArray(), T: CAM.T.toArray(), D: CAM.D, field: fieldNow(), q: CAM.q.toArray() }; },
  // the beats in playback time, with their speed
  beats: () => BEATS.map(b => ({ key: b.key, authored: b.authored, edited: b.kind !== b.authored.kind || b.speed !== b.authored.speed, kind: b.kind, name: b.name, tau0: b.t0, tau1: b.t1, t0: +toPlay(b.t0).toFixed(3), t1: +toPlay(b.t1).toFixed(3), dur: +(toPlay(b.t1) - toPlay(b.t0)).toFixed(3), speed: beatSpeed(b) })),
  // every label with its window (playback s) and whether it is on screen in the frame just rendered (QA 'labels')
  labels: () => [...TAGS.map(g => ({ kind: 'tag', text: g.en, wins: [[g.tp0, g.tp1]], shown: g.shown })),
    ...COS.map(c => ({ kind: 'callout', text: c.big, wins: [[c.tp0, c.tp1]], shown: c.shown })),
    ...LDS.map(d => ({ kind: 'leader', text: d.en, wins: d.winsT, shown: d.shown }))],
  // the captions in playback time (for subtitles later)
  captions: () => CAPS_T.map(c => ({ t0: +c.t0.toFixed(3), t1: +c.t1.toFixed(3), en: c.en, sub: c.sub, ko: c.ko, title: c.en, line: c.sub, second: c.ko, about: c.about.map(aboutName) })),
  // what each caption says it shows (caption(…, about)), measured on the pixels every `step` s while it is up: [tp, framed 0/1, extent,
  // share] — share = the part of the frame where the subject is the nearest thing drawn (hidden parts don't count); extent = the larger
  // side of its visible box ÷ the frame's side; framed = the centre of its visible pixels well inside the frame, above the caption band.
  // declaredOnly: the subject is a sphere with nothing drawn behind it (a subject() without { obj }) — nothing to measure
  aboutCheck(step = 0.1, w = 96) {
    const res = CAPS_T.map(c => {
      const objs = c.about.map(aboutObj), marks = new Set();
      objs.forEach(o => o && o.traverse(m => { if (m.isMesh) marks.add(m); }));
      const samples = [];
      if (marks.size) for (let tp = c.t0; tp < c.t1; tp += step) {
        stateAt(tp); const { buf, w: W, h: H } = scanRender(w, marks);
        let n = 0, x0 = W, x1 = -1, y0 = H, y1 = -1, sx = 0, sy = 0;
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = (y * W + x) * 4; if (buf[i + 3] > 0.5 && buf[i + 2] > 0.5) { n++; sx += x; sy += y; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
        const cx = n ? (sx / n + 0.5) / W : 0, cy = n ? 1 - (sy / n + 0.5) / H : 0;       // rows come bottom-up
        const framed = n > 0 && cx > 0.08 && cx < 0.92 && cy > 0.05 && cy < 1 - SAFE.bottom ? 1 : 0;
        samples.push([+tp.toFixed(3), framed, n ? +Math.max((x1 - x0 + 1) / W, (y1 - y0 + 1) / H).toFixed(3) : 0, +(n / (W * H)).toFixed(4)]);
      }
      return { title: c.en, about: c.about.map(aboutName), declaredOnly: !c.about.length || objs.some(o => !o), samples };
    });
    renderAt(offset);
    return res;
  },

  // is the camera ever inside a subject marked solid() while it is drawn? (every 20 ms of authored time)
  insideCheck() {
    const hits = [];
    for (let tau = 0; tau < LOOP_T; tau += 0.02) {
      placeCamera(tau); TAU_NOW = tau;
      for (const s of SOLIDS) if (s.on(tau) && CAM_POS.distanceTo(s.pos()) < s.r * 1.01) hits.push([+toPlay(tau).toFixed(2), s.name]);
    }
    return { samples: Math.round(LOOP_T / 0.02), solids: SOLIDS.length, hits: hits.length, first: hits.slice(0, 20) };
  },
  // does any subject fade in or out (or switch on / off) while it is in view? (every 20 ms of authored time)
  presenceCheck() {
    const hits = [], W = frameEl.__W, H = frameEl.__H, m = 0.02 * W, prevOn = new Map();
    for (let tau = 0; tau < LOOP_T; tau += 0.02) {
      const busy = SUBJECTS.filter(s => { const on = s.on(tau), was = prevOn.get(s); prevOn.set(s, on);
        if (s.fade) { const a = s.fade(tau); return a > 0.001 && a < 0.999; } return was !== undefined && was !== on; });
      if (!busy.length) continue;
      placeCamera(tau); TAU_NOW = tau;
      for (const s of busy) { const sp = screenOf(s); if (!sp) continue; const rv = sp.r * s.rv / s.r;
        if (sp.x + rv > -m && sp.x - rv < W + m && sp.y + rv > -m && sp.y - rv < H + m) hits.push([+toPlay(tau).toFixed(2), s.name, s.fade ? +s.fade(tau).toFixed(2) : 'switch']); }
    }
    return { subjects: SUBJECTS.length, hits: hits.length, first: hits.slice(0, 20) };
  },
  _dbg: { scene, universe, composer, bloom, mblurPass, flags: {}, CAM, screenOf,
    // for the frame just drawn (QA 'surfaces'): back = share of the frame where the camera looks at the back of a surface that should
    // never be seen from behind (inside a model / a missing face); near = share covered by something closer than 8% of the distance to
    // the target; geo = share covered by opaque geometry at all
    surfaceScan(w = 96) {
      const { buf, w: W, h: H } = scanRender(w, null); let back = 0, near = 0, geo = 0;
      for (let i = 0; i < W * H; i++) { if (buf[i * 4 + 3] < 0.5) continue; geo++; if (buf[i * 4] > 0.5) back++; if (buf[i * 4 + 1] < 0.08) near++; }
      return { back: back / (W * H), near: near / (W * H), geo: geo / (W * H) };
    },
    // which meshes make 'back' in the frame just drawn: each hidden in turn (slow — for fixing, not for scanning).
    // → [[its name (or its parent's, or its geometry type), material type, share %]], largest first
    surfaceWho(w = 96) {
      const base = this.surfaceScan(w).back, out = [], list = [];
      scene.traverse(o => { if (o.isMesh && o.visible) list.push(o); });
      for (const o of list) { o.visible = false; const v = this.surfaceScan(w).back; o.visible = true;
        if (base - v > 0.0005) out.push([o.name || (o.parent && o.parent.name) || o.geometry.type, (Array.isArray(o.material) ? o.material[0] : o.material).type, +((base - v) * 100).toFixed(2)]); }
      return out.sort((a, b) => b[2] - a[2]).slice(0, 8);
    },
    // does the camera pass THROUGH anything? every `dt` of playback, the segment from the last eye to this one against every visible,
    // solid mesh (a surface the camera may cross — a water surface, a cloud layer — says so: userData.passable; see-through glows don't
    // count). Meshes over `maxTris` triangles are left to surfaceScan (listed in skipped). → { hits, first: [[tp, name]], skipped }
    pathScan(dt = 1 / 60, maxTris = 200000) {
      const hits = [], skipped = new Set(), last = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3();
      let have = false;
      for (let tp = 0; tp <= LOOP; tp += dt) {
        stateAt(Math.min(tp, LOOP - 1e-4));
        if (have) {
          a.copy(last).applyMatrix4(universe.matrixWorld); b.copy(CAM_POS).applyMatrix4(universe.matrixWorld);
          const len = a.distanceTo(b);
          if (len > 1e-9) {
            const list = [];
            scene.traverse(o => {
              if (!o.isMesh || !o.visible) return;
              for (let p = o.parent; p; p = p.parent) if (!p.visible) return;
              const m = Array.isArray(o.material) ? o.material[0] : o.material;
              if (!m || o.userData.passable || (m.userData && m.userData.passable) || (m.transparent && (m.opacity < 0.98 || m.depthWrite === false || m.blending !== THREE.NormalBlending))) return;
              const g = o.geometry, tris = g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0);
              if (tris * (o.isInstancedMesh ? o.count : 1) > maxTris) { skipped.add(o.name || (o.parent && o.parent.name) || g.type); return; }
              list.push(o);
            });
            PASS_RC.set(a, b.clone().sub(a).normalize()); PASS_RC.near = 0; PASS_RC.far = len;
            const hit = PASS_RC.intersectObjects(list, false)[0];
            if (hit) hits.push([+tp.toFixed(3), hit.object.name || (hit.object.parent && hit.object.parent.name) || hit.object.geometry.type]);
          }
        }
        last.copy(CAM_POS); have = true;
      }
      renderAt(offset);
      return { hits: hits.length, first: hits.slice(0, 20), skipped: [...skipped].slice(0, 12) };
    },
    nanScan() {                                   // NaN / Inf in the HDR scene render (bloom would spread one into a block)
      const W = Math.round(frameEl.__W * frameEl.__pr), H = Math.round(frameEl.__H * frameEl.__pr);
      const rt = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType });
      renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera); renderer.setRenderTarget(null);
      const n = W * H * 4, buf = new Uint16Array(n); renderer.readRenderTargetPixels(rt, 0, 0, W, H, buf); rt.dispose();
      let nan = 0, inf = 0; for (let i = 0; i < n; i++) { const h = buf[i]; if ((h & 0x7c00) === 0x7c00) { if (h & 0x03ff) nan++; else inf++; } }
      return { nan, inf };
    } },
};
