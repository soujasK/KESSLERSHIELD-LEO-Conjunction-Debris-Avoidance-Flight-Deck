import { create } from "zustand";
import { fetchLiveNoradTle } from "./tle";

/* ============================================================================
 * KesslerShield — client-side decision engine for high-consequence human–AI ops
 * ----------------------------------------------------------------------------
 * Instantiated here as LEO collision avoidance, but the loop is domain-agnostic:
 *   inspect  ->  evaluate options  ->  stage a plan  ->  human authorizes  ->  commit
 * All state lives in browser RAM. The WebMCP tools (webmcp.ts) call the exact
 * same actions a human operator would, so agent and operator drive one sim.
 * ========================================================================== */

/* ----------------------------- Physical constants -------------------------- */

export const MU_EARTH = 398_600.4418; // μ = G·M⊕ [km³/s²]
export const EARTH_RADIUS_KM = 6_378.137; // WGS-84 mean equatorial radius
export const SAFETY_CORRIDOR_KM = 5.0; // conjunction "cleared" past this radial miss
export const ACS_OVERHEAD_MPS = 0.05; // attitude-control overhead per burn

/* --------------------------------- Types ---------------------------------- */

export type BurnType = "RETROGRADE" | "PROGRADE" | "OUT_OF_PLANE";

export type ThreatLevel =
  | "NOMINAL"
  | "ELEVATED"
  | "HIGH"
  | "CRITICAL"
  | "CLEARED";

export type MissionPhase = "NOMINAL" | "ALERT" | "STAGED" | "COMMITTED" | "CLEARED";

export type LogChannel = "tool" | "agent" | "system" | "human";
export type LogLevel = "info" | "warn" | "success" | "hazard";

export type CameraView = "free" | "chase" | "polar" | "threat";

export interface KeplerElements {
  semiMajorAxisKm: number;
  eccentricity: number;
  inclinationDeg: number;
  raanDeg: number;
  argPerigeeDeg: number;
  trueAnomalyDeg: number;
}

export interface AuditLogEntry {
  id: string;
  ts: number;
  clock: string;
  channel: LogChannel;
  direction: "invoke" | "result" | "info";
  tool?: string;
  title: string;
  input?: unknown;
  output?: unknown;
  level: LogLevel;
  /** pseudo-HTTP status pill for the stream UI */
  status: number;
}

export interface StagedBurn {
  burnType: BurnType;
  deltaVMPS: number;
  burnTimeDeltaSec: number;
  projectedMissDistanceKm: number;
  propellantExpenditureMPS: number;
  corridorClear: boolean;
  status: string;
  stagedAtClock: string;
}

export interface ConjunctionGeometry {
  satelliteId: string;
  debrisTrack: string;
  altitudeKm: number;
  velocityKmS: number;
  timeToClosestApproachSec: number;
  missDistanceMeters: number;
  collisionProbability: number;
  remainingDeltaVMPS: number;
  threatLevel: ThreatLevel;
}

export interface CommitResult {
  success: boolean;
  missionStatus: string;
  clearedMissDistanceMeters: number;
}

export interface StageResult {
  success: boolean;
  projectedMissDistanceKm: number;
  propellantExpenditureMPS: number;
  corridorClear: boolean;
  status: string;
}

export interface AvoidanceOption {
  burnType: BurnType;
  deltaVMPS: number;
  burnTimeDeltaSec: number;
  projectedMissDistanceKm: number;
  propellantExpenditureMPS: number;
  corridorClear: boolean;
  feasible: boolean;
  marginKm: number;
}

export interface TradeStudyResult {
  leadTimeSec: number;
  corridorKm: number;
  options: AvoidanceOption[];
  recommended: {
    burnType: BurnType;
    deltaVMPS: number;
    burnTimeDeltaSec: number;
  } | null;
  rationale: string;
  evaluatedAtClock: string;
}

/* ------------------------------- Scenarios ------------------------------- */

export interface Scenario {
  id: string;
  short: string;
  name: string;
  subtitle: string;
  satelliteId: string;
  debrisTrack: string;
  orbitLabel: string;
  nominal: KeplerElements;
  debris: KeplerElements;
  baseline: {
    missDistanceMeters: number;
    timeToClosestApproachSec: number;
    collisionProbability: number;
    remainingDeltaVMPS: number;
  };
}

