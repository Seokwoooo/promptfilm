/* =====================================================================================
   8. MASTER TIMELINE — every pose is a pure function of authored time τ. Nothing accumulates between frames.
   The film fades in from black on Earth and fades out to black on the observable universe, so the loop seam is
   black on both sides.
   ===================================================================================== */
const FOV = 40, FOV_HERO = 45;
const fieldToD = (f, fov = FOV) => f / (2 * Math.tan(fov * deg / 2));
const KEYS = [];
// key in the lineup frame (x, y in lineup km); field = width of the view at the target
function keyL(t, x, y, field, yaw = 0, pitch = 4, flow = true, fov = FOV) {
  KEYS.push({ t, T: linePoint(x, y), D: fieldToD(field, fov), q: oriQuat('line', yaw, pitch), fov, flow });
}
function keyW(t, Tworld, field, frame, yaw, pitch, flow = true, fov = FOV) {
  KEYS.push({ t, T: Tworld.clone(), D: fieldToD(field, fov), q: oriQuat(frame, yaw, pitch), fov, flow });
}
const B = BODY, base = LINE_BASE_Y;
const LCAPS = [], TAGS_DEF = [], CALLOUTS = [];
const LEADER_DEF = [];     // rings + leader lines + names for bodies too small to see well: { body, en, ko, wins: [[t0, t1], ...] }
const leaderFor = (body, en, ko) => { let d = LEADER_DEF.find(l => l.body === body); if (!d) { d = { body, en, ko, wins: [] }; LEADER_DEF.push(d); } return d; };
// --- the lineup, body by body ---------------------------------------------------------------
const SEQ = LINEUP_SEQ;
const cy = b => base + b.r;                                             // centre height
const hw = b => (b.key === 'saturn' ? FACTS.saturn.ring[7] * 1.04 : b.r);   // half-width in the row
const topOf = b => (b.key === 'saturn' ? b.r + SATURN_RING_TOP : 2 * b.r);   // height above the line
// is a camera pose (lineup frame, x, y, field, yaw, pitch) safely outside every body (and clear of Saturn's rings)?
function poseClear(x, y, field, yaw, pitch, fov = FOV) {
  const T = linePoint(x, y), D = fieldToD(field, fov), e = eyeDir('line', yaw, pitch);
  const P = T.clone().addScaledVector(e, D);
  return LINEUP.every(bb => P.distanceTo(bb.pos) > (bb.key === 'saturn' ? FACTS.saturn.ring[7] * 1.08 : (FACTS[bb.key].req || bb.r) * 1.12));
}
// the comparison view after each reveal: Earth, the new body and everything between them in the row. The row's line
// sits at 60% of the height, above the caption band; the new body sits near the right edge, so the next body — just
// beyond it — is out of view.
const shown = new Set(['earth']);
function compFrame(b) {
  const L = B.earth.x - hw(B.earth), R = b.x + hw(b) * (b.star ? 1.1 : 1.0);   // (a big star looks wider in perspective)
  const inside = [...shown].map(k => B[k]).filter(o => o.x + hw(o) >= L - 1 && o.x - hw(o) <= R + 1);
  const Hmax = Math.max(...inside.map(topOf)), tallest = inside.reduce((m, o) => (topOf(o) > topOf(m) ? o : m), inside[0]);
  const W = R - L, f = Math.max(W * 1.1, Hmax / 0.54);
  // the new body at the right edge (spare room goes left); the margin stays well inside the gap to the next body in the
  // row, which is not in view yet
  const next = LINEUP[b.i + 1];
  let m = 0.045;
  if (next) m = clamp(0.4 * ((next.x - hw(next)) - (b.x + hw(b))) / f, 0.008, 0.045);
  const x = R + m * f - 0.5 * f;
  return { x, y: base + 0.1 * f, f, tallest };
}
// the first look at a new body: the whole globe in view (about half the frame), from a little to its left (for a planet
// the terminator crosses the disc); never more than 2.2× closer than the view before it nor 3.5× from the comparison
// after it, so the moves stay gentle.
// (The next, larger body is not drawn yet, so nothing looms behind it.)
const MAX_ZOOM = 2.2, MAX_OUT = 3.5;
function heroPlanet(b, p, prevF, C) {
  const s = b.x > p.x ? -1 : 1;
  let x = b.x, y = cy(b) + 0.08 * b.r, f = Math.max(b.r * 4.2, prevF / MAX_ZOOM, C.f / MAX_OUT), yaw = -16, pitch = 3;
  if (b.key === 'saturn') { f = Math.max(hw(b) * 3.0, prevF / MAX_ZOOM, C.f / MAX_OUT); y = cy(b) + 0.1 * b.r; yaw = -12; pitch = 5; }
  if (b.star) { yaw = -10; pitch = 4; }
  while (!poseClear(x, y, f, yaw, pitch, FOV_HERO)) f *= 1.06;
  return { x, y, f, yaw, pitch, s };
}
const STEP = {};          // key -> { tA: approach starts, tH: first look, tS: reveal starts, tB: comparison view, tE: step ends }
const INTRO = {};         // planet key -> [t0, t1]: dark until t0, the light swings on until t1
let t = 0;
// opening: Earth, close enough to read continents and clouds, from the Sun's side (the day face)
keyL(0.0, B.earth.x, cy(B.earth), EARTH_D * 1.4, 26, 4);
keyL(7.0, B.earth.x + 700, cy(B.earth), EARTH_D * 1.62, 10, 4);
LCAPS.push([0.7, 4.3, 'How big can things get?', 'From Earth to the edge of the observable universe', '(얼마나 커질 수 있을까? — 지구에서 관측 가능한 우주의 끝까지)']);
LCAPS.push([4.3, 7.9, 'Earth', `${fmtInt(EARTH_D)} km across · each world that follows stands beside it at true scale`, `(지구 — 지름 ${fmtInt(EARTH_D)}km · 이제부터 모든 천체를 실제 크기 비율로 지구 옆에 세웁니다)`]);
t = 7.0;
let prevF = EARTH_D * 1.62;
for (let i = 1; i < SEQ.length; i++) {
  const b = B[SEQ[i]], p = B[SEQ[i - 1]];
  const tA0 = t;
  shown.add(b.key);
  const C = compFrame(b);
  let tH, tS, fS;
  {
    // the first look at the new body, planet or star alike: centred and whole, then a slow push-in
    const H = heroPlanet(b, p, prevF, C);
    const aD = clamp(0.8 + 0.3 * Math.abs(Math.log(prevF / H.f)), i === 1 ? 1.4 : 1.1, 1.7);
    tH = tA0 + aD;
    const CREEP = b.star ? 0.9 : 1.15;           // a held breath
    keyL(tH, H.x, H.y, H.f, H.yaw, H.pitch, true, FOV_HERO);
    keyL(tH + CREEP, H.x, H.y, H.f * 0.96, H.yaw + 1.5, H.pitch + 0.5, true, FOV_HERO);
    INTRO[b.key] = [0, tH + CREEP];               // (start set below: once the previous view has settled)
    tS = tH + CREEP; fS = H.f * 0.96;
  }
  // the reveal: a fast pull-back that settles slowly (front-loaded), swinging square to the row
  const zoom = C.f / fS;
  const rD = clamp(1.0 + 0.32 * Math.log(Math.max(zoom, 1.2)), 1.35, 2.0);
  const tB = tS + rD;
  keyL(tB, C.x, C.y, C.f, 0, 5, false); KEYS[KEYS.length - 1].ease = 'reveal';
  let tE = Math.max(tB + (b.star ? 0.6 : 0.45), tA0 + 3.65);
  if (b.key === 'vycma') tE = tB + 2.0;
  keyL(tE, C.x, C.y, C.f * 0.985, 0, 5);                      // a slight push-in: nothing new drifts into view
  STEP[b.key] = { tA: tA0, tH, tS, tB, tE };
  const ref = b.star && b.key !== 'sun' ? B.sun : B.earth;
  CALLOUTS.push({ t0: tB - 0.55, t1: tE + 0.25, big: b, ref, ratio: b.r / ref.r, others: [...shown].filter(k => k !== b.key).map(k => B[k]),
    side: C.tallest === b ? 'left' : 'above' });
  leaderFor(B.earth, 'Earth', '지구').wins.push([tB - 0.45, tE + 0.2]);
  if (b.star && b.key !== 'sun') leaderFor(B.sun, 'The Sun', '태양').wins.push([tB - 0.45, tE + 0.2]);
  if (['hd189733b', 'hatp67b'].includes(b.key)) leaderFor(B.jupiter, 'Jupiter', '목성').wins.push([tB - 0.45, tE + 0.2]);
  prevF = C.f * 1.03;
  t = tE;
}
const T_LINEUP_END = t;
const EARTH_LEADER = leaderFor(B.earth, 'Earth', '지구');
// the stars are there only from their neighbour's comparison view on (then just outside the frame), so no star far down
// the row glows into the planets' close-ups
// likewise each planet appears once the previous comparison view has settled, while it is still just outside that view
SEQ.forEach((k, i) => { if (i === 0) return; const tp = i === 1 ? 0 : STEP[SEQ[i - 1]].tB;
  INTRO[k] = B[k].star ? [tp - 0.1, STEP[k].tA + 0.5] : [tp + 0.02, Math.max(INTRO[k][1], tp + 0.5)]; });

