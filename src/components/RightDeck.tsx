import { useEffect, useMemo, useRef, useState } from "react";
import { Terminal } from "lucide-react";
import { playClickSound } from "../audio";
import { useKesslerStore, type AuditLogEntry } from "../store";
import { JsonView, PromptChip, StatusPill } from "./primitives";

type FilterTab = "all" | "tools" | "agent" | "alerts";

function LogCard({ e, fresh }: { e: AuditLogEntry; fresh: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const isTool = e.channel === "tool";
  const isHazard = e.level === "hazard";

  return (
    <div
      onClick={() => setExpanded((v) => !v)}
      className={`group cursor-pointer border transition px-3 py-2 mx-3 my-1 ${
        fresh
          ? "border-[#FFB000] bg-[#2A2822]/40"
          : "border-[#2A2822] bg-[#0A0A08] hover:border-[#FFB000]/50"
      }`}
    >
      <div className="flex items-center justify-between font-mono text-[10.5px]">
        <div className="flex items-center gap-2 truncate">
          <span className="text-[#8C887B]">{e.clock}</span>
          <span
            className={`px-1.5 py-0.5 font-space text-[9px] font-bold uppercase ${
              isTool
                ? "border border-[#FFB000]/40 bg-[#FFB000]/10 text-[#FFB000]"
                : isHazard
                ? "border border-[#C4453D]/40 bg-[#C4453D]/10 text-[#C4453D]"
                : "border border-[#2A2822] text-[#8C887B]"
            }`}
          >
            {e.tool || e.channel}
          </span>
          <span
            className={`truncate font-mono ${
              isHazard ? "text-[#C4453D] font-bold" : "text-[#D8D4C8]"
            }`}
          >
            {e.title}
          </span>
        </div>
        <span className="ml-2 shrink-0">
          <StatusPill status={e.status} />
        </span>
      </div>

      {expanded && (e.input !== undefined || e.output !== undefined) && (
        <div className="mt-2 border-t border-[#2A2822] pt-2 space-y-1.5" onClick={(ev) => ev.stopPropagation()}>
          {e.input !== undefined && <JsonView data={e.input} label="input payload" />}
          {e.output !== undefined && <JsonView data={e.output} label="output payload" />}
        </div>
      )}
    </div>
  );
}

function CommandBar() {
  const runCommand = useKesslerStore((s) => s.runCommand);
  const soundEnabled = useKesslerStore((s) => s.soundEnabled);
  const [value, setValue] = useState("");
  const [reply, setReply] = useState<{ ok: boolean; message: string } | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);

  const presets = ["inspect risk", "evaluate options", "authorize fire"];

  const submit = () => {
    if (!value.trim()) return;
    if (soundEnabled) playClickSound();
    const res = runCommand(value);
    setReply(res);
    setHistory((h) => [value, ...h]);
    setHIdx(-1);
    setValue("");
  };

  return (
    <div className="border-t border-[#2A2822] bg-[#0A0A08] p-3">
      <div className="mb-2 flex items-center justify-between font-space text-[10px] font-bold uppercase text-[#FFB000]">
        <span className="flex items-center gap-1.5">
          <Terminal className="h-3.5 w-3.5 text-[#FFB000]" />
          Command Plane
        </span>
      </div>

      {/* Preset Chips */}
      <div className="mb-2 flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <PromptChip
            key={p}
            onClick={() => {
              if (soundEnabled) playClickSound();
              setValue(p);
            }}
          >
            {p}
          </PromptChip>
        ))}
      </div>

      {reply && (
        <div
          className={`mb-2 border px-2 py-1 font-mono text-[9.5px] ${
            reply.ok
              ? "border-[#33FF66]/40 bg-[#33FF66]/10 text-[#D8D4C8]"
              : "border-[#C4453D]/40 bg-[#C4453D]/10 text-[#D8D4C8]"
          }`}
        >
          {reply.message}
        </div>
      )}

      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-[#FFB000]">
            ›
          </span>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
              else if (e.key === "ArrowUp") {
                if (history.length > 0) {
                  const nxt = Math.min(history.length - 1, hIdx + 1);
                  setHIdx(nxt);
                  setValue(history[nxt]);
                }
              } else if (e.key === "ArrowDown") {
                if (hIdx > 0) {
                  const nxt = hIdx - 1;
                  setHIdx(nxt);
                  setValue(history[nxt]);
                } else if (hIdx === 0) {
                  setHIdx(-1);
                  setValue("");
                }
              }
            }}
            placeholder='command console...'
            className="w-full border border-[#2A2822] bg-[#141310] pl-5 pr-2.5 py-1.5 font-mono text-[11px] text-[#FFB000] placeholder-[#8C887B] transition focus:border-[#FFB000] focus:outline-none"
          />
        </div>
        <button
          onClick={submit}
          className="shrink-0 border border-[#FFB000] bg-[#2A2822] px-3 py-1.5 font-space text-[10px] font-bold uppercase text-[#FFB000] hover:bg-[#FFB000] hover:text-[#0A0A08] transition"
        >
          Run
        </button>
      </div>
    </div>
  );
}

