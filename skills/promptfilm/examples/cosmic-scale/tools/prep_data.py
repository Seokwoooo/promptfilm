#!/usr/bin/env python3
"""Pack the real data used by the film into parts/p0_data.js (base64 blobs + small JSON).

Inputs (downloaded into RAW, see README notes in the script header of the film):
  hyg.csv                HYG star database v4.1 (astronexus, CC BY-SA 4.0)
  ungc.tsv               Updated Nearby Galaxy Catalog (Karachentsev+ 2013, VizieR J/AJ/145/101)
  2mrs.tsv               2MASS Redshift Survey (Huchra+ 2012, VizieR J/ApJS/199/26)
  superstructures.tsv    Five superstructures (Boehringer+ 2025, VizieR J/A+A/695/A59)
  earth_bm.jpg           NASA Blue Marble (land_ocean_ice_cloud_2048)
  jupiter_pia07782.jpg   NASA/JPL/SSI Cassini cylindrical map of Jupiter (PIA07782)
  sss_2k_saturn.jpg      Solar System Scope Saturn map (CC BY 4.0; from NASA/JPL Cassini imagery)
  sss_2k_neptune.jpg     Solar System Scope Neptune map (CC BY 4.0; from NASA/JPL Voyager imagery; used for its cloud detail only)
All positions are written in heliocentric Galactic cartesian coordinates (x -> l=0, y -> l=90, z -> b=+90).
"""
import base64, csv, io, json, math, os, struct, subprocess, sys

RAW = sys.argv[1]
OUT = sys.argv[2]

EQ2GAL = [[-0.0548755604162154, -0.8734370902348850, -0.4838350155487132],
          [0.4941094278755837, -0.4448296299600112, 0.7469822444972189],
          [-0.8676661490190047, -0.1980763734312015, 0.4559837761750669]]


def eq2gal(x, y, z):
    return tuple(EQ2GAL[i][0] * x + EQ2GAL[i][1] * y + EQ2GAL[i][2] * z for i in range(3))


def radec2gal(ra_deg, dec_deg, d):
    a, b = math.radians(ra_deg), math.radians(dec_deg)
    return eq2gal(d * math.cos(b) * math.cos(a), d * math.cos(b) * math.sin(a), d * math.sin(b))


