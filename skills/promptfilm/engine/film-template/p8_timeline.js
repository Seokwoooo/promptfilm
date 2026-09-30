
/* =====================================================================================
   8. TIMELINE — camera keys, beats, captions, labels (authored time τ, a comfortable pace), and the per-frame state.
   The engine (p9) plays each beat at its class's speed: hook/key ×2, normal ×3.5, transit ×8, return ×3
   (references/pacing.md; the taste profile may change them with FILM_SPEED). Target: one loop plays in the kickoff length
   (FORMAT.length — the frame's data-length in p1_head). Within it (pacing.md §2, QA pace + read): every caption is a stop — up for
   its reading time with the camera held on what it names — moves stay under 3 e-folds/s, the way back ≤ 12% of the loop.

   Required here: LOOP_T, applyScene(τ, tp, field). Optional: FILM_SPEED, RULER, SCALE_PANEL, EXPOSURE, WARMUP_TAUS, READY.
   API (p2): key(t, T, field, {frame, yaw, pitch, hfov, flow, ease}) · keyEye(t, eye, T, o) · tween(t, keys) · beat(t0, t1, kind, name, speed)
             caption(t0, t1, title, line, second, about) · tag(t0, t1, pos, name, second, cls) · leader(subj, name, second).wins.push([t0, t1])
             callout(t0, t1, subj, big, line, second, side) · subject(pos, r, {fade, on, rv, name}) · solid(subj)
   Assets: loadTextureData / loadGLBData (into READY), studioEnv(). Inside applyScene: screenOf(subj), screenCover(subj), fieldNow(), CAM, CAM_POS, PXR.
   ===================================================================================== */
// TODO: subjects the text layers point at and the camera must stay out of
const S = { placeholder: solid(subject(V3(0, 0, 0), FACTS.placeholder.r, { name: 'placeholder', obj: PLACEHOLDER })) };   // obj: what is drawn for it

// TODO: the camera path — one continuous camera, never a cut (P24). The last key equals the first, so the loop closes on the opening view.
key(0.0, V3(0, 0, 0), 6, { yaw: -20, pitch: 8 });
key(5.0, V3(0, 0, 0), 5.6, { yaw: -10, pitch: 6 });
const LOOP_T = 10.0;
key(LOOP_T, V3(0, 0, 0), 6, { yaw: -20, pitch: 8, flow: false });

// TODO: every stretch of τ belongs to exactly one beat (hook | key | normal | transit | return)
beat(0.0, 5.0, 'hook', 'Opening');
beat(5.0, LOOP_T, 'return', 'Back to the opening view');

// TODO: captions — title / line in the first language, then (second language, plain words) or '' (FORMAT.langs); one at a time;
// each up for its reading time once played (0.7 s + the audience's line at 12 characters/s in Korean), over a stop where the camera
// holds on what it names — the last argument: the object drawn for it, visible and ≥ 40% of the frame (≥ 1.8 s, 2.4 s in key beats,
// and ≥ the reading time) — going up as the camera arrives, never over the move to it (pacing.md §2, QA read)
caption(0.3, 9.6, 'Untitled film', 'Replace with the first caption', '(Korean line in plain words)', S.placeholder);

// TODO: the field-of-view ruler in world units (or `const RULER = null;` to hide it). Its title defaults to 'Field of view (화면 폭)';
// for other languages add title: ['<first language>', '<second language or empty>']
const RULER = { min: 1, max: 100, fmt: v => v.toFixed(1) + ' units', ticks: [[1, '1 unit'], [10, '10 units'], [100, '100 units']] };

const WARMUP_TAUS = [0, 5];
function applyScene(tau, tp, field) {
  // TODO: set every layer's state from τ (story), tp (ambient motion) and field (what the camera can see)
}
