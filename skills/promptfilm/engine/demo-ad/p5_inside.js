
/* =====================================================================================
   5. THE PRODUCT, INSIDE — present from the first frame, hidden by the shell until it lifts away (a real disassembly, P7 b).
   A 9 cm woofer (cast basket with six spokes, paper cone, rolled rubber surround, dust cap, corrugated spider, ferrite magnet
   between plated pole plates), three tweeters in horn waveguides on a mounting ring, the logic board (solder mask, pads,
   SoC, shield can, capacitors, inductors, connectors, passives), the battery pack in its printed wrap, and the centre spine.
   ===================================================================================== */
const IM = {
  castAl: new THREE.MeshPhysicalMaterial({ color: 0x3a3d42, metalness: 0.85, roughness: 0.48, envMapIntensity: 1.0 }),
  plated: new THREE.MeshPhysicalMaterial({ color: 0xd8dade, metalness: 1, roughness: 0.18, envMapIntensity: 1.3 }),
  ferrite: new THREE.MeshPhysicalMaterial({ color: 0x1a1b1d, metalness: 0.1, roughness: 0.62, envMapIntensity: 0.6 }),
  paper: new THREE.MeshPhysicalMaterial({ map: texOf(PAPER, { srgb: true, repeat: [3, 1] }), roughness: 0.9, side: THREE.DoubleSide, envMapIntensity: 0.5 }),
  rubberG: new THREE.MeshPhysicalMaterial({ color: 0x141517, roughness: 0.55, clearcoat: 0.3, clearcoatRoughness: 0.4, envMapIntensity: 0.7 }),
  spider: new THREE.MeshPhysicalMaterial({ color: 0x8f7043, roughness: 0.92, sheen: 0.4, sheenColor: new THREE.Color(0.6, 0.5, 0.35), side: THREE.DoubleSide }),
  silk: new THREE.MeshPhysicalMaterial({ color: 0x2a2b2e, roughness: 0.5, sheen: 0.8, sheenRoughness: 0.35, sheenColor: new THREE.Color(0.5, 0.5, 0.55), envMapIntensity: 0.8 }),
  plastic: new THREE.MeshPhysicalMaterial({ color: 0x1b1c1f, roughness: 0.55, envMapIntensity: 0.6 }),
  gloss: new THREE.MeshPhysicalMaterial({ color: 0x0c0d0f, roughness: 0.2, clearcoat: 0.6, envMapIntensity: 1.0 }),
};
// a lathed profile is an open sheet: once the parts spread, the camera sees their insides too — every inner part is two-sided
// (a one-sided sheet shows a hole from behind; QA surfaces)
Object.values(IM).forEach(m => { m.side = THREE.DoubleSide; m.userData.thin = true; });
const lathe = (segs, mat, n = 192, step = 0.05) => new THREE.Mesh(new THREE.LatheGeometry(profile(segs, step), n), mat);

