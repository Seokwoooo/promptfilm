#!/usr/bin/env python3
"""Pack files into a film part as data URLs, so the film stays one self-contained HTML file.

  python3 embed_assets.py <film>/parts/p3_assets.js logo=path/to/logo.png model=path/to/thing.glb photo=path/to/x.jpg

Writes `const ASSET_LOGO = 'data:image/png;base64,...';` etc. Load them in the film with loadTextureData(ASSET_LOGO) or
loadGLBData(ASSET_MODEL) (engine p2) and put the promises into READY. Keep the whole film under ~10 MB: downscale images
to what the frame needs (a 1080-wide frame rarely needs textures over 2048 px) and decimate models first.
Name the output p3_assets.js (build.sh picks up p3*.js .. p6*.js in order, so it comes before the parts that use it).
"""
import base64, mimetypes, os, sys

MIME = {'.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
        '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ktx2': 'image/ktx2', '.json': 'application/json', '.hdr': 'image/vnd.radiance'}
out, pairs = sys.argv[1], sys.argv[2:]
if not pairs: sys.exit(__doc__)
lines = ['/* embedded assets (scripts/embed_assets.py) — sources and licences belong in the header comment of p1_head.html */']
total = 0
for p in pairs:
    name, path = p.split('=', 1)
    ext = os.path.splitext(path)[1].lower()
    mime = MIME.get(ext) or mimetypes.guess_type(path)[0] or 'application/octet-stream'
    data = open(path, 'rb').read(); total += len(data)
    lines.append(f"const ASSET_{name.upper()} = 'data:{mime};base64,{base64.b64encode(data).decode()}';")
    print(f'{name}: {path} ({len(data) / 1e6:.2f} MB, {mime})')
open(out, 'w').write('\n'.join(lines) + '\n')
print(f'wrote {out} — {total / 1e6:.2f} MB of assets ({total * 4 / 3 / 1e6:.2f} MB as base64)')
