# Taste profile — who the films are for, and what they must never do

This is the **default** profile: the taste of the person the skill was built with (a Korean creator making YouTube Shorts for a general
audience; the two reference films in `examples/` are theirs). Everything here is a preference, not a law of the engine. To make films for a
different taste, copy this file and edit it:

- `./.promptfilm/taste.md` in the working folder — for one project or channel (wins over the others)
- `~/.promptfilm/taste.md` — for every project of this user
- this file — when neither exists

Read the active profile in full at step 1. Where it disagrees with `references/principles.md`, the profile wins: follow it, and record
each check it overrides in `<film>/qa/accepted.json` with the profile's words (qa.md §3) — QA and the gate then report it instead of
failing it — and say so under **한계 / Limits** in the report.

## 1. The person

- Makes Shorts for a general audience. Cares, in this order: nothing appearing without a reason; the subject looking real, precise and
  majestic; each step shown up close and explained, one at a time — never flown past; nothing looking broken; gentle, never dizzying,
  camera moves; no boring stretches; captions that look like the reference films.
- Gives **nothing but the request** — no files, photos or specs — and expects the skill to find everything itself (research.md §0).
- Reviews closely and names exact problems.
- **Talk to them in their language** — the language of the request (Korean for the person this profile was made with), plainly. Report
  with exactly these bold labels — in Korean: **한줄 결론:** / **바뀐 점** / **검사 결과** / **한계** / **파일**; in English:
  **Bottom line:** / **What changed** / **Checks** / **Limits** / **Files**; in another language, the same five, translated.

## 2. Format defaults

These become the first (recommended) option of each question in the kickoff question (SKILL.md step 2). The answers the person gives are
remembered in `./.promptfilm/settings.json` and become the recommended options next time.

| Setting | Default | Options offered |
|---|---|---|
| Aspect | `9x16` — YouTube Shorts / Reels / TikTok | `9x16`, `16x9` (YouTube, a presentation), `1x1` (feed), `4x5` (Instagram feed) |
| Length of one loop | `45-60` s — the person's two posted edits ran 48.6 s and 60.4 s | `15-20`, `25-35`, `45-60`, `60-90` |
| Caption languages | English + the requester's language: `en ko` for a Korean request — English title and line, then Korean in parentheses; `en` alone for an English one | `en ko`, `ko`, `en`, or any one or two language codes (`ja`, `es en` …) |
| Storyboard review | yes — scene cards in the Studio before the build | no: build straight after planning (also when the request says "바로 만들어") |

Every film loops seamlessly (it is meant to replay on its own); the length is one loop.

## 3. Pace — how the person edits

They screen-recorded the films and sped them up in an editor: "the really important parts I sped up less; the slightly boring parts where
people might leave, I sped up all the way." The engine plays beats at those speeds (pacing.md):

| Beat | Speed |
|---|---|
| hook | ×2 |
| key | ×2 |
| normal | ×3.5 |
| transit | ×8 |
| return | ×3 |

The speeds come with limits — they rejected the opposite as "far too much is skipped": each caption up for its reading time with the
camera held on what it names (≥ 1.8 s, 2.4 s in key beats); moves under 3 e-folds/s (their own fastest edit: 2.4); the camera held for
at least half the loop; the way back ≤ 12% of it (pacing.md §2).

A different taste changes these with `FILM_SPEED` (engine.md) — e.g. a calmer channel: `{ normal: 2.5, transit: 5 }`. The requester's
own pace edits in the Studio (per beat, `parts/p8z_pace.js`) are the best evidence for this table: when the same change keeps coming back,
update it here.

## 4. Look

- Grandeur from contrast: quiet dark surroundings, one key light from the side, a soft terminator, a thin rim, restrained bloom (P15).
- Real, precise, professional renders — never a mock-up (P29).
- Text inside the film uses the engine's design as is (fonts, colours, size ratios); no branding banners (P28).

## 5. Never do these (each one was rejected at least once)

- Objects popping in, growing, unfolding, rising, being cut away, or fading in while in view — at any edge, on the way back too.
- Subjects that start dark and light up; glows or exposure that change with zoom; exposure driven by something off-screen.
- Cuts or any camera jump, in every format; over-zooming into every subject; sudden camera swings; pasted-in flat images.
- Mock-up modelling: bare primitives, missing bevels and seams, flat materials — anything below the reference films' quality, even in a test.
- Fake or outdated-looking objects, invented parts, the wrong model; creepy procedural textures (worms, eyes, veins); famous things not
  looking as people know them.
- Runs of near-identical steps or shots; an empty centre of frame; flicker, double patterns, black blocks; (journeys) going back in size or
  direction.
- Skipping: a step flown past in a smear, a caption naming something that isn't clearly on screen or gone before it can be read, fog,
  a flat colour or a lone dot between two scenes, a way back that takes a fifth of the film.
- Anything that looks broken: a section seen edge-on as bands or a floating slab, a panel standing alone, buildings with holes for roofs,
  the camera passing through a building or a window frame, imagery seen too close, or blurred to hide it.
- Changing the text design of the reference films, or adding branding banners.
- Asking the person to supply things the skill can find itself.
