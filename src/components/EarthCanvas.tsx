import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import {
  EARTH_RADIUS_KM,
  meanMotion,
  useKesslerStore,
  type CameraView,
  type KeplerElements,
} from "../store";

/* ============================================================================
 * KesslerShield — cinematic WebGL orbital canvas
 * ----------------------------------------------------------------------------
 * Vanilla three.js in one mount effect:
 *   • procedurally-shaded Earth + additive atmosphere + wireframe graticule
 *   • 3-layer parallax starfield + soft nebula sprites
 *   • fat-line orbital ribbons (Line2) with a gradient sheen + additive glow
 *   • gradient comet-trail behind the moving satellite & debris
 *   • UnrealBloom post-processing chain
 *   • 4 camera modes: Free Orbit / Chase Cam / Polar Top / Threat Vector Zoom
 * Splines rebuild only when the store `sceneVersion` changes; everything else
 * is imperative per-frame state read from the store.
 * ========================================================================== */

const EARTH_R = 2.45;
const KM_TO_SCENE = EARTH_R / EARTH_RADIUS_KM;
const ALT_EXAGGERATION = 6.4;
const TIME_SCALE = 52;
const ORBIT_SEGMENTS = 512;
const TRAIL_LEN = 60;

/* ---------------------------- Kepler → position ------------------------- */

function solveKepler(M: number, e: number): number {
  let E = e < 0.8 ? M : Math.PI;
  for (let i = 0; i < 7; i++) {
    E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  return E;
}

function kmRadiusToScene(rKm: number): number {
  return Math.max(
    EARTH_R * 1.012,
    EARTH_R + (rKm - EARTH_RADIUS_KM) * KM_TO_SCENE * ALT_EXAGGERATION
  );
}

function rotationTerms(el: KeplerElements) {
  const O = (el.raanDeg * Math.PI) / 180;
  const i = (el.inclinationDeg * Math.PI) / 180;
  const w = (el.argPerigeeDeg * Math.PI) / 180;
  const cO = Math.cos(O),
    sO = Math.sin(O),
    ci = Math.cos(i),
    si = Math.sin(i),
    cw = Math.cos(w),
    sw = Math.sin(w);
  return {
    r11: cO * cw - sO * sw * ci,
    r12: -cO * sw - sO * cw * ci,
    r21: sO * cw + cO * sw * ci,
    r22: -sO * sw + cO * cw * ci,
    r31: sw * si,
    r32: cw * si,
  };
}

function stateAtTrueAnomaly(
  el: KeplerElements,
  nu: number,
  out: THREE.Vector3
): THREE.Vector3 {
  const a = el.semiMajorAxisKm;
  const e = el.eccentricity;
  const p = a * (1 - e * e);
  const rKm = p / (1 + e * Math.cos(nu));
  const xp = rKm * Math.cos(nu);
  const yp = rKm * Math.sin(nu);
  const t = rotationTerms(el);
  const xe = t.r11 * xp + t.r12 * yp;
  const ye = t.r21 * xp + t.r22 * yp;
  const ze = t.r31 * xp + t.r32 * yp;
  const mag = Math.sqrt(xe * xe + ye * ye + ze * ze) || 1;
  const rScene = kmRadiusToScene(mag);
  out.set((xe / mag) * rScene, (ze / mag) * rScene, (ye / mag) * rScene);
  return out;
}

function epochMeanAnomaly(el: KeplerElements): number {
  const e = el.eccentricity;
  const nu = (el.trueAnomalyDeg * Math.PI) / 180;
  const E =
    2 *
    Math.atan2(
      Math.sqrt(1 - e) * Math.sin(nu / 2),
      Math.sqrt(1 + e) * Math.cos(nu / 2)
    );
  return E - e * Math.sin(E);
}

function trueAnomalyFromMean(M: number, e: number): number {
  const E = solveKepler(((M % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2), e);
  return (
    2 *
    Math.atan2(
      Math.sqrt(1 + e) * Math.sin(E / 2),
      Math.sqrt(1 - e) * Math.cos(E / 2)
    )
  );
}

function orbitCurvePoints(el: KeplerElements): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const v = new THREE.Vector3();
  for (let k = 0; k <= ORBIT_SEGMENTS; k++) {
    pts.push(stateAtTrueAnomaly(el, (k / ORBIT_SEGMENTS) * Math.PI * 2, v).clone());
  }
  return pts;
}

/* --------------------------- Fat orbit ribbon ------------------------- */

interface Ribbon {
  line: Line2;
  mat: LineMaterial;
  dispose: () => void;
}

function makeRibbon(
  points: THREE.Vector3[],
  baseHex: number,
  res: THREE.Vector2,
  opts: { width?: number; opacity?: number; dashed?: boolean } = {}
): Ribbon {
  const pos: number[] = [];
  const col: number[] = [];
  const base = new THREE.Color(baseHex);
  const hot = base.clone().lerp(new THREE.Color(0xffffff), 0.5);
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    pos.push(p.x, p.y, p.z);
    const sheen = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin((i / points.length) * Math.PI * 2));
    const c = base.clone().lerp(hot, sheen * 0.4);
    col.push(c.r, c.g, c.b);
  }
  const geom = new LineGeometry();
  geom.setPositions(pos);
  geom.setColors(col);
  const mat = new LineMaterial({
    linewidth: opts.width ?? 2.4,
    vertexColors: true,
    transparent: true,
    opacity: opts.opacity ?? 0.9,
    dashed: !!opts.dashed,
    dashSize: 0.5,
    gapSize: 0.28,
    depthWrite: false,
  });
  mat.resolution.copy(res);
  const line = new Line2(geom, mat);
  line.computeLineDistances();
  return {
    line,
    mat,
    dispose: () => {
      geom.dispose();
      mat.dispose();
    },
  };
}