// --- captions for the lineup bodies (one per body, from the first look until the next body's first look) ---
const xE = k => { const v = FACTS[k].r / KM.RE; return v < 10 ? v.toFixed(1) : fmtInt(v); }, xJ = k => (FACTS[k].r / KM.RJ).toFixed(2).replace(/0$/, ''), xS = k => fmtInt(xSun(k));
const K10 = k => fmtInt(Math.round(FACTS[k].teq / 10) * 10);
// a star's light output (L ∝ R² T⁴) as text, rounded to two significant digits: [English, Korean]
function lumTxt(k) {
  const L = lumSun(k), p = Math.pow(10, Math.floor(Math.log10(L)) - 1), r = Math.round(L / p) * p;
  const ko = r >= 1e4 ? `${+(r / 1e4).toFixed(r >= 1e5 ? 0 : 1)}만 배` : `약 ${fmtInt(r)}배`;
  return [`~${fmtInt(r)}×`, r >= 1e4 ? '약 ' + ko : ko];
}
const BODY_CAP = {
  neptune: ['Neptune', `${xE('neptune')}× Earth · the smallest of the giant planets`, `(해왕성 — 지구 지름의 ${xE('neptune')}배 · 거대 행성 중 가장 작음)`],
  uranus: ['Uranus', `${xE('uranus')}× Earth · tipped on its side (98°)`, `(천왕성 — 지구의 ${xE('uranus')}배 · 자전축이 98° 기울어 누워 있음)`],
  saturn: ['Saturn', `${xE('saturn')}× Earth · its main rings span ${fmtInt(2 * FACTS.saturn.ring[6] / 1000)},000 km`, `(토성 — 지구의 ${xE('saturn')}배 · 주 고리 지름 약 ${fmtInt(2 * FACTS.saturn.ring[6] / 1e4)}만km)`],
  jupiter: ['Jupiter', `${xE('jupiter')}× Earth · more than 1,300 Earths would fit inside`, `(목성 — 지구의 ${xE('jupiter')}배 · 부피로는 지구 1,300개 이상)`],
  hd189733b: ['HD 189733 b', `Now, planets of other stars · ${xJ('hd189733b')}× Jupiter · a deep blue (Hubble)`, `(이제 다른 별의 행성들 — HD 189733 b · 목성의 ${xJ('hd189733b')}배 · 허블이 측정한 짙은 파란색)`],
  hatp67b: ['HAT-P-67 b', `${xJ('hatp67b')}× Jupiter · one of the largest planets known · puffed up by its star's heat`, `(HAT-P-67 b — 목성의 ${xJ('hatp67b')}배 · 알려진 가장 큰 행성 중 하나 · 별의 열로 부풀어 오름)`],
  sun: ['The Sun', `${(2 * FACTS.sun.r / 1e6).toFixed(2)} million km · ${fmtInt(2 * FACTS.sun.r / EARTH_D)}× Earth · seen as a hydrogen-alpha solar telescope shows it`, `(태양 — 지름 약 ${Math.round(2 * FACTS.sun.r / 1e4)}만km · 지구의 ${fmtInt(2 * FACTS.sun.r / EARTH_D)}배 · H-알파 태양 망원경으로 본 모습처럼 표현)`],
  siriusA: ['Sirius A', `${xSun('siriusA').toFixed(1)}× the Sun · ${lumTxt('siriusA')[0]} its light · the brightest star in our night sky`, `(시리우스 A — 태양의 ${xSun('siriusA').toFixed(1)}배 · 밝기 ${lumTxt('siriusA')[1]} · 밤하늘에서 가장 밝은 별)`],
  arcturus: ['Arcturus', `${xS('arcturus')}× the Sun · ${lumTxt('arcturus')[0]} its light · an orange giant`, `(아르크투루스 — 태양의 ${xS('arcturus')}배 · 밝기 ${lumTxt('arcturus')[1]} · 주황색 거성)`],
  aldebaran: ['Aldebaran', `${xS('aldebaran')}× the Sun · ${lumTxt('aldebaran')[0]} its light · the red eye of Taurus`, `(알데바란 — 태양의 ${xS('aldebaran')}배 · 밝기 ${lumTxt('aldebaran')[1]} · 황소자리의 붉은 눈)`],
  rigel: ['Rigel', `${xS('rigel')}× the Sun · ${lumTxt('rigel')[0]} its light · hot (~${fmtInt(FACTS.rigel.T)} K), so blazing`, `(리겔 — 태양의 ${xS('rigel')}배 · 밝기 ${lumTxt('rigel')[1]} · 약 ${fmtInt(FACTS.rigel.T)}K로 뜨거워 눈부신 청백색 초거성)`],
  deneb: ['Deneb', `${xS('deneb')}× the Sun · ${lumTxt('deneb')[0]} its light · surfaces illustrative`, `(데네브 — 태양의 ${xS('deneb')}배 · 밝기 ${lumTxt('deneb')[1]} · 별 표면 무늬는 상상도)`],
  betelgeuse: ['Betelgeuse', `~${xS('betelgeuse')}× the Sun · ${lumTxt('betelgeuse')[0]} its light · cool (~3,600 K) but vast`, `(베텔게우스 — 태양의 약 ${xS('betelgeuse')}배 · 밝기 ${lumTxt('betelgeuse')[1]} · 표면은 차갑지만(약 3,600K) 거대한 적색초거성)`],
  antares: ['Antares', `~${xS('antares')}× the Sun · ${lumTxt('antares')[0]} its light · a red supergiant too`, `(안타레스 — 태양의 약 ${xS('antares')}배 · 밝기 ${lumTxt('antares')[1]} · 역시 적색초거성)`],
  vycma: ['VY Canis Majoris', '', ''],
};
{
  const s = STEP.vycma, C = compFrame(B.vycma), px = 1000 * EARTH_D / C.f;
  BODY_CAP.vycma[1] = `~${xS('vycma')}× the Sun · ${lumTxt('vycma')[0]} its light · Earth, far left: ${px.toFixed(3)} px of 1,000`;
  BODY_CAP.vycma[2] = `(큰개자리 VY — 태양의 약 ${xS('vycma')}배 · 밝기 ${lumTxt('vycma')[1]} · 맨 왼쪽 지구는 1,000픽셀 중 ${px.toFixed(3)}픽셀)`;
}
SEQ.slice(1).forEach((k, i) => {
  const s = STEP[k], next = STEP[SEQ[i + 2]];
  const t0 = s.tA + 0.9, t1 = next ? next.tA + 0.9 : s.tE + 0.35;
  LCAPS.push([t0, t1, ...BODY_CAP[k]]);
});

// --- from the lineup to the map ------------------------------------------------------------
const SUN0 = V3(0, 0, 0);
const F_REC = compFrame(B.vycma).f;
const MAP = [];               // [name, arrive τ, leave τ]
const MAPCAPS = [];           // [arrive τ, caption]
// a key from an explicit camera position (world km) looking at T, with Galactic north up
function keyPos(t, eye, T, flow = true, fov = FOV) {
  const d = eye.clone().sub(T), D = d.length();
  _lm.lookAt(d.clone().normalize(), V3(0, 0, 0), V3(0, 0, 1));
  KEYS.push({ t, T: T.clone(), D, q: new THREE.Quaternion().setFromRotationMatrix(_lm), fov, flow });
}
function mapScene(name, dur, zoomTime, T, field, frame, yaw, pitch, cap, opts = {}) {
  const tA = t + zoomTime, tB = tA + dur;
  if (opts.eye) {
    keyPos(tA, opts.eye, T);
    const e2 = T.clone().add(opts.eye.clone().sub(T).multiplyScalar(1.03)).addScaledVector(opts.drift || V3(0, 0, 0), 1);
    keyPos(tB, e2, T);
  } else {
    keyW(tA, T, field, frame, yaw, pitch);
    keyW(tB, T, field * 1.035, frame, yaw + 1.5, pitch);
  }
  if (opts.reveal) KEYS[KEYS.length - 2].ease = 'reveal';
  if (cap) MAPCAPS.push([opts.capAt ?? tA - 0.6, cap]);
  MAP.push([name, tA, tB]); t = tB;
  return [tA, tB];
}
const PC = KM.PC, LYk = KM.LY;
const at = (pc) => pc.clone().multiplyScalar(PC);
keyW(t + 1.6, linePoint(B.vycma.x * 0.35, 0), F_REC * 1.9, 'line', 6, 26);
t += 1.6;
const [s60a, s60b] = mapScene('planets', 1.8, 1.9, SUN0, 75 * KM.AU, 'ecl', 20, 57,
  ['The planets’ realm', `From here on, a map: everything at its real place · Neptune’s orbit is ${2 * Math.round(FACTS.neptuneA)} AU across`, `(이제부터는 실제 위치의 지도 — 해왕성 궤도의 폭은 약 ${2 * Math.round(FACTS.neptuneA)}AU(90억km))`], { capAt: T_LINEUP_END + 0.35 });
const [skA, skB] = mapScene('kuiper', 2.1, 1.6, SUN0, 150 * KM.AU, 'ecl', 34, 52,
  ['The Kuiper belt', 'Icy bodies 30–50 AU from the Sun · objects illustrative', '(카이퍼 벨트 — 태양에서 30~50AU의 얼음 천체들 · 개별 천체는 설명용)']);
const [shA, shB] = mapScene('helio', 1.9, 1.8, SUN0, 520 * KM.AU, 'ecl', 70, 28,
  ['The heliosphere', 'The solar wind’s bubble · the Voyagers crossed its edge near 120 AU', '(태양권 — 태양풍이 만든 거품 · 보이저호가 약 120AU에서 경계를 넘음)']);
const [spA, spB] = mapScene('p9', 1.9, 1.9, SUN0, 3000 * KM.AU, 'ecl', 96, 44,
  ['Planet Nine? (hypothesis)', `Not discovered · one proposed orbit · modelled at ${FACTS.p9.rE}× Earth’s size`, `(제9행성? — 가설 · 미발견 · 제안된 궤도 중 하나 · 모형상 지구의 ${FACTS.p9.rE}배)`]);
const [soA, soB] = mapScene('oort', 1.9, 4.0, SUN0, 260000 * KM.AU, 'gal', 60, 34,
  ['The Oort cloud', 'Inferred from comets, out to ~1.6 light-years · never seen', '(오르트 구름 — 혜성으로 추론 · 약 1.6광년까지 · 직접 본 적 없음)'], { reveal: true });
const [s10A, s10B] = mapScene('10ly', 1.8, 1.9, SUN0, 22 * LYk, 'gal', 30, 30,
  ['Our nearest stars', `Proxima Centauri: ${FACTS.proxima} light-years away`, `(가장 가까운 별들 — 프록시마 센타우리까지 ${FACTS.proxima}광년)`]);
const [s100A, s100B] = mapScene('100ly', 1.8, 1.9, SUN0, 170 * LYk, 'gal', 8, 30,
  ['100 light-years around the Sun', 'Real star positions (HYG catalogue)', '(태양 주변 100광년 — 실제 별 위치(HYG 목록))']);
const [slbA, slbB] = mapScene('bubble', 1.8, 1.9, SUN0, 1500 * LYk, 'gal', -14, 28,
  ['The Local Bubble', 'A ~1,000-light-year cavity of thin, hot gas · visualization', '(국부 거품 — 약 1,000광년의 희박하고 뜨거운 가스 공간 · 시각화)']);
const [srwA, srwB] = mapScene('radcliffe', 1.8, 1.9, at(V3(-260, 200, 0)), 11000 * LYk, 'gal', -30, 16,
  ['The Radcliffe Wave', 'A 9,000-light-year ripple of gas clouds (Alves et al. 2020)', '(래드클리프 파동 — 약 9,000광년 길이의 가스 구름 물결)']);
const [ssA, ssB] = mapScene('spur', 1.9, 1.8, at(V3(600, 500, 0)), 27000 * LYk, 'gal', -8, 34,
  ['The Orion Spur', 'Our local arm · traced by maser parallaxes (Reid et al. 2019)', '(오리온 지선 — 우리가 속한 국부 나선팔 · 메이저 시차로 측정)']);
const [smwA, smwB] = mapScene('milkyway', 2.0, 2.3, GC.clone().multiplyScalar(KM.KPC), 125000 * LYk, 'gal', 30, 58,
  ['The Milky Way', `A disc ~${fmtInt(FACTS.mwDisk)} light-years across · a model, not a photograph`, '(우리은하 — 지름 약 10만광년의 별 원반 · 사진이 아닌 모형)'], { reveal: true });
