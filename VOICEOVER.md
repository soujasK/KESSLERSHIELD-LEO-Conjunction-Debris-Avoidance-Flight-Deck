# KesslerShield LEO — Voiceover Track (150 s)

Continuous narration for the submission video. ~355 words → ~150 s at a confident
NASA-flight-controller pace (~2.4 words/sec). Read it, or paste each block into a TTS
(ElevenLabs "Adam/Josh", or Windows Narrator) and lay it over the screen capture.

Timecodes match [DEMO_SCRIPT.md](DEMO_SCRIPT.md). `[action]` = what you click on screen at that moment.

---

**[0:00]** `[let the deck sit, then click MUTED → SOUND ON]`
In twenty-seven minutes, a quarter-billion-dollar Earth-observation satellite intersects a fragment
of Cosmos fourteen-oh-eight — a real anti-satellite test — at twenty-seven thousand kilometres an
hour. This is KesslerShield LEO.

**[0:12]** `[camera toolbar: Chase Cam → Threat Zoom → Free Orbit]`
Built for the OpenAI WebMCP Challenge — an Apollo Mission-Control console that runs the orbital
physics entirely in browser memory. No server. No cloud round-trip.

**[0:22]** `[top bar: 2D MAP]`
The Houston ground-track projection — the satellite's Mercator path, the debris trajectory, and the
live sub-point.

**[0:36]** `[top bar: B-PLANE]`
And the B-plane — the conjunction target plane, with the five-kilometre keep-out corridor the
maneuver has to clear.

**[0:50]** `[top bar: 3D SPHERE, then Left Deck: INSPECT RISK]`
Every action here is a WebMCP tool, registered on document dot modelContext. Inspect conjunction
geometry — real-time vectors, time to closest approach, collision probability, propellant reserve.
Two hundred, OK.

**[1:10]** `[Left Deck: EVALUATE OPTIONS]`
Evaluate avoidance options runs a client-side Clohessy-Wiltshire trade study — retrograde, prograde,
out-of-plane — and returns the minimum-fuel recommendation.

**[1:23]** `[Left Deck: STAGE BURN]`
Stage the retrograde vector — one-point-eight metres per second. The engine projects an
eight-kilometre miss. Corridor clear. Nothing has fired yet.

**[1:35]** `[Left Deck: Authorize Thruster Fire]`
For high-consequence AI operations, the human is not optional. The operator commits the orbital
maneuver — thrusters fire.

**[1:52]** `[hover the green banner + MANEUVER COMMITTED card]`
Threat cleared. Miss distance opens to eight kilometres. Collision probability drops to one in
twenty-five million. The spacecraft is safe.

**[2:02]** `[command console: type "load ISS", Enter]`
The same tools answer to natural language — for an operator, or an autonomous agent. Load the ISS
crewed-station conjunction.

**[2:11]** `[Event Stream tabs: TOOLS → AGENT → ALERTS; click a log card]`
Category filtering — and every tool call opens to its raw JSON input and output. Full audit
transparency.

**[2:19]** `[refresh the browser]`
Session state lives in localStorage. Reload — and the active scenario, the sound setting, and the
entire event log are exactly where they were.

**[2:26]** `[Left Deck: Reset Simulation]`
Reset restores the epoch. KesslerShield LEO — high-consequence human-AI operations, built on WebMCP.

---

## Screen-record it (free, Windows)

**OBS Studio** (obsproject.com):
1. Sources → **Display Capture** (your monitor) or **Window Capture** (the browser).
2. Sources → **Audio Output Capture** → Desktop Audio — this records the click / chime / thruster.
3. Settings → Video → Base & Output Resolution **1920×1080**, FPS **60**.
4. Settings → Output → Recording → Format **mp4**, Encoder **NVENC/x264**, Quality **High**.
5. Browser: `F11` fullscreen, then hard-reload once (clears `localStorage`) so you start clean on
   Sentinel-7 with sound at default.
6. Hit **Start Recording**, run the sequence above, **Stop**. Trim head/tail in the free
   **Clipchamp** (built into Windows) or **DaVinci Resolve**.

**Voiceover:** record a mic pass in OBS on a second audio track, or generate the narration in a TTS
and drop it onto the timeline in Clipchamp / Resolve, nudging clips to the `[action]` cues.

**Target:** 1080p60, ≤ 2:30, MP4 (H.264 + AAC). Upload to YouTube unlisted, link on Devpost.
