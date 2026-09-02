import { useState, type ReactNode } from "react";
import {
  Activity,
  Crosshair,
  Radar,
  RotateCcw,
  Zap,
} from "lucide-react";
import { playClickSound, playThrusterSound } from "../audio";
import {
  SCENARIOS,
  formatTca,
  oddsString,
  useKesslerStore,
} from "../store";
import { callKesslerTool } from "../webmcp";
import { RadialGauge, Sparkline } from "./primitives";

function Section({ title, extra }: { title: string; extra?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-1.5 font-space text-[11px] font-bold uppercase tracking-widest text-[#FFB000]">
      {title}
      {extra && <span className="ml-auto font-mono text-[10px] text-[#8C887B]">{extra}</span>}
    </div>
  );
}

/* ------------------------------ hazard banner ---------------------- */

function HazardBanner() {
  const phase = useKesslerStore((s) => s.phase);
  const banner = useKesslerStore((s) => s.statusBanner);
  const threat = useKesslerStore((s) => s.threatLevel);

  const cleared = phase === "CLEARED";
  const staged = phase === "STAGED";

  const shell = cleared
    ? "border-[#33FF66]/40 bg-[#33FF66]/5 text-[#D8D4C8]"
    : staged
    ? "border-[#FFB000]/50 bg-[#FFB000]/5 text-[#D8D4C8]"
    : "border-[#C4453D]/50 bg-[#C4453D]/10 text-[#D8D4C8]";

  return (
    <div className={`relative flex items-center gap-3 border p-3 ${shell}`}>
      <div className="min-w-0 flex-1">
        <div className="font-space text-[10px] font-bold uppercase tracking-wider text-[#8C887B]">
          {cleared ? "Status: Nominal" : staged ? "Status: Staged" : `Alert Level ${threat}`}
        </div>
        <div className="mt-0.5 font-mono text-xs sm:text-sm font-bold text-[#FFB000] leading-snug break-words">
          {banner}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ scenario picker ------------------- */

function ScenarioPicker() {
  const activeId = useKesslerStore((s) => s.activeScenarioId);
  const setScenario = useKesslerStore((s) => s.setScenario);
  const soundEnabled = useKesslerStore((s) => s.soundEnabled);
  return (
    <div>
      <Section title="Target Scenario" />
      <div className="grid grid-cols-3 gap-1.5">
        {SCENARIOS.map((sc) => (
          <button
            key={sc.id}
            onClick={() => {
              if (soundEnabled) playClickSound();
              setScenario(sc.id);
            }}
            title={sc.subtitle}
            className={`border px-2 py-2 font-space text-[11px] font-bold uppercase transition ${
              activeId === sc.id
                ? "border-[#FFB000] bg-[#2A2822] text-[#FFB000]"
                : "border-[#2A2822] bg-[#0A0A08] text-[#8C887B] hover:border-[#FFB000]/50 hover:text-[#D8D4C8]"
            }`}
          >
            {sc.short}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ telemetry deck ------------------- */

function Tile({
  label,
  value,
  unit,
  spark,
}: {
  label: string;
  value: string | number;
  unit: string;
  spark?: number[];
}) {
  return (
    <div className="relative overflow-hidden p-2.5 border border-[#2A2822] bg-[#0A0A08]">
      <div className="flex items-center justify-between">
        <span className="font-space text-[10px] font-bold uppercase tracking-wider text-[#8C887B]">
          {label}
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="font-mono text-xl font-bold text-[#FFB000]">
          {value}
        </span>
        <span className="font-mono text-[10px] text-[#8C887B]">{unit}</span>
      </div>
      {spark && spark.length > 1 && (
        <div className="mt-1 -mb-1">
          <Sparkline data={spark} color="#FFB000" height={18} fill={false} />
        </div>
      )}
    </div>
  );
}

function TelemetryDeck() {
  const alt = useKesslerStore((s) => s.altitudeKm);
  const vel = useKesslerStore((s) => s.velocityKmS);
  const miss = useKesslerStore((s) => s.missDistanceMeters);
  const rate = useKesslerStore((s) => s.closingRateMS);
  const tca = useKesslerStore((s) => s.timeToClosestApproachSec);
  const pc = useKesslerStore((s) => s.collisionProbability);
  const remDv = useKesslerStore((s) => s.remainingDeltaVMPS);
  const totDv = useKesslerStore((s) => s.totalDeltaVMPS);

  const histMiss = useKesslerStore((s) => s.histMiss);
  const histRate = useKesslerStore((s) => s.histRate);

  const dvFrac = totDv > 0 ? remDv / totDv : 0;
  const pcNormalized = Math.min(1, pc / 0.005);

  return (
    <div className="space-y-3">
      <Section
        title="Orbital Telemetry"
        extra={
          <span className="font-mono text-[11px] font-bold text-[#FFB000]">
            {formatTca(tca)}
          </span>
        }
      />

      <div className="border border-[#2A2822] bg-[#0A0A08] p-3 text-center">
        <div className="flex items-center justify-between font-space text-[10px] font-bold uppercase tracking-wider text-[#8C887B]">
          <span>Countdown to TCA</span>
          <span className="font-mono text-[9.5px] text-[#C4453D] font-bold">CRITICAL</span>
        </div>
        <div className="mt-1.5 font-mono text-4xl font-bold tracking-tight text-[#FFB000]">
          {formatTca(tca)}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Tile
          label="Altitude"
          value={alt.toFixed(1)}
          unit="km"
        />
        <Tile
          label="Velocity"
          value={vel.toFixed(3)}
          unit="km/s"
        />
        <Tile
          label="Miss Distance"
          value={Math.round(miss)}
          unit="m"
          spark={histMiss}
        />
        <Tile
          label="Closing Rate"
          value={`${rate >= 0 ? "+" : ""}${rate.toFixed(1)}`}
          unit="m/s"
          spark={histRate}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 border border-[#2A2822] bg-[#0A0A08] p-2">
        <RadialGauge
          value={dvFrac}
          label="Δv Budget"
          valueText={`${remDv.toFixed(1)}`}
          sub="m/s rem"
          color="#FFB000"
        />
        <RadialGauge
          value={pcNormalized}
          label="Collision Pc"
          valueText={(pc * 100).toFixed(2) + "%"}
          sub={oddsString(pc)}
          color={pc > 0.001 ? "#C4453D" : "#FFB000"}
        />
        <RadialGauge
          value={Math.max(0, 1 - tca / 3600)}
          label="TCA Window"
          valueText={`${Math.floor(tca / 60)}m`}
          sub={`${Math.round(tca % 60)}s`}
          color="#FFB000"
        />
      </div>
    </div>
  );
}

/* ------------------------------ staged burn card ------------------ */

function StagedBurnCard() {
  const staged = useKesslerStore((s) => s.stagedBurn);
  const phase = useKesslerStore((s) => s.phase);
  const commit = useKesslerStore((s) => s.commitOrbitalManeuver);
  const [rejection, setRejection] = useState<string | null>(null);

  const soundEnabled = useKesslerStore((s) => s.soundEnabled);
  if (!staged || phase === "CLEARED") return null;

  return (
    <div className="border border-[#FFB000]/60 bg-[#141310] p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-space text-[10px] font-bold uppercase tracking-wider text-[#FFB000]">
          <Crosshair className="h-3.5 w-3.5" />
          Staged Avoidance Vector
        </span>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2 font-mono text-[10.5px]">
        {[
          ["Burn Type", staged.burnType, "text-[#FFB000]"],
          ["Δv Cost", `${staged.propellantExpenditureMPS.toFixed(2)} m/s`, "text-[#FFB000]"],
          ["Projected Miss", `${staged.projectedMissDistanceKm.toFixed(2)} km`, "text-[#FFB000]"],
          [
            "Corridor",
            staged.corridorClear ? "CLEAR" : "MARGINAL",
            staged.corridorClear ? "text-[#33FF66]" : "text-[#C4453D]",
          ],
        ].map(([k, v, cls]) => (
          <div key={k} className="border border-[#2A2822] bg-[#0A0A08] p-1.5">
            <div className="font-space text-[8.5px] font-bold uppercase text-[#8C887B]">{k}</div>
            <div className={`mt-0.5 font-bold ${cls}`}>{v}</div>
          </div>
        ))}
      </div>

      {rejection && (
        <div className="mt-2 border border-[#C4453D] bg-[#C4453D]/10 px-2 py-1 font-mono text-[9.5px] text-[#D8D4C8]">
          {rejection}
        </div>
      )}

      <button
        onClick={() => {
          if (soundEnabled) playThrusterSound();
          const res = commit({
            authorizationNote: "Operator approval via Staged Burn Card",
          });
          setRejection(res.success ? null : res.missionStatus);
        }}
        className={`mt-2.5 flex w-full items-center justify-center gap-2 border py-2 font-space text-xs font-bold uppercase ${
          staged.corridorClear
            ? "border-[#33FF66] bg-[#33FF66]/15 text-[#33FF66] hover:bg-[#33FF66]/25"
            : "border-[#FFB000] bg-[#FFB000]/15 text-[#FFB000] hover:bg-[#FFB000]/25"
        }`}
      >
        <Zap className="h-3.5 w-3.5" />
        Authorize Thruster Fire
      </button>
    </div>
  );
}

/* ------------------------------ trade study card ---------------- */

function TradeStudyCard() {
  const study = useKesslerStore((s) => s.tradeStudy);
  const phase = useKesslerStore((s) => s.phase);
  const stage = useKesslerStore((s) => s.stageAvoidanceBurn);
  if (!study || phase === "CLEARED") return null;

  return (
    <div className="border border-[#2A2822] bg-[#141310] p-3">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 font-space text-[10px] font-bold uppercase tracking-wider text-[#FFB000]">
          <Activity className="h-3.5 w-3.5" />
          Trade Options
        </span>
      </div>

      <div className="mt-2 overflow-hidden border border-[#2A2822]">
        <div className="grid grid-cols-[1.4fr_0.9fr_0.9fr_0.7fr] bg-[#0A0A08] px-2 py-1 font-space text-[8.5px] font-bold uppercase text-[#8C887B]">
          <span>Burn</span>
          <span className="text-right">Δv</span>
          <span className="text-right">Miss</span>
          <span className="text-right">Status</span>
        </div>
        {study.options.map((o) => {
          const rec = study.recommended?.burnType === o.burnType;
          return (
            <div
              key={o.burnType}
              className={`grid grid-cols-[1.4fr_0.9fr_0.9fr_0.7fr] items-center px-2 py-1 font-mono text-[9.5px] ${
                rec ? "bg-[#2A2822] text-[#FFB000] font-bold" : "text-[#D8D4C8]"
              }`}
            >
              <span className="truncate font-space">{o.burnType}</span>
              <span className="text-right">{o.deltaVMPS.toFixed(2)}</span>
              <span className="text-right">{o.projectedMissDistanceKm.toFixed(1)}km</span>
              <span className={`text-right ${o.corridorClear ? "text-[#33FF66]" : "text-[#C4453D]"}`}>
                {o.corridorClear ? "CLEAR" : "FAIL"}
              </span>
            </div>
          );
        })}
      </div>

      {study.recommended && (
        <button
          onClick={() => stage(study.recommended!)}
          className="mt-2 flex w-full items-center justify-center gap-2 border border-[#FFB000] bg-[#0A0A08] py-1.5 font-space text-[10px] font-bold uppercase text-[#FFB000] hover:bg-[#2A2822]"
        >
          <Crosshair className="h-3 w-3" />
          Stage {study.recommended.burnType}
        </button>
      )}
    </div>
  );
}

/* ------------------------------ committed card ------------------ */

function CommittedCard() {
  const phase = useKesslerStore((s) => s.phase);
  const committed = useKesslerStore((s) => s.committedBurn);
  const miss = useKesslerStore((s) => s.missDistanceMeters);
  if (phase !== "CLEARED" || !committed) return null;
  return (
    <div className="border border-[#33FF66] bg-[#141310] p-3">
      <div className="flex items-center font-space text-[10px] font-bold uppercase text-[#33FF66]">
        Maneuver Committed
      </div>
      <div className="mt-1.5 font-mono text-[10.5px] text-[#D8D4C8]">
        {committed.burnType} · {committed.propellantExpenditureMPS.toFixed(2)} m/s expended
        <br />
        Confirmed miss distance:{" "}
        <span className="font-bold text-[#33FF66]">{(miss / 1000).toFixed(2)} km</span>
      </div>
    </div>
  );
}

/* ------------------------------ agent prompts ------------------ */

function AgentPrompts() {
  const deriveOptimalBurn = useKesslerStore((s) => s.deriveOptimalBurn);
  const stagedBurn = useKesslerStore((s) => s.stagedBurn);
  const phase = useKesslerStore((s) => s.phase);
  const runCommand = useKesslerStore((s) => s.runCommand);
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (id: string, fn: () => void | Promise<unknown>) => {
    setBusy(id);
    try {
      await fn();
    } finally {
      setTimeout(() => setBusy(null), 300);
    }
  };

  const triggers = [
    {
      id: "inspect",
      label: "Inspect Risk",
      icon: <Radar className="h-3.5 w-3.5" />,
      fn: () => callKesslerTool("inspect_conjunction_geometry"),
    },
    {
      id: "trade",
      label: "Evaluate Options",
      icon: <Activity className="h-3.5 w-3.5" />,
      fn: () => callKesslerTool("evaluate_avoidance_options"),
    },
    {
      id: "stage",
      label: "Stage Burn",
      icon: <Crosshair className="h-3.5 w-3.5" />,
      fn: () => callKesslerTool("stage_avoidance_burn", deriveOptimalBurn()),
    },
    {
      id: "commit",
      label: "Authorize Fire",
      icon: <Zap className="h-3.5 w-3.5" />,
      fn: async () => {
        if (!stagedBurn && phase !== "CLEARED") {
          await callKesslerTool("stage_avoidance_burn", deriveOptimalBurn());
        }
        return callKesslerTool("commit_orbital_maneuver", {
          authorizationNote: "Authorize and fire thrusters",
        });
      },
    },
  ];

  return (
    <div>
      <Section title="Quick Actions" />
      <div className="grid grid-cols-2 gap-1.5">
        {triggers.map((tr) => (
          <button
            key={tr.id}
            onClick={() => run(tr.id, tr.fn)}
            className={`flex items-center justify-center gap-1.5 border px-2 py-2 font-space text-[10px] font-bold uppercase transition ${
              busy === tr.id
                ? "border-[#FFB000] bg-[#2A2822] text-[#FFB000]"
                : "border-[#2A2822] bg-[#0A0A08] text-[#8C887B] hover:border-[#FFB000] hover:text-[#D8D4C8]"
            }`}
          >
            <span className="text-[#FFB000]">{tr.icon}</span>
            <span>{tr.label}</span>
          </button>
        ))}
      </div>
      <button
        onClick={() => runCommand("reset simulation")}
        className="mt-2 flex w-full items-center justify-center gap-1.5 border border-[#2A2822] bg-[#0A0A08] py-1.5 font-space text-[10px] font-bold uppercase text-[#8C887B] hover:border-[#C4453D] hover:text-[#C4453D]"
      >
        <RotateCcw className="h-3 w-3" />
        Reset Simulation
      </button>
    </div>
  );
}

/* ------------------------------ panel ------------------------- */

export default function LeftDeck() {
  const mcpBound = useKesslerStore((s) => s.mcpBound);
  const toolCount = useKesslerStore((s) => s.toolCount);

  return (
    <aside className="z-20 flex h-full w-full flex-col border border-[#2A2822] bg-[#141310]">
      {/* Header */}
      <div className="border-b border-[#2A2822] px-4 py-2.5 bg-[#141310]">
        <div className="flex items-center justify-between">
          <span className="font-space text-xs font-bold tracking-wider text-[#D8D4C8]">
            ORBITAL DECK
          </span>
        </div>
      </div>

      <div className="flex-1 space-y-3.5 overflow-y-auto px-4 py-3.5">
        <HazardBanner />
        <ScenarioPicker />
        <TelemetryDeck />
        <StagedBurnCard />
        <TradeStudyCard />
        <CommittedCard />
        <AgentPrompts />
      </div>

      <div className="border-t border-[#2A2822] px-4 py-2 bg-[#0A0A08]">
        <div className="flex items-center justify-between font-space text-[9.5px] font-bold text-[#8C887B]">
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 ${mcpBound ? "bg-[#33FF66]" : "bg-[#FFB000]"}`} />
            {mcpBound ? "WebMCP Connected" : "Local MCP Bridge"}
          </span>
          <span className="font-mono text-[#FFB000]">{toolCount} tools</span>
        </div>
      </div>
    </aside>
  );
}
