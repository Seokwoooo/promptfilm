
/* =====================================================================================
   3. THE SIZE LINEUP — planets and stars side by side at true relative size.
   Bottoms on one line (the Sun's lowest point), each body a small gap from its neighbour. The lineup is a
   comparison device: these worlds are in different star systems. It is anchored at the real Sun (the lineup's
   Sun IS the Sun of the map that follows). Planets run toward −x of the Sun, stars toward +x.
   Familiar worlds come first: Earth, then Neptune, Uranus, Saturn and Jupiter; then two famous planets of other
   stars, both larger than Jupiter; then the Sun and the stars. Every new body joins the row on the right, each larger than
   the one before (Antares, a little smaller than Betelgeuse, is the one exception). A body is drawn from just
   before its turn (while still outside the view).
   Surfaces: Earth, Jupiter and Saturn are real maps (Neptune's clouds too, recoloured); Saturn's rings follow the
   measured ring radii; everything else (exoplanet looks, star surfaces) is illustrative, as the captions say.
   ===================================================================================== */
const LINEUP = [
  // key, EN, KO, kind (planet shader variant or 'star'), look parameters
  { key: 'earth', en: 'Earth', ko: '지구', kind: 0, term: [1.0, 0.42, 0.18, 0.75], atm: [0.3, 0.55, 1.0, 0.03, 1.0] },
  { atm: [0.4, 0.68, 1.0, 0.035, 0.85], key: 'neptune', en: 'Neptune', ko: '해왕성', kind: 3, term: [0.75, 0.85, 1.0, 0.3], map: 1, c1: [0.2, 0.4, 0.66], c2: [0.32, 0.54, 0.8], c4: [0.55, 0.78, 1.0], p: [0.07, 0.0, 0.5, 0], rim: 0.45, tilt: [28.3, 0.3] },
  { atm: [0.5, 0.85, 0.92, 0.035, 0.85], key: 'uranus', en: 'Uranus', ko: '천왕성', kind: 3, term: [0.8, 0.95, 0.95, 0.3], c1: [0.33, 0.52, 0.56], c2: [0.44, 0.64, 0.67], c4: [0.7, 0.9, 0.95], p: [0.06, 0.55, 0.15, 0], rim: 0.45, tilt: [97.8, 0.45] },
  { key: 'saturn', en: 'Saturn', ko: '토성', kind: 2, term: [1.0, 0.66, 0.4, 0.5], tilt: [26.7, 0], atm: [0.95, 0.85, 0.62, 0.025, 0.55] },
  { key: 'jupiter', en: 'Jupiter', ko: '목성', kind: 1, term: [1.0, 0.62, 0.38, 0.5], tilt: [3.1, 0], atm: [0.95, 0.84, 0.68, 0.025, 0.55] },
  { atm: [0.35, 0.58, 1.0, 0.05, 0.95], key: 'hd189733b', en: 'HD 189733 b', ko: 'HD 189733 b', kind: 6, c1: [0.08, 0.2, 0.62], c2: [0.16, 0.34, 0.8], c3: [0.35, 0.08, 0.05], c4: [0.35, 0.55, 1.0], p: [0.35, 0.25, 1.0, 0], rim: 0.7 },
  { atm: [1.0, 0.88, 0.66, 0.14, 0.9], key: 'hatp67b', en: 'HAT-P-67 b', ko: 'HAT-P-67 b', kind: 5, c1: [0.48, 0.39, 0.24], c2: [0.62, 0.54, 0.4], c4: [1.0, 0.92, 0.72], p: [0.55, 6.0, 0.55, 0.05], rim: 1.1, puff: 1 },
  { key: 'sun', en: 'The Sun', ko: '태양', kind: 'star', cell: 150, amp: 0.10, limb: [0.47, 0.23], spots: 1 },
  { key: 'siriusA', en: 'Sirius A', ko: '시리우스 A', kind: 'star', cell: 90, amp: 0.05, limb: [0.35, 0.18] },
  { key: 'arcturus', en: 'Arcturus', ko: '아르크투루스', kind: 'star', cell: 26, amp: 0.16, limb: [0.62, 0.18] },
  { key: 'aldebaran', en: 'Aldebaran', ko: '알데바란', kind: 'star', cell: 20, amp: 0.2, limb: [0.66, 0.16] },
  { key: 'rigel', en: 'Rigel', ko: '리겔', kind: 'star', cell: 36, amp: 0.05, limb: [0.3, 0.16] },
  { key: 'deneb', en: 'Deneb', ko: '데네브', kind: 'star', cell: 30, amp: 0.07, limb: [0.38, 0.18] },
  { key: 'betelgeuse', en: 'Betelgeuse', ko: '베텔게우스', kind: 'star', cell: 4.2, amp: 0.34, limb: [0.72, 0.1], halo: 0.35 },
  { key: 'antares', en: 'Antares', ko: '안타레스', kind: 'star', cell: 5.0, amp: 0.28, limb: [0.7, 0.12], halo: 0.45 },
  { key: 'vycma', en: 'VY Canis Majoris', ko: '큰개자리 VY', kind: 'star', cell: 3.6, amp: 0.36, limb: [0.74, 0.1], halo: 0.75, dust: 1 },
];
// the order of appearance (the same as the row, left to right): the familiar planets, the giants of other stars, the stars
const LINEUP_SEQ = ['earth', 'neptune', 'uranus', 'saturn', 'jupiter', 'hd189733b', 'hatp67b', 'sun', 'siriusA', 'arcturus', 'aldebaran', 'rigel', 'deneb', 'betelgeuse', 'antares', 'vycma'];
// procedural looks keep the seeds they had in v3 (index in the old size-sorted row)
const SEED_I = ['earth', 'cnc55e', 'kep22b', 'k218b', 'gj1214b', 'neptune', 'uranus', 'kep51b', 'saturn', 'jupiter', 'hd189733b', 'hatp7b', 'wasp76b', 'wasp17b', 'wasp12b', 'hatp67b', 'sun', 'siriusA', 'arcturus', 'aldebaran', 'rigel', 'deneb', 'betelgeuse', 'antares', 'vycma'];
const BODY = {};                            // key -> body record
LINEUP.forEach((b, i) => { b.i = i; b.si = SEED_I.indexOf(b.key); b.r = FACTS[b.key].r; b.star = b.kind === 'star'; BODY[b.key] = b; });

