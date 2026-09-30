# Formats — derive the film's shape from the request

A request names a subject and, sometimes, a purpose: "from Earth to the observable universe", "a Blackwell card down to atoms",
"an ad for our product", "a game demo", "how a jet engine works", "a logo sting", "how much water a city uses". Decide the format
yourself — never ask the requester to choose one. Many films combine formats (an ad that ends with a teardown, a journey that stops to
explain a mechanism). The list below is a starting point, not a menu: if nothing fits, derive the structure from plan.md's questions.

## 1. How to decide

Answer in plan.md:
- **Purpose**: inform, explain, sell, excite, commemorate?
- **Subject**: one object, a place, a process, a system of levels, a number, a brand, a character or world?
- **What must the viewer feel at the end?** (awe at scale, desire for a product, "now I get how it works", excitement to play…)
- **Camera path**: always one continuous camera — the requester rejects cuts in every format (P24). Plan how the camera travels from one
  framing to the next (an orbit, a crane, a push-in or pull-back, passing behind something) and how it returns to the opening pose.
- **Loop**: every Short loops; the last moment flows back into the first (e.g. one full orbit per loop), and every animated value returns.

## 2. Common formats

**Journey through scale or depth** (the two reference films). A continuous camera through levels: out from something familiar to the
unimaginably large, or into something down to its smallest parts. Beats: hook on the familiar thing → levels, each clearly different →
the climax (the extreme) → the return. Text: captions per level, ×N comparisons, the field-of-view ruler, the human-scale panel.
A journey along a route (a message from a phone to the other side of the world, a product from mine to shop) rises and dives several
times; each rise and dive costs e-folds, and moves stay under 3 e-folds/s — plan the route so the stops fill the film (pacing.md §2).
Principles that bite: P3, P5, P7, P9, P14, P17, P18, P19, P20, P26, P30. Research: every level's structure and numbers.

**Product showcase / ad.** The product as the hero in a studio: the look of it, what it does, what is inside, why it matters. Beats: hook
(the product, striking light) → feature shots (each one thing, close) → the inside or the making (an exploded view, a cutaway that is a real
disassembly) → it in use or in context → end card (name, tagline) → back to the opening. Camera: one continuous path — e.g. one slow orbit per
loop that cranes up to a detail, pulls back as the product comes apart, comes down for the end card (engine/demo-ad). Text: captions, labels on parts, a comparison if there is a meaningful one. Principles that bite: P4 (the
real product, exact model), P5, P15 (studio lighting that reveals form and material), P21 (as people know it), P10 (glossy highlights shimmer).
Research: official product pages and spec sheets, press images, teardown photos, colours and finishes; the requester's own product — find it
(the working folder, their website, earlier conversation) before asking anything.

**Game or app demo.** A world, characters or UI shown the way a trailer shows gameplay: the setting, the player's view, the key mechanic, a
climax moment, the title. Beats: hook (the most striking moment first) → the world → the mechanic → escalation → title card → loop. Camera:
one continuous path — chasing, orbiting, flying through the world from one moment to the next; slow motion on the climax (a `key` beat). Text: captions for mechanics, labels for UI or
characters. Principles that bite: P7, P15, P21 (genre conventions people recognise), P27 (keep only the exciting parts at ×2).
Build: stylised shading (toon or flat) where it suits, particles for effects, procedural characters and props (or found/supplied models), all
to the quality bar (P29).

**How it works (process or mechanism).** A machine, a body system, a natural process, shown moving in the right order. Beats: the thing
as people know it → open it by a real means (a cutaway section prepared from the start, or a disassembly) → the cycle, step by step, each step
a beat → the whole cycle running → back. Continuous camera usually. Text: captions per step, labels on parts. Principles that bite: P2, P3,
P4, P7(b)/(c), P9 (no hole in the middle to see inside). Research: the mechanism's real sequence, timings and parts.

**Title, logo or brand sting.** Short (often 10–20 s, but still a loop): a form assembling by a real motion, light, a reveal of the mark.
Beats: hook → build → reveal → hold → loop. Text: little or none. Principles that bite: P7 (assembly must be motion, not popping), P15, P10.

**Recreation of a known scene.** A moment people already remember — a film or game scene, a historic event, a keynote reveal,
a famous experiment — rebuilt in 3D, often without its people. Beats follow the source's own order of events (research it: watch the
source, `scripts/video_refs.sh`), each step a beat; the hook is the thing people recognise first. Match the look people remember (P21):
colours, light, the UI or effect style, the objects' shapes. Quote at most a few short lines, from a transcript or quote page, with the
source. **Without people**, their actions are carried by the objects themselves — a copy lifts, a structure opens, a thing is squeezed
from two sides — and a caption names the action; no ghost hands or silhouettes unless asked. Every formation needs a visible cause
(techniques §18). If the source's ending does not loop, reinterpret it so it does (the result returns to where it came from, leaves view,
goes inside something solid) and say so in the header comment and under **한계**. Principles that bite: P21, P7 (c), P4 (show what the
source shows; label what you had to invent), P24, P26. Frames of the source are references only: never embed its images, logos or
sound (research.md §3).

**Data or number story.** A number made physical (how big is a trillion, how much plastic, how far is…). Beats: the familiar unit → stacking,
filling or travelling to show the quantity → the comparison that lands → back. Principles that bite: P20, P22, P23 (show the count, don't just
state it). Research: the number's source and definition.

## 3. What stays the same in every format

The engine (text design, pace classes, loop), the requester's universal principles (principles.md — those not tagged for one format),
the research duty, and QA. Aspect, loop length and caption languages come from the kickoff question (a logo sting can be shorter than
the kickoff length; change the frame's `data-length` and say so in the report). Compose for the aspect (layout.md).
