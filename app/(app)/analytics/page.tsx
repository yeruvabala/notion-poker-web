"use client";

import { useEffect, useMemo, useState } from "react";
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

const green = "var(--brand-green, #10b981)";
const amber = "var(--brand-amber, #f59e0b)";
const red = "var(--brand-red, #ef4444)";

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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <div className="flex gap-3">
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-md border border-gray-300 bg-white/70 px-3 py-2 text-sm"
          >
            {Array.from({ length: 12 }).map((_, i) => {
              const d = new Date();
              d.setUTCMonth(d.getUTCMonth() - i);
              const ym = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
              const lbl = d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
              return (
                <option key={ym} value={ym}>
                  {lbl}
                </option>
              );
            })}
          </select>

          <select
            value={stakes}
            onChange={(e) => setStakes(e.target.value)}
            className="rounded-md border border-gray-300 bg-white/70 px-3 py-2 text-sm"
          >
            {["2NL", "5NL", "10NL", "25NL", "50NL", "100NL", "200NL"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="col-span-2 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm font-medium text-gray-700">Position Heatmap & Key Stats</div>
          <div className="flex flex-wrap items-end gap-3">
            {seatDial.map((s) => (
              <SeatPill key={s.pos} label={s.pos} bb={s.bb} n={s.n} />
            ))}
          </div>
          <div className="mt-4 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={seatDial}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="pos" />
                <YAxis />
                <Tooltip formatter={(v: any) => fmt(Number(v)) + " bb"} />
                <Bar dataKey="bb" fill="#9CA3AF" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <div className="mb-3 text-sm font-medium text-gray-700">Leak Impact (bb lost avg)</div>
          <div className="space-y-2">
            {leaks.map((l) => (
              <LeakRowBar key={l.learning_tag} tag={l.learning_tag} bb={l.bb} />
            ))}
            {!leaks.length && (
              <div className="text-sm text-gray-500">No leaks detected for this filter.</div>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-3 text-sm font-medium text-gray-700">Recent Trend (Last 200 Hands)</div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="hand_date" tickFormatter={(v) => v.slice(5)} />
              <YAxis />
              <Tooltip formatter={(v: any) => fmt(Number(v)) + " bb"} />
              <Line type="monotone" dataKey="cum_avg_bb" stroke={green} strokeWidth={3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {loading && <div className="text-sm text-gray-500">Loading…</div>}
    </div>
  );
}

function fmt(n: number) {
  return (Math.round(n * 100) / 100).toFixed(2);
}

function SeatPill({ label, bb, n }: { label: string; bb: number; n: number }) {
  const good = bb >= 0.0;
  const color = good ? green : red;
  return (
    <div className="flex items-center gap-3 rounded-full border border-gray-200 bg-white px-4 py-2 shadow-sm">
      <div className="h-8 w-8 shrink-0 rounded-full" style={{ background: color, opacity: 0.18 }} />
      <div className="text-sm">
        <div className="font-medium">{label}</div>
        <div className="text-xs text-gray-500">
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
    <div className="flex items-center gap-3">
      <div className="w-44 truncate text-sm">{tag}</div>
      <div className="flex-1">
        <div className="h-3 rounded-md" style={{ width: `${width}%`, background: color, opacity: 0.25 }} />
      </div>
      <div className="w-16 text-right text-sm">{fmt(bb)}</div>
    </div>
  );
}
