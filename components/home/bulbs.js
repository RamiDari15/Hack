// Builds the four arrangements of the homepage bulb field.
// S0 string lights, S1 a loose cloud (an idea), S2 six vendor groups, S3 the floor plan of a party.
// Every array holds N xyz triples; index i is the same bulb in every state.

export const N = 1400;
export const GROUPS = ['Venues', 'Catering', 'Music & DJ', 'Photography', 'Florists', 'Rentals'];

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, r) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(r() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function fill(points, r) {
  // Pad or trim to N points so every state has the same count.
  const out = points.slice(0, N);
  while (out.length < N) out.push(points[Math.floor(r() * points.length)]);
  return out;
}

function strings(r) {
  const pts = [];
  const strands = [
    [-12, 4.9, 12, 4.4, 1.5, -2.5], [-12, 3.9, 12, 4.7, 1.9, -1],
    [-12, 4.6, 12, 3.2, 1.6, .5], [-12, 2.9, 12, 4.1, 1.3, -3.5],
    [-12, 4.2, 12, 4.2, 2.4, 1.6], [-12, 3.3, 12, 2.8, 1.2, -5],
  ];
  const perStrand = 30;
  const bulbs = [];
  strands.forEach(([x0, y0, x1, y1, sag, z]) => {
    for (let b = 0; b < perStrand; b += 1) {
      const u = (b + .5) / perStrand;
      const x = x0 + (x1 - x0) * u;
      const y = y0 + (y1 - y0) * u - sag * (1 - (2 * u - 1) ** 2);
      bulbs.push([x, y, z]);
    }
  });
  // Several points sit on each bulb, so it glows brighter and splits apart when the scene moves.
  for (let i = 0; i < N; i += 1) {
    const [x, y, z] = bulbs[i % bulbs.length];
    pts.push([x + (r() - .5) * .07, y + (r() - .5) * .07, z + (r() - .5) * .07]);
  }
  return pts;
}

function cloud(r, portrait) {
  const pts = [];
  const [ax, ay, az] = portrait ? [3.2, 4.8, 2.6] : [7.2, 3.4, 3];
  for (let i = 0; i < N; i += 1) {
    const u = r() * 2 - 1;
    const th = r() * Math.PI * 2;
    const rad = Math.cbrt(r());
    const s = Math.sqrt(1 - u * u);
    pts.push([ax * rad * s * Math.cos(th), .4 + ay * rad * s * Math.sin(th), az * rad * u]);
  }
  return pts;
}

export function groupCenters(portrait) {
  return portrait
    ? [[-1.55, 4.3], [1.55, 4.3], [-1.55, 1.9], [1.55, 1.9], [-1.55, -.5], [1.55, -.5]]
    : [[-4.4, 1.9], [0, 1.9], [4.4, 1.9], [-4.4, -1.5], [0, -1.5], [4.4, -1.5]];
}

function groups(r, portrait) {
  const centers = groupCenters(portrait);
  const pts = [];
  for (let i = 0; i < N; i += 1) {
    const [cx, cy] = centers[i % 6];
    const u = r() * 2 - 1;
    const th = r() * Math.PI * 2;
    const rad = .82 * Math.sqrt(r());
    const s = Math.sqrt(1 - u * u);
    pts.push([cx + rad * s * Math.cos(th), cy + rad * s * Math.sin(th), rad * u]);
  }
  return pts;
}

function floorPlan(r, portrait) {
  const W = 13; const D = 8.4;
  const pts = [];
  const add = (x, y, z) => pts.push([x, y, z]);
  // Round tables with seats.
  [-5.1, -3, 3, 5.1].forEach((x) => [-2.6, 0, 2.6].forEach((z) => {
    for (let k = 0; k < 18; k += 1) { const a = (k / 18) * Math.PI * 2; add(x + .55 * Math.cos(a), 0, z + .55 * Math.sin(a)); }
    for (let k = 0; k < 8; k += 1) { const a = (k / 8) * Math.PI * 2 + .2; add(x + .9 * Math.cos(a), 0, z + .9 * Math.sin(a)); }
  }));
  // Dance floor.
  for (let a = 0; a < 13; a += 1) for (let b = 0; b < 13; b += 1) add(-1.7 + a * (3.4 / 12), 0, -.9 + b * (3.4 / 12));
  // Stage.
  for (let a = 0; a < 18; a += 1) for (let b = 0; b < 3; b += 1) add(-2 + a * (4 / 17), 0, -3.7 + b * .22);
  // String lights above the room.
  for (let s = 0; s < 5; s += 1) {
    const z = -3.2 + s * 1.6;
    for (let k = 0; k < 56; k += 1) { const u = k / 55; add(-W / 2 + W * u, 2.5 - .55 * (1 - (2 * u - 1) ** 2), z); }
  }
  // Walls.
  const per = 2 * (W + D);
  const left = N - pts.length;
  for (let k = 0; k < left; k += 1) {
    let d = (k / left) * per;
    let x; let z;
    if (d < W) { x = -W / 2 + d; z = -D / 2; } else if ((d -= W) < D) { x = W / 2; z = -D / 2 + d; } else if ((d -= D) < W) { x = W / 2 - d; z = D / 2; } else { d -= W; x = -W / 2; z = D / 2 - d; }
    add(x, 0, z);
  }
  // Portrait screens get the room turned so its long side runs away from the camera.
  return portrait ? pts.map(([x, y, z]) => [z * .95, y, -x * .95]) : pts;
}

export function buildStates(portrait) {
  const r = rng(7);
  const s0 = strings(r);
  const s1 = cloud(r, portrait);
  const s2 = shuffle(groups(r, portrait), r);
  const s3 = shuffle(fill(floorPlan(r, portrait), r), r);
  const rand = Array.from({ length: N }, () => r());
  const flat = (a) => Float32Array.from(a.flat());
  return { s0: flat(s0), s1: flat(s1), s2: flat(s2), s3: flat(s3), rand: Float32Array.from(rand) };
}
