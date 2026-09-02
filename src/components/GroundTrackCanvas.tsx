import { useEffect, useRef } from "react";
import { useKesslerStore } from "../store";

export default function GroundTrackCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const alt = useKesslerStore((s) => s.altitudeKm);
  const vel = useKesslerStore((s) => s.velocityKmS);
  const scenarioName = useKesslerStore((s) => s.scenarioName);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let raf = 0;
    let t = 0;

    const render = () => {
      t += 0.015;
      const w = cv.width;
      const h = cv.height;

      // Dark obsidian background
      ctx.fillStyle = "#0A0A08";
      ctx.fillRect(0, 0, w, h);

      // Gridlines (Longitude / Latitude)
      ctx.strokeStyle = "#2A2822";
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      for (let x = 0; x <= w; x += w / 12) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
      }
      for (let y = 0; y <= h; y += h / 6) {
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
      }
      ctx.stroke();

      // Equator
      ctx.strokeStyle = "#8C887B";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      // Satellite Sine-Wave Ground Track
      ctx.strokeStyle = "#FFB000";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const rad = (x / w) * Math.PI * 4 + t * 0.2;
        const y = h / 2 + Math.sin(rad) * (h * 0.35);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Debris Ground Track
      ctx.strokeStyle = "#C4453D";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      for (let x = 0; x <= w; x += 2) {
        const rad = (x / w) * Math.PI * 3 - t * 0.15;
        const y = h / 2 + Math.sin(rad) * (h * 0.38);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Current Satellite Position Marker
      const satX = (w * 0.45 + (t * 20) % w) % w;
      const satY = h / 2 + Math.sin((satX / w) * Math.PI * 4 + t * 0.2) * (h * 0.35);

      ctx.fillStyle = "#FFB000";
      ctx.beginPath();
      ctx.arc(satX, satY, 4, 0, Math.PI * 2);
      ctx.fill();

      // Satellite Sub-Point Target Crosshair
      ctx.strokeStyle = "#FFB000";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(satX, satY, 9, 0, Math.PI * 2);
      ctx.stroke();

      raf = requestAnimationFrame(render);
    };

    const resize = () => {
      cv.width = cv.parentElement?.clientWidth || 800;
      cv.height = cv.parentElement?.clientHeight || 500;
    };
    resize();
    window.addEventListener("resize", resize);
    render();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#0A0A08]">
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
      <div className="pointer-events-none absolute left-4 top-4 border border-[#2A2822] bg-[#0A0A08]/90 p-2.5 font-mono text-[9px] text-[#FFB000]">
        <div className="font-space font-bold uppercase text-[#D8D4C8]">{scenarioName} · Ground Track</div>
        <div className="mt-1 flex items-center gap-3 text-[#8C887B]">
          <span>ALT: {alt.toFixed(1)} km</span>
          <span>VEL: {vel.toFixed(3)} km/s</span>
          <span>PROJ: MERCATOR 2D</span>
        </div>
      </div>
    </div>
  );
}
