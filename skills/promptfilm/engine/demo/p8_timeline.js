
/* =====================================================================================
   8. TIMELINE (engine demo) — camera keys, beats, captions and labels in authored time τ, and the per-frame state.
   Authored at a comfortable pace; the beats decide how fast each stretch plays (hook/key ×2, normal ×3.5, transit ×8,
   return ×3), which is how the requester edits these films by hand — within the limits QA holds them to (pacing.md §2): each caption
   up for its reading time with the camera held on what it names, moves under 3 e-folds/s, the way back under 12% of the loop.
   ===================================================================================== */
const B = BODY;
const S = {};                                            // subjects (for labels, the inside check, the exposure)
// a body not yet introduced is not drawn: it fades in while it is still outside the view (the camera is already on its
// way), and on the way home it fades out once it has left the view — so nothing ever pops in at the edge of the frame
const PRESENCE = { moon: null, earth: null, jupiter: [7.9, 8.7, 45.8, 46.8], sun: [17.9, 18.9, 44.8, 45.8] };
const presence = (k, tau) => { const p = PRESENCE[k]; return p ? pulse(tau, ...p) : 1; };
ROW.forEach(k => { B[k].mesh.name = k; S[k] = solid(subject(B[k].pos, B[k].r, { name: k, obj: B[k].mesh, fade: PRESENCE[k] ? tau => presence(k, tau) : null, rv: k === 'sun' ? 2.2 * B[k].r : B[k].r })); });
const EARTH_D = 2 * FACTS.earth.r;
const ratio = (a, b) => { const v = FACTS[a].r / FACTS[b].r; return v >= 10 ? fmtInt(v) : v.toFixed(1); };
// frames for the 9:16 view: the row's line sits at 60% of the height (above the caption band); a subject alone sits at 42%
const V_HALF = 0.5 / ASPECT;                             // half the view's height, in view widths
function compPose(k) {                                   // everything from the Moon to body k, side by side
  const L = B.moon.pos.x - B.moon.r, R = B[k].pos.x + B[k].r, f = (R - L) * 1.12;
  return { T: V3((L + R) / 2, 0.10 * 2 * V_HALF * f, 0), f };
}
function heroPose(k, mul = 2.3) {                        // one body, about 45% of the width
  const f = 2 * B[k].r * mul;
  return { T: V3(B[k].pos.x, B[k].pos.y - 0.08 * 2 * V_HALF * f, 0), f };
}
const kHero = (t, k, o = {}) => { const p = heroPose(k, o.mul); key(t, p.T, p.f * (o.push || 1), { yaw: o.yaw ?? -14, pitch: o.pitch ?? 3, flow: o.flow, ease: o.ease }); };
const kComp = (t, k, o = {}) => { const p = compPose(k); key(t, p.T, p.f * (o.push || 1), { yaw: o.yaw ?? 0, pitch: o.pitch ?? 4, flow: o.flow, ease: o.ease }); };

kHero(0.0, 'moon');
kHero(4.4, 'moon', { push: 0.96, yaw: -12.5 });
kComp(7.8, 'earth', { ease: 'reveal', flow: false });
kComp(8.8, 'earth', { push: 0.985 });
kHero(10.6, 'earth');
kHero(13.4, 'earth', { push: 0.96, yaw: -12.5 });
kComp(17.8, 'jupiter', { ease: 'reveal', flow: false });
kComp(19.2, 'jupiter', { push: 0.985 });
kHero(21.0, 'jupiter');
kHero(25.4, 'jupiter', { push: 0.96, yaw: -12.5 });
kComp(30.8, 'sun', { ease: 'reveal', flow: false });
kComp(32.2, 'sun', { push: 0.985 });
kHero(34.0, 'sun');
kHero(39.6, 'sun', { push: 0.96, yaw: -12.5 });
const LOOP_T = 47.8;
kHero(LOOP_T, 'moon', { flow: false });                  // the last key is the first: the loop closes on the opening view

beat(0.0, 4.4, 'hook', 'Title on the Moon');
beat(4.4, 8.8, 'normal', 'Earth joins the row');
beat(8.8, 13.4, 'key', 'Earth');
beat(13.4, 19.2, 'normal', 'Jupiter joins the row', 3);  // a long pull-back: a little slower, so it stays under 3 e-folds/s
beat(19.2, 25.4, 'key', 'Jupiter');
beat(25.4, 32.2, 'normal', 'The Sun joins the row');
beat(32.2, 39.6, 'key', 'The Sun');                    // held long enough to read the caption with the Sun alone in view
beat(39.6, 41.2, 'normal', 'Leaving the Sun', 3);       // ease into the way back (no jolt), under 3 e-folds/s
beat(41.2, LOOP_T, 'return', 'Home to the Moon', 3.5);  // the way back — no new information: kept under 12% of the loop

