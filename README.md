# Promptfilm

**One sentence in, a researched 3D motion graphic out.** Promptfilm is a skill for [Claude Code](https://claude.com/claude-code) that turns
a request like *"zoom from a graphics card down to a single silicon atom"* into one self-contained HTML file that plays a real-time 3D
film (Three.js), loops seamlessly, and records straight into a video.

[한국어 README](README.ko.md)

![Frames from the Blackwell example film: a data hall, the card, one streaming multiprocessor, a six-transistor memory cell, the silicon crystal](docs/blackwell.jpg)

*Frames from `examples/blackwell-silicon-to-scale.v11.html`, one of the two reference films the skill was built around.*

<img src="docs/aura-ad.jpg" alt="Three 9:16 frames of a product film for a fictional speaker: the product, its glass top, an exploded view" width="480">

*A 9:16 product film from the engine's own test set (a fictional speaker).*

## What it does

- **Any subject, any format** — journeys through scale, product ads, game or app demos, how-it-works explainers, recreations of a known
  scene, logo stings, data stories. 9:16 for Shorts / Reels / TikTok by default, or 16:9, 1:1, 4:5.
- **Researched, not guessed** — it sizes the research, asks once whether to do it, then looks up facts, photos and footage on the web.
  Every number on screen comes from a sourced fact table; what isn't public is drawn as illustrative and said so.
- **Paced like an editor would** — each thing a caption names is a stop: the camera arrives, holds while the caption is read, and moves on
  gently. A time budget checks the plan before anything is built.
- **Captions in one or two languages** — English plus the requester's language by default (e.g. English with Korean in parentheses).
- **Checked before it's called done** — automated QA in headless Chrome (load, errors, pace, readability, empty frames, holes in models,
  flicker, the loop's seam …), a visual review by a fresh subagent that didn't build the film, and a delivery gate. Nothing is reported as
  finished, or rendered as a final video, until the gate says READY.
- **A local Studio** — play and scrub the film on a timeline, change the pace of a section, pin comments on the frame (Claude reads them,
  fixes the film and answers), review the storyboard before the build, and export a frame-exact MP4 (1080 px on the short side, 60 fps).

## How a film is made

1. **Kickoff** — one question with up to four parts: research depth (only when it will take a while), aspect, loop length, caption
   languages. After that it works on its own.
2. **Research** — facts with sources, reference photos, frames from reference videos.
3. **Plan and storyboard** — scenes, camera moves and a time budget; the storyboard opens in the Studio for your approval.
4. **Build** — the film is written on the bundled engine (studio light, materials, captions, labels, a continuous camera).
5. **QA, review, gate** — fix, rebuild, re-check until READY.
6. **Deliver** — `<film>/<name>.html` plus numbered versions, and the MP4 when you want it.

Expect **hours, not minutes**: a film goes through research, building and several rounds of checks, and uses a lot of tokens.

## Requirements

- **Claude Code**. Recommended: Claude Opus 5.5, Sonnet 5.5 or Fable 5.1 (or newer) at effort medium or above — the setup the skill is
  made and checked in. Anywhere else it still runs and says once that quality can't be guaranteed.
- **Node.js 20+**, **ffmpeg** on PATH, **Google Chrome or Chromium** (or `npx playwright install chromium`), **Python 3** (a local
  static server). Optional: **yt-dlp**, to take reference frames from videos.
- A GPU helps: QA and rendering run headless Chrome with WebGL. Without one, Chrome's software renderer works, slowly.

Developed and tested on macOS (Apple Silicon). Linux should work; Windows is untested (WSL is the safer route).

## Install

**As a plugin** (recommended — Claude Code installs the scripts' packages for you). In Claude Code:

```
/plugin marketplace add Seokwoooo/promptfilm
/plugin install promptfilm@promptfilm
```

Or from a shell: `claude plugin marketplace add Seokwoooo/promptfilm && claude plugin install promptfilm@promptfilm`. Restart Claude Code
(or run `/reload-plugins`). The skill is then `/promptfilm:promptfilm` — or just ask for a motion graphic and it starts by itself.

**By hand**, as a personal skill named `/promptfilm`:

```sh
git clone https://github.com/Seokwoooo/promptfilm.git
cp -R promptfilm/skills/promptfilm ~/.claude/skills/
cd ~/.claude/skills/promptfilm/scripts && npm install
```

**Check the toolchain** once on a new machine: ask Claude Code to *"run the promptfilm selftest"* (`node <skill>/scripts/selftest.mjs`,
about 10 minutes). It builds the engine's test films in a temporary folder and runs every check, including checks that catch planted faults.

## Use

Ask in your own words, in any language:

```
Make a motion graphic that zooms from a grain of sand out to the whole Sahara
A 30-second 16:9 explainer of how a jet engine works, captions in English only
우주 스케일 영상, 지구부터 관측 가능한 우주까지 확대하는 영상 html 만들어줘
```

Follow-ups work too: *"open the Studio"*, *"apply my review comments"*, *"render the MP4"*.

Films are made in your working folder (`./<film-name>/`). Answers to the kickoff question are remembered in `./.promptfilm/settings.json`
and offered first next time.

## Make it yours: the taste profile

`skills/promptfilm/taste.md` is the default taste — the person the skill was built with: a creator making Shorts for a general audience,
who wants nothing to pop in, real-looking subjects, every step shown up close, gentle camera moves and no boring stretches. Copy it to
`./.promptfilm/taste.md` (one project) or `~/.promptfilm/taste.md` (all your projects) and edit it: format defaults, beat speeds, look,
report labels, and what must never happen.

## Inside

```
.claude-plugin/          plugin and marketplace manifests
skills/promptfilm/
  SKILL.md               the workflow
  taste.md               the default taste profile
  references/            principles, pacing, layout, engine API, techniques, QA, visual review, Studio …
  engine/                the film engine (core parts, a film template, two test films)
  scripts/               new film, build, QA, time budget, render, visual-review material, gate, selftest …
  studio/                the local Studio (server and page)
  examples/              code from the two reference films — patterns, not templates
  evals/                 test prompts with expected behaviour
```

## License

MIT — see [LICENSE](LICENSE). Third-party components, imagery credits and trademarks: [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Promptfilm is an independent project, not affiliated with or endorsed by Anthropic.
