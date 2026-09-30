
/* =====================================================================================
   4. THE PRODUCT, OUTSIDE — knit shell with a rounded shoulder, a diamond-cut aluminium ring with hairline brushing around a
   recessed black glass top (printed icons, a ring of light beneath), a rubber base with a parting line, a debossed tag,
   a status light. Everything that the exploded view will show is modelled in place (p5).
   ===================================================================================== */
const R = FACTS.body.r, TOP = FACTS.body.h;
const PRODUCT = new THREE.Group(); universe.add(PRODUCT);
// a lathe profile sampled at even arc length (so textures don't stretch along it)
function profile(segs, step = 0.08) {          // segs: [['line', [r0, y0], [r1, y1]] | ['arc', [cr, cy], rad, a0, a1]]
  const pts = [];
  for (const s of segs) {
    if (s[0] === 'line') { const [, a, b] = s, L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.max(1, Math.ceil(L / step));
      for (let i = pts.length ? 1 : 0; i <= n; i++) pts.push(new THREE.Vector2(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n)); }
    else { const [, c, rad, a0, a1] = s, n = Math.max(2, Math.ceil(Math.abs(a1 - a0) * rad / step));
      for (let i = 1; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push(new THREE.Vector2(c[0] + rad * Math.cos(a), c[1] + rad * Math.sin(a))); } }
  }
  return pts;
}
const MAT = {
  knit: new THREE.MeshPhysicalMaterial({ map: texOf(KNIT.color, { srgb: true, repeat: [17, 6.3] }), normalMap: texOf(KNIT.normal, { repeat: [17, 6.3] }),
    normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.93, metalness: 0,                // (fabric is rough everywhere: shiny crevices sparkle like glitter)
    sheen: 0.7, sheenRoughness: 0.5, sheenColor: new THREE.Color(0.55, 0.58, 0.63), envMapIntensity: 0.45 }),
  brushed: new THREE.MeshPhysicalMaterial({ color: 0xd4d7dc, metalness: 1, roughness: 0.34, normalMap: texOf(BRUSH.normal, { aniso: 16 }), normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.25 }),
  polished: new THREE.MeshPhysicalMaterial({ color: 0xe6e8ec, metalness: 1, roughness: 0.16, envMapIntensity: 1.0 }),    // the diamond-cut chamfers
  glass: new THREE.MeshPhysicalMaterial({ color: 0x050607, metalness: 0, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.3, ior: 1.5, specularIntensity: 1 }),
  rubber: new THREE.MeshPhysicalMaterial({ color: 0x111215, metalness: 0, roughness: 0.78, envMapIntensity: 0.5, sheen: 0.3, sheenColor: new THREE.Color(0.3, 0.32, 0.35) }),
  gap: new THREE.MeshBasicMaterial({ color: 0x020203 }),
};
// the knit shell: straight wall, then a 0.6 cm shoulder rolling onto the top
const SHELL = new THREE.Group(); PRODUCT.add(SHELL);
SHELL.add(new THREE.Mesh(new THREE.LatheGeometry(profile([['line', [R, 1.2], [R, TOP - 0.6]], ['arc', [R - 0.6, TOP - 0.6], 0.6, 0, Math.PI / 2]]), 256), MAT.knit));
MAT.knit.side = THREE.DoubleSide; MAT.knit.userData.thin = true;   // the knit is a thin shell: when it lifts, its inside is seen (QA surfaces)
// the parting line between shell and base
{ const g = new THREE.Mesh(new THREE.TorusGeometry(R - 0.01, 0.028, 8, 256), MAT.gap); g.rotation.x = Math.PI / 2; g.position.y = 1.2; PRODUCT.add(g); }
// the top: diamond-cut outer chamfer, brushed flat ring, polished inner chamfer, recessed glass
const CAP = new THREE.Group(); PRODUCT.add(CAP);
CAP.add(new THREE.Mesh(new THREE.LatheGeometry(profile([['line', [R - 0.62, TOP - 0.04], [R - 0.78, TOP + 0.03]]], 0.02), 256), MAT.polished));
{ const ring = new THREE.Mesh(new THREE.RingGeometry(4.35, R - 0.78, 256, 1), MAT.brushed); ring.rotation.x = -Math.PI / 2; ring.position.y = TOP + 0.03; CAP.add(ring);
  // (RingGeometry's UVs are planar, so the brushing map stays concentric) }
}
CAP.add(new THREE.Mesh(new THREE.LatheGeometry(profile([['line', [4.35, TOP + 0.03], [4.25, TOP - 0.005]]], 0.02), 256), MAT.polished));
const GLASS = new THREE.Mesh(new THREE.CircleGeometry(4.26, 128), MAT.glass); GLASS.rotation.x = -Math.PI / 2; GLASS.position.y = TOP - 0.005; CAP.add(GLASS);
{ const under = new THREE.Mesh(new THREE.CircleGeometry(R - 0.6, 128), MAT.rubber); under.rotation.x = Math.PI / 2; under.position.y = TOP - 0.06; CAP.add(under); }   // the cap's underside: seen from below when it lifts (QA surfaces)
// printed icons on the glass (+, −, play/pause, the microphone), a faint warm white
const ICONS = new THREE.Mesh(new THREE.CircleGeometry(4.2, 64), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, toneMapped: true,
  map: texOf(canvas2d(1024, 1024, (g, W) => {
    g.clearRect(0, 0, W, W); g.strokeStyle = g.fillStyle = 'rgba(235,238,242,0.8)'; g.lineWidth = 7; g.lineCap = 'round';
    const c = W / 2, s = W * 0.05;
    const at = (a, r) => [c + Math.cos(a) * r, c + Math.sin(a) * r];
    let [x, y] = at(0, W * 0.2); g.beginPath(); g.moveTo(x - s, y); g.lineTo(x + s, y); g.moveTo(x, y - s); g.lineTo(x, y + s); g.stroke();     // +
    [x, y] = at(Math.PI, W * 0.2); g.beginPath(); g.moveTo(x - s, y); g.lineTo(x + s, y); g.stroke();                                           // −
    g.beginPath(); g.moveTo(c - s * 0.6, c - s * 0.8); g.lineTo(c + s * 0.8, c); g.lineTo(c - s * 0.6, c + s * 0.8); g.closePath(); g.fill();      // ▶
    g.fillRect(c + s * 1.1, c - s * 0.8, s * 0.3, s * 1.6); g.fillRect(c + s * 1.6, c - s * 0.8, s * 0.3, s * 1.6);                              // ❚❚
    [x, y] = at(-Math.PI / 2, W * 0.2); g.beginPath(); g.roundRect(x - s * 0.35, y - s * 0.8, s * 0.7, s * 1.2, s * 0.35); g.stroke();            // mic
    g.beginPath(); g.arc(x, y - s * 0.1, s * 0.65, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); g.beginPath(); g.moveTo(x, y + s * 0.55); g.lineTo(x, y + s * 0.9); g.stroke();
  }), { srgb: true }) }));
