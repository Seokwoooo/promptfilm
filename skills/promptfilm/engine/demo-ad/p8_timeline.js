
/* =====================================================================================
   8. TIMELINE (engine test film #2: a product film) — one continuous camera, no cuts: it circles the product once per loop
   (yaw −40° → 320°) while it glides up to the glass top, pulls back as the product comes apart, orbits the exploded view,
   comes down as it reassembles to a low hero angle, and arrives back at the opening pose.
   ===================================================================================== */
const SOLID_BODY = solid(subject(V3(0, 8.5, 0), 9.2, { name: 'speaker', obj: PRODUCT }));
PRODUCT.name = 'the speaker'; LIGHT_RING.name = 'the ring of light';
WOOFER.name = 'woofer'; TWEETERS.name = 'tweeters'; BOARD.name = 'logic board'; BATTERY.name = 'battery';
const kP = (t, ty, field, yaw, pitch, o = {}) => key(t, V3(0, ty, o.z || 0), field, { yaw, pitch, ...o });
// the product sits in the upper part of the frame (its centre at ~37% of the height), so the caption band below it stays clear
kP(0.0, 8.5, 26, -40, 8, { at: 0.37 });        // hook: a low three-quarter view, the light running along the knit
kP(5.5, 8.8, 24.5, -18, 11, { at: 0.37 });
kP(10.0, 16.0, 9.5, 18, 50, { z: 0.6 });       // up to the glass top: the ring of light, close (a close-up: the caption reads over it)
kP(14.5, 16.0, 8.8, 46, 46, { z: 0.5 });       // held on the ring long enough to read its caption, still circling at ~12°/s (slower, the knit steps pixel by pixel — QA flicker)
kP(19.0, 22.5, 44, 75, 15, { at: 0.33 });      // pulling back as it comes apart: the whole stack above the caption band
kP(26.6, 22.5, 42, 138, 13, { at: 0.33 });     // around the exploded view
kP(32.1, 8.3, 25, 200, 4, { at: 0.37 });       // down again as it goes back together, low
kP(38.2, 8.4, 23.5, 250, 3, { at: 0.37 });     // the end card
const LOOP_T = 43.7;
kP(LOOP_T, 8.5, 26, 320, 8, { flow: false, at: 0.37 });   // = the opening pose (320° ≡ −40°): the loop closes without a jump

beat(0.0, 5.5, 'hook', 'The product in the studio');
beat(5.5, 8.5, 'normal', 'Up to the top', 2.6);        // the climb turns fast: a little slower, under 45°/s
beat(8.5, 14.5, 'key', 'The ring of light');
beat(14.5, 17.0, 'normal', 'Coming apart', 3);
beat(17.0, 26.6, 'key', 'Inside');
beat(26.6, 32.1, 'normal', 'Back together');           // a move: the parts settle while the camera circles — no caption rides on it
beat(32.1, 38.2, 'key', 'End card');
beat(38.2, LOOP_T, 'return', 'Back to the opening');

caption(0.3, 5.3, 'AURA', 'Room-filling sound · a fictional product built to test this skill', '(아우라 — 가상 제품)', SOLID_BODY);
caption(9.4, 14.3, 'Touch the light', 'A glass top with a ring of light · volume and voice by touch', '(빛의 링 — 터치로 조작)', LIGHT_RING);
caption(18.4, 26.4, 'Inside', `A ${FACTS.woofer.d} cm woofer · three tweeters · a ${FACTS.battery.hours}-hour battery`, `(내부 — ${FACTS.woofer.d}cm 우퍼 · 트위터 3개 · ${FACTS.battery.hours}시간 배터리)`, PRODUCT);   // the product, apart
// (no caption over the reassembly: it is a move, and the picture says it — the end card's caption follows)
caption(32.3, 38.0, 'AURA', 'Sound, shaped for your room · fictional', '(당신의 방에 맞춘 소리 · 가상 제품)', SOLID_BODY);

// the disassembly (real motion, P7 b): the cap and the shell lift first, then the insides spread along the axis; reassembly in reverse
function partY(k, tau) {
  const p = PARTS[k], [a, b, c, d] = p.outer ? [15.0, 17.4, 28.0, 31.0] : [16.4, 19.2, 26.8, 29.2];
  return tween(tau, [[0, p.y0], [a, p.y0], [b, p.y1], [c, p.y1], [d, p.y0]]);
}
const on = k => () => V3(0, partY(k, TAU_NOW), 0);
tag(19.4, 26.2, () => on('woofer')().add(V3(4.6, -0.2, 0)), `Woofer · ${FACTS.woofer.d} cm`, `우퍼 ${FACTS.woofer.d}cm`);
tag(19.6, 26.2, () => on('tweeters')().add(V3(-4.3, 0.3, 0)), 'Tweeters ×3', '트위터 3개');
tag(19.8, 26.2, () => on('board')().add(V3(4.8, 0.1, 0)), 'Logic board', '메인보드');
tag(20.0, 26.2, () => on('battery')().add(V3(-2.2, 0, 0)), `Battery · ${FACTS.battery.hours} h`, `배터리 ${FACTS.battery.hours}시간`, 'below');
tag(20.2, 26.2, () => on('shell')().add(V3(R, 9, 0)), 'Knit shell', '니트 외피');
tag(8.9, 14.2, () => V3(0, TOP + 0.02, 3.2), 'Ring of light', '빛의 링');

const RULER = null;                            // a product film has no field-of-view ruler
const WARMUP_TAUS = [0, 10, 20, 29, 35];
function applyScene(tau, tp, field) {
  for (const k in PARTS) PARTS[k].obj.position.y = partY(k, tau);
  const open = clamp01((partY('shell', tau) - PARTS.shell.y0) / (PARTS.shell.y1 - PARTS.shell.y0));
  AXIS_LINE.material.opacity = 0.22 * smoother(open);
  AXIS_LINE.visible = open > 0.01;
  // the knit's relief fades as the camera draws back: stitches a few pixels wide would otherwise beat into moiré (P10)
  MAT.knit.normalScale.setScalar(0.85 * (1 - smoother(clamp01((field - 10) / 10))));        // full in the close-up, none from a 20 cm view
  MAT.knit.sheen = 0.7 * (1 - 0.6 * smoother(clamp01((field - 10) / 10)));
  // the ring of light: an arc travelling round it, twice per loop (playback time, whole cycles)
  LIGHT_RING.material.uniforms.uPh.value = 2 * Math.PI * 2 * tp / LOOP;
}
