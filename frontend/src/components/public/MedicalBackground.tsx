import { useEffect, useRef } from 'react';
import * as THREE from 'three';

/**
 * Hero background for the dark navy panel.
 *
 * Two layers, one WebGL renderer:
 *   1. A slowly rotating DNA double helix (perspective scene, behind).
 *   2. A scrolling ECG / heartbeat trace over a faint monitor grid
 *      (orthographic, pixel-space scene, in front).
 *
 * Honours `prefers-reduced-motion` (renders a still frame) and a subtle
 * mouse parallax on the helix.
 */

// ─── Brand palette ──────────────────────────────────────────────────────────
const COL_STRAND_A = new THREE.Color(0x5db1e3); // sky
const COL_STRAND_B = new THREE.Color(0x2bd4c0); // teal
const COL_BACKBONE = new THREE.Color(0x3a8fd0); // brand blue
const COL_RUNG     = new THREE.Color(0x7fb8e6);
const COL_ECG      = new THREE.Color(0x2bd4c0); // teal monitor green
const COL_GRID     = new THREE.Color(0x2bd4c0);

// ─── Helix geometry tuning ──────────────────────────────────────────────────
const HELIX_HEIGHT   = 78;
const HELIX_RADIUS   = 8.5;
const HELIX_TURNS    = 3.4;
const HELIX_SEGMENTS = 150;
const RUNG_EVERY     = 4;
const HELIX_SPIN     = 0.0042;   // rad / frame
const PARALLAX       = 0.06;

// ─── ECG tuning ─────────────────────────────────────────────────────────────
const ECG_STEP   = 3;     // px between samples
const ECG_AMP    = 64;    // px peak height
const ECG_CYCLE  = 360;   // px per heartbeat
const ECG_SPEED  = 1.7;   // px / frame
const ECG_BASE_Y = -8;    // px offset from vertical centre

/** Classic PQRST complex, p ∈ [0,1) → roughly −0.3 .. 1.0 */
function ecgWave(p: number): number {
  const g = (center: number, width: number, height: number) =>
    height * Math.exp(-((p - center) ** 2) / (2 * width * width));
  return (
    g(0.18, 0.013, 0.18) +  // P wave
    g(0.30, 0.006, -0.13) + // Q
    g(0.33, 0.006, 1.0) +   // R spike
    g(0.36, 0.007, -0.30) + // S
    g(0.55, 0.032, 0.30)    // T wave
  );
}

