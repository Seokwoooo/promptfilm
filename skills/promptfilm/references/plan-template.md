# Plan — <film name>

Answer every question before writing scene code; keep this file open while building and update it when a decision changes.
There are no topic answers in the skill: these questions produce them.

## Request
- Request (as the requester wrote it):
- Purpose (inform / explain / sell / excite …) and core message (what should the viewer know or feel at the end):
- Format (formats.md) and the camera path (always continuous — how it travels between framings and back to the start):
- Start and end (requester's, or yours with a reason); how the end flows back into the start:
- Aspect / length / languages (kickoff): 9x16 · 45-60 s · en ko
- Anything else the requester specified:
- Research scale (light / medium / deep) and the requester's answer at kickoff:
- Taste profile in use (the skill's taste.md, ~/.promptfilm/taste.md or ./.promptfilm/taste.md) and anything it overrides:

## Q1. Facts
The fact table lives in research/facts.md (value, unit, source, confidence). List here the facts the film cannot do without, and which
totals will be computed and asserted in code.

## Q2. Context and ending
Where does the subject really live, and what does a viewer already recognise (P1)? Where must the film end for the message to land?

## Q3. Scenes
One row per level (journey) or per framing the camera passes through. Adjacent scenes must not leave a gap a viewer would notice (P3), and
each must show something clearly new (P19). For a journey, give the view width; otherwise the framing and the camera move into it. Every
row with a caption is a **stop**: the camera holds on what the caption names while it is read (techniques §21) — how many fit is Q7's
budget.

| # | Framing / view extent | What is seen | Repeated elements (count) | Motion (camera, objects, light) | Caption (first / second language) | Beat kind |
|---|---|---|---|---|---|---|

## Q4. Repeated elements and the hero
What appears many times, and which one does the camera pick? One definition each. From what on-screen size does the hero's extra detail
become visible, and how does it stay identical to its neighbours until then (P5)?

## Q5. Transitions
Every moment something **becomes visible**: why (P7 a / b / c)? Every far → near representation switch (techniques §5). Every subject that
must be hidden before its turn: when does it fade, and is it off-screen then (P25)? How does the camera get from each framing to the next
without a jump (P24)?

| τ | What becomes visible | Why (a/b/c) | Off-screen fade needed? |
|---|---|---|---|

## Q6. Showing insides
Where must an inside or a cross-section be shown? How can it be visible for a natural reason (a gap, an edge, a prepared section, a
disassembly), without a hole in the middle of the frame (P9)?

## Q7. Pace budget
First the budget (pacing.md §2), before the scene list is final: each stop at its caption's reading time (0.7 s + the audience's line at
12 characters/s for Korean; ≥ 2.4 s for a key stop), each move at ≤ 3 e-folds/s (e-folds = ln of the view-width ratio, plus distance
travelled ÷ view width), the way back ≤ 12% of the loop. If the sum is over the kickoff length: merge steps into one stop with labels, cut
detours (a rise to orbit and back is ~30 e-folds), drop near-duplicates — never fly past a step.
`node <skill>/scripts/budget.mjs <film>` checks the storyboard's cards against this budget (each card gives `field`, the view's width at its stop).
Then author at a comfortable pace (e-fold of view width per 3–5 s; in a stop, the camera nearly still for twice the caption's reading
time in τ; 5–15°/s turns) and assign beats (pacing.md). Estimate the played length: Σ (beat τ length ÷ speed).

| Stop / move | τ from–to | kind | e-folds (moves) | reading time (stops) | played (s) |
|---|---|---|---|---|---|

## Q8. Risk list (pre-mortem)
For each principle, where is this film most likely to break it? (e.g. a hero that needs a precise model → P5; large plain surfaces → P9;
fine repeated lines or glossy edges → P10; a famous subject people know from photos → P21; many similar steps or shots → P19; a bright body
near the frame → P14; an animated value that doesn't return at the loop point → P26.) These are the places QA and the review look at first.
Also, for any film: surfaces stacked closer than the layer gap (engine.md §4) → P10; glossy surfaces the key light can glint on → P14;
many glowing / additive things overlapping → P15 (techniques §19); thin parts under a pixel in the widest view → P10; every label with
room to show (QA labels); anything that forms, grows or dissolves → its visible cause (techniques §18, P7 c).

## Q8b. Quality bar (P29)
For every object the camera shows at full size: its real proportions (source), its secondary detail (bevels, chamfers, seams, fasteners,
labels) and its surface (texture, micro-structure), and the materials and light that make it read. Which reference photos will you compare with?

## Q9. Fact vs illustration
Which parts are confirmed facts and which are simplified, estimated or staged (sections, highlight colours, layouts not made public)?
Put that distinction into the captions ("illustrative").

## Storyboard
Written to storyboard.json from Q3, Q7 and Q9 (references/storyboard.md). Version, the requester's answer, what changed:

## Review log
### Review 1 (date, version)
- findings → fixes
### Review 2
