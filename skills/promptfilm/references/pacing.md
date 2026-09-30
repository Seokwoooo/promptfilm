# Pace — the requester's own CapCut speed edits, built into the HTML

The requester screen-recorded the finished HTML films and sped them up in CapCut before posting them on X. Both posted videos were matched
frame by frame against the original HTML (the HTML rendered every 0.05 s → correlation against 6,537 video frames → dynamic programming that
allows only integer speeds) to recover the edit. The requester's rule: **"The really important parts I sped up [less]; the slightly boring parts
where people might leave, I sped up all the way."** Films from this skill must **play at that pace from the start** (no speed edit after recording).

## 1. What was measured

**Blackwell (original 154.0 s → video 48.6 s, mean ×3.17, no cuts, exactly one loop)**

| Speed | Video time | Original time | Used for |
|---|---|---|---|
| ×2 | 29.8 s (61%) | 59.1 s | full-chip schematic, inside the processing block, register file, one 6T cell, reading the bit, inside one CUDA core, "the tile we zoom into", gate/fin/channel, silicon atoms, crystal and gate stack, "N billion times closer", the pull-back home |
| ×4 | 14.0 s (29%) | 55.1 s | data hall → rack → card → die; SM → processing block → silicon; full-adder → XOR cell → transistor cross-section |
| ×8 | 4.9 s (10%) | 38.0 s | long zooms where nothing new appears: into the electron microscope, towards one CUDA core, the long zoom to the multiplier, towards the atoms |

- The ×8 stretches were the ones with the least change on screen in the original (about half the others).
- One beat (one caption) in the video: 1.4–3.0 s in ×2 stretches, 0.7–1.2 s in ×4, about 0.5 s in ×8.
- Zoom rate in the video: ×4 and ×8 stretches about 2.4 e-folds/s (≈ ×11 per second); ×2 stretches about 0.8 e-folds/s.

**Cosmic (original 176.7 s → video 60.4 s, ×3.0 throughout, no cuts, one loop + the opening title again for 1.5 s)**

- This HTML had already been made 3× faster at the requester's request ("too slow"); the requester then sped it up 3× again.
- Each body stayed on screen mostly 1.2–1.5 s (median of 41 captions: 1.32 s). The return: 4 s, then home 1.3 s.
- A structure of evenly similar steps, so no need to split speeds (= all "normal").

**Both**: 60 fps screen recordings, silent. Both videos start and end on the same scene, so they join Shorts' auto-replay seamlessly.

**Two later films the requester rejected — "it should zoom in and tell each one properly; far too much is skipped"** (a chat message
across the Pacific, 59 s; the Statue of Liberty down to the Planck length, 51 s). Same speeds, measured: the camera held still enough to
take things in for 19% and 46% of the loop (Blackwell: 61% at ×2); zooms reached 15–16 e-folds/s, six times the requester's fastest edit;
15 of 15 and 16 of 16 captions went before they could be read or while the camera was still moving; the way back took 13% and 22% of the
loop; 5.5 s and 12 s of frames had almost nothing to see. §2's limits come from that contrast.

## 2. The rule — mark beats and the engine plays them at that speed

Write camera keys and captions in authored time τ, then divide the whole timeline into beats (`beat(t0, t1, kind, name)`). The engine plays
each beat at its speed — so author with the speed in mind: a stretch plays (τ length ÷ speed) seconds, and its zoom plays (authored
e-folds per τ-second × speed) — at ×8 a move may change the view by at most e in 2.7 τ-seconds (3 e-folds/s played), at ×3.5 in 1.2, at
×2 in 0.7. A stop in a key beat needs its reading time × 2 in τ of camera nearly still (≤ 0.4 e-folds per τ-second, turns ≤ 15°/τ-s).
The engine plays each beat at:

| kind | Playback speed | Use for | Target once played |
|---|---|---|---|
| `hook` | ×2 | the opening: a hero striking enough to stop the scroll, plus the title | 1.5–3.5 s, the title readable |
| `key` | ×2 | what people came to see: the hero alone and large, the moment an inside / structure / mechanism shows, the climax | its caption's reading time (≈ 2.5–4 s), the camera held ≥ 2.4 s |
| `normal` | ×3.5 | steady progress: moving to the next subject, comparisons, a run of similar steps | held ≥ 1.8 s where it carries a caption |
| `transit` | ×8 | long moves or zooms where nothing new appears — the stretches people would swipe away from | as long as the move needs at ≤ 3 e-folds/s |
| `return` | ×3 | the way back to the opening | ≤ 12% of the loop |

**The limits that come with the speeds** — the speeds say how fast each kind of stretch plays; these say what it must still show (P3,
P8; QA `pace` and `read` check them all):
- **Every caption is a stop.** Its reading time = 0.7 s (finding the text, its fades) + the line the audience reads — the second-language
  line when there are two (plus a glance at the title, 25 characters/s), else the title and line — at 12 characters/s for Korean,
  Japanese and Chinese, 17/s for others. The caption is up at least that long, and for at least that long (and ≥ 1.8 s, 2.4 s in a key
  beat) the camera **holds on what it names**: zoom ≤ 0.8 e-folds/s, turn ≤ 30°/s, the target moving ≤ 0.4 view/s — with that object
  visible, framed and ≥ 40% of the frame. The caption goes up as the camera arrives; at most 1 s of it may ride on a move. A slow push
  or a slow orbit keeps life in a hold (techniques §21).