const LMCw = GALAXIES[3].posKm, M31w = GALAXIES[1].posKm;
const [ssatA, ssatB] = mapScene('satellites', 1.8, 2.6, GC.clone().multiplyScalar(KM.KPC).lerp(LMCw, 0.35), 650000 * LYk, 'gal', 38, 46,
  ['The Milky Way’s satellites', 'The Magellanic Clouds, 160,000–200,000 light-years away', '(위성은하 — 대·소마젤란은하, 약 16만~20만광년)']);
const GCw = GC.clone().multiplyScalar(KM.KPC);
const M31_EYE = (() => { const u = M31w.clone().sub(GCw).normalize(), sd = u.clone().cross(V3(0, 0, 1)).normalize();
  return GCw.clone().addScaledVector(u, -165000 * LYk).addScaledVector(sd, 36000 * LYk).addScaledVector(V3(0, 0, 1), 30000 * LYk); })();
// the two big neighbours side by side: a straight pull-back from the Milky Way until Andromeda is in the view too
// (seen across the line that joins them, so neither hides the other)
const [sm31A, sm31B] = mapScene('andromeda', 2.2, 3.0, GCw.clone().lerp(M31w, 0.5), 3.1e6 * LYk, 'gal', 20, 28,
  ['Andromeda and Triangulum', 'About 2.5 and 2.7 million light-years away', '(안드로메다·삼각형자리은하 — 약 250만·270만광년)']);
const [slgA, slgB] = mapScene('localgroup', 1.8, 1.8, M31w.clone().multiplyScalar(0.4), 13e6 * LYk, 'gal', 62, 34,
  ['The Local Group', 'More than 80 galaxies within ~10 million light-years', '(국부 은하군 — 약 1,000만광년 안의 80여 개 은하)']);
const [sngA, sngB] = mapScene('groups', 1.8, 1.8, M31w.clone().multiplyScalar(0.3), 60e6 * LYk, 'gal', 105, 32,
  ['Neighbouring groups', 'M81, Sculptor, Centaurus A — similar groups all around', '(이웃 은하군들 — M81·조각가자리·센타우루스 A 은하군)']);
const VIRGO = eqDir(187.7059, 12.3911).multiplyScalar(16.5 * KM.MPC);
const [svA, svB] = mapScene('virgo', 1.8, 1.8, VIRGO.clone().multiplyScalar(0.45), 240e6 * LYk, 'gal', 145, 30,
  ['The Virgo Supercluster', 'Around the Virgo cluster, 54 million light-years away · 2MRS galaxies', '(처녀자리 초은하단 — 5,400만광년 거리의 처녀자리 은하단 주변 · 2MRS 관측 은하)']);
const LAN_C = GA.clone().multiplyScalar(0.5 * KM.MPC);
const [slaA, slaB] = mapScene('laniakea', 2.0, 1.8, LAN_C, 700e6 * LYk, 'gal', 180, 34,
  ['Laniakea', '~520 million light-years · defined by galaxy flows · lines illustrative', '(라니아케아 — 약 5억 2천만광년 · 은하의 흐름으로 정의 · 흐름선은 설명용)']);
const PC_C = eqDir(7.5, -10).multiplyScalar(125 * KM.MPC);
const [spcA, spcB] = mapScene('pisces', 1.8, 1.8, PC_C, 1.7e9 * LYk, 'gal', 196, 32,
  ['Pisces–Cetus complex (proposed)', 'About 1 billion light-years (Tully 1987) · not confirmed', '(물고기자리–고래자리 복합체 — 제안된 구조 · 약 10억광년 · 미확정)']);
const [sqA, sqB] = mapScene('quipu', 2.0, 1.8, QUIPU_C.clone().multiplyScalar(KM.MPC * 0.9), 2.5e9 * LYk, 'gal', 212, 30,
  ['Quipu', '1.4 billion light-years long · 68 X-ray clusters (Böhringer et al. 2025)', '(퀴푸 — 길이 약 14억광년 · X선 은하단 68개)']);
const [swA, swB] = mapScene('web', 2.0, 1.9, SUN0, 4.5e9 * LYk, 'gal', 228, 30,
  ['The cosmic web', 'Filaments and voids · surveyed inside ~1 billion ly, simulated beyond', '(우주 거미줄 — 필라멘트와 공동 · 약 10억광년 안은 관측, 밖은 모의 구조)'], { reveal: true });
const [souA, souB] = mapScene('observable', 2.6, 3.6, SUN0, 128e9 * LYk, 'gal', 244, 28,
  ['The observable universe', '93 billion light-years across · each speck a galaxy like ours — hundreds of billions to 2 trillion', '(관측 가능한 우주 — 지름 약 930억광년 · 점 하나하나가 우리은하 같은 은하, 추정 수천억~2조 개)'], { reveal: true });
keyW(t + 4.0, SUN0, 128e9 * LYk * 1.08, 'gal', 247, 28, false);
MAPCAPS.push([t + 0.8, ['This is as far as we can see.', 'The size of the whole universe is not known.', '(여기까지가 우리가 볼 수 있는 범위입니다. 전체 우주의 크기는 아직 모릅니다.)']]);
const T_END_HOLD = t + 4.0;
// home again: an ultra-fast return from the edge of the observable universe to the opening view of Earth (~52 e-folds of
// scale in about 6 s). The turn is done by the middle key (3 AU from Earth); the last stretch is a straight dive. The last
// key is the first key, so the loop closes on the opening view without a cut.
// the way home retraces the journey at a steady pace (~3 e-folds of scale a second): the web, the Local Group, the Milky
// Way seen whole, the Sun's neighbourhood, the planets from above, then straight down to Earth. The turning is done by
// the time we reach the solar system. The comparison stand-ins stay hidden on the way (only Earth is waiting).
const RETURN = [                                      // [seconds after the last hold, target, field km, frame, yaw, pitch]
  [2.4, SUN0, 4.5e9 * LYk, 'gal', 282, 32],             // (the yaw keeps turning one way: 247 -> 390 = 30)
  [4.5, SUN0, 13e6 * LYk, 'gal', 335, 42],
  [6.3, GCw, 125000 * LYk, 'gal', 390, 58],
  [8.0, SUN0, 1500 * LYk, 'gal', 10, 32],
  [12.4, SUN0, 75 * KM.AU, 'ecl', 20, 57],
];
RETURN.forEach(([dt, T, f, fr, yw, pt]) => keyW(T_END_HOLD + dt, T, f, fr, yw, pt));
const T_HOME_MID = T_END_HOLD + RETURN[RETURN.length - 1][0], LOOP_T = T_HOME_MID + 4.4;
const SUN_OUT = [LOOP_T - 1.5, LOOP_T - 0.9];             // the Sun is behind the camera by then (checked in QA)
keyL(LOOP_T, B.earth.x, cy(B.earth), EARTH_D * 1.4, 26, 4, false);
EARTH_LEADER.wins.push([T_HOME_MID + 1.2, LOOP_T - 1.3]);
MAPCAPS.push([T_END_HOLD + 0.6, ['And back home', 'The same journey in reverse, at true scale', '(그리고 다시 집으로 — 지나온 길을 거꾸로, 실제 비율 그대로)']]);
MAPCAPS.push([T_HOME_MID + 0.2, ['Home: that small blue dot', 'Everything we have ever known is on this one world, 12,742 km across', '(우리의 집, 저 작은 푸른 점 — 우리가 아는 모든 것이 지름 12,742km의 이 행성 위에 있습니다)']]);
MAPCAPS.forEach(([t0, cap], i) => LCAPS.push([t0, i + 1 < MAPCAPS.length ? MAPCAPS[i + 1][0] : LOOP_T - 0.3, ...cap]));
KEYS.sort((a, b) => a.t - b.t);
KEYS.forEach((k, i) => { if (i && k.t <= KEYS[i - 1].t) throw new Error('camera keys out of order at ' + k.t.toFixed(2) + ' after ' + KEYS[i - 1].t.toFixed(2) + ' / ' + KEYS.map(k => k.t.toFixed(1)).join(',')); });
LCAPS.sort((a, b) => a[0] - b[0]);
LCAPS.forEach((l, i) => { if (i && l[0] < LCAPS[i - 1][1] - 1e-6) throw new Error('captions overlap at ' + l[0].toFixed(2) + ' (' + l[2] + ')'); if (l[1] - l[0] < 3.5) throw new Error('caption too short: ' + l[2] + ' ' + (l[1] - l[0]).toFixed(2)); });

