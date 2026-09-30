# The engine — files, contract, API, hooks

The engine is generic: nothing in it knows the film’s subject or format (a journey, a product film, a demo…). A film is the engine's core parts plus the film's own parts.

## 1. Files and build

```
<film>/
  parts/
    p1_head.html   engine   CSS + DOM of the text layers, boot guard, importmap, <script type="module"> start   ← edit title + header comment
    p2_core.js     engine   renderer, floating origin, utilities, GLSL chunks, camera frames, the authoring API
    p3_*.js …      FILM     the world (split into p3_*.js, p4_*.js, p5_*.js, p6_*.js; a few hundred lines each)
    p7_post.js     engine   composer: render → motion blur + exposure + NaN clean-up → bloom → ACES → grain
    p8_*.js        FILM     timeline: keys, beats, captions, labels, applyScene(), RULER / SCALE_PANEL / EXPOSURE
    p9_engine.js   engine   camera evaluation, speed profile, text layers, clock, render loop, QA hooks
    p10_tail.html  engine   warm-up and start
  build.sh         cat in that order → <name>.html
  research/  qa/  plan.md
```

`node scripts/new_film.mjs <film-dir> <name> [--aspect 9x16] [--length 45-60] [--langs "en ko"]` (or `sh scripts/new_film.sh …`; the same
result) creates this from `engine/core` +
`engine/film-template` and writes the kickoff answers into `p1_head.html` (see Format below). Write long parts in several files — one
huge write hits output limits. **All parts run in one module scope**: a top-level name in a film part that repeats an engine name
(`FT`, `PREV`, `HUD`, `TAGS`, `SCALE`, `params`, `canvas` …) or another part's name stops the film at start-up. `build.sh` checks this
and stops with both places named; give the film's own constants distinctive names. Change engine parts only when the film needs it (e.g. an extra post pass), and say so in the header comment.

Three.js r160 from jsdelivr via importmap (`three`, `three/addons/`). No other external scripts. Google Fonts for Barlow, Barlow Semi
Condensed and the Noto family of the film's languages (Noto Sans KR by default).

