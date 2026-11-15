'use client';

import { useEffect, useRef } from 'react';

// A soft, liquid field of sun and pink on cream, drawn by one fragment shader. It drifts slowly and
// leans toward the pointer. Pauses off-screen and in hidden tabs; draws a single still frame for reduced motion.
const FRAG = `
precision mediump float;
uniform vec2 uRes; uniform float uTime; uniform vec2 uMouse;
float blob(vec2 p, vec2 c, float r) { float d = length(p - c); return smoothstep(r, 0.0, d); }
vec2 hash(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
float noise(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
  float a = dot(hash(i) - .5, f), b = dot(hash(i + vec2(1, 0)) - .5, f - vec2(1, 0));
  float c = dot(hash(i + vec2(0, 1)) - .5, f - vec2(0, 1)), d = dot(hash(i + vec2(1, 1)) - .5, f - vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y); }
void main() {
  vec2 uv = gl_FragCoord.xy / uRes; vec2 p = uv; p.x *= uRes.x / uRes.y;
  float t = uTime * 0.12; float asp = uRes.x / uRes.y;
  vec2 warp = vec2(noise(p * 1.6 + t), noise(p * 1.6 - t + 4.0)) * 0.35;
  vec2 q = p + warp;
  vec2 m = vec2(uMouse.x * asp, uMouse.y);
  float sun = blob(q, vec2(asp * 0.82 + 0.06 * sin(t * 2.0), 0.78 + 0.05 * cos(t * 1.7)), 0.62);
  sun += 0.55 * blob(q, mix(vec2(asp * 0.7, 0.5), m, 0.35), 0.38);
  float pink = blob(q, vec2(asp * 0.08 + 0.05 * cos(t * 1.3), 0.12 + 0.06 * sin(t)), 0.55);
  pink += 0.45 * blob(q, vec2(asp * 0.55 + 0.12 * sin(t * 0.9), 0.06), 0.32);
  vec3 cream = vec3(0.984, 0.957, 0.902);
  vec3 sunC = vec3(1.0, 0.784, 0.239); vec3 pinkC = vec3(1.0, 0.608, 0.722);
  vec3 col = mix(cream, sunC, clamp(sun, 0.0, 1.0) * 0.9);
  col = mix(col, pinkC, clamp(pink, 0.0, 1.0) * 0.75);
  float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  col += (grain - 0.5) * 0.025;
  gl_FragColor = vec4(col, 1.0);
}`;
const VERT = 'attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }';

export default function HeroGL() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas?.getContext('webgl', { antialias: false, premultipliedAlpha: false, powerPreference: 'low-power' });
    if (!gl) return undefined;
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; };
    const vs = sh(gl.VERTEX_SHADER, VERT), fs = sh(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return undefined;
    const prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return undefined;
    gl.useProgram(prog);
    const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'a'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    const uRes = gl.getUniformLocation(prog, 'uRes'), uTime = gl.getUniformLocation(prog, 'uTime'), uMouse = gl.getUniformLocation(prog, 'uMouse');
    const host = canvas.parentElement;
    host.classList.add('has-gl');
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mouse = { x: 0.7, y: 0.6, tx: 0.7, ty: 0.6 };
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.25) * 0.6; // soft field: render small, let CSS scale it
      canvas.width = Math.max(2, Math.round(canvas.clientWidth * dpr));
      canvas.height = Math.max(2, Math.round(canvas.clientHeight * dpr));
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    const draw = (now) => {
      mouse.x += (mouse.tx - mouse.x) * 0.04; mouse.y += (mouse.ty - mouse.y) * 0.04;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, reduce ? 8 : now / 1000);
      gl.uniform2f(uMouse, mouse.x, mouse.y);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };
    resize(); draw(0);
    if (reduce) { const ro = new ResizeObserver(() => { resize(); draw(0); }); ro.observe(canvas); return () => ro.disconnect(); }
    let raf = 0, visible = true;
    const loop = (now) => { draw(now); raf = requestAnimationFrame(loop); };
    const start = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(loop); };
    const stop = () => { cancelAnimationFrame(raf); raf = 0; };
    const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; visible ? start() : stop(); });
    io.observe(canvas);
    const onVis = () => (document.hidden ? stop() : start());
    const onMove = (e) => { const r = canvas.getBoundingClientRect(); mouse.tx = (e.clientX - r.left) / r.width; mouse.ty = 1 - (e.clientY - r.top) / r.height; };
    const ro = new ResizeObserver(resize); ro.observe(canvas);
    document.addEventListener('visibilitychange', onVis);
    host.addEventListener('pointermove', onMove);
    start();
    return () => { stop(); io.disconnect(); ro.disconnect(); document.removeEventListener('visibilitychange', onVis); host.removeEventListener('pointermove', onMove); };
  }, []);
  return <canvas ref={ref} className="hero-gl" aria-hidden="true" />;
}
