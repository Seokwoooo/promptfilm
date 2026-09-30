# Research — gather facts from the web; ask once, at kickoff, when it will take long

A film convinces through facts (P2, P4). A request like "a Blackwell graphics card from the whole card down to single atoms" can only be built
properly by researching every public detail of its insides (board layout, package, die structure, block counts, process dimensions…). Built from
general knowledge, it earns remarks like "it looks like a product from ten years ago" and "you know it has to be that exact model, right?".

## 0. The requester brings nothing

The requester gave nothing for either reference film — no photos, no specs, no files — and expects the same every time. Don't ask for
materials (photos, logos, models, spec sheets, brand colours, copy). Find them yourself: the web, the working folder (READMEs, asset folders,
earlier outputs), the requester's own website or store page, the conversation so far. If they do supply something, use it.
Only when the subject itself cannot be identified anywhere (e.g. "an ad for our product" with no name, link or clue in the folder or
conversation) ask **one** short question: what is it (a name or a link)? Everything else — features, look, story, wording — you decide.

## 1. Size the research first

As soon as you have read the request, before any code, list what you need to know to draw each rung of the scene ladder. Then classify:

| Scale | Example | Estimated time | In the kickoff question |
|---|---|---|---|
| Light | a handful of well-known numbers (planet radii, building heights), textbook-level structure | ~5 min | no research question — research and continue |
| Medium | 20–40 numbers, 5–15 sources, a few reference photos | 10–20 min | **ask** |
| Deep | the insides of a specific product / organism / system across several levels (whitepapers, datasheets, teardown photos, die shots, papers), 15+ sources | 20–60 min | **ask** |

## 2. The kickoff question — research, aspect, length, languages in one go

Ask **once**, with **one** AskUserQuestion call holding up to four questions, in the requester's language. Each question's first option
is the recommended one: last time's answer from `./.promptfilm/settings.json` if it exists, else the taste profile's default (taste.md §2).
Leave out a question the request already answers (an aspect, a platform, a length, a language) or the format settles; when nothing is left
to ask, don't ask.

| # | header | Question | Options (recommended first) |
|---|---|---|---|
| 1 | 리서치 | only for medium or deep research — see below | deep research then build · quick essentials only · no research |
| 2 | 비율 | 화면 비율은? | 9:16 세로 — 쇼츠·릴스·틱톡 · 16:9 가로 — 유튜브·발표 · 1:1 정사각 — 피드 · 4:5 세로 — 인스타 피드 |
| 3 | 길이 | 한 바퀴(루프) 길이는? | 45–60초 · 25–35초 · 15–20초 · 60–90초 |
| 4 | 자막 | 자막 언어는? | 영어 + 한국어 (한국어는 괄호) · 한국어만 · 영어만 — others through "Other" (e.g. 일본어 + 영어) |

In English (an English request — the default captions are then English only): Research · Aspect ("9:16 vertical — Shorts, Reels,
TikTok" · "16:9 landscape — YouTube, slides" · "1:1 square — feeds" · "4:5 vertical — Instagram feed") · Length ("45–60 s" · "25–35 s" ·
"15–20 s" · "60–90 s") · Captions ("English only" · "English + Korean" · others through "Other").

(Translate the wording for a requester who speaks another language; their language is the second caption language by default. Map
the answers to `--aspect 9x16|16x9|1x1|4x5`, `--length MIN-MAX`, `--langs "<first> [<second>]"` with ISO codes, e.g. "ko", "en ko",
"ja en".)

Save the answers to `./.promptfilm/settings.json` — `{ "aspect": "9x16", "length": "45-60", "langs": "en ko" }` — so they are next time's
recommended options, and write them into plan.md.