// --- map labels ---
const tagAt = (t0, t1, world, en, ko, cls) => TAGS_DEF.push({ t0, t1, p: () => world, en, ko, cls });
const auW = v => v.clone().multiplyScalar(KM.AU);
tagAt(s60a - 0.5, s60b + 0.8, auW(PLANET_AU.earth), 'Earth', '지구');
tagAt(s60a - 0.4, s60b + 0.8, auW(PLANET_AU.jupiter), 'Jupiter', '목성');
tagAt(s60a - 0.2, skB, auW(PLANET_AU.neptune), 'Neptune', '해왕성');
tagAt(skA - 0.4, skB, auW(PLANET_AU.pluto), 'Pluto', '명왕성');
tagAt(shA - 0.3, shB + 0.3, auW(VOY[0]), 'Voyager 1', '보이저 1호');
tagAt(shA - 0.2, shB + 0.3, auW(VOY[1]), 'Voyager 2', '보이저 2호');
tagAt(shA, shB, auW(HELIO_NOSE.clone().multiplyScalar(121)), 'Heliopause', '태양권계면');
tagAt(spA - 0.3, spB + 0.3, auW(P9_POS), 'Planet Nine? (position unknown)', '제9행성? (위치 미상)', 'hyp');
tagAt(s10A - 0.4, s10B + 0.4, STAR_NAMED.proxima, 'Proxima Centauri', '프록시마 센타우리');
tagAt(s10A - 0.3, s10B + 0.4, STAR_NAMED.sirius, 'Sirius', '시리우스');
tagAt(s10A - 0.2, s10B + 0.4, STAR_NAMED.barnard, 'Barnard’s Star', '바너드 별');
tagAt(s10A - 0.1, s100B, SUN0, 'The Sun', '태양');
tagAt(s100A - 0.6, s100A + 1.0, STAR_NAMED.arcturus, 'Arcturus (from the lineup)', '아르크투루스');
tagAt(s100A - 0.5, s100A + 1.0, STAR_NAMED.aldebaran, 'Aldebaran (from the lineup)', '알데바란');
tagAt(s100A + 1.0, s100B + 0.5, STAR_NAMED.hd189733, 'HD 189733 (the blue planet)', 'HD 189733');
tagAt(slbA - 0.4, slbB + 0.3, STAR_NAMED.betelgeuse, 'Betelgeuse', '베텔게우스');
tagAt(slbA - 0.3, slbB + 0.3, STAR_NAMED.antares, 'Antares', '안타레스');
tagAt(slbA - 0.2, slbB + 0.3, STAR_NAMED.rigel, 'Rigel', '리겔');
tagAt(slbA - 0.1, slbB + 0.3, SUN0, 'The Sun', '태양');
tagAt(srwA - 0.3, srwB + 0.3, at(galDir(209.01, -19.38).multiplyScalar(414)), 'Orion Nebula', '오리온 성운');
tagAt(srwA - 0.2, srwB + 0.3, SUN0, 'The Sun', '태양');
tagAt(ssA - 0.3, ssB + 0.3, STAR_NAMED.deneb, 'Deneb', '데네브');
tagAt(ssA - 0.2, ssB + 0.3, STAR_NAMED.vycma, 'VY Canis Majoris', '큰개자리 VY');
tagAt(ssA - 0.1, smwB, SUN0, 'The Sun', '태양');
tagAt(smwA - 0.3, smwB + 0.3, GC.clone().multiplyScalar(KM.KPC), 'Galactic centre', '은하 중심');
tagAt(ssatA - 0.3, ssatB + 0.3, GALAXIES[3].posKm, 'Large Magellanic Cloud', '대마젤란은하');
tagAt(ssatA - 0.2, ssatB + 0.3, GALAXIES[4].posKm, 'Small Magellanic Cloud', '소마젤란은하');
tagAt(ssatA - 0.1, sm31B, GC.clone().multiplyScalar(KM.KPC), 'Milky Way', '우리은하');
tagAt(sm31A - 0.3, slgB + 0.3, M31w, 'Andromeda (M31)', '안드로메다은하');
tagAt(sm31A - 0.2, sm31B + 0.3, GALAXIES[2].posKm, 'Triangulum (M33)', '삼각형자리은하');
tagAt(sngA - 0.3, sngB + 0.3, UNGC_NAMED.MESSIER081, 'M81 group', 'M81 은하군');
tagAt(sngA - 0.2, sngB + 0.3, UNGC_NAMED.NGC0253, 'Sculptor group', '조각가자리 은하군');
tagAt(sngA - 0.1, sngB + 0.3, UNGC_NAMED.NGC5128, 'Centaurus A group', '센타우루스 A 은하군');
tagAt(sngA, svB + 0.3, SUN0, 'Local Group', '국부 은하군');
tagAt(svA - 0.3, svB + 0.3, VIRGO, 'Virgo cluster', '처녀자리 은하단');
tagAt(slaA - 0.3, slaB + 0.3, GA.clone().multiplyScalar(KM.MPC), 'Great Attractor region', '거대 인력체 부근');
tagAt(slaA - 0.1, spcB + 0.3, SUN0, 'We are here', '우리 위치');
tagAt(sqA - 0.3, sqB + 0.3, QUIPU_C.clone().multiplyScalar(KM.MPC), 'Quipu', '퀴푸');
tagAt(sqA - 0.2, sqB + 0.3, eqDir(202.0, -31.5).multiplyScalar(4282.7 * 0.048 * KM.MPC), 'Shapley supercluster', '섀플리 초은하단');
tagAt(souA - 0.3, T_END_HOLD, SUN0, 'We are here (Milky Way)', '우리 위치');

/* ---------- camera evaluation: log-distance, monotone Hermite, quaternions in the tangent space ---------- */
function monoTan(p0, p1, p2, t0, t1, t2) {                    // Fritsch–Carlson style tangent at the middle point
  const d0 = (p1 - p0) / (t1 - t0), d1 = (p2 - p1) / (t2 - t1);
  if (d0 * d1 <= 0) return 0;
  return 2 / (1 / d0 + 1 / d1) ;
}
const herm = (p0, p1, m0, m1, u, dt) => { const u2 = u * u, u3 = u2 * u; return (2 * u3 - 3 * u2 + 1) * p0 + (u3 - 2 * u2 + u) * m0 * dt + (-2 * u3 + 3 * u2) * p1 + (u3 - u2) * m1 * dt; };
function qlog(q) { const v = V3(q.x, q.y, q.z), s = v.length(); if (s < 1e-9) return V3(0, 0, 0); const a = 2 * Math.atan2(s, q.w); return v.multiplyScalar(a / s); }
function qexp(v) { const a = v.length(); if (a < 1e-9) return new THREE.Quaternion(); const s = Math.sin(a / 2) / a; return new THREE.Quaternion(v.x * s, v.y * s, v.z * s, Math.cos(a / 2)); }
const KV = KEYS.map(k => ({ lnD: Math.log(k.D), fov: k.fov }));
KEYS.forEach((k, i) => { if (i && KEYS[i - 1].q.dot(k.q) < 0) { k.q.x *= -1; k.q.y *= -1; k.q.z *= -1; k.q.w *= -1; } });
const CAM = { T: new THREE.Vector3(), D: 1, q: new THREE.Quaternion(), fov: FOV };
function evalCamera(tau) {
  let i = 0; while (i < KEYS.length - 2 && tau >= KEYS[i + 1].t) i++;
  const k0 = KEYS[i], k1 = KEYS[i + 1], dt = k1.t - k0.t, u = clamp01((tau - k0.t) / dt);
  if (k1.ease === 'reveal') return evalReveal(k0, k1, u, i);
  const kp = KEYS[i - 1], kn = KEYS[i + 2];
  const tanOf = (arr, fn, j) => {                                // tangent at key j for scalar channel fn
    const a = arr[j - 1], b = arr[j], c = arr[j + 1];
    if (!a || !c || !b.flow) return 0;
    return monoTan(fn(a, j - 1), fn(b, j), fn(c, j + 1), a.t, b.t, c.t);
  };
  const lnD = (k, j) => KV[j].lnD, fov = (k, j) => KV[j].fov;
  const lD = herm(KV[i].lnD, KV[i + 1].lnD, tanOf(KEYS, lnD, i), tanOf(KEYS, lnD, i + 1), u, dt);
  CAM.D = Math.exp(lD);
  CAM.fov = herm(k0.fov, k1.fov, tanOf(KEYS, fov, i), tanOf(KEYS, fov, i + 1), u, dt);
  // target: while the distance changes a lot, move the target in proportion to the zoom (keeps the subject framed)
  if (Math.abs(KV[i + 1].lnD - KV[i].lnD) > 0.7) {
    const D0 = Math.exp(KV[i].lnD), D1 = Math.exp(KV[i + 1].lnD);
    CAM.T.copy(k0.T).lerp(k1.T, clamp01((CAM.D - D0) / (D1 - D0)));
  } else {
    for (const ax of ['x', 'y', 'z']) {
      const f = (k) => k.T[ax];
      const m0 = (k0.flow && kp) ? monoTan(f(kp), f(k0), f(k1), kp.t, k0.t, k1.t) : 0;
      const m1 = (k1.flow && kn) ? monoTan(f(k0), f(k1), f(kn), k0.t, k1.t, kn.t) : 0;
      CAM.T[ax] = herm(k0.T[ax], k1.T[ax], m0, m1, u, dt);
    }
  }
  // orientation: Hermite on rotation vectors in the tangent space of k0
  const q0i = k0.q.clone().invert();
  const r1 = qlog(q0i.clone().multiply(k1.q));
  const rp = kp ? qlog(q0i.clone().multiply(kp.q)) : null, rn = kn ? qlog(q0i.clone().multiply(kn.q)) : null;
  const r = V3(0, 0, 0);
  for (const ax of ['x', 'y', 'z']) {
    const m0 = (k0.flow && rp) ? monoTan(rp[ax], 0, r1[ax], kp.t, k0.t, k1.t) : 0;
    const m1 = (k1.flow && rn) ? monoTan(0, r1[ax], rn[ax], k0.t, k1.t, kn.t) : 0;
    r[ax] = herm(0, r1[ax], m0, m1, u, dt);
  }
  CAM.q.copy(k0.q).multiply(qexp(r));
  return CAM;
}
// a reveal: everything moves on one front-loaded curve — a quick start (ease-in over the first ~12%), then a long exponential settle
const revealCurve = (() => {          // velocity: eases in over the first 20%, then decays exponentially to rest
  const N = 400, a = 0.2, e = 2.4, arr = new Float64Array(N + 1); let acc = 0;
  for (let k = 1; k <= N; k++) { const u = (k - 0.5) / N; acc += smoother(clamp01(u / a)) * Math.exp(-e * Math.max(u - a, 0)) / N; arr[k] = acc; }
  for (let k = 0; k <= N; k++) arr[k] /= acc;
  return u => { const f = clamp01(u) * N, k = Math.min(N - 1, Math.floor(f)); return arr[k] + (arr[k + 1] - arr[k]) * (f - k); };
})();
function evalReveal(k0, k1, u, i) {
  const w = revealCurve(u);
  const lD = lerp(KV[i].lnD, KV[i + 1].lnD, w);
  CAM.D = Math.exp(lD); CAM.fov = lerp(k0.fov, k1.fov, w);
  const D0 = Math.exp(KV[i].lnD), D1 = Math.exp(KV[i + 1].lnD);
  CAM.T.copy(k0.T).lerp(k1.T, Math.abs(D1 - D0) > 1e-9 ? clamp01((CAM.D - D0) / (D1 - D0)) : w);
  CAM.q.copy(k0.q).slerp(k1.q, smoother(clamp01(0.55 * u + 0.45 * w)));        // the turn is spread over the whole reveal
  return CAM;
}
const CAM_POS = new THREE.Vector3(), _eye = new THREE.Vector3();
function placeCamera(tau) {
  const c = evalCamera(tau);
  _eye.set(0, 0, 1).applyQuaternion(c.q);                        // unit vector from target to eye
  CAM_POS.copy(c.T).addScaledVector(_eye, c.D);
  universe.matrix.makeScale(1 / c.D, 1 / c.D, 1 / c.D).multiply(new THREE.Matrix4().makeTranslation(-c.T.x, -c.T.y, -c.T.z));
  universe.matrixWorldNeedsUpdate = true;
  camera.position.copy(_eye); camera.quaternion.copy(c.q);
  camera.fov = c.fov; camera.near = NEAR; camera.far = FAR; camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  scene.updateMatrixWorld(true);
  return c;
}
const fieldNow = () => 2 * CAM.D * Math.tan(CAM.fov * deg / 2);

