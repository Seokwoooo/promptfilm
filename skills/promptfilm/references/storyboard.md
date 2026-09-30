# Storyboard — the plan as scene cards, approved before the build

A film takes hours to build; a wrong direction found at the end costs all of them. So once plan.md is done (step 4), show the plan as
**scene cards** in the Studio and let the requester approve it or ask for changes before any scene code is written. The cards are the
plan's Q3 (scenes), Q7 (pace budget) and Q9 (fact vs illustration) made visible, with the research photos that prove what each scene
will look like.

Skip it only when the taste profile says `Storyboard review: no` or the request asks to start right away ("바로 만들어").

## 1. Write `<film>/storyboard.json` — for a decision, not a copy of the plan

The requester reads the page to decide one thing per scene: *is this the right scene?* They should be through it in a minute or two.
Everything that helps Claude build (camera moves, sizes, sources, what is drawn without a source) is already in plan.md; on a card it is
noise. So a card says what the viewer will **see**, shows one **picture** of it, and gives the **words on screen** — nothing more on its
face; the Studio folds the rest under "Details".

**The picture must be the film, not the research.** A photo of the real subject proves it exists; it doesn't show what the film will look
like, and the requester can't picture the result from it. So the card's picture is, best first (the Studio picks):

1. **The build's own frame** at the card's moment — made by the Studio as soon as a build plays, again after every rebuild, marked
   "현재 빌드 · 0:12.3"; a click plays the film from there. Nothing to do but set `at` (below) once the beats are laid out. While the
   build is still much shorter than planned (under 80 %), only cards whose `at` it already reaches get its frame — the rest keep theirs.
2. **A look frame** (`frame`) — a real render made before the review. Before showing the storyboard, build the look first: the world and
   the hero of the **hook and the 2–3 scenes the film is about**, at the quality bar (P29), in the film's light, with the real caption; a
   camera key at each of those framings; build, and render each moment with `node <skill>/scripts/shot.mjs <url> --out <film>/storyboard
   <t> …` — then `"frame": "storyboard/t0012.30.png"`. This is the start of the build, not extra work: those parts stay. It is never a
   sketch — a hero that can't be at the quality bar yet is left out, not shown rough (the requester rejects mock-ups).
3. Its first reference photo, marked "참고 사진" — so put the photo that shows the subject best first.
4. Nothing yet: a thin "아직 렌더 전" strip.

```json
{
  "version": 1,
  "title": "지구에서 관측 가능한 우주의 끝까지",
  "summary": "지구에서 출발해 한 번도 끊기지 않고 우주의 끝까지 물러났다가, 다시 지구로 돌아와요.",
  "format": { "aspect": "9x16", "length": "45-60", "langs": "en ko" },
  "estimate": 52.4,
  "scenes": [
    { "id": "s1", "name": "우리가 사는 지구", "beat": "hook", "seconds": 3.2, "field": 3.0e7,
      "sees": "구름 덮인 지구가 천천히 다가오고, 왼쪽에 달이 작게 보여요",
      "caption": { "title": "Earth", "line": "12,742 km across", "second": "(지구 — 지름 12,742km)" },
      "refs": ["research/refs/earth_blue_marble.jpg"],
      "camera": "day side, slow push-in, 10° yaw",
      "facts": [{ "text": "Mean diameter 12,742 km", "source": "NASA Earth fact sheet" }],
      "illustrative": "" }
  ],
  "open": []
}
```

