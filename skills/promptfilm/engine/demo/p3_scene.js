
/* =====================================================================================
   3. SCENE (engine demo) — four bodies side by side at true relative size, bottoms on one line. World unit: km.
   Replace this part (and p8) with the film's own scene; keep one FACTS object as the source of every number.
   ===================================================================================== */
const FACTS = Object.freeze({
  moon:    { r: 1737.4, src: 'NASA Moon fact sheet (mean radius)' },
  earth:   { r: 6371.0, src: 'NASA Earth fact sheet (mean radius)' },
  jupiter: { r: 69911, src: 'NASA Jupiter fact sheet (mean radius)' },
  sun:     { r: 695700, src: 'IAU 2015 nominal solar radius' },
});
// the row: left to right. Each gap is wide enough that the next body stays outside the close view of the one before it
// (so nothing looms at the edge before its turn)
const ROW = ['moon', 'earth', 'jupiter', 'sun'];
const BODY = {};
{
  let x = 0, prev = null;
  for (const k of ROW) {
    const r = FACTS[k].r;
    if (prev) x += prev.r + 0.6 * Math.min(prev.r, r) + 0.12 * Math.max(prev.r, r) + r;
    BODY[k] = { key: k, r, pos: V3(x, r, 0) };           // bottoms on y = 0
    prev = BODY[k];
  }
}
const LIGHT_DIR = V3(-0.75, 0.35, 0.56).normalize();       // world direction towards the light (upper left, in front)
const _lv = new THREE.Vector3();

// lit bodies: one shader, a look per body (mottled grey, ocean/land/cloud, bands); a soft terminator and a thin limb haze
const PLANET_VS = `varying vec3 vN; varying vec3 vObj; varying vec3 vV;
  void main() { vObj = position; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`;
const PLANET_FS = `uniform vec3 uLightV; uniform int uLook; uniform float uSpin; uniform float uFade; varying vec3 vN; varying vec3 vObj; varying vec3 vV;
  ${NOISE_GLSL}
  void main() {
    vec3 n = normalize(vN), v = normalize(vV), p = normalize(vObj);
    float cs = cos(uSpin), sn = sin(uSpin); vec3 q = vec3(cs * p.x + sn * p.z, p.y, -sn * p.x + cs * p.z);
    vec3 alb;
    if (uLook == 0) { float m = fbm(q * 4.0, 5), c = fbm(q * 18.0, 3); alb = mix(vec3(0.34), vec3(0.62, 0.61, 0.59), smoothstep(0.35, 0.65, m)) * (0.85 + 0.3 * c); }
    else if (uLook == 1) {
      // edges widened to at least a pixel (fwidth): a hard procedural edge crawls and shimmers as the globe turns
      float ln = fbm(q * 2.3 + 3.0, 5), lw = max(0.02, 1.5 * fwidth(ln)); float land = smoothstep(0.54 - lw, 0.54 + lw, ln);
      float cn = fbm(q * 3.5 + vec3(0.0, 0.0, 7.0), 5), cw = max(0.15, 1.5 * fwidth(cn)); float cl = smoothstep(0.65 - cw, 0.65 + cw, cn);
      alb = mix(vec3(0.02, 0.07, 0.18), mix(vec3(0.16, 0.24, 0.1), vec3(0.45, 0.38, 0.26), fbm(q * 6.0, 3)), land);
      alb = mix(alb, vec3(0.92), cl * 0.9); alb = mix(alb, vec3(0.95), smoothstep(0.8, 0.92, abs(q.y))); }
    else { float y = q.y + 0.04 * (fbm(q * 5.0, 4) - 0.5); float b = sin(y * 26.0) * 0.5 + 0.5;
      alb = mix(vec3(0.72, 0.6, 0.46), vec3(0.93, 0.88, 0.8), b); alb = mix(alb, vec3(0.62, 0.42, 0.3), smoothstep(0.55, 0.9, fbm(vec3(y * 30.0, q.xz * 3.0), 3)) * 0.35); }
    float ndl = dot(n, uLightV), lit = smoothstep(-0.06, 0.25, ndl) * (0.25 + 0.75 * clamp(ndl, 0.0, 1.0));
    vec3 col = alb * lit * 2.6 + alb * 0.012;
    float rim = pow(1.0 - clamp(dot(n, v), 0.0, 1.0), 4.0) * smoothstep(-0.2, 0.4, ndl);
    col += (uLook == 1 ? vec3(0.35, 0.6, 1.0) : vec3(0.5)) * rim * (uLook == 1 ? 0.9 : 0.15);
    gl_FragColor = vec4(col, uFade);
  }`;
