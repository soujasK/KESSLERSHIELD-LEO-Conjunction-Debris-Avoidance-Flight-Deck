# KesslerShield LEO — 150-Second Submission Video Script

**Verified against the live build.** All clicks, numbers, and on-screen results below are what the
app actually produces (`Sentinel-7` default scenario). Record at **1080p / 60fps, fullscreen,
desktop audio ON**. Delivery: energetic NASA flight-controller cadence.

> Numbers note: the optimal retrograde burn resolves to **≈ 1.8 m/s Δv → 8.00 km projected miss**
> (well clear of the 5 km corridor), `Pc` drops to **1 : 25,000,000**. Use those; they're the real,
> physically-consistent outputs.

---

## UI map (where things are)

| Control | Location |
| --- | --- |
| **Sound toggle** (`MUTED` ⇄ `SOUND ON`) | top bar, far right, next to `GET` clock |
| **Viewport switch** (`3D SPHERE` / `2D MAP` / `B-PLANE`) | top bar, center |
| **Camera modes** (`FREE ORBIT` / `CHASE CAM` / `POLAR TOP` / `THREAT ZOOM`) | floating toolbar, top-center over the globe |
| **Quick Actions** (`INSPECT RISK` / `EVALUATE OPTIONS` / `STAGE BURN` / `AUTHORIZE FIRE`) | Left Deck, 2×2 grid — **one click each, executes the WebMCP tool + plays audio** |
| **Authorize Thruster Fire** button | Left Deck, on the Staged Avoidance Vector card |
| **Reset Simulation** | Left Deck, below Quick Actions |
| **Command console** + preset chips | Right Deck, bottom — chips execute on click; free text + Enter also works |
| **Event Stream** + filter tabs (`ALL` / `TOOLS` / `AGENT` / `ALERTS`) | Right Deck, top |

---

## CHAPTER 1 — The Orbital Crisis (0:00 – 0:50)

### 0:00 – 0:10 · Hook
- **Do:** Let the deck sit for a beat. Click **`MUTED` → `SOUND ON`** (top-right).
- **Audio:** relay click; `Audio Subsystem ONLINE` chimes into the Event Stream.
- **Say:** *"In 27 minutes a quarter-billion-dollar Earth-observation satellite intersects a
  fragment of Cosmos-1408 — a real 2021 anti-satellite test — at 27,000 kilometres an hour. This is
  KesslerShield LEO."*
- **Screen:** `ALERT LEVEL CRITICAL` banner, full metadata wrapping — never truncated. `GET` clock
  running. Zero emoji, phosphor-amber CRT.

### 0:10 – 0:20 · Camera engine
- **Do:** Camera toolbar → **`CHASE CAM`**, **`THREAT ZOOM`**, back to **`FREE ORBIT`**.
- **Say:** *"Built for the OpenAI WebMCP Challenge — an Apollo Mission-Control console running the
  orbital physics entirely in browser RAM. No server, no cloud round-trip."*
- **Screen:** the celestial-schematic globe reframes — riding the satellite, locked on the
  closest-approach point, then free orbit with RA/Dec graticule and altitude shells.

### 0:20 – 0:35 · 2D ground track
- **Do:** Top bar → **`2D MAP`**.
- **Say:** *"The Houston ground-track projection: the satellite's Mercator sine-wave path, the
  debris trajectory, and the live sub-point."*
- **Screen:** 2D Mercator grid, amber + red ground tracks, animated sub-point crosshair.

### 0:35 – 0:50 · B-plane
- **Do:** Top bar → **`B-PLANE`**.
- **Say:** *"And the B-plane — the conjunction target plane, with the five-kilometre radial
  keep-out corridor the maneuver has to clear."*
- **Screen:** B-plane axes, green 5.0 km keep-out circle, amber 1.0 km warning ring, red miss-vector.

---

## CHAPTER 2 — WebMCP Tools & Trade Study (0:50 – 1:35)

### 0:50 – 1:10 · inspect_conjunction_geometry
- **Do:** Top bar → **`3D SPHERE`**. Left Deck → **`INSPECT RISK`**.
- **Audio:** relay click + CRT chime.
- **Say:** *"Every action here is a WebMCP tool registered on `document.modelContext`. Inspect
  conjunction geometry — real-time vectors, time to closest approach, collision probability,
  propellant reserve."*
- **Screen:** Event Stream logs `inspect_conjunction_geometry` → `200 OK`; telemetry tiles update.

