
/* =====================================================================================
   5. MAP LAYERS — orbits, heliosphere, the Planet Nine hypothesis, interstellar clouds, arm tracings,
   Laniakea flow lines, proposed / measured superstructures, the observable-universe horizon.
   Lines, outlines and markers are annotations: they fade in and out with the story. The objects they point
   to are in place from the first frame.
   ===================================================================================== */
const LINE_MATS = [];
function lineMat(color, width, opacity = 1, dashed = false, dash = 1, gap = 1) {
  const m = new LineMaterial({ color, linewidth: width, transparent: true, opacity, dashed, dashSize: dash, gapSize: gap, depthWrite: false, worldUnits: false });
  m.userData.base = opacity; LINE_MATS.push(m); return m;
}
function polyline(pts, mat, parent) {
  const g = new LineGeometry(); g.setPositions(pts.flatMap(p => [p.x, p.y, p.z]));
  const l = new Line2(g, mat); l.computeLineDistances(); l.frustumCulled = false; l.renderOrder = 6; parent.add(l); return l;
}
function unitGroup(unitKm, rot = null) {
  const g = new THREE.Group(); g.matrixAutoUpdate = false; g.matrix.makeScale(unitKm, unitKm, unitKm);
  if (rot) g.matrix.premultiply(rot);
  universe.add(g); return g;
}
function keplerXYZ(a, e, iDeg, ODeg, wDeg, Mrad) {          // heliocentric ecliptic position (units of a)
  let E = Mrad; for (let k = 0; k < 12; k++) E = E - (E - e * Math.sin(E) - Mrad) / (1 - e * Math.cos(E));
  const xo = a * (Math.cos(E) - e), yo = a * Math.sqrt(1 - e * e) * Math.sin(E);
  const cw = Math.cos(wDeg * deg), sw = Math.sin(wDeg * deg), cO = Math.cos(ODeg * deg), sO = Math.sin(ODeg * deg), ci = Math.cos(iDeg * deg), si = Math.sin(iDeg * deg);
  return V3((cO * cw - sO * sw * ci) * xo + (-cO * sw - sO * cw * ci) * yo, (sO * cw + cO * sw * ci) * xo + (-sO * sw + cO * cw * ci) * yo, (sw * si) * xo + (cw * si) * yo);
}
const orbitPts = (a, e, i, O, w, n = 360) => Array.from({ length: n + 1 }, (_, k) => keplerXYZ(a, e, i, O, w, k / n * 2 * Math.PI).applyMatrix3(M_ECL2GAL));

/* ---------- planets: JPL approximate Keplerian elements (J2000), positions on 26 September 2026 ---------- */
// [a (AU), e, I (°), L (°), ϖ (°), Ω (°), dL/dcentury (°)]
const PLANET_EL = {
  mercury: [0.38710, 0.20563, 7.005, 252.251, 77.457, 48.331, 149472.674], venus: [0.72333, 0.00677, 3.395, 181.980, 131.602, 76.680, 58517.816],
  earth: [1.00000, 0.01671, 0.000, 100.464, 102.937, 0.0, 35999.373], mars: [1.52371, 0.09339, 1.850, 355.447, 336.041, 49.558, 19140.300],
  jupiter: [5.20289, 0.04839, 1.304, 34.397, 14.728, 100.474, 3034.746], saturn: [9.53668, 0.05386, 2.486, 49.954, 92.599, 113.662, 1222.494],
  uranus: [19.18916, 0.04726, 0.773, 313.238, 170.954, 74.017, 428.482], neptune: [30.06992, 0.00859, 1.770, 304.880, 44.965, 131.784, 218.459],
  pluto: [39.48212, 0.24883, 17.140, 238.929, 224.069, 110.304, 145.208],
};
const T_CENT = (2461309.5 - 2451545.0) / 36525;               // 2026-09-26, centuries from J2000
const solar = unitGroup(KM.AU);
const PLANET_AU = {};
const orbitMat = lineMat(0x9fb8cc, 1.4, 0.5), orbitMatDim = lineMat(0x8a9aa8, 1.3, 0.32, true, 0.6, 0.6);
Object.entries(PLANET_EL).forEach(([k, [a, e, I, L, wp, O, n]]) => {
  const w = wp - O, M = ((L + n * T_CENT - wp) % 360) * deg;
  polyline(orbitPts(a, e, I, O, w), k === 'pluto' ? orbitMatDim : orbitMat, solar);
  PLANET_AU[k] = keplerXYZ(a, e, I, O, w, M).applyMatrix3(M_ECL2GAL);
});
const PLANET_COL = { mercury: [0.75, 0.72, 0.68], venus: [0.95, 0.88, 0.7], earth: [0.45, 0.65, 1.0], mars: [1.0, 0.55, 0.38], jupiter: [0.95, 0.85, 0.7],
  saturn: [0.95, 0.88, 0.66], uranus: [0.65, 0.88, 0.9], neptune: [0.55, 0.72, 0.95], pluto: [0.8, 0.75, 0.7] };