/** Soft radial sprite for the glowing nodes / pulse head. */
function makeGlowTexture(): THREE.Texture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grd = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0,    'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.85)');
  grd.addColorStop(1,    'rgba(255,255,255,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export default function MedicalBackground() {
  const mountRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const frameRef = useRef<number>(0);
  const reduced  = useRef(
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false
  );

  useEffect(() => {
    const el = mountRef.current;
    if (!el) return;
    const node: HTMLDivElement = el;

    let { width, height } = node.getBoundingClientRect();
    width  = Math.max(width, 1);
    height = Math.max(height, 1);

    // ── Renderer ──────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.setSize(width, height);
    renderer.autoClear = false;
    node.appendChild(renderer.domElement);

    const glowTex = makeGlowTexture();
    const disposables: { dispose(): void }[] = [glowTex];

    // ══ Layer 1 — DNA helix (perspective) ═══════════════════════════════════
    const helixScene = new THREE.Scene();
    const helixCam = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    helixCam.position.z = 120;

    const helixGroup = new THREE.Group();
    helixGroup.rotation.x = 0.12;
    helixScene.add(helixGroup);

    const ptsA: THREE.Vector3[] = [];
    const ptsB: THREE.Vector3[] = [];
    for (let i = 0; i < HELIX_SEGMENTS; i++) {
      const v   = i / (HELIX_SEGMENTS - 1);
      const y   = (v - 0.5) * HELIX_HEIGHT;
      const ang = v * HELIX_TURNS * Math.PI * 2;
      ptsA.push(new THREE.Vector3(Math.cos(ang) * HELIX_RADIUS, y, Math.sin(ang) * HELIX_RADIUS));
      ptsB.push(new THREE.Vector3(Math.cos(ang + Math.PI) * HELIX_RADIUS, y, Math.sin(ang + Math.PI) * HELIX_RADIUS));
    }

    // Backbones
    const makeBackbone = (pts: THREE.Vector3[], color: THREE.Color) => {
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const mat  = new THREE.LineBasicMaterial({
        color, transparent: true, opacity: 0.22,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      disposables.push(geom, mat);
      return new THREE.Line(geom, mat);
    };
    helixGroup.add(makeBackbone(ptsA, COL_BACKBONE));
    helixGroup.add(makeBackbone(ptsB, COL_BACKBONE));

    // Rungs
    const rungPts: THREE.Vector3[] = [];
    for (let i = 0; i < HELIX_SEGMENTS; i += RUNG_EVERY) {
      rungPts.push(ptsA[i], ptsB[i]);
    }
    {
      const geom = new THREE.BufferGeometry().setFromPoints(rungPts);
      const mat  = new THREE.LineBasicMaterial({
        color: COL_RUNG, transparent: true, opacity: 0.14,
        blending: THREE.AdditiveBlending, depthWrite: false,
      });
      disposables.push(geom, mat);
      helixGroup.add(new THREE.LineSegments(geom, mat));
    }

    // Nodes (glowing points)
    {
      const all = [...ptsA, ...ptsB];
      const positions = new Float32Array(all.length * 3);
      const colors    = new Float32Array(all.length * 3);
      all.forEach((p, i) => {
        positions[i * 3]     = p.x;
        positions[i * 3 + 1] = p.y;
        positions[i * 3 + 2] = p.z;
        const c = i < ptsA.length ? COL_STRAND_A : COL_STRAND_B;
        colors[i * 3]     = c.r;
        colors[i * 3 + 1] = c.g;
        colors[i * 3 + 2] = c.b;
      });
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geom.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
      const mat = new THREE.PointsMaterial({
        size: 2.6, map: glowTex, vertexColors: true,
        transparent: true, opacity: 0.95, depthWrite: false,
        blending: THREE.AdditiveBlending, sizeAttenuation: true,
      });
      disposables.push(geom, mat);
      helixGroup.add(new THREE.Points(geom, mat));
    }

    // ══ Layer 2 — ECG trace (orthographic, pixel space) ═════════════════════
    const ecgScene = new THREE.Scene();
    const ecgCam = new THREE.OrthographicCamera(
      -width / 2, width / 2, height / 2, -height / 2, 0.1, 10
    );
    ecgCam.position.z = 5;

    // Faint monitor grid (rebuilt on resize)
    let gridLines: THREE.LineSegments | null = null;
    const buildGrid = (w: number, h: number) => {
      if (gridLines) {
        gridLines.geometry.dispose();
        ecgScene.remove(gridLines);
      }
      const gap = 64;
      const pts: THREE.Vector3[] = [];
      for (let x = -w / 2; x <= w / 2; x += gap) { pts.push(new THREE.Vector3(x, -h / 2, 0), new THREE.Vector3(x, h / 2, 0)); }
      for (let y = -h / 2; y <= h / 2; y += gap) { pts.push(new THREE.Vector3(-w / 2, y, 0), new THREE.Vector3(w / 2, y, 0)); }
      const geom = new THREE.BufferGeometry().setFromPoints(pts);
      const mat  = new THREE.LineBasicMaterial({
        color: COL_GRID, transparent: true, opacity: 0.05, depthWrite: false,
      });
      gridLines = new THREE.LineSegments(geom, mat);
      ecgScene.add(gridLines);
    };
    buildGrid(width, height);

    // ECG polyline — x fixed, y recomputed each frame; brightness fades to the left (trail)
    let count = Math.ceil(width / ECG_STEP) + 2;
    let ecgPos = new Float32Array(count * 3);
    const ecgGeom = new THREE.BufferGeometry();
    const buildEcg = (w: number) => {
      count = Math.ceil(w / ECG_STEP) + 2;
      ecgPos = new Float32Array(count * 3);
      const colors = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        ecgPos[i * 3]     = -w / 2 + i * ECG_STEP;
        ecgPos[i * 3 + 1] = 0;
        ecgPos[i * 3 + 2] = 0;
        const b = 0.15 + 0.85 * (i / (count - 1)); // dim left → bright right
        colors[i * 3]     = COL_ECG.r * b;
        colors[i * 3 + 1] = COL_ECG.g * b;
        colors[i * 3 + 2] = COL_ECG.b * b;
      }
      ecgGeom.setAttribute('position', new THREE.BufferAttribute(ecgPos, 3));
      ecgGeom.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
    };
    buildEcg(width);
    const ecgMat = new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    disposables.push(ecgGeom, ecgMat);
    ecgScene.add(new THREE.Line(ecgGeom, ecgMat));

    // Glowing pulse head at the right edge
    const headGeom = new THREE.BufferGeometry();
    headGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array([width / 2 - ECG_STEP, 0, 1]), 3));
    const headMat = new THREE.PointsMaterial({
      color: COL_ECG, map: glowTex, size: 30, transparent: true,
      opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending,
      sizeAttenuation: false,
    });
    disposables.push(headGeom, headMat);
    const head = new THREE.Points(headGeom, headMat);
    ecgScene.add(head);

    // ── Mouse ───────────────────────────────────────────────────────────────
    function onMouseMove(e: MouseEvent) {
      const rect = node.getBoundingClientRect();
      mouseRef.current = {
        x: ((e.clientX - rect.left) / rect.width  - 0.5) * 2,
        y: ((e.clientY - rect.top)  / rect.height - 0.5) * 2,
      };
    }
    window.addEventListener('mousemove', onMouseMove);

    // ── Resize ────────────────────────────────────────────────────────────
    function onResize() {
      const r = node.getBoundingClientRect();
      const w = Math.max(r.width, 1);
      const h = Math.max(r.height, 1);
      renderer.setSize(w, h);
      helixCam.aspect = w / h;
      helixCam.updateProjectionMatrix();
      ecgCam.left = -w / 2; ecgCam.right = w / 2;
      ecgCam.top  =  h / 2; ecgCam.bottom = -h / 2;
      ecgCam.updateProjectionMatrix();
      buildGrid(w, h);
      buildEcg(w);
    }
    window.addEventListener('resize', onResize);

    // ── Animation loop ──────────────────────────────────────────────────────
    let scroll = 0;

    function animate() {
      frameRef.current = requestAnimationFrame(animate);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // Helix: spin + parallax tilt
      if (!reduced.current) helixGroup.rotation.y += HELIX_SPIN;
      helixGroup.rotation.z =  mx * PARALLAX;
      helixGroup.position.y = -my * 6;

      // ECG: scroll the waveform and move the pulse head
      if (!reduced.current) scroll += ECG_SPEED;
      const baseY = ECG_BASE_Y - my * 6;
      let headY = baseY;
      for (let i = 0; i < count; i++) {
        const x = ecgPos[i * 3];
        const frac = (((x + scroll) % ECG_CYCLE) + ECG_CYCLE) % ECG_CYCLE / ECG_CYCLE;
        const y = baseY + ecgWave(frac) * ECG_AMP;
        ecgPos[i * 3 + 1] = y;
        if (i === count - 2) headY = y;
      }
      ecgGeom.attributes.position.needsUpdate = true;
      head.position.y = headY;

      renderer.clear();
      renderer.render(helixScene, helixCam);
      renderer.clearDepth();
      renderer.render(ecgScene, ecgCam);
    }
    frameRef.current = requestAnimationFrame(animate);

    // ── Cleanup ───────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('resize', onResize);
      if (gridLines) gridLines.geometry.dispose();
      disposables.forEach(d => d.dispose());
      renderer.dispose();
      if (node.contains(renderer.domElement)) node.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none z-0"
      style={{ width: '100%', height: '100%' }}
    />
  );
}
