# The frame — composition and text placement, per aspect

The aspect comes from the kickoff question (`data-aspect` on the frame: `9x16`, `16x9`, `1x1`, `4x5`). Sections 1–4 are the 9:16 frame
(YouTube Shorts / Reels / TikTok, 1080 × 1920 when recorded) — the default and the one the rules were learnt on. Section 5 is what changes
for the other frames. Both reference films are 1:1; their text design is kept exactly (P28), but its placement and the camera's
composition change with the frame and with what the platform's player covers.

## 1. What the Shorts player covers (9:16)

The player draws its own UI over the video. Keep text and the essential part of the subject out of:

| Zone | Area (fraction of the frame) | What is there |
|---|---|---|
| top bar | top 7% | search / menu icons |
| bottom | bottom 20% | title, channel name, description, progress bar |
| right buttons | right 15%, from 45% to 80% of the height | like, comment, share, remix |

`?safe` draws these zones on the page; `qa safe` measures text boxes against them (0 allowed). The zones for every aspect are
`SAFE_ZONES` in the core (p2); the engine keeps pinned labels' boxes out of them.

## 2. Where the text layers sit (engine CSS; don't move them without a reason)

- **Caption block**: left 7%, right 15%, bottom edge at 21% from the bottom — above the player's bottom zone. Title 3.6cqmin, first-language
  line 1.95cqmin, second-language line 1.85cqmin (cqmin = 1% of the frame's short side — the width here; the same ratios as the reference
  films, so text looks the same size on a phone, and the same pixel size in a 1920 × 1080 recording).
- **Field-of-view ruler**: top right, from 11% down to 38% of the height, below the top bar and above the buttons.
- **Scale panel** (optional): top left from 8.5% of the height.
- **Pinned labels, leader labels, comparison ratios**: placed by the engine within 7%–78% of the height, avoiding the button zone,
  the caption, the ruler and the scale panel (and each other).

## 3. Composing for a tall frame

- The field of view across the short side is 38° by default (`HFOV`); here that is the horizontal one, and the vertical one follows
  (≈ 64°). The "field" in every key is the view's extent across the **short side** at the target — the width here. A subject that should
  fill half the frame's width is about `field = 2 × diameter`.
- **Three bands, top to bottom** (the requester asked why the caption sat cramped under the product; this is the answer):
  subject **~8–60%** of the height · caption band **~62–79%** (calm: floor, background, soft scrim) · the player's zone **80–100%**
  (picture continues there, no text). The caption doesn't move — the composition makes room for it.
- **Hero shots**: the subject's centre at about 35–42% of the height, about half the width across, its lowest point above ~60%. Use
  `key(..., { at: 0.37 })` to put the key's point at that height. The space above is not wasted: it is where the scale reads (sky, context, ruler).
- **Tall arrangements** (an exploded view, a stack): fit them between ~5% and ~62% (a wider field and `at` ≈ 0.33); compress the spacing if needed.
- **Close-ups** that fill the frame are the exception: the caption reads over the subject through its scrim.
- **Comparisons side by side** use the narrow dimension, so objects get small. Prefer: a bottom line at ~60% of the height with the larger
  object rising above it; or a vertical stack; or a row receding in depth (camera pitched down); or a diagonal. Choose what shows the
  sizes most clearly for the topic.
- **Going in or out along one axis** (zooms into a chip, a cell, a city) suits the tall frame well: keep the zoom target at 40–45% height.
- Keep the region just above the caption (≈ 55–65% height) calm enough for the caption scrim to read over it.
- Don't put the one thing the viewer must see in the bottom 20% or behind the buttons.

## 4. Size and resolution

- The frame is `min(100vw, 100vh × aspect)` wide; the renderer caps the long side at 1920 device pixels
  (`pixelRatio = min(dpr, 2, 1920 / max(W, H))`).
- QA opens the film at its own aspect (common.mjs `SIZES`: 540 × 960, 960 × 540, 720 × 720, 640 × 800 CSS px; fps at DPR 2). A recorder
  opens 1080 × 1920 (or 1920 × 1080 …) at DPR 1 and calls `__bw.seek(t)` + a screenshot per frame.
- `?text=0` hides every text layer (for a clean plate, and for QA of the picture alone). The H key toggles text.

## 5. The other frames

The engine places the text layers for each aspect (p1_head CSS) and keeps labels out of that platform's zones (`SAFE_ZONES`). Text keeps
its size in cqmin, so it has the same pixel size as in a 9:16 recording of the same resolution. What changes is composition:

| Aspect | Player covers (SAFE_ZONES) | Caption block | Ruler / scale panel |
|---|---|---|---|
| 16x9 (YouTube, a presentation; 1920 × 1080) | top 8% (title bar on pause), bottom 12% (controls, progress bar) | left 5%, right 45%, bottom 13% — the lower left | ruler top right 12–54%; scale panel top left from 10% |
| 1x1 (feed; 1080 × 1080) | top 4%, bottom 8% (small icons) | left 6%, right 22%, bottom 10% | ruler top right 8–42%; scale panel from 6% |
| 4x5 (Instagram feed; 1080 × 1350) | top 4%, bottom 8% | left 6%, right 18%, bottom 11% | ruler top right 8–38%; scale panel from 6% |

- `field` is the extent across the short side — the **height** in 16:9. A subject with `field = 2 × diameter` fills half the height and
  about a quarter of the width, so the same keys give the same apparent size relative to the short side. A film is composed for its own
  aspect: a tall arrangement (an exploded view, a stack) that fits 9:16 runs off a 16:9 frame (QA `labels` reports the labels it lost).
- **16:9**: the room is beside the subject, not above it. Put the hero left or right of centre (about a third across) and let the caption
  sit below the other side, or keep the hero centred and slightly high (`at` ≈ 0.42). Comparisons side by side work well here (the long
  side is horizontal); stacks and exploded views go sideways or recede in depth. The camera can travel sideways more than it cranes.
- **1:1 and 4:5**: close to the reference films' own frame. The hero centred at about 40–45% height; the caption band is the bottom quarter.
- Everything in sections 3's list that is not about the tall frame still holds: calm region above the caption, nothing essential in the
  player's zones, zooms along one axis with the target near the centre.
