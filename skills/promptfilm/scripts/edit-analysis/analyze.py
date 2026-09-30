#!/usr/bin/env python3
"""Recover how an edited video was sped up, cut and looped, by matching its frames against the film's own frames.

  uv run --with numpy --with pillow python analyze.py <video.mp4> <film-url> <outdir> [--crop W:H:X:Y] [--speeds 0,1,2,3,4,5,6,8,10,12,16]

--crop is the rectangle of the video that shows the film (ffmpeg crop syntax), e.g. a screen recording with browser chrome
around it. The film is rendered at the crop's aspect. Output: <outdir>/report.md (segments with their speed, what the film
shows there, the beats they fall in) and path.json (video time -> film playback time).
"""
import json, os, subprocess, sys, argparse
import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('video'); ap.add_argument('url'); ap.add_argument('out')
ap.add_argument('--crop', default=None); ap.add_argument('--step', type=float, default=0.05)
ap.add_argument('--speeds', default='0,1,2,3,4,5,6,8,10,12,16'); ap.add_argument('--penalty', type=float, default=4.0)
ap.add_argument('--render-w', type=int, default=540, help='width the film is rendered at (text layers have minimum pixel sizes, so a tiny render mismatches)')
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))

probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height,r_frame_rate', '-of', 'json', a.video]))['streams'][0]
fps = eval(probe['r_frame_rate']); vw, vh = probe['width'], probe['height']
if a.crop: cw, ch, cx, cy = map(int, a.crop.split(':'))
else: cw, ch, cx, cy = vw, vh, 0, 0
GW = 64; GH = max(16, round(64 * ch / cw))
# 1. the film's frames
grid = os.path.join(a.out, 'grid')
if not os.path.exists(os.path.join(grid, 'meta.json')):
    rw = a.render_w; rh = round(rw * ch / cw)
    subprocess.check_call(['node', os.path.join(HERE, 'render_grid.mjs'), a.url, grid, '--step', str(a.step), '--w', str(rw), '--h', str(rh)])
meta = json.load(open(os.path.join(grid, 'meta.json'))); step, L, M = meta['step'], meta['LOOP'], meta['n']
G = np.stack([np.asarray(Image.open(os.path.join(grid, f'{i:05d}.jpg')).convert('RGB').resize((GW, GH), Image.BOX), np.float32) for i in range(M)])
# 2. the video's frames, cropped to the film
raw = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', a.video, '-vf', f'crop={cw}:{ch}:{cx}:{cy},scale={GW}:{GH}:flags=area,format=rgb24', '-f', 'rawvideo', '-'])
V = np.frombuffer(raw, np.uint8).reshape(-1, GH, GW, 3).astype(np.float32); N = len(V)
def feat(X):
    g = np.sqrt(np.maximum(X.mean(-1), 0)).reshape(len(X), -1)
    g = g - g.mean(1, keepdims=True); return g / (np.linalg.norm(g, axis=1, keepdims=True) + 1e-6)
C = feat(V) @ feat(G).T                                        # N x M correlation
# 3. integer speeds, piecewise constant, on a 1/fps film grid (dynamic programming; a change of speed costs `penalty`)
R = max(1, round(step * fps)); MF = M * R
jf = np.arange(MF) / R; j0 = np.floor(jf).astype(int) % M; j1 = (j0 + 1) % M; w = (jf - np.floor(jf)).astype(np.float32)
SP = [int(s) for s in a.speeds.split(',')]; K = len(SP)
cost = np.tile(-(C[0, j0] * (1 - w) + C[0, j1] * w), (K, 1)); back = np.zeros((N, K, MF), np.int8)
for i in range(1, N):
    ci = C[i, j0] * (1 - w) + C[i, j1] * w
    bp = cost.min(0); bk = cost.argmin(0); new = np.empty_like(cost)
    for k, s in enumerate(SP):
        same = np.roll(cost[k], s); sw = np.roll(bp, s) + a.penalty; m = sw < same
        new[k] = np.where(m, sw, same) - ci; back[i, k] = np.where(m, np.roll(bk, s), k)
    cost = new
k, jj = np.unravel_index(cost.argmin(), cost.shape); ks = np.zeros(N, int); js = np.zeros(N, int)
for i in range(N - 1, -1, -1):
    ks[i], js[i] = k, jj
    if i: pk = back[i, k, jj]; jj = (jj - SP[k]) % MF; k = pk
tfilm = js / fps * (step * fps / R)                            # film playback seconds
segs = []; s0 = 0
for i in range(1, N + 1):
    if i == N or ks[i] != ks[s0]: segs.append((s0, i)); s0 = i
corr = float(np.mean(C[np.arange(N), (js // R) % M]))
beats = meta.get('beats') or []
def beats_in(t0, t1):
    if t1 < t0: t1 += L
    return [b['name'] + ' (' + b['kind'] + ')' for b in beats if b['t0'] < t1 % L + (L if t1 > L else 0) and b['t1'] > t0]
lines = [f'# Edit analysis — {os.path.basename(a.video)}', '',
         f'video {N / fps:.2f} s at {fps:g} fps · film loop {L:.2f} s · mean correlation {corr:.3f} (dark scenes match less well)', '',
         '| video s | length | speed | film s | film beats there |', '|---|---|---|---|---|']
tot = {}
for s0, s1 in segs:
    sp = SP[ks[s0]]; d = (s1 - s0) / fps; tot[sp] = tot.get(sp, 0) + d
    lines.append(f'| {s0 / fps:6.2f}–{s1 / fps:6.2f} | {d:5.2f} | ×{sp} | {tfilm[s0]:6.2f}–{tfilm[s1 - 1]:6.2f} | {"; ".join(beats_in(tfilm[s0], tfilm[s1 - 1]))[:120]} |')
lines += ['', 'time per speed: ' + ', '.join(f'×{k} {v:.1f} s' for k, v in sorted(tot.items())),
          'A ×0 or a very high speed lasting a fraction of a second in a dark or still scene is usually a matching artefact, not an edit.']
open(os.path.join(a.out, 'report.md'), 'w').write('\n'.join(lines) + '\n')
json.dump({'fps': fps, 'video_t': (np.arange(N) / fps).round(4).tolist(), 'film_t': tfilm.round(4).tolist(), 'speed': [SP[k] for k in ks]}, open(os.path.join(a.out, 'path.json'), 'w'))
print('\n'.join(lines))