/* ---------- layout: bottoms on one line, a small surface gap to the neighbour, no overlaps anywhere ---------- */
// Saturn's spin axis leans right and toward the viewer, so its rings are seen open (~27°) from the front of the row
const SATURN_AXIS = V3(0.2, 0.87, 0.45).normalize();
const SATURN_RING_TOP = FACTS.saturn.ring[7] * Math.sqrt(1 - SATURN_AXIS.y * SATURN_AXIS.y);   // height of the ring tips above the centre
{
  const base = -KM.RSUN;                                       // the line = the Sun's lowest point (lineup frame y)
  const R_RING = FACTS.saturn.ring[7] * 1.04;                  // Saturn's rings need room on both sides
  const halfW = b => (b.key === 'saturn' ? R_RING : b.r);
  const sep = (a, b) => {                                      // horizontal centre distance for bottom-aligned spheres
    // (between stars, more room when the next one is much bigger: seen in perspective it would bulge into the smaller
    // one's comparison view before its turn)
    const g = 0.42 * Math.min(a.r, b.r) + 0.012 * Math.max(a.r, b.r) + (a.star && b.star ? 0.45 * Math.max(b.r - a.r, 0.25 * b.r) : 0);
    const tang = Math.sqrt(Math.pow(a.r + b.r + g, 2) - Math.pow(a.r - b.r, 2));
    const ring = (a.key === 'saturn' || b.key === 'saturn') ? halfW(a) + halfW(b) + 0.5 * g : 0;
    // a wide gap before the Sun: its glow must stay out of the planets' comparison views
    const sunGap = b.key === 'sun' ? a.r + b.r + 4.0e5 : 0;
    // room between Earth and Neptune so the opening close-up of Earth (which is also the loop's last view) shows Earth alone
    const earthGap = (a.key === 'earth' && b.key === 'neptune') ? a.r + b.r + 2.0e4 : 0;
    return Math.max(tang, ring, sunGap, earthGap);
  };
  LINEUP[0].x = 0;
  for (let i = 1; i < LINEUP.length; i++) LINEUP[i].x = LINEUP[i - 1].x + sep(LINEUP[i - 1], LINEUP[i]);
  // any two bodies (not only neighbours) must stay apart: push the right one (and all after it) until they clear
  for (let pass = 0; pass < 3; pass++) for (let i = 1; i < LINEUP.length; i++) for (let j = 0; j < i - 1; j++) {
    const a = LINEUP[j], b = LINEUP[i], ya = base + a.r, yb = base + b.r;
    const need = a.r + b.r + 0.3 * Math.min(a.r, b.r), d = Math.hypot(b.x - a.x, yb - ya);
    if (d < need) { const dx = Math.sqrt(need * need - (yb - ya) * (yb - ya)) - (b.x - a.x); for (let k = i; k < LINEUP.length; k++) LINEUP[k].x += dx; }
  }
  const x0 = BODY.sun.x; LINEUP.forEach(b => { b.x -= x0; });   // the Sun at the origin
  LINEUP.forEach(b => {
    b.local = V3(b.x, base + b.r, 0);                          // lineup frame, km
    b.pos = b.local.clone().applyMatrix4(M_LINE);             // heliocentric Galactic, km
  });
}
const LINE_BASE_Y = -KM.RSUN;
const linePoint = (x, y, z = 0) => V3(x, y, z).applyMatrix4(M_LINE);   // lineup-frame km -> world km

/* ---------- materials ---------- */
const GEO_HI = new THREE.SphereGeometry(1, 256, 128), GEO_LO = new THREE.SphereGeometry(1, 64, 32);
const TEX = { earth: null, jupiter: null };
const texLoader = new THREE.TextureLoader();
function loadTex(url) {
  return new Promise((res, rej) => texLoader.load(url, t => { t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    t.wrapS = THREE.RepeatWrapping; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; res(t); }, undefined, rej));
}
const TEX_READY = Promise.all([loadTex(DATA_TEX_EARTH), loadTex(DATA_TEX_JUPITER), loadTex(DATA_TEX_NIGHT), loadTex(DATA_TEX_SATURN), loadTex(DATA_TEX_NEPTUNE)])
  .then(([e, j, nt, sa, ne]) => { TEX.earth = e; TEX.jupiter = j; TEX.night = nt; TEX.saturn = sa; TEX.neptune = ne; });
const BODY_VS = `
  varying vec3 vObj; varying vec3 vNv; varying vec3 vPv;
  void main() { vObj = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vPv = mv.xyz; vNv = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`;