**Format.** The frame carries the kickoff answers: `<div id="frame" data-aspect="9x16" data-langs="en ko" data-length="45-60">`. The core
reads them into `FORMAT = { aspect, langs, length }` and sets `ASPECT`, `SAFE` (the player's UI zones for that aspect, from `SAFE_ZONES`) and
`SHORT` = min(ASPECT, 1). The CSS sizes and places the frame and the text layers for the aspect; new_film.sh sets the font link and
`--face-lang`. Lines in a right-to-left language (ar, fa, ur, he …) run right to left (`dir="rtl"`); the layout stays the same. To change the format of an existing film, edit those three attributes (and the font link for a new script) and rebuild.

## 2. The contract (what p8 must define)

| Name | Required | Meaning |
|---|---|---|
| `LOOP_T` | yes | authored length (s). The last camera key is at LOOP_T and equals the first key. |
| `applyScene(τ, tp, field)` | yes | set every layer's state: τ = authored time (story), tp = playback time (ambient motion), field = the view's extent across the frame's short side at the target (world units; the width in 9:16) |
| `FILM_SPEED` | no | overrides of the speed classes, e.g. `{ normal: 4 }` (a taste profile's own pace goes here) |
| `PACE_EDITS` | no | the requester's per-beat pace edits from the Studio, in `parts/p8z_pace.js` (written by the Studio; keep it — studio.md §4) |
| `RULER` | no | `{ min, max, ticks: [[value, label]…], fmt: v => text, title: [first, second] }` in world units; `null` hides it. `title` defaults to 'Field of view (화면 폭)' — required when the first language isn't English |
| `SCALE_PANEL` | no | `(field, τ) => null \| { on, k, v, r, n }` — HTML for the human-scale panel (classes as in p1_head) |
| `EXPOSURE` | no | `(τ, field) => multiplier` applied before bloom (default 1) |
| `FILM_DOF` | no | `(τ, field) => ({ aperture, maxblur })` — depth of field focused on the target. **Define it in a scene part (p3–p6)**: the post chain (p7) reads it. The aperture is unitless but `field` is in the film's unit, so write it relative to the film's own close-up: `aperture = 0.0015 + clamp(0.02 × F_close / field, 0, 0.03) × (1 − smoother(range(field, F_close × 3, F_close × 6)))`, `maxblur ≈ 0.007–0.009` — shallow in close-ups, practically none on wide views (the product film uses 0.22 / field_cm). Depth of field is a lens, not a cover:
never use it to hide low-resolution imagery or unfinished models (P30) |
| `FILM_MB_BIG` | no | the motion-blur streak on big moves, in frames (default 0.6, calmer; 1.2 = a full 1/50 s shutter — for regular grids that would strobe, techniques §20) |
| `WARMUP_TAUS` | no | τ values rendered once before start, so every material compiles before it is first seen |
| `READY` | no | a promise (textures, data) to wait for before starting |

## 3. Authoring API (p2)

All times are authored τ at a comfortable pace; positions in world units.

- `key(t, T, field, { frame, yaw, pitch, roll, hfov, flow, ease, at })` — a camera key: point `T`, the view's extent across the **short side**
  `field` there (the width in 9:16, the height in 16:9; `hfov` is the angle across that side, default 38°), direction by
  yaw/pitch (degrees) in a named frame (`CAMFRAMES`; add your own `{ right, up, back }`). `flow: false` = come to rest at this key (use before
  big jumps and at holds). `ease: 'reveal'` on the arriving key = a front-loaded pull-back (quick start, long settle). `at` = where `T` sits
  on screen as a fraction of the height from the top (default 0.5): heroes at ~0.37 keep the caption band clear.
- `keyEye(t, eye, T, o)` — a key from an explicit eye position.
- Between keys: log-distance and angles by monotone Hermite; while the distance changes a lot (|Δln D| > 0.7) the target moves in proportion
  to the zoom, which keeps the subject framed.
- `beat(t0, t1, kind, name, speed?)` — `hook | key | normal | transit | return` (pacing.md). Beats must cover [0, LOOP_T] without gaps or overlaps.
- `caption(t0, t1, title, line, second, about)` — one at a time; overlapping captions throw at start-up. `title`, `line` = the first
  language; `second` = the second-language line written with its parentheses, or '' for a one-language film. `about` = what the caption
  tells about: the object drawn for it (a mesh or group — give it a `name`), a `subject(…, { obj })`, or a list — required before the way
  back. QA `read` measures it on the pixels: visible (hidden parts don't count), framed, ≥ 40% of the frame while the camera holds, for
  the reading time (the stop, techniques §21). A subject without `obj` is a sphere with nothing drawn: it fails. Lines and points can't be
  measured — draw a thin subject as a tube.
- Surfaces: `material.userData.thin = true` for thin parts meant to be seen from both sides (a membrane, a sheet, a leaf); `userData.passable
  = true` (mesh or material) for a surface the camera may pass through (a water surface, a cloud layer). QA `surfaces` fails the rest.
- `tag(t0, t1, pos, name, second, cls)` — a label pinned to a 3D point (`cls`: `'hyp'` dashed = hypothetical, `'below'`). `second` = the
  second language without parentheses (the engine adds them; '' shows none) — the same for `leader` and `callout`.
- `subject(pos, r, { fade, on, rv, name, obj })` — something text can point at (`obj`: the object drawn for it, what a caption about it is measured on). `fade(τ)` → 0..1 for subjects that arrive or leave; `rv` = the
  radius it looks on screen with its glow. `solid(subject)` — the camera must never be inside it.
- `leader(subject, name, second).wins.push([t0, t1])` — a ring + line + name on a subject too small to see.
- `callout(t0, t1, subject, big, line, second, side)` — a ratio beside a subject after a reveal (e.g. `'×11'`).
- `tween(t, [[t0, v0, ease], [t1, v1], …])` — keyframed numbers or arrays for anything that moves: parts of an exploded view, a light
  sweep, a colour, an opacity. Eases: `smooth` (default), `linear`, `in`, `out`, `hold`. Make every tweened value end where it started when
  the loop closes.
- Assets: `loadTextureData(dataUrl)`, `loadGLBData(dataUrl)` (promises; put them in READY) for files packed by
  `scripts/embed_assets.mjs`; `studioEnv()` → a soft studio environment map for reflections (`scene.environment = studioEnv()`).
  Core imports include GLTFLoader, RoomEnvironment, RoundedBoxGeometry and BokehPass; add others (FontLoader + TextGeometry, Line2…) to the
  film's `p1_head.html`.
- There is no cut: the camera is always continuous (P24); QA `continuity` fails on a jump.

Inside `applyScene` you can use: `screenOf(subject)` (CSS px position and radius), `screenCover(subject)` (fraction of the frame the disc
covers **inside** the frame — for exposure), `fieldNow()`, `CAM` (T, D, q, hfov), `CAM_POS` (eye, world units), `PXR` (px per radian),
`camera`, `frameEl.__W / __H`, `LOOP`.

## 4. How it works (so you can extend it safely)

- **Floating origin**: everything hangs off `universe`; each frame `universe.matrix = S(1/D) · T(−target)`, the camera sits at unit distance
  (near 1e-3, far 1e4). Works from nanometres to billions of light-years in one film. Objects far beyond the far plane: push them onto a sphere
  in view space (see `FARPUSH_GLSL` in examples/cosmic-scale/parts/p2_core.js).
- **Determinism**: every state is a pure function of τ (and tp for ambient motion). Nothing accumulates between frames; seeded randomness only
  (`mulberry32`). The loop is identical every time (qa drift = 0).
- **Speed profile**: `WARP` maps playback t ↔ authored τ from the beats' speeds (lookup table, 2 ms steps). `LOOP` = playback length.
- **Fonts**: before the first frame the tail loads every string the film shows (captions, labels, callouts, ruler, a sample of the scale
  panel) in the film's faces — Google Fonts sends a script in subsets that otherwise download on first use, so a caption's first showing
  would flash in a fallback face. After 8 s without fonts (offline) the film starts anyway.
- **Text layers**: DOM over the canvas, timed in playback seconds, placed each frame with obstacle avoidance (caption, ruler, scale panel,
  each other, the player's UI zones — `SAFE_ZONES` for the film's aspect, checked against each label's whole box).
- **Post**: motion blur from the camera's own movement over a 1/50 s playback shutter (zoom about the old target + turn) — slow moves get
  the full physical streak (~1.2 frames), which keeps fine detail from stepping pixel by pixel; fast moves a calmer 0.6; exposure applied
  before bloom; NaN/Inf → 0 and clamp before bloom (one bad pixel otherwise becomes a flickering black block); bloom (0.46, 0.6, threshold 1.6);
  ACES; fine grain.
- **Sizing**: the frame's aspect (9:16 by default); text in cqmin (1% of the short side); the long side capped at 1920 device pixels.
- **Depth resolution and the layer gap**: near = 10⁻³ scene units with the target at 1 unit, 24-bit depth → the smallest depth step at
  the target is ≈ 6·10⁻⁵ × D world units (D = camera distance), growing with the square of the distance. Two surfaces closer than a few
  steps z-fight (flicker; rectangular blocks on tiled GPUs). Keep stacked surfaces (decals, plaques, water, printed faces, overlays that
  are not on purpose coincident) at least **5·10⁻⁴ × D** apart for the largest D they are seen from (D = 4 m → 2 mm; D = 40 cm →
  0.2 mm). Coincident on purpose (a hologram copy on its original): same geometry + `polygonOffset`.

## 5. QA hooks (`window.__bw`)

`LOOP, LOOP_T, KEYS, CAPS, BEATS, PROBLEMS, SPEED_CLASS, FORMAT, SAFE` · `seek(tp)` (pause and render one frame) · `play()` · `external(on)`
(the host draws every frame through seek — the Studio and the renderer; the film's own loop then rests until `external(false)`) · `retime(edits)` (replay
with other pace edits: rebuilds the speed profile, LOOP and every text layer's playback times) · `time()` · `labels()` (every tag,
callout and leader with its windows and whether it is on screen in the frame just rendered) · `stats()` /
`resetStats()` (frame times) · `field()` · `camAt(tp)` → `{ tau, pos, T, D, field, q }` · `tauOf(tp)` / `tOf(τ)` · `beats()` (playback times,
durations, speeds) · `captions()` (playback times — also for YouTube subtitles later) · `insideCheck()` · `presenceCheck()` ·
`_dbg.nanScan()`, `_dbg.flags.noMB` · `aboutCheck(step)` (each caption's object on the pixels: framed, extent, share) · `_dbg.surfaceScan()`
(the frame just drawn: the back of a non-thin surface nearest — inside a model or a missing face —, pressed against the lens, solid
geometry) · `_dbg.surfaceWho()` (which meshes) · `_dbg.pathScan(dt)` (the camera's path crossing solid meshes) — QA `read`, `surfaces`. `window.__started = true` once running. `PROBLEMS` lists authoring problems found at start-up
(uncovered beats, short captions, last key not at LOOP_T).

URL: `?t=seconds` (start time), `?freeze` (paused; for QA), `?safe` (the player's UI zones), `?text=0` (no text). Keys: Space pause, R restart, H text.

## 6. The engine's test films

`sh engine/build_demo.sh` builds two films that exist to test the engine and the QA scripts. They show the API in use; they are **not**
starting points, and their content must not leak into films.
- `engine/demo-build/demo.html` — a continuous journey (four bodies side by side at true relative size): presence fades, on-screen exposure,
  loop-periodic ambient motion, anti-aliased procedural edges, the ruler and the human-scale panel.
- `engine/demo-ad-build/demo-ad.html` — a product film (a fictional speaker) built to the quality bar (P29): a studio made of softbox
  panels for reflections, an unlit floor that melts into the backdrop with a contact shadow, knit / brushed-metal / paper / PCB / label
  textures drawn once, detail that fades with distance, depth of field, one continuous camera that circles the product once per loop through
  a close-up, an exploded view (`tween`) with labels on moving parts, and back — no cuts, no ruler.
