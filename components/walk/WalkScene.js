'use client';

import { useEffect, useRef } from 'react';
import { makeModels, PALETTE } from './models';
import { stopPosition, TONES, SHORT } from './stations';

// The 3D walkthrough: a round party floor under string lights, one stop per vendor category.
// Click a stop (or use the buttons around it) and the camera glides over. Stops with a vendor glow sun-yellow.
// The scene only renders while it is on screen; reduced motion snaps the camera instead of gliding.
const TONE_HEX = { sun: PALETTE.sun, pink: PALETTE.pink2, paper: PALETTE.paper, ink: PALETTE.ink };

export default function WalkScene({ stops, active, onSelect, reduce = false }) {
  const wrap = useRef(null);
  const api = useRef(null);
  const selectRef = useRef(onSelect);
  selectRef.current = onSelect;
  const stopsRef = useRef(stops);
  stopsRef.current = stops;
  const activeRef = useRef(active);
  activeRef.current = active;

  // Build the scene once per set of stops.
  useEffect(() => {
    let disposed = false;
    let cleanup = () => {};
    (async () => {
      const THREE = await import('three');
      if (disposed || !wrap.current) return;
      const host = wrap.current;
      const canvasHost = host.querySelector('.walk-canvas');
      const coarse = window.matchMedia('(pointer: coarse)').matches;

      const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 1.75));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.05;
      renderer.shadowMap.enabled = !coarse;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      canvasHost.appendChild(renderer.domElement);
      renderer.domElement.setAttribute('aria-hidden', 'true');

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(PALETTE.cream);
      scene.fog = new THREE.Fog(PALETTE.cream, 26, 46);
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);

      scene.add(new THREE.HemisphereLight(0xfff6e5, 0xe9d3b5, 1.15));
      const sunLight = new THREE.DirectionalLight(0xfff0d6, 1.6);
      sunLight.position.set(6, 14, 8);
      sunLight.castShadow = true;
      sunLight.shadow.mapSize.set(1024, 1024);
      Object.assign(sunLight.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 40 });
      sunLight.shadow.radius = 4;
      scene.add(sunLight);
      const blush = new THREE.PointLight(PALETTE.pink2, 18, 22, 1.6);
      blush.position.set(-6, 5, -4);
      scene.add(blush);

      const models = makeModels(THREE);
      const { mat } = models;

      // Floor: a big round rug on cream, a checkered dance floor in the middle.
      const floor = new THREE.Mesh(new THREE.CircleGeometry(30, 64), mat(0xf4e8d2, { roughness: 1 }));
      floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
      const rug = new THREE.Mesh(new THREE.CircleGeometry(11.6, 72), mat(0xf7ecd9, { roughness: 1 }));
      rug.rotation.x = -Math.PI / 2; rug.position.y = 0.005; rug.scale.set(1, 0.85, 1); rug.receiveShadow = true; scene.add(rug);
      const edge = new THREE.Mesh(new THREE.RingGeometry(11.6, 11.75, 96), mat(PALETTE.ink, { roughness: 1 }));
      edge.rotation.x = -Math.PI / 2; edge.position.y = 0.01; edge.scale.set(1, 0.85, 1); scene.add(edge);
      const tile = new THREE.BoxGeometry(0.98, 0.06, 0.98);
      for (let x = -2; x < 2; x++) for (let z = -2; z < 2; z++) {
        const t = new THREE.Mesh(tile, mat((x + z) % 2 ? PALETTE.sun : PALETTE.paper, { roughness: 0.45 }));
        t.position.set(x + 0.5, 0.03, z + 0.5); t.receiveShadow = true; scene.add(t);
      }

      // Center pole with string lights running out to every stop.
      const poleH = 6.2;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, poleH, 12), mat(PALETTE.ink));
      pole.position.y = poleH / 2; pole.castShadow = true; scene.add(pole);
      const bulbGeo = new THREE.SphereGeometry(0.09, 10, 8);
      const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff3c4, emissive: PALETTE.sun, emissiveIntensity: 1.4 });
      const wireMat = new THREE.LineBasicMaterial({ color: PALETTE.ink2 });
      const perLine = 7;
      const bulbs = new THREE.InstancedMesh(bulbGeo, bulbMat, stops.length * perLine);
      const tmp = new THREE.Object3D();
      let bi = 0;

      const n = stops.length;
      const hitMeshes = [];
      const groups = [];
      const hitGeo = new THREE.CylinderGeometry(1.7, 1.7, 3.2, 16);
      const hitMat = new THREE.MeshBasicMaterial({ visible: false });
      stops.forEach((s, i) => {
        const { x, z } = stopPosition(i, n);
        const g = new THREE.Group();
        g.position.set(x, 0, z);
        g.lookAt(0, 0, 0); // props face the dance floor
        const tone = TONES[i % TONES.length];
        const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.45, 1.55, 0.28, 48), mat(TONE_HEX[tone], { roughness: 0.7 }));
        plinth.position.y = 0.14; plinth.castShadow = true; plinth.receiveShadow = true; g.add(plinth);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.62, 0.05, 10, 64), new THREE.MeshStandardMaterial({ color: PALETTE.ink, emissive: PALETTE.sun, emissiveIntensity: 0 }));
        ring.rotation.x = Math.PI / 2; ring.position.y = 0.06; g.add(ring);
        const prop = models.build(s.model ?? s.category);
        prop.position.y = 0.28;
        g.add(prop);
        const hit = new THREE.Mesh(hitGeo, hitMat);
        hit.position.y = 1.6; hit.userData.index = i; g.add(hit);
        hitMeshes.push(hit);
        scene.add(g);
        groups.push({ g, ring, prop, base: new THREE.Vector3(x, 0, z) });

        // A sagging string of bulbs from the pole to just above this stop.
        const a = new THREE.Vector3(0, poleH - 0.1, 0);
        const b = new THREE.Vector3(x * 0.92, 3.3, z * 0.92);
        const mid = a.clone().lerp(b, 0.5); mid.y -= 0.9;
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(24)), wireMat));
        for (let k = 1; k <= perLine; k++) {
          const p = curve.getPoint(k / (perLine + 1));
          tmp.position.set(p.x, p.y - 0.12, p.z); tmp.updateMatrix(); bulbs.setMatrixAt(bi++, tmp.matrix);
        }
        // A thin post holding the end of the string.
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 3.3, 8), mat(PALETTE.ink));
        post.position.set(x * 0.92, 1.65, z * 0.92); scene.add(post);
      });
      bulbs.count = bi; scene.add(bulbs);

      // Camera rig: glide between an overview and a close look at each stop.
      const overview = { pos: new THREE.Vector3(0, 17, 21.5), look: new THREE.Vector3(0, 0.2, 0.6) };
      const goal = { pos: overview.pos.clone(), look: overview.look.clone() };
      const look = overview.look.clone();
      camera.position.copy(overview.pos);
      const aim = (i) => {
        if (i < 0 || i >= n) { goal.pos.copy(overview.pos); goal.look.copy(overview.look); return; }
        const base = groups[i].base;
        const out = base.clone().setY(0).normalize();
        // Stand on the dance-floor side of the stop, a little to the right, looking at the prop.
        const side = new THREE.Vector3(-out.z, 0, out.x);
        goal.pos.copy(base).addScaledVector(out, -4.9).addScaledVector(side, 0.9).setY(3.1);
        goal.look.copy(base).setY(1.15);
      };

      const labels = [...host.querySelectorAll('.walk-label')];
      const v = new THREE.Vector3();
      let w = 1, h = 1;
      const resize = () => {
        const r = canvasHost.getBoundingClientRect();
        w = Math.max(1, r.width); h = Math.max(1, r.height);
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        // Pull back a little on tall screens so the whole floor fits.
        camera.fov = w / h < 1 ? 58 : w / h < 1.3 ? 46 : 38;
        camera.updateProjectionMatrix();
        wake();
      };

      let raf = 0, visible = true, hover = -1, t0 = performance.now(), activeIdx = -1, last = performance.now();
      const tick = (now) => {
        raf = 0;
        const t = (now - t0) / 1000;
        // Time-based easing, so the glide takes the same ~1s on a slow phone and a fast laptop.
        const dt = Math.min(0.1, (now - last) / 1000); last = now;
        const k = reduce ? 1 : 1 - Math.exp(-dt * 4.2);
        camera.position.lerp(goal.pos, k);
        look.lerp(goal.look, k);
        camera.lookAt(look);
        groups.forEach(({ ring, prop, g }, i) => {
          const on = stopsRef.current[i]?.filled;
          const target = i === activeIdx ? 1.06 : i === hover ? 1.03 : 1;
          g.scale.setScalar(g.scale.x + (target - g.scale.x) * (reduce ? 1 : Math.min(1, k * 2)));
          ring.material.color.setHex(on ? PALETTE.sun : PALETTE.ink);
          ring.material.emissiveIntensity = on ? 0.55 : 0;
          if (!reduce && i === activeIdx) prop.position.y = 0.28 + Math.sin(t * 2) * 0.05;
          else prop.position.y = 0.28;
        });
        if (!reduce) bulbMat.emissiveIntensity = 1.25 + Math.sin(t * 1.4) * 0.15;
        renderer.render(scene, camera);
        // Signs follow their stops.
        labels.forEach((el, i) => {
          const g = groups[i]; if (!g) return;
          v.copy(g.base).setY(2.95).project(camera);
          const behind = v.z > 1;
          el.style.transform = `translate(-50%, -100%) translate(${((v.x + 1) / 2) * w}px, ${((1 - v.y) / 2) * h}px)`;
          el.style.opacity = behind ? '0' : '1';
        });
        const moving = camera.position.distanceToSquared(goal.pos) > 0.0004 || look.distanceToSquared(goal.look) > 0.0004;
        if (visible && (moving || !reduce)) raf = requestAnimationFrame(tick);
      };
      const wake = () => { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(tick); } };

      // Picking: a click that is not a drag selects the stop under the pointer.
      const ray = new THREE.Raycaster();
      const ndc = new THREE.Vector2();
      const pick = (e) => {
        const r = renderer.domElement.getBoundingClientRect();
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ndc, camera);
        const hit = ray.intersectObjects(hitMeshes, false)[0];
        return hit ? hit.object.userData.index : -1;
      };
      let down = null;
      const onDown = (e) => { down = { x: e.clientX, y: e.clientY }; };
      const onUp = (e) => {
        if (!down) return;
        const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6; down = null;
        if (moved) return;
        const i = pick(e);
        if (i >= 0) selectRef.current?.(i);
      };
      const onMove = (e) => {
        if (e.pointerType !== 'mouse') return;
        const i = pick(e);
        if (i !== hover) { hover = i; renderer.domElement.style.cursor = i >= 0 ? 'pointer' : ''; wake(); }
      };
      renderer.domElement.addEventListener('pointerdown', onDown);
      renderer.domElement.addEventListener('pointerup', onUp);
      renderer.domElement.addEventListener('pointermove', onMove);

      const ro = new ResizeObserver(resize); ro.observe(canvasHost);
      const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting && !document.hidden; if (visible) wake(); });
      io.observe(host);
      const onVis = () => { visible = !document.hidden; if (visible) wake(); };
      document.addEventListener('visibilitychange', onVis);
      resize();

      api.current = { aim: (i) => { activeIdx = i; aim(i); wake(); }, wake };
      api.current.aim(activeRef.current);
      host.classList.add('is-ready');

      cleanup = () => {
        cancelAnimationFrame(raf);
        ro.disconnect(); io.disconnect();
        document.removeEventListener('visibilitychange', onVis);
        renderer.domElement.removeEventListener('pointerdown', onDown);
        renderer.domElement.removeEventListener('pointerup', onUp);
        renderer.domElement.removeEventListener('pointermove', onMove);
        scene.traverse((o) => { o.geometry?.dispose?.(); if (o.material && o.material !== hitMat) [].concat(o.material).forEach((m) => m.dispose?.()); });
        renderer.dispose();
        renderer.domElement.remove();
        api.current = null;
      };
    })();
    return () => { disposed = true; cleanup(); };
    // Rebuild only when the set of stops changes, not when a vendor is added.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops.map((s) => `${s.category}:${s.model ?? ''}`).join('|'), reduce]);

  useEffect(() => { api.current?.aim(active); }, [active]);
  useEffect(() => { api.current?.wake(); }, [stops]);

  return (
    <div className="walk-stage" ref={wrap}>
      <div className="walk-canvas" />
      <div className="walk-labels">
        {stops.map((s, i) => (
          <button key={s.category} type="button" className={`walk-label${i === active ? ' is-active' : ''}${s.filled ? ' is-filled' : ''}`}
            onClick={() => onSelect(i)} aria-pressed={i === active}>
            {SHORT[s.category] ?? s.category}{s.count ? <span className="walk-count">{s.count}</span> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