const PLANET_FS = `
  uniform int uKind; uniform vec3 uC1; uniform vec3 uC2; uniform vec3 uC3; uniform vec3 uC4; uniform vec4 uP; uniform float uRim; uniform float uSeed;
  uniform sampler2D uTex; uniform sampler2D uTex2; uniform vec3 uLightV; uniform vec3 uLightObj; uniform float uFade; uniform float uPolRatio; uniform float uTday; uniform float uTnight; uniform float uSun; uniform float uMap; uniform float uSat; uniform vec4 uTerm;
  varying vec3 vObj; varying vec3 vNv; varying vec3 vPv;
  ${NOISE_GLSL}
  ${BB_GLSL}
  // visible glow of a surface at temperature T: black-body colour, brightness from the Planck curve at 650 nm relative
  // to 3,000 K, compressed (cube root) so the order is kept but a 1,500 K world is still faintly visible
  vec3 heatGlow(float T) { if (T < 900.0) return vec3(0.0); float b = 1.0 / (exp(22130.0 / T) - 1.0), b3 = 1.0 / (exp(22130.0 / 3000.0) - 1.0);
    return bbColor(T) * pow(b / b3, 0.42) * 1.5; }
  // fbm whose finer octaves fade out once they would be smaller than ~2 pixels (no shimmer at any distance)
  float fbmAA(vec3 p, int oct) { float fw = length(fwidth(p)) + 1e-6; float s = 0.0, a = 0.5, w = 0.0;
    for (int i = 0; i < 7; i++) { if (i >= oct) break; float f = 1.0 - smoothstep(0.25, 0.6, fw); s += a * mix(0.5, vnoise(p), f); w += a; p = p * 2.03 + 17.1; fw *= 2.03; a *= 0.5; }
    return s / w; }
  vec3 texSphere(vec3 n) {
    float lon = atan(n.x, n.z), lat = asin(clamp(n.y, -1.0, 1.0));
    vec2 uv = vec2(lon / 6.2831853 + 0.5, lat / 3.1415927 + 0.5), uvb = vec2(fract(uv.x + 0.5), uv.y);
    vec2 dx = dFdx(uv), dy = dFdy(uv), dxb = dFdx(uvb), dyb = dFdy(uvb);
    if (abs(dx.x) + abs(dy.x) > abs(dxb.x) + abs(dyb.x)) { dx = dxb; dy = dyb; }
    return textureGrad(uTex, uv, dx, dy).rgb;
  }
  vec3 texSphereB(vec3 n) {
    float lon = atan(n.x, n.z), lat = asin(clamp(n.y, -1.0, 1.0));
    vec2 uv = vec2(lon / 6.2831853 + 0.5, lat / 3.1415927 + 0.5), uvb = vec2(fract(uv.x + 0.5), uv.y);
    vec2 dx = dFdx(uv), dy = dFdy(uv), dxb = dFdx(uvb), dyb = dFdy(uvb);
    if (abs(dx.x) + abs(dy.x) > abs(dxb.x) + abs(dyb.x)) { dx = dxb; dy = dyb; }
    return textureGrad(uTex2, uv, dx, dy).rgb;
  }
  // Saturn: optical depth of the ring plane at object-space radius r (in equatorial radii)
  float ringOpacity(float rKm) {
    float o = 0.0;
    o += 0.03 * step(66900.0, rKm) * step(rKm, 74510.0);
    o += 0.12 * step(74658.0, rKm) * step(rKm, 92000.0);
    o += 0.82 * step(92000.0, rKm) * step(rKm, 117580.0);
    o += 0.06 * step(117580.0, rKm) * step(rKm, 122170.0);
    o += 0.55 * step(122170.0, rKm) * step(rKm, 136775.0) * (1.0 - step(133423.0, rKm) * step(rKm, 133745.0));
    o += 0.3 * step(140130.0, rKm) * step(rKm, 140230.0);
    return o;
  }
  void main() {
    vec3 N = normalize(vNv), V = normalize(-vPv), L = normalize(uLightV);
    float NL = dot(N, L), NV = clamp(dot(N, V), 0.0, 1.0);
    vec3 n = normalize(vObj);
    vec3 alb = vec3(0.5); vec3 emit = vec3(0.0); float spec = 0.0; float minn = 1.0; float wrap = 0.0; float glowNight = 0.0;
    if (uKind == 0) {                                   // Earth: NASA Blue Marble (clouds included)
      alb = texSphere(n);
      float water = smoothstep(0.02, 0.1, alb.b - max(alb.r, alb.g * 0.9)) * (1.0 - smoothstep(0.55, 0.75, alb.r + alb.g));
      spec = water; minn = 1.0;
      // city lights on the night side (NASA Black Marble 2016)
      vec3 nl = texSphereB(n); float night = 1.0 - smoothstep(-0.12, 0.12, NL);
      emit = vec3(1.0, 0.72, 0.4) * pow(nl.r, 1.6) * night * 0.9;
      float alat = abs(asin(clamp(n.y, -1.0, 1.0)));
      float oval = exp(-pow((alat - 1.17) / 0.06, 2.0)) * (0.4 + 0.9 * fbmAA(n * 9.0 + 3.0, 4));
      emit += vec3(0.25, 1.0, 0.45) * oval * night * 0.35;               // aurora ovals (green oxygen light) on the night side
    } else if (uKind == 1) {                            // Jupiter: Cassini map, grey-brown polar regions blended in
      alb = texSphere(n);
      float lat = abs(asin(clamp(n.y, -1.0, 1.0)));
      alb = mix(alb, vec3(0.44, 0.43, 0.40), smoothstep(1.05, 1.3, lat));
      float la = asin(clamp(n.y, -1.0, 1.0));
      alb *= 0.9 + 0.2 * fbmAA(vec3(n.x * 26.0, la * 240.0, n.z * 26.0) + uSeed, 4);      // fine turbulence along the belts, seen up close
      minn = 1.1;
    } else if (uKind == 2) {                            // Saturn: map from Cassini imagery (Solar System Scope)
      alb = texSphere(n) * 0.92;
      float la = asin(clamp(n.y, -1.0, 1.0));
      alb *= 0.93 + 0.14 * fbmAA(vec3(n.x * 20.0, la * 300.0, n.z * 20.0) + uSeed, 4);
      minn = 1.1;
      // shadow of the rings on the globe
      vec3 p = vObj; vec3 Lo = normalize(uLightObj);                 // object space: the globe is the unit sphere
      if (Lo.y * p.y < 0.0) { float s = -p.y / Lo.y; vec3 q = p + s * Lo; alb *= 1.0 - 0.85 * ringOpacity(length(q.xz) * 60268.0); }
    } else if (uKind == 3) {                            // ice giants: faint bands, a few bright clouds, (Uranus) a brighter polar region
      float lat = asin(clamp(n.y, -1.0, 1.0));
      float bands = sin(lat * 9.0) * 0.5 + 0.5;
      alb = mix(uC1, uC2, bands * uP.x * 8.0);
      alb = mix(alb, uC2 * 1.12, smoothstep(0.7, 1.3, lat) * uP.y);
      float cl = fbmAA(vec3(n.x * 4.0, lat * 18.0, n.z * 4.0) + uSeed, 5);
      alb += vec3(0.25) * smoothstep(0.66, 0.8, cl) * uP.z;
      if (uMap > 0.5) {                                 // Neptune: the map's bands and clouds as brightness only
        vec3 m = texSphere(n); float lm = dot(m, vec3(0.2126, 0.7152, 0.0722));
        alb = mix(uC1 * 0.55, uC2 * 1.05, smoothstep(0.04, 0.21, lm)) + vec3(0.5, 0.55, 0.6) * smoothstep(0.2, 0.27, lm);
      }
      minn = 1.12;
    } else if (uKind == 4) {                            // lava world (55 Cnc e): dark basalt, thin glowing cracks, a few molten pools
      float f = fbmAA(n * 2.6 + uSeed, 6);
      vec3 cp = n * 5.5 + uSeed * 1.7; float fw = length(fwidth(cp)) + 1e-5;
      float cn = vnoise(cp) * 0.7 + vnoise(cp * 2.3) * 0.3;
      float crack = (1.0 - smoothstep(0.0, 0.012 + fw * 0.5, abs(cn - 0.5))) * (1.0 - smoothstep(0.1, 0.32, fw));   // thin fissures, faded before they shimmer
      float pool = smoothstep(0.70, 0.74, f);
      alb = mix(vec3(0.03, 0.028, 0.027), vec3(0.07, 0.066, 0.062), smoothstep(0.35, 0.65, f)) * (1.0 - pool * 0.6);
      float crackMean = 0.06 * smoothstep(0.1, 0.32, fw);                // the fissures' average glow once they are too fine to draw
      float day = smoothstep(-0.3, 0.8, NL);
      float T = mix(uTnight, uTday, day) * (0.82 + 0.22 * (crack + crackMean * 3.0) + 0.18 * pool);
      emit = heatGlow(T) * (0.55 + 0.9 * crack + 0.6 * pool) * 1.1;
      minn = 1.0;
    } else if (uKind == 5) {                            // cloud / haze worlds (illustrative): stretched cloud bands, haze flattens contrast
      float lat = asin(clamp(n.y, -1.0, 1.0));
      vec3 q = vec3(n.x * 2.2, lat * uP.y, n.z * 2.2);
      float c = fbmAA(q + uSeed, 6);
      float cov = smoothstep(1.0 - uP.x, 1.0 - uP.x + 0.28, c);
      alb = mix(uC1, uC2, cov);
      alb = mix(alb, (uC1 + uC2) * 0.5, uP.z);
      emit = heatGlow(mix(uTnight, uTday, smoothstep(-0.3, 0.8, NL)) * (0.9 + 0.2 * c));
      minn = 1.22; wrap = 0.06;
    } else if (uKind == 6) {                            // hot giants: banded day side, thermal glow on the night side (illustrative)
      float lat = asin(clamp(n.y, -1.0, 1.0));
      float w = fbmAA(vec3(n.x * 3.0, lat * 14.0, n.z * 3.0) + uSeed, 6);
      float bands = sin(lat * 13.0 + 2.2 * w) * 0.5 + 0.5;
      alb = mix(uC1, uC2, bands * uP.x * 2.0) * uP.z;
      float day = smoothstep(-0.3, 0.8, NL);
      float T = mix(uTnight, uTday, pow(day, 1.4)) * (0.9 + 0.2 * w);
      emit = heatGlow(T) * 1.1;
      // along the terminator: darker streaks where the cooler night begins (the 'rain' region of the interpretation)
      emit *= 1.0 - uP.w * 0.35 * smoothstep(0.2, 0.0, abs(NL)) * smoothstep(0.45, 0.7, w);
      minn = 1.15; wrap = 0.05;
    } else if (uKind == 7) {
      float lat = asin(clamp(n.y, -1.0, 1.0));
      float w = fbmAA(vec3(n.x * 3.0, lat * 12.0, n.z * 3.0) + uSeed, 6);
      alb = vec3(0.03, 0.027, 0.026) * (0.8 + 0.4 * w);
      float day = smoothstep(-0.3, 0.8, NL);                                // the hottest region faces the star
      float T = mix(uTnight, uTday, pow(day, 1.6)) * (0.88 + 0.24 * w);
      emit = heatGlow(T) * 1.25;
      minn = 1.1;
    }
    // light: Lambert with a soft terminator (and a small wrap for thick atmospheres), Minnaert darkening toward the limb
    float d = clamp((NL + wrap) / (1.0 + wrap), 0.0, 1.0);
    float limb = pow(max(NV, 0.02), minn - 1.0);
    // sunlight grazing the terminator crosses more air and reddens: a sunset band where day meets night
    float graze = 1.0 - smoothstep(0.0, 0.32, NL);
    vec3 sunC = mix(vec3(1.0), uTerm.rgb, graze * uTerm.a);
    vec3 col = alb * d * limb * uSun * sunC;
    if (spec > 0.0) { vec3 H = normalize(L + V); col += vec3(1.0, 0.95, 0.85) * spec * pow(max(dot(N, H), 0.0), 70.0) * 0.9 * step(0.0, NL); }
    col += alb * 0.0025;                                 // the faintest fill: night sides are nearly black, as in space
    // atmosphere: haze brightening toward the lit limb, and a thin twilight glow just past the terminator
    vec3 atm = uKind == 0 ? vec3(0.28, 0.5, 1.0) : uC4;
    float haze = pow(1.0 - NV, 4.0);                     // only the last few percent toward the limb
    col += atm * haze * smoothstep(-0.22, 0.45, NL) * (uKind == 0 ? 1.4 : uRim * 1.2);
    float twi = exp(-pow((NL + 0.035) / 0.075, 2.0)) * (0.35 + 0.65 * haze);
    col += uTerm.rgb * twi * uTerm.a * 0.11;
    if (uKind == 0) col = mix(col, vec3(0.18, 0.32, 0.6) * d, 0.06);
    col = max(mix(vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))), col, uSat), 0.0);   // a little more colour (as outreach photos do)
    col += emit;
    gl_FragColor = vec4(col, uFade);
  }`;