// ---- the woofer (origin: the mounting rim; the cone faces up) ----
const WOOFER = new THREE.Group(); PRODUCT.add(WOOFER);
{
  WOOFER.add(lathe([['line', [3.95, 0.0], [4.55, 0.0]], ['line', [4.55, 0.0], [4.55, -0.18]], ['line', [4.55, -0.18], [3.95, -0.18]]], IM.castAl));
  WOOFER.add(new THREE.Mesh(new THREE.LatheGeometry(profile([['arc', [3.92, 0.02], 0.24, 0, Math.PI]], 0.02), 192), IM.rubberG));   // the rolled surround
  const cone = []; for (let i = 0; i <= 40; i++) { const u = i / 40; cone.push(new THREE.Vector2(3.68 - 2.3 * u, 0.02 - 1.55 * Math.pow(u, 0.8))); }
  WOOFER.add(new THREE.Mesh(new THREE.LatheGeometry(cone, 192), IM.paper));
  const cap = new THREE.Mesh(new THREE.SphereGeometry(1.42, 64, 16, 0, Math.PI * 2, 0, Math.PI / 2), IM.gloss); cap.scale.set(1, 0.42, 1); cap.position.y = -1.5; WOOFER.add(cap);
  const sp = []; for (let i = 0; i <= 120; i++) { const u = i / 120, r = 1.45 + u * 1.9; sp.push(new THREE.Vector2(r, -1.95 + 0.07 * Math.sin(u * Math.PI * 12))); }
  WOOFER.add(new THREE.Mesh(new THREE.LatheGeometry(sp, 160), IM.spider));
  for (let k = 0; k < 6; k++) {                                                                   // the basket's six spokes
    const a = k / 6 * Math.PI * 2 + Math.PI / 6, p0 = V3(Math.cos(a) * 4.3, -0.1, Math.sin(a) * 4.3), p1 = V3(Math.cos(a) * 2.0, -2.35, Math.sin(a) * 2.0);
    const L = p0.distanceTo(p1), sp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.14, L), IM.castAl);
    sp.position.copy(p0).lerp(p1, 0.5); sp.lookAt(p1); WOOFER.add(sp);
  }
  WOOFER.add(lathe([['line', [0.45, -2.3], [2.25, -2.3]], ['line', [2.25, -2.3], [2.25, -2.52]], ['line', [2.25, -2.52], [0.45, -2.52]]], IM.plated));
  WOOFER.add(lathe([['line', [1.0, -2.52], [2.38, -2.52]], ['line', [2.38, -2.52], [2.38, -3.32]], ['line', [2.38, -3.32], [1.0, -3.32]]], IM.ferrite));
  WOOFER.add(lathe([['line', [0.3, -3.32], [2.25, -3.32]], ['line', [2.25, -3.32], [2.25, -3.52]], ['line', [2.25, -3.52], [0.3, -3.52]]], IM.plated));
  for (const [x, col] of [[-0.5, 0xb3261e], [0.5, 0x1a1a1a]]) { const t = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.12, 0.3, 2, 0.04), new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.4 }));
    t.position.set(x, 0.05, 4.25); WOOFER.add(t); }
}
// ---- three tweeters in horn waveguides on a mounting ring (origin: ring centre) ----
const TWEETERS = new THREE.Group(); PRODUCT.add(TWEETERS);
{
  const ring = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.22, 16, 160), IM.plastic); ring.rotation.x = Math.PI / 2; TWEETERS.add(ring);
  for (let k = 0; k < FACTS.tweeter.n; k++) {
    const a = k / FACTS.tweeter.n * Math.PI * 2 + Math.PI / 2, tw = new THREE.Group();
    tw.add(lathe([['line', [0.55, 0], [1.15, 0.55]], ['line', [1.15, 0.55], [1.25, 0.55]]], IM.gloss, 96, 0.03));         // the horn
    tw.add(lathe([['line', [1.2, 0.5], [1.32, 0.58]], ['line', [1.32, 0.58], [1.32, 0.66]]], IM.plated, 96, 0.02));        // its polished lip
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.56, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), IM.silk); dome.scale.y = 0.7; tw.add(dome);
    tw.add(lathe([['line', [0.2, -0.05], [1.0, -0.05]], ['line', [1.0, -0.05], [1.0, -0.75]], ['line', [1.0, -0.75], [0.2, -0.75]]], IM.plastic, 64));   // the body
    tw.position.set(Math.cos(a) * 3.9, 0.2, Math.sin(a) * 3.9);
    tw.lookAt(Math.cos(a) * 20, 3.0, Math.sin(a) * 20); tw.rotateX(Math.PI / 2);                     // facing out and a little up
    TWEETERS.add(tw);
  }
}
// ---- the logic board (origin: board centre) ----
const BOARD = new THREE.Group(); PRODUCT.add(BOARD);
{
  const PCB_TEX = texOf(canvas2d(1024, 1024, (g, W) => {
    g.fillStyle = '#0d1411'; g.fillRect(0, 0, W, W); const rnd = mulberry32(21);
    g.strokeStyle = 'rgba(40,70,55,0.9)'; g.lineWidth = 3;                                         // traces under the mask
    for (let k = 0; k < 220; k++) { let x = rnd() * W, y = rnd() * W; g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 4; s++) { if (rnd() < 0.5) x += (rnd() - 0.5) * 260; else y += (rnd() - 0.5) * 260; g.lineTo(x, y); } g.stroke(); }
    g.fillStyle = '#c9a24c'; for (let k = 0; k < 420; k++) { const x = rnd() * W, y = rnd() * W; g.fillRect(x, y, 6 + rnd() * 6, 4 + rnd() * 4); }   // pads
    g.strokeStyle = '#c9a24c'; g.lineWidth = 5; for (const [x, y] of [[180, 180], [844, 180], [180, 844], [844, 844]]) { g.beginPath(); g.arc(x, y, 22, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = 'rgba(230,232,228,0.85)'; g.font = '600 22px "Barlow", Arial, sans-serif';          // silkscreen
    for (let k = 0; k < 40; k++) g.fillText(['U', 'C', 'R', 'L', 'J'][k % 5] + (1 + Math.floor(rnd() * 40)), rnd() * W, rnd() * W);
    g.font = '600 30px "Barlow", Arial, sans-serif'; g.fillText('AURA MAIN · REV C · FICTIONAL', 330, 560);
  }), { srgb: true, aniso: 16 });
  const pcbSide = new THREE.MeshPhysicalMaterial({ color: 0x1a2a20, roughness: 0.6 });
  BOARD.add(new THREE.Mesh(new THREE.CylinderGeometry(4.7, 4.7, 0.16, 128), [pcbSide, new THREE.MeshPhysicalMaterial({ map: PCB_TEX, roughness: 0.45, clearcoat: 0.4, clearcoatRoughness: 0.35, envMapIntensity: 0.8 }), pcbSide]));
  const on = (mesh, h, x, z, rotY = 0) => { mesh.position.set(x, 0.08 + h / 2, z); mesh.rotation.y = rotY; BOARD.add(mesh); return mesh; };   // sits on the board
  const socTex = texOf(canvas2d(256, 256, (g, W) => { g.fillStyle = '#1c1e21'; g.fillRect(0, 0, W, W); g.fillStyle = '#6d7076'; g.font = '600 34px "Barlow", Arial';
    g.fillText('AURA', 60, 110); g.font = '500 22px "Barlow", Arial'; g.fillText('A1 · 2026', 62, 150); g.beginPath(); g.arc(34, 34, 8, 0, Math.PI * 2); g.fill(); }), { srgb: true });
  const soc = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.2, 1.6, 2, 0.05), [IM.gloss, IM.gloss, new THREE.MeshPhysicalMaterial({ map: socTex, roughness: 0.35, clearcoat: 0.5 }), IM.gloss, IM.gloss, IM.gloss]);
  on(soc, 0.2, -0.6, 0.4, 0.2);
  const can = new THREE.Mesh(new RoundedBoxGeometry(2.3, 0.28, 1.5, 2, 0.04), new THREE.MeshPhysicalMaterial({ color: 0xc8cbd0, metalness: 1, roughness: 0.3, envMapIntensity: 1.2 }));
  on(can, 0.28, 1.6, -1.2, 0.2);
  for (const [x, z] of [[1.9, 1.3], [2.5, 0.6], [-2.6, -1.1], [-2.2, 1.9], [0.4, -2.8], [-3.0, 0.2], [2.9, 1.9], [-1.2, -2.6]]) {       // capacitors
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.24, 0.5, 32), [new THREE.MeshPhysicalMaterial({ color: 0x1d2c5a, roughness: 0.45, clearcoat: 0.5 }), IM.plated, IM.plated]); on(c, 0.5, x, z); }
  for (const [x, z] of [[-1.6, 2.6], [0.9, 2.4], [-3.2, -1.9], [3.3, -0.5]]) { on(new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.34, 0.62, 2, 0.06), IM.ferrite), 0.34, x, z); }
  for (const [x, z, r] of [[3.4, 1.0, 1.4], [-3.6, 1.3, 0.3]]) { on(new THREE.Mesh(new RoundedBoxGeometry(0.9, 0.34, 0.36, 2, 0.03), new THREE.MeshPhysicalMaterial({ color: 0xe9e3d3, roughness: 0.5 })), 0.34, x, z, r); }
  const rnd = mulberry32(5), N = 90, pas = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.06, 0.08), new THREE.MeshPhysicalMaterial({ color: 0x8a7a64, roughness: 0.5 }), N), m4 = new THREE.Matrix4();
  for (let i = 0; i < N; i++) { const r = 1.2 + Math.sqrt(rnd()) * 3.2, a = rnd() * Math.PI * 2;
    m4.compose(V3(Math.cos(a) * r, 0.11, Math.sin(a) * r), new THREE.Quaternion().setFromAxisAngle(V3(0, 1, 0), Math.floor(rnd() * 2) * Math.PI / 2), V3(1, 1, 1)); pas.setMatrixAt(i, m4); }
  BOARD.add(pas);
}
// ---- the battery pack in its printed wrap (origin: its centre) ----
const BATTERY = new THREE.Group(); PRODUCT.add(BATTERY);
{
  const wrap = texOf(canvas2d(1024, 256, (g, W, H) => {
    g.fillStyle = '#1e3f73'; g.fillRect(0, 0, W, H); g.fillStyle = '#e8edf5'; g.font = '600 44px "Barlow", Arial'; g.fillText('AURA POWER', 60, 96);
    g.font = '500 26px "Barlow", Arial'; g.fillText(`Li-ion 7.2 V · 5,200 mAh · ${FACTS.battery.hours} h · fictional`, 60, 146);
    g.fillStyle = '#c9d3e3'; for (let k = 0; k < 40; k++) g.fillRect(640 + k * 7, 60, k % 3 ? 2 : 4, 90);                     // a barcode
    g.strokeStyle = '#e8edf5'; g.lineWidth = 3; g.strokeRect(60, 176, 120, 44); g.fillStyle = '#e8edf5'; g.fillRect(180, 190, 10, 16);
  }), { srgb: true, aniso: 16 });
  BATTERY.add(new THREE.Mesh(new THREE.CylinderGeometry(2.15, 2.15, 4.0, 128, 1, true), new THREE.MeshPhysicalMaterial({ map: wrap, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.9 })));
  for (const y of [2.0, -2.0]) { const e = lathe([['line', [0, y], [2.15, y]], ['line', [2.15, y], [2.15, y - Math.sign(y) * 0.06]]], IM.plated, 96); BATTERY.add(e); }
  const nub = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.12, 32), IM.plated); nub.position.y = 2.06; BATTERY.add(nub);
}
// ---- the centre spine (stays in place) ----
const SPINE = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 13.6, 32), IM.plated); SPINE.position.y = 1.2 + 6.8; PRODUCT.add(SPINE);

// where each part sits assembled and in the exploded view (y of its origin, cm). Outer parts lift first, the insides then spread
// along the axis; nothing passes through anything (the shell's inside radius clears every inner part).
const PARTS = {
  cap:      { obj: CAP, y0: 0, y1: 29, outer: true },
  shell:    { obj: SHELL, y0: 0, y1: 25, outer: true },
  tweeters: { obj: TWEETERS, y0: 14.3, y1: 22.5 },
  woofer:   { obj: WOOFER, y0: 11.4, y1: 16.5 },
  board:    { obj: BOARD, y0: 5.9, y1: 9.8 },
  battery:  { obj: BATTERY, y0: 3.4, y1: 4.6 },
};
// the axis of the exploded view, a faint solid line (an annotation; it fades in with the explosion). Not dashed: dashes a few
// pixels long crawl as the camera moves
const AXIS_LINE = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V3(0, 0.5, 0), V3(0, 47, 0)]), new THREE.LineBasicMaterial({ color: 0x8fd3ff, transparent: true, opacity: 0 }));
universe.add(AXIS_LINE);
