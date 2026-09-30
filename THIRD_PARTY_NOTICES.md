# Third-party notices

Promptfilm's own code, documents and images are under the MIT License (see `LICENSE`), except as noted here.

## Loaded at run time, not included in this repository

| What | Used by | License |
|---|---|---|
| [three.js](https://threejs.org) r160 and its example modules, from jsDelivr | every film (the engine, the examples) | MIT |
| Helvetiker typeface (three.js examples) | 3D lettering in films that use it | see the three.js repository |
| [Barlow, Barlow Semi Condensed](https://fonts.google.com/specimen/Barlow), [Noto Sans KR / JP / SC …](https://fonts.google.com/noto), from Google Fonts | captions and labels | SIL Open Font License 1.1 |
| [playwright-core](https://github.com/microsoft/playwright) | QA, rendering, the Studio's snapshots (installed with npm) | Apache-2.0 |
| [pngjs](https://github.com/pngjs/pngjs) | QA image analysis (installed with npm) | MIT |

The films are drawn by Chrome; videos are encoded by your own ffmpeg; reference clips are downloaded by your own yt-dlp (optional).

## Imagery in `skills/promptfilm/references/review-examples/`

These are frames of the author's own films, used to show a reviewer what was praised and what was rejected. Some contain satellite
imagery:

- Sentinel-2 cloudless — https://s2maps.eu by EOX IT Services GmbH (contains modified Copernicus Sentinel data 2016), CC BY 4.0
- Contains modified Copernicus Sentinel data 2020–2026 (Sentinel-2 L2A)
- NASA Blue Marble / VIIRS Black Marble (NASA, via GIBS) and USDA NAIP imagery — public domain

## The example films in `skills/promptfilm/examples/`

- `blackwell-silicon-to-scale.v11.html` draws on public facts from NVIDIA's "RTX Blackwell GPU Architecture" whitepaper. The film is an
  unofficial illustration: its models are the author's, not NVIDIA's designs, and it is not affiliated with or endorsed by NVIDIA.
  NVIDIA, Blackwell and RTX are trademarks of NVIDIA Corporation.
- `cosmic-scale/` contains code only. The data it was built with (star and galaxy catalogues, planet maps) is not included; its sources
  and licences are listed in `cosmic-scale/tools/prep_data.py`.

Other product and company names that appear in the documents and examples are the property of their owners and are used only to
describe real things.