const STAR_FS = `
  uniform vec3 uColor; uniform float uEmit; uniform float uCell; uniform float uAmp; uniform vec2 uLimb; uniform float uSpots; uniform float uSeed; uniform float uFade; uniform vec4 uLimbC;
  uniform float uTime;
  varying vec3 vObj; varying vec3 vNv; varying vec3 vPv;
  ${NOISE_GLSL}
  // the Sun's active regions (object space, the face toward the viewer): two belts of sunspot groups, 10–30° from the equator
  const vec3 SPD[7] = vec3[7](vec3(0.36, 0.31, 0.88), vec3(0.45, 0.27, 0.85), vec3(-0.31, -0.23, 0.92), vec3(-0.22, -0.26, 0.94),
                              vec3(0.08, 0.42, 0.9), vec3(-0.56, 0.2, 0.8), vec3(0.6, -0.33, 0.73));
  const float SPR[7] = float[7](0.05, 0.022, 0.042, 0.02, 0.028, 0.034, 0.03);
  void main() {
    vec3 N = normalize(vNv), V = normalize(-vPv); float mu = clamp(dot(N, V), 0.0, 1.0);
    vec3 n = normalize(vObj);
    if (uSpots > 0.0) {                       // the Sun as a hydrogen-alpha (or SDO 304 Å) telescope shows it: a turbulent, burning surface
      float t = uTime;
      vec3 q = n * 5.0;
      vec3 w = vec3(fbm(q + vec3(0.0, t * 0.05, 0.0), 4), fbm(q + vec3(5.2, 1.3, -t * 0.04), 4), fbm(q + vec3(9.1, t * 0.03, 2.8), 4));
      float turb = fbm(q * 2.2 + (w - 0.5) * 2.4, 5);                              // domain-warped: flowing, flame-like
      float mott = fbm(n * 38.0 + (w - 0.5) * 3.0, 3);                               // fine mottling of the chromosphere
      float plage = 0.0, spot = 0.0;
      for (int k = 0; k < 7; k++) { vec3 c = normalize(SPD[k]); float cd = acos(clamp(dot(n, c), -1.0, 1.0));
        plage += exp(-pow(cd / (SPR[k] * 3.2), 2.0)) * (0.6 + 0.8 * fbm(n * 30.0 + float(k), 3));   // bright active regions
        spot = max(spot, 1.0 - smoothstep(0.25, 0.6, cd / (SPR[k] * 0.55))); }
      // a few long, gently curving dark filaments
      float fil = (1.0 - smoothstep(0.0, 0.012, abs(fbm(n * 1.9 + 11.0, 3) - 0.5))) * smoothstep(0.55, 0.7, fbm(n * 1.3 + 4.0, 2));
      float I2 = (0.32 + 1.05 * turb) * (0.82 + 0.36 * mott) * (1.0 + 0.6 * min(plage, 1.3)) * (1.0 - 0.45 * fil) * (1.0 - 0.7 * spot)
               * (0.52 + 0.48 * pow(mu, 0.4));
      vec3 fire = mix(vec3(0.5, 0.08, 0.01), vec3(1.0, 0.36, 0.04), smoothstep(0.3, 0.75, I2));    // dark red, orange, yellow, white-hot
      fire = mix(fire, vec3(1.0, 0.7, 0.25), smoothstep(0.85, 1.25, I2));
      fire = mix(fire, vec3(1.0, 0.93, 0.75), smoothstep(1.3, 1.8, I2));
      gl_FragColor = vec4(fire * (0.8 + 0.7 * I2) * 1.2, uFade); return;
    }
    float limb = 1.0 - uLimb.x * (1.0 - mu) - uLimb.y * (1.0 - mu) * (1.0 - mu);
    // convection: cells whose bright centres are ringed by darker lanes; the pattern fades to its mean once cells are < ~2 px
    vec3 p = n * uCell + uSeed + vec3(0.0, uTime * 0.015, uTime * 0.01);        // convection slowly boils
    float fw = length(fwidth(p)) + 1e-6, vis = 1.0 - smoothstep(0.18, 0.5, fw);
    vec2 c = cells(p);
    float g = uCell > 12.0 ? smoothstep(0.0, 0.5, c.y - c.x) : 1.0 - smoothstep(0.05, 1.05, c.x);   // granules with lanes / soft giant cells
    float fine = vnoise(p * 3.1) ; float vis2 = 1.0 - smoothstep(0.18, 0.5, fw * 3.1);
    float gran = mix(0.5, g, vis) * 0.7 + mix(0.5, fine, vis2) * 0.3;
    if (uCell < 12.0) gran = mix(gran, fbm(p * 0.8 + 3.3, 3), 0.45);
    // large-scale mottling (visible at every distance)
    float big = fbm(n * 2.2 + uSeed * 0.37, 3);
    float I = limb * (1.0 + uAmp * (gran - 0.5) * 2.0) * (0.92 + 0.16 * big);
    if (uSpots > 0.0) {                              // a few sunspot groups: a soft dark umbra inside a lighter penumbra, faculae around
      float um = 0.0, pen = 0.0, fac = 0.0;
      for (int k = 0; k < 7; k++) {
        vec3 c = normalize(SPD[k]); float rad = SPR[k] * 0.8;
        float cd = acos(clamp(dot(n, c), -1.0, 1.0));
        if (cd > rad * 3.5) continue;
        float rr = cd / rad * (0.92 + 0.16 * fbm(n * 24.0 + float(k) * 7.0, 2));      // gently irregular outlines
        um = max(um, 1.0 - smoothstep(0.3, 0.55, rr));
        pen = max(pen, 1.0 - smoothstep(0.7, 1.05, rr));
        fac = max(fac, exp(-pow((cd - rad * 1.9) / (rad * 1.4), 2.0)));
      }
      I *= 0.95 + 0.1 * fbm(n * 12.0 + vec3(0.0, uTime * 0.01, 0.0), 4);        // supergranular mottling
      I *= 1.0 - 0.35 * clamp(pen, 0.0, 1.0);
      I *= 1.0 - 0.6 * um;
      I *= 1.0 + 0.1 * fac * (0.3 + (1.0 - mu) * 1.5);                   // faculae stand out toward the limb
    }
    vec3 col = uColor * uEmit * I * mix(vec3(1.0), uLimbC.rgb, clamp((1.0 - mu) * uLimbC.a * uLimb.x, 0.0, 1.0));
    col = max(col, 0.0);        // keep star colours after tone mapping
    gl_FragColor = vec4(col, uFade);
  }`;
