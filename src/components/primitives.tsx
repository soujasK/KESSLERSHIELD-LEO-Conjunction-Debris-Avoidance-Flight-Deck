import { useMemo, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";

/* ============================================================================
 * Shared instrument primitives — sparkline, radial gauge, status pill,
 * syntax-highlighted collapsible JSON, prompt chip.
 * ========================================================================== */

/* ------------------------------- Sparkline ---------------------------- */

export function Sparkline({
  data,
  color = "#FFB000",
  width = 120,
  height = 30,
  fill = true,
}: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
  fill?: boolean;
}) {
  const { line, area } = useMemo(() => {
    if (data.length < 2) return { line: "", area: "" };
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const n = data.length - 1;
    const pts = data.map((v, i) => {
      const x = (i / n) * width;
      const y = height - 3 - ((v - min) / span) * (height - 6);
      return [x, y] as const;
    });
    const line = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
    const area = `${line} L${width},${height} L0,${height} Z`;
    return { line, area };
  }, [data, width, height]);

  const gid = useMemo(() => `spark-${Math.random().toString(36).slice(2, 8)}`, []);

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.2" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && area && <path d={area} fill={`url(#${gid})`} />}
      {line && (
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth="1.25"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

/* ------------------------------ RadialGauge (MOCR CRT Scale) -------------------------- */

export function RadialGauge({
  value,
  label,
  valueText,
  sub,
  color = "#FFB000",
  size = 98,
}: {
  value: number; // 0..1
  label: string;
  valueText: string;
  sub?: string;
  color?: string;
  size?: number;
}) {
  const v = Math.max(0, Math.min(1, value));
  const r = (size - 14) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const angle = -210 + v * 240;
  const rad = (angle * Math.PI) / 180;
  const pointerX = cx + r * 0.75 * Math.cos(rad);
  const pointerY = cy + r * 0.75 * Math.sin(rad);

  const majorTicks = [0, 0.25, 0.5, 0.75, 1];
  const minorTicks = [0.125, 0.375, 0.625, 0.875];

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        {/* MOCR CRT High-Contrast Dial Scale */}
        <svg width={size} height={size} className="overflow-visible">
          {/* Dial Outer Ring */}
          <circle cx={cx} cy={cy} r={r} fill="#0A0A08" stroke="#3A3832" strokeWidth="1.5" />
          <circle cx={cx} cy={cy} r={r - 4} fill="none" stroke="#2A2822" strokeWidth="1" strokeDasharray="2 3" />
          
          {/* Minor Ticks */}
          {minorTicks.map((p, i) => {
            const a = (-210 + p * 240) * (Math.PI / 180);
            const x1 = cx + (r - 4) * Math.cos(a);
            const y1 = cy + (r - 4) * Math.sin(a);
            const x2 = cx + r * Math.cos(a);
            const y2 = cy + r * Math.sin(a);
            return <line key={`min-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#8C887B" strokeWidth="1" />;
          })}

          {/* Major Ticks */}
          {majorTicks.map((p, i) => {
            const a = (-210 + p * 240) * (Math.PI / 180);
            const x1 = cx + (r - 7) * Math.cos(a);
            const y1 = cy + (r - 7) * Math.sin(a);
            const x2 = cx + r * Math.cos(a);
            const y2 = cy + r * Math.sin(a);
            return <line key={`maj-${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#D8D4C8" strokeWidth="1.75" />;
          })}

          {/* High-Visibility Instrument Needle */}
          <line x1={cx} y1={cy} x2={pointerX} y2={pointerY} stroke={color} strokeWidth="2.5" strokeLinecap="round" />
          <circle cx={cx} cy={cy} r="3.5" fill={color} stroke="#0A0A08" strokeWidth="1" />
          <circle cx={pointerX} cy={pointerY} r="1.5" fill="#FFFFFF" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pt-3.5">
          <span className="font-mono text-sm font-bold text-[#FFB000] drop-shadow">{valueText}</span>
          {sub && <span className="font-mono text-[9px] font-bold text-[#D8D4C8]">{sub}</span>}
        </div>
      </div>
      <span className="mt-1.5 font-space text-[10px] font-bold uppercase tracking-wider text-[#D8D4C8]">
        {label}
      </span>
    </div>
  );
}

/* ------------------------------ StatusPill -------------------------- */

const STATUS_META: Record<number, { text: string; cls: string }> = {
  200: { text: "200 OK", cls: "border-[#2A2822] bg-[#0A0A08] text-[#33FF66]" },
  202: { text: "202 ACCEPTED", cls: "border-[#2A2822] bg-[#0A0A08] text-[#FFB000]" },
  409: { text: "409 CONFLICT", cls: "border-[#2A2822] bg-[#0A0A08] text-[#FFB000]" },
  422: { text: "422 UNPROCESSABLE", cls: "border-[#2A2822] bg-[#0A0A08] text-[#C4453D]" },
  428: { text: "428 PRECONDITION", cls: "border-[#2A2822] bg-[#0A0A08] text-[#C4453D]" },
};

export function StatusPill({ status }: { status: number }) {
  const meta = STATUS_META[status] ?? {
    text: `${status}`,
    cls: "border-[#2A2822] bg-[#0A0A08] text-[#8C887B]",
  };
  return (
    <span
      className={`rounded-none border px-1.5 py-0.5 font-mono text-[8.5px] font-bold tracking-wide ${meta.cls}`}
    >
      {meta.text}
    </span>
  );
}

/* ------------------------------- JsonView -------------------------- */

function highlight(raw: string): string {
  const esc = raw
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return esc.replace(
    /("(?:\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(?:\s*:)?|\b(?:true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (m) => {
      let cls = "text-[#FFB000]";
      if (/^"/.test(m)) cls = /:\s*$/.test(m) ? "text-[#8C887B]" : "text-[#33FF66]";
      else if (/^(true|false)$/.test(m)) cls = "text-[#FFB000]";
      else if (m === "null") cls = "text-[#C4453D]";
      return `<span class="${cls}">${m}</span>`;
    }
  );
}

export function JsonView({
  data,
  label,
  defaultOpen = false,
}: {
  data: unknown;
  label: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const text = useMemo(() => JSON.stringify(data, null, 2), [data]);
  const preview = useMemo(() => {
    const flat = JSON.stringify(data);
    return flat.length > 46 ? flat.slice(0, 46) + "…" : flat;
  }, [data]);

  return (
    <div className="mt-1 overflow-hidden rounded-none border border-[#2A2822] bg-[#0A0A08]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-2 py-1 text-left font-space text-[9.5px] font-bold uppercase tracking-wider text-[#D8D4C8] transition hover:text-[#FFB000]"
      >
        <ChevronRight
          className={`h-3 w-3 text-[#FFB000] transition-transform ${open ? "rotate-90" : ""}`}
        />
        {label}
        {!open && (
          <span className="ml-1 truncate font-mono text-[9px] normal-case tracking-normal text-[#8C887B]">
            {preview}
          </span>
        )}
      </button>
      {open && (
        <pre
          className="max-h-52 overflow-auto border-t border-[#2A2822] px-2.5 py-2 text-[10px] leading-relaxed text-[#FFB000] font-mono"
          dangerouslySetInnerHTML={{ __html: highlight(text) }}
        />
      )}
    </div>
  );
}

/* ------------------------------ PromptChip -------------------------- */

export function PromptChip({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 rounded-none border border-[#2A2822] bg-[#0A0A08] px-2.5 py-1 font-space text-[10px] font-bold uppercase tracking-wider text-[#D8D4C8] transition hover:border-[#FFB000] hover:text-[#FFB000]"
    >
      {children}
    </button>
  );
}
