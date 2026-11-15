// Small, friendly props for each walkthrough stop, built from simple shapes so nothing has to load.
// Every builder returns a THREE.Group roughly 1.6 units wide and up to 2.4 tall, standing on y = 0.
export const PALETTE = {
  cream: 0xfbf4e6, paper: 0xfffaf0, ink: 0x1f1915, ink2: 0x4a3f36, sun: 0xffc83d, sun2: 0xffdd80,
  pink: 0xff5c8a, pink2: 0xff9bb8, pinkDeep: 0xb8204f, green: 0x6f9a6a, wood: 0xc99a6b, silver: 0xd9d2c5,
};

export function makeModels(THREE) {
  const mats = new Map();
  const mat = (color, extra = {}) => {
    const key = `${color}-${JSON.stringify(extra)}`;
    if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.02, ...extra }));
    return mats.get(key);
  };
  const add = (g, geo, color, [x, y, z] = [0, 0, 0], extra) => {
    const m = new THREE.Mesh(geo, mat(color, extra));
    m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
  };
  const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cyl = (rt, rb, h, s = 24) => new THREE.CylinderGeometry(rt, rb, h, s);
  const sph = (r) => new THREE.SphereGeometry(r, 20, 14);
  const P = PALETTE;

  const builders = {
    Venues(g) {
      add(g, cyl(0.12, 0.12, 2, 16), P.paper, [-0.85, 1, 0]);
      add(g, cyl(0.12, 0.12, 2, 16), P.paper, [0.85, 1, 0]);
      const arch = add(g, new THREE.TorusGeometry(0.85, 0.12, 14, 40, Math.PI), P.paper, [0, 2, 0]);
      arch.rotation.z = 0;
      for (let i = 0; i < 9; i++) {
        const a = (i / 8) * Math.PI;
        add(g, sph(0.13), i % 2 ? P.pink2 : P.sun, [Math.cos(a) * 0.85, 2 + Math.sin(a) * 0.85, 0.1]);
      }
    },
    Catering(g) {
      add(g, box(1.7, 0.08, 0.9), P.paper, [0, 0.8, 0]);
      for (const [x, z] of [[-0.75, -0.35], [0.75, -0.35], [-0.75, 0.35], [0.75, 0.35]]) add(g, cyl(0.04, 0.04, 0.8, 8), P.wood, [x, 0.4, z]);
      add(g, box(1.8, 0.02, 0.5), P.pink2, [0, 0.85, 0]);
      for (const x of [-0.5, 0.5]) add(g, cyl(0.2, 0.2, 0.03, 24), P.cream, [x, 0.87, 0]);
      const cloche = add(g, new THREE.SphereGeometry(0.28, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), P.silver, [0, 0.86, 0], { metalness: 0.4, roughness: 0.3 });
      add(g, sph(0.05), P.silver, [0, 1.16, 0]);
      return cloche;
    },
    'Music & DJ'(g) {
      add(g, box(1.5, 0.9, 0.7), P.ink, [0, 0.45, 0]);
      add(g, box(1.52, 0.06, 0.72), P.sun, [0, 0.93, 0]);
      for (const x of [-0.4, 0.4]) {
        add(g, cyl(0.26, 0.26, 0.05, 32), P.ink2, [x, 0.98, 0]);
        add(g, cyl(0.08, 0.08, 0.06, 16), P.pink, [x, 1.0, 0]);
      }
      for (const x of [-1.05, 1.05]) {
        add(g, box(0.45, 1.3, 0.45), P.ink, [x, 0.65, 0]);
        add(g, cyl(0.15, 0.15, 0.05, 24), P.ink2, [x, 0.9, 0.24]).rotation.x = Math.PI / 2;
        add(g, cyl(0.1, 0.1, 0.05, 24), P.ink2, [x, 0.4, 0.24]).rotation.x = Math.PI / 2;
      }
    },
    Photography(g) {
      for (let i = 0; i < 3; i++) {
        const leg = add(g, cyl(0.03, 0.03, 1.4, 8), P.ink, [0, 0.68, 0]);
        leg.rotation.z = 0.28; leg.rotation.y = (i / 3) * Math.PI * 2;
        leg.position.set(Math.sin((i / 3) * Math.PI * 2) * 0.2, 0.66, Math.cos((i / 3) * Math.PI * 2) * 0.2);
      }
      add(g, box(0.7, 0.45, 0.35), P.ink, [0, 1.5, 0]);
      add(g, box(0.22, 0.1, 0.2), P.ink2, [-0.18, 1.78, 0]);
      add(g, cyl(0.17, 0.2, 0.35, 24), P.ink2, [0, 1.5, 0.32]).rotation.x = Math.PI / 2;
      add(g, cyl(0.12, 0.12, 0.02, 24), P.sun2, [0, 1.5, 0.5], { emissive: P.sun, emissiveIntensity: 0.3 }).rotation.x = Math.PI / 2;
    },
    Videography(g) { builders.Photography(g); add(g, box(0.06, 0.4, 0.06), P.pink, [0.3, 1.86, 0]); },
    Florists(g) {
      add(g, cyl(0.28, 0.2, 0.7, 24), P.paper, [0, 0.35, 0]);
      add(g, cyl(0.29, 0.29, 0.08, 24), P.pink2, [0, 0.55, 0]);
      const blooms = [[0, 1.25, 0, 0.26, P.pink], [-0.3, 1.05, 0.1, 0.22, P.pink2], [0.32, 1.08, -0.05, 0.22, P.sun], [0.12, 1.45, 0.15, 0.18, P.sun2], [-0.18, 1.4, -0.18, 0.2, P.pinkDeep], [0.05, 0.95, 0.3, 0.16, P.pink2]];
      for (const [x, y, z, r, c] of blooms) add(g, sph(r), c, [x, y, z]);
      for (const [x, z] of [[-0.3, -0.2], [0.3, 0.2], [0.1, -0.3]]) { const l = add(g, sph(0.14), P.green, [x, 0.85, z]); l.scale.set(1, 0.5, 1.6); }
    },
    'Cake & desserts'(g) {
      add(g, cyl(0.55, 0.55, 0.05, 32), P.silver, [0, 0.5, 0], { metalness: 0.4, roughness: 0.3 });
      add(g, cyl(0.06, 0.12, 0.5, 16), P.silver, [0, 0.25, 0], { metalness: 0.4, roughness: 0.3 });
      const tiers = [[0.5, 0.36, 0.71], [0.37, 0.32, 1.05], [0.25, 0.28, 1.35]];
      tiers.forEach(([r, h, y], i) => { add(g, cyl(r, r, h, 40), P.paper, [0, y, 0]); add(g, cyl(r + 0.01, r + 0.01, 0.05, 40), i % 2 ? P.sun : P.pink2, [0, y - h / 2 + 0.05, 0]); });
      add(g, sph(0.08), P.pink, [0, 1.56, 0]);
    },
    'Bar services'(g) {
      add(g, box(1.7, 1, 0.6), P.wood, [0, 0.5, 0]);
      add(g, box(1.8, 0.07, 0.7), P.ink, [0, 1.03, 0]);
      const colors = [P.green, P.sun, P.pinkDeep, P.ink2];
      colors.forEach((c, i) => { const x = -0.6 + i * 0.4; add(g, cyl(0.08, 0.1, 0.42, 16), c, [x, 1.28, -0.12], { roughness: 0.25 }); add(g, cyl(0.035, 0.035, 0.14, 8), c, [x, 1.55, -0.12]); });
      for (const x of [-0.35, 0.05, 0.45]) add(g, cyl(0.07, 0.05, 0.16, 16), P.cream, [x, 1.15, 0.18], { transparent: true, opacity: 0.85 });
    },
    'Photo booth'(g) {
      add(g, box(0.1, 2, 0.1), P.ink, [-0.75, 1, 0]); add(g, box(0.1, 2, 0.1), P.ink, [0.75, 1, 0]);
      add(g, box(1.6, 0.12, 0.12), P.ink, [0, 2, 0]);
      const curtain = add(g, box(1.4, 1.85, 0.03), P.pink2, [0, 1.0, -0.05]);
      add(g, box(0.5, 0.35, 0.3), P.sun, [0, 1.25, 0.45]);
      add(g, cyl(0.1, 0.1, 0.06, 20), P.ink, [0, 1.25, 0.62]).rotation.x = Math.PI / 2;
      return curtain;
    },
    'Hair & makeup'(g) {
      add(g, box(1.2, 0.08, 0.5), P.paper, [0, 0.8, 0]);
      add(g, cyl(0.04, 0.04, 0.8, 8), P.wood, [-0.5, 0.4, 0]); add(g, cyl(0.04, 0.04, 0.8, 8), P.wood, [0.5, 0.4, 0]);
      add(g, new THREE.TorusGeometry(0.45, 0.06, 12, 40), P.sun, [0, 1.4, -0.1]);
      add(g, new THREE.CircleGeometry(0.42, 40), P.silver, [0, 1.4, -0.11], { metalness: 0.6, roughness: 0.15 });
      for (let i = 0; i < 6; i++) { const a = (i / 6) * Math.PI * 2; add(g, sph(0.05), P.cream, [Math.cos(a) * 0.52, 1.4 + Math.sin(a) * 0.52, -0.05], { emissive: P.sun2, emissiveIntensity: 0.6 }); }
    },
    Transportation(g) {
      add(g, box(1.6, 0.42, 0.75), P.pink2, [0, 0.42, 0]);
      add(g, box(0.9, 0.38, 0.7), P.paper, [-0.1, 0.8, 0]);
      for (const [x, z] of [[-0.55, 0.38], [0.55, 0.38], [-0.55, -0.38], [0.55, -0.38]]) add(g, cyl(0.18, 0.18, 0.12, 20), P.ink, [x, 0.2, z]).rotation.x = Math.PI / 2;
      add(g, box(0.06, 0.1, 0.2), P.sun2, [0.81, 0.48, 0.22], { emissive: P.sun, emissiveIntensity: 0.6 });
      add(g, box(0.06, 0.1, 0.2), P.sun2, [0.81, 0.48, -0.22], { emissive: P.sun, emissiveIntensity: 0.6 });
    },
    Rentals(g) {
      add(g, cyl(0.55, 0.55, 0.06, 32), P.paper, [0, 0.75, 0]); add(g, cyl(0.06, 0.06, 0.75, 12), P.wood, [0, 0.37, 0]);
      for (const a of [0, Math.PI]) {
        const x = Math.cos(a) * 0.95;
        add(g, box(0.45, 0.06, 0.45), P.sun, [x, 0.45, 0]);
        add(g, box(0.06, 0.55, 0.45), P.sun, [x + (a ? -0.2 : 0.2), 0.75, 0]);
        for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) add(g, cyl(0.025, 0.025, 0.45, 6), P.ink, [x + dx, 0.22, dz]);
      }
    },
    'Decor & styling'(g) {
      const balloons = [[-0.35, 1.7, 0, P.pink], [0.3, 1.9, 0.1, P.sun], [0, 2.15, -0.1, P.pink2], [0.45, 1.55, -0.15, P.paper]];
      for (const [x, y, z, c] of balloons) { const b = add(g, sph(0.26), c, [x, y, z], { roughness: 0.3 }); b.scale.set(1, 1.15, 1); add(g, cyl(0.006, 0.006, y - 0.2, 4), P.ink2, [x * 0.4, (y - 0.2) / 2, z * 0.4]); }
      add(g, box(0.5, 0.3, 0.5), P.ink, [0, 0.15, 0]);
    },
    Entertainment(g) {
      add(g, cyl(0.7, 0.8, 0.3, 32), P.ink, [0, 0.15, 0]);
      const star = new THREE.Shape();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 0.25 : 0.6; const a = (i / 10) * Math.PI * 2 + Math.PI / 2; const x = Math.cos(a) * r, y = Math.sin(a) * r; if (i) star.lineTo(x, y); else star.moveTo(x, y); }
      const s = add(g, new THREE.ExtrudeGeometry(star, { depth: 0.18, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2 }), P.sun, [0, 1.3, -0.09], { emissive: P.sun, emissiveIntensity: 0.25 });
      add(g, cyl(0.03, 0.03, 0.8, 8), P.ink2, [0, 0.7, 0]);
      return s;
    },
    Planners(g) {
      add(g, box(1.2, 0.08, 0.6), P.paper, [0, 0.8, 0]);
      add(g, cyl(0.04, 0.04, 0.8, 8), P.wood, [-0.5, 0.4, 0]); add(g, cyl(0.04, 0.04, 0.8, 8), P.wood, [0.5, 0.4, 0]);
      const board = add(g, box(0.55, 0.7, 0.04), P.wood, [0, 1.2, 0]); board.rotation.x = -0.35;
      const sheet = add(g, box(0.45, 0.55, 0.02), P.paper, [0, 1.19, 0.04]); sheet.rotation.x = -0.35;
      add(g, box(0.25, 0.08, 0.06), P.ink, [0, 1.52, -0.08]).rotation.x = -0.35;
    },
  };
  const fallback = (g) => {
    add(g, box(0.8, 0.8, 0.8), P.pink2, [0, 0.4, 0]);
    add(g, box(0.84, 0.18, 0.84), P.sun, [0, 0.4, 0]);
    add(g, box(0.18, 0.84, 0.84), P.sun, [0, 0.4, 0]);
    add(g, sph(0.14), P.sun, [0, 0.9, 0]);
  };

  return {
    mat,
    build(category) {
      const g = new THREE.Group();
      const hero = (builders[category] ?? fallback)(g);
      g.userData.hero = hero ?? null;
      return g;
    },
  };
}
