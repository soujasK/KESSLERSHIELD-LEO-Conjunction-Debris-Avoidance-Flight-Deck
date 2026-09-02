import { useKesslerStore, type BurnType } from "./store";

/* ============================================================================
 * KesslerShield — WebMCP tool-registration module
 * ----------------------------------------------------------------------------
 * Binds four client-side tools onto `document.modelContext` following the
 * OpenAI WebMCP browser-tools shape:
 *
 *   document.modelContext.registerTool({
 *     name, description, inputSchema, annotations, async execute(args) { ... }
 *   }) -> { unregister(): void }        // (or registerTool(name, def) on some hosts)
 *
 * `execute` resolves to an MCP tool result:
 *   { content: [{ type: "text", text }], structuredContent, isError }
 *
 * With no WebMCP host present, an identical local bridge is installed on
 * `window.kesslerShieldMCP` so the command bar, presets and demos keep working.
 * ========================================================================== */

export interface McpToolResult {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: {
    title?: string;
    readOnlyHint?: boolean;
    destructiveHint?: boolean;
    idempotentHint?: boolean;
    openWorldHint?: boolean;
  };
  execute: (
    args: Record<string, unknown>
  ) => Promise<McpToolResult> | McpToolResult;
}

export interface McpRegistrationHandle {
  unregister?: () => void;
}

interface ModelContextLike {
  registerTool: (
    a: McpToolDefinition | string,
    b?: McpToolDefinition
  ) => McpRegistrationHandle | void;
}

declare global {
  interface Document {
    modelContext?: ModelContextLike;
  }
  interface Window {
    kesslerShieldMCP?: {
      transport: string;
      listTools: () => Array<
        Pick<McpToolDefinition, "name" | "description" | "inputSchema">
      >;
      callTool: (
        name: string,
        args?: Record<string, unknown>
      ) => Promise<McpToolResult>;
    };
  }
}

/* ------------------------------- Utilities ------------------------------- */

const ok = (structured: unknown): McpToolResult => ({
  content: [{ type: "text", text: JSON.stringify(structured, null, 2) }],
  structuredContent: structured,
  isError: false,
});

const fail = (message: string): McpToolResult => ({
  content: [{ type: "text", text: JSON.stringify({ error: message }, null, 2) }],
  structuredContent: { error: message },
  isError: true,
});

const BURN_TYPES: BurnType[] = ["RETROGRADE", "PROGRADE", "OUT_OF_PLANE"];

function asNumber(v: unknown, field: string): number {
  const n = typeof v === "string" ? Number(v) : (v as number);
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new Error(`"${field}" must be a finite number`);
  }
  return n;
}

/* ---------------------------- Tool definitions -------------------------- */

