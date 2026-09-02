<div align="center">

# KesslerShield LEO

### Low Earth Orbit Conjunction & Debris Avoidance Flight Deck

**A human-in-the-loop control plane for high-consequence AI operations — built on WebMCP.**

`Vite` · `React 18` · `TypeScript` · `Three.js` · `Zustand` · `Web Audio API` · zero backend

*OpenAI WebMCP Challenge submission*

</div>

---

## The 27-minute problem

In 1978, NASA's **Donald J. Kessler** described a runaway scenario: once the object density in Low Earth
Orbit crosses a threshold, one collision sprays debris that triggers the next collision, and orbital
shells become unusable for generations. Every fragment of `Cosmos-1408` — the real 2021 anti-satellite
test that seeds KesslerShield's default scenario — is a step down that path.

When a conjunction alert fires, a flight dynamics team has minutes. The data they need to act — 3D
ephemeris, relative velocity, covariance, the B-plane geometry — lives in client-side WebGL and Wasm
memory. A screenshot-reading agent **cannot** compute a Euclidean miss distance or a minimum-fuel
Δv from flat pixels, and shipping live state to a cloud LLM burns the seconds that matter.

**KesslerShield is the answer to "what does an AI agent do here, safely?"**

---

## The WebMCP thesis

The web app registers its **client-side astrodynamics engine as tools on `document.modelContext`**.
An agent (or the operator, or the natural-language command console — same code path) walks a five-step
loop that is deliberately domain-agnostic:

```
 inspect  →  evaluate options  →  stage a plan  →  HUMAN authorizes  →  commit
```

- The physics never leaves the browser. No cloud round-trip, no latency, no data exfiltration.
- Every irreversible action (`commit_orbital_maneuver`) is gated behind an explicit human
  authorization note and is **refused outright** if the staged burn doesn't clear the 5 km corridor.
- The agent and the human drive **one identical simulation** — the tools call the same store actions
  the buttons do.

That loop isn't specific to spacecraft. It's the shape of every AI-adjacent action that is physical,
irreversible, and expensive to get wrong:

| KesslerShield tool | Robotics | Financial trading | Cloud / DevOps |
| --- | --- | --- | --- |
| `inspect_conjunction_geometry` | read joint torques + obstacle map | read the live book, exposure, VaR | read cluster health, diff, blast radius |
| `evaluate_avoidance_options` | compare grasp trajectories | compare execution strategies | compare rollout plans (canary / blue-green / halt) |
| `stage_avoidance_burn` | stage a motion plan, preview it | stage the order ticket | stage the deploy, render the plan |
| `commit_orbital_maneuver` | **operator arms the arm** | **desk head approves the block** | **on-call approves the ship** |

---

## 90-second tour

| # | Do this | You see |
| --- | --- | --- |
| 1 | Open the app. Click **`MUTED → SOUND ON`** (top bar). | 1970s Apollo MOCR CRT console lights up; `Audio Subsystem ONLINE` logs to the Event Stream. Alert metadata wraps — never truncates. |
| 2 | Cycle the camera toolbar: **Free Orbit → Chase Cam → Threat Zoom → Polar Top**. | The 3D celestial-schematic globe reframes: free orbit, riding the satellite, locked on the closest-approach point, top-down. |
| 3 | Switch the center viewport: **3D Sphere → 2D Map → B-Plane**. | Mercator ground-track with sub-point crosshair; then the B-plane cross-section with the 5.0 km keep-out circle + inner warning ring. |
| 4 | Click **Inspect Risk**. | `inspect_conjunction_geometry` fires via `document.modelContext`; a `200 OK` card lands in the Event Stream with the full geometry payload. |
| 5 | Click **Evaluate Options**. | `evaluate_avoidance_options` runs a Clohessy-Wiltshire trade study across RETROGRADE / PROGRADE / OUT_OF_PLANE and recommends the minimum-fuel vector. |
| 6 | Click **Stage Burn** (or **Stage Recommended** on the trade card). | The amber predictive bypass spline draws on the globe. The Staged Avoidance Vector card shows `CORRIDOR: CLEAR`. |
| 7 | Click **Authorize Thruster Fire**. | Sub-bass ignition rumble. The live orbit snaps green, the hazard banner flips **RED → GREEN `Status: Nominal`**, the alarm clears. |
| 8 | Type `load ISS` in the command console. | The whole conjunction swaps — ISS crewed-station orbit, a different threat object, different urgency and Δv budget. |
| 9 | Filter the Event Stream: **Tools / Agent / Alerts**. Click a card. | Category filtering; the raw JSON input/output payload expands inline with syntax highlighting. |
| 10 | Refresh the page. Then click **Reset Simulation**. | Viewport, sound preference, and the full event log survive the reload (localStorage). Reset wipes the log back to a single `SIMULATION RESET` entry. |

