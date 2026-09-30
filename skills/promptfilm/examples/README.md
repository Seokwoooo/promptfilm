# Examples — code patterns from the two reference films (not content, not templates)

Both films predate this skill's engine: they are 1:1, authored at the old comfortable pace (the requester sped them up by hand), and have
their own copies of the engine code. Use them to see **how** something was built; build the new film on `engine/` and its own research.

- `blackwell-silicon-to-scale.v11.html` — one file, 154 s. Data hall → rack → server → card → die → SM → processing block → memory cells →
  CUDA core → multiplier tiles → logic cell → transistor section → silicon atoms → back. Patterns: sourced architecture numbers with asserted
  totals (`ARCH`, `DERIVED`, `ARCH_CHECK`), instanced hardware (`rec`, `buildSM`, `chipBlocks`), texture → 3D detail by distance
  (`applyPatchFade`, `RELIEF`), an electron-microscope look driven by magnification (`SEM`, `applySemLook`), pixel fog around the target
  (`uFogCenter`), a speed warp (`WARP`), camera keys with Hermite interpolation, QA hooks (`__bw`).
- `cosmic-scale/parts/` — the parts of the 177 s cosmic film (v16). `p3_bodies.js`: lit planets, proportional halos (oblate aware), stars
  with luminosity-driven glow, the Sun modelled on telescope imagery, presence fades (`INTRO`); `p4_points.js`: point clouds with pixel
  sizes and depth windows (`makeCloud`); `p5_maps.js`: orbits, fat lines, shells; `p6_volume.js`: ray-marched galaxies, the cosmic web,
  inverse-CDF sampled galaxy field (`GAL_FIELD`), a baked sky; `p8_timeline.js`: lineup framing (`compFrame`, `heroPlanet`), captions,
  callouts, leaders with penalty placement, ruler, the human-scale panel (`SAND_REFS`, `sandLen`), exposure, return path.
  `p0_data.js` (5.7 MB of base64 textures and catalogues) is not included; `tools/prep_data.py` shows how it was packed (sources and licences
  in its docstring). These parts do not run on their own.
