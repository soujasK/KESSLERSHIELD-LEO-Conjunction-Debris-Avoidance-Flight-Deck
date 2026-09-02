import { useEffect } from "react";
import { Volume2, VolumeX } from "lucide-react";
import { initAudio, playClickSound } from "./audio";
import BPlaneCanvas from "./components/BPlaneCanvas";
import EarthCanvas from "./components/EarthCanvas";
import GroundTrackCanvas from "./components/GroundTrackCanvas";
import LeftDeck from "./components/LeftDeck";
import RightDeck from "./components/RightDeck";
import { useKesslerStore } from "./store";
import { initWebMcp } from "./webmcp";

export default function App() {
  const tick = useKesslerStore((s) => s.tick);
  const missionClock = useKesslerStore((s) => s.missionClockSec);
  const viewportMode = useKesslerStore((s) => s.viewportMode);
  const setViewportMode = useKesslerStore((s) => s.setViewportMode);
  const soundEnabled = useKesslerStore((s) => s.soundEnabled);
  const toggleSound = useKesslerStore((s) => s.toggleSound);

  useEffect(() => {
    const binding = initWebMcp();
    return () => binding.dispose();
  }, []);

  useEffect(() => {
    let last = performance.now();
    const id = window.setInterval(() => {
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      tick(Math.min(dt, 0.5));
    }, 180);
    return () => window.clearInterval(id);
  }, [tick]);

  const met = `${String(Math.floor(missionClock / 60)).padStart(2, "0")}:${String(
    Math.floor(missionClock % 60)
  ).padStart(2, "0")}`;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#000000] celestial-grid crt-scanlines font-sans text-[#D8D4C8]">
      {/* Dynamic Viewport (3D Sphere / 2D Ground Track / B-Plane Diagram) */}
      <div className="absolute inset-0 z-0">
        {viewportMode === "3d" ? (
          <EarthCanvas />
        ) : viewportMode === "2d" ? (
          <GroundTrackCanvas />
        ) : (
          <BPlaneCanvas />
        )}
      </div>

      {/* Top Console Status Strip */}
      <div className="absolute inset-x-0 top-0 z-30 h-9 border-b border-[#2A2822] bg-[#141310]/95">
        <div className="flex items-center justify-between gap-3 px-4 py-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[#8C887B]">
          <span className="font-space text-sm font-bold tracking-wider text-[#D8D4C8]">
            KESSLERSHIELD <span className="text-[#FFB000]">LEO</span>
          </span>

          {/* Viewport Mode Switcher */}
          <div className="flex items-center gap-1 border border-[#2A2822] bg-[#0A0A08] p-0.5 font-space text-[10px]">
            {[
              ["3d", "3D Sphere"],
              ["2d", "2D Map"],
              ["bplane", "B-Plane"],
            ].map(([m, label]) => (
              <button
                key={m}
                onClick={() => {
                  if (soundEnabled) playClickSound();
                  setViewportMode(m as any);
                }}
                className={`px-2 py-0.5 font-bold uppercase transition ${
                  viewportMode === m
                    ? "bg-[#2A2822] text-[#FFB000] border border-[#FFB000]/60"
                    : "text-[#8C887B] hover:text-[#D8D4C8]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 font-mono text-[10px] text-[#8C887B]">
            {/* Audio Toggle */}
            <button
              onClick={() => {
                initAudio();
                toggleSound();
                playClickSound();
              }}
              className="flex items-center gap-1 border border-[#2A2822] bg-[#0A0A08] px-2 py-0.5 text-[9px] text-[#FFB000] hover:bg-[#2A2822]"
            >
              {soundEnabled ? <Volume2 className="h-3 w-3 text-[#33FF66]" /> : <VolumeX className="h-3 w-3 text-[#8C887B]" />}
              <span>{soundEnabled ? "SOUND ON" : "MUTED"}</span>
            </button>
            <span>
              GET <span className="font-bold text-[#FFB000]">{met}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Left MOCR Console Deck */}
      <div className="absolute left-3 top-12 bottom-3 z-10 w-[392px] max-h-[calc(100vh-60px)]">
        <LeftDeck />
      </div>

      {/* Right MOCR Console Deck */}
      <div className="absolute right-3 top-12 bottom-3 z-10 w-[392px] max-h-[calc(100vh-60px)]">
        <RightDeck />
      </div>
    </div>
  );
}