def fnum(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def b64(b):
    return base64.b64encode(b).decode('ascii')


out = {}

# ---------------- stars (HYG) ----------------
# literature distances for the stars that also appear in the size lineup (HYG uses Hipparcos parallaxes)
DIST_OVERRIDE = {  # hip: (pc, source)
    '27989': (168.0, 'Betelgeuse, Joyce+2020 (548 ly)'),
    '80763': (170.0, 'Antares, ~550 ly'),
    '102098': (802.0, 'Deneb, Schiller & Przybilla 2008'),
    '35793': (1170.0, 'VY CMa, Zhang+2012 / Choi+2008 maser parallaxes (~1.1-1.2 kpc)'),
}
ABSMAG_OVERRIDE = {'35793': -2.4}   # observed V ~ 7.9 at 1.17 kpc (dust-dimmed)
rows = list(csv.DictReader(open(os.path.join(RAW, 'hyg.csv'))))
stars, named = [], {}
UNIT = 0.04  # pc per int16 step (+-1310 pc)
WANT = {'Sol': 'sun', 'Sirius': 'sirius', 'Arcturus': 'arcturus', 'Aldebaran': 'aldebaran', 'Rigel': 'rigel',
        'Deneb': 'deneb', 'Betelgeuse': 'betelgeuse', 'Antares': 'antares', 'Proxima Centauri': 'proxima',
        'Rigil Kentaurus': 'alphacen', "Barnard's Star": 'barnard', 'Wolf 359': 'wolf359', 'Lalande 21185': 'lalande',
        'Vega': 'vega', 'Polaris': 'polaris', 'Procyon': 'procyon', 'Altair': 'altair', 'Capella': 'capella', 'Fomalhaut': 'fomalhaut'}
WANT_HIP = {'35793': 'vycma', '43587': 'cnc55', '98505': 'hd189733'}
for r in rows:
    hip = r['hip']
    d = fnum(r['dist'])
    m = fnum(r['mag'])
    M = fnum(r['absmag'])
    if hip in DIST_OVERRIDE:
        d = DIST_OVERRIDE[hip][0]
        if hip in ABSMAG_OVERRIDE:
            M = ABSMAG_OVERRIDE[hip]
        elif m is not None:
            M = m - 5 * math.log10(d) + 5
    if d is None or d >= 100000 or M is None:
        continue
    keep = True                      # v2: every catalogued star with a distance (the real sky down to ~mag 9-11)
    if not keep:
        continue
    ra, dec = fnum(r['ra']) * 15.0, fnum(r['dec'])
    g = radec2gal(ra, dec, d) if d > 0 else (0.0, 0.0, 0.0)
    ci = fnum(r['ci'])
    if ci is None:
        ci = 0.65
    idx = len(stars)
    stars.append((g, M, ci, d))
    key = WANT.get(r['proper']) or WANT_HIP.get(hip)
    if key and key not in named:
        named[key] = {'i': idx, 'pc': [round(v, 4) for v in g], 'dist_pc': round(d, 4), 'M': round(M, 2), 'ci': ci}
buf = bytearray()
for (g, M, ci, d) in stars:
    n = math.sqrt(g[0] ** 2 + g[1] ** 2 + g[2] ** 2) or 1.0
    q = [max(-32767, min(32767, int(round(v / n * 32767)))) for v in g]
    ld = 0 if d <= 0 else max(0, min(65535, int(round((math.log10(max(d, 0.01)) + 2) / 6 * 65535))))   # 0.01 pc .. 10 kpc
    buf += struct.pack('<hhhHBB', q[0], q[1], q[2], ld, max(0, min(255, int(round((M + 12) * 8)))),
                       max(0, min(255, int(round((ci + 0.5) * 80)))))
out['STARS'] = {'n': len(stars), 'b64': b64(bytes(buf)), 'named': named}
print('stars', len(stars), 'named', sorted(named))

# ---------------- nearby galaxies (UNGC) ----------------
def sexa(s, hours):
    p = s.split()
    sign = -1 if p[0].startswith('-') else 1
    v = abs(float(p[0])) + float(p[1]) / 60 + float(p[2]) / 3600
    return sign * v * (15 if hours else 1)

ung = []
for line in open(os.path.join(RAW, 'ungc.tsv')):
    if line.startswith('#') or not line.strip():
        continue
    p = line.rstrip('\n').split('\t')
    if len(p) < 11 or p[0].strip() in ('Name', '') or p[0].startswith('-'):
        continue
    try:
        ra, dec = sexa(p[1], True), sexa(p[2], False)
    except (ValueError, IndexError):
        continue
    name = p[0].strip()
    dist = fnum(p[8])
    if dist is None or name == 'Milky Way':
        continue
    A26 = fnum(p[9]) or 1.0
    incl = fnum(p[10])
    TT = fnum(p[6])
    B = fnum(p[4])
    K = fnum(p[5])
    dpc = dist * 1e6
    MB = (B - 5 * math.log10(dpc) + 5) if B is not None else (K - 5 * math.log10(dpc) + 5 + 2.5 if K is not None else -12)
    g = radec2gal(ra, dec, dist * 1000.0)  # kpc
    ung.append({'n': name, 'x': round(g[0], 3), 'y': round(g[1], 3), 'z': round(g[2], 3), 'D': A26,
                'i': incl if incl is not None else 60, 't': TT if TT is not None else 10, 'MB': round(MB, 2)})
out['UNGC'] = ung
print('ungc', len(ung))

# ---------------- 2MRS ----------------
H0 = 70.0
C = 299792.458
buf = bytearray()
n2 = 0
for line in open(os.path.join(RAW, '2mrs.tsv')):
    if line.startswith('#') or not line.strip():
        continue
    p = line.rstrip('\n').split('\t')
    if len(p) < 5:
        continue
    ra, dec, kt, typ, cz = fnum(p[0]), fnum(p[1]), fnum(p[2]), p[3].strip(), fnum(p[4])
    ba = fnum(p[6]) if len(p) > 6 else None
    if ba is None: ba = 0.7
    if ra is None or dec is None or kt is None or cz is None:
        continue
    z = cz / C
    D = (C / H0) * (z - 0.225 * z * z)
    if D < 11.0:      # the Local Volume comes from the UNGC
        continue
    g = radec2gal(ra, dec, D)
    MK = kt - 5 * math.log10(D * 1e6) + 5
    T = 99
    try:
        if typ:
            s = typ[0:2] if typ[0] == '-' else typ[0]
            T = int(s)
    except ValueError:
        T = 99
    q = [max(-32767, min(32767, int(round(v / 0.02)))) for v in g]
    buf += struct.pack('<hhhBbB', q[0], q[1], q[2], max(0, min(255, int(round((MK + 28) * 20)))), max(-10, min(99, T)), max(0, min(255, int(round(ba * 255)))))
    n2 += 1
out['TMRS'] = {'n': n2, 'unitMpc': 0.02, 'b64': b64(bytes(buf))}
print('2mrs', n2)

# ---------------- superstructures (Boehringer+ 2025) ----------------
ss = []
for line in open(os.path.join(RAW, 'superstructures.tsv')):
    if line.startswith('#') or not line.strip():
        continue
    p = line.rstrip('\n').split('\t')
    if len(p) < 8:
        continue
    ra, dec, z, sid, m200 = fnum(p[3]), fnum(p[4]), fnum(p[5]), fnum(p[2]), fnum(p[7])
    if ra is None or z is None or sid is None:
        continue
    D = (C / H0) * (z - 0.225 * z * z)
    g = radec2gal(ra, dec, D)
    ss.append([int(sid), round(g[0], 2), round(g[1], 2), round(g[2], 2), m200 or 1.0])
out['SUPER'] = ss
print('superstructure clusters', len(ss))

# ---------------- textures (webp) ----------------
def webp(src, w, h, q):
    tmp = '/tmp/_cs_tex.webp'
    subprocess.run(['cwebp', '-quiet', '-q', str(q), '-resize', str(w), str(h), src, '-o', tmp], check=True)
    return 'data:image/webp;base64,' + b64(open(tmp, 'rb').read())

out['TEX_EARTH'] = webp(os.path.join(RAW, 'earth_bm.jpg'), 2048, 1024, 82)
out['TEX_JUPITER'] = webp(os.path.join(RAW, 'jupiter_pia07782.jpg'), 1280, 640, 88)
out['TEX_NIGHT'] = webp(os.path.join(RAW, 'blackmarble.jpg'), 2048, 1024, 72)
# Saturn and Neptune maps: Solar System Scope (CC BY 4.0), built from NASA/JPL Cassini and Voyager imagery
out['TEX_SATURN'] = webp(os.path.join(RAW, 'sss_2k_saturn.jpg'), 1536, 768, 86)
out['TEX_NEPTUNE'] = webp(os.path.join(RAW, 'sss_2k_neptune.jpg'), 1024, 512, 84)
# the Milky Way without its bright stars, Galactic coordinates (NASA/GSFC SVS Deep Star Maps 2020; Gaia DR2: ESA/Gaia/DPAC),
# converted from the 4k EXR to an sRGB-encoded PNG first (see mw_gal_4k_srgb.png)
out['TEX_MILKYWAY'] = webp(os.path.join(RAW, 'mw_gal_4k_srgb.png'), 4096, 2048, 86)

with open(OUT, 'w') as f:
    f.write('/* ===== 0. EMBEDDED REAL DATA (generated by tools/prep_data.py — do not edit by hand) ===== */\n')
    for k, v in out.items():
        f.write('const DATA_%s = %s;\n' % (k, json.dumps(v, separators=(',', ':'))))
print('wrote', OUT, os.path.getsize(OUT))
