# Two cases: how principles became decisions

Both reference films are **journeys through scale** (formats.md); other formats have no requester history yet — derive them from the
principles and formats.md, and treat the requester's first reactions to them as new rules. These tables are **not lists to copy**. The same principle becomes a completely different decision on another topic. What they show is the
way of thinking: principle → the problem it caused on this topic → the decision. The code is in `examples/`; its content (products, planets,
numbers) belongs to those films only.

## Case 1 — "Blackwell: from silicon to scale" (data hall → one silicon atom and back; 1:1, 154 s; 11 versions)

| Principle | What actually went wrong | Decision |
|---|---|---|
| P1 context | started on a close-up of the card | data hall → rack → server → pulling the card out |
| P2, P3 density | jumped from the core straight to atoms | added processing block → memory cells → core floorplan → multiplier array → cell → transistor → atoms, each level with its repeat count |
| P4 facts | old-looking card, wrong fan position, gold curves and a copper plate that don't exist | reference photos, whitepaper numbers computed in one object (`ARCH`, `DERIVED`, asserted totals), removed invented shapes |
| P5 sameness | the zoomed-in server / SM / cell looked different from its neighbours | one definition for all; the precise model shares material, emission and effects |
| P7 appearance | pits opened, cells rose, halves were cut away, atoms spread out | every structure placed from the start; texture → 3D by distance (techniques §5); the microscope look is a function of magnification |
| P8 pace | the middle ran 4× slower | measured, then a smooth speed warp and merged captions |
| P9 centre | the cross-section hole sat in the middle of the array | the cross-section taken at the array's edge beside a wiring channel |
| P10 flicker | doubled floor pattern, sliver z-fighting, per-frame noise | base colour under 3D, slivers removed, fixed noise |
| P13 version | the requester saw a cached old version | checked the published file, explained the hard reload |
| P27 pace (after posting) | the requester re-edited at ×2 / ×4 / ×8 by content | beats with speed classes in the engine |

## Case 2 — "Cosmic size ladder" (Earth → observable universe → home; 1:1, 177 s; 16 versions)

| Principle | What actually went wrong | Decision |
|---|---|---|
| P11, P27 pace | "far too slow" (×3 in the HTML), then ×3 again in CapCut | Shorts pace: one loop 45–60 s |
| P14 same at every distance | planets only shone properly when zoomed in | glow in proportion to the body; exposure from on-screen content only |
| P15 grandeur | "not majestic, not overwhelming" | dark sky, one strong key light, soft reddening terminator, limb haze, restrained bloom, the planet alone and large |
| P16 no lighting entrances | planets appeared dark, then lit | always lit; hidden only while off-screen |
| P17 gentle zooms | "too close, dizzying, headache" (three rounds) | first look: body ≈ half the frame; ≤ 2.2× in, ≤ 3.5× out per move |
| P18 one direction | smaller exoplanets after Jupiter; bodies generated on the right then the camera went left | only bodies larger than the previous; a row that grows to the right only |
| P19 similar steps | many stars of about the same size | kept the famous ones with clear jumps |
| P20 feel the scale | "can't tell how much bigger than Earth" | panel: ×N Earth's diameter + "if Earth were a 1 mm grain of sand…" with familiar lengths + galaxy count at the largest scales |
| P21 familiar look | the Sun: plain → "lava streams" → "creepy" (worm-like prominences, eye-like spots) | modelled on real telescope imagery (hydrogen-alpha look), labelled as such in the caption |
| P22 relations | bigger stars weren't brighter | glow width from luminosity L ∝ R²T⁴ |
| P23 countless | "show there are trillions of galaxies" | 450,000 galaxy specks sampled along the cosmic web, count in the panel |
| P24 no inserts / sudden turns | a flat deep-field image appeared; the view swung round at Andromeda | image removed; a side-by-side pull-back instead of the swing |
| P25 no edge pop | stars popped in at the right edge; things popped in on the way home | fades only while off-screen; the Sun kept until it left the view |
| P26 the way back | the return was too fast and full of pop-ins | a retraced return at a steady rate, only Earth waiting; last key = first key |
| P10 black blocks | flickering black blocks from 1,500 ly on | NaN from zero normals / `pow` of a negative, spread by bloom → fixed at the source + NaN clean-up before bloom; found only by live-playback capture |

## Case 3 — the engine's product test film (a fictional speaker; rejected, then rebuilt)

| Principle | What actually went wrong | Decision |
|---|---|---|
| P24 no cuts | cuts between shots ("the camera suddenly changes as if cut in an edit — not allowed") | no cut in any format; one continuous camera (an orbit per loop with crane, push and pull); the engine lost `cut()`; QA `continuity` |
| P29 quality bar | "a primary-school graphic" — a plain cylinder, flat materials | real proportions with fillets and chamfers, knit / brushing / print micro-structure, studio softbox reflections, unlit floor with contact shadow, depth of field, detailed insides |

## What carries over to any topic

- The requester reacts most strongly to **things appearing without a reason**, **over-zooming**, **looking fake or creepy**, and **boring
  repetition**. Check these first.
- The requester loves **overwhelming scale made tangible**: grandeur, a precise and real-looking subject, numbers made physical (×N, grain of sand).
- Every correction was about the whole class of problem, not one instance — look for siblings.
