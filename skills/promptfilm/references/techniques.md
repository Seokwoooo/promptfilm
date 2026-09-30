# Techniques — proven ways to build the world (use when the condition fits)

Each technique says when it applies and where working code lives in `examples/`. Borrow the **pattern**, never the content: the examples'
planets, stars, chips and numbers belong to their films.

Contents: 1 Lighting and mood · 2 Fog and depth · 3 Post · 4 Repeated elements · 5 Far → near representations · 6 Luminous bodies and
exposure · 7 Huge numbers of things · 8 Volumes · 9 Real data and textures · 10 Anti-aliasing · 11 Text-layer patterns ·
12 Products and materials · 13 Moving between framings · 14 Exploded views and assembly · 15 Characters, stylised worlds, effects · 16 3D lettering
and logos · 17 Supplied or found assets · 18 Processes of formation · 19 Holograms, glows and other additive light · 20 Regular grids under a moving camera

## 1. Lighting and mood (P15, P16, P21)

- One key light from the side-front, a rim light from behind, a soft fill, a hemisphere light, an environment map for metals. The hero's form
  must read from light and shadow: a soft terminator band, a thin bright rim, dark surroundings.
- For lit spheres (planets, cells, droplets): a custom shader with the key light direction in view space, a terminator softened over ~0.1 of
  N·L, a limb haze `pow(1 − N·V, 4)` only on the lit side, gentle saturation (outreach-image look, not garish).
  → `examples/cosmic-scale/parts/p3_bodies.js` PLANET_FS, planetMaterial()
- Glows drawn **in proportion to the subject** (a halo whose size is a multiple of the radius, following an oblate outline if the body is
  flattened), never a fixed pixel size → looks the same at every distance (P14). → PLANET_HALO_FS, HALO_FS
- The light is present from the first frame (P16). If something must not be visible yet, it is hidden while off-screen (P25), not dark.
- Materials: set per region; one material value for everything makes the whole picture drift to one tint. Watch for clumps of specular glare.
- Glints: a directional key light on a glossy surface (water, glass, polished metal, clearcoat) has a specular peak of roughly
  1 / roughness⁴ — hundreds of times the rest of the picture — and the bloom turns it into a white blob that swells and shrinks as the
  camera moves. Anything that can catch the key light toward the camera: roughness ≳ 0.3, or `specularIntensity` ≲ 0.5.
- Glowing background panels (windows, cabinets, screens, signs) stay dim (≲ 0.4 before exposure) and carry inner structure (mullions,
  shelves, a gradient, a frame); bright and plain they read as blown-out slabs.

## 2. Fog and depth

- Fog per pixel (a per-vertex fog smears a large plane into one colour). For films with a large range of scale, measure fog from the camera
  target (replace `ShaderChunk.fog_vertex` / `fog_fragment`, add `uFogCenter`). → Blackwell: search `uFogCenter`, `fog_fragment`
- With the floating origin, fog, shadow ranges, AO radius and depth of field all scale with D (distance to target): set them in applyScene.

## 3. Post (engine p7)

Render → motion blur + exposure + NaN clean-up → bloom (weak; threshold above lit surfaces so only light sources and hot glows bloom) →
ACES → grain. Blackwell adds AO, depth of field and a style pass (an electron-microscope look: grey, bright edges, as a function of
magnification) → Blackwell `SEM`, `updatePost(D, t)`, `applySemLook`. Add passes by editing the film's copy of p7_post.js; keep the NaN clean-up
before bloom.

## 4. Repeated elements (P5)

- Draw repeats with `InstancedMesh`; per-instance attributes carry the differences (colour, phase). **One definition, many placements.**
  → Blackwell `chipBlocks` / `chipFine` (InstancedMesh), `rec()` records, `buildSM()`
- Patch built-in materials with `onBeforeCompile` + `customProgramCacheKey`, calling any previous onBeforeCompile. → Blackwell `patchMat()`
- Behaviour that means the same thing (glow, blink, phase) is **one function**, used by the far representation, the near one and the hero alike.
- Derived totals are computed from the fact table and asserted against documented totals at start-up. → Blackwell `DERIVED`, `ARCH_CHECK`

