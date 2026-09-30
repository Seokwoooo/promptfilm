# edit-analysis — how was this video edited?

When the requester records a film and edits it (speed changes, cuts, loops) before posting, this recovers the edit so the
skill can learn from it (references/pacing.md §4).

1. Find the rectangle of the video that shows the film (a screen recording has browser chrome and maybe a banner):
   `ffmpeg -ss 10 -i video.mp4 -frames:v 1 frame.png` and look at it; note W:H:X:Y of the film area.
2. Serve the film (`node <skill>/scripts/serve.mjs <its folder's parent> --port 8765`, in the background) and run
   `uv run --with numpy --with pillow python analyze.py video.mp4 http://127.0.0.1:8765/…/film.html out/ --crop W:H:X:Y`
3. Read `out/report.md`: each segment's speed and the film beats it covers. Compare with the beats' kinds.

Measured this way (Sept 2026): the Blackwell film was edited at ×2 / ×4 / ×8 by content; the cosmic film at ×3 throughout.