const SPHERE = new THREE.SphereGeometry(1, 128, 64);
['moon', 'earth', 'jupiter'].forEach((k, i) => {
  const m = new THREE.ShaderMaterial({ vertexShader: PLANET_VS, fragmentShader: PLANET_FS, uniforms: { uLightV: { value: new THREE.Vector3() }, uLook: { value: i }, uSpin: { value: 0 }, uFade: { value: 1 } }, transparent: true });
  const mesh = new THREE.Mesh(SPHERE, m); mesh.position.copy(BODY[k].pos); mesh.scale.setScalar(BODY[k].r); universe.add(mesh);
  BODY[k].mesh = mesh;
});
// the Sun: a hot, slowly boiling surface with a darker limb (emissive, above the bloom threshold) and a soft glow
const SUN_FS = `uniform float uPh; uniform float uFade; varying vec3 vN; varying vec3 vObj; varying vec3 vV;
  ${NOISE_GLSL}
  void main() {
    vec3 n = normalize(vN), v = normalize(vV), p = normalize(vObj); float mu = clamp(dot(n, v), 0.0, 1.0);
    vec3 w = vec3(cos(uPh), sin(uPh), 0.0);               // loop-periodic motion: the surface boils and returns to its first state
    float g = fbm(p * 9.0 + w * 0.8, 5), gr = fbm(p * 60.0 + w * 0.3, 3);
    float I = (0.75 + 0.35 * g + 0.12 * gr) * (0.35 + 0.65 * pow(mu, 0.55));
    vec3 col = mix(vec3(1.0, 0.42, 0.08), vec3(1.0, 0.86, 0.55), smoothstep(0.55, 1.05, I));
    gl_FragColor = vec4(col * I * 3.2, uFade);
  }`;
{
  const m = new THREE.ShaderMaterial({ vertexShader: PLANET_VS, fragmentShader: SUN_FS, uniforms: { uPh: { value: 0 }, uFade: { value: 1 } }, transparent: true });
  const mesh = new THREE.Mesh(SPHERE, m); mesh.position.copy(BODY.sun.pos); mesh.scale.setScalar(BODY.sun.r); universe.add(mesh);
  BODY.sun.mesh = mesh;
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv * 2.0 - 1.0; vec4 c = modelViewMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      float s = length(modelMatrix[0].xyz) * length(viewMatrix[0].xyz); c.xy += position.xy * s; gl_Position = projectionMatrix * c; }`,
    uniforms: { uFade: { value: 1 } },
    fragmentShader: `uniform float uFade; varying vec2 vUv; void main() { float h = length(vUv) * 3.2; if (h < 1.0) discard;
      float g = (exp(-(h - 1.0) * 5.0) * 0.5 + exp(-(h - 1.0) * 16.0) * 1.0) * (1.0 - smoothstep(2.0, 3.2, h));   // in proportion to the disc
      gl_FragColor = vec4(vec3(1.0, 0.62, 0.25) * g * uFade, 1.0); }`,
  }));
  glow.position.copy(BODY.sun.pos); glow.scale.setScalar(BODY.sun.r * 3.2); universe.add(glow);
  BODY.sun.glow = glow;
}
// a quiet star background: directions only (drawn around the eye, so it never moves with the zoom)
let STARS;
{
  const N = 5000, rnd = mulberry32(7), pos = new Float32Array(N * 3), mag = new Float32Array(N);
  for (let i = 0; i < N; i++) { const z = rnd() * 2 - 1, a = rnd() * Math.PI * 2, s = Math.sqrt(1 - z * z);
    pos.set([s * Math.cos(a) * 4000, z * 4000, s * Math.sin(a) * 4000], i * 3); mag[i] = Math.pow(rnd(), 3); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aMag', new THREE.BufferAttribute(mag, 1));
  STARS = new THREE.Points(g, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uDpr: { value: 1 } },
    vertexShader: `attribute float aMag; uniform float uDpr; varying float vB; void main() { vB = 0.15 + 0.85 * aMag; gl_PointSize = (1.0 + 1.6 * aMag) * uDpr;
      gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `varying float vB; void main() { vec2 d = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.15, length(d)); gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * vB * a * 0.8, 1.0); }` }));
  STARS.renderOrder = -1; STARS.frustumCulled = false; scene.add(STARS);
}
