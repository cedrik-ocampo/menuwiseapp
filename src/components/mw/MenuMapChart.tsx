import { useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { ReferenceArea, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, Cell, Label } from "recharts";
import { wasteColor, type menuMap } from "@/lib/calc";
import { formatPeso } from "@/lib/format";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Map = ReturnType<typeof menuMap>;

export function MenuMapChart({ map, interactive = true, onSelect }: { map: Map; height?: number; interactive?: boolean; onSelect?: (id: string) => void }) {
  const navigate = useNavigate();
  const data = map.plottedRows.map((r) => ({ x: r.popularity, y: +r.profit.toFixed(2), z: Math.max(r.waste, 1), name: r.item.name, id: r.item.id, waste: r.waste, intensity: r.intensity, quadrant: r.quadrant }));
  const hasQuadrants = data.length > 1;
  const mx = map.medianPop;
  const my = map.medianProfit;
  const halfX = Math.max(1, ...data.map((d) => Math.abs(d.x - mx))) * 1.12;
  const halfY = Math.max(1, ...data.map((d) => Math.abs(d.y - my))) * 1.12;
  const xDomain: [number, number] = hasQuadrants ? [mx - halfX, mx + halfX] : [0, Math.max(1, ...data.map((d) => d.x)) * 1.1];
  const yDomain: [number, number] = hasQuadrants ? [my - halfY, my + halfY] : [Math.min(0, ...data.map((d) => d.y)) - 1, Math.max(1, ...data.map((d) => d.y)) * 1.1];
  const ticks = (dm: [number, number]) => [0, 1, 2, 3, 4].map((i) => dm[0] + ((dm[1] - dm[0]) * i) / 4);
  const fmtNum = (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toString() : (+v.toFixed(1)).toString());
  if (data.length === 0) {
    return <p className="py-24 text-center text-sm font-medium text-muted-foreground">No sales data yet. Log sales to see the menu map.</p>;
  }
  return (
    <div className="w-full">
      <div className="relative aspect-square min-h-[360px] w-full overflow-hidden md:aspect-[4/3] rounded-2xl border border-border bg-card/40 shadow-sm">
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 36, right: 132, bottom: 36, left: 8 }}>
          <defs>
            {QUADS.map((q) => (
              <radialGradient key={q.key} id={`mmq-${q.key}`} cx={q.cx} cy={q.cy} r="1.1">
                <stop offset="0%" stopColor={q.color} stopOpacity={0.26} />
                <stop offset="100%" stopColor={q.color} stopOpacity={0.04} />
              </radialGradient>
            ))}
          </defs>
          {hasQuadrants && QUADS.map((q) => {
            const right = q.cx === "100%";
            const bottom = q.cy === "100%";
            return <ReferenceArea key={q.key} x1={right ? mx : xDomain[0]} x2={right ? xDomain[1] : mx} y1={bottom ? yDomain[0] : my} y2={bottom ? my : yDomain[1]} fill={`url(#mmq-${q.key})`} fillOpacity={1} stroke="none" ifOverflow="hidden" label={<QuadLabel q={q} />} />;
          })}
          <XAxis type="number" dataKey="x" name="Popularity" domain={xDomain} ticks={ticks(xDomain)} allowDataOverflow tickFormatter={(v: number) => (v < 0 ? "" : fmtNum(v))} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}>
            <Label value="Popularity (total units sold, all time) →" position="bottom" offset={10} style={{ fontSize: 12, fill: "var(--primary)", fontWeight: 600 }} />
          </XAxis>
          <YAxis type="number" dataKey="y" name="Profitability" domain={yDomain} ticks={ticks(yDomain)} allowDataOverflow axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v: number) => `₱${fmtNum(v)}`}>
            <Label value="Profitability (margin/unit) →" angle={-90} position="insideLeft" style={{ fontSize: 12, fill: "var(--primary)", fontWeight: 600, textAnchor: "middle" }} />
          </YAxis>
          <ZAxis type="number" dataKey="z" range={[80, 1400]} name="Waste value" />
          {hasQuadrants && <ReferenceLine x={mx} stroke="var(--muted-foreground)" strokeOpacity={0.55} strokeDasharray="5 5" label={<PillLabel text={`Median: ${fmtNum(mx)} units`} at="top" />} />}
          {hasQuadrants && <ReferenceLine y={my} stroke="var(--muted-foreground)" strokeOpacity={0.55} strokeDasharray="5 5" label={<PillLabel text={`Median: ${formatPeso(my)}`} at="right" />} />}
          <Tooltip
            cursor={false}
            content={({ payload }) => {
              const p = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!p) return null;
              return (
                <div className="rounded-xl border border-border bg-card/95 p-3 text-xs shadow-lg backdrop-blur-sm">
                  <p className="font-bold text-primary">{p.name}</p>
                  <p className="mb-1 flex items-center gap-1.5 font-semibold" style={{ color: quadColor(p.quadrant) }}><span className="h-2 w-2 rounded-full" style={{ background: quadColor(p.quadrant) }} />{p.quadrant}</p>
                  <p>Units sold (all time): {p.x} · Margin: {formatPeso(p.y)}</p>
                  <p>Waste value: {formatPeso(p.waste)}</p>
                </div>
              );
            }}
          />
          <Scatter
            data={data}
             onClick={interactive ? (d: { id?: string; payload?: { id: string } }) => {
               const id = d.payload?.id ?? d.id;
               if (!id) return;
               if (onSelect) onSelect(id);
               else navigate({ to: "/menu/$id", params: { id } });
             } : undefined}
            className={interactive ? "cursor-pointer" : ""}
          >
            {data.map((d) => (
              <Cell key={d.id} fill={wasteColor(d.intensity)} fillOpacity={0.78} stroke="var(--background)" strokeWidth={1.5} />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      </div>
      <div className="mt-2 space-y-1 text-center text-xs text-muted-foreground">
        <p className="flex flex-wrap items-center justify-center gap-2">
          <span>Lower waste</span>
          <span className="h-2 w-24 rounded-full" style={{ background: `linear-gradient(90deg, ${wasteColor(0)}, ${wasteColor(0.5)}, ${wasteColor(1)})` }} />
          <span>Higher waste</span>
          <span>· Bubble size = waste value</span>
        </p>
         {hasQuadrants ? <p className="flex flex-wrap justify-center gap-x-1">
           <span>Top right:</span><QuadrantHelp name="Stars" text="High popularity + High profitability. Sells above the median AND earns above the median margin. Keep producing and promote." />
           <span>· Bottom right:</span><QuadrantHelp name="Plowhorses" text="High popularity + Low profitability. Sells above the median BUT earns below the median margin. Consider raising price or trimming ingredient cost." />
           <span>· Top left:</span><QuadrantHelp name="Puzzles" text="Low popularity + High profitability. Earns above the median margin BUT sells below the median. Promote or reposition to increase sales." />
           <span>· Bottom left:</span><QuadrantHelp name="Dogs" text="Low popularity + Low profitability. Sells below the median AND earns below the median margin. Consider removing or reformulating." />
         </p> : <p className="font-medium text-primary">Not enough data to classify quadrants yet.</p>}
        <p className="italic">Popularity = total units sold per menu item, all time. Click a bubble to find it in Analysis.</p>
      </div>
    </div>
  );
}

function QuadrantHelp({ name, text }: { name: string; text: string }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const keepOpen = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const scheduleClose = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <span onMouseEnter={keepOpen} onMouseLeave={scheduleClose}>
        <PopoverTrigger asChild>
          <button type="button" className="font-bold text-primary underline decoration-dotted underline-offset-2">{name}</button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(280px,calc(100vw-2rem))] p-3 text-left text-xs" onMouseEnter={keepOpen} onMouseLeave={scheduleClose}>
          <p className="font-bold text-primary">{name}</p>
          <p className="mt-1 text-muted-foreground">{text}</p>
        </PopoverContent>
      </span>
    </Popover>
  );
}

