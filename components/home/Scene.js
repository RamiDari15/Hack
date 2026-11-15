'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { N, GROUPS, buildStates, groupCenters } from './bulbs';

const STEPS = [
  {
    title: 'Tell us about the day',
    body: 'Type, date, place, guests and budget. The planner turns it into a budget split, and every figure is marked as an estimate.',
    href: '/events/new', cta: 'Start an event',
  },
  {
    title: 'Find the people who make it',
    body: 'Verified vendors by category and area. Web results show up too, kept apart and marked for you to confirm.',
    href: '/vendors', cta: 'Browse vendors',
  },
  {
    title: 'Watch it come together',
    body: 'Quotes replace estimates as vendors reply. One page holds the budget, the vendors and what is left to do.',
    href: '/dashboard', cta: 'Open your events',
  },
];

const VERT = /* glsl */`
  attribute vec3 a0; attribute vec3 a1; attribute vec3 a2; attribute vec3 a3; attribute float aRand;
  uniform float uP; uniform float uTime; uniform float uIntro; uniform float uPx; uniform float uSize;
  varying float vAlpha; varying float vWarm;
  float seg(float p, float k, float r) { return smoothstep(0.0, 1.0, clamp((p - k - r * 0.4) / 0.6, 0.0, 1.0)); }
  void main() {
    float e1 = seg(uP, 0.0, aRand);
    float e2 = seg(uP, 1.0, aRand);
    float e3 = seg(uP, 2.0, aRand);
    vec3 pos = mix(a0, a1, e1);
    pos = mix(pos, a2, e2);
    pos = mix(pos, a3, e3);
    // String lights sway; the cloud drifts; groups breathe.
    pos.y += sin(uTime * 0.7 + a0.x * 0.45 + a0.z) * 0.07 * (1.0 - e1);
    float drift = e1 * (1.0 - e2);
    pos += vec3(sin(uTime * 0.31 + aRand * 40.0), cos(uTime * 0.27 + aRand * 31.0), sin(uTime * 0.23 + aRand * 17.0)) * 0.35 * drift;
    pos += normalize(pos - vec3(0.0, 0.0, 0.0) + 0.001) * sin(uTime * 1.3 + aRand * 12.0) * 0.03 * e2 * (1.0 - e3);
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    float twinkle = 0.78 + 0.22 * sin(uTime * (0.8 + aRand * 2.2) + aRand * 25.0);
    // Intro: bulbs switch on from left to right.
    float on = clamp(uIntro * 1.8 - (a0.x + 12.0) / 24.0 * 0.8, 0.0, 1.0);
    vAlpha = twinkle * on;
    vWarm = aRand;
    float grow = mix(2.1, 1.0, e1) * mix(1.0, 0.85, e3);
    gl_PointSize = uSize * uPx * grow * (0.7 + aRand * 0.6) / -mv.z;
  }
`;

const FRAG = /* glsl */`
  precision mediump float;
  varying float vAlpha; varying float vWarm;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float core = smoothstep(0.16, 0.0, d);
    float glow = pow(smoothstep(0.5, 0.0, d), 2.4);
    vec3 amber = mix(vec3(1.0, 0.70, 0.30), vec3(1.0, 0.80, 0.42), vWarm);
    vec3 col = (amber * glow * 0.85 + vec3(1.0, 0.95, 0.84) * core) * vAlpha;
    // Premultiplied output, so the transparent canvas composites as light over the page.
    gl_FragColor = vec4(col, max(max(col.r, col.g), col.b));
  }
`;