// a soft glow billboard around each star (corona-like brightening; for red supergiants their extended, dusty envelope)
const HALO_VS = `
  uniform float uScale; varying vec3 vPv; varying vec3 vSv; varying float vR;
  void main() { vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0); float s = length(modelMatrix[0].xyz);
    vSv = c.xyz; vR = s;
    vec4 mv = c; mv.xy += position.xy * uScale * s * 3.0; vPv = mv.xyz; gl_Position = projectionMatrix * mv; }`;
// the glow depends on how close the pixel's line of sight passes to the star (in stellar radii): correct from any angle
const HALO_FS = `
  uniform vec3 uColor; uniform float uAmt; uniform float uDust; uniform float uFade; uniform float uSeed; uniform float uScale; uniform float uLum;
  varying vec3 vPv; varying vec3 vSv; varying float vR;
  ${NOISE_GLSL}
  void main() {
    vec3 d = normalize(vPv); float t = dot(vSv, d); if (t <= 0.0) discard;
    float h = length(cross(vSv, d)) / vR;                      // closest approach of the line of sight, in radii
    if (h < 0.985 || h > uScale) discard;
    float g = exp(-(h - 1.0) * 9.0) * 0.5 + exp(-(h - 1.0) * 3.0) * 0.1;
    // the light it pours out: the glow widens and brightens with log10 of the luminosity (the Sun 0, the supergiants ~5)
    float w = 0.11 + 0.11 * uLum;
    g += (0.1 + 0.075 * uLum) * exp(-(h - 1.0) / w);
    g *= 1.0 - smoothstep(uScale * 0.7, uScale, h);
    if (uDust > 0.0) { vec3 q = cross(vSv, d) / vR; float n = fbm(vec3(q.xy * 1.6, uSeed), 5);
      g += uDust * 0.2 * smoothstep(0.35, 0.8, n) * exp(-(h - 1.0) * 0.9) * smoothstep(0.98, 1.25, h); }
    gl_FragColor = vec4(uColor * g * uAmt * uFade, 1.0);
  }`;