## 5. Far → near representations (P5, P7, P9, P10 at once)

Small repeated detail is often a texture or simple model far away and real 3D up close. Most problems happened at this switch. What works:

1. **One layout, two representations.** The same placement rule generates the texture pattern and the 3D instances; approaching, the
   pattern already visible becomes relief.
2. **Resolution-aware patterns.** `fwidth` blends to the average colour when a pattern is sub-pixel; add mid-scale patterns so no distance is plain.
3. **3D never changes over time.** Don't animate heights or sizes. Only near the camera's target; flatten smoothly towards the edges
   (`RELIEF(u) = 1 − smoother((u − 0.55) / 0.45)`); no slivers under 15% height; thin covers keep a fixed thickness.
4. **3D appears only with distance**: over the distance range where the repeat spacing is a few pixels, opacity 0 → 1 with `alphaHash`
   dithering. At that distance the texture must already show the same pattern crisply.
5. **Where 3D stands, the texture shows the base colour** (`col = mix(pattern, BASE, fade × RELIEF)`) — no double pattern.
6. **Fade depth-based effects too** (AO) so translucent 3D doesn't show through in the depth buffer.
7. **Hero = neighbours**: a precise model uses the same material, motion function and post as the rest.
8. **Brightness match**: render the same frame with 3D forced on / off; region means within 5%.
9. **Performance**: draw only what is near the camera; merge small boxes; restrain shadows on dense 3D; bounding spheres + culling.
→ Blackwell `applyPatchFade(fieldMm)`, `RELIEF`, `RELIEF_GLSL`, `DEV_GLSL`, `MASK`, `TILE`

## 6. Luminous bodies and exposure (P14, P21, P22)

- A light source is emissive above the bloom threshold with a proportional glow; its brightness relation to others comes from facts
  (e.g. luminosity ∝ R²T⁴ → glow width). → cosmic p2_core.js `lumSun`, p3_bodies.js STAR_FS, HALO_FS (`uLum`)
- Famous surfaces follow real imagery (research/refs); stylised views are labelled (e.g. "as a hydrogen-alpha telescope shows it").
  → cosmic STAR_FS (the Sun branch), SUN_FX_FS (limb)
