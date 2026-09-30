# QA — measure, then look

Nothing is "done" until it is measured. Report only measured numbers; anything not measured is reported as "not checked".

## 1. Setup (once per machine)

```bash
cd <skill>/scripts && npm install            # playwright-core, pngjs
npx playwright install chromium              # only if Chrome for Testing is missing (common.mjs finds it in ~/Library/Caches/ms-playwright)
python3 -m http.server 8765 --bind 127.0.0.1 # from a folder above the film (module scripts + importmap need http://)
```
ffmpeg is used for contact sheets (`brew install ffmpeg` if missing).

## 2. Run

```bash
node <skill>/scripts/qa.mjs http://127.0.0.1:8765/<path>/<name>.html --out <film>/qa            # everything (~LOOP×3 s + a few minutes)
node <skill>/scripts/qa.mjs <url> --out <film>/qa --only load,engine,err,pace,read,empty,surfaces   # fast loop while building
node <skill>/scripts/ship.mjs <film>                                  # a round done: build → FULL QA → review material + brief → gate
node <skill>/scripts/shot.mjs <url> --out <dir> [--dpr 2] [--safe] [--text0] [--sheet 4] 1.5 3 4.25   # frames at chosen times (+ one tiled sheet)
node <skill>/scripts/flicker_probe.mjs <url> <t> [--list] [--hide "name=<predicate>"] …                  # what flickers at t, and which kind (§5)
```
Output: `<film>/qa/qa-report.md` (table and the verdict for this build), `qa-report.json` (with `build` — the html's hash — `full` and
`ready`), `sheet_1s.png`, `sheet_05s_*.png`, and evidence images in `empty/`, `surfaces/`, `flicker/`, `pops/`, `live/`.
Only a **full** run (no `--only`, `--skip`, `--loop`, `--w/--h`) on the **current build** counts toward delivery: `node scripts/gate.mjs
<film>/<name>.html` is READY when that run passed and the visual review of the same build passed (references/visual-review.md);
render.mjs makes no final video before. A result in a check's "look" band (flicker 3–10 per 10,000, pops suspects) is not a failure: it
goes to the visual review as a flagged frame. A failure the requester **explicitly** accepts as it is — in their own words, in the
conversation — is recorded in `<film>/qa/accepted.json` as `[{ "check": "flicker", "why": "…", "requester": "<their words>", "build":
"<hash or *>" }]`: QA and the gate report it instead of failing it, and the delivery report names it. Never write one on your own
judgement, and never to get past a check. qa.mjs exits 1 while anything fails.
The scripts open the film at its own aspect (the frame's `data-aspect`; `--w --h` override) and take the length target from its
`data-length` (the kickoff answer); `--loop a,b` overrides it.
**Don't rebuild while qa.mjs runs**: it reopens the page for several checks, and a rebuild mid-run mixes two versions (the report then
shows `stable — FAIL`). Take screenshots and probes between runs, or on a copy.

## 3. Checks and pass criteria