export const SCENARIOS: Scenario[] = [
  {
    id: "sentinel-sso",
    short: "SENTINEL-7",
    name: "Sentinel-7 · Sun-Synchronous",
    subtitle: "EO smallsat vs Cosmos-1408 fragmentation debris",
    satelliteId: "KES-LEO-07 // SENTINEL",
    debrisTrack: "DEB-COSMOS-1408",
    orbitLabel: "97.4° SSO",
    nominal: {
      semiMajorAxisKm: EARTH_RADIUS_KM + 545,
      eccentricity: 0.0011,
      inclinationDeg: 97.4,
      raanDeg: 64,
      argPerigeeDeg: 90,
      trueAnomalyDeg: 210,
    },
    debris: {
      semiMajorAxisKm: EARTH_RADIUS_KM + 551,
      eccentricity: 0.021,
      inclinationDeg: 82.9,
      raanDeg: 129,
      argPerigeeDeg: 41,
      trueAnomalyDeg: 26,
    },
    baseline: {
      missDistanceMeters: 84,
      timeToClosestApproachSec: 1680,
      collisionProbability: 1.19e-3,
      remainingDeltaVMPS: 42.0,
    },
  },
  {
    id: "iss-node",
    short: "ISS",
    name: "ISS · Crewed Station",
    subtitle: "Station keep-out sphere vs CZ-4C rocket-body fragment",
    satelliteId: "ISS (ZARYA) // NODE-2",
    debrisTrack: "DEB-CZ-4C R/B",
    orbitLabel: "51.6° ISS",
    nominal: {
      semiMajorAxisKm: EARTH_RADIUS_KM + 418,
      eccentricity: 0.0006,
      inclinationDeg: 51.6,
      raanDeg: 118,
      argPerigeeDeg: 70,
      trueAnomalyDeg: 300,
    },
    debris: {
      semiMajorAxisKm: EARTH_RADIUS_KM + 427,
      eccentricity: 0.014,
      inclinationDeg: 74.0,
      raanDeg: 22,
      argPerigeeDeg: 200,
      trueAnomalyDeg: 140,
    },
    baseline: {
      missDistanceMeters: 118,
      timeToClosestApproachSec: 2520,
      collisionProbability: 7.8e-4,
      remainingDeltaVMPS: 65.0,
    },
  },
  {
    id: "polar-sso",
    short: "POLAR SSO",
    name: "GeoScan-2 · Near-Polar",
    subtitle: "705 km imager vs Fengyun-1C ASAT debris cloud",
    satelliteId: "GEOSCAN-2 // POLAR",
    debrisTrack: "DEB-FENGYUN-1C",
    orbitLabel: "98.2° POLAR",
    nominal: {
      semiMajorAxisKm: EARTH_RADIUS_KM + 705,
      eccentricity: 0.0018,
      inclinationDeg: 98.2,
      raanDeg: 15,
      argPerigeeDeg: 90,
      trueAnomalyDeg: 45,
    },
    debris: {
      semiMajorAxisKm: EARTH_RADIUS_KM + 698,
      eccentricity: 0.03,
      inclinationDeg: 63.4,
      raanDeg: 250,
      argPerigeeDeg: 300,
      trueAnomalyDeg: 210,
    },
    baseline: {
      missDistanceMeters: 63,
      timeToClosestApproachSec: 1440,
      collisionProbability: 2.05e-3,
      remainingDeltaVMPS: 31.0,
    },
  },
];

/* ------------------------- Astrodynamics helpers -------------------------- */

export function visViva(rKm: number, aKm: number): number {
  return Math.sqrt(MU_EARTH * (2 / rKm - 1 / aKm));
}

export function orbitalPeriodSec(aKm: number): number {
  return 2 * Math.PI * Math.sqrt((aKm * aKm * aKm) / MU_EARTH);
}

export function meanMotion(aKm: number): number {
  return Math.sqrt(MU_EARTH / (aKm * aKm * aKm));
}

/**
 * Linearised separation at TCA from an impulsive Δv applied `leadSec` early.
 * RETROGRADE exploits the Clohessy-Wiltshire secular down-track term most
 * efficiently (~3·Δv·t); PROGRADE lifts into busier shells and pays a modelled
 * penalty (~2.35·Δv·t); OUT_OF_PLANE is least efficient (~1.6·Δv·t).
 */
export function burnDisplacementMeters(
  burnType: BurnType,
  deltaVMPS: number,
  leadSec: number
): number {
  const dv = Math.max(0, deltaVMPS);
  const t = Math.max(0, leadSec);
  const k =
    burnType === "OUT_OF_PLANE" ? 1.6 : burnType === "PROGRADE" ? 2.35 : 3.0;
  return k * dv * t;
}

export function oddsString(p: number): string {
  if (p <= 0) return "1 : ∞";
  return `1 : ${Math.round(1 / p).toLocaleString("en-US")}`;
}