export default function Scene() {
  const rootRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let dead = false;
    let teardown = () => {};

    (async () => {
      const [THREE, { gsap }, { ScrollTrigger }] = await Promise.all([import('three'), import('gsap'), import('gsap/ScrollTrigger')]);
      if (dead) return;
      const canvas = root.querySelector('canvas');
      let renderer;
      try {
        renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
      } catch {
        return; // No WebGL: the page stays as a plain list on dusk.
      }
      const px = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(px);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(45, 1, .1, 100);
      const geo = new THREE.BufferGeometry();
      let portrait = null;
      const uniforms = {
        uP: { value: 0 }, uTime: { value: 0 }, uIntro: { value: reduce ? 1 : 0 }, uPx: { value: px }, uSize: { value: 104 },
      };
      const mat = new THREE.ShaderMaterial({
        uniforms, vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, premultipliedAlpha: true,
        blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor,
        blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
      });
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      const points = new THREE.Points(geo, mat);
      points.frustumCulled = false;
      scene.add(points);

      const labels = [...root.querySelectorAll('.scene-label')];
      const state = { p: 0 };
      let p = 0;
      const lookAt = new THREE.Vector3();
      const v = new THREE.Vector3();

      function setStates(isPortrait) {
        if (isPortrait === portrait) return;
        portrait = isPortrait;
        const s = buildStates(portrait);
        geo.setAttribute('a0', new THREE.BufferAttribute(s.s0, 3));
        geo.setAttribute('a1', new THREE.BufferAttribute(s.s1, 3));
        geo.setAttribute('a2', new THREE.BufferAttribute(s.s2, 3));
        geo.setAttribute('a3', new THREE.BufferAttribute(s.s3, 3));
        geo.setAttribute('aRand', new THREE.BufferAttribute(s.rand, 1));
      }

      function resize() {
        const w = canvas.clientWidth; const h = canvas.clientHeight;
        if (!w || !h) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        setStates(w / h < .85);
        // Shift the scene away from the text: right on wide screens, up on tall ones.
        if (portrait) camera.setViewOffset(w, h, 0, h * .13, w, h);
        else camera.setViewOffset(w, h, -w * .13, 0, w, h);
        camera.updateProjectionMatrix();
      }

      const ease = (t) => t * t * (3 - 2 * t);
      function frame(t) {
        uniforms.uTime.value = t;
        p += (state.p - p) * (reduce ? 1 : .08);
        uniforms.uP.value = p;
        const e1 = ease(Math.min(Math.max(p, 0), 1));
        const e3 = ease(Math.min(Math.max(p - 2, 0), 1));
        const far = portrait ? 15 : 12.5;
        const zA = 12 + (far - 12) * e1;
        const end = portrait ? [0, 14, 12] : [0, 9, 11.4];
        camera.position.set(end[0] * e3, end[1] * e3, zA + (end[2] - zA) * e3);
        lookAt.set(0, .3 * (1 - e3), 0);
        camera.lookAt(lookAt);
        points.rotation.y = e3 * .12 * Math.sin(t * .12);
        renderer.render(scene, camera);

        // Group names follow their clusters while the groups are on screen.
        const show = Math.min(Math.max((p - 1.55) / .3, 0), 1) * Math.min(Math.max((2.45 - p) / .3, 0), 1);
        const centers = groupCenters(portrait);
        const w = canvas.clientWidth; const h = canvas.clientHeight;
        labels.forEach((el, i) => {
          if (show <= 0) { el.style.opacity = '0'; return; }
          v.set(centers[i][0], centers[i][1] - 1.15, 0).project(camera);
          el.style.opacity = String(show);
          el.style.transform = `translate(${(v.x * .5 + .5) * w}px, ${(-v.y * .5 + .5) * h}px) translate(-50%, 0)`;
        });
      }

      resize();
      const ro = new ResizeObserver(() => { resize(); if (reduce) frame(0); });
      ro.observe(canvas);

      if (reduce) {
        frame(0);
        teardown = () => { ro.disconnect(); geo.dispose(); mat.dispose(); renderer.dispose(); };
        return;
      }

      gsap.registerPlugin(ScrollTrigger);
      document.documentElement.classList.add('scene-motion');
      const steps = root.querySelectorAll('.scene-step');
      const ctx = gsap.context(() => {
        gsap.to(uniforms.uIntro, { value: 1, duration: 2.4, ease: 'power2.out', delay: .1 });
        gsap.from('.hero-line > span', { yPercent: 105, duration: 1.15, ease: 'power4.out', stagger: .12, delay: .25 });
        gsap.from('.hero-after', { autoAlpha: 0, y: 18, duration: .9, ease: 'power2.out', delay: 1 });

        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: { trigger: root, start: 'top top', end: 'bottom bottom', scrub: .9 },
        });
        const inn = { autoAlpha: 1, y: 0, duration: .6 };
        const out = { autoAlpha: 0, y: -40, duration: .6 };
        tl.to('.scene-hero', { autoAlpha: 0, y: -70, duration: .8 }, .2)
          .to(state, { p: 1, duration: 1.6 }, .3)
          .fromTo(steps[0], { autoAlpha: 0, y: 40 }, inn, 1.1)
          .to(steps[0], out, 3.1)
          .to(state, { p: 2, duration: 1.4 }, 3.1)
          .fromTo(steps[1], { autoAlpha: 0, y: 40 }, inn, 3.8)
          .to(steps[1], out, 6.1)
          .to(state, { p: 3, duration: 1.7 }, 6.1)
          .fromTo(steps[2], { autoAlpha: 0, y: 40 }, inn, 6.9)
          .to({}, { duration: 1.6 }, 7.5);
      }, root);

      let raf = 0; let visible = true; let running = false;
      const t0 = performance.now();
      const loop = () => { frame((performance.now() - t0) / 1000); raf = requestAnimationFrame(loop); };
      const sync = () => {
        const want = visible && document.visibilityState === 'visible';
        if (want && !running) { running = true; raf = requestAnimationFrame(loop); }
        if (!want && running) { running = false; cancelAnimationFrame(raf); }
      };
      const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; sync(); });
      io.observe(root);
      document.addEventListener('visibilitychange', sync);
      sync();

      teardown = () => {
        cancelAnimationFrame(raf); io.disconnect(); ro.disconnect();
        document.removeEventListener('visibilitychange', sync);
        ctx.revert();
        document.documentElement.classList.remove('scene-motion');
        geo.dispose(); mat.dispose(); renderer.dispose();
      };
    })();

    return () => { dead = true; teardown(); };
  }, []);

  return (
    <section className="scene on-dusk" ref={rootRef} aria-labelledby="hero-title">
      <div className="scene-sticky">
        <canvas className="scene-canvas" aria-hidden="true" />
        <div className="scene-veil" aria-hidden="true" />
        <div className="scene-hero wrap">
          <h1 id="hero-title" className="display-hero hero-title">
            <span className="hero-line"><span>Plan</span></span>
            <span className="hero-line"><span>the night.</span></span>
          </h1>
          <div className="hero-after stack-lg">
            <p className="lede">Find and book the venue, food, music and photographer for your event. Every price says whether it is a guess, a web result or a real quote.</p>
            <div className="row">
              <Link className="btn btn-bulb" href="/events/new">Start planning</Link>
              <Link className="btn btn-ghost" href="/vendors">Browse vendors</Link>
            </div>
          </div>
        </div>
        <div className="scene-labels" aria-hidden="true">
          {GROUPS.map((g) => <span className="scene-label" key={g}>{g}</span>)}
        </div>
        <ol className="scene-steps wrap" aria-label="How Vendora works">
          {STEPS.map((s, i) => (
            <li className="scene-step" key={s.title}>
              <span className="step-n" aria-hidden="true">{i + 1}</span>
              <h2 className="display-2">{s.title}</h2>
              <p className="lede">{s.body}</p>
              <Link className="step-link" href={s.href}>{s.cta}</Link>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