ICONS.rotation.x = -Math.PI / 2; ICONS.position.y = TOP - 0.001; CAP.add(ICONS);
// the ring of light under the glass: a soft band with a brighter arc that travels round it (loop-periodic, uPh)
const LIGHT_RING = new THREE.Mesh(new THREE.RingGeometry(2.7, 3.7, 256, 1), new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  uniforms: { uPh: { value: 0 }, uOn: { value: 1 } },
  vertexShader: 'varying vec2 vP; void main(){ vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
  fragmentShader: `uniform float uPh; uniform float uOn; varying vec2 vP;
    void main(){ float r = length(vP), a = atan(vP.y, vP.x);
      float band = exp(-pow((r - 3.2) / 0.07, 2.0)) + 0.35 * exp(-pow((r - 3.2) / 0.28, 2.0));      // a crisp line in a soft glow (light through smoked glass)
      float arc = pow(0.5 + 0.5 * cos(a - uPh), 6.0);
      vec3 col = mix(vec3(0.25, 0.55, 1.0), vec3(0.75, 0.45, 1.0), 0.5 + 0.5 * sin(a * 2.0 + uPh));
      gl_FragColor = vec4(col * band * (0.35 + 2.2 * arc) * uOn, 1.0); }` }));
LIGHT_RING.rotation.x = -Math.PI / 2; LIGHT_RING.position.y = TOP; CAP.add(LIGHT_RING);
// the base: a rubber foot with a rounded edge, and the status light at the front
const BASE = new THREE.Group(); PRODUCT.add(BASE);
BASE.add(new THREE.Mesh(new THREE.LatheGeometry(profile([['line', [0, 0.02], [R - 0.45, 0.02]], ['arc', [R - 0.45, 0.47], 0.45, -Math.PI / 2, 0], ['line', [R, 0.47], [R, 1.22]]], 0.05), 256), MAT.rubber));
MAT.rubber.side = THREE.DoubleSide; MAT.rubber.userData.thin = true;   // the base is a cup: seen from above once the insides lift
MAT.polished.side = MAT.brushed.side = THREE.DoubleSide; MAT.polished.userData.thin = MAT.brushed.userData.thin = true;   // the cap's bevel rings are thin sheets
{ const led = new THREE.Mesh(new THREE.SphereGeometry(0.06, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.4, 1.5, 1.6) })); led.position.set(0, 0.8, R + 0.01); BASE.add(led); }
// a small rubber tag on the knit, debossed with the name
{ const tagTex = canvas2d(512, 144, (g, W, H) => { g.fillStyle = '#16171a'; g.fillRect(0, 0, W, H); g.fillStyle = '#2b2d31';
    g.font = '600 78px "Barlow", "Helvetica Neue", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.letterSpacing = '18px'; g.fillText('AURA', W / 2 + 9, H / 2 + 4); });
  const tag = new THREE.Mesh(new RoundedBoxGeometry(2.0, 0.56, 0.12, 3, 0.05), [MAT.rubber, MAT.rubber, MAT.rubber, MAT.rubber,
    new THREE.MeshPhysicalMaterial({ map: texOf(tagTex, { srgb: true }), roughness: 0.7, envMapIntensity: 0.5 }), MAT.rubber]);
  tag.position.set(0, 2.5, R + 0.03); SHELL.add(tag); }
