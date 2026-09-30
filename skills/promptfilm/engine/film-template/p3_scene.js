
/* =====================================================================================
   3. SCENE — TODO: one line on what this world is. World unit: TODO (km | m | mm | µm | nm) — one unit everywhere.
   Split into p3_*.js, p4_*.js, p5_*.js, p6_*.js as it grows (each part stays a few hundred lines); build.sh picks them up.

   Rules that keep the film acceptable (references/principles.md):
   - Every number on screen comes from FACTS (research/facts.md → here), each with its source.
   - Everything that will ever be seen exists from the first frame at its true place; it becomes visible only because
     the camera reaches it (or because it really moves). Nothing grows, unfolds, or pops in on a timer.
   - Repeated things come from one definition (one geometry / material / shader); the one the camera picks is identical.
   - Ambient motion (spin, flow, flicker of a flame) runs on playback time and makes whole cycles per loop.
   ===================================================================================== */
const FACTS = Object.freeze({
  // TODO: every size, count, distance, colour, material the film shows, with its source. e.g.
  // thing: { size: 1.23, count: 45, src: 'Official datasheet v2 (2025), p. 12' },
  placeholder: { r: 1, src: 'replace me' },
});

// TODO: build the world into `universe` (units above). Patterns to borrow (not their content):
//   examples/cosmic-scale/parts/p3_bodies.js — lit spheres, proportional glow, stars by luminosity, presence fades
//   examples/cosmic-scale/parts/p4_points.js — point clouds with depth windows; p6_volume.js — ray-marched volumes
//   examples/blackwell-silicon-to-scale.v11.html — instanced hardware, texture → 3D detail by distance, microscope look
const PLACEHOLDER = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 3), new THREE.MeshBasicMaterial({ color: 0x33475b, wireframe: true }));
universe.add(PLACEHOLDER);