caption(0.1, 4.4, 'How big is big?', 'Four bodies side by side at true relative size', '(얼마나 클까?)', S.moon);
caption(4.6, 13.3, 'Earth', `${ratio('earth', 'moon')}× the Moon · ${fmtInt(EARTH_D)} km across`, `(지구 — 달의 ${ratio('earth', 'moon')}배)`, S.earth);
caption(18.4, 25.3, 'Jupiter', `${ratio('jupiter', 'earth')}× Earth · the largest planet`, `(목성 — 지구의 ${ratio('jupiter', 'earth')}배)`, S.jupiter);
caption(31.6, 39.4, 'The Sun', `${ratio('sun', 'earth')}× Earth · surface illustrative`, `(태양 — 지구의 ${ratio('sun', 'earth')}배 · 표면은 그림)`, S.sun);
caption(41.4, 47.4, 'And back', 'The same row, at the same scale', '(다시 처음으로)', S.moon);
tag(5.2, 8.7, V3(B.moon.pos.x, 2 * B.moon.r, 0), 'The Moon', '달');
callout(7.2, 10.4, S.earth, `×${ratio('earth', 'moon')}`, 'Earth vs the Moon', `지구 = 달 지름의 ${ratio('earth', 'moon')}배`);
callout(17.2, 20.6, S.jupiter, `×${ratio('jupiter', 'earth')}`, 'Jupiter vs Earth', `목성 = 지구 지름의 ${ratio('jupiter', 'earth')}배`);
callout(30.2, 33.8, S.sun, `×${ratio('sun', 'earth')}`, 'The Sun vs Earth', `태양 = 지구 지름의 ${ratio('sun', 'earth')}배`);
leader(S.moon, 'The Moon', '달').wins.push([17.4, 20.8], [30.4, 33.8]);
leader(S.earth, 'Earth', '지구').wins.push([30.4, 33.8]);

// the field-of-view ruler: 1,000 km (top) to 10 million km (bottom)
const fmtKm = km => (km < 1e6 ? fmtInt(km < 1e4 ? Math.round(km / 10) * 10 : Math.round(km / 100) * 100) + ' km' : (km / 1e6).toFixed(km < 1e7 ? 2 : 1) + ' million km');
const RULER = { min: 1e3, max: 1e7, fmt: fmtKm, ticks: [[1e3, '1,000 km'], [1e4, '10,000 km'], [1e5, '100,000 km'], [1e6, '1 million km'], [1e7, '10 million km']] };
// the human-scale panel while the Sun is in view: how many Earths wide the view is
const SCALE_PANEL = (field, tau) => {
  const on = pulse(tau, 30.2, 30.8, 39.0, 39.6);
  if (on < 0.002) return null;
  const n = field / EARTH_D;
  return { on, k: 'This view = Earth’s diameter <span>(화면 폭 = 지구 지름의)</span>', v: `×${fmtInt(n)}<i>(${fmtInt(n)} 배)</i>` };
};
// the exposure stops down as the Sun fills the view, as a camera would
let SUN_COVER = 0;
const EXPOSURE = () => 1 / (1 + 2.6 * SUN_COVER);          // stops down enough that the Sun keeps its surface instead of a white blob
const WARMUP_TAUS = [0, 9, 21, 34, 42];
RESIZE_HOOKS.push((W, H, pr) => { STARS.material.uniforms.uDpr.value = pr; });

function applyScene(tau, tp, field) {
  _lv.copy(LIGHT_DIR).transformDirection(camera.matrixWorldInverse);
  const spin = 2 * Math.PI * tp / LOOP;                  // ambient motion in playback time, whole turns per loop
  ['moon', 'earth', 'jupiter'].forEach((k, i) => { const u = B[k].mesh.material.uniforms; u.uLightV.value.copy(_lv); u.uSpin.value = spin * [0, 1, 1][i]; });   // whole turns per loop, or the seam jumps
  B.sun.mesh.material.uniforms.uPh.value = spin;
  ROW.forEach(k => { const a = presence(k, tau); B[k].mesh.material.uniforms.uFade.value = a; B[k].mesh.visible = a > 0.001; });
  B.sun.glow.material.uniforms.uFade.value = presence('sun', tau); B.sun.glow.visible = B.sun.mesh.visible;
  SUN_COVER = presence('sun', tau) * screenCover(S.sun);   // only the part of the Sun inside the frame
}