/* ---------- playback speed profile (identity until measured) ---------- */
const WARP = (() => {
  const seg = [];
  const v = tau => { let s = 1; for (const [a, b, k] of seg) s += (k - s) * smoother(range(tau, a, b)); return s; };
  const dT = 0.004, N = Math.round(LOOP_T / dT), tt = new Float64Array(N + 1);
  for (let i = 0; i < N; i++) tt[i + 1] = tt[i] + dT / v((i + 0.5) * dT);
  const len = tt[N];
  const toTau = tp => { tp = Math.min(Math.max(tp, 0), len); let lo = 0, hi = N;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (tt[m] <= tp) lo = m; else hi = m; }
    return (lo + (tp - tt[lo]) / Math.max(1e-12, tt[hi] - tt[lo])) * dT; };
  const toT = tau => { const f = Math.min(Math.max(tau, 0), LOOP_T) / dT, i = Math.min(N - 1, Math.floor(f)); return tt[i] + (tt[i + 1] - tt[i]) * (f - i); };
  return { len, toTau, toT, v };
})();
const LOOP = WARP.len;

/* ---------- the state of every layer at time τ (annotations by τ; ways of seeing by the camera) ---------- */
// a body waiting for its turn is not drawn; it fades in, fully lit, while it is still outside the view (the camera is
// already on its way), so it is simply there when the camera arrives
let TAU_NOW = 0, STAND = 1, GLARE = 0;
const _cf = new THREE.Vector3();
const INTRO_DONE = [1, 1], INTRO_HIDDEN = [0, 1];
function introAt(key) {
  // on the way home only Earth is drawn (as at the start of the loop) — and the Sun, which really is there, until it has
  // passed out of view on the way down
  if (TAU_NOW > T_END_HOLD) return key === 'sun' ? [1 - smoother(range(TAU_NOW, SUN_OUT[0], SUN_OUT[1])), 1] : INTRO_HIDDEN;
  const w = INTRO[key];
  if (!w || TAU_NOW >= w[1]) return INTRO_DONE;
  return [smoother(range(TAU_NOW, w[0], B[key].star ? w[1] : w[0] + 0.45)), 1];     // (a star brightens over the whole pull-back)
}
function applyState(tau) {
  const field = fieldNow();
  const F = f => lrange(field, f[0], f[1]);                       // 0 -> 1 as the field grows from f[0] to f[1]
  const AU = KM.AU, LY = KM.LY;
  const RET = tau > T_END_HOLD, retT = smoother(range(tau, T_HOME_MID + 0.2, T_HOME_MID + 2.6));
  const standIn = RET ? retT : 1 - smoother(F([F_REC * 1.08, F_REC * 1.9]));
  const mapLow = f => (RET ? 1 - retT : smoother(F(f)));           // the lower end of a map layer's range
  TAU_NOW = tau;
  STAND = standIn;
  B.sun.fx.material.uniforms.uErupt.value = smoother(range(tau, STEP.sun.tA + 0.6, STEP.sun.tE + 1.5));   // the prominence that erupts as the Sun appears
  updateBodies({ camPosKm: CAM_POS, pxPerRad: PXR_U.value, standIn, frameArea: frameEl.__s * frameEl.__s, spin: tau / LOOP_T, intro: introAt, tau,
    camFwd: _cf.set(0, 0, -1).applyQuaternion(CAM.q), halfDiag: CAM.fov * deg * 0.5 * 1.42 });
  // stars: the sky's depth (map exposure) deepens with the field; the Sun's point takes over from its disc
  const sunPx = B.sun.px;
  STARU.uSunFade.value = 1 - smoother(clamp01((sunPx - 0.8) / 2.5));
  STARU.uCamPc.value.copy(CAM_POS).multiplyScalar(1 / KM.PC);
  // a deep sky near the Sun (the real catalogue to ~mag 10 plus the Galaxy's distant stars), deeper still once the view
  // is a map of light-years (Proxima needs ~mag 14 from 30 ly away), shallower at 1,000 ly, then the Galaxy's bright stars
  const mref = 10.4 + 3.6 * smoother(F([1.2 * LY, 14 * LY])) - 4.4 * smoother(F([40 * LY, 900 * LY])) + 1.4 * smoother(F([4000 * LY, 20000 * LY]));
  const glare = smoother(clamp01(EXPO.pcover * 1.4)) * standIn;        // a lit planet filling the view: the camera sees fewer stars
  GLARE = glare;
  STARU.uMref.value = mref - 0.7 * standIn - 1.8 * glare;           // the lineup: a dark sky with fewer, crisper stars
  STARU.uFade.value = 1 - smoother(F([2500 * LY, 16000 * LY]));
  MW_STARS.U.uFade.value = smoother(F([300 * LY, 2500 * LY])) * (1 - smoother(F([250000 * LY, 900000 * LY])));   // the model's stars appear as we leave the real sky
  STARU.uExtAmt.value = 1 - smoother(F([3000 * LY, 30000 * LY]));
  STARU.uMaxPx.value = 3.0 + 2.0 * smoother(F([1 * LY, 20 * LY]));
  // a depth window around the subject once the view is a map (stars far behind the region shown recede)
  // (interpolated in log space between 'no window' — 10^12 pc — and 1.1 × the field)
  const winLog = lerp(12, Math.log10(1.1 * field / KM.PC), smoother(F([0.3 * LY, 4 * LY])));
  STARU.uFocus.value.copy(CAM.T).multiplyScalar(1 / KM.PC); STARU.uFocusR.value = Math.pow(10, winLog);
  // Kuiper belt and Oort cloud objects are far too faint to see; drawn only in map mode (field-dependent)
  kuiper.U.uFade.value = mapLow([F_REC * 1.3, F_REC * 2.6]) * (1 - smoother(F([3000 * AU, 30000 * AU])));
  oort.U.uFade.value = smoother(F([1500 * AU, 15000 * AU])) * (1 - smoother(F([7 * LY, 30 * LY])));
  [kuiper, oort].forEach(c => c.U.uCamU.value.copy(CAM_POS).multiplyScalar(1 / c.unitKm));
  // interstellar clouds (pc): seen once the field reaches hundreds of light-years
  lb.U.uGain.value = smoother(F([250 * LY, 900 * LY])) * (1 - smoother(F([30000 * LY, 90000 * LY])));
  lb.U.uCamU.value.copy(CAM_POS).multiplyScalar(1 / KM.PC);
  lbSkin.material.uniforms.uFade.value = smoother(F([250 * LY, 900 * LY])) * (1 - smoother(F([9000 * LY, 30000 * LY])));
  // galaxies as points: map mode from ~150,000 ly; 2MRS from ~30 Mly; each with a depth window around the subject
  ungc.U.uFade.value = smoother(F([150000 * LY, 450000 * LY])) * (1 - smoother(F([400e6 * LY, 1.4e9 * LY])));
  ungc.U.uCamU.value.copy(CAM_POS).multiplyScalar(1 / KM.KPC);
  tmrs.U.uFade.value = smoother(F([25e6 * LY, 110e6 * LY])) * (1 - smoother(F([2.0e9 * LY, 3.8e9 * LY])));
  tmrs.U.uGain.value = 1 - 0.72 * smoother(F([400e6 * LY, 1.6e9 * LY]));
  tmrs.U.uCamU.value.copy(CAM_POS).multiplyScalar(1 / KM.MPC);
  // the galaxies beyond the survey: specks everywhere once the view is billions of light-years wide
  GAL_FIELD.U.uFade.value = smoother(F([1.3e9 * LY, 4.0e9 * LY]));
  GAL_FIELD.U.uGain.value = 1.0;
  GAL_FIELD.U.uCamU.value.copy(CAM_POS).multiplyScalar(1 / KM.MPC);
  tmrs.U.uFocus.value.copy(CAM.T).multiplyScalar(1 / KM.MPC); tmrs.U.uFocusR.value = Math.max(field / KM.MPC * 1.1, 5);
  // annotations
  const on = (a, b, c, d) => pulse(tau, a, b, c, d);
  orbitMat.opacity = orbitMat.userData.base * mapLow([F_REC * 1.1, F_REC * 1.9]) * (1 - smoother(F([900 * AU, 4000 * AU])));
  orbitMatDim.opacity = orbitMatDim.userData.base * mapLow([F_REC * 1.3, F_REC * 2.4]) * (1 - smoother(F([900 * AU, 4000 * AU])));
  planetMarks.U.uFade.value = orbitMat.opacity / orbitMat.userData.base;
  const helio = on(shA - 1.2, shA - 0.2, spA + 0.4, spA + 1.2);
  termShock.material.uniforms.uFade.value = helio * 0.9; helioPause.material.uniforms.uFade.value = helio;
  voyMarks.U.uFade.value = helio; voyMat.opacity = voyMat.userData.base * helio;
  const p9 = on(spA - 1.2, spA - 0.3, spB + 0.2, spB + 1.0);
  p9Mat.opacity = p9Mat.userData.base * p9; p9Mark.U.uFade.value = p9 * 0.7;
  rwMat.opacity = 0.6 * on(srwA - 0.8, srwA, srwB + 0.2, srwB + 1.0);
  ARM_LINES.forEach(A => { A.mat.opacity = 0.42 * on(ssA - 0.9, ssA, smwB + 0.3, smwB + 1.2) * (A === LOCAL_ARM ? 1 : smoother(F([20000 * LY, 60000 * LY]))); });
  lanMat.opacity = 0.9 * on(slaA - 0.9, slaA, slaB + 0.2, slaB + 1.0);
  pcMat.opacity = 0.85 * on(spcA - 0.9, spcA, spcB + 0.2, spcB + 1.0);
  const ss = on(sqA - 1.0, sqA, sqB + 0.3, sqB + 1.2);
  quipuMat.opacity = 0.85 * ss; ssMat.opacity = 0.35 * ss; ssMarks.U.uFade.value = ss;
  obsMat.uniforms.uFade.value = on(souA - 1.2, souA, T_END_HOLD + 0.2, T_END_HOLD + 1.2);
  // layers that are fully faded are not drawn at all (a driver may still rasterise zero-sized points)
  [[GAL_FIELD, GAL_FIELD.U.uFade.value], [kuiper, kuiper.U.uFade.value], [oort, oort.U.uFade.value], [lb, lb.U.uGain.value], [ungc, ungc.U.uFade.value], [tmrs, tmrs.U.uFade.value],
   [planetMarks, planetMarks.U.uFade.value], [voyMarks, voyMarks.U.uFade.value], [p9Mark, p9Mark.U.uFade.value], [ssMarks, ssMarks.U.uFade.value]]
    .forEach(([c, f]) => { c.points.visible = f > 0.001; });
  starPoints.visible = STARU.uFade.value > 0.001;
  MW_STARS.points.visible = MW_STARS.U.uFade.value > 0.001 && !(window.__bw && window.__bw._dbg.flags.noMW);
  termShock.visible = helioPause.visible = helio > 0.001;
  if (window.__bw && window.__bw._dbg.flags.noStars) { starPoints.visible = false; MW_STARS.points.visible = false; lb.points.visible = false; lbSkin.visible = false; }
  lbSkin.visible = lbSkin.material.uniforms.uFade.value > 0.001;
  obsSphere.visible = obsMat.uniforms.uFade.value > 0.001;
  LINE_MATS.forEach(m => { m.visible = m.opacity > 0.001; });
  // volumes: the galaxies are always there (the Milky Way band from inside); the web in map mode at the largest scales
  const skyMix = 1 - smoother(F([1500 * LY, 7000 * LY]));          // the real sky while the camera is near the Sun, then the Galaxy model
  VOLU.uLocalHole.value = 1 - smoother(F([4000 * LY, 30000 * LY]));
  VOLU.uClouds.value = 1 - smoother(F([2000 * LY, 6000 * LY]));      // the nearby dark clouds only matter seen from near the Sun
  updateVolumes(CAM_POS, CAM.T, field, 1.0, smoother(F([300e6 * LY, 1.6e9 * LY])), skyMix);
  volBgMat.uniforms.uSkyMix.value = skyMix; skyMixNow = skyMix;
  VOLU.uWebGain.value = 3.2 / Math.max(field / KM.MPC * 0.11, 60) * (1 - 0.55 * smoother(F([20e9 * LY, 90e9 * LY])));
  VOLU.uWebInner.value = 1 - smoother(F([2.0e9 * LY, 3.8e9 * LY]));
  // the Galaxy's light: dim behind the bright planets and stars, full once the view is light-years wide
  // (the lineup: space nearly black, so the lit planets stand out)
  VOLU.uGain.value = (0.3 - 0.2 * standIn) * (1 - 0.6 * glare) + 0.7 * smoother(F([30000 * LY, 90000 * LY]));
  volBgMat.uniforms.uSkyGain.value = (0.68 - 0.52 * standIn) * (1 - 0.65 * glare);
  HUD.el.style.opacity = (1 - 0.55 * standIn).toFixed(3);          // the ruler steps back while bodies fill the right side
  // opening and closing
  // (no black inside the loop: it closes on itself; the page fades in from black once, when it first starts)
}
const BLACK = document.getElementById('black');
let skyMixNow = 1;