// each planet's atmosphere seen edge-on: a thin glow beyond the limb, brighter on the day side and when back-lit
// (forward scattering); hot worlds add their own heat glow to it. Around it, a soft glow in proportion to the planet
// (like a camera's glow around a bright subject), so a planet looks the same at every distance: nothing here depends
// on how many pixels the planet covers.
const PLANET_HALO_FS = `
  uniform vec3 uColor; uniform float uThick; uniform float uAmt; uniform float uFade; uniform vec3 uLightV; uniform vec3 uHeat; uniform float uAura;
  uniform vec3 uAxisV; uniform float uK;
  varying vec3 vPv; varying vec3 vSv; varying float vR;
  void main() {
    vec3 d = normalize(vPv); float t = dot(vSv, d); if (t <= 0.0) discard;
    vec3 cp = d * t - vSv;
    // an oblate planet's outline is an ellipse: stretch the distance along the projected spin axis (uK = equatorial / apparent polar radius)
    vec3 ap = uAxisV - d * dot(uAxisV, d); float al = length(ap); ap = al > 1e-5 ? ap / al : vec3(0.0);
    float along = dot(cp, ap);
    float h = length(cp + ap * along * (uK - 1.0)) / vR;
    if (h < 0.996 || h > 2.35) discard;
    vec3 nrm = cp / max(length(cp), 1e-9);
    float NL = dot(nrm, uLightV);
    float lit = max(clamp(NL * 0.75 + 0.3, 0.0, 1.0), 0.1);
    float fwd = pow(clamp(dot(d, uLightV), 0.0, 1.0), 5.0);
    float edge = smoothstep(0.996, 1.004, h);
    float prof = exp(-(h - 1.0) / uThick) * edge;
    float aura = (exp(-(h - 1.0) / 0.06) * 0.55 + exp(-(h - 1.0) / 0.28) * 0.14) * edge * (1.0 - smoothstep(1.9, 2.35, h));
    float litA = clamp(NL * 0.6 + 0.5, 0.06, 1.0);
    vec3 col = uColor * uAmt * prof * (lit * 0.9 + fwd * 1.1) + uHeat * (prof + aura * 0.5) + uColor * uAura * aura * (litA + fwd * 0.35);
    gl_FragColor = vec4(col * uFade, 1.0);
  }`;
// the Sun's limb, as a hydrogen-alpha telescope shows it: a ragged, flickering rim of spicules, and a soft corona
const SUN_FX_FS = `
  uniform float uTime; uniform float uFade; uniform float uScale; uniform float uErupt;
  varying vec3 vPv; varying vec3 vSv; varying float vR;
  ${NOISE_GLSL}
  float hsh(float x) { return fract(sin(x * 12.9898) * 43758.5453); }
  void main() {
    vec3 d = normalize(vPv); float t = dot(vSv, d); if (t <= 0.0) discard;
    vec3 cp = d * t - vSv; float h = length(cp) / vR;
    if (h < 0.995 || h > uScale) discard;
    vec3 ax = normalize(cross(vSv, vec3(0.0, 1.0, 0.0))), ay = normalize(cross(ax, vSv));
    float ang = atan(dot(cp, ay), dot(cp, ax));
    vec3 col = vec3(0.0);
    // a burning rim: a forest of flickering spicules, ragged and always moving
    float hgt = 0.012 + 0.032 * pow(fbm(vec3(ang * 22.0, uTime * 0.6, 1.0), 4), 2.0) + 0.02 * pow(fbm(vec3(ang * 70.0, uTime * 1.1, 3.0), 3), 3.0);
    float rim = exp(-(h - 1.0) / hgt) * smoothstep(0.995, 1.002, h);
    col += mix(vec3(1.0, 0.24, 0.04), vec3(1.0, 0.6, 0.18), exp(-(h - 1.0) / 0.01)) * rim * 1.3;
    // the corona: a soft glow
    col += vec3(1.0, 0.55, 0.2) * exp(-(h - 1.0) / 0.12) * 0.18 * smoothstep(1.0, 1.03, h);
    gl_FragColor = vec4(col * uFade, 1.0);
  }`;
function heatGlowJS(T) {                        // the shader's heatGlow() in JS (for the halo's heat colour)
  if (T < 900) return new THREE.Color(0, 0, 0);
  const b = 1 / (Math.exp(22130 / T) - 1), b3 = 1 / (Math.exp(22130 / 3000) - 1);
  return bbColor(T).multiplyScalar(Math.pow(b / b3, 0.42) * 1.5);
}
function planetMaterial(b) {
  const c = (a, d) => new THREE.Color().fromArray(a || d);
  return new THREE.ShaderMaterial({
    uniforms: {
      uKind: { value: b.kind }, uC1: { value: c(b.c1, [0.5, 0.5, 0.5]) }, uC2: { value: c(b.c2, [0.6, 0.6, 0.6]) }, uC3: { value: c(b.c3, [0, 0, 0]) },
      uC4: { value: c(b.c4, [0.6, 0.7, 0.9]) }, uP: { value: new THREE.Vector4().fromArray(b.p || [0, 0, 0, 0]) }, uRim: { value: b.rim || 0.5 },
      uSeed: { value: (b.si * 7.31) % 13 }, uTex: { value: null }, uTex2: { value: null }, uLightV: { value: V3(1, 0, 0) }, uLightObj: { value: V3(1, 0, 0) },
      uFade: { value: 1 }, uPolRatio: { value: 1 }, uSun: { value: 2.8 }, uMap: { value: b.map || 0 }, uSat: { value: 1.22 }, uTerm: { value: new THREE.Vector4(...(b.term || [1.0, 0.72, 0.5, 0.3])) },
      uTday: { value: (FACTS[b.key].teq || 0) * (b.kind === 4 ? 1.25 : 1.2) }, uTnight: { value: (FACTS[b.key].teq || 0) * (b.kind === 4 ? 0.5 : 0.6) },
    },
    vertexShader: BODY_VS, fragmentShader: PLANET_FS, transparent: true,
  });
}
function starColor(T) {
  const c = bbColor(T); if (Math.abs(T - 5772) < 1) return new THREE.Color(1.0, 0.56, 0.12);   // the Sun: its familiar golden yellow (its light is white)
  const l = 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
  const k = T < 5772 ? 1 + 1.7 * clamp((5772 - T) / 2300, 0, 1) : 1 + 0.9 * clamp((T - 5772) / 6000, 0, 1);
  return new THREE.Color(Math.max(0, l + (c.r - l) * k), Math.max(0, l + (c.g - l) * k), Math.max(0, l + (c.b - l) * k));
}
function starMaterial(b) {
  const f = FACTS[b.key];
  return new THREE.ShaderMaterial({
    uniforms: { uColor: { value: starColor(f.T) }, uEmit: { value: 2.5 * Math.pow(f.T / 5772, 0.55) }, uCell: { value: b.cell }, uAmp: { value: b.amp }, uLimb: { value: new THREE.Vector2(...b.limb) },
      uSpots: { value: b.spots || 0 }, uSeed: { value: b.si * 3.7 }, uFade: { value: 1 }, uTime: { value: 0 },
      uLimbC: { value: b.key === 'sun' ? new THREE.Vector4(0.9, 0.22, 0.02, 1.9) : new THREE.Vector4(1.0, 0.82, 0.66, 0.35) } },
    vertexShader: BODY_VS, fragmentShader: STAR_FS, transparent: true,
  });
}
// Saturn's rings: measured radii (D, C, B, Cassini Division, A with the Encke gap, F), planet shadow on the rings
const RING_FS = `
  uniform vec3 uLightObj; uniform float uPolRatio; uniform float uFade; uniform vec3 uLightV;
  varying vec3 vObj; varying vec3 vNv; varying vec3 vPv;
  ${NOISE_GLSL}
  void main() {
    float rKm = length(vObj.xz) * 60268.0;
    float fw = fwidth(rKm) + 1e-3;
    // optical depth with every edge anti-aliased to the pixel size
    #define BAND(a, b, v) (v * clamp((rKm - a) / fw + 0.5, 0.0, 1.0) * clamp((b - rKm) / fw + 0.5, 0.0, 1.0))
    float o = BAND(66900.0, 74510.0, 0.03) + BAND(74658.0, 92000.0, 0.12) + BAND(92000.0, 117580.0, 0.85) + BAND(117580.0, 122170.0, 0.07)
            + BAND(122170.0, 133423.0, 0.58) + BAND(133745.0, 136775.0, 0.5) + BAND(140130.0, 140230.0, 0.35);
    // fine ringlets, averaged away once they are narrower than a pixel
    float fr = rKm / 180.0, vis = 1.0 - smoothstep(0.3, 0.8, fwidth(fr));
    o *= mix(1.0, 0.8 + 0.4 * vnoise(vec3(fr, 0.0, 0.0)), vis);
    vec3 alb = mix(vec3(0.62, 0.58, 0.52), vec3(0.86, 0.8, 0.68), smoothstep(92000.0, 110000.0, rKm) * (1.0 - step(117580.0, rKm)) + 0.7 * step(122170.0, rKm));
    alb = mix(alb, vec3(0.5, 0.48, 0.45), step(rKm, 92000.0));
    vec3 Lo = normalize(uLightObj);
    // planet shadow: does the ray toward the Sun hit the (flattened) globe?
    vec3 p = vec3(vObj.x, 0.0, vObj.z);                          // object space: the globe is the unit sphere
    float B = dot(p, Lo), C = dot(p, p) - 1.0; float disc = B * B - C;
    float sh = (disc > 0.0 && -B > 0.0) ? 0.06 : 1.0;
    float lit = 0.18 + 0.82 * abs(Lo.y) * 3.0;
    vec3 col = alb * vec3(1.0, 0.96, 0.9) * min(lit, 1.2) * sh * 1.2;
    gl_FragColor = vec4(col, clamp(o, 0.0, 1.0) * uFade);
  }`;