/* --------------------------- Comet trail buffer ---------------------- */

interface Trail {
  line: THREE.Line;
  push: (p: THREE.Vector3) => void;
  reset: (p: THREE.Vector3) => void;
  dispose: () => void;
}

function makeTrail(hex: number): Trail {
  const buf = Array.from({ length: TRAIL_LEN }, () => new THREE.Vector3());
  const positions = new Float32Array(TRAIL_LEN * 3);
  const colors = new Float32Array(TRAIL_LEN * 3);
  const base = new THREE.Color(hex);
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const line = new THREE.Line(geom, mat);
  line.frustumCulled = false;

  const write = () => {
    for (let i = 0; i < TRAIL_LEN; i++) {
      const p = buf[i];
      positions[i * 3] = p.x;
      positions[i * 3 + 1] = p.y;
      positions[i * 3 + 2] = p.z;
      const frac = i / (TRAIL_LEN - 1); // 0 tail -> 1 head
      const k = Math.pow(frac, 1.7) * 1.15;
      colors[i * 3] = base.r * k;
      colors[i * 3 + 1] = base.g * k;
      colors[i * 3 + 2] = base.b * k;
    }
    geom.attributes.position.needsUpdate = true;
    geom.attributes.color.needsUpdate = true;
  };

  return {
    line,
    push: (p) => {
      for (let i = 0; i < TRAIL_LEN - 1; i++) buf[i].copy(buf[i + 1]);
      buf[TRAIL_LEN - 1].copy(p);
      write();
    },
    reset: (p) => {
      for (let i = 0; i < TRAIL_LEN; i++) buf[i].copy(p);
      write();
    },
    dispose: () => {
      geom.dispose();
      mat.dispose();
    },
  };
}

/* ------------------------------ Component --------------------------- */

const CAM_LABELS: Record<CameraView, string> = {
  free: "Free Orbit",
  chase: "Chase Cam",
  polar: "Polar Top",
  threat: "Threat Zoom",
};