export default function RightDeck() {
  const auditLog = useKesslerStore((s) => s.auditLog);
  const mcpBound = useKesslerStore((s) => s.mcpBound);
  const soundEnabled = useKesslerStore((s) => s.soundEnabled);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<FilterTab>("all");
  const freshIdRef = useRef<string | null>(null);

  // Filter & deduplicate logs: pair result entries with invoke entries
  const filteredLogs = useMemo(() => {
    let list = auditLog.filter((e) => e.direction !== "invoke");
    if (filter === "tools") list = list.filter((e) => e.channel === "tool");
    else if (filter === "agent") list = list.filter((e) => e.channel === "agent" || e.channel === "human");
    else if (filter === "alerts") list = list.filter((e) => e.level === "hazard" || e.level === "warn");
    return list;
  }, [auditLog, filter]);

  const lastId = filteredLogs[filteredLogs.length - 1]?.id ?? null;
  if (lastId !== freshIdRef.current) freshIdRef.current = lastId;

  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  const invocations = useMemo(
    () => auditLog.filter((e) => e.channel === "tool" && e.direction === "invoke").length,
    [auditLog]
  );

  return (
    <aside className="z-20 flex h-full w-full flex-col border border-[#2A2822] bg-[#141310]">
      {/* Header */}
      <div className="border-b border-[#2A2822] px-4 py-2.5 bg-[#141310]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="h-3.5 w-3.5 text-[#FFB000]" />
            <span className="font-space text-xs font-bold tracking-wider text-[#D8D4C8]">
              EVENT STREAM
            </span>
          </div>
          <div className="flex items-center gap-2 font-mono text-[9.5px]">
            <span className="border border-[#2A2822] bg-[#0A0A08] px-2 py-0.5 text-[#FFB000] font-bold">
              {invocations} TOOLS EXECUTED
            </span>
            <span className={`h-1.5 w-1.5 ${mcpBound ? "bg-[#33FF66]" : "bg-[#FFB000]"}`} />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mt-2 flex items-center gap-1 font-space text-[9px]">
          {(["all", "tools", "agent", "alerts"] as FilterTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                if (soundEnabled) playClickSound();
                setFilter(tab);
              }}
              className={`px-2 py-0.5 uppercase transition ${
                filter === tab
                  ? "bg-[#2A2822] text-[#FFB000] font-bold border border-[#FFB000]/50"
                  : "text-[#8C887B] hover:text-[#D8D4C8]"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div
        ref={scrollRef}
        onScroll={(ev) => {
          const el = ev.currentTarget;
          setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 44);
        }}
        className="flex-1 overflow-y-auto py-2"
      >
        {filteredLogs.map((e) => (
          <LogCard key={e.id} e={e} fresh={e.id === freshIdRef.current} />
        ))}
      </div>

      {!autoScroll && (
        <button
          onClick={() => setAutoScroll(true)}
          className="mx-3 mb-1 border border-[#2A2822] bg-[#0A0A08] py-1 font-space text-[9.5px] font-bold uppercase text-[#FFB000] hover:bg-[#2A2822]"
        >
          ↓ Jump To Live Events
        </button>
      )}

      <CommandBar />
    </aside>
  );
}