/* ---------- build the meshes ---------- */
const lineupGroup = new THREE.Group();
universe.add(lineupGroup);
const HALOS = [];
const tiltQuat = (tiltDeg, towardCam) => {       // spin axis tilted in the lineup's x–y plane, then turned toward the camera
  const ax = V3(Math.sin(tiltDeg * deg), Math.cos(tiltDeg * deg), 0).applyAxisAngle(V3(0, 1, 0), -(towardCam || 0));
  return new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), ax.normalize());
};
LINEUP.forEach(b => {
  const f = FACTS[b.key];
  const mat = b.star ? starMaterial(b) : planetMaterial(b);
  const mesh = new THREE.Mesh(GEO_HI, mat);
  const req = f.req || b.r, rpol = f.rpol || b.r;
  mesh.scale.set(req, rpol, req);
  mesh.position.copy(b.local);
  // orientation in the lineup frame: spin axis tilt, and a spin that puts the interesting face toward the camera/light
  const spin = { earth: 0.12, jupiter: 1.3, saturn: 0.4, neptune: 2.2, sun: 0 }[b.key] ?? (b.si * 1.3);
  const qt = b.key === 'saturn' ? new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), SATURN_AXIS)
    : b.tilt ? tiltQuat(b.tilt[0], b.tilt[1]) : (b.key === 'earth' ? tiltQuat(-23.4, -1.1) : new THREE.Quaternion());
  b.q0 = qt; b.spin0 = spin;
  mesh.quaternion.copy(qt).multiply(new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), spin));
  mesh.renderOrder = 10;
  b.mesh = mesh; lineupGroup.add(mesh);
  if (b.kind === 2) {                             // Saturn's rings, in the equatorial plane of the same object
    const rg = new THREE.RingGeometry(66900 / 60268, 140400 / 60268, 512, 1).rotateX(-Math.PI / 2);
    const rm = new THREE.ShaderMaterial({ uniforms: { uLightObj: mat.uniforms.uLightObj, uPolRatio: { value: rpol / req }, uFade: mat.uniforms.uFade, uLightV: mat.uniforms.uLightV },
      vertexShader: BODY_VS, fragmentShader: RING_FS, transparent: true, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(rg, rm);
    // ring geometry is in equatorial radii: as a child of the unit globe it inherits the km scale
    ring.renderOrder = 11;
    mesh.add(ring); b.ring = ring;
    mat.uniforms.uPolRatio.value = rpol / req;
  }
  if (!b.star && b.atm) {
    const [cr, cg, cb, thick, amt] = b.atm, teq = FACTS[b.key].teq || 0;
    const hm = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 0.8 }, uColor: { value: new THREE.Color(cr, cg, cb) }, uThick: { value: thick },
      uAmt: { value: amt * 1.35 }, uFade: mat.uniforms.uFade, uLightV: mat.uniforms.uLightV, uHeat: { value: heatGlowJS(teq * 1.2).multiplyScalar(1.1) },
      uAura: { value: b.aura ?? 1.0 }, uAxisV: { value: V3(0, 1, 0) }, uK: { value: 1 } },
      vertexShader: HALO_VS, fragmentShader: PLANET_HALO_FS, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), hm);
    halo.position.copy(b.local); halo.scale.setScalar(Math.max(f.req || b.r, b.r)); halo.renderOrder = 12; halo.frustumCulled = false;
    lineupGroup.add(halo); b.halo = halo;
  }
  if (b.star) {
    const lum = Math.log10(lumSun(b.key)), wL = 0.11 + 0.11 * lum;
    const hm = new THREE.ShaderMaterial({ uniforms: { uScale: { value: Math.max(b.halo ? 1.0 + b.halo : 1.3, 1 + 4.5 * wL) }, uColor: { value: starColor(f.T) }, uAmt: { value: b.halo ? 0.7 : 0.55 }, uLum: { value: lum },
      uDust: { value: b.dust ? 1 : (b.halo ? 0.35 : 0) }, uFade: mat.uniforms.uFade, uSeed: { value: b.si * 1.9 } },
      vertexShader: HALO_VS, fragmentShader: HALO_FS, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const halo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), hm);
    halo.position.copy(b.local); halo.scale.setScalar(b.r); halo.renderOrder = 12; halo.frustumCulled = false;
    lineupGroup.add(halo); b.halo = halo; HALOS.push(halo);
    if (b.key === 'sun') {
      const fm = new THREE.ShaderMaterial({ uniforms: { uScale: { value: 1.45 }, uTime: mat.uniforms.uTime, uFade: mat.uniforms.uFade, uErupt: { value: 0 } },
        vertexShader: HALO_VS, fragmentShader: SUN_FX_FS, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
      const fx = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), fm);
      fx.position.copy(b.local); fx.scale.setScalar(b.r); fx.renderOrder = 13; fx.frustumCulled = false;
      lineupGroup.add(fx); b.fx = fx;
    }
  }
});
lineupGroup.matrixAutoUpdate = false;
lineupGroup.matrix.copy(M_LINE);
TEX_READY.then(() => { BODY.earth.mesh.material.uniforms.uTex.value = TEX.earth; BODY.earth.mesh.material.uniforms.uTex2.value = TEX.night; BODY.jupiter.mesh.material.uniforms.uTex.value = TEX.jupiter;
  BODY.saturn.mesh.material.uniforms.uTex.value = TEX.saturn; BODY.neptune.mesh.material.uniforms.uTex.value = TEX.neptune; });