| Check | What it measures | Pass |
|---|---|---|
| load | error box, start-up `PROBLEMS` (beats cover the loop, no caption under 1 s — a sanity check; `read` holds the real rule — last key at LOOP_T) | none |
| engine | the film's html contains the skill's current `engine/core` parts (p2, p7, p9) word for word — the checks below live in them | all three; else copy them into `parts/` and rebuild |
| err | console / shader errors while seeking across the loop | 0 |
| pace | loop length; each beat's played duration, max zoom (e-folds/s), turn (°/s) and sweep of the target (views/s); the share of the loop the camera holds (zoom ≤ 0.8 e/s, turn ≤ 30°/s, target ≤ 0.4 view/s); the way back — the last run of `return` beats — and its share; zoom-rate jolts | loop within the film's `data-length`; hook ≤ 3.5 s; before the way back zoom ≤ 3 e/s, turn ≤ 45°/s, sweep ≤ 1.5 views/s; on the way back zoom ≤ 16 e/s, turn ≤ 90°/s; no `return` beat anywhere else; held ≥ 50% of the loop; the way back ≤ 12%; no jolt (rate change > 2.5 e/s and > half within 0.1 s). What the requester's own Studio pace edits cause is reported as accepted |
| read | each caption: time on screen against its reading time (0.7 s + the audience's line at 12 characters/s for Korean, Japanese, Chinese, 17/s for others, + the title at 25/s with two languages); its **stop** — how long the camera holds while the object it declares (`caption(…, about)`: a mesh or group, or `subject(…, { obj })`) is **visible on the pixels** (hidden parts don't count), framed (above the caption band) and ≥ 40% of the frame's side, ≥ 0.5% of its pixels; the caption's time outside its stop; stretches with no caption | every caption ≥ its reading time; every caption before the way back declares a drawn object and is a stop ≥ max(1.8 s — 2.4 s in key beats —, its reading time), with ≤ 1 s of it over a move; no stretch > 5 s without a caption before the way back |
| continuity | the camera jumping between two 1/60 s frames (target moves > 25% of the view, zoom > 0.35 e-folds, turn > 12°) — a cut | 0 |
| inside | camera inside a `solid()` subject while drawn (every 20 ms) | 0 |
| presence | a subject fading in / out (or switching) while in view (every 20 ms) | 0 |
| nan | NaN / Inf in the HDR scene render (every 1/15 s) | 0 |
| seam | first frame vs last frame of the loop | mean < 2/255 |
| empty | frames with almost nothing to see (text hidden, a 320 px frame every 0.25 s): the share of pixels with visible local contrast, and the share covered by solid geometry | no stretch ≥ 0.5 s below 1.5% detail, or below 3% detail with solid geometry under 1% of the frame (a dot on a star field, textured fog); the reference films never go below 4%; images in `empty/` |
| surfaces | every 0.1 s, the scene drawn once more with plain materials: where the nearest opaque surface is the **back** of a surface (the camera inside a model, or looking through a missing roof, wall or lid — one-sided: a hole in the picture; two-sided: a hollow model) unless its material is marked `userData.thin`; what is pressed against the lens (closer than 8% of the distance to the target); every 1/60 s, the camera's path against every solid mesh (unless `userData.passable`; meshes over 200,000 triangles are left to the back-face scan and listed); the report names the meshes | back < 0.4% of the frame at every moment; nothing against the lens over ≥ 25% of the frame for ≥ 0.2 s; the path crosses nothing; images in `surfaces/` |
| flicker | pixels alternating up / down / up over 1/60 s frames, at the moments where the whole picture changes least (text hidden); for the worst two it also names the kind (nondeterministic / static / motion stepping, §5) | < 3 per 10,000; 3–10: look at the images; ≥ 10: fix (§5) |
| pops | a patch of the 3D picture changing in one 1/30 s step while steady before and after (text hidden, fast moves skipped) | 0, else **look** at pops/ (heuristic) |
| safe | text boxes inside the Shorts player's UI zones | 0 |
| labels | each pinned label, callout and leader, sampled across its window: the share of time the engine found room to show it (label zone, clear of the caption and other labels, point in front of the camera) | none never shown; each ≥ 60% (else look) |
| stable | the film file did not change during the run | (reported only when it did) |
| contact | contact sheets | **you look at every sheet** (§4) |
| fps | 540×960 at DPR 2 (= 1080×1920), ten segments | min ≥ 60 |
| duration | playback clock vs wall clock | 1.00 |
| drift | frame at t=2 before and after a full real-time loop (top 60%) | max diff 0 |
| live | real-time playback captured continuously; dark squares with bright picture on all four sides (black blocks) | 0 |

## 4. Looking (the part scripts can't do) — yours, then fresh eyes'

One round of your own, on what ship.mjs made: every frame QA flagged and every caption's stop (`qa/review/stops/`), then the sheets —
with the list below. Then the review by a fresh reviewer (references/visual-review.md), which the gate requires.

The Studio (references/studio.md) is the quickest way to look: scrub any moment, step frame by frame, hide the text (T), show the safe
zones (S). QA findings are not shown there — they are in `qa/qa-report.json` and the contact sheets, for you.

Look for what is wrong, not for confirmation. Two films that the requester found "skipping" and "broken all over" had passed every check
of the time, and their sessions had looked at the sheets and seen nothing. Open every contact sheet with Read and look at it frame by frame;
**a frame you would not post as a still is a finding**. Then open full-size frames (`shot.mjs --dpr 2`) of: the hook, every key beat's hero,
every caption's stop, every transition into a new level, the return, and anything the sheets made you doubt. Walk this list and write the
answers in plan.md under "Review N":

1. **Appearance (P7, P16, P25)** — does anything appear, grow, change shape or colour without a reason from P7? Anything at an edge that
   wasn't in the previous frame? Anything lighting up from dark?
