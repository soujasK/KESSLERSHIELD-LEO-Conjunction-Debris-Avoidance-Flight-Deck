import { useEffect, useRef } from "react";
import { useKesslerStore } from "../store";

export default function BPlaneCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const miss = useKesslerStore((s) => s.missDistanceMeters);
  const pc = useKesslerStore((s) => s.collisionProbability);
  const scenarioName = useKesslerStore((s) => s.scenarioName);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;

    let raf = 0;

    const render = () => {
      const miss = useKesslerStore.getState().missDistanceMeters;
      const w = cv.width;
      const h = cv.height;
      const cx = w / 2;
      const cy = h / 2;

      ctx.fillStyle = "#0A0A08";
      ctx.fillRect(0, 0, w, h);

      // Axes (B-Plane T & R Axes)
      ctx.strokeStyle = "#2A2822";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(w, cy);
      ctx.moveTo(cx, 0);
      ctx.lineTo(cx, h);
      ctx.stroke();

      // Axis Labels
      ctx.font = "9px monospace";
      ctx.fillStyle = "#8C887B";
      ctx.fillText("ξ (Radial)", w - 60, cy - 8);
      ctx.fillText("η (Cross-track)", cx + 8, 20);

      // 5.0 km Radial Safety Corridor Circle
      const rCorridor = 120; // 5.0 km = 120px
      ctx.strokeStyle = "#33FF66";
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.arc(cx, cy, rCorridor, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#33FF66";
      ctx.fillText("5.0 km Keep-Out Corridor", cx + rCorridor + 8, cy + 4);

      // 1.0 km Inner Warning Ring
      const rWarning = 40;
      ctx.strokeStyle = "#FFB000";
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.arc(cx, cy, rWarning, 0, Math.PI * 2);
      ctx.stroke();

      // Primary Satellite Marker at Origin (0,0)
      ctx.fillStyle = "#33FF66";
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fill();

      // Debris Track Vector Position
      const scale = 120 / 5000; // 120px per 5000m
      const debX = cx + (miss * scale * 0.7);
      const debY = cy - (miss * scale * 0.4);

      // Miss Vector Line
      ctx.strokeStyle = miss < 200 ? "#C4453D" : "#FFB000";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(debX, debY);
      ctx.stroke();

      // Debris Point
      ctx.fillStyle = miss < 200 ? "#C4453D" : "#FFB000";
      ctx.beginPath();
      ctx.arc(debX, debY, 5, 0, Math.PI * 2);
      ctx.fill();

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
        <div className="font-space font-bold uppercase text-[#D8D4C8]">{scenarioName} · B-Plane Diagram</div>
        <div className="mt-1 flex items-center gap-3 text-[#8C887B]">
          <span>MISS: {Math.round(miss)} m</span>
          <span>P(c): {(pc * 100).toFixed(3)}%</span>
          <span>CORRIDOR: 5.0 km</span>
        </div>
      </div>
    </div>
  );
}