/* ---------- field-of-view ruler: 10,000 km (top) to 100 billion light-years (bottom) ---------- */
const HUD = { mark: document.getElementById('hud-mark'), val: document.getElementById('hud-val'), el: document.getElementById('hud'), last: '' };
const HUD_MIN = Math.log10(1e4), HUD_MAX = Math.log10(100e9 * KM.LY);
[[1e4, '10,000 km'], [1e6, '1 million km'], [KM.AU, '1 AU'], [1000 * KM.AU, '1,000 AU'], [KM.LY, '1 light-year'], [1000 * KM.LY, '1,000 ly'],
 [1e6 * KM.LY, '1 million ly'], [1e9 * KM.LY, '1 billion ly']].forEach(([v, n]) => {
  const d = document.createElement('div'); d.className = 'tick'; d.style.top = ((Math.log10(v) - HUD_MIN) / (HUD_MAX - HUD_MIN) * 100).toFixed(3) + '%';
  const s = document.createElement('span'); s.textContent = n; d.appendChild(s); HUD.el.appendChild(d);
});
function fmtLen(km) {
  const sig = v => (v >= 100 ? fmtInt(v) : v >= 10 ? v.toFixed(1) : v.toFixed(2));
  if (km < 1e6) return sig(km) + ' km';
  if (km < 0.05 * KM.AU) return sig(km / 1e6) + ' million km';
  if (km < 0.3 * KM.LY) return sig(km / KM.AU) + ' AU';
  const ly = km / KM.LY;
  if (ly < 1e6) return sig(ly) + ' ly';
  if (ly < 1e9) return sig(ly / 1e6) + ' million ly';
  return sig(ly / 1e9) + ' billion ly';
}
function applyHud() {
  const f = fieldNow(), p = clamp01((Math.log10(f) - HUD_MIN) / (HUD_MAX - HUD_MIN));
  const top = (p * 100).toFixed(2) + '%'; HUD.mark.style.top = top; HUD.val.style.top = top;
  const txt = '≈ ' + fmtLen(f); if (txt !== HUD.last) { HUD.val.textContent = txt; HUD.last = txt; }
}

/* ---------- the scale in human terms: shrink Earth to a 1 mm grain of sand; how wide would this view be? ---------- */
// (shown on the map, where Earth is far too small to see; everything here is plain arithmetic on the field of view)
const SCALE = { el: document.getElementById('scale'), last: '' };
SCALE.v = SCALE.el.querySelector('.v'); SCALE.r = SCALE.el.querySelector('.r'); SCALE.n = SCALE.el.querySelector('.n');
const SAND_REFS = [                                            // familiar lengths, km
  [0.105, 'a football pitch', '축구장 길이'], [0.33, 'the Eiffel Tower', '에펠탑 높이'], [0.555, 'Lotte World Tower', '롯데월드타워 높이'],
  [0.828, 'Burj Khalifa', '부르즈 할리파 높이'], [8.849, 'Mount Everest', '에베레스트 높이'], [42.195, 'a marathon', '마라톤 코스'],
  [325, 'Seoul–Busan', '서울–부산 직선거리'], [1160, 'Seoul–Tokyo', '서울–도쿄 직선거리'], [3720, 'Seoul–Bangkok', '서울–방콕 직선거리'],
  [11050, 'Seoul–New York', '서울–뉴욕 직선거리'], [12742, 'the real Earth', '실제 지구 지름'], [40075, 'once around the Earth', '지구 한 바퀴'],
  [384400, 'the Earth–Moon distance', '지구–달 거리'], [1.39e6, "the Sun's diameter", '태양 지름'], [5.46e7, 'Earth–Mars at their closest', '가장 가까울 때의 지구–화성 거리'],
  [1.496e8, 'the Earth–Sun distance', '지구–태양 거리'], [4.5e9, 'the Sun–Neptune distance', '태양–해왕성 거리'],
  [KM.LY / 365.25, 'the distance light travels in a day', '빛이 하루 동안 가는 거리'], [KM.LY / 12, 'the distance light travels in a month', '빛이 한 달 동안 가는 거리'],
  [KM.LY, 'one light-year', '1광년'], [4.01e13, 'the distance to Proxima Centauri', '프록시마 센타우리까지 거리'],
];
const sig2 = v => (v >= 100 ? fmtInt(Math.round(v / Math.pow(10, Math.floor(Math.log10(v)) - 1)) * Math.pow(10, Math.floor(Math.log10(v)) - 1)) : v >= 10 ? fmtInt(v) : v.toFixed(1));
function sandLen(km) {                                          // [English, Korean]
  if (km < 1) return [fmtInt(km * 1000) + ' m', fmtInt(km * 1000) + 'm'];
  if (km >= 0.3 * KM.LY) return [sig2(km / KM.LY) + ' light-years', sig2(km / KM.LY) + '광년'];
  const en = km < 1e6 ? sig2(km) + ' km' : km < 1e9 ? sig2(km / 1e6) + ' million km' : km < 1e12 ? sig2(km / 1e9) + ' billion km' : sig2(km / 1e12) + ' trillion km';
  const ko = km < 1e4 ? sig2(km) + 'km' : km < 1e8 ? sig2(km / 1e4) + '만km' : km < 1e12 ? sig2(km / 1e8) + '억km' : sig2(km / 1e12) + '조km';
  return [en, ko];
}
function bigCount(n) {                                          // [English words, Korean units]
  const EN = [[1e21, 'sextillion'], [1e18, 'quintillion'], [1e15, 'quadrillion'], [1e12, 'trillion'], [1e9, 'billion'], [1e6, 'million']];
  if (n < 1e6) return [fmtInt(Math.round(n / 1000) * 1000), n >= 1e4 ? sig2(n / 1e4) + '만' : fmtInt(n)];
  const KO = [[1e20, '해'], [1e16, '경'], [1e12, '조'], [1e8, '억'], [1e4, '만']];
  const e = EN.find(([u]) => n >= u), k = KO.find(([u]) => n >= u);
  return [e ? sig2(n / e[0]) + ' ' + e[1] : fmtInt(n), k ? sig2(n / k[0]) + k[1] : fmtInt(n)];
}
function applyScale() {
  const on = 1 - smoother(clamp01((STAND - 0.1) / 0.4));          // the map only
  SCALE.el.style.opacity = on.toFixed(3);
  if (on < 0.002) return;
  const f = fieldNow(), sand = f / EARTH_D * 1e-6;               // km: the view's width if Earth were 1 mm across
  const [en, ko] = sandLen(sand);
  // a familiar length: the largest one it exceeds, or the next one up if it already reaches half of that
  let i = 0; while (i + 1 < SAND_REFS.length && SAND_REFS[i + 1][0] <= sand) i++;
  const ref = (SAND_REFS[i + 1] && sand / SAND_REFS[i + 1][0] >= 0.5) ? SAND_REFS[i + 1] : SAND_REFS[i];
  const r = sand / ref[0], rs = r >= 10 ? fmtInt(r) : r >= 1 ? r.toFixed(1) : r.toFixed(2);
  const near = r > 0.87 && r < 1.15;
  const rEn = near ? `about ${ref[1]}` : `${rs} × ${ref[1]}`, rKo = near ? `${ref[2]} 정도` : `${ref[2]}의 ${rs}배`;
  const [cEn, cKo] = bigCount(f / EARTH_D);
  const OBS = 93e9 * KM.LY, gal = f > 1e9 * KM.LY ? bigCount(2e12 * Math.pow(Math.min(f, OBS) / OBS, 3)) : null;
  const key = en + rEn + cEn + (gal ? gal[0] : '');
  if (key === SCALE.last) return; SCALE.last = key;
  SCALE.v.innerHTML = `×${cEn}<i>(${cKo} 배)</i>`;
  SCALE.r.innerHTML = `If Earth were a 1 mm grain of sand, this view would be ${en} — ${rEn}<i>(지구가 1mm 모래알이라면 화면 폭 ${ko} — ${rKo})</i>`;
  // galaxies in a sphere as wide as the view, from the average density (up to ~2 trillion in the observable universe;
  // Conselice et al. 2016 — other estimates are several times lower), shown once the view is billions of light-years wide
  if (gal) { const [gEn, gKo] = gal;
    SCALE.n.innerHTML = `Galaxies in a sphere this wide: up to ~${gEn}<i>(이 폭의 공간 속 은하: 최대 약 ${gKo} 개)</i>`; }
  else SCALE.n.innerHTML = '';
}