// the lineup's light: from the Sun's side (+x), a little above and toward the camera, so each disc shows its lit face
const LIGHT_LOCAL = V3(0.72, 0.2, 0.66).normalize();
const LINE_LIGHT = LIGHT_LOCAL.clone().applyMatrix4(new THREE.Matrix4().extractRotation(M_LINE));
const LINE_ROT = new THREE.Matrix4().extractRotation(M_LINE), LINE_ROT_INV = LINE_ROT.clone().transpose();
const _fwd = new THREE.Vector3(), _lv = new THREE.Vector3(), _lw = new THREE.Vector3(), _lb = new THREE.Vector3(), _q = new THREE.Quaternion(), _qs = new THREE.Quaternion(), _Y = V3(0, 1, 0);
const EXPO = { cover: 0, pcover: 0 };
// spherical interpolation between two unit vectors
function slerpV(out, a, b, s) {
  const d = clamp(a.dot(b), -0.9999, 0.9999), th = Math.acos(d), k = Math.sin(th);
  return out.copy(a).multiplyScalar(Math.sin((1 - s) * th) / k).addScaledVector(b, Math.sin(s * th) / k).normalize();
}
function updateBodies(ctx) {
  let cover = 0, pcover = 0;
  // ctx: { camPosKm (world, km), pxPerRad, standIn (0..1 visibility of the comparison stand-ins), frameArea,
  //        spin (0..1: the loop's phase, one turn per loop), intro(key) -> [presence 0..1, light swing 0..1] }
  for (const b of LINEUP) {
    const dist = ctx.camPosKm.distanceTo(b.pos);
    const px = b.r / Math.max(dist, 1e-9) * ctx.pxPerRad;             // radius in pixels
    b.px = px;
    const [pres, swing] = b.key !== 'earth' ? ctx.intro(b.key) : [1, 1];     // (stars: presence only)
    const fade = (b.key === 'sun' ? 1 : ctx.standIn) * pres;
    const vis = px > 0.35 && fade > 0.002;
    b.mesh.visible = vis;
    b.mesh.geometry = px > 90 ? GEO_HI : GEO_LO;
    const u = b.mesh.material.uniforms;
    u.uFade.value = fade * clamp01((px - 0.35) / 0.8);
    if (!b.star) {
      // a slow spin: exactly one turn per loop
      b.mesh.quaternion.copy(b.q0).multiply(_qs.setFromAxisAngle(_Y, b.spin0 + 2 * Math.PI * ctx.spin));
      // light: while a planet is introduced, the light swings from behind it (seen from the camera) to the Sun's side
      _lw.copy(LINE_LIGHT);
      if (swing < 1) { _lb.copy(b.pos).sub(ctx.camPosKm).normalize(); slerpV(_lw, _lb, LINE_LIGHT, smoother(swing)); }
      u.uLightV.value.copy(_lw).transformDirection(camera.matrixWorldInverse);
      // light direction in the body's object space (for ring shadows)
      _q.copy(b.mesh.quaternion).invert();
      const lo = u.uLightObj.value.copy(_lw).applyMatrix4(LINE_ROT_INV).applyQuaternion(_q);
      lo.y *= b.mesh.scale.x / b.mesh.scale.y; lo.normalize();       // into the unit-sphere object space of a flattened globe
    }
    if (b.halo) b.halo.visible = vis;
    if (b.fx) b.fx.visible = vis;
    if (b.star) u.uTime.value = ctx.tau;
    if (!b.star && b.halo && vis) {                                    // the halo follows the flattened outline
      const hu = b.halo.material.uniforms, f = FACTS[b.key], req = f.req || b.r, rpol = f.rpol || b.r;
      _lb.set(0, 1, 0).applyQuaternion(b.mesh.quaternion).applyMatrix4(LINE_ROT);           // spin axis, world
      hu.uAxisV.value.copy(_lb).transformDirection(camera.matrixWorldInverse);
      _lv.copy(b.pos).sub(ctx.camPosKm).normalize();                                             // line of sight, world
      const c = Math.abs(_lb.dot(_lv)), bApp = Math.sqrt(rpol * rpol * (1 - c * c) + req * req * c * c);
      hu.uK.value = req / bApp;
    }
    if (!b.star && vis && ctx.frameArea) {              // the part of the disc that is actually in view
      _fwd.copy(b.pos).applyMatrix4(universe.matrixWorld).project(camera);
      if (_fwd.z < 1) {
        const rn = 2 * px / Math.sqrt(ctx.frameArea), ox = Math.max(0, Math.min(1, _fwd.x + rn) - Math.max(-1, _fwd.x - rn)), oy = Math.max(0, Math.min(1, _fwd.y + rn) - Math.max(-1, _fwd.y - rn));
        pcover += Math.min(1, Math.PI * px * px / ctx.frameArea) * (ox * oy) / (4 * rn * rn) * u.uFade.value;
      }
    }
    // (a star counts toward the exposure only when some of it is in view)
    if (b.star && vis && ctx.frameArea && _fwd.copy(b.pos).sub(ctx.camPosKm).normalize().dot(ctx.camFwd) > Math.cos(Math.min(Math.PI, ctx.halfDiag + Math.asin(Math.min(1, b.r / dist)))))
      cover += Math.min(1, Math.PI * px * px / ctx.frameArea) * b.mesh.material.uniforms.uEmit.value * u.uFade.value;
  }
  EXPO.cover = cover; EXPO.pcover = pcover;
}