export default function EarthCanvas() {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const cameraView = useKesslerStore((s) => s.cameraView);
  const setCameraView = useKesslerStore((s) => s.setCameraView);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const W = () => Math.max(1, mount.clientWidth);
    const H = () => Math.max(1, mount.clientHeight);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    renderer.setSize(W(), H());
    renderer.setClearColor(0x05070b, 1);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.76;
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x05070b, 0.012);

    const camera = new THREE.PerspectiveCamera(42, W() / H(), 0.1, 400);
    camera.position.set(3.6, 2.6, 8.8);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.rotateSpeed = 0.55;
    controls.minDistance = 3.6;
    controls.maxDistance = 24;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.26;

    const res = new THREE.Vector2(W(), H());

    /* ---- Flat Lighting ---- */
    const sunDir = new THREE.Vector3(1, 0.36, 0.7).normalize();
    const sun = new THREE.DirectionalLight(0xfff2e2, 1.8);
    sun.position.copy(sunDir).multiplyScalar(30);
    scene.add(sun, new THREE.AmbientLight(0x3A362E, 0.9));

    /* ---- RA/Dec Celestial Coordinate Gridlines (Star Chart Format) ---- */
    const celGridGroup = new THREE.Group();
    const celMat = new THREE.LineBasicMaterial({
      color: 0x2A2822,
      transparent: true,
      opacity: 0.35,
    });
    const celRadius = 14;

    // 24 RA Hour Meridians
    for (let h = 0; h < 24; h++) {
      const raRad = (h / 24) * Math.PI * 2;
      const pts: THREE.Vector3[] = [];
      for (let lat = -80; lat <= 80; lat += 5) {
        const decRad = (lat * Math.PI) / 180;
        pts.push(
          new THREE.Vector3(
            celRadius * Math.cos(decRad) * Math.cos(raRad),
            celRadius * Math.sin(decRad),
            celRadius * Math.cos(decRad) * Math.sin(raRad)
          )
        );
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      celGridGroup.add(new THREE.Line(g, celMat));
    }

    // 9 Declination Parallel Latitude Rings
    for (let dec = -60; dec <= 60; dec += 20) {
      if (dec === 0) continue;
      const decRad = (dec * Math.PI) / 180;
      const rDec = celRadius * Math.cos(decRad);
      const yDec = celRadius * Math.sin(decRad);
      const pts: THREE.Vector3[] = [];
      for (let ra = 0; ra <= 360; ra += 5) {
        const raRad = (ra * Math.PI) / 180;
        pts.push(
          new THREE.Vector3(
            rDec * Math.cos(raRad),
            yDec,
            rDec * Math.sin(raRad)
          )
        );
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      celGridGroup.add(new THREE.Line(g, celMat));
    }
    scene.add(celGridGroup);

    /* ---- Altitude Shell Rings (LEO / MEO / GEO) ---- */
    const shellGroup = new THREE.Group();
    const shellMat = new THREE.LineBasicMaterial({
      color: 0xFFB000,
      transparent: true,
      opacity: 0.15,
    });
    [EARTH_R * 1.3, EARTH_R * 2.2, EARTH_R * 3.8].forEach((rShell) => {
      const pts: THREE.Vector3[] = [];
      for (let a = 0; a <= 360; a += 3) {
        const rad = (a * Math.PI) / 180;
        pts.push(new THREE.Vector3(rShell * Math.cos(rad), 0, rShell * Math.sin(rad)));
      }
      const g = new THREE.BufferGeometry().setFromPoints(pts);
      shellGroup.add(new THREE.Line(g, shellMat));
    });
    scene.add(shellGroup);

function createVectorEarthTexture(): THREE.CanvasTexture {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return new THREE.CanvasTexture(new Image());
  }
  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Deep Void Ocean Background
  ctx.fillStyle = "#060A12";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // High-Contrast Latitude / Longitude Graticule Grid (#223652 Luminous Grid)
  ctx.strokeStyle = "#1C2E47";
  ctx.lineWidth = 2.0;
  for (let x = 0; x <= canvas.width; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += 64) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Luminous Equator Axis Line (#f59e0b Amber)
  ctx.strokeStyle = "#f59e0b";
  ctx.lineWidth = 3.5;
  ctx.shadowColor = "#f59e0b";
  ctx.shadowBlur = 8;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height / 2);
  ctx.lineTo(canvas.width, canvas.height / 2);
  ctx.stroke();
  ctx.shadowBlur = 0; // Reset shadow

  // Connected High-Definition Vector Landmass Polygons (Explicitly Isolated Closed Rings)
  const LANDMASSES: Array<Array<[number, number]>> = [
    // North America (Cleanly Closed Loop)
    [[-168, 65], [-160, 71], [-140, 69], [-120, 68], [-95, 67], [-84, 66], [-76, 62], [-64, 60], [-55, 52], [-64, 44], [-70, 43], [-75, 35], [-80, 25], [-88, 30], [-97, 26], [-97, 20], [-105, 20], [-115, 30], [-124, 40], [-124, 48], [-135, 57], [-150, 60], [-168, 65]],
    // Central America Bridge
    [[-90, 16], [-83, 9], [-77, 8], [-80, 15], [-90, 16]],
    // South America (Cleanly Closed Loop)
    [[-77, 9], [-60, 8], [-50, 0], [-35, -5], [-35, -10], [-40, -20], [-50, -30], [-65, -54], [-75, -50], [-72, -40], [-70, -30], [-76, -14], [-80, -2], [-77, 9]],
    // Eurasia & Europe
    [[10, 54], [25, 60], [30, 70], [60, 70], [90, 75], [120, 73], [140, 70], [170, 66], [178, 65], [160, 55], [140, 50], [130, 40], [120, 32], [108, 20], [100, 10], [98, 4], [80, 13], [70, 20], [60, 25], [50, 26], [40, 15], [32, 30], [25, 36], [15, 40], [0, 44], [-9, 38], [-9, 43], [-1, 50], [10, 54]],
    // Africa
    [[-5, 35], [10, 37], [25, 32], [33, 28], [43, 12], [51, 11], [40, -10], [33, -28], [20, -34], [15, -23], [10, -5], [0, 5], [-15, 12], [-17, 21], [-5, 35]],
    // Australia & NZ
    [[114, -22], [130, -14], [136, -12], [142, -10], [150, -24], [153, -28], [147, -38], [138, -35], [135, -33], [115, -34], [114, -22]],
    // Greenland
    [[-55, 60], [-40, 65], [-20, 70], [-18, 80], [-50, 82], [-70, 78], [-55, 60]],
    // Antarctica
    [[-179, -70], [179, -70], [179, -89], [-179, -89], [-179, -70]]
  ];

  ctx.fillStyle = "rgba(14, 26, 43, 0.95)"; // Deep High-Contrast Slate Fill
  ctx.strokeStyle = "#38bdf8"; // Luminous Laser-Etched Sky Cyan
  ctx.shadowColor = "#38bdf8"; // Luminous Cyan Glow
  ctx.shadowBlur = 10;
  ctx.lineWidth = 5.5;

  LANDMASSES.forEach((poly) => {
    ctx.beginPath();
    poly.forEach(([lon, lat], i) => {
      const x = ((lon + 180) / 360) * canvas.width;
      const y = ((90 - lat) / 180) * canvas.height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
  ctx.shadowBlur = 0; // Reset shadow

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

    /* ---- Diagrammatic Vector Canvas Globe ---- */
    const earthTexture = createVectorEarthTexture();
    const earthMat = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.7,
      metalness: 0.2,
    });
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(EARTH_R, 64, 64),
      earthMat
    );
    scene.add(earth);

    /* ---- Atmospheric Fresnel Rim Shader Glow (#38bdf8 Sky Cyan Rim) ---- */
    const atmosMat = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float intensity = pow(0.7 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.8);
          gl_FragColor = vec4(0.22, 0.74, 0.97, 0.60) * intensity;
        }
      `,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
    const atmosMesh = new THREE.Mesh(new THREE.SphereGeometry(EARTH_R * 1.14, 64, 64), atmosMat);
    scene.add(atmosMesh);

    // High-Contrast Latitude / Longitude 3D Graticule Grid (#5A564A Muted Gold-Gray)
    const grat = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.SphereGeometry(EARTH_R * 1.002, 36, 24)),
      new THREE.LineBasicMaterial({
        color: 0x5A564A,
        transparent: true,
        opacity: 0.38,
      })
    );
    scene.add(grat);



    // Luminous Equator Axis Ring (#f59e0b Amber)
    const equator = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(
        Array.from({ length: 120 }, (_, i) => {
          const a = (i / 120) * Math.PI * 2;
          return new THREE.Vector3(EARTH_R * 1.006 * Math.cos(a), 0, EARTH_R * 1.006 * Math.sin(a));
        })
      ),
      new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.6 })
    );
    equator.rotation.x = Math.PI / 2;
    scene.add(equator);

    /* ---- 3D LEO Constellation (24 3D Satellites with Solar Panel Wings & Glowing Halos) ---- */
    const constGroup = new THREE.Group();
    const constSatellites: Array<{
      group: THREE.Group;
      r: number;
      inc: number;
      raan: number;
      speed: number;
      phase: number;
    }> = [];

    const satBodyGeo = new THREE.BoxGeometry(0.035, 0.035, 0.05);
    const satWingGeo = new THREE.BoxGeometry(0.18, 0.004, 0.04);
    const satBodyMat = new THREE.MeshStandardMaterial({
      color: 0x00f0ff,
      emissive: 0x00a3b4,
      emissiveIntensity: 0.95,
      metalness: 0.85,
      roughness: 0.2,
    });
    const satWingMat = new THREE.MeshStandardMaterial({
      color: 0x06b6d4,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.65,
      metalness: 0.9,
      roughness: 0.1,
    });

    for (let i = 0; i < 24; i++) {
      const satG = new THREE.Group();
      const body = new THREE.Mesh(satBodyGeo, satBodyMat);
      const wings = new THREE.Mesh(satWingGeo, satWingMat);
      satG.add(body, wings);

      const r = EARTH_R + 0.16 + (i % 4) * 0.05;
      const inc = ((40 + (i % 5) * 14) * Math.PI) / 180;
      const raan = (((i * 53) % 360) * Math.PI) / 180;
      const speed = 0.25 + (i % 3) * 0.05;
      const phase = (i * Math.PI * 2) / 24;

      constGroup.add(satG);
      constSatellites.push({ group: satG, r, inc, raan, speed, phase });
    }

    scene.add(constGroup);

    /* ---- moving bodies ---- */
    const satMesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.052, 1),
      new THREE.MeshStandardMaterial({
        color: 0xFFB000,
        emissive: 0xFFB000,
        emissiveIntensity: 0.6,
        metalness: 0.8,
        roughness: 0.2,
      })
    );
    const satPanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.006, 0.07),
      new THREE.MeshStandardMaterial({
        color: 0x8C887B,
        metalness: 0.9,
        roughness: 0.1,
      })
    );
    satMesh.add(satPanel);
    scene.add(satMesh);

    const debrisMesh = new THREE.Mesh(
      new THREE.DodecahedronGeometry(0.046, 0),
      new THREE.MeshStandardMaterial({
        color: 0xC4453D,
        emissive: 0xC4453D,
        emissiveIntensity: 0.5,
        metalness: 0.2,
        roughness: 0.8,
      })
    );
    scene.add(debrisMesh);

    const satTrail = makeTrail(0xFFB000);
    const debTrail = makeTrail(0xC4453D);
    scene.add(satTrail.line, debTrail.line);

    /* ---- hazard marker ---- */
    const hazard = new THREE.Group();
    const hazardCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.055, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xC4453D })
    );
    const hazardRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.16, 0.008, 10, 48),
      new THREE.MeshBasicMaterial({
        color: 0xC4453D,
        transparent: true,
        opacity: 0.8,
      })
    );
    const hazardRing2 = hazardRing.clone();
    hazardRing2.material = (hazardRing.material as THREE.MeshBasicMaterial).clone();
    hazard.add(hazardCore, hazardRing, hazardRing2);
    hazard.add(hazardCore, hazardRing, hazardRing2);
    scene.add(hazard);

    /* ---- orbit ribbons (rebuilt on sceneVersion) ---- */
    let nominalR: Ribbon | null = null;
    let nominalGlow: Ribbon | null = null;
    let debrisR: Ribbon | null = null;
    let avoidR: Ribbon | null = null;
    let avoidGlow: Ribbon | null = null;

    const scratch = new THREE.Vector3();
    const scratchB = new THREE.Vector3();

    function nearestApproach(aEl: KeplerElements, bEl: KeplerElements): THREE.Vector3 {
      let best = Infinity;
      const mid = new THREE.Vector3();
      const step = Math.PI / 90;
      for (let u = 0; u < Math.PI * 2; u += step) {
        stateAtTrueAnomaly(aEl, u, scratch);
        for (let w = 0; w < Math.PI * 2; w += step) {
          stateAtTrueAnomaly(bEl, w, scratchB);
          const d = scratch.distanceToSquared(scratchB);
          if (d < best) {
            best = d;
            mid.copy(scratch).add(scratchB).multiplyScalar(0.5);
          }
        }
      }
      return mid;
    }

    const disposeRibbon = (r: Ribbon | null) => {
      if (!r) return;
      r.line.removeFromParent();
      r.dispose();
    };

    function rebuild() {
      const st = useKesslerStore.getState();
      disposeRibbon(nominalR);
      disposeRibbon(nominalGlow);
      disposeRibbon(debrisR);
      disposeRibbon(avoidR);
      disposeRibbon(avoidGlow);
      avoidR = null;
      avoidGlow = null;

      const nomColor = st.phase === "CLEARED" ? 0x20e39b : 0x00f0ff;
      nominalR = makeRibbon(orbitCurvePoints(st.activeElements), nomColor, res, {
        width: 2.6,
        opacity: 0.95,
      });
      nominalGlow = makeRibbon(orbitCurvePoints(st.activeElements), nomColor, res, {
        width: 7.5,
        opacity: 0.12,
      });
      scene.add(nominalGlow.line, nominalR.line);

      debrisR = makeRibbon(orbitCurvePoints(st.debrisElements), 0xff3b4e, res, {
        width: 2.4,
        opacity: 0.9,
      });
      scene.add(debrisR.line);

      if (st.avoidanceElements && st.phase !== "CLEARED") {
        const avPts = orbitCurvePoints(st.avoidanceElements);
        avoidGlow = makeRibbon(avPts, 0xffb020, res, { width: 8, opacity: 0.14 });
        avoidR = makeRibbon(avPts, 0xffb020, res, {
          width: 3.2,
          opacity: 0.98,
          dashed: true,
        });
        scene.add(avoidGlow.line, avoidR.line);
      }

      hazard.position.copy(
        nearestApproach(
          st.phase === "CLEARED" ? st.activeElements : st.nominalElements,
          st.debrisElements
        )
      );
    }
    rebuild();

    let lastSceneVersion = useKesslerStore.getState().sceneVersion;
    const unsub = useKesslerStore.subscribe((s) => {
      if (s.sceneVersion !== lastSceneVersion) {
        lastSceneVersion = s.sceneVersion;
        rebuild();
        const el = useKesslerStore.getState().activeElements;
        const dEl = useKesslerStore.getState().debrisElements;
        satM0 = epochMeanAnomaly(el);
        debM0 = epochMeanAnomaly(dEl);
        stateAtTrueAnomaly(el, trueAnomalyFromMean(satM0, el.eccentricity), scratch);
        satTrail.reset(scratch);
        stateAtTrueAnomaly(dEl, trueAnomalyFromMean(debM0, dEl.eccentricity), scratchB);
        debTrail.reset(scratchB);
      }
    });

    /* ---- resize ---- */
    const onResize = () => {
      const w = W();
      const h = H();
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      res.set(w, h);
      [nominalR, nominalGlow, debrisR, avoidR, avoidGlow].forEach(
        (r) => r && r.mat.resolution.set(w, h)
      );
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(mount);
    window.addEventListener("resize", onResize);

    /* ---- camera rig ---- */
    const camDesired = new THREE.Vector3();
    const tgtDesired = new THREE.Vector3();
    const upVec = new THREE.Vector3(0, 1, 0);
    const prevSat = new THREE.Vector3();
    const HOME = new THREE.Vector3(3.6, 2.6, 8.8);
    const ORIGIN = new THREE.Vector3(0, 0, 0);
    let lastView: CameraView = "free";
    let freeReturning = false;

    /* ---- animation loop ---- */
    const clock = new THREE.Clock();
    let raf = 0;
    let satM0 = epochMeanAnomaly(useKesslerStore.getState().activeElements);
    let debM0 = epochMeanAnomaly(useKesslerStore.getState().debrisElements);

    const animate = () => {
      raf = requestAnimationFrame(animate);
      const dt = Math.min(clock.getDelta(), 0.05);
      const t = clock.elapsedTime;
      const st = useKesslerStore.getState();

      earth.rotation.y += dt * 0.042;
      grat.rotation.y -= dt * 0.028;
      grat.rotation.x = Math.sin(t * 0.1) * 0.035;
      equator.rotation.z += dt * 0.02;

      // Update 3D LEO Satellite Constellation positions and orientation
      for (let i = 0; i < constSatellites.length; i++) {
        const s = constSatellites[i];
        const u = s.phase + t * s.speed * 0.15;
        const x0 = s.r * Math.cos(u);
        const y0 = s.r * Math.sin(u);
        const cO = Math.cos(s.raan), sO = Math.sin(s.raan);
        const cI = Math.cos(s.inc), sI = Math.sin(s.inc);
        const x = cO * x0 - sO * y0 * cI;
        const y = y0 * sI;
        const z = sO * x0 + cO * y0 * cI;
        s.group.position.set(x, y, z);
        s.group.lookAt(0, 0, 0);
        s.group.rotation.z += dt * 0.5;
      }

      // satellite
      const satEl = st.activeElements;
      const nuSat = trueAnomalyFromMean(
        satM0 + meanMotion(satEl.semiMajorAxisKm) * t * TIME_SCALE,
        satEl.eccentricity
      );
      prevSat.copy(satMesh.position);
      stateAtTrueAnomaly(satEl, nuSat, scratch);
      satMesh.position.copy(scratch);
      satMesh.lookAt(0, 0, 0);
      satMesh.rotation.z += dt * 0.6;
      (satMesh.material as THREE.MeshStandardMaterial).emissiveIntensity =
        1.3 + Math.sin(t * 4) * 0.3;

      // debris
      const debEl = st.debrisElements;
      const nuDeb = trueAnomalyFromMean(
        debM0 - meanMotion(debEl.semiMajorAxisKm) * t * TIME_SCALE * 1.04,
        debEl.eccentricity
      );
      stateAtTrueAnomaly(debEl, nuDeb, scratchB);
      debrisMesh.position.copy(scratchB);
      debrisMesh.rotation.x += dt * 1.4;
      debrisMesh.rotation.y += dt * 1.1;

      satTrail.push(satMesh.position);
      debTrail.push(debrisMesh.position);

      // hazard marker
      const cleared = st.phase === "CLEARED";
      hazard.visible = !cleared;
      if (!cleared) {
        hazard.scale.setScalar(1 + Math.sin(t * 5.4) * 0.2);
        hazard.rotation.y += dt * 1.5;
        hazard.rotation.x += dt * 0.85;
        (hazardRing2.material as THREE.MeshBasicMaterial).opacity =
          0.45 + Math.sin(t * 5.4 + 1) * 0.35;
        hazardRing2.scale.setScalar(1 + (Math.sin(t * 3) * 0.5 + 0.5) * 0.9);
      }

      if (avoidR) {
        avoidR.mat.dashOffset = -t * 0.35;
        avoidR.mat.opacity = 0.6 + (0.5 + 0.5 * Math.sin(t * 3)) * 0.4;
      }

      // ---- camera modes: Free Orbit / Chase Cam / Polar Top / Threat Zoom ----
      const view = st.cameraView;
      const justSwitched = view !== lastView;
      lastView = view;
      if (justSwitched && view === "free") freeReturning = true;

      // OrbitControls only listens while Free Orbit is settled.
      controls.enabled = view === "free" && !freeReturning;
      controls.autoRotate = view === "free" && !freeReturning;

      if (view === "free") {
        if (freeReturning) {
          camera.position.lerp(HOME, 0.06);
          controls.target.lerp(ORIGIN, 0.08);
          camera.lookAt(controls.target);
          if (camera.position.distanceTo(HOME) < 0.25) freeReturning = false;
        } else {
          controls.update();
        }
      } else if (view === "polar") {
        camDesired.set(0.02, 12.5, 3.6);
        tgtDesired.set(0, 0, 0);
        camera.position.lerp(camDesired, justSwitched ? 0.1 : 0.05);
        controls.target.lerp(tgtDesired, 0.09);
        camera.lookAt(controls.target);
      } else if (view === "chase") {
        const vel = scratch.copy(satMesh.position).sub(prevSat);
        if (vel.lengthSq() < 1e-8) vel.set(0, 0, 1);
        vel.normalize();
        const radial = scratchB.copy(satMesh.position).normalize();
        camDesired
          .copy(satMesh.position)
          .addScaledVector(vel, -2.4)
          .addScaledVector(radial, 1.05)
          .addScaledVector(upVec, 0.45);
        tgtDesired.copy(satMesh.position).addScaledVector(vel, 1.4);
        camera.position.lerp(camDesired, justSwitched ? 0.12 : 0.08);
        controls.target.lerp(tgtDesired, 0.14);
        camera.lookAt(controls.target);
      } else {
        // threat vector zoom — frame the closest-approach point
        const dir = scratch.copy(hazard.position).normalize();
        camDesired
          .copy(hazard.position)
          .addScaledVector(dir, 3.6)
          .addScaledVector(upVec, 1.1);
        tgtDesired.copy(hazard.position);
        camera.position.lerp(camDesired, justSwitched ? 0.08 : 0.045);
        controls.target.lerp(tgtDesired, 0.09);
        camera.lookAt(controls.target);
      }

      renderer.render(scene, camera);
    };
    animate();

    /* ---- cleanup ---- */
    return () => {
      cancelAnimationFrame(raf);
      unsub();
      ro.disconnect();
      window.removeEventListener("resize", onResize);
      controls.dispose();

      disposeRibbon(nominalR);
      disposeRibbon(nominalGlow);
      disposeRibbon(debrisR);
      disposeRibbon(avoidR);
      disposeRibbon(avoidGlow);
      satTrail.dispose();
      debTrail.dispose();

      scene.traverse((obj) => {
        const m = obj as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose?.();
      });
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#000000]">
      <div ref={mountRef} className="absolute inset-0" />

      {/* Camera Modes Toolbar */}
      <div className="absolute left-1/2 -translate-x-1/2 top-12 z-40 flex items-center gap-1 p-1 border border-[#2A2822] bg-[#141310]/95">
        {(Object.keys(CAM_LABELS) as CameraView[]).map((v) => (
          <button
            key={v}
            onClick={() => setCameraView(v)}
            className={`px-2.5 py-1 font-space text-[9.5px] font-bold uppercase transition ${
              cameraView === v
                ? "bg-[#2A2822] text-[#FFB000] border border-[#FFB000]/60"
                : "text-[#8C887B] hover:text-[#D8D4C8]"
            }`}
          >
            {CAM_LABELS[v]}
          </button>
        ))}
      </div>

      {/* Track Legend */}
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 px-3 py-1.5 border border-[#2A2822] bg-[#141310]/90 font-space text-[9.5px] text-[#D8D4C8]">
        <span className="font-bold text-[#FFB000]">TRACKS</span>
        {[
          ["bg-[#FFB000]", "Active Sat"],
          ["bg-[#C4453D]", "Debris"],
          ["bg-[#33FF66]", "Cleared"],
        ].map(([c, label]) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className={`inline-block h-2 w-2 ${c}`} />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