/* ---------- captions and labels ---------- */
const capEl = document.getElementById('caption'), capMain = document.getElementById('cap-main'), capSub = document.getElementById('cap-sub'), capKo = document.getElementById('cap-ko');
let capCurrent = null;
function applyCaption(tau) {
  const L = LCAPS.find(l => tau >= l[0] && tau <= l[1]) || null;
  if (L !== capCurrent) { capCurrent = L; if (L) { capMain.textContent = L[2]; capSub.textContent = L[3]; capKo.textContent = L[4]; } }
  const a = L ? smoother(range(tau, L[0], L[0] + 0.45)) * (1 - smoother(range(tau, L[1] - 0.45, L[1]))) : 0;
  capEl.style.opacity = a.toFixed(3);
  capEl.style.transform = `translateY(${((1 - a) * 0.6).toFixed(3)}cqw)`;
}
const tagsEl = document.getElementById('tags'), _tv = new THREE.Vector3();
const TAGS = TAGS_DEF.map(d => {
  const el = document.createElement('div'); el.className = 'tag' + (d.cls ? ' ' + d.cls : '');
  const box = document.createElement('div'), b = document.createElement('b'), k = document.createElement('i');
  b.textContent = d.en; k.textContent = '(' + d.ko + ')'; box.append(b, k); el.appendChild(box); tagsEl.appendChild(el);
  return { ...d, el, shown: false, pos: d.p() };
});
function applyTags(tau) {
  const W = frameEl.clientWidth, H = frameEl.clientHeight;
  const placed = [];
  TAGS.forEach(g => {
    const a = pulse(tau, g.t0, g.t0 + 0.5, g.t1 - 0.5, g.t1);
    if (a > 0.001) {
      _tv.copy(g.pos).sub(CAM.T).multiplyScalar(1 / CAM.D).project(camera);
      const x = (_tv.x * 0.5 + 0.5) * W, y = (-_tv.y * 0.5 + 0.5) * H;
      const underScale = STAND < 0.5 && x < W * 0.52 && y < H * 0.3;   // (the sand-grain panel sits there)
      if (_tv.z < 1 && Math.abs(_tv.x) < 0.94 && _tv.y < 0.9 && _tv.y > -0.55 && !underScale) {
        // keep labels apart: skip one that would sit on top of an earlier, brighter one
        const clash = placed.some(p => Math.abs(p[0] - x) < W * 0.3 && Math.abs(p[1] - y) < H * 0.085);
        if (!clash) {
          placed.push([x, y]);
          g.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
          g.el.style.opacity = a.toFixed(3); g.shown = true; return;
        }
      }
    }
    if (g.shown) { g.el.style.opacity = '0'; g.shown = false; }
  });
}

/* ---------- size comparison after each reveal: the ratio beside the new body ---------- */
const coEl = document.getElementById('callouts');
const fmtRatio = r => (r >= 10 ? fmtInt(r) : r.toFixed(1));
const COS = CALLOUTS.map(c => {
  const el = document.createElement('div'); el.className = 'co';
  const lab = document.createElement('div'); lab.className = 'lab'; lab.style.transform = 'translate(-50%, -50%)';
  const r = fmtRatio(c.ratio), vs = c.ref === B.sun ? 'the Sun' : 'Earth', lt = c.big.star && c.big !== B.sun ? lumTxt(c.big.key) : null;
  lab.innerHTML = `<b>×${r}</b><span>${c.big.en} vs ${vs}${lt ? ' · light ' + lt[0] : ''}</span><i>(${c.big.ko} = ${c.ref.ko} 지름의 ${r}배${lt ? ' · 밝기 ' + lt[1] : ''})</i>`;
  el.append(lab); coEl.appendChild(el);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'polyline'); line.style.opacity = '0';
  document.getElementById('leaders').appendChild(line);
  // beside the body when it towers over the rest of the view, otherwise above it
  const inView = c.others.filter(o => Math.abs(o.x - c.big.x) < 3 * c.big.r + hw(o));
  const second = Math.max(0, ...inView.map(topOf));
  if (c.side !== 'above' && second > 0.62 * topOf(c.big)) c.side = 'above';
  return { ...c, el, lab, line, shown: false };
});
const _cv = new THREE.Vector3();
function screenOf(b) {                              // screen position (CSS px) and radius of a lineup body, or null
  _cv.copy(b.pos).sub(CAM.T).multiplyScalar(1 / CAM.D).project(camera);
  if (_cv.z >= 1) return null;
  const W = frameEl.clientWidth, H = frameEl.clientHeight;
  return { x: (_cv.x * 0.5 + 0.5) * W, y: (-_cv.y * 0.5 + 0.5) * H, r: b.r / CAM_POS.distanceTo(b.pos) * PXR_U.value };
}
const rectHit = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
function applyCallouts(tau, obst) {
  const W = frameEl.clientWidth, H = frameEl.clientHeight;
  COS.forEach(c => {
    const a = pulse(tau, c.t0, c.t0 + 0.35, c.t1 - 0.35, c.t1);
    const sp = a > 0.001 ? screenOf(c.big) : null;
    if (sp) {
      const w = c.lab.offsetWidth || 160, h = c.lab.offsetHeight || 50;
      let lx, ly;
      if (c.side === 'left') { lx = sp.x - sp.r - 18 - w / 2; ly = sp.y - sp.r * 0.15; }
      else if (c.side === 'right') { lx = sp.x + sp.r + 18 + w / 2; ly = sp.y - sp.r * 0.15; }
      else { lx = sp.x; ly = sp.y - sp.r - 16 - h / 2; }
      lx = clamp(lx, w / 2 + 10, W - w / 2 - 10); ly = clamp(ly, h / 2 + 10, H * 0.6 - h / 2);
      c.el.style.transform = `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px) scale(${(0.94 + 0.06 * a).toFixed(3)})`;
      c.el.style.opacity = a.toFixed(3); c.shown = true;
      obst.push([lx - w / 2 - 6, ly - h / 2 - 6, lx + w / 2 + 6, ly + h / 2 + 6]);
      // a short connector from the body's edge to the label
      const ux = lx - sp.x, uy = ly - sp.y, ul = Math.hypot(ux, uy) || 1;
      const sx = sp.x + ux / ul * (sp.r + 4), sy = sp.y + uy / ul * (sp.r + 4);
      const ex = clamp(sx, lx - w / 2, lx + w / 2), ey = clamp(sy, ly - h / 2, ly + h / 2);
      const L = Math.hypot(ex - sx, ey - sy);
      if (L > 6) { c.line.setAttribute('points', `${sx.toFixed(1)},${sy.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`); c.line.style.opacity = a.toFixed(3); }
      else c.line.style.opacity = '0';
      return;
    }
    if (c.shown) { c.el.style.opacity = '0'; c.line.style.opacity = '0'; c.shown = false; }
  });
}
// leader labels: a ring around a body too small to see well, a thin line, and its name (English + Korean)
const svgNS = 'http://www.w3.org/2000/svg';
const ldSvg = document.getElementById('leaders'), ldBox = document.getElementById('leadlabs');
const LDS = LEADER_DEF.map(d => {
  const g = document.createElementNS(svgNS, 'g'), ring = document.createElementNS(svgNS, 'circle'), line = document.createElementNS(svgNS, 'polyline');
  g.append(line, ring); g.style.opacity = '0'; ldSvg.appendChild(g);
  const lab = document.createElement('div'); lab.className = 'ld';
  const box = document.createElement('div'); box.innerHTML = `<b>${d.en}</b><i>(${d.ko})</i>`; lab.appendChild(box); ldBox.appendChild(lab);
  return { ...d, g, ring, line, lab, box, shown: false };
});
const LEAD_CANDS = [[0, -0.07], [-0.07, -0.12], [0.07, -0.12], [0, -0.17], [-0.1, -0.2], [0.1, -0.2], [0, -0.26]];
function applyLeaders(tau, obst) {
  const W = frameEl.clientWidth, H = frameEl.clientHeight;
  let discs = null;
  LDS.forEach(d => {
    let a = 0; for (const [t0, t1] of d.wins) a = Math.max(a, pulse(tau, t0, t0 + 0.3, t1 - 0.3, t1));
    const sp = a > 0.001 ? screenOf(d.body) : null;
    if (sp && sp.x > -4 && sp.x < W + 4 && sp.y > 0 && sp.y < H * 0.7) {
      if (!discs) discs = LINEUP.filter(o => o.mesh.visible && o.px > 3).map(o => screenOf(o)).filter(Boolean);
      const rr = sp.r < 36 ? Math.max(sp.r + 5, 7) : 0, top = sp.y - (rr || sp.r);
      const w = d.box.offsetWidth || 70, h = d.box.offsetHeight || 34;
      // choose the spot with the least clutter: label boxes overlapping (worst), the line crossing a label, a body under the label
      let best = null, bestPen = Infinity;
      const segHits = (x0, y0, x1, y1, r) => {                 // does the segment cross rectangle r? (sampled)
        for (let k = 1; k < 12; k++) { const u = k / 12, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u; if (x > r[0] && x < r[2] && y > r[1] && y < r[3]) return true; }
        return false; };
      for (let ci = 0; ci < LEAD_CANDS.length; ci++) {
        const [dx, dy] = LEAD_CANDS[ci];
        const cx = clamp(sp.x + dx * W, w / 2 + 6, W - w / 2 - 6), cy = clamp(top + dy * H, h + 6, H * 0.62);
        const box = [cx - w / 2, cy - h, cx + w / 2, cy];
        let pen = ci * 0.01;
        for (const o of obst) { const ox = Math.max(0, Math.min(o[2], box[2]) - Math.max(o[0], box[0])), oy = Math.max(0, Math.min(o[3], box[3]) - Math.max(o[1], box[1]));
          pen += 4 * ox * oy / (w * h); if (segHits(sp.x, top, cx, cy, o)) pen += 1.5; }
        for (const q of discs) if (q.r > 6 && (clamp(q.x, box[0], box[2]) - q.x) ** 2 + (clamp(q.y, box[1], box[3]) - q.y) ** 2 < (q.r + 4) ** 2) pen += 1;
        if (pen < bestPen) { bestPen = pen; best = [cx, cy, box]; }
        if (pen < 0.1) break;
      }
      const [cx, cy, box] = best;
      obst.push(box);
      const ux = cx - sp.x, uy = cy - sp.y, ul = Math.hypot(ux, uy) || 1;
      const x0 = sp.x + ux / ul * (rr || sp.r), y0 = sp.y + uy / ul * (rr || sp.r);
      d.line.setAttribute('points', `${x0.toFixed(1)},${y0.toFixed(1)} ${cx.toFixed(1)},${cy.toFixed(1)}`);
      if (rr) { d.ring.setAttribute('cx', sp.x.toFixed(1)); d.ring.setAttribute('cy', sp.y.toFixed(1)); d.ring.setAttribute('r', rr.toFixed(1)); d.ring.style.display = ''; }
      else d.ring.style.display = 'none';
      d.lab.style.transform = `translate(${cx.toFixed(1)}px, ${cy.toFixed(1)}px)`;
      d.g.style.opacity = d.lab.style.opacity = a.toFixed(3); d.shown = true;
      return;
    }
    if (d.shown) { d.g.style.opacity = d.lab.style.opacity = '0'; d.shown = false; }
  });
}