---

## The tools

All five are registered on `document.modelContext.registerTool(...)` when a WebMCP host is present
(Chrome with the flag, or an agent runtime). With no host, an **identical local bridge** is installed
on `window.kesslerShieldMCP` so the console, the buttons, and automated demos all keep working — the
left-panel footer and the stream header show which transport is live.

| Tool | Input | Effect | Mutates the sim? |
| --- | --- | --- | --- |
| **`inspect_conjunction_geometry`** | *(none)* | Returns satellite vectors, debris track, TCA, miss distance, `Pc`, Δv reserve, threat level. | No — pure read |
| **`evaluate_avoidance_options`** | *(none)* | One call → a trade study across all 3 burn types: min Δv to clear the corridor, projected miss, propellant cost, corridor-clear + budget-feasibility flags, a `recommended` vector, and a natural-language rationale. | No — analysis, renders the trade card |
| **`stage_avoidance_burn`** | `{ burnType, deltaVMPS, burnTimeDeltaSec }` | Computes the impulsive burn, draws the predictive bypass spline, returns projected miss + `corridorClear`. | Stages only — **no thruster fire** |
| **`commit_orbital_maneuver`** | `{ authorizationNote }` | Fires thrusters, snaps the live orbit onto the bypass, spends propellant, clears the alarm. **Rejects any staged burn that does not clear the 5 km corridor.** | **Yes — human-authorized, irreversible** |
| **`emergency_auto_deconflict`** | `{ targetCorridorKm? }` | Emergency solver: evaluates every evasion option under time pressure, computes the guaranteed minimum-fuel burn, stages it, and returns a prompt ready for human approval. | Stages only |

Every `execute` resolves to an MCP tool result: `{ content: [{ type: "text", text }], structuredContent, isError }`.

### Drive it from the console

```js
await window.kesslerShieldMCP.callTool("inspect_conjunction_geometry");

await window.kesslerShieldMCP.callTool("evaluate_avoidance_options");

await window.kesslerShieldMCP.callTool("stage_avoidance_burn", {
  burnType: "RETROGRADE", deltaVMPS: 1.8, burnTimeDeltaSec: 1200,
});

await window.kesslerShieldMCP.callTool("commit_orbital_maneuver", {
  authorizationNote: "FDO NOMAD — corridor clear, proceed",
});

window.kesslerShieldMCP.listTools(); // -> [{ name, description, inputSchema }, ...]
```

### Natural-language command console

The bottom-right input parses intent to the same tools. Examples:

```
inspect conjunction risk
evaluate avoidance options
stage retrograde dv 1.4 in 900s
stage out-of-plane burn
authorize and fire thrusters — FDO call-sign NOMAD
load ISS          ·   load polar          ·   scenario 1
reset simulation
```

---

## Scenarios

The picker swaps the entire conjunction — orbit regime, threat object, geometry, urgency, propellant
budget — so the same tool flow is exercised against very different physics.

| Scenario | Asset | Threat | Orbit |
| --- | --- | --- | --- |
| **Sentinel-7** | `KES-LEO-07 // SENTINEL` | `DEB-COSMOS-1408` (2021 ASAT fragmentation) | 97.4° Sun-synchronous, ~545 km |
| **ISS** | `ISS (ZARYA) // NODE-2` | `DEB-CZ-4C R/B` (rocket-body fragment) | 51.6°, ~418 km |
| **Polar SSO** | `GEOSCAN-2 // POLAR` | `DEB-FENGYUN-1C` (2007 ASAT debris cloud) | 98.2° near-polar, ~705 km |

---

## Viewports & camera

**Center viewport** (top-bar switch): **3D Sphere** — celestial-schematic wireframe Earth with RA/Dec
graticule, LEO/MEO/GEO altitude shells, orbit ribbons and comet-trails · **2D Map** — Mercator
ground-track with live sub-point · **B-Plane** — conjunction target-plane cross-section with the 5.0 km
keep-out corridor and inner warning ring.

**3D camera modes**: **Free Orbit** (drag + auto-rotate) · **Chase Cam** (rides behind the satellite
along its velocity vector) · **Polar Top** (locked top-down) · **Threat Zoom** (frames the
closest-approach point).

---

## Architecture

Everything is client-side. No server, no API keys, no database.