type Quad = { key: string; name: string; icon: string; color: string; cx: string; cy: string };
const QUADS: Quad[] = [
  { key: "puzzles", name: "Puzzles", icon: "🧩", color: "var(--warning)", cx: "0%", cy: "0%" },
  { key: "stars", name: "Stars", icon: "★", color: "var(--success)", cx: "100%", cy: "0%" },
  { key: "dogs", name: "Dogs", icon: "🐾", color: "var(--destructive)", cx: "0%", cy: "100%" },
  { key: "plowhorses", name: "Plowhorses", icon: "🐎", color: "var(--chart-2)", cx: "100%", cy: "100%" },
];
function quadColor(name: string) {
  const n = name.toLowerCase();
  return QUADS.find((q) => n.includes(q.key.slice(0, 4)))?.color ?? "var(--primary)";
}

type VB = { x?: number; y?: number; width?: number; height?: number };
function QuadLabel({ q, viewBox }: { q: Quad; viewBox?: VB }) {
  const { x = 0, y = 0, width = 0, height = 0 } = viewBox ?? {};
  const right = q.cx === "100%";
  const bottom = q.cy === "100%";
  const w = q.name.length * 7.5 + 34;
  const px = right ? x + width - w - 10 : x + 10;
  const py = bottom ? y + height - 32 : y + 10;
  return (
    <g pointerEvents="none">
      <rect x={px} y={py} width={w} height={22} rx={11} fill={q.color} fillOpacity={0.16} stroke={q.color} strokeOpacity={0.45} />
      <text x={px + w / 2} y={py + 15} textAnchor="middle" fontSize={11} fontWeight={700} fill={q.color} style={{ letterSpacing: "0.04em" }}>{`${q.icon} ${q.name.toUpperCase()}`}</text>
    </g>
  );
}

function PillLabel({ text, at, viewBox }: { text: string; at: "top" | "right"; viewBox?: VB }) {
  const { x = 0, y = 0, width = 0 } = viewBox ?? {};
  const w = text.length * 6.6 + 18;
  const cx = at === "top" ? x : x + width + 8 + w / 2;
  const cy = at === "top" ? y - 18 : y;
  return (
    <g pointerEvents="none">
      <rect x={cx - w / 2} y={cy - 10} width={w} height={20} rx={10} fill="var(--card)" stroke="var(--border)" />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={11} fontWeight={700} fill="var(--foreground)">{text}</text>
    </g>
  );
}