| Field | On the card | Rule |
|---|---|---|
| `title` | heading | the film's title in the requester's language, one line — no second language in parentheses |
| `summary` | two lines (click for more) | **1–2 sentences**: the idea and how it ends. Not the scene list — the cards are the scene list |
| scenes | one card each | a scene the viewer would name — as many as budget.mjs allows (45–60 s: at most 11; 25–35 s: 6; 15–20 s: 3), plus the way back (`beat: "return"`, the last card, no caption needed). Each card is a **stop** the camera makes and holds while its caption is read (pacing.md §2), so the count comes from the time budget; fold transits, short framings and returns into the scene they lead to; the beat-by-beat pace stays in plan.md Q7 |
| `name` | card title | what the scene is, in a few words (≤ 16 Korean characters / 4 words) |
| `seconds` | beside the title | its **played** length from the Q7 budget — at least its caption's reading time plus the move into it; `estimate` = their sum (the Studio compares it with the target) |
| `field` | — (for the budget) | the view's width at this stop, in metres (a product film: across what is framed). budget.mjs turns the steps between cards into e-folds of camera move; the way back is costed from them too. Required on every card before the way back |
| `beat` | the card's colour | its main kind (hook / key / normal / transit / return) |
| `sees` | the card's sentence | **one short sentence** (≤ 50 Korean characters) in plain words: what the viewer sees. No numbers, model names, sizes, sources or camera terms — those are the caption's and Details' |
| `caption` | the requester's-language line; the original under Details | exactly as it will appear (title, line, second-language line with its parentheses; '' where there is none) |
| `frame` | the card's picture (see above), marked "실제 렌더" | a look frame: a PNG rendered from the film by shot.mjs (path inside the film folder). Only real renders — never a sketch, a generated picture or an edited photo |
| `at` | where the Studio takes the build's frame | the card's moment in playback seconds, set once the beats exist: a moment inside its stop (the camera held, the caption on, what it names large in the frame). Without it the Studio uses the card's place in the planned seconds — only once the build is about as long as planned |
| `refs` | the picture while there is no frame (marked "참고 사진"); the others under Details | 0–2 research photos (paths inside the film folder, usually `research/refs/…`); put the one that best shows the scene first. They stay local — photos never go into the film (P24) |
| `camera` | Details | a few words |
| `facts` | Details | the numbers the scene shows, each with a short source |
| `illustrative` | a small "일러스트" tag; the text under Details | only when a whole scene or its hero is drawn without a public source — not for generic parts (a messenger screen, a rack layout, a road). A few words. Usually '' |
| `open` | questions above the cards | only what nobody but the requester can answer — usually `[]` |

`id`s stay the same across versions. Write it in the requester's language except the captions (which are what the film shows). Before
showing it, read it as the requester will: if a card needs more than one glance, shorten it; if two cards would get the same answer, merge
them. Then `node <skill>/scripts/budget.mjs <film>` — every card a stop long enough for its caption, the cards within the length with room
for the way back; show the storyboard only when it says "the plan fits".

## 2. Show it

Start the Studio for this film — `node <skill>/studio/server.mjs <working-dir> --film <film-id>` in the background (studio.md §1): it opens
the page on this film's **Storyboard** tab by itself (or switches the Studio page that is already open), so the requester doesn't have to
find it. Start the watcher **for this film** — `node <skill>/studio/await.mjs --film <film-id>`, in the background — and tell the requester
one line: "스토리보드를 열어 뒀어요 — 장면 N개, 약 N초예요", with the link `http://127.0.0.1:<port>/#film=<film-id>` in case the page was
closed. Then wait. On each card the requester marks *Looks good* or *Change this* with a note, may add a note for the whole film, and
presses:

| Button | review in storyboard.json | What you do when the watcher delivers it |
|---|---|---|
| **Start production as it is** (no change notes) | `approved` set | step 5: build |
| **Fix these and start** (with change notes) | `approved` set, notes on cards | apply the notes to plan.md (and the cards), then build — no second review |
| **Show me a revised version** | `approved` null | revise plan.md and the cards; `version` + 1; `changedIn: <new version>` on each changed card; a short `review.reply` saying what changed; keep `review.scenes` as it is. Start the watcher again; they review the new version |

The requester may also just answer in the chat ("좋아, 진행해" / "3번 장면은 빼줘") — the same rules apply. Never edit `review.scenes`,
`review.note`, `review.answers` or `review.approved` yourself: they are the requester's. A request the watcher prints is for the film it
names: if it ever names another film than yours, it isn't yours — don't act on it; start your watcher again with `--film <your film>`.

## 3. During and after the build

As soon as a build plays, every card shows that build's frame at its moment (made again after each rebuild, only while someone looks at
the storyboard; kept in `<film>/review/storyboard/`) — the storyboard becomes the place to watch the film appear scene by scene. Set `at`
on each card when the beats are laid out and whenever they move, so each card shows its own moment.


The storyboard stays in the film folder as the record of what was agreed. When the build departs from an approved card (a fact turned out
differently, a scene had to change), say so in the delivery report.