| Path | Responsibility |
| --- | --- |
| `src/store.ts` | Zustand store — telemetry + rolling history buffers, Kepler element sets, three scenario baselines, burn staging, trade study, camera + viewport state, audit log with pseudo-HTTP status codes, localStorage session persistence, the five tool actions, and the NL `runCommand` parser. |
| `src/webmcp.ts` | WebMCP registration — tool schemas + `execute` handlers, host detection, the `window.kesslerShieldMCP` fallback bridge, `initWebMcp()` / `callKesslerTool()`. |
| `src/audio.ts` | Native Web Audio synth — per-gesture 1970s MOCR relay clicks, sub-bass thruster ignition rumble, CRT telemetry chime. No audio files. |
| `src/components/EarthCanvas.tsx` | Vanilla Three.js — schematic Earth, celestial grid, altitude shells, `Line2` orbit ribbons, comet-trails, pulsing hazard marker, 4 camera modes, `ResizeObserver`, full disposal on unmount. |
| `src/components/GroundTrackCanvas.tsx` | 2D canvas — Mercator lat/lon grid, satellite + debris sine-wave ground tracks, animated sub-point crosshair. |
| `src/components/BPlaneCanvas.tsx` | 2D canvas — B-plane axes, 5.0 km keep-out circle, 1.0 km warning ring, live debris miss-vector. |
| `src/components/LeftDeck.tsx` | Orbital telemetry HUD — hazard banner, scenario picker, TCA countdown + telemetry tiles with sparklines + MOCR needle gauges, Staged Burn card, Trade Study card, one-click Quick Actions, Reset. |
| `src/components/RightDeck.tsx` | Live WebMCP Event Stream — category filter tabs, expandable syntax-highlighted JSON cards, status pills, jump-to-live + the NL command console. |
| `src/components/primitives.tsx` | Sparkline, radial needle gauge, `StatusPill`, collapsible `JsonView`, prompt chip. |
| `src/App.tsx` | 3-pane MOCR shell — viewport router, top status strip (GET clock, sound toggle, viewport switch), decks. |

---

## The astrodynamics model — what's real, what's simulated

This is a **decision-loop demonstrator**, not a flight-qualified propagator. Kept deliberately light so
it runs at 60 FPS entirely in the browser:

- Orbits are Keplerian element sets; positions come from a Newton-solved Kepler equation.
- Avoidance separation uses the **linearised Clohessy-Wiltshire secular term** — a tangential Δv walks
  the along-track separation ≈ `3·Δv·t` (RETROGRADE, most efficient), with modelled efficiency
  penalties for PROGRADE (`≈2.35·Δv·t`) and OUT_OF_PLANE (`≈1.6·Δv·t`).
- Perturbed post-burn elements are derived from the vis-viva differential so the 3D bypass spline is
  geometrically plausible.
- Miss distance carries slow covariance "breathing" + white sensor noise; `Pc` tightens as TCA
  approaches. Orbital altitude is visually exaggerated (~6×) so LEO geometry reads clear of the limb;
  telemetry and tool outputs report true values.

The point is the **human–AI control loop and its guardrails**, not the ephemeris fidelity.

---

## Run it

Requires **Node 20+**.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # tsc --noEmit + vite build  →  dist/
npm run preview   # serve the production build locally
```

## Deploy — Render (static site)

No backend, so it's a **Static Site** on the free tier.

| Setting | Value |
| --- | --- |
| Build Command | `npm install && npm run build` |
| Publish Directory | `dist` |
| Node version | pinned by `.node-version` (20.11.1) |

`public/_redirects` (`/* /index.html 200`) is included for SPA fallback. Also deploys as-is to
Vercel, Netlify, GitHub Pages, or Cloudflare Pages — it's just static files.

> The WebMCP host API (`document.modelContext`) won't exist for a normal visitor to the deployed
> site; the app detects that and runs the `window.kesslerShieldMCP` bridge instead, so every feature
> still works standalone.

---

## Design system

Apollo-era **Mission Operations Control Room** console: pure-black ground, phosphor-amber `#FFB000`,
CRT-green `#33FF66` for nominal, alarm-red `#C4453D` for critical. Space Grotesk for headers,
JetBrains Mono for telemetry. Scanline overlay, needle gauges, corner-cut tactical frames.
**Zero emoji.** Every mechanical interaction has a synthesized relay click; the thruster fire has a
sub-bass rumble.

## Persistence

`localStorage` key `kesslershield_session_v1` restores the **active viewport**, the **sound
preference**, and the **full event-log history** across reloads. **Reset Simulation** clears the key
and returns the audit log to a single epoch entry.

---

<div align="center">

**KesslerShield LEO** — bringing high-consequence human–AI operations to WebMCP.

</div>
