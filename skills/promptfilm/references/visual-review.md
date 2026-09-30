# Visual review — fresh eyes on every frame, before anything is delivered

Two films passed every automated check of their time, and the sessions that built them looked at their own contact sheets and saw
nothing wrong. The requester saw, within seconds: "far too much is skipped" and "far, far too many parts look broken and weird". The
builder looks for confirmation of what they meant to make; this review looks for what the viewer will actually see. No final video is
made of a build without it (scripts/gate.mjs — render.mjs refuses; the Studio's export card says so).

## 1. Who reviews, with what

**Someone who did not build the film.** With the Agent tool, give the review to a fresh subagent (general-purpose): this file, the
review folder, and the film's `research/refs/` photos — **not** the code, plan.md or the build history, and not what you think is good about
the film. Invoking this skill is the requester's request for the whole process, this review included. Without subagents: do it yourself as
a separate pass — re-read this file first, look at the frames before reading anything else about the film, and write every row.

The material, for the build under review — `node <skill>/scripts/ship.mjs <film>` makes it after the full QA passes and prints the
brief below with the paths filled in (or by hand: `node <skill>/scripts/review.mjs <url> --out <film>/qa/review`).

`sheets/` (every 0.5 s, the time printed on each frame), `stops/` (full size, the middle of every caption), `flagged/` (full size, every
moment the QA run flagged) and `template.md` — the form. The reviewer fills it in and saves it as `<film>/qa/visual-review.md`.

The reviewer's brief, as given to the subagent:

> You review a short 3D motion graphic before it is published. You did not make it. First read `<skill>/references/visual-review.md`
> (your instructions) and look at `<skill>/references/review-examples/` (`rejected_*` = what the requester rejected, `good_*` = what they
> praised). Then, **before anything else about the film**, open the bare frames (`<film>/qa/review/stops/*_bare.png`, text hidden) and fill
> in §1 of `<film>/qa/review/template.md` — what each frame shows. Only then read the captions and fill in §2 (with the `*_text.png`
> frames), then open every sheet (`sheets/`, §3 — copy each sheet's code from its first frame) and every flagged frame (`flagged/`, §4);
> use the reference photos in `<film>/research/refs/` where useful. Don't read the film's code, parts/, plan.md or storyboard. Save the
> form as `<film>/qa/visual-review.md`. Look for what is wrong, not for what is right: a frame you would not post as a still is a
> finding. Write every row; do not soften, do not explain what the maker probably intended. Keep notes as you go. Return the Findings list.

## 2. Every caption — is it a stop?

First §1 of the form: for each bare frame (`stops/…_bare.png`, text hidden), write what it shows, in plain words — before you have read
any caption or seen a sheet. Then §2: read each caption, what the maker declared it to be about ("tells about") and what QA measured —
neither replaces your look — and open the frame with its text (legibility). Last column: "yes" only when the thing named is there,
clearly, large and held; otherwise "no — why". Then:
the thing the caption names — is it in the frame, recognisable, and large (about 40% of the frame or more)? Is it what the eye goes
to? Look at the sheets around its time: does the camera hold on it, or pass it? A caption over a move, over a map where the named places
never appear, over fog or empty space, or naming three places while one is seen — **the step is skipped: a finding**. A caption whose
subject is emptiness or the unknown ("almost nothing", "no size found", "where no experiment reaches") is not exempt: the picture must
still show something that makes the emptiness legible (what is being left, what lies ahead, a scale) — a lone dot or a flat field fails.
A caption that states a reason or a mechanism ("why it is green", "the light is amplified") must show it happening, not only say it.

## 3. Every frame — the kinds of failure

Walk every sheet frame by frame. Each of these is a finding, wherever it lasts more than a glance:

- **Broken-looking geometry** — a section or cut-away seen edge-on (horizontal bands, a slab floating over a map); a part standing alone
  (a wall panel on a roof, a sign in mid-air); holes where a roof, a wall or the back of a part should be; the camera inside or passing
  through a building, a wall, a window frame, a desk; parts intersecting; a model of the wrong shape or scale for what it is.
- **Skipped** — see §2; also a step the story needs that the film jumps over (the viewer would ask "what was that?").
- **Empty** — a flat colour, fog, a lone dot, a water column with nothing in it, for more than half a second.
- **Smeared or soft** — the picture streaked outward from its centre; imagery or textures seen closer than their resolution (mush,
  large pixels); blur used to hide something.
- **Mock-up or wrong** — bare primitives, boxes for buildings, plastic-looking materials, toy props; an object that isn't what it claims
  (compare with `research/refs/`); famous things not looking as people know them.
- **Appearing without a reason** — something popping, growing, fading in or lighting up in view; a jump in the camera.
- **Text** — captions unreadable against the picture, labels pointing at nothing, text over the subject.

The `rejected_*` examples: `section-edge-on-bands`, `section-slab-over-blurred-map`, `room-without-walls`, `floating-panel-caption-elsewhere`,
`zoom-smear`, `empty-water-column`, `flat-colour-between-levels`, `lone-dot-for-5s`, `caption-names-places-not-shown`. The `good_*` ones: one
thing large with its parts named; the part the camera goes into next outlined before it goes; the stop with labels on its parts.

## 4. Writing it down

- §1: one row per bare frame — what it shows, written before anything else. §2: one row per caption — "yes" / "no — why". "Large"
  = its longer side about 40% of the frame or more; a thin thing (a fibre, a cable, a phone) is large when it runs across the frame or is
  shown cut open with something for scale.
- §3: one row per sheet — the 4-character code printed on its first frame, and "nothing" or every problem as "time — what", separated by
  " · ". (The gate
  checks every code: a sheet not opened is a review not done.)
- §4: what each QA-flagged frame is (a real problem, or why not — with the reason visible in the frame).
- §5: one line per kind of failure listed in §3 of this file.
- Findings: `- time — what — kind`, kind one of broken · skipped · empty · smeared · mock-up · wrong · appearing · text.
- **Findings**: one line each — `- 24.0 s — the section seen edge-on reads as horizontal bands — broken`. "- none" only if there are none.
- **Verdict: PASS** only when every caption is "yes", every sheet "nothing" and Findings is exactly "- none"; otherwise **Verdict: FAIL**.
  The gate reads all of it: a PASS over a "no", a problem, a finding or a wrong code is not a pass; a FAIL stays on record for that build
  (`qa/reviews/`), so the build must change before it can pass.

## 5. After the review

Every finding is fixed, and its kind is searched for across the whole film (P13). Then: rebuild → the full `qa.mjs` → `review.mjs` → a
new review by fresh eyes again (the old review is for the old build; the gate knows). Nothing is delivered — no final MP4, no "done" in the
report — until `node <skill>/scripts/gate.mjs <film>/<name>.html` says READY. The report names the build and its gate status.
