"use client";

import { useEffect, useMemo, useState } from "react";
import "@/styles/onlypoker-theme.css";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
} from "recharts";

type Overview = {
  winrate_bb: number | null;
  total_hands: number | null;
  weakest_seat: string | null;
  weakest_bb: number | null;
  primary_leak: string | null;
  primary_leak_bb: number | null;
};

type SeatRow = { hero_position: string; bb: number; n: number };
type LeakRow = { learning_tag: string; bb: number; n: number };
type TrendRow = { hand_date: string; cum_avg_bb: number };

const green = "#10b981";
const amber = "#f59e0b";
const red = "#ef4444";

export default function AnalyticsPage() {
  const [month, setMonth] = useState<string>(() => {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
  const [stakes, setStakes] = useState<string>("10NL");
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [seats, setSeats] = useState<SeatRow[]>([]);
  const [leaks, setLeaks] = useState<LeakRow[]>([]);
  const [trend, setTrend] = useState<TrendRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ month, stakes }).toString();
    fetch(`/api/analytics?${qs}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setOverview(json.overview);
        setSeats(json.seats);
        setLeaks(json.leaks);
        setTrend(json.trend);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [month, stakes]);

  const seatDial = useMemo(() => {
    const order = ["UTG", "HJ", "CO", "BTN", "SB", "BB"];
    const byPos: Record<string, SeatRow> = {};
    for (const r of seats) byPos[r.hero_position] = r;
    return order.map((k) => ({
      pos: k,
      bb: byPos[k]?.bb ?? 0,
      n: byPos[k]?.n ?? 0,
    }));
  }, [seats]);

  return (
    <div className="p-6 space-y-6 op-surface text-[#f3f4f6]">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold platinum-text-gradient tracking-tight">Analytics</h1>
        <div className="flex gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm bg-[#141414] text-[#E2E8F0] platinum-inner-border outline-none cursor-pointer hover:bg-[#1a1a1a] transition"
          >
            {Array.from({ length: 12 }).map((_, i) => {
              const d = new Date();
              d.setUTCMonth(d.getUTCMonth() - i);
              const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
              const lbl = d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
              return (
                <option key={ym} value={ym} className="bg-[#1a1a1a]">
                  {lbl}
                </option>
              );
            })}
          </select>

          <select
            value={stakes}
            onChange={(e) => setStakes(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm bg-[#141414] text-[#E2E8F0] platinum-inner-border outline-none cursor-pointer hover:bg-[#1a1a1a] transition"
          >
            {["2NL", "5NL", "10NL", "25NL", "50NL", "100NL", "200NL"].map((s) => (
              <option key={s} value={s} className="bg-[#1a1a1a]">
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-900/50 bg-red-900/10 p-4 text-sm text-red-400 platinum-inner-border">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <StatCard
          title="WINRATE"
          value={`${fmt(overview?.winrate_bb ?? 0)} bb/hand`}
          subtitle={`${overview?.total_hands ?? 0} hands`}
          accent={green}
        />
        <StatCard
          title="WEAKEST SEAT"
          value={overview?.weakest_seat ?? "—"}
          subtitle={`${fmt(overview?.weakest_bb ?? 0)} bb`}
          accent={red}
        />
        <StatCard
          title="PRIMARY LEAK"
          value={overview?.primary_leak ?? "—"}
          subtitle={`${fmt(overview?.primary_leak_bb ?? 0)} bb impact`}
          accent={amber}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="col-span-2 p-6 platinum-container-frame">
          <div className="mb-4 text-sm font-bold platinum-text-gradient uppercase tracking-wider">Position Heatmap & Key Stats</div>
          <div className="flex flex-wrap items-end gap-3 mb-6">
            {seatDial.map((s) => (
              <SeatPill key={s.pos} label={s.pos} bb={s.bb} n={s.n} />
            ))}
          </div>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={seatDial}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                <XAxis dataKey="pos" stroke="#94A3B8" tick={{ fill: '#94A3B8', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis stroke="#94A3B8" tick={{ fill: '#94A3B8', fontSize: 12 }} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333', color: '#E2E8F0', borderRadius: '8px' }}
                  itemStyle={{ color: '#E2E8F0' }}
                  formatter={(v: any) => [fmt(Number(v)) + " bb", "Winrate"]}
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                />
                <Bar dataKey="bb" fill="#9CA3AF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="p-6 platinum-container-frame">
          <div className="mb-4 text-sm font-bold platinum-text-gradient uppercase tracking-wider">Leak Impact (bb lost avg)</div>
          <div className="space-y-3">
            {leaks.map((l) => (
              <LeakRowBar key={l.learning_tag} tag={l.learning_tag} bb={l.bb} />
            ))}
            {!leaks.length && (
              <div className="text-sm text-[#737373] italic">No significant leaks detected for this filter.</div>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 platinum-container-frame">
        <div className="mb-4 text-sm font-bold platinum-text-gradient uppercase tracking-wider">Recent Trend (Last 200 Hands)</div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
              <XAxis dataKey="hand_date" stroke="#94A3B8" tickFormatter={(v) => v.slice(5)} tick={{ fill: '#94A3B8', fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis stroke="#94A3B8" tick={{ fill: '#94A3B8', fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e1e1e', borderColor: '#333', color: '#E2E8F0', borderRadius: '8px' }}
                itemStyle={{ color: '#E2E8F0' }}
                formatter={(v: any) => [fmt(Number(v)) + " bb", "Cum. BB"]}
              />
              <Line type="monotone" dataKey="cum_avg_bb" stroke={green} strokeWidth={3} dot={{ r: 3, fill: green, strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {loading && <div className="text-sm text-[#737373] animate-pulse">Loading analytics data…</div>}
    </div>
  );
}

function fmt(n: number) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function StatCard({
  title,
  value,
  subtitle,
  accent,
}: {
  title: string;
  value: string;
  subtitle?: string;
  accent: string;
}) {
  return (
    <div className="platinum-container-frame p-5 flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-bold tracking-widest text-[#737373] uppercase">{title}</div>
          <span className="h-2 w-2 rounded-full shadow-[0_0_8px_rgba(255,255,255,0.3)]" style={{ background: accent }} />
        </div>
        <div className="text-2xl font-bold text-[#E2E8F0] tracking-tight">{value}</div>
      </div>
      {subtitle ? <div className="mt-2 text-xs font-medium text-[#94A3B8]">{subtitle}</div> : null}
    </div>
  );
}

function SeatPill({ label, bb, n }: { label: string; bb: number; n: number }) {
  const good = bb >= 0.0;
  const color = good ? green : red;
  return (
    <div className="flex items-center gap-3 rounded-full bg-[#141414] border border-[#333] px-4 py-2 shadow-sm platinum-inner-border">
      <div className="h-2 w-2 shrink-0 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      <div className="text-sm">
        <div className="font-bold text-[#d4d4d4]">{label}</div>
        <div className="text-[10px] font-mono text-[#737373]">
          {fmt(bb)} bb • {n} hands
        </div>
      </div>
    </div>
  );
}

function LeakRowBar({ tag, bb }: { tag: string; bb: number }) {
  const isLoss = bb < 0;
  const width = Math.min(Math.abs(bb) * 8, 100);
  const color = isLoss ? red : green;
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-[#1a1a1a] transition">
      <div className="w-44 truncate text-sm font-medium text-[#d4d4d4]">{tag}</div>
      <div className="flex-1 bg-[#141414] rounded-full h-2 overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${width}%`, background: color, opacity: 0.8 }} />
      </div>
      <div className="w-16 text-right text-sm font-mono text-[#E2E8F0]">{fmt(bb)}</div>
    </div>
  );
}
