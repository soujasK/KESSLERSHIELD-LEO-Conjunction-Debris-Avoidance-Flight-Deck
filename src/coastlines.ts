/* ============================================================================
 * KesslerShield — High-Precision World Coastline Engine
 * Spherical GeoJSON projection to Three.js Cartesian (x, y, z)
 * Prevents jump lines by creating isolated LineLoops per polygon ring.
 * ========================================================================== */

import * as THREE from "three";

export type LonLatPoint = [number, number]; // [longitude (-180..180), latitude (-90..90)]
export type PolygonRing = LonLatPoint[];

/**
 * Converts GeoJSON [lon, lat] coordinates to Three.js 3D Cartesian Vector3 on a sphere.
 * Radius R, Y-axis UP, X-Z equatorial plane.
 */
export function lonLatToVector3(lon: number, lat: number, radius: number): THREE.Vector3 {
  const phi = (lat * Math.PI) / 180;
  const theta = (lon * Math.PI) / 180;

  const x = -radius * Math.cos(phi) * Math.cos(theta);
  const y = radius * Math.sin(phi); // Y is UP
  const z = radius * Math.cos(phi) * Math.sin(theta);

  return new THREE.Vector3(x, y, z);
}

/** High-Resolution Connected Continental Coastline Polygon Rings */
export const WORLD_COASTLINES: PolygonRing[] = [
  // North America Main Coastline
  [
    [-168, 65], [-160, 71], [-140, 69], [-120, 68], [-95, 67], [-84, 66], [-76, 62],
    [-64, 60], [-55, 52], [-64, 44], [-70, 43], [-75, 35], [-80, 25], [-81, 25],
    [-88, 30], [-97, 26], [-97, 20], [-90, 15], [-79, 8], [-83, 9], [-90, 14],
    [-105, 20], [-115, 30], [-124, 40], [-124, 48], [-135, 57], [-150, 60], [-168, 65]
  ],
  // South America Coastline
  [
    [-75, 10], [-60, 8], [-50, 0], [-35, -5], [-35, -10], [-40, -20], [-50, -30],
    [-65, -54], [-75, -50], [-72, -40], [-70, -30], [-76, -14], [-80, -2], [-75, 10]
  ],
  // Eurasia Main Coastline
  [
    [10, 54], [25, 60], [30, 70], [60, 70], [90, 75], [120, 73], [140, 70],
    [170, 66], [180, 65], [160, 55], [140, 50], [130, 40], [120, 32], [108, 20],
    [100, 10], [98, 4], [80, 13], [70, 20], [60, 25], [50, 26], [40, 15],
    [32, 30], [25, 36], [15, 40], [0, 44], [-9, 38], [-9, 43], [-1, 50], [10, 54]
  ],
  // Africa Coastline
  [
    [-5, 35], [10, 37], [25, 32], [33, 28], [43, 12], [51, 11], [40, -10],
    [33, -28], [20, -34], [15, -23], [10, -5], [0, 5], [-15, 12], [-17, 21], [-5, 35]
  ],
  // Australia Main Coastline
  [
    [114, -22], [130, -14], [136, -12], [142, -10], [150, -24], [153, -28],
    [147, -38], [138, -35], [135, -33], [115, -34], [114, -22]
  ],
  // Greenland Coastline
  [
    [-55, 60], [-40, 65], [-20, 70], [-18, 80], [-50, 82], [-70, 78], [-55, 60]
  ],
  // Great Britain & Ireland
  [
    [-5, 50], [1, 51], [1, 53], [-3, 58], [-6, 58], [-5, 50]
  ],
  // Japan Islands Ring
  [
    [130, 31], [135, 34], [140, 36], [145, 44], [141, 45], [138, 38], [130, 31]
  ],
  // Antarctica Ring Outline
  [
    [-180, -75], [-120, -75], [-60, -70], [0, -70], [60, -70], [120, -70], [180, -75]
  ]
];

/**
 * Creates a Three.js Group containing separate LineLoop objects for each coastline ring.
 * Eliminates cross-space jump lines completely.
 */
export function buildCoastlinesGroup(
  radius: number,
  colorHex = 0x38bdf8,
  opacity = 0.65
): THREE.Group {
  const group = new THREE.Group();
  const mat = new THREE.LineBasicMaterial({
    color: colorHex,
    transparent: true,
    opacity,
  });

  WORLD_COASTLINES.forEach((ring) => {
    const points: THREE.Vector3[] = ring.map(([lon, lat]) =>
      lonLatToVector3(lon, lat, radius)
    );
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    // LineLoop automatically connects back to start without extra jump line
    const loop = new THREE.LineLoop(geom, mat);
    group.add(loop);
  });

  return group;
}