### 1:10 – 1:22 · evaluate_avoidance_options
- **Do:** Left Deck → **`EVALUATE OPTIONS`**.
- **Audio:** relay click + CRT chime.
- **Say:** *"Evaluate avoidance options runs a client-side Clohessy-Wiltshire trade study —
  retrograde, prograde, out-of-plane — and returns the minimum-fuel recommendation."*
- **Screen:** Trade Options card fills — 3 rows with Δv / projected miss / CLEAR|FAIL; **RETROGRADE
  ≈ 1.8 m/s** highlighted as recommended.

### 1:22 – 1:35 · stage_avoidance_burn
- **Do:** Left Deck → **`STAGE BURN`** (or **`Stage RETROGRADE`** on the Trade card).
- **Audio:** relay click.
- **Say:** *"Stage the retrograde vector. The engine projects an eight-kilometre miss — corridor
  clear. Nothing has fired yet."*
- **Screen:** amber predictive bypass spline draws on the globe; Staged Avoidance Vector card shows
  `CORRIDOR: CLEAR`.

---

## CHAPTER 3 — The Climax: Human Authorization (1:35 – 2:00)

### 1:35 – 1:52 · commit_orbital_maneuver
- **Do:** Left Deck → Staged card → **`Authorize Thruster Fire`**.
- **Audio:** **deep sub-bass thruster ignition rumble.**
- **Say:** *"For high-consequence AI operations, the human is not optional. The operator commits
  `commit_orbital_maneuver` — thrusters fire."*
- **Screen:** live orbit snaps **green**; hazard banner flips **RED → GREEN**, label reads
  `Status: Nominal`; alarm clears. `MANEUVER COMMITTED` card appears.

### 1:52 – 2:00 · Confirm
- **Do:** Mouse over the (now green) hazard banner and the `MANEUVER COMMITTED` card.
- **Say:** *"Threat cleared. Miss distance opens to eight kilometres, collision probability drops
  to one in twenty-five million. The spacecraft is safe."*
- **Screen:** confirmed miss `8.00 km` in green; `Pc 1 : 25,000,000`; metadata wraps cleanly.

---

## CHAPTER 4 — NL Commands, Filtering, Persistence (2:00 – 2:30)

### 2:00 – 2:10 · Natural-language scenario load
- **Do:** Right Deck command console → type **`load ISS`** → Enter (or click the console chips).
- **Say:** *"The same tools are reachable in natural language — for an operator, or an autonomous
  agent. Load the ISS crewed-station conjunction."*
- **Screen:** whole conjunction swaps — 51.6° / 418 km orbit, `DEB-CZ-4C R/B` threat, 65 m/s Δv
  budget, new TCA.

### 2:10 – 2:18 · Filter + drill down
- **Do:** Event Stream tabs → **`TOOLS`**, **`AGENT`**, **`ALERTS`**, back to **`ALL`**. Click a
  log card to expand.
- **Say:** *"Category filtering, and every tool call opens to its raw JSON input and output —
  full audit transparency."*
- **Screen:** tabs narrow the stream; a card expands to syntax-highlighted JSON payload.

### 2:18 – 2:25 · localStorage persistence
- **Do:** Refresh the browser (`Ctrl/Cmd + R`).
- **Audio:** silence.
- **Say:** *"Session state lives in localStorage. Reload — and the active scenario, the sound
  setting, and the full event log are exactly where they were."*
- **Screen:** page reloads to the **ISS** scenario, `MUTED` still set, complete log history intact.

### 2:25 – 2:30 · Clean reset + close
- **Do:** Left Deck → **`Reset Simulation`**.
- **Audio:** relay click.
- **Say:** *"Reset wipes localStorage and restores the conjunction epoch. KesslerShield LEO —
  high-consequence human-AI operations, built on WebMCP."*
- **Screen:** Event Stream collapses to a single `SIMULATION RESET` entry; deck returns to a clean
  Sentinel-7 alert. End on the wide 3D view.

---

## Checklist before you hit record

- [ ] Fresh load (clear `localStorage` key `kesslershield_session_v1` or hard-reload once) so you
      start on Sentinel-7 with `SOUND` at default and a clean log.
- [ ] Desktop audio capture ON — verify the relay click and thruster rumble are in the recording.
- [ ] Window maximised, browser chrome hidden (F11 / presentation mode).
- [ ] Run through once muted-to-yourself for timing; the whole loop fits 150 s with ~10 s slack.
