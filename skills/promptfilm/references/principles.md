# Principles — what the requester actually rejected, turned into topic-independent rules

These principles come from two films (Blackwell, 11 versions; Cosmic, 16 versions) and the problems the requester
**pointed out and rejected** along the way. "Said:" is the requester's remark (translated, condensed). The principle
generalises *why* the remark was made. There are no topic-specific answers here: for a new topic, work out what each
principle means for that topic and format (plan.md, Q8).

The requester's taste lives in the taste profile (`taste.md`, or the user's own copy — SKILL.md). These principles are that taste turned
into method. When the active profile says otherwise (e.g. it allows cuts, or wants a different pace), the profile wins: follow it, record
the overridden check in `<film>/qa/accepted.json` with the profile's words (qa.md §3), and say so in the report. Format values (aspect, loop length, caption languages) come from
the kickoff question.

Both source films were journeys through scale. Principles marked **[journey]** apply to films that travel through levels of scale or
depth (formats.md); for other formats, apply their intent where it fits (e.g. P17's "don't over-zoom" still holds for a product close-up).
Everything unmarked applies to every format.

Contents: A Story and facts (P1–P6) · B Appearance and change (P7, P16, P24, P25) · C Looking right (P5, P9, P10, P14,
P15, P21, P29, P30) · D Camera and pace (P8, P17, P18, P26, P27) · E Getting it across (P11, P12, P19, P20, P22, P23, P28) · F Working (P13)

---

## A. Story and facts

**P1. Start where the subject really lives, then go in (or out) one step at a time.**
Said: "Shouldn't it start by pulling it out of the server room?"
→ Viewers must first know what this is and where it is before they can follow the next step. The opening is something they already recognise.

**P2. Supplied material is for checking facts; the story is filled in by research.**
Said: "Don't only build what's in the attached document. Use your own knowledge to put in every stage — good enough to teach at university."
→ Research missing stages, parts and mechanisms on the web (research.md). What public sources cannot confirm is drawn as "illustrative" and labelled so on screen.

**P3. Every step has its own density of things to see; no step is skipped.** (every format: no thin, empty shots)
Said: "There should be complexes inside complexes — right now it's not 10% of that." "It gets to the end far too easily."
→ If a viewer would ask "what's between those two?", a scene is missing.

Said (about two later films — a chat message across the Pacific, a statue down to the Planck length): "It should zoom in and tell each
one properly, one at a time — far too much is skipped now."
→ Showing a step means **stopping on it**: the camera arrives, the thing fills the frame (P17), the camera holds while its caption is
read and labels name its parts — then it moves on (techniques §21). A caption over a fast move, over a map where the places it names never
appear, or over empty space names something the viewer only glimpses: that step is skipped, however many captions the film has. Fit the
story to the length with fewer steps (P11), never by flying past them. (QA `read`: each caption up for its reading time with the camera
held ≥ 1.8 s, 2.4 s in key beats; `pace`: held for at least half the loop.)

**P4. Build the real thing.** Name, generation, dimensions, proportions, colours, materials, part positions, counts and how it works are all part of the subject.
Said: "It looks like a product from ten years ago." "You know it has to be that exact model, right?" "Are the fans really placed like that?"
"Those curved gold lines aren't like the real thing." "The copper plate looks like it's from another dimension."
→ If you don't know, research — never invent. Compare with reference photos. Don't build shapes that don't exist (floating plates, meaningless curves).
If the requester has a misconception, correct it in plain words.

**P6. Fill the surroundings as fully as the real place.**
Said: "There are no cables around it; it doesn't look real."
→ Put in the real components of the environment the subject sits in.

---

## B. Appearance and change

**P7. Everything that becomes visible or changes must answer "why does it appear now?"** One of three answers:
- (a) the camera moved closer, turned, or cleared something that hid it — the thing was there from the start;
- (b) it is a real physical motion (rotation, flow, switching on, movement, disassembly/assembly);
- (c) the story itself is a process of formation, shown in its real order and way, and explained by a caption.

Said (the most repeated complaint): "New things suddenly burst out." "It's generated as if it unfolds."
"Before zooming in it should already be visible, just very small, and then look natural as you zoom — shouldn't it?"
→ If none of the three applies, change the design. Common violations: objects popping out on a timer, rising from the floor, layers peeling off or
holes opening, halves being cut away, appearing as an expanding sphere, a distant model swapped for a close model with a different shape or colour.
Changes in the way of seeing (tint, filters) are a function of **camera state (distance, position)**, not of time.

**P16. Never introduce something with a lighting or brightness effect.**
Said: "When a planet was first zoomed in, why was it dark and then appeared? That's really unnatural."
→ A subject receives the light it always receives from the first frame it is seen. No "slowly lighting up out of darkness" entrances.

**P24. One continuous camera in every film. No cuts, no sudden swings, no inserted images.**
Said: "At Andromeda the view suddenly swings round — isn't that unnatural?" "An image suddenly appears? Suddenly? Why? Why put that in?"
(a flat photo insert) — and, about a product ad with cuts between shots: "The view, the camera position suddenly changes as if cut in an
edit — you know that's not allowed, right?"
→ This holds for **every format**, ads and demos included: the camera never jumps. Move between framings with continuous camera moves — an
orbit, a crane up or down, a push-in, a pull-back, travelling past or behind something (techniques §13). Spread changes of direction over the
whole of a long move (≤ ~15°/s recommended; 90°/s fails QA). Never paste a flat photo or an unrelated scene into the film: whatever should be
seen exists in the 3D space (a screen or a panel that is *part of* the scene is fine). QA `continuity` fails on any jump.

**P25. Nothing appears or disappears at the edge of the frame.**
Said: "When Arcturus comes, and the one after, it suddenly pops in at the right edge." "At the end, zooming back to Earth, something suddenly gets generated…"
→ If a subject must be hidden before its turn, fade it in or out **only while it is outside the view** (`subject(..., { fade })` and
`__bw.presenceCheck()` = 0). In perspective, big objects look wider than you expect — leave margin.

---

## C. Looking right

**P5. The same thing is truly the same — including the one the camera picks.**
Said (three times, at different stages): "Only the zoomed-in one looks different from its neighbours."
→ Generate repeated elements **from one definition**. The hero uses the same material, lighting response, effects and motion. Any extra detail
only the hero has must be too small to see until the camera is close.

**P9. No unexplained empty area at the centre of the frame.**
Said: "There's a grey empty space alone in the middle." "It's looking at empty space?" (the camera aimed at nothing as a new subject arrived)
→ Don't hollow out the centre to show the inside; use natural gaps, edges, cross-sections. At every distance there is a pattern that suits that
distance. While travelling to the next subject, the camera is always looking at something. Where the real thing is empty (the water above
the sea floor, the inside of an atom, orders of magnitude nothing is known about), keep the thing you are leaving or the thing ahead in
the frame — never a flat colour, a fog or a lone dot (QA `empty`: 0.5 s with almost nothing to see fails).

**P10. Nothing flickers or doubles.**
Said: "The floor flickers like crazy and looks doubled." "Three elements overlap and look weird." "Black blocks keep flickering on screen."
→ Usual causes: the same pattern drawn twice (texture and 3D), near-coplanar faces (z-fighting), sub-pixel lines (moiré), per-frame noise,
parts intersecting, hard procedural edges (they crawl when they move — widen the edge to at least a pixel with `fwidth`), NaN in a shader
(black blocks — bugs.md).

**P14. The same subject looks the same at every distance.**
Said: "Why does the light only shine properly when you zoom in? That's not natural. Zoomed far out it should look exactly the same as zoomed in."
→ Sheen, glow, atmospheric rim and exposure must not depend on how far you are zoomed. Draw glows in proportion to the subject (never a fixed
screen size), and set exposure **only from what is actually on screen** (`screenCover`).

**P15. Grandeur comes from contrast between darkness and light, and from the subject's sheer size.**
Said: "Like real space… empty, but the planets insanely majestic, so vast you can't take them in… beautiful, bringing tears, and frightening at
the same time… overwhelmed by the size and beauty."
→ Whatever the topic, the hero's **form is revealed by light**: one key light from the side, a soft terminator band, a thin rim of light at the
edge, restrained bloom, quiet dark surroundings. Give the hero moments alone and large in the frame (key beats). Don't light up or fill the
background so the contrast dies.

**P29. Model to the quality of the reference films — never a mock-up.**
Said (about a test ad whose speaker was a plain cylinder): "Is that shape right? It looks like graphics made by a primary-school kid. The
modelling quality is completely different from our Earth and Blackwell films."
→ Whatever the subject and whatever the purpose (even a test), every visible object is built at three levels: **form** (real proportions from
research, correct silhouette), **secondary detail** (bevels and fillets that catch light, chamfers, parting lines, seams, fasteners, labels),
and **surface** (micro-structure: weave, brushing, grain, print, wear — in textures or normal maps, fading with distance). Materials are
physically based and lit so they read (metal shows the studio's reflections, glass shows highlights, fabric is soft). Nothing that reads as a
primitive (a bare cylinder, a flat box) is ever shown at full size. The test: a full-size frame beside the reference films and beside real
photos of such an object — would it pass as a professional render?

**P21. Show things as people know them. No creepy procedural patterns.**
Said: "Shouldn't the Sun look the way we're used to?" "The Sun is just too plain — aren't there flares and sunspots?"
"No, the Sun is disgusting now — did you even look properly?" "Model the Sun properly, like a photo from an astronomical telescope."
→ Build famous subjects from **real photographs / observations (research/refs)** and match the impression. Drop at once any pattern that reads
as worms, eyes, veins or skin. If you depict a particular way of observing (e.g. a specific filter), say so in the caption. Too plain also fails
— the features people remember (pattern, texture, motion) must be there.

**P30. Nothing looks broken.**
Said (about the chat-message film, which had passed every check of the time): "There are far, far too many parts that look broken and
weird — it needs a full audit."
→ What looked broken there: a cut-away section seen edge-on (horizontal bands, a slab floating over the map); a model part standing alone
(a wall panel on a roof, buildings with black holes for roofs); the camera passing through a building or a window frame; imagery seen
closer than its resolution and smeared, or hidden under blur (depth of field, motion blur) instead of framed right; a zoom so fast the frame
smears; fog or a flat colour between two scenes; a caption over something other than what it names. Step through the whole film at 0.5 s
(the contact sheets) and at full size wherever a sheet leaves a doubt; **any frame you would not post as a still is a finding** — fix it or
change the shot. Look for what is wrong, not for confirmation (qa.md §4) — and then have someone who did not build the film look
(references/visual-review.md): nothing is delivered before that review passes (the gate). QA `surfaces` finds the camera inside models
and missing faces; `empty` the fog and flat colour; `pace` the smears.

---

## D. Camera and pace

**P8. The sense of speed doesn't lurch.**
Said: "From the middle, the zoom suddenly gets so, so slow."
→ Beats of the same kind feel equally fast. The engine eases speed changes between beats (~0.3 s each side). A zoom rate that changes by more
than 2.5 e-folds/s and by more than half within 0.1 s reads as a jolt (qa pace); ease into fast stretches with a short normal beat.
Nothing but the way back zooms faster than 3 e-folds/s or turns faster than 45°/s: the requester's own fastest edit ran 2.4 e-folds/s,
and faster the frame smears outward from its centre and the step in between is gone (P3).

**P17. Gentle, moderate zooms. Don't dive into surfaces.** (every format; the ratios below are for [journey] reveals)
Said (several times): "Each planet gets zoomed in way too close… so excessive it's overwhelming and dizzying… it gives me a headache."
"It still zooms in too much every time it goes to another planet."
→ On first showing a subject, it fills about half the frame width. One move in is at most ~2.2× the previous view; a pull-back to a comparison at
most ~3.5×. (Stories that go deep — into a chip, into a cell — are not an exception but **one long continuous zoom**, and then the key is a steady rate.)

**P18. [journey] Move in one direction; never go back. Familiar things first.**
Said: "Once you've shown up to Jupiter, drop every exoplanet smaller than Jupiter." "Don't keep generating on the right and then go left."
→ Size (or depth) order is monotonic; screen travel is in one direction; drop steps that return to a size range already shown.

**P26. The loop closes gracefully.** ([journey]: the way back is part of the film)
Said: "Don't end at the observable universe — zoom back super fast so Earth is visible again, to the opening angle."
"Coming back to Earth is too fast… shouldn't it zoom properly and naturally, so it shows how small we are?"
→ Every film loops (it is a Short): the camera flows continuously back into the opening pose (last key = first key — e.g. one full orbit
per loop), and every animated value (parts, lights, colours) is back at its first-frame value — otherwise the seam jumps. **[journey]**: the way
back retraces the journey; nothing pops in on the way back (P25). The way back is no new information: ≤ 12% of the loop (QA pace). It may
move faster than the 3 e-folds/s of P8, but steadily.

**P27. Important scenes play slower; stretches people would swipe away from play fast.** (How the requester edits — pacing.md)
Said: "The really important parts I sped up [less]; the slightly boring parts where people might leave, I sped up all the way."
→ Mark beats by kind and the engine plays them at that speed (the taste profile's §3; default key ×2, normal ×3.5, long empty move ×8,
return ×3) — within the limits of P3 and P8. The HTML must need no speed-editing after recording.

---

## E. Getting it across

**P11. Length is the kickoff length: one loop** (default 45–60 s — the requester's two posted edits ran 48.6 s and 60.4 s; a logo sting may be 10–20 s).
→ Budget the time before the scene list is final (pacing.md §2): every stop at its caption's reading time, moves under 3 e-folds/s, the
way back ≤ 12% — for 45–60 s that is about 8–11 stops. What doesn't fit is merged into a neighbouring stop (as labels on its parts) or cut:
near-duplicate steps first (P19), then detours (rising to orbit and diving again) — never flown past (P3). A short target (15–20 s,
25–35 s) means fewer scenes, not faster ones.

**P12. Text in the kickoff languages — by default two.**
Said: "Under every piece of explanatory text, Korean too, in parentheses."
→ Caption = title + line in the first language + (second language, plain words). Labels pinned in 3D, leader labels and comparison ratios:
first language + (second). Default English + (Korean); with one language, the parenthesised line is left out (pass '').
Each caption is on screen for its reading time (pacing.md §2), over a stop that holds on what it names (P3); never overlapping each other or captions.

**P19. A run of similar steps or shots is boring. Keep the famous, clearly different ones.**
Said: "Before Sirius there are far too many stars of about the same size — so boring… keep just a few famous ones."
→ Each step must be visibly different (≈1.5–2× in size or more, or a new kind of thing). Choose names people have heard of first.

**P20. Make size and quantity felt — as a multiple of something familiar.** (whenever size or amount matters; central in [journey] films)
Said: "You can't tell how much bigger than Earth it is now, how unimaginably big." "Rather than 'this view = n km', show how many times Earth — as '×N'."
→ Show the view width or subject size as a multiple of a familiar reference (×N), with a human-scale comparison (e.g. "if Earth were a 1 mm grain
of sand, this view would be…"). Choose references that fit the topic (a person's height, a hair's width, a football pitch, Seoul–Busan…).

**P22. Make relations between facts visible.**
Said: "Shouldn't the bigger stars after the Sun be brighter? Shouldn't the light pouring out be huge too?"
→ When size, brightness, temperature or speed are related, compute from the fact table and show it (e.g. luminosity ∝ R²T⁴ → glow width). Don't exaggerate.

**P23. If the message is "uncountably many", actually show that many.**
Said: "We need to really show there are hundreds of millions, trillions of galaxies like ours… so you go 'wow, humans are so small.'"
→ Don't only state the number: fill the view (instancing, hundreds of thousands of points). Numbers from the fact table.

**P28. Text inside the HTML follows the reference films' design. YouTube subtitles are a separate thing.**
Said: "Just make it properly like the HTML you made before. The description labels and everything inside the HTML must be the same. By
subtitles I meant YouTube subtitles."
→ Caption block, pinned labels, leader labels, comparison ratios, field-of-view ruler and scale panel use the engine's design as is (fonts,
colours, size ratios). Do not add branding such as a model-name banner.

---

## F. Working

**P13. When the requester says "it's not fixed", first check which version they saw.**
A cached old version was once seen. Check the published content directly and suggest a hard reload (Cmd+Shift+R). If the new version still has a
problem of the same kind, fix that too.

When the requester points out one problem, find **every other place of the same kind** in the next version (e.g. one star popped in at the edge
→ check the entry timing of every subject).