2. **Hero shots (P15, P17, P21)** — is the subject about half the frame, lit so its form reads (terminator, rim), majestic against a calm
   background? Does it look like the real thing people know (compare with research/refs)? Anything creepy, plastic or plain? Anything
   blown out — a white fog where glowing things overlap, a glare blob that swells as the camera moves, a background panel read as a white slab?
3. **Sameness (P5, P14)** — do repeated things look identical, including the hero? Does the same subject look the same near and far?
4. **Centre (P9)** — is there an unexplained empty area in the middle? Is the camera looking at nothing while travelling?
5. **Order and steps (P3, P18, P19)** — one direction, no going back, no near-duplicate steps, no missing step between two scenes?
6. **Text (P12, P20, P28)** — captions readable (in the film's languages), labels next to the right things, no overlaps, ×N comparisons present,
   nothing in the player's UI zones (`shot.mjs --safe`)? Does the hero sit above the caption band with room to breathe (layout.md §3, §5),
   rather than the caption crowding its base?
7. **Pace (P8, P11, P27)** — do the pace table's durations match what the beats deserve? Would a viewer swipe away anywhere (→ transit or cut)?
   Is any key moment too short to take in? Is every move between framings continuous and unhurried (P24)?
8. **Loop (P26)** — do the last frames flow into the first? Is every animated value (parts, lights, colours) back where it started? Nothing pops on the way back?
9. **Facts (P4)** — do counts, sizes and colours on screen match research/facts.md? Are illustrative parts labelled?
10. **Quality bar (P29)** — put a full-size frame of every hero next to the reference films (examples/) and next to real photos of such an
    object. Would it pass as a professional render? Any bare primitive, missing bevel or seam, flat plastic-looking material, sparkle or moiré?
11. **Captions (P3)** — for each caption, write one line: what is on screen while it is up. If that isn't the thing it names — clearly,
    large, held — the step is skipped: fix the stop, not the wording. Places a caption lists must each be seen (a stop, or a label where it is).
12. **Broken (P30)** — sections seen edge-on (bands, a floating slab), parts standing alone, holes where a roof or face is missing, the
    camera through a wall, a building or a window frame, imagery smeared by being seen too close or hidden under blur, a zoom smear, fog or a
    flat colour between scenes (QA `empty` finds most of the last).

Fix, rebuild, re-run QA, look again. At least two full review rounds. Then the **visual review by someone who did not build the film**
(references/visual-review.md): `scripts/review.mjs` makes its material, a fresh subagent fills in the form, and the gate reads its verdict. A finding of one kind means: search the whole film for
the same kind (P13).

## 5. When QA flicker fails — find the kind first, then the cause

`node scripts/flicker_probe.mjs <url> <t>` at the reported moment prints three numbers and the kind:
- **same moment ×5 > 0 → nondeterministic**: something changes per render — per-frame random noise, a value that accumulates between
  frames, uninitialised data. Make it a pure function of τ / tp (engine.md §4).
- **still high at 1/600 s steps → static flicker**: coplanar or nearly coplanar surfaces (z-fighting — check the layer gap, engine.md §4),
  sub-pixel lines or patterns shimmering. Paused frames often already show it (rectangular blocks, speckle on one surface).
- **only at 1/60 s steps → motion stepping**: small detail stepping pixel by pixel while the camera moves ~1 px per frame (thousands of
  small parts, thin geometry, glossy bevels, textures at grazing angles). Remedies in techniques §10.
Then find where: `--list` prints the scene's objects; `--hide "name=<JS predicate on o>"` (repeatable) measures without each group, so
each group's share shows (a negative share means hiding it exposed something more contrasty behind it — e.g. the void under a floor). The heat maps (red = alternating) show where on screen. Re-measure after each fix; report the number
honestly if it stays above 10 after the remedies.

## 6. When the screen is black or wrong

1. `__bw.camAt(t)` — is the target / eye where you expect? If not: key interpolation or a subject-selection bug.
2. Raycast from the centre of the view to see what is hit (visible objects only).
3. Turn post off (render the scene directly), then hide objects one by one.
4. Test renders with `?freeze` and `seek` (so the animation loop doesn't overwrite them).
5. `__bw._dbg.nanScan()` at the moment; `__bw._dbg.flags.noMB = true` to rule out motion blur.