- Exposure like a camera: stop down when a bright subject fills the view — using only the part **inside the frame** (`screenCover`).
  Apply it before bloom (`EXPOSURE` → the engine's uExposure), so a star filling the view doesn't flood the frame with glow.
- A subject not yet introduced is not drawn; it fades in while outside the view (`subject({ fade })`, `presenceCheck`). → cosmic `INTRO`,
  `introAt()`; engine demo `PRESENCE`

## 7. Huge numbers of things (P23)

- Points with per-point size / brightness / colour in one draw call; sizes in device pixels (`uDpr`), a minimum pixel size, soft sprites.
  → cosmic p4_points.js `makeCloud()`, SPRITE_FS
- A depth window around the subject keeps far-behind points from cluttering (`uFocus`, `uFocusR`).
- Sampling hundreds of thousands of positions from a density map: inverse-CDF sampling (rejection sampling made start-up 16 s; CDF: 3.7 s).
  → cosmic p6_volume.js `GAL_FIELD`
- A layer that is fully faded is not drawn at all (`visible = false`) — drivers may still rasterise zero-size points.

## 8. Volumes

Ray-marched volumes for gas, galaxies, clouds, tissue: a low-resolution render target composited under the scene; bake a static sky once.
→ cosmic p6_volume.js VOL_FS, `updateVolumes()`, SKYBAKE_FS, `bakeSky()`

## 9. Real data and textures

- Photographs of real surfaces (planet maps, material photos) and catalogues are packed into the single HTML as base64 by a small script,
  with sources in the header comment. Keep the file ≲ 10 MB; downscale textures to what the frame needs.
  → `examples/cosmic-scale/tools/prep_data.py` (writes p0_data.js; its inputs and licences are listed in its docstring)
- Licences: prefer public-domain (NASA, most US agencies) or CC BY with credit in the header comment. Don't embed photos as flat images
  in the scene (P24); textures on 3D surfaces are fine.

## 10. Anti-aliasing (P10)

- Lines thinner than a pixel fade to their average (`lineAA` in `AA_GLSL`, engine p2).
- Hard procedural edges (a threshold on noise) crawl when they move: widen the transition to at least ~1.5 × `fwidth` of the input.
  → engine demo p3_scene.js (land and cloud edges)
- Fixed or loop-periodic noise only; never per-frame random noise.
- Keep separate surfaces apart (no near-coplanar faces); no slivers. A surface stacked on another (a decal, a plaque's face, water, a
  printed label, an overlay) needs a gap the depth buffer resolves: ≥ 5·10⁻⁴ × the camera distance it is seen from (engine.md §4).
  Two faces at exactly the same height (a room box's floor on a floor plane) show as rectangular blocks on tiled GPUs, even in stills.
- Geometry thinner than ~1 px at the widest view it appears in (poles, rails, ribs, wires, fins) crawls as the camera moves: thicken
  it, give it the tone of what is behind it, or leave it out. Small instanced objects (foam trees, rivets, pebbles) get their shape from
  geometry, not from a noise normal map (that sparkles).
- Glossy bevels on long edges draw a 1-px highlight that steps pixel by pixel: satin finish there (roughness ≳ 0.5, no clearcoat).
  High-contrast textures seen at grazing angles: anisotropy 4, not 16. Neighbouring small things of very different tone (trees on
  bright ground) step more than merged, similar-toned masses (canopies).
- FXAA doesn't fix stepping under a moving camera (it measured worse). The engine's motion blur streaks slow moves like a
  1/50 s shutter, which is what calms it; `scripts/flicker_probe.mjs` tells which kind of flicker you have (qa.md §5).

## 11. Text-layer patterns

- A caption per beat or per subject; title (short) and line (the fact) in the first language, then the second language (plain words, in
  parentheses) — English + Korean by default.
- Comparison right after a reveal: `callout` with ×N against the familiar reference; `leader` on the reference when it is tiny.
- Pinned labels for named parts (education-grade naming, in the film's languages); `'hyp'` for hypothetical things.
- Ruler ticks at round numbers in the film's units; `fmt` gives "≈ value unit".
- Human-scale panel: view width as ×N of a familiar reference, plus an analogy (cosmic `applyScale`: "if Earth were a 1 mm grain of sand…",
  with familiar lengths as anchors). → cosmic p8_timeline.js `SAND_REFS`, `sandLen()`, `bigCount()`

## 12. Products and materials (showcases, ads) — the quality bar in practice (P29)

→ `engine/demo-ad` (p3_studio.js, p4_product.js, p5_inside.js) is a worked example of every point here.
- **A studio built for reflections**: a small environment scene of emissive panels — a large key softbox, one or two tall strip lights behind,
  an overhead, a dim bounce — around a dark graded backdrop, turned into `scene.environment` with PMREMGenerator. Metal and glass then show
  the long clean highlights of real product photography. Add one key and one or two rim DirectionalLights in `scene` for shape.
  (`studioEnv()` — RoomEnvironment — is a quick default, not a product look.)
- **Form**: real proportions (from research). Lathe profiles sampled at even arc length for anything round, with fillets where real parts have
  them; chamfers as their own polished surfaces; parting lines as thin dark gaps; `RoundedBoxGeometry` for boxes — no sharp CG edges.
- **Surface**: micro-structure drawn once on canvases — knit or weave (height → normal map by Sobel), concentric or linear brushing, paper
  fibre, printed labels, PCB solder mask with pads and silkscreen. Break perfect regularity slightly (jitter) or it beats into moiré.
- **Materials** (`MeshPhysicalMaterial`): fabric rough everywhere with sheen (shiny crevices glitter); metals rough enough (≳ 0.3; polished
  chamfers ~0.15) that thin highlights don't shimmer; glass black with clearcoat; rubber matte with a little sheen.
- **Detail fades with distance**: normal-map strength (and sheen) as a function of `field` — full in close-ups, none once the pattern is a
  few pixels wide (otherwise it shimmers and moirés).
- **Floor**: unlit (a lit floor goes half bright with a hard edge; a glossy one mirrors strip lights as big white streaks), a pool of light that
  fades into the backdrop's colour (no horizon line), and a contact shadow: a wide soft falloff plus a tight dark core under the base.
- **Depth of field** (`FILM_DOF`): shallow in close-ups, gentle when wide.
- Light that moves across the product (a sweep, or the camera orbiting past the softboxes) is real motion (P7 b), not a reveal from darkness (P16).

## 13. Moving between framings — one continuous camera (P24)

- Never cut. Every change of framing is a camera move: orbit, crane up/down, push-in, pull-back, dolly past or behind something, or a
  combination. The camera path of a product film can be one slow orbit per loop (yaw −40° → 320°) that meanwhile cranes up to a detail,
  pulls back for an exploded view and comes down for the end card — the last key equals the first, so the loop closes.
- Keep turn rates ≲ 15–30°/s in key beats, ≤ 45°/s elsewhere and ≤ 90°/s on the way back; zooms ≤ 3 e-folds/s everywhere but the way
  back (QA pace). A long way to go is planned into the time budget (pacing.md §2), not played faster.
- Slow motion for a climax = a `key` beat with the action authored slowly (or a lower speed for that beat).
- Every tweened value (parts, lights, colours) returns to its first value by the end of the loop.

## 14. Exploded views and assembly

- Every part is modelled in place from the first frame (inside the shell if hidden); disassembly is `tween`ed positions — outer parts first,
  then the insides spread along one axis; reassembly in reverse. Parts never pass through each other (order and axis chosen so).
- Labels pinned to moving parts: `tag(t0, t1, () => currentPosition, en, ko)`.
- A cutaway that shows an inside is a prepared section (P6/P9), visible for a reason from the start, or a real disassembly.

## 15. Characters, stylised worlds, effects (game or app demos, stories)

- Stylised shading where it fits: `MeshToonMaterial` with a small gradient map, an outline by a back-face inverted hull
  (`side: BackSide`, slightly scaled, black) — or flat-shaded low-poly. One style across the whole world (P5).
- Procedural characters and props from primitives, jointed with groups; animate joints with `tween` or periodic functions of tp
  (walk cycles: whole cycles per loop). Supplied rigged models: `loadGLBData` + `THREE.AnimationMixer`, driven by `mixer.setTime(t)` from
  τ or tp (never `update(delta)` — it accumulates and breaks determinism).
- Effects (sparks, trails, dust, magic): instanced points or sprites whose positions are a pure function of time and a seed (no stored state);
  additive blending, sizes in device pixels (`makeCloud` pattern, cosmic p4_points.js).
- UI in the world (a game HUD, an app screen): a canvas texture on a plane that is part of the scene (a device screen), drawn once or updated
  deterministically from τ.

## 16. 3D lettering and logos

- 3D text: add `FontLoader` and `TextGeometry` imports to p1_head; load a typeface JSON from the three CDN
  (`https://cdn.jsdelivr.net/npm/three@0.160.0/examples/fonts/helvetiker_bold.typeface.json`) into READY. Latin glyphs only; Korean text stays in
  the DOM text layers.
- A logo built from paths: `SVGLoader` + `ExtrudeGeometry` (add the imports), from the real file if found; never approximated from memory.
- Assembly of a logo is motion (parts flying into place along smooth paths, P7 b), never popping.

## 17. Supplied or found assets

- Images and models found in research or supplied by the requester are embedded with `scripts/embed_assets.py` into `parts/p3_assets.js`
  (data URLs), loaded with `loadTextureData` / `loadGLBData` into READY. Credit sources and licences in the header comment.
- Downscale first; keep the film ≲ 10 MB. Photos go onto surfaces that exist in the scene (a screen, a label, a planet map), never as flat
  inserts (P24).

## 18. Processes of formation — scan, wipe, lift, decompose, reassemble, spread, gather (P7 c)

When the story itself is things forming, changing or coming apart, each change is driven by something visible that moves, and
everything stays a pure function of τ.
- **A front that makes or removes**: a scan sheet, a wipe, a projector beam, a growth line. What it creates exists only behind the
  front (a per-fragment mask from a uniform, anti-aliased with `fwidth`), and the front itself is drawn — a bright line on every surface
  it crosses, a faint sheet in the air. Things that leave (particles lifting off) are released when the front passes them: store each
  one's release time by inverting the front's path once at start-up, and animate from its age.
- **A copy of an object** (a digital twin, a hologram, a ghost, an X-ray) is the SAME geometry with another material (P5): additive,
  `depthWrite: false`, `polygonOffset` (−1, −2) so it lies exactly on the original; separate it by moving its group (lift, slide).
- **Decompose**: merge the parts with a per-vertex attribute (the part's centre xyz and a delay); the vertex shader shrinks each part
  toward its centre while its pieces (nodes, particles) are born inside the part's volume and brighten as it shrinks — the part's
  light passes into its pieces. Stagger delays by distance from a centre so it ripples.
- **Reassemble**: every piece flies on a smooth path — a quadratic Bézier with a raised middle and, if it should swirl, a turn about
  the centre that is zero at both ends (angle ∝ sin πu). Assign target slots greedily by direction (the farthest pieces choose
  first) so paths don't cross; pack the slots evenly (seeded points + a few rounds of repulsion).
- **Spread / gather**: scale the structure about its centre; anisotropic when the room limits it (less downward, so nothing sinks into
  the floor or the table). When the camera ends up inside, keep a clear sphere round the lens: a piece nearer than K is pushed out
  along its direction to K·(0.55 + 0.45 (r/K)²) — smooth, never through the lens. A gather closes all three axes within about the
  same time: one axis slightly first reads as "pressed between two hands"; one axis far ahead leaves a streak or a line.
- **The result has to go somewhere for the loop** (P26): into a solid object (hidden by it, not faded), out of view, or back into its
  source — and every uniform returns to its first value.

## 19. Holograms, glows and other additive light (P14, P15)

- **Additive light adds up**: estimate how many layers cover one pixel — count × on-screen area ÷ view area, times the depth the layers
  stack over — times each layer's intensity, and keep it ≲ 1–1.5 before bloom; above that the picture turns to white fog. A packed state
  (a dense cluster) gets a lower per-node intensity than the same nodes spread out.
- **A glowing node** (a particle of light, an atom, a star in a UI): a small hot core (e.g. exp(−9q²)), a soft body (√(1 − q²)), a faint
  rim, a halo ≲ 0.1. Fine patterns on it (rings, ticks, dotted orbits) fade in with its size on screen (pixel radius ~25 → 60) — the
  same shader for every node, the detail simply resolving when one is close (P5).
- **A hologram look** that reads at every distance: contour shading (bright where the surface turns away), fine scan lines
  (anti-aliased; drifting on playback time with whole cycles per loop), wire edges (`EdgesGeometry`, ~30°), points on the vertices with
  a minimum pixel size that dim rather than shrink; UI rings drawn by a tracing arc, turning in whole cycles per loop.
- **The light it throws**: a colour term on nearby materials (`onBeforeCompile`: diffuse × colour × exp(−d²/r²) around a position
  uniform in world units) and a pool on the floor, following the light's state — never a light switched on from nothing (P16), and back
  to zero when the loop closes.


## 20. Regular grids under a moving camera (pixels, memory cells, tiles, windows) (P10)

A perfectly regular pattern is the hardest thing to keep calm: when the camera moves it by about half a period per frame, every
pixel alternates (the wagon-wheel effect), and MSAA's four coverage levels turn a slowly moving high-contrast rim into steps.
What made a 1.22 µm pixel array pass `flicker` (from ~1,500 to < 3 per 10,000):
- **Prefilter by screen size**: in the pattern's shader, fade detail contrast with `fwidth` of the grid coordinate — full only when a
  cell spans ~20 device pixels, gone at ~7 — and blend its colour checkerboard to the mean below ~16 px.
- **Soften with the camera's motion**: the engine keeps the previous shutter's camera in `PREV` (T, D, q). Per frame, how many
  cell periods the view moves = (|ln D/D′| + |T − T′|/D + turn angle) × field / cell; above ~0.12 fade contrast (as a shutter's blur
  would), for the texture and for 3D copies alike (a uniform both read).
- **No dark hairlines**: gaps between cells as light as the cells' rims; 3D cells sit on the floor (no float), and each cell's
  silhouette melts into the floor's colour where its surface turns away (`N·V` → 0) — the rim then has no hard step to alias.
- **Move slowly over it**: a slow push, not a low glide; on the way back rise off the grid before retracing sideways.
- Keep highlights on small cells rough (sharpen them only once a cell is large on screen and the view nearly still).

## 21. Explaining one thing — the stop (P3, P17, P9, P30)

What made the Blackwell film easy to follow, and what the two films rejected as "skipping" lacked. Every thing a caption names gets a stop:
- **Arrive**: the move ends on the thing at about half the frame (P17), easing in (a short normal beat — no jolt, P8), under 3 e-folds/s.
- **Point before going in**: when the next step is a part of what is on screen, show which part while the camera still holds — a thin
  outline or a label with a leader on it — then move in on it. The viewer knows where they are going (Blackwell outlines "the tile we zoom
  into" before each dive).
- **Hold**: the camera slows to ≤ 0.8 e-folds/s and ≤ 30°/s — a slow push or a slow orbit keeps life in it — for the caption's reading time; labels name
  the parts on screen. The caption goes up when the thing is there, not while the camera is still on its way.
- **Leave**: the next move starts gently and stays under 3 e-folds/s, with something always in the frame (P9).
- **Places along a route** (a tower, a data centre, a landing site, the towns inland): each one a caption names is a stop of its own, or a
  label pinned where it is on one map stop. A caption never lists places the picture doesn't show.
- **Going through nothing** (the water column, the space inside an atom, orders of magnitude nobody has seen): keep the thing you are
  leaving or the thing ahead in the frame (the atom's cloud still at the edge while the nucleus grows), pass at the move's pace, let the
  ruler carry the scale. Never a flat colour, a fog or a lone dot for more than a moment (QA empty).
- **Sections and cut-aways**: seen from the side, well off their plane (≥ ~20°); edge-on, a section face reads as bands or a slab floating
  over the map. The ground or the water around them continues past the cut, and the camera never enters a cut face.
- **Imagery on terrain**: frame it so one texel is no more than ~2 px on screen; closer than that the place needs modelled detail. Never hide
  low resolution under depth of field or motion blur.
- **Say what each caption shows**: `caption(…, about)` names the object drawn for it (a mesh or group), and QA measures it on the
  pixels — visible, framed, ≥ 40% of the frame while the camera holds, for the reading time. If no drawn object fits a caption, the caption
  is about something the picture doesn't show: change the shot, not the check.
- **Time the caption to the stop**: it goes up as the camera arrives (at most 1 s of it over the move) and stays until the camera leaves;
  a reveal that is still moving is not yet the stop.
- **Closed models**: everything the camera can see from any side is closed — a building has a roof, a room its walls and ceiling, a lid
  its underside. A thin part (a cone, a membrane, a sheet, a ring) is `side: THREE.DoubleSide` and says so: `material.userData.thin = true`.
  From behind, a one-sided surface is not drawn (a hole in the picture); a two-sided shell without its lid is a hollow model — QA
  `surfaces` finds both, names the meshes, and finds the camera crossing any solid mesh (mark a water surface or cloud layer the camera
  goes through `userData.passable = true`).
- **Rooms seen from inside**: the walls, floor and ceiling face the camera — inward normals (`side: THREE.BackSide` on a box, or geometry
  built facing in) or real slabs with thickness. A box with outward faces and `DoubleSide` reads to QA as a hollow model seen from inside. A section view is a cut model with its cut faces drawn, not a camera inside an
  open one.