const planetMarks = makeMarkers(Object.keys(PLANET_AU).map(k => ({ p: PLANET_AU[k], col: PLANET_COL[k] })), KM.AU, 3.2, 7);

/* ---------- heliosphere (visualisation: a blunt, tailward-stretched bubble; not a wall) ---------- */
const HELIO_NOSE = eclDir(255.4, 5.2);                         // upwind: interstellar flow arrives from here
const HELIO_FS = `
  uniform vec3 uColor; uniform float uFade; varying vec3 vNv; varying vec3 vPv;
  void main() { float f = clamp(1.0 - abs(dot(vNv / max(length(vNv), 1e-6), normalize(-vPv))), 0.0, 1.0); float a = pow(f, 7.0) * 0.16 + 0.0025;
    gl_FragColor = vec4(uColor * a * uFade, 1.0); }`;
function helioShell(rNose, tail, color) {
  const geo = new THREE.SphereGeometry(1, 96, 64), pos = geo.attributes.position;
  const q = new THREE.Quaternion().setFromUnitVectors(V3(0, 0, 1), HELIO_NOSE);
  for (let k = 0; k < pos.count; k++) {
    const v = V3(pos.getX(k), pos.getY(k), pos.getZ(k));
    const c = v.z;                                               // cos(angle from the nose)
    const r = rNose * (1 + tail * Math.pow((1 - c) / 2, 1.8));
    v.multiplyScalar(r).applyQuaternion(q); pos.setXYZ(k, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  const mat = new THREE.ShaderMaterial({ uniforms: { uColor: { value: new THREE.Color(color) }, uFade: { value: 0 } },
    vertexShader: `varying vec3 vNv; varying vec3 vPv; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vPv = mv.xyz; vNv = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: HELIO_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, mat); m.renderOrder = 8; m.frustumCulled = false; solar.add(m); return m;
}
const termShock = helioShell(90, 0.9, 0x6f8fb0), helioPause = helioShell(121, 1.5, 0x9ab4cf);
// Voyager 1 and 2: real directions, approximate present distances, and their paths out of the planets' region
const VOY = FACTS.voyager.map(v => eqDir(v.ra, v.dec).multiplyScalar(v.d));
const voyMarks = makeMarkers(VOY.map(p => ({ p, col: [1.0, 0.9, 0.6] })), KM.AU, 3.0, 7);
const voyMat = lineMat(0xffe2a0, 1.0, 0.6, true, 3, 3);
VOY.forEach(p => polyline([V3(0, 0, 0), p], voyMat, solar));

/* ---------- Planet Nine: a proposed orbit (Batygin & Brown 2016), position unknown ---------- */
const P9 = FACTS.p9, p9Mat = lineMat(0xffd28c, 1.3, 0.9, true, 18, 12);
polyline(orbitPts(P9.a, P9.e, P9.i, P9.O, P9.w, 720), p9Mat, solar);
const P9_POS = keplerXYZ(P9.a, P9.e, P9.i, P9.O, P9.w, Math.PI * 0.92).applyMatrix3(M_ECL2GAL);
const p9Mark = makeMarkers([{ p: P9_POS, col: [0.55, 0.62, 0.72] }], KM.AU, 4.5, 7);

/* ---------- interstellar clouds near the Sun (pc): Local Bubble shell, Radcliffe Wave, named clouds ---------- */
const lb = (() => {
  const rnd = mulberry32(1717), P = [], S = [], B = [], C = [];
  const add = (v, s, b, c) => { P.push(v.x, v.y, v.z); S.push(s); B.push(b); C.push(...c); };
  // dense star-forming clouds on the bubble's surface (Zucker et al. 2022): Taurus, Ophiuchus, Lupus, Chamaeleon, Musca, CrA, Pipe
  [[172, -15, 140], [353, 17, 140], [339, 16, 155], [297, -16, 190], [301, -9, 170], [0, -18, 150], [0, 5, 145]].forEach(([l, b, d]) => {
    const c = galDir(l, b).multiplyScalar(d);          // measured distances (pc) of the clouds
    for (let k = 0; k < 70; k++) add(c.clone().add(V3(gauss(rnd), gauss(rnd), gauss(rnd)).multiplyScalar(6)), 2 + rnd() * 4, 0.06, [0.92, 0.9, 0.86]);
  });
  // the Radcliffe Wave (Alves et al. 2020): quadratic spine through the fitted anchors, damped vertical sinusoid, ~60 pc scatter
  const A0 = V3(-910, -860, -30), A1 = V3(-270, 20, 10), A2 = V3(290, 1400, 30);
  const Q = A1.clone().multiplyScalar(2).sub(A0.clone().add(A2).multiplyScalar(0.5));
  const spine = t => A0.clone().multiplyScalar((1 - t) * (1 - t)).add(Q.clone().multiplyScalar(2 * t * (1 - t))).add(A2.clone().multiplyScalar(t * t));
  const NS = 400, sp = [], sArc = [0];
  for (let k = 0; k <= NS; k++) { sp.push(spine(k / NS)); if (k) sArc.push(sArc[k - 1] + sp[k].distanceTo(sp[k - 1])); }
  let kc = 0; for (let k = 0; k <= NS; k++) if (sp[k].length() < sp[kc].length()) kc = k;          // nearest point ≈ where it crosses the plane
  const sC = sArc[kc], Pw = 2000, Aw = 160;
  const waveZ = s => Aw * Math.sin(2 * Math.PI * (s - sC) / Pw) * Math.exp(-Math.max(0, s - sC - 500) / 1400) * Math.exp(-Math.max(0, sC - 700 - s) / 1400);
  const RW = sp.map((p, k) => V3(p.x, p.y, p.z + waveZ(sArc[k])));
  for (let k = 0; k < 1500; k++) {
    const j = Math.floor(rnd() * NS), c = RW[j];
    add(c.clone().add(V3(gauss(rnd), gauss(rnd), gauss(rnd)).multiplyScalar(32)), 4 + rnd() * 7, 0.05 + 0.03 * rnd(), [0.84, 0.88, 0.96]);
  }
  const cloud = makeCloud({ positions: new Float32Array(P), sizes: new Float32Array(S), brights: new Float32Array(B), colors: new Float32Array(C),
    unitKm: KM.PC, minPx: 1.4, maxPx: 90, gain: 0, order: 4, shape: 'disc' });
  cloud.RW = RW; cloud.kc = kc;
  return cloud;
})();
const LB_R = dir => { const lw = Math.atan2(dir.y, dir.x), bz = dir.z;       // radius (pc) of the bubble's skin in a direction
  const wob = 0.1 * Math.sin(5 * lw + 2 * bz + 0.7) + 0.07 * Math.sin(7 * lw - 3 * bz + 2.1) + 0.06 * Math.cos(3 * bz * 3.1 + lw);
  return 160 * (1 + 0.2 * Math.cos(lw - 240 * deg) + wob) * (1 + 0.3 * bz * bz); };
const lbSkin = (() => {
  const geo = new THREE.SphereGeometry(1, 128, 96), pos = geo.attributes.position;
  for (let k = 0; k < pos.count; k++) { const v = V3(pos.getX(k), pos.getY(k), pos.getZ(k)); v.multiplyScalar(LB_R(v)); pos.setXYZ(k, v.x, v.y, v.z); }
  geo.computeVertexNormals();
  // the poles of a sphere mesh share degenerate triangles: give any zero-length normal the radial direction (a zero
  // normal would normalise to NaN in the shader, and the bloom would spread that pixel into a black block)
  const nrm = geo.attributes.normal;
  for (let k = 0; k < nrm.count; k++) { const n = V3(nrm.getX(k), nrm.getY(k), nrm.getZ(k)); if (n.lengthSq() < 1e-12) { n.set(pos.getX(k), pos.getY(k), pos.getZ(k)).normalize(); nrm.setXYZ(k, n.x, n.y, n.z); } }
  const mat = new THREE.ShaderMaterial({ uniforms: { uFade: { value: 0 } },
    vertexShader: `varying vec3 vNv; varying vec3 vPv; varying vec3 vObj; void main() { vObj = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vPv = mv.xyz; vNv = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uFade; varying vec3 vNv; varying vec3 vPv; varying vec3 vObj;
      ${NOISE_GLSL}
      void main() { vec3 N = vNv / max(length(vNv), 1e-6); float f = clamp(1.0 - abs(dot(N, normalize(-vPv))), 0.0, 1.0);   // (pow of a tiny negative is NaN)
        float n = fbm(vObj / 38.0, 4); float fil = smoothstep(0.52, 0.72, n);
        float open_ = smoothstep(0.92, 0.7, abs(normalize(vObj).z));           // open toward the Galactic poles (a 'chimney')
        float a = (pow(f, 2.2) * 0.3 + 0.05) * (0.25 + 1.3 * fil) * open_;
        gl_FragColor = vec4(vec3(0.55, 0.7, 0.95) * a * 0.24 * uFade, 1.0); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const m = new THREE.Mesh(geo, mat); m.renderOrder = 8; m.frustumCulled = false;
  const g = unitGroup(KM.PC); g.add(m); return m;
})();
const rwMat = lineMat(0xbfe0ff, 1.4, 0.0, true, 40, 26);
const rwGroup = unitGroup(KM.PC);
polyline(lb.RW, rwMat, rwGroup);

/* ---------- Milky Way arm tracings (Reid et al. 2019, R0 = 8.15 kpc), galactocentric kpc ---------- */
const armGroup = unitGroup(KM.KPC);
const ARM_LINES = ARMS.map(A => {
  const pts = []; for (let b = A.b0; b <= A.b1; b += 1) pts.push(armXYZ(armR(A, b), b));
  const m = lineMat(A.col, 1.0, 0, true, 0.25, 0.2);
  A.mat = m; polyline(pts, m, armGroup); A.mid = armXYZ(armR(A, (A.b0 + A.b1) / 2), (A.b0 + A.b1) / 2); return A;
});
const LOCAL_ARM = ARMS[3];

/* ---------- Laniakea (Tully et al. 2014): illustrative flow lines converging on the Great Attractor region ---------- */
const GA = galDir(325.3, -7.3).multiplyScalar(4871 / 70);            // Norma cluster, cz = 4871 km/s, Mpc
const lanGroup = unitGroup(KM.MPC);
const lanMat = new LineMaterial({ color: 0xffffff, linewidth: 1.2, transparent: true, opacity: 0, vertexColors: true, depthWrite: false, blending: THREE.AdditiveBlending, worldUnits: false });
lanMat.userData.base = 0.9; LINE_MATS.push(lanMat);
{
  // an illustrative flow field: attraction toward the Great Attractor region, with the Centaurus, Hydra and Virgo
  // clusters bending the paths on the way (positions real, strengths chosen for the picture)
  const czMpc = (l, b, cz) => galDir(l, b).multiplyScalar(cz / 70);
  const ATT = [[GA, 6.0], [czMpc(302.4, 21.6, 3418), 2.0], [czMpc(269.6, 26.5, 3777), 1.4], [eqDir(187.7059, 12.3911).multiplyScalar(16.5), 0.9]];
  const PP = czMpc(150, -13, 5000);                                   // Perseus–Pisces: the neighbouring basin (flows there are not Laniakea's)
  const vel = p => { const v = V3(0, 0, 0); ATT.forEach(([c, m]) => { const d = c.clone().sub(p), r = Math.max(d.length(), 6); v.addScaledVector(d, m / (r * r * r) * 1e4); });
    const dq = PP.clone().sub(p), rq = Math.max(dq.length(), 6); v.addScaledVector(dq, 4.0 / (rq * rq * rq) * 1e4); return v; };
  const rnd = mulberry32(777), C0 = GA.clone().multiplyScalar(0.5), gold = new THREE.Color(0xf2c36b);
  let made = 0;
  for (let k = 0; k < 400 && made < 64; k++) {
    let p = k === 0 ? V3(0, 0, 0) : C0.clone().add(V3(gauss(rnd) * 55, gauss(rnd) * 45, gauss(rnd) * 28));
    const pts = [p.clone()];
    for (let st = 0; st < 260; st++) {
      const v = vel(p), sp = v.length(); if (sp < 1e-9) break;
      p = p.clone().addScaledVector(v, Math.min(1.2, 60 / sp) / sp * sp / sp);  // ~1.2 Mpc steps
      pts.push(p);
      if (p.distanceTo(GA) < 5 || p.distanceTo(PP) < 25) break;
    }
    if (pts[pts.length - 1].distanceTo(GA) > 8 || pts.length < 12) continue;      // keep only paths that end in the attractor basin
    const g = new LineGeometry(); g.setPositions(pts.flatMap(q => [q.x, q.y, q.z]));
    // brightness along each line: rises from its start, fades out before the lines pile up at the attractor
    const cols = []; pts.forEach((q, i) => { const u = i / (pts.length - 1), f = smoother(clamp01(u / 0.3)) * smoother(clamp01((q.distanceTo(GA) - 6) / 30)); cols.push(gold.r * f, gold.g * f, gold.b * f); });
    g.setColors(cols);
    const l = new Line2(g, lanMat); l.frustumCulled = false; l.renderOrder = 6; lanGroup.add(l); made++;
  }
}
/* ---------- Pisces–Cetus supercluster complex: a proposed structure (Tully 1987) — dashed outline only ---------- */
const pcGroup = unitGroup(KM.MPC);
const pcMat = lineMat(0xd6c2ff, 1.6, 0, true, 14, 10);
{
  const axisEnd = eqDir(7.5, -10).multiplyScalar(250), c = axisEnd.clone().multiplyScalar(0.5);
  const u = axisEnd.clone().normalize(), v = V3(0, 0, 1).cross(u).normalize(), w = u.clone().cross(v).normalize();
  const L = 153, W = 23;                                                // half-length ~ 0.5 Gly, half-width ~ 75 Mly (Mpc)
  [v, w].forEach(side => {
    const pts = []; for (let k = 0; k <= 180; k++) { const a = k / 180 * 2 * Math.PI; pts.push(c.clone().addScaledVector(u, Math.cos(a) * L).addScaledVector(side, Math.sin(a) * W)); }
    polyline(pts, pcMat, pcGroup);
  });
}
/* ---------- five superstructures from X-ray clusters (Böhringer et al. 2025), Quipu highlighted ---------- */
const SS_COL = { 1: [1.0, 0.45, 0.3], 2: [0.5, 0.7, 1.0], 3: [0.55, 0.9, 0.6], 4: [0.8, 0.6, 1.0], 5: [0.95, 0.85, 0.5] };
const ssGroup = unitGroup(KM.MPC);
const quipuMat = lineMat(0xff7a55, 1.6, 0), ssMat = lineMat(0x9aa8ba, 1.0, 0);
const ssMarks = makeMarkers(DATA_SUPER.map(c => ({ p: V3(c[1], c[2], c[3]), col: SS_COL[c[0]], a: c[0] === 1 ? 1 : 0.55 })), KM.MPC, 2.6, 7);
const QUIPU_C = V3(0, 0, 0);
{
  for (let s = 1; s <= 5; s++) {                                        // minimal spanning tree of each structure's clusters
    const P = DATA_SUPER.filter(c => c[0] === s).map(c => V3(c[1], c[2], c[3]));
    if (s === 1) { P.forEach(p => QUIPU_C.add(p)); QUIPU_C.multiplyScalar(1 / P.length); }
    const inT = new Array(P.length).fill(false), best = new Array(P.length).fill(Infinity), from = new Array(P.length).fill(-1);
    inT[0] = true; P.forEach((p, i) => { if (i) { best[i] = p.distanceTo(P[0]); from[i] = 0; } });
    for (let n = 1; n < P.length; n++) {
      let j = -1; for (let i = 0; i < P.length; i++) if (!inT[i] && (j < 0 || best[i] < best[j])) j = i;
      inT[j] = true; polyline([P[from[j]], P[j]], s === 1 ? quipuMat : ssMat, ssGroup);
      P.forEach((p, i) => { if (!inT[i]) { const d = p.distanceTo(P[j]); if (d < best[i]) { best[i] = d; from[i] = j; } } });
    }
  }
}
/* ---------- the observable universe: a horizon, drawn as a faint limb, not a surface ---------- */
const OBS_R_GLY = FACTS.obsUniverse / 2 / 1e9;
const obsMat = new THREE.ShaderMaterial({ uniforms: { uFade: { value: 0 } },
  vertexShader: `varying vec3 vNv; varying vec3 vPv; void main() { vec4 mv = modelViewMatrix * vec4(position, 1.0); vPv = mv.xyz; vNv = normalize(normalMatrix * normal); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uFade; varying vec3 vNv; varying vec3 vPv;
    void main() { float f = 1.0 - abs(dot(normalize(vNv), normalize(-vPv))); float a = smoothstep(0.9, 1.0, f) * 0.28;
      gl_FragColor = vec4(vec3(0.62, 0.78, 1.0) * a * uFade, 1.0); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.FrontSide });
const obsGroup = unitGroup(KM.GLY);
const obsSphere = new THREE.Mesh(new THREE.SphereGeometry(OBS_R_GLY, 128, 64), obsMat);
obsSphere.renderOrder = 9; obsSphere.frustumCulled = false; obsGroup.add(obsSphere);