/* ---------- clock, input, resize ---------- */
const params = new URLSearchParams(location.search);
const startT = Math.min(Math.max(parseFloat(params.get('t')) || 0, 0), LOOP - 0.001);
let playing = !params.has('freeze'), base0 = performance.now(), offset = startT;
const nowT = now => playing ? (((offset + (now - base0) / 1000) % LOOP) + LOOP) % LOOP : offset;
function pause(now) { offset = nowT(now); playing = false; }
function play(now) { base0 = now; playing = true; }
window.addEventListener('keydown', e => {
  const now = performance.now();
  if (e.code === 'Space') { e.preventDefault(); playing ? pause(now) : play(now); }
  else if (e.code === 'KeyR') { offset = 0; base0 = now; }
  else if (e.code === 'KeyH') frameEl.classList.toggle('nolabels');
});
function resize() {
  const s = Math.max(1, Math.floor(Math.min(frameEl.clientWidth, frameEl.clientHeight)));
  const pr = Math.min(window.devicePixelRatio || 1, 2, 1440 / s);
  renderer.setPixelRatio(pr); renderer.setSize(s, s, false);
  ldSvg.setAttribute('viewBox', `0 0 ${frameEl.clientWidth} ${frameEl.clientHeight}`);
  resizePost(s, pr);
  camera.aspect = 1; camera.updateProjectionMatrix();
  DPR_U.value = pr; frameEl.__s = s;
}
window.addEventListener('resize', resize);
resize();

const PREV = { T: new THREE.Vector3(), D: 1, q: new THREE.Quaternion() }, _fw = new THREE.Vector3();
function cameraMotion(tau) {
  // the camera 1/40 s earlier (authored time), for motion blur
  const h = 1 / 40, c = evalCamera(Math.max(0, tau - h));
  PREV.T.copy(c.T); PREV.D = c.D; PREV.q.copy(c.q);
}
function renderAt(tPlay) {
  const tau = WARP.toTau(tPlay);
  cameraMotion(tau);
  placeCamera(tau);
  PXR_U.value = (frameEl.__s / 2) / Math.tan(CAM.fov * deg / 2);
  applyState(tau);
  scene.updateMatrixWorld(true);
  applyCaption(tau); applyHud(); applyScale(); applyTags(tau);
  const obst = []; applyCallouts(tau, obst); applyLeaders(tau, obst);
  // motion blur: zoom about the previous subject, plus the turn of the view direction
  {
    const zoom = 1 - CAM.D / PREV.D;                                   // >0 when pulling back
    _cv.copy(PREV.T).sub(CAM.T).multiplyScalar(1 / CAM.D).project(camera);
    const c = V3(_cv.x * 0.5 + 0.5, _cv.y * 0.5 + 0.5, 0);
    _fw.set(0, 0, -1).applyQuaternion(PREV.q).add(camera.position);    // where the view pointed before, projected now
    _fw.project(camera);
    const sh = new THREE.Vector2(_fw.x * 0.5, _fw.y * 0.5);
    const mag = Math.abs(zoom) * 0.7 + sh.length();
    mblurPass.uniforms.uC.value.set(clamp(c.x, -0.5, 1.5), clamp(c.y, -0.5, 1.5));
    mblurPass.uniforms.uZoom.value = zoom * 0.75; mblurPass.uniforms.uShift.value.copy(sh).multiplyScalar(0.6);
    mblurPass.uniforms.uAmt.value = 0.85 * smoother(clamp01((mag - 0.006) / 0.03));
    if (window.__bw && window.__bw._dbg.flags.noMB) mblurPass.uniforms.uAmt.value = 0;
  }
  // exposure: a star filling the view darkens everything else, as a camera would
  // (the lineup is exposed for sunlit planets, a stop darker than the map; a star filling the view darkens it further)
  // (and like a camera, it stops down when a sunlit planet fills the view, which keeps the surface's tones)
  // (applied before the bloom, so a star filling the view does not flood the frame with glow; the tone map then runs at 1)
  mblurPass.uniforms.uExposure.value = lerp(1, 0.68, STAND) * (1 - 0.3 * GLARE) / (1 + 0.6 * EXPO.cover);
  renderer.toneMappingExposure = 1;
  grainPass.uniforms.uSeed.value = (Math.floor(tau * 24) % 97) * 1.37;
  const mwLocal = CAM_POS.clone().multiplyScalar(1 / KM.KPC).sub(GC), inMW = Math.abs(mwLocal.z) < 1.4 && Math.hypot(mwLocal.x, mwLocal.y) < 17;
  const vs = inMW && skyMixNow < 0.5 ? 0.5 : 0.72, want = Math.round(frameEl.__s * renderer.getPixelRatio() * vs);
  if (volRT.width !== want) volRT.setSize(want, want);
  renderer.setRenderTarget(volRT); renderer.setClearColor(0x000000, 0); renderer.clear(); if (!window.__bw || !window.__bw._dbg.flags.noVol) renderer.render(volScene, volCam);
  renderer.setRenderTarget(null);
  composer.render();
  if (window.__bw && window.__bw._dbg.flags.nanWatch) {            // QA: record frames whose input to the post chain holds NaN / Inf
    const rt = composer.readBuffer, n = rt.width * rt.height * 4;
    const w = window.__bw._dbg.flags.nanWatch; w.buf = w.buf && w.buf.length === n ? w.buf : new Uint16Array(n);
    renderer.setRenderTarget(null);
    const probe = new THREE.WebGLRenderTarget(rt.width, rt.height, { type: THREE.HalfFloatType });
    renderer.setRenderTarget(probe); renderer.clear(); renderer.render(scene, camera); renderer.setRenderTarget(null);
    renderer.readRenderTargetPixels(probe, 0, 0, rt.width, rt.height, w.buf); probe.dispose();
    let nan = 0, inf = 0, first = -1; for (let i = 0; i < n; i++) { const h = w.buf[i]; if ((h & 0x7c00) === 0x7c00) { if (h & 0x03ff) nan++; else inf++; if (first < 0) first = i; } }
    if (nan + inf) (w.log = w.log || []).push([+tau.toFixed(3), nan, inf, first >= 0 ? [(first / 4) % rt.width, Math.floor(first / 4 / rt.width)] : null]);
  }
}
const FT = new Float32Array(20000); let ftN = 0, lastNow = 0;
function frame(now) {
  if (lastNow) { FT[ftN % FT.length] = now - lastNow; ftN++; }
  lastNow = now;
  renderAt(nowT(now));
  requestAnimationFrame(frame);
}
window.__bw = {
  LOOP, LOOP_T, KEYS, LCAPS, FACTS, BODY, STEP, MAP, INTRO, LEADER_DEF, CALLOUTS, SEQ,
  seek(tp) { offset = ((tp % LOOP) + LOOP) % LOOP; playing = false; renderAt(offset); return offset; },
  play() { play(performance.now()); },
  resetStats() { ftN = 0; },
  time() { return nowT(performance.now()); },
  field() { return fieldNow(); },
  stats() {
    const n = Math.min(ftN, FT.length), a = Array.from(FT.slice(0, n)).sort((x, y) => x - y);
    const mean = a.reduce((s, v) => s + v, 0) / Math.max(1, n);
    return { frames: ftN, meanMs: +mean.toFixed(2), fps: +(1000 / mean).toFixed(1), p95Ms: +(a[Math.floor(n * 0.95)] || 0).toFixed(2),
      over25ms: a.filter(v => v > 25).length, pixelRatio: renderer.getPixelRatio(), drawCalls: renderer.info.render.calls };
  },
  camAt(tp) { const tau = WARP.toTau(tp); placeCamera(tau); return { tau, pos: CAM_POS.toArray(), D: CAM.D, T: CAM.T.toArray(), field: fieldNow() }; },
  // QA: is the camera ever inside a body of the lineup (while that body is drawn)? every 20 ms of authored time
  insideCheck() {
    const hits = [];
    for (let tau = 0; tau < LOOP_T; tau += 0.02) {
      placeCamera(tau);
      TAU_NOW = tau;
      for (const b of LINEUP) {
        if (b.key !== 'earth' && introAt(b.key)[0] <= 0) continue;          // not drawn at this moment
        const f = FACTS[b.key], rr = Math.max(f.req || b.r, b.r) * (b.key === 'saturn' ? 1.0 : 1.0);
        if (CAM_POS.distanceTo(b.pos) < rr * 1.01) hits.push([+tau.toFixed(2), b.key]);
      }
    }
    return { samples: Math.round(LOOP_T / 0.02), hits: hits.length, first: hits.slice(0, 20) };
  },
  _patch() {},
  _dbg: { VOLU, bloom, volRT, tmrs, ungc, starPoints, kuiper, oort, lb, volScene, flags: {}, MW_STARS, lbSkin, lineupGroup, LINE_MATS, planetMarks, voyMarks, p9Mark, ssMarks, obsSphere, volBg, scene, screen: k => screenOf(BODY[k]), comp: k => compFrame(BODY[k]),
    nanScan() {                                   // QA: NaN / Inf in the HDR scene render and in the volume target
      const count = (rt) => { const n = rt.width * rt.height * 4, buf = new Uint16Array(n); renderer.readRenderTargetPixels(rt, 0, 0, rt.width, rt.height, buf);
        let nan = 0, inf = 0; for (let i = 0; i < n; i++) { const h = buf[i]; if ((h & 0x7c00) === 0x7c00) { if (h & 0x03ff) nan++; else inf++; } } return { nan, inf }; };
      const rt = new THREE.WebGLRenderTarget(frameEl.__s, frameEl.__s, { type: THREE.HalfFloatType });
      renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 1); renderer.clear(); renderer.render(scene, camera); renderer.setRenderTarget(null);
      const a = count(rt); rt.dispose(); return { scene: a, vol: count(volRT) };
    }, expo: () => ({ exp: mblurPass.uniforms.uExposure.value, cover: EXPO.cover, pcover: EXPO.pcover, stand: STAND }), cam: () => ({ T: CAM.T.toArray(), D: CAM.D, fov: CAM.fov }),
    skyDump(w = 1536, h = 768, exp = 2.0) {        // the baked sky as a tone-mapped PNG (QA)
      const W = SKY_W, H = SKY_H, buf = new Uint16Array(W * H * 4); renderer.readRenderTargetPixels(skyRT, 0, 0, W, H, buf);
      const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'), im = g.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const sx = Math.floor(x / w * W), sy = Math.floor((1 - y / h) * H) - 1;
        for (let k = 0; k < 3; k++) { const v = THREE.DataUtils.fromHalfFloat(buf[(Math.max(0, sy) * W + sx) * 4 + k]) * exp; im.data[(y * w + x) * 4 + k] = 255 * Math.pow(v / (1 + v), 1 / 2.2); }
        im.data[(y * w + x) * 4 + 3] = 255; }
      g.putImageData(im, 0, 0); return c.toDataURL('image/png');
    } },
};
