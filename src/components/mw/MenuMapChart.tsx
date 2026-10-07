import { useNavigate } from "@tanstack/react-router";
import { CartesianGrid, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis, Cell, Label } from "recharts";
import { wasteColor, type menuMap } from "@/lib/calc";
import { formatPeso } from "@/lib/format";

type Map = ReturnType<typeof menuMap>;

export function MenuMapChart({ map, height = 360, interactive = true }: { map: Map; height?: number; interactive?: boolean }) {
  const navigate = useNavigate();
  const data = map.rows.map((r) => ({ x: +r.popularity.toFixed(1), y: +r.profit.toFixed(2), z: Math.max(r.waste, 1), name: r.item.name, id: r.item.id, waste: r.waste, intensity: r.intensity, quadrant: r.quadrant }));
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 16, right: 16, bottom: 28, left: 8 }}>
          <CartesianGrid stroke="var(--border)" />
          <XAxis type="number" dataKey="x" name="Popularity" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}>
            <Label value="Popularity (avg. weekly sales) →" position="bottom" offset={10} style={{ fontSize: 12, fill: "var(--primary)", fontWeight: 600 }} />
          </XAxis>
          <YAxis type="number" dataKey="y" name="Profitability" tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={(v) => `₱${v}`}>
            <Label value="Profitability (margin/unit) →" angle={-90} position="insideLeft" style={{ fontSize: 12, fill: "var(--primary)", fontWeight: 600, textAnchor: "middle" }} />
          </YAxis>
          <ZAxis type="number" dataKey="z" range={[80, 1400]} name="Waste value" />
          <ReferenceLine x={map.avgPop} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
          <ReferenceLine y={map.avgProfit} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
          <Tooltip
            cursor={false}
            content={({ payload }) => {
              const p = payload?.[0]?.payload as (typeof data)[number] | undefined;
              if (!p) return null;
              return (
                <div className="rounded-lg border border-border bg-card p-3 text-xs shadow">
                  <p className="font-bold text-primary">{p.name}</p>
                  <p className="text-muted-foreground">{p.quadrant}</p>
                  <p>Popularity: {p.x}/wk · Margin: {formatPeso(p.y)}</p>
                  <p>Waste value: {formatPeso(p.waste)}</p>
                </div>
              );
            }}
          />
          <Scatter
            data={data}
            onClick={interactive ? (d: { id?: string; payload?: { id: string } }) => navigate({ to: "/menu/$id", params: { id: d.payload?.id ?? d.id! } }) : undefined}
            className={interactive ? "cursor-pointer" : ""}
          >
            {data.map((d) => (
              <Cell key={d.id} fill={wasteColor(d.intensity)} fillOpacity={0.8} stroke="var(--card)" />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
      <div className="mt-1 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span>Lower waste</span>
        <span className="h-2 w-24 rounded-full" style={{ background: `linear-gradient(90deg, ${wasteColor(0)}, ${wasteColor(0.5)}, ${wasteColor(1)})` }} />
        <span>Higher waste</span>
        <span className="ml-3">· Bubble size = waste value</span>
      </div>
    </div>
  );
}
