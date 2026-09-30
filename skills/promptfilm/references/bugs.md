# Bugs actually met (they recur on any topic)

| Symptom | Cause | Fix |
|---|---|---|
| SyntaxError at start | a `//` comment put mid-line swallowed the code after it | comments on their own line |
| Shader compile failure | GLSL reserved word (e.g. `active`), smoothstep argument type mismatch, fwidth inside a branch | rename, match types, fwidth outside branches |
| `Cannot access 'X' before initialization` | const declaration order across parts | move shared constants earlier (p2 or the top of p3) |
| A large plane all black or hazy | per-vertex fog | per-pixel fog |
| Black screen in one stretch | a non-unique id picked the wrong subject → camera aimed elsewhere | explicit flags for the chosen subject; `camAt(t)` |
| Camera through a floor / wall | overshoot of a flow key before a big jump | make that key `flow: false`; `insideCheck` |
| Only the hero looks different | precise model had different material / emission / post | unify everything (P5) |
| Double pattern | texture under the 3D still draws the same pattern | base colour where 3D stands |
| Flicker | near-coplanar faces, slivers, per-frame noise, sub-pixel lines, hard procedural edges | spacing, remove slivers, fixed noise, `lineAA`, fwidth edges |
| Square patches popping in the distance | detail 3D visible far away with a different colour | distance-based dither fade, near only, brightness match |
| Translucent 3D showing through AO | depth pre-pass includes everything | AO in proportion to the fade |
| Hole in the middle of the frame | hollowed the centre to show the inside | natural gaps and edges (P9) |
| Pace suddenly slow mid-film | uneven speeds between stretches | beats + speed classes; merge captions |
| Whole picture tinted one way | one material value for every region | per-region values |
| Parts intersecting | placement coordinate mistakes | close-up frame checks |
| "It's not fixed" | cached old version | check what's published; hard reload (P13) |
| Low fps | always-on instances and shadows | near only, merge, fewer shadows, culling |
| **Flickering black blocks** | NaN from a shader (e.g. `pow` of a negative, normalising a zero normal) spread by bloom | fix at the source (clamp, `max(len, 1e-6)`); the engine also turns NaN/Inf into 0 before bloom. Found only by **live playback** capture — seek-mode scans missed it once |
| Picture darkens for no visible reason | exposure computed from a bright body **outside** the frame | count only the on-screen part (`screenCover`) × presence |
| Dark crescent beside a flattened body | a circular halo around an oblate shape | a halo that follows the outline (axis + flattening uniforms) |
| Next subject peeks into the current close-up | it is drawn before its turn and large in perspective | presence fade while off-screen, bigger gaps, check hero framing with its neighbours |
| Loop seam mismatch | a hidden layer counted in exposure; ambient motion not periodic; last key ≠ first key | on-screen only; whole cycles per loop in tp; identical first / last key |
| Start-up takes 15 s+ | rejection sampling of hundreds of thousands of points | inverse-CDF sampling; precompute in the data script |
| Something visible pops at the frame edge during a fast move | fade happened while in view | `presenceCheck` = 0; fade earlier, while off-screen |
| Ambient motion races in fast stretches | driven by τ | drive with tp (playback time), whole cycles per LOOP |
| QA drift test failed right after load | captured during the first-load fade from black | wait ~2 s after start (qa does) |
| Fabric glitters like sequins | rough fabric with shiny crevices (a roughness map from height), bright heather yarns | roughness high everywhere, subtle yarn variation |
| Big white streaks or a half-bright floor | glossy / lit floor mirroring strip lights, directional light on the floor | unlit floor shader with a baked pool of light and contact shadow |
| A visible horizon where floor meets backdrop | floor edge colour ≠ backdrop colour | fade the floor into the backdrop's colour and alpha towards its edge |
| Wavy moiré or shimmer on fabric / fine patterns at mid distance | a regular micro-pattern a few pixels wide under moving light | jitter the pattern; fade the normal map (and sheen) with distance |
| Dashed lines crawl | dashes a few pixels long moving | solid faint lines |
| A seam jump in a product film | a light sweep or part position not returned by the loop's end | every tween ends at its first value |
| Camera jump (QA continuity) | a cut, or two keys at nearly the same time with different poses | continuous moves only (P24) |
| Looks like a mock-up | bare primitives, no bevels / seams / textures, flat materials, no studio reflections | the quality bar (P29, techniques §12) |
| `Identifier 'X' has already been declared` at start | a film part repeats an engine name or another part's (all parts share one scope) | `build.sh` now stops and names both lines; rename the film's |
| Rectangular, tile-shaped blocks on a large flat surface, even in paused frames | two surfaces at exactly the same height (e.g. a room box's floor face on the floor plane) z-fighting on a tiled GPU | sink or lift one of them; keep the layer gap (engine.md §4) |
| A small flat detail flickers: a plaque, a decal, a printed label, a water surface | it sits closer to its base than the depth buffer resolves at that distance | gap ≥ 5·10⁻⁴ × camera distance (engine.md §4) |
| A white glare blob that swells and shrinks as the camera moves | the key light's specular glint on a glossy surface (water, glass, polished metal, clearcoat), spread by the bloom | roughness ≳ 0.3 or `specularIntensity` ≲ 0.5 where the key light can glint toward the camera |
| An object far darker than its base colour | a helper canvas with an opaque black background (a mask, a land map, a height map) drawn over the colour canvas | composite with `screen` / `lighter`, or draw the helper on a transparent background |
| The picture turns into white fog where many glowing things overlap | additive layers stacked past the budget (big halos, many nodes, dense clusters) | techniques §19: small cores, faint halos, dimmer when packed |
| A label never appears | no room for it: outside the label zone, under the caption, off screen, behind another label | QA `labels`; move its point or its window |
| QA flicker ≥ 10 though paused frames look clean | motion stepping: fine detail under a camera moving ~1 px per frame | `flicker_probe.mjs` to confirm and find the group; techniques §10 (FXAA made it worse) |
| QA contact sheets "ffmpeg failed" | relative frame paths in ffmpeg's concat list (resolved against the list file's folder) | fixed in qa.mjs (absolute paths) |
| QA numbers that don't match what you see | the film was rebuilt while qa.mjs ran (it reopens the page) | don't rebuild during a run; the report flags `stable` |
| A caption's first appearance in a fallback face (and in a recording) | Google Fonts loads each script subset only when its characters first show | the engine preloads every displayed string's fonts before starting (p10); the renderer also shows every moment once before capturing |
| Rendered frames differ slightly depending on the order they were captured | text layers promoted with `will-change` keep a raster whose subpixel position depends on the previous frames | capture with `#frame, #frame * { will-change: auto !important }` (render.mjs, Studio snapshots) |
| An old film (pre-`external`) shows GL "attachments are not all the same size" after its window resizes | its render targets keep the old size | reload it at the same moment (the Studio does); films from the current engine resize cleanly |
| QA `nan` fails on a few pixels in one frame, at different moments each run | a mirror-smooth surface (roughness ≲ 0.03, clearcoat roughness 0.01) catches the directional key: its specular peak overflows the half-float render (> 65,504 → Inf) | no roughness / clearcoat roughness below ~0.06 on anything the directional lights reach |
| QA `nan` again, only from some angles | `pow(v, k)` of an interpolated varying that should be ≥ 0 — interpolation dips it to −1e-8, and pow of a negative is NaN | clamp before pow: `pow(clamp(v, 0.0, 1.0), k)` |
| Inside a closed object (a camera module, an engine) everything is hazy, glinting or grey | its materials still reflect the studio environment and take the studio's directional glints; through back-face-culled walls the view runs out of the object | give the inside its own dark environment (`material.envMap`), strip direct light from inner glass (`onBeforeCompile`: zero `reflectedLight.directSpecular` / `clearcoatSpecularDirect` after `lights_fragment_begin`), close it in a black housing |
| A regular grid (pixels, cells, tiles) shimmers under a moving camera, even with antialiasing | the pattern moves near half its period per frame (temporal aliasing); dark gaps and sharp rims are 1-px lines | techniques §20: prefilter by screen size, soften with the camera's own motion, gaps as light as the rims, silhouettes melting into the floor, slow pushes instead of low glides |
| The watcher prints the old request format after the skill's scripts changed | a watcher started before the change runs the old code | restart `studio/await.mjs` after updating the skill |
| "Start production" / "Send to Claude" reached another session (two films in one folder) | a watcher started without `--film` waits for any film | always `await.mjs --film <film-id>`; the Studio now sends a film's request only to that film's session |
| The Studio opens on an old film | a link without `#film=…` | open it with `server.mjs <dir> --film <id>` (or link `…/#film=<id>`); without it the page shows the film worked on last |
| Frames smeared outward from the centre; a step gone before it can be seen | zooms of 5–16 e-folds/s (long transits at ×8) under the engine's playback-shutter motion blur | ≤ 3 e-folds/s outside the way back (QA pace); shorten the route or merge steps instead of speeding up (pacing.md §2) |
| A caption over something else ("through the servers" over a rooftop; three towns over a forest) | captions timed to beats while the camera is still moving; the named things never framed | each caption on its stop (techniques §21, QA read); label places on a map stop |
| A second or more of flat colour, fog or a lone dot | the space between two levels (a water column, the inside of an atom, the unknown) has nothing drawn in it | keep the neighbouring levels in the frame, pass at the move's pace (techniques §21); QA empty |
| Horizontal bands, or a slab floating over the satellite map | a cut-away section seen edge-on or from above, its faces stacking with the water or ground plane | look at sections from the side (techniques §21); end the section where the camera doesn't graze it |
| Buildings with black holes for roofs; a wall panel standing alone on a roof | instanced boxes missing a face (or back-face culled from above); a part placed without the model it belongs to | close every model; look at each at full size from every angle the camera takes (P30) |
| QA surfaces: "inside a model / through a missing face" | the camera inside a building, room or terrain whose faces point outward; an open box (no roof, lid or ceiling) seen into; a thin one-sided part (a disc, a cone, a membrane) seen from behind | close the model (roof, walls, the lid's underside), make thin parts `side: THREE.DoubleSide`; a section view draws its cut faces (techniques §21). The QA report names the meshes at the worst moment (`_dbg.surfaceWho()` — give meshes a `name`) |
| QA read: "not a stop" though the camera holds | the caption's subject (`about`) is small in the frame, off to the side, or not drawn then | frame what the caption names at ≥ 40% of the frame, visible (not behind something), or caption what is framed |
| QA engine: "differ from the skill's engine/core" | the film carries an older (or edited) engine copy in parts/ — the newer checks can't run in it | copy `engine/core/p2_core.js`, `p7_post.js`, `p9_engine.js` into the film's parts/ and rebuild (the film's own parts stay); fix what the new checks then find |
| QA pace: "'return' beats before the way back" | a mid-film stretch marked `return` (by the author, or a Studio pace edit) to escape the limits | only the last run of beats is the way back; give the stretch its real kind |
| QA read: "about a sphere with nothing drawn" | `caption(…, subject(pos, r))` — a declared sphere, not the object on screen | pass the mesh or group (or `subject(…, { obj })`); if nothing drawn fits, the shot doesn't show what the caption says |

| An early frame stays on screen, laid over later scenes, after the window or render size changes (the render goes to its output size); console: `GL_INVALID_FRAMEBUFFER_OPERATION … Attachments are not all the same size` | a depth texture drawn into and also read by a `ShaderPass`: the pass clones its uniforms, the clone shares the texture's GPU storage, and three r160 then never re-allocates it at the new size | after creating the pass, give it the original: `pass.uniforms.tDepth.value = aoPass.depthTexture` (examples/blackwell…html does this for its DOF and SEM passes); check a frame at the render size against the same frame after a resize |