export function buildToolDefinitions(): McpToolDefinition[] {
  return [
    {
      name: "inspect_conjunction_geometry",
      description:
        "Returns the active satellite's orbital vectors, the debris trajectory, time to closest approach (TCA), miss distance, collision probability, and remaining propellant Δv reserves. Pure read of client-side propagator state — no maneuver is performed.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: {
        title: "Inspect Conjunction Geometry",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      execute: () => ok(useKesslerStore.getState().inspectConjunctionGeometry()),
    },

    {
      name: "evaluate_avoidance_options",
      description:
        "Runs a comparative trade-study across ALL three burn types (RETROGRADE, PROGRADE, OUT_OF_PLANE) in a single call. For each it returns the minimum Δv to clear the 5 km corridor, the projected miss distance, propellant expenditure, corridor-clear and budget-feasibility flags. Also returns `recommended` — the optimal burn vector (burnType, deltaVMPS, burnTimeDeltaSec) — and a natural-language rationale. Analysis only; nothing is staged or fired.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: {
        title: "Evaluate Avoidance Options (Trade Study)",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      execute: () => ok(useKesslerStore.getState().evaluateAvoidanceOptions()),
    },

    {
      name: "stage_avoidance_burn",
      description:
        "Computes an impulsive Δv burn vector for a requested burn type and lead time, then renders the predictive 3D bypass trajectory onto the globe. Non-destructive: it does NOT fire thrusters. Returns projected miss distance, propellant expenditure, and whether the 5 km radial safety corridor is cleared.",
      inputSchema: {
        type: "object",
        properties: {
          burnType: {
            type: "string",
            enum: BURN_TYPES,
            description:
              "Impulse direction in the orbital frame: RETROGRADE (−velocity), PROGRADE (+velocity), or OUT_OF_PLANE (orbit-normal).",
          },
          deltaVMPS: {
            type: "number",
            minimum: 0,
            maximum: 50,
            description: "Impulse magnitude in metres per second.",
          },
          burnTimeDeltaSec: {
            type: "number",
            minimum: 0,
            description:
              "Seconds from now at which the impulse is applied (must precede TCA).",
          },
        },
        required: ["burnType", "deltaVMPS", "burnTimeDeltaSec"],
        additionalProperties: false,
      },
      annotations: {
        title: "Stage Avoidance Burn",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      execute: (args) => {
        try {
          const rawType = String(args.burnType ?? "").toUpperCase();
          if (!BURN_TYPES.includes(rawType as BurnType)) {
            return fail(
              `"burnType" must be one of ${BURN_TYPES.join(", ")} (received "${args.burnType}")`
            );
          }
          const deltaVMPS = asNumber(args.deltaVMPS, "deltaVMPS");
          const burnTimeDeltaSec = asNumber(
            args.burnTimeDeltaSec,
            "burnTimeDeltaSec"
          );
          if (deltaVMPS < 0) return fail(`"deltaVMPS" must be >= 0`);

          return ok(
            useKesslerStore.getState().stageAvoidanceBurn({
              burnType: rawType as BurnType,
              deltaVMPS,
              burnTimeDeltaSec,
            })
          );
        } catch (e) {
          return fail(e instanceof Error ? e.message : String(e));
        }
      },
    },

    {
      name: "commit_orbital_maneuver",
      description:
        "HUMAN-AUTHORIZED, STATE-CHANGING. Fires the satellite thrusters in the simulation, snaps the live orbital line onto the staged bypass trajectory, spends the propellant, and neutralises the collision alarm. Requires a staged avoidance burn that clears the 5 km corridor, plus an authorization note.",
      inputSchema: {
        type: "object",
        properties: {
          authorizationNote: {
            type: "string",
            minLength: 1,
            description:
              "Free-text human-in-the-loop authorization record (operator call-sign, rationale, or approval reference).",
          },
        },
        required: ["authorizationNote"],
        additionalProperties: false,
      },
      annotations: {
        title: "Commit Orbital Maneuver",
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
      execute: (args) => {
        const authorizationNote = String(args.authorizationNote ?? "").trim();
        if (!authorizationNote) {
          return fail(
            `"authorizationNote" is required for human-in-the-loop authorization`
          );
        }
        const result = useKesslerStore
          .getState()
          .commitOrbitalManeuver({ authorizationNote });
        return result.success ? ok(result) : fail(result.missionStatus);
      },
    },

    {
      name: "emergency_auto_deconflict",
      description:
        "EMERGENCY SOLVER. Automatically evaluates all Clohessy-Wiltshire evasion options under severe time pressure, computes the optimal minimum-fuel burn to guarantee corridor clearance (>5km), and renders the predictive 3D bypass spline on the globe. Staging is non-destructive and returns an emergency authorization prompt ready for human approval.",
      inputSchema: {
        type: "object",
        properties: {
          targetCorridorKm: {
            type: "number",
            minimum: 3,
            maximum: 20,
            description: "Target radial safety corridor clearance in km (defaults to 5.0 km).",
          },
        },
        additionalProperties: false,
      },
      annotations: {
        title: "Emergency Auto Deconflict (Solver)",
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
      execute: (args) => {
        try {
          const targetCorridorKm = args.targetCorridorKm ? Number(args.targetCorridorKm) : 5.0;
          const result = useKesslerStore
            .getState()
            .emergencyAutoDeconflict({ targetCorridorKm });
          return ok(result);
        } catch (e) {
          return fail(e instanceof Error ? e.message : String(e));
        }
      },
    },
  ];
}

/* --------------------------- Registration entry ------------------------- */

export interface WebMcpBinding {
  bound: boolean;
  transport: string;
  toolNames: string[];
  dispose: () => void;
}

export function initWebMcp(): WebMcpBinding {
  const defs = buildToolDefinitions();
  const handles: McpRegistrationHandle[] = [];
  const store = useKesslerStore.getState();

  const host =
    typeof document !== "undefined" && document.modelContext
      ? document.modelContext
      : undefined;

  let bound = false;
  let transport = "local-bridge (window.kesslerShieldMCP)";

  if (host && typeof host.registerTool === "function") {
    for (const def of defs) {
      try {
        let handle = host.registerTool(def);
        if (!handle) handle = host.registerTool(def.name, def) ?? undefined;
        handles.push(handle ?? {});
      } catch {
        try {
          handles.push(host.registerTool(def.name, def) ?? {});
        } catch (err) {
          store.log({
            channel: "system",
            direction: "info",
            title: `failed to register ${def.name}: ${
              err instanceof Error ? err.message : String(err)
            }`,
            level: "warn",
          });
        }
      }
    }
    bound = handles.length > 0;
    transport = bound
      ? "document.modelContext (WebMCP host)"
      : "local-bridge (window.kesslerShieldMCP)";
  }

  if (typeof window !== "undefined") {
    window.kesslerShieldMCP = {
      transport,
      listTools: () =>
        defs.map(({ name, description, inputSchema }) => ({
          name,
          description,
          inputSchema,
        })),
      callTool: async (name, args = {}) => {
        const def = defs.find((d) => d.name === name);
        if (!def) return fail(`unknown tool "${name}"`);
        return def.execute(args);
      },
    };
  }

  store.setMcpBinding(bound, transport, defs.length);

  return {
    bound,
    transport,
    toolNames: defs.map((d) => d.name),
    dispose: () => {
      for (const h of handles) {
        try {
          h.unregister?.();
        } catch {
          /* host may not support unregister */
        }
      }
      if (typeof window !== "undefined") delete window.kesslerShieldMCP;
    },
  };
}

export async function callKesslerTool(
  name: string,
  args: Record<string, unknown> = {}
): Promise<McpToolResult> {
  const def = buildToolDefinitions().find((d) => d.name === name);
  if (!def) return fail(`unknown tool "${name}"`);
  return def.execute(args);
}