- **Moves stay under 3 e-folds/s, 45°/s and 1.5 views/s** everywhere before the way back (the requester's fastest edit: 2.4
  e-folds/s). A move of N e-folds therefore takes at least N/3 s played — plan for it, don't speed it up.
- **The loop is mostly held**: ≥ 50% of it (Blackwell: 61%).
- **The way back is one run of `return` beats at the end, ≤ 12% of the loop** — no new information; it may zoom up to 16 e-folds/s,
  steadily. A `return` beat anywhere else is not an exemption (QA fails it).
- Why stricter than the posted edits of §1 (captions of 0.7–1.5 s there): the requester's newer verdict — "it should zoom in and tell each
  one properly, one at a time; far too much is skipped" — overrides their earlier tolerance. The speeds stay theirs; the stops are new.
- Write the audience's line short in the first place (≤ ~24 Korean characters ≈ 2.5 s): long lines make long stops.

**The time budget — before the scene list is final** (plan.md Q7; `scripts/budget.mjs` computes it from the storyboard, whose cards give
the view's width at each stop): played ≈ Σ stops (each max(1.8 s — 2.4 in a key beat —, its reading time)) + Σ moves (the e-folds between
stops, less ~0.8 e-folds per second of the stop's own slow push, ÷ 2.4, + 0.4 s of easing) + the way back (its e-folds ÷ ~12, ≤ 12%). At the kickoff length that fixes how many stops fit — 45–60 s ≈ **8–11 stops**, 25–35 s ≈
5–6, 15–20 s ≈ 3. When the story has more steps: merge neighbours into one stop with labels on their parts (two towns on a route are
labels on one map stop — never a caption naming three places over a forest); cut detours (rising to orbit and diving back costs about
30 e-folds, ≥ 10 s of moves, each time); drop near-duplicates (P19). Never keep a step by flying past it.

- Target one loop of the **kickoff length** (the frame's `data-length`, default 45–60 s; qa pace checks it). If it runs long: ① merge or cut
  steps (the budget above) ② shorten the route (fewer rises and dives) ③ only then raise one class a little for moves, e.g.
  `const FILM_SPEED = { normal: 4 };` — never shorten a stop below its reading time, never push a move past 3 e-folds/s. Keep key beats at
  the taste profile's key speed (default ×2).
- A shorter length ("30 seconds", "15 seconds") is fitted with fewer steps first, faster playback last. Stops at the default speeds:
  15–20 s ≈ a hook, 2–3 stops, a quick return; 25–35 s ≈ 5–6 stops; 45–60 s ≈ 8–11; 60–90 s ≈ 11–16.
- The speeds in the table are the default taste's. A different taste profile sets its own through `FILM_SPEED`.
- The engine eases the speed change at beat boundaries over ~0.3 s each side. A camera that stops and restarts abruptly still jolts — e.g. a
  long dive starting at transit speed straight from a hold. Give it a short `normal` beat to ease into the fast stretch (qa pace warns when
  the zoom rate changes by more than 2.5 e-folds/s and by more than half within 0.1 s).
- Captions stay up for their **reading time** (above). If one is too short, give its stop more τ, let it span two beats, or merge
  captions — never cut a written caption short on screen. The design stays the engine's (P28).
- Fades (captions 0.2 s, labels 0.2 s, leader labels and ratios 0.15 s) are timed by the engine in playback seconds.

Other formats use the same classes: a product's hero views and feature close-ups are `key`, the moves between them `normal`, the end
card `key`. Slow motion for a climax: author the action slowly in a `key` beat (or give that beat a lower speed). A logo sting or a teaser
may be shorter than the kickoff length — decide it in plan.md, change the frame's `data-length`, and QA follows it.

## 3. Traps that come with speed

- **Ambient motion runs on playback time.** Spin, flow, flames, twinkle driven by authored τ run 8× faster in transit. Drive them with **tp**
  (playback time) in `applyScene(τ, tp, field)`, with a whole number of cycles per loop (LOOP) so the seam is invisible (put the phase
  `2π·tp/LOOP` into noise as a point on a circle and the pattern comes back to its first state without a jump).
- **Motion blur uses a playback-time shutter (1/50 s)**, computed by the engine: fast stretches blur more, as they should. (Speeding up a
  recording afterwards left too little blur, so fast motion looked choppy.) Above ~3 e-folds/s the zoom blur smears everything but the
  centre of the frame — the "broken" look (P30), and one more reason for the cap.
- **Entrance/exit fades** may be set in τ, but make them last ≥ 0.25 s at playback speed (in transit, τ 2 s = 0.25 s played).
- The faster the pace, the more `presenceCheck` matters: entrances at the edge are more noticeable during fast moves.

## 4. When the requester edits again — in the Studio, or in a video editor

**In the Studio** (the usual way now): the requester drags a beat longer or shorter, or presses slower / faster; the edits land in
`parts/p8z_pace.js` as `PACE_EDITS` and the film plays them. Treat them as this section's measurements, already applied: keep them, carry
them over when beats change, and when a pattern repeats across films, propose it for the taste profile's pace table (studio.md §4).

**In a video editor** — learn from that video:

If the requester records a film from this skill and re-edits it (speed, cuts), analyse it the same way and adjust the rules:
`scripts/edit-analysis/README.md` (render the film every 0.05 s → correlate with the video's frames → integer-speed dynamic programming →
compare with the beats). Wherever the result is not ×1, change that beat's kind or FILM_SPEED, and update the tables above.