The research question states:
- what will be researched, one line per level (e.g. "board and cooler layout / GPU package and memory / die block structure and counts /
  transistor and process dimensions");
- the estimated time (a range), and what would be inaccurate without it;
- the options (recommended first):
  1. **Deep research, then build (Recommended)** — research every level's public sources, build a sourced fact table, then build straight away
  2. **Quick research of the essentials** — key numbers and photos only (~N min); the rest from general knowledge, marked "illustrative"
  3. **No research** — only the supplied material and general knowledge

When they answer, start **immediately**, and when the research is done go straight on to building without asking again. Decide new questions that come up during research yourself, unless only the requester can
decide them (e.g. which of several models they mean).

## 3. Tools

Use what the session has, in this order:
- **WebSearch + WebFetch** (built into Claude Code; if they are deferred tools, load them with ToolSearch first): search, then read the source page.
- **tavily-search / tavily-extract / tavily-research** skills, if installed: extracting many pages at once, or a sourced synthesis.
- **The requester's own things** (their product, company, app, game): the working folder first, then their site and store pages, press
  coverage, app-store screenshots, reviews.
- **The deep-research skill or research subagents**: only once the requester has agreed to deep research; split by level and run in parallel.
  Ask each for "source URL + value + unit + quoted sentence".
- **Videos** (a scene to recreate, an ad, a product demo, a process filmed in real life): `sh scripts/video_refs.sh <url|file>
  research/refs/video 2 [key seconds …]` downloads a small copy (no API keys; retries YouTube's 403 with other clients) and writes
  4 × 4 contact sheets (one frame per 2 s) plus full-size key frames (a POSIX shell script — on Windows, run it in Git Bash or WSL). Read every sheet first to get the order of events, then
  look at key frames where something important happens. Write the timeline (what happens at which second, and how it looks) into
  visual-notes.md. Spoken lines: quote pages, subtitles or a transcript; don't set up a transcription service for a few lines.
- **PDFs** (whitepapers, datasheets, papers): download and read only the pages you need (`curl -L -o research/src/x.pdf`, then Read with `pages`).
- **Photos**: download representative photos into `research/refs/` and **look at them yourself** (open the image with Read). Write what you saw in
  visual-notes.md. Never put the photos into the HTML (copyright; P24). They are evidence for shape, colour and layout only.

## 4. Source priority

1. Primary: manufacturer whitepapers, datasheets, official spec tables; agencies (NASA, ESA, NIH, standards bodies); peer-reviewed papers;
   official catalogues (VizieR, etc.)
2. Measured secondary: teardown and measurement articles by specialist outlets (e.g. TechPowerUp, der8auer die shots, iFixit), conference talks, textbooks
3. Encyclopaedias and wikis are **signposts** only — find and check the primary sources they cite

Starting points by field (examples only — find the right ones for the topic):
- Products and brands: the official product page and spec sheet, press kit images, launch keynote descriptions, teardown photos, reviews with measurements
- Hardware: architecture whitepapers, datasheets, process papers (IEDM / VLSI), teardown photos, die shots, patent drawings
- Astronomy: NASA / ESA fact sheets, NASA Exoplanet Archive, observation papers, catalogues (HYG, Gaia, 2MRS)
- Biology / medicine: textbooks (molecular cell biology), PDB structures, review papers, microscopy archives
- Earth / cities / architecture: government statistics, official specifications, survey data, satellite imagery descriptions

## 5. What to collect — the outputs

Keep everything in `<film>/research/`. The build takes numbers only from these files.

- **facts.md — the fact table.** One row per fact: `item | value | unit | source (title, page/section, URL) | confidence (primary / secondary / estimate)`.
  When sources disagree, record both, which one you use and why. Check sums (count × unit = total).
- **inventory.md — the level inventory.** For each rung of the scene ladder, every visible component: name (in the film's languages), size, count,
  arrangement (where and how it repeats), material and colour, motion (if any), source. "What will the camera see at this level?" — completely.
- **visual-notes.md — what the photos (and videos) showed.** File name; what is where, colours and textures; the features people remember; for a video, the order of events with timestamps.
- **gaps.md — what is not public.** What public sources cannot confirm, and how you will draw it instead (a generic structure, labelled "illustrative").
- **sources.md — the source list.** Number, title, publisher, date, URL, where it was used.

## 6. Rules while researching

- Every number has a unit and a source. A number from memory is an "estimate" until a search confirms it.
- Recency: use the latest official values for products and measurements (note the date). Check whether a newer generation exists.
- Product and model names exactly as requested. If data from a similar model is used, say so (P4).
- Logos and marks: use the real file if found; never approximate one from memory (it will look wrong).
- No unsupported performance or capacity claims on screen.
- Don't send the requester a long research report — put it into the film, and list what was drawn as illustrative (because it isn't public)
  under **Limits** in the final report.