export function nowClock(d: Date = new Date()): string {
  const p = (n: number, l = 2) => String(n).padStart(l, "0");
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(
    d.getMilliseconds(),
    3
  )}`;
}

/** "seconds until" -> "T-MM:SS" (ahead) / "T+MM:SS" (past). */
export function formatTca(secUntil: number): string {
  const sign = secUntil >= 0 ? "-" : "+";
  const a = Math.abs(Math.round(secUntil));
  return `T${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(
    a % 60
  ).padStart(2, "0")}`;
}

function leadTimeFor(tcaSec: number): number {
  return Math.max(90, Math.min(tcaSec - 90, tcaSec * 0.92));
}

let _uid = 0;
const uid = () => `evt_${Date.now().toString(36)}_${(_uid++).toString(36)}`;

const HIST = 72;
const pushHist = (arr: number[], v: number) => {
  const next = arr.length >= HIST ? arr.slice(1) : arr.slice();
  next.push(v);
  return next;
};

/* ---------------------- Scenario -> base state fields ------------------- */

function baseFieldsFor(sc: Scenario) {
  const v = visViva(sc.nominal.semiMajorAxisKm, sc.nominal.semiMajorAxisKm);
  const miss = sc.baseline.missDistanceMeters;
  return {
    missionClockSec: 0,
    wallEpochMs: Date.now(),

    activeScenarioId: sc.id,
    scenarioName: sc.name,
    orbitLabel: sc.orbitLabel,
    satelliteId: sc.satelliteId,
    debrisTrack: sc.debrisTrack,

    altitudeKm: sc.nominal.semiMajorAxisKm - EARTH_RADIUS_KM,
    velocityKmS: v,
    missDistanceMeters: miss,
    timeToClosestApproachSec: sc.baseline.timeToClosestApproachSec,
    collisionProbability: sc.baseline.collisionProbability,
    remainingDeltaVMPS: sc.baseline.remainingDeltaVMPS,
    totalDeltaVMPS: sc.baseline.remainingDeltaVMPS,
    baseMissMeters: miss,
    basePc: sc.baseline.collisionProbability,
    closingRateMS: 0,

    threatLevel: "CRITICAL" as ThreatLevel,
    phase: "ALERT" as MissionPhase,
    hazardActive: true,
    statusBanner: `COLLISION ALERT: ${sc.debrisTrack} at ${formatTca(
      sc.baseline.timeToClosestApproachSec
    )}, Miss: ${miss}m`,

    nominalElements: sc.nominal,
    debrisElements: sc.debris,
    avoidanceElements: null as KeplerElements | null,
    activeElements: sc.nominal,

    stagedBurn: null as StagedBurn | null,
    committedBurn: null as StagedBurn | null,
    tradeStudy: null as TradeStudyResult | null,

    histMiss: [miss] as number[],
    histPc: [sc.baseline.collisionProbability] as number[],
    histRate: [0] as number[],
  };
}

/* ------------------------------ Store shape ----------------------------- */

interface KesslerState {
  missionClockSec: number;
  wallEpochMs: number;

  activeScenarioId: string;
  scenarioName: string;
  orbitLabel: string;
  satelliteId: string;
  debrisTrack: string;

  altitudeKm: number;
  velocityKmS: number;
  missDistanceMeters: number;
  timeToClosestApproachSec: number;
  collisionProbability: number;
  remainingDeltaVMPS: number;
  totalDeltaVMPS: number;
  baseMissMeters: number;
  basePc: number;
  closingRateMS: number;

  threatLevel: ThreatLevel;
  phase: MissionPhase;
  hazardActive: boolean;
  statusBanner: string;

  nominalElements: KeplerElements;
  debrisElements: KeplerElements;
  avoidanceElements: KeplerElements | null;
  activeElements: KeplerElements;
  sceneVersion: number;

  stagedBurn: StagedBurn | null;
  committedBurn: StagedBurn | null;
  tradeStudy: TradeStudyResult | null;

  histMiss: number[];
  histPc: number[];
  histRate: number[];

  cameraView: CameraView;
  viewportMode: "3d" | "2d" | "bplane";
  soundEnabled: boolean;

  mcpBound: boolean;
  mcpTransport: string;
  toolCount: number;
  auditLog: AuditLogEntry[];

  /* actions */
  setMcpBinding: (bound: boolean, transport: string, toolCount: number) => void;
  log: (e: Omit<AuditLogEntry, "id" | "ts" | "clock" | "status"> & { status?: number }) => void;
  tick: (dtSec: number) => void;
  setCameraView: (v: CameraView) => void;
  setViewportMode: (m: "3d" | "2d" | "bplane") => void;
  toggleSound: () => void;
  setScenario: (id: string) => void;
  syncLiveNoradTle: (noradId?: number) => Promise<void>;

  inspectConjunctionGeometry: () => ConjunctionGeometry;
  evaluateAvoidanceOptions: () => TradeStudyResult;
  stageAvoidanceBurn: (args: {
    burnType: BurnType;
    deltaVMPS: number;
    burnTimeDeltaSec: number;
  }) => StageResult;
  commitOrbitalManeuver: (args: { authorizationNote: string }) => CommitResult;
  emergencyAutoDeconflict: (args?: { targetCorridorKm?: number }) => {
    success: boolean;
    stagedBurn: StagedBurn;
    authorizationPrompt: string;
  };

  deriveOptimalBurn: () => {
    burnType: BurnType;
    deltaVMPS: number;
    burnTimeDeltaSec: number;
  };
  runCommand: (raw: string) => { ok: boolean; message: string };
  resetSimulation: () => void;
}

/* ------------------------------ Store impl ----------------------------- */

const STATUS_BY_LEVEL: Record<LogLevel, number> = {
  info: 202,
  success: 200,
  warn: 409,
  hazard: 428,
};

const STORAGE_KEY = "kesslershield_session_v1";

function saveSession(state: Partial<KesslerState>) {
  try {
    if (typeof localStorage === "undefined") return;
    const payload = {
      activeScenarioId: state.activeScenarioId,
      soundEnabled: state.soundEnabled,
      viewportMode: state.viewportMode,
      satelliteId: state.satelliteId,
      altitudeKm: state.altitudeKm,
      activeElements: state.activeElements,
      nominalElements: state.nominalElements,
      statusBanner: state.statusBanner,
      auditLog: state.auditLog,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {}
}

function loadSession(): Partial<KesslerState> | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export const useKesslerStore = create<KesslerState>((set, get) => {
  const saved = loadSession();
  const scId = saved?.activeScenarioId ?? SCENARIOS[0].id;
  const targetSc = SCENARIOS.find((s) => s.id === scId) ?? SCENARIOS[0];
  const base = baseFieldsFor(targetSc);
  const initial = {
    ...base,
    satelliteId: saved?.satelliteId ?? base.satelliteId,
    altitudeKm: saved?.altitudeKm ?? base.altitudeKm,
    activeElements: saved?.activeElements ?? base.activeElements,
    nominalElements: saved?.nominalElements ?? base.nominalElements,
    statusBanner: saved?.statusBanner ?? base.statusBanner,
    auditLog: saved?.auditLog ?? [],
  };

  const pushLog: KesslerState["log"] = (e) => {
    const entry: AuditLogEntry = {
      id: uid(),
      ts: Date.now(),
      clock: nowClock(),
      status: e.status ?? STATUS_BY_LEVEL[e.level],
      ...e,
    };
    set((s) => {
      const nextLog = [...s.auditLog.slice(-179), entry];
      saveSession({ ...s, auditLog: nextLog });
      return { auditLog: nextLog };
    });
  };

  return {
    ...initial,
    sceneVersion: 1,
    cameraView: "free",
    viewportMode: saved?.viewportMode ?? "3d",
    soundEnabled: saved?.soundEnabled ?? true,

    setViewportMode: (m) => {
      set({ viewportMode: m });
      saveSession({ ...get(), viewportMode: m });
    },
    toggleSound: () => {
      const next = !get().soundEnabled;
      set({ soundEnabled: next });
      saveSession({ ...get(), soundEnabled: next });
      pushLog({
        channel: "system",
        direction: "info",
        title: `Audio Subsystem ${next ? "ONLINE" : "MUTED"} — 1970s MOCR Synthesizer`,
        level: next ? "success" : "info",
        status: 200,
      });
    },

    mcpBound: false,
    mcpTransport: "detecting…",
    toolCount: 5,
    auditLog: saved?.auditLog && saved.auditLog.length > 0 ? saved.auditLog : [
      {
        id: uid(),
        ts: Date.now() - 3000,
        clock: nowClock(),
        channel: "system",
        direction: "info",
        title: "Flight Deck ONLINE — Propagator resident in client RAM",
        level: "info",
        status: 200,
      },
      {
        id: uid(),
        ts: Date.now() - 2000,
        clock: nowClock(),
        channel: "system",
        direction: "info",
        title: "KALMAN FILTER INITIALIZED — Orbit covariance converged",
        level: "info",
        status: 200,
      },
      {
        id: uid(),
        ts: Date.now() - 1000,
        clock: nowClock(),
        channel: "system",
        direction: "info",
        title: "NORAD TLE CATALOG SYNC — 28,412 space objects loaded",
        level: "info",
        status: 200,
      },
      {
        id: uid(),
        ts: Date.now() - 500,
        clock: nowClock(),
        channel: "system",
        direction: "info",
        title: "Conjunction screening complete — 1 critical event identified",
        level: "info",
        status: 200,
      },
      {
        id: uid(),
        ts: Date.now(),
        clock: nowClock(),
        channel: "system",
        direction: "info",
        title: `CONJUNCTION ALERT: ${targetSc.debrisTrack} vs ${targetSc.satelliteId} at T-${formatTca(targetSc.baseline.timeToClosestApproachSec)}`,
        output: {
          missDistanceMeters: targetSc.baseline.missDistanceMeters,
          tca: formatTca(targetSc.baseline.timeToClosestApproachSec),
          pc: targetSc.baseline.collisionProbability,
        },
        level: "hazard",
        status: 409,
      },
    ],

    setMcpBinding: (bound, transport, toolCount) => {
      const st = get();
      const alreadyLogged = st.auditLog.some((l) => l.title.includes("WebMCP"));
      if (st.mcpTransport === transport && st.mcpBound === bound && st.toolCount === toolCount) return;
      set({ mcpBound: bound, mcpTransport: transport, toolCount });
      if (!alreadyLogged) {
        pushLog({
          channel: "system",
          direction: "info",
          title: bound
            ? `WebMCP Host Bound — ${toolCount} tools on document.modelContext`
            : `WebMCP Bridge Active — local transport operational (${toolCount} tools)`,
          level: "info",
          status: 200,
        });
      }
    },

    log: pushLog,

    setCameraView: (v) => set({ cameraView: v }),

    setScenario: (id) => {
      const sc = SCENARIOS.find((s) => s.id === id);
      if (!sc || sc.id === get().activeScenarioId) return;
      set((st) => ({ ...baseFieldsFor(sc), sceneVersion: st.sceneVersion + 1 }));
      saveSession({ ...get() });
      pushLog({
        channel: "system",
        direction: "info",
        title: `SCENARIO LOADED — ${sc.name}`,
        output: {
          asset: sc.satelliteId,
          threat: sc.debrisTrack,
          orbit: sc.orbitLabel,
          tca: formatTca(sc.baseline.timeToClosestApproachSec),
          missDistanceMeters: sc.baseline.missDistanceMeters,
          remainingDeltaVMPS: sc.baseline.remainingDeltaVMPS,
        },
        level: "hazard",
      });
    },

    tick: (dtSec) => {
      const s = get();
      const clk = s.missionClockSec + dtSec;

      if (s.phase === "CLEARED") {
        set({ missionClockSec: clk });
        return;
      }

      const tca = Math.max(-90, s.timeToClosestApproachSec - dtSec);

      const breathe =
        Math.sin(clk * 0.35) * 6 + Math.sin(clk * 0.11 + 1.3) * 3.5;
      const white = (Math.random() - 0.5) * 2.2;
      let miss = s.baseMissMeters + breathe + white;
      if (tca < 0) miss += Math.max(0, -tca) * 0.4;
      miss = Math.max(s.baseMissMeters * 0.5, miss);

      const closingRate = dtSec > 0 ? (s.missDistanceMeters - miss) / dtSec : 0;

      const closeFactor = Math.min(1, Math.max(0, 1 - Math.abs(tca) / 1800));
      const pc = s.basePc * (0.6 + 1.9 * closeFactor);

      const threat: ThreatLevel =
        miss < 120
          ? "CRITICAL"
          : miss < 400
          ? "HIGH"
          : miss < 1200
          ? "ELEVATED"
          : "NOMINAL";

      const banner =
        s.phase === "STAGED"
          ? `BYPASS STAGED: ${s.stagedBurn?.burnType} Δv ${s.stagedBurn?.deltaVMPS.toFixed(
              2
            )} m/s — projected miss ${s.stagedBurn?.projectedMissDistanceKm.toFixed(
              1
            )} km — AWAITING AUTHORIZATION`
          : `COLLISION ALERT: ${s.debrisTrack} at ${formatTca(tca)}, Miss: ${Math.round(
              miss
            )}m`;

      set({
        missionClockSec: clk,
        timeToClosestApproachSec: tca,
        missDistanceMeters: miss,
        collisionProbability: pc,
        closingRateMS: closingRate,
        threatLevel: threat,
        statusBanner: banner,
        histMiss: pushHist(s.histMiss, miss),
        histPc: pushHist(s.histPc, pc),
        histRate: pushHist(s.histRate, closingRate),
      });
    },

    inspectConjunctionGeometry: () => {
      const s = get();
      const snap: ConjunctionGeometry = {
        satelliteId: s.satelliteId,
        debrisTrack: s.debrisTrack,
        altitudeKm: +s.altitudeKm.toFixed(2),
        velocityKmS: +s.velocityKmS.toFixed(4),
        timeToClosestApproachSec: Math.round(s.timeToClosestApproachSec),
        missDistanceMeters: +s.missDistanceMeters.toFixed(1),
        collisionProbability: +s.collisionProbability.toPrecision(3),
        remainingDeltaVMPS: +s.remainingDeltaVMPS.toFixed(2),
        threatLevel: s.threatLevel,
      };
      pushLog({
        channel: "tool",
        direction: "invoke",
        tool: "inspect_conjunction_geometry",
        title: "inspect_conjunction_geometry()",
        input: {},
        level: "info",
      });
      pushLog({
        channel: "tool",
        direction: "result",
        tool: "inspect_conjunction_geometry",
        title: "geometry snapshot returned",
        output: snap,
        level: s.threatLevel === "CLEARED" ? "success" : "hazard",
        status: 200,
      });
      return snap;
    },

    evaluateAvoidanceOptions: () => {
      const s = get();
      pushLog({
        channel: "tool",
        direction: "invoke",
        tool: "evaluate_avoidance_options",
        title: "evaluate_avoidance_options()",
        input: {},
        level: "info",
      });

      const lead = leadTimeFor(s.timeToClosestApproachSec);
      const corridorKm = SAFETY_CORRIDOR_KM;
      const targetMeters = (SAFETY_CORRIDOR_KM + 3.0) * 1000;
      const liveMiss = s.missDistanceMeters;
      const types: BurnType[] = ["RETROGRADE", "PROGRADE", "OUT_OF_PLANE"];

      const options: AvoidanceOption[] = types.map((bt) => {
        const k = bt === "OUT_OF_PLANE" ? 1.6 : bt === "PROGRADE" ? 2.35 : 3.0;
        let dv = targetMeters / (k * lead);
        dv = Math.max(0.05, Math.min(dv, 8.0));
        const disp = burnDisplacementMeters(bt, dv, lead);
        const projKm = Math.sqrt(liveMiss * liveMiss + disp * disp) / 1000;
        const propellant = +(dv + ACS_OVERHEAD_MPS).toFixed(3);
        return {
          burnType: bt,
          deltaVMPS: +dv.toFixed(3),
          burnTimeDeltaSec: Math.round(lead),
          projectedMissDistanceKm: +projKm.toFixed(3),
          propellantExpenditureMPS: propellant,
          corridorClear: projKm >= corridorKm,
          feasible: propellant <= s.remainingDeltaVMPS,
          marginKm: +(projKm - corridorKm).toFixed(3),
        };
      });

      const viable = options
        .filter((o) => o.feasible && o.corridorClear)
        .sort((a, b) => a.propellantExpenditureMPS - b.propellantExpenditureMPS);
      const fallback = options
        .filter((o) => o.feasible)
        .sort((a, b) => b.projectedMissDistanceKm - a.projectedMissDistanceKm);
      const best = viable[0] ?? fallback[0] ?? null;

      let rationale: string;
      if (best && viable.length) {
        const worst = [...options].sort(
          (a, b) => b.propellantExpenditureMPS - a.propellantExpenditureMPS
        )[0];
        const pct = Math.max(
          0,
          Math.round(
            (1 - best.propellantExpenditureMPS / worst.propellantExpenditureMPS) * 100
          )
        );
        rationale = `${best.burnType} clears the ${corridorKm.toFixed(
          1
        )} km corridor for ${best.propellantExpenditureMPS.toFixed(
          2
        )} m/s — ${pct}% less propellant than ${worst.burnType} (${worst.propellantExpenditureMPS.toFixed(
          2
        )} m/s).`;
      } else if (best) {
        rationale = `No option fully clears the ${corridorKm.toFixed(
          1
        )} km corridor within budget; ${best.burnType} maximises miss distance at ${best.projectedMissDistanceKm.toFixed(
          2
        )} km.`;
      } else {
        rationale = `No feasible avoidance option within the remaining ${s.remainingDeltaVMPS.toFixed(
          1
        )} m/s Δv budget.`;
      }

      const result: TradeStudyResult = {
        leadTimeSec: Math.round(lead),
        corridorKm,
        options,
        recommended: best
          ? {
              burnType: best.burnType,
              deltaVMPS: best.deltaVMPS,
              burnTimeDeltaSec: best.burnTimeDeltaSec,
            }
          : null,
        rationale,
        evaluatedAtClock: nowClock(),
      };

      set({ tradeStudy: result });
      pushLog({
        channel: "tool",
        direction: "result",
        tool: "evaluate_avoidance_options",
        title: "trade-study complete — 3 burn types compared",
        output: result,
        level: best ? "success" : "warn",
        status: 200,
      });
      return result;
    },

    stageAvoidanceBurn: ({ burnType, deltaVMPS, burnTimeDeltaSec }) => {
      const s = get();

      pushLog({
        channel: "tool",
        direction: "invoke",
        tool: "stage_avoidance_burn",
        title: "stage_avoidance_burn(...)",
        input: { burnType, deltaVMPS, burnTimeDeltaSec },
        level: "info",
      });

      const dv = Math.max(
        0.01,
        Math.min(deltaVMPS, s.remainingDeltaVMPS - ACS_OVERHEAD_MPS)
      );
      const lead = Math.max(
        60,
        Math.min(burnTimeDeltaSec, Math.max(60, s.timeToClosestApproachSec - 60))
      );

      const a = s.nominalElements.semiMajorAxisKm;
      const drift = burnDisplacementMeters(burnType, dv, lead);
      const projectedMissDistanceKm =
        Math.sqrt(s.missDistanceMeters ** 2 + drift ** 2) / 1000;
      const corridorClear = projectedMissDistanceKm >= SAFETY_CORRIDOR_KM;
      const propellantExpenditureMPS = +(dv + ACS_OVERHEAD_MPS).toFixed(3);

      const vKmS = s.velocityKmS;
      const dvKmS = dv / 1000;
      const next: KeplerElements = { ...s.nominalElements };

      if (burnType === "RETROGRADE" || burnType === "PROGRADE") {
        const sign = burnType === "PROGRADE" ? 1 : -1;
        const da = (2 * a * a * vKmS * dvKmS) / MU_EARTH;
        next.semiMajorAxisKm = a + sign * da;
        next.eccentricity = Math.max(
          0.0002,
          s.nominalElements.eccentricity + sign * dvKmS * 2.4
        );
        next.argPerigeeDeg = s.nominalElements.argPerigeeDeg + sign * 7.5;
        next.trueAnomalyDeg = s.nominalElements.trueAnomalyDeg - sign * 5.5;
      } else {
        const dInc = (Math.atan2(dvKmS, vKmS) * 180) / Math.PI;
        next.inclinationDeg = s.nominalElements.inclinationDeg + dInc * 6.0;
        next.raanDeg = s.nominalElements.raanDeg + dInc * 3.2;
      }

      const status = corridorClear
        ? `CORRIDOR CLEAR — ${projectedMissDistanceKm.toFixed(2)} km radial bypass`
        : `MARGINAL — ${projectedMissDistanceKm.toFixed(
            2
          )} km < ${SAFETY_CORRIDOR_KM.toFixed(1)} km corridor; increase Δv`;

      const staged: StagedBurn = {
        burnType,
        deltaVMPS: +dv.toFixed(3),
        burnTimeDeltaSec: Math.round(lead),
        projectedMissDistanceKm: +projectedMissDistanceKm.toFixed(3),
        propellantExpenditureMPS,
        corridorClear,
        status,
        stagedAtClock: nowClock(),
      };

      set((st) => ({
        stagedBurn: staged,
        avoidanceElements: next,
        phase: "STAGED",
        sceneVersion: st.sceneVersion + 1,
        statusBanner: `BYPASS STAGED: ${burnType} Δv ${dv.toFixed(
          2
        )} m/s — projected miss ${projectedMissDistanceKm.toFixed(
          1
        )} km — AWAITING AUTHORIZATION`,
      }));

      const result: StageResult = {
        success: true,
        projectedMissDistanceKm: +projectedMissDistanceKm.toFixed(3),
        propellantExpenditureMPS,
        corridorClear,
        status,
      };

      pushLog({
        channel: "tool",
        direction: "result",
        tool: "stage_avoidance_burn",
        title: "bypass trajectory rendered to WebGL canvas",
        output: result,
        level: corridorClear ? "success" : "warn",
        status: corridorClear ? 200 : 202,
      });

      return result;
    },

    commitOrbitalManeuver: ({ authorizationNote }) => {
      const s = get();

      pushLog({
        channel: "tool",
        direction: "invoke",
        tool: "commit_orbital_maneuver",
        title: "commit_orbital_maneuver(...)",
        input: { authorizationNote },
        level: "info",
      });

      if (!s.stagedBurn || !s.avoidanceElements) {
        const result: CommitResult = {
          success: false,
          missionStatus: "REJECTED — no avoidance burn staged",
          clearedMissDistanceMeters: Math.round(s.missDistanceMeters),
        };
        pushLog({
          channel: "tool",
          direction: "result",
          tool: "commit_orbital_maneuver",
          title: "maneuver rejected",
          output: result,
          level: "warn",
          status: 409,
        });
        return result;
      }

      const staged = s.stagedBurn;

      if (!staged.corridorClear) {
        const result: CommitResult = {
          success: false,
          missionStatus: `REJECTED — staged ${staged.burnType} Δv ${staged.deltaVMPS.toFixed(
            2
          )} m/s clears only ${staged.projectedMissDistanceKm.toFixed(
            2
          )} km, inside the ${SAFETY_CORRIDOR_KM.toFixed(
            1
          )} km corridor. Increase Δv or advance the ignition.`,
          clearedMissDistanceMeters: Math.round(s.missDistanceMeters),
        };
        pushLog({
          channel: "tool",
          direction: "result",
          tool: "commit_orbital_maneuver",
          title: "maneuver rejected — corridor not cleared",
          output: result,
          level: "warn",
          status: 422,
        });
        return result;
      }

      const clearedMeters = Math.round(staged.projectedMissDistanceKm * 1000);
      const remaining = +(
        s.remainingDeltaVMPS - staged.propellantExpenditureMPS
      ).toFixed(2);

      set((st) => ({
        phase: "CLEARED",
        threatLevel: "CLEARED",
        hazardActive: false,
        missDistanceMeters: clearedMeters,
        collisionProbability: 4.0e-8,
        remainingDeltaVMPS: Math.max(0, remaining),
        activeElements: st.avoidanceElements as KeplerElements,
        committedBurn: staged,
        stagedBurn: null,
        tradeStudy: null,
        sceneVersion: st.sceneVersion + 1,
        statusBanner: `CONJUNCTION CLEARED: Radial bypass confirmed — miss ${(
          clearedMeters / 1000
        ).toFixed(2)} km`,
      }));

      const result: CommitResult = {
        success: true,
        missionStatus: `THRUSTER FIRE COMPLETE — ${staged.burnType} ${staged.deltaVMPS.toFixed(
          2
        )} m/s — new orbit propagating`,
        clearedMissDistanceMeters: clearedMeters,
      };

      pushLog({
        channel: "tool",
        direction: "result",
        tool: "commit_orbital_maneuver",
        title: "collision alarm neutralised — orbit line updated",
        output: result,
        level: "success",
        status: 200,
      });

      return result;
    },

    emergencyAutoDeconflict: (_args) => {
      const s = get();
      const trade = s.evaluateAvoidanceOptions();
      const rec = trade.recommended ?? s.deriveOptimalBurn();
      
      // Stage the recommended burn
      s.stageAvoidanceBurn({
        burnType: rec.burnType,
        deltaVMPS: rec.deltaVMPS,
        burnTimeDeltaSec: rec.burnTimeDeltaSec,
      });

      const staged = get().stagedBurn!;
      const prompt = `EMERGENCY DECONFLICT STAGED: ${staged.burnType} Δv ${staged.deltaVMPS.toFixed(
        2
      )} m/s — projected miss ${staged.projectedMissDistanceKm.toFixed(
        2
      )} km. Call commit_orbital_maneuver with authorizationNote to fire thrusters.`;

      pushLog({
        channel: "agent",
        direction: "result",
        tool: "emergency_auto_deconflict",
        title: "EMERGENCY CASCADE SOLVER COMPLETE — Bypass staged in 3D canvas",
        output: {
          stagedBurn: staged,
          corridorClear: staged.corridorClear,
          authorizationPrompt: prompt,
        },
        level: "success",
        status: 200,
      });

      return {
        success: true,
        stagedBurn: staged,
        authorizationPrompt: prompt,
      };
    },

    syncLiveNoradTle: async (noradId = 25544) => {
      const tle = await fetchLiveNoradTle(noradId);
      if (tle) {
        set((st) => ({
          satelliteId: `${tle.name} (#${tle.noradId})`,
          altitudeKm: Math.round(tle.altitudeKm),
          activeElements: {
            ...st.activeElements,
            semiMajorAxisKm: 6378.137 + tle.altitudeKm,
            inclinationDeg: tle.inclinationDeg,
          },
          nominalElements: {
            ...st.nominalElements,
            semiMajorAxisKm: 6378.137 + tle.altitudeKm,
            inclinationDeg: tle.inclinationDeg,
          },
          statusBanner: `NORAD TLE SYNC COMPLETE: #${tle.noradId} ${tle.name} — Live track active in RAM`,
          sceneVersion: st.sceneVersion + 1,
        }));
        saveSession(get());
        pushLog({
          channel: "system",
          direction: "info",
          title: `NORAD TLE SYNC: #${tle.noradId} ${tle.name} — Live TLE elements active`,
          output: { line1: tle.line1, line2: tle.line2, altitudeKm: tle.altitudeKm, inclinationDeg: tle.inclinationDeg },
          level: "success",
          status: 200,
        });
      }
    },

    deriveOptimalBurn: () => {
      const s = get();
      const lead = leadTimeFor(s.timeToClosestApproachSec);
      const targetMeters = (SAFETY_CORRIDOR_KM + 3.0) * 1000;
      let dv = targetMeters / (3 * lead);
      dv = Math.max(0.12, Math.min(dv, 3.25));
      return {
        burnType: "RETROGRADE",
        deltaVMPS: +dv.toFixed(3),
        burnTimeDeltaSec: Math.round(lead),
      };
    },

    runCommand: (raw) => {
      const text = raw.trim();
      if (!text) return { ok: false, message: "empty command" };
      const t = text.toLowerCase();

      get().log({
        channel: "human",
        direction: "info",
        title: `operator › ${text}`,
        level: "info",
      });

      if (/\b(reset|abort|scrub|restore|rewind)\b/.test(t)) {
        get().resetSimulation();
        return { ok: true, message: "Simulation reset to conjunction epoch." };
      }

      if (/\b(tle|norad|sync|celestrak)\b/.test(t)) {
        get().syncLiveNoradTle(25544);
        return { ok: true, message: "NORAD TLE elements synced from Celestrak." };
      }

      const scMatch =
        /\b(scenario|load|switch)\b/.test(t) ||
        /\b(iss|station|polar|sentinel|sso|geoscan|fengyun|cosmos)\b/.test(t);
      if (
        scMatch &&
        !/\b(inspect|stage|evaluate|compare|authoriz|authoris|fire|commit)\b/.test(t)
      ) {
        let target: string | null = null;
        if (/\biss\b|station/.test(t)) target = "iss-node";
        else if (/\bpolar\b|geoscan|fengyun/.test(t)) target = "polar-sso";
        else if (/\bsentinel\b|\bsso\b|cosmos/.test(t)) target = "sentinel-sso";
        else {
          const m = t.match(/scenario\s*([123])/);
          if (m) target = SCENARIOS[parseInt(m[1], 10) - 1]?.id ?? null;
        }
        if (target) {
          get().setScenario(target);
          const sc = SCENARIOS.find((x) => x.id === target)!;
          return {
            ok: true,
            message: `Scenario loaded — ${sc.name} (${sc.orbitLabel}).`,
          };
        }
      }

      if (/\b(emergency|deconflict|solver|auto[- ]?deconflict|evade|crisis|solve)\b/.test(t)) {
        const r = get().emergencyAutoDeconflict();
        return {
          ok: r.success,
          message: r.authorizationPrompt,
        };
      }

      if (
        /\b(evaluate|compare|trade[- ]?study|options|which burn|assess burns|study)\b/.test(
          t
        )
      ) {
        const r = get().evaluateAvoidanceOptions();
        return {
          ok: true,
          message: r.recommended
            ? `Recommend ${r.recommended.burnType} Δv ${r.recommended.deltaVMPS.toFixed(
                2
              )} m/s · ${r.rationale}`
            : r.rationale,
        };
      }

      if (
        /\b(inspect|status|risk|geometry|conjunction|assess|report|show|analy[sz]e|check)\b/.test(
          t
        )
      ) {
        const g = get().inspectConjunctionGeometry();
        return {
          ok: true,
          message: `Threat ${g.threatLevel} · miss ${g.missDistanceMeters} m · ${formatTca(
            g.timeToClosestApproachSec
          )} · Pc ${g.collisionProbability}`,
        };
      }

      if (
        /\b(authorize|authorise|fire|commit|execute|confirm|go for burn|light( it)? up|thruster|maneuver now|burn now)\b/.test(
          t
        )
      ) {
        if (!get().stagedBurn) {
          get().stageAvoidanceBurn(get().deriveOptimalBurn());
        }
        const note =
          text
            .replace(/.*?(authoriz|authoris|fire|commit|execute|confirm)\w*/i, "")
            .trim() || "Operator authorization via command bar";
        const r = get().commitOrbitalManeuver({ authorizationNote: note });
        return { ok: r.success, message: r.missionStatus };
      }

      if (
        /\b(stage|plan|compute|calculate|prep(are)?|optim\w*|avoid\w*|bypass|burn|maneuver|manoeuvre|deflect|dodge|solve)\b/.test(
          t
        )
      ) {
        let burnType: BurnType = "RETROGRADE";
        if (/\bprograde\b/.test(t)) burnType = "PROGRADE";
        else if (/\bout[- ]?of[- ]?plane\b|\bnormal\b|\bcross[- ]?track\b/.test(t))
          burnType = "OUT_OF_PLANE";
        else if (/\bretrograde\b/.test(t)) burnType = "RETROGRADE";

        const dvMatch = t.match(
          /(?:dv|delta[- ]?v|Δv|\bv\b)\s*[:=]?\s*(\d+(?:\.\d+)?)/
        );
        const leadMatch = t.match(
          /(?:in|at|lead|t-?)\s*(\d+(?:\.\d+)?)\s*(s|sec|second|m|min|minute)?/
        );

        const opt = get().deriveOptimalBurn();
        const deltaVMPS = dvMatch ? parseFloat(dvMatch[1]) : opt.deltaVMPS;
        let burnTimeDeltaSec = opt.burnTimeDeltaSec;
        if (leadMatch) {
          const val = parseFloat(leadMatch[1]);
          const unit = leadMatch[2] ?? "s";
          burnTimeDeltaSec = /m/.test(unit) ? val * 60 : val;
        }

        const r = get().stageAvoidanceBurn({
          burnType,
          deltaVMPS,
          burnTimeDeltaSec,
        });
        return {
          ok: r.success,
          message: `${burnType} Δv ${deltaVMPS.toFixed(
            2
          )} m/s staged · projected miss ${r.projectedMissDistanceKm.toFixed(
            2
          )} km · ${r.corridorClear ? "corridor clear" : "MARGINAL"}`,
        };
      }

      get().log({
        channel: "system",
        direction: "info",
        title: `unrecognised intent: "${text}"`,
        level: "warn",
      });
      return {
        ok: false,
        message:
          'Unrecognised. Try "inspect", "evaluate options", "stage burn", "authorize and fire", or "load ISS".',
      };
    },

    resetSimulation: () => {
      clearSession();
      const sc =
        SCENARIOS.find((s) => s.id === get().activeScenarioId) ?? SCENARIOS[0];
      const freshLog: AuditLogEntry[] = [
        {
          id: uid(),
          ts: Date.now() - 3000,
          clock: nowClock(),
          channel: "system",
          direction: "info",
          title: `SIMULATION RESET — ${sc.name} conjunction epoch restored`,
          level: "info",
          status: 200,
        },
        {
          id: uid(),
          ts: Date.now() - 2000,
          clock: nowClock(),
          channel: "system",
          direction: "info",
          title: "Flight Deck ONLINE — Propagator resident in client RAM",
          level: "info",
          status: 200,
        },
        {
          id: uid(),
          ts: Date.now() - 1000,
          clock: nowClock(),
          channel: "system",
          direction: "info",
          title: "NORAD TLE CATALOG SYNC — 28,412 space objects loaded",
          level: "info",
          status: 200,
        },
        {
          id: uid(),
          ts: Date.now() - 500,
          clock: nowClock(),
          channel: "system",
          direction: "info",
          title: "Conjunction screening complete — 1 critical event identified",
          level: "info",
          status: 200,
        },
        {
          id: uid(),
          ts: Date.now(),
          clock: nowClock(),
          channel: "system",
          direction: "info",
          title: `CONJUNCTION ALERT: ${sc.debrisTrack} vs ${sc.satelliteId} at T-${formatTca(sc.baseline.timeToClosestApproachSec)}`,
          output: {
            missDistanceMeters: sc.baseline.missDistanceMeters,
            tca: formatTca(sc.baseline.timeToClosestApproachSec),
            pc: sc.baseline.collisionProbability,
          },
          level: "hazard",
          status: 409,
        },
      ];
      const freshBase = baseFieldsFor(sc);
      set((st) => ({
        ...freshBase,
        sceneVersion: st.sceneVersion + 1,
        auditLog: freshLog,
      }));
      saveSession({
        activeScenarioId: sc.id,
        soundEnabled: get().soundEnabled,
        viewportMode: get().viewportMode,
        satelliteId: sc.satelliteId,
        altitudeKm: freshBase.altitudeKm,
        activeElements: freshBase.activeElements,
        nominalElements: freshBase.nominalElements,
        statusBanner: freshBase.statusBanner,
        auditLog: freshLog,
      });
    },
  };
});
