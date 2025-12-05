// app/api/analytics/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export const runtime = "nodejs";

type AnalyticsQuery = {
  month?: string;        // e.g. "2025-12"
  stakes?: string | null; // e.g. "10NL" (from stakes_bucket)
};

function monthBounds(ym?: string) {
  // "YYYY-MM" -> [first_day, first_day_next]
  if (!ym) {
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    return [start.toISOString().slice(0, 10), next.toISOString().slice(0, 10)];
  }
  const [y, m] = ym.split("-").map(Number);
  const start = new Date(Date.UTC(y, (m ?? 1) - 1, 1));
  const next = new Date(Date.UTC(y, (m ?? 1), 1));
  return [start.toISOString().slice(0, 10), next.toISOString().slice(0, 10)];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") || undefined;
  const stakes = searchParams.get("stakes") || null;
  const [fromDate, toDate] = monthBounds(month);

  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: () => cookieStore }
  );

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();

  if (userErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const baseFilters = `
    user_id = $1
    AND hand_date >= $2
    AND hand_date < $3
    ${stakes ? "AND stakes_bucket = $4" : ""}
  `;

  const params = stakes
    ? [user.id, fromDate, toDate, stakes]
    : [user.id, fromDate, toDate];

  const sql = {
    overview: `
      with base as (
        select result_bb, hero_position
        from public.hands_silver
        where ${baseFilters}
      ),
      win as (
        select coalesce(avg(result_bb), 0)       as winrate_bb,
               count(*)                          as total_hands
        from base
      ),
      seats as (
        select hero_position, avg(result_bb) as bb, count(*) as n
        from base
        where hero_position is not null
        group by hero_position
      ),
      weakest as (
        select hero_position, bb, n
        from seats
        order by bb asc nulls last
        limit 1
      ),
      leak as (
        select tag as learning_tag, avg(result_bb) as bb, count(*) as n
        from (
          select unnest(learning_tag) as tag, result_bb
          from public.hands_silver
          where ${baseFilters}
        ) t
        where tag is not null and tag <> ''
        group by tag
        order by bb asc nulls last
        limit 1
      )
      select
        (select winrate_bb from win)          as winrate_bb,
        (select total_hands from win)         as total_hands,
        (select hero_position from weakest)   as weakest_seat,
        (select bb from weakest)              as weakest_bb,
        (select learning_tag from leak)       as primary_leak,
        (select bb from leak)                 as primary_leak_bb;
    `,
    seatHeat: `
      select hero_position, avg(result_bb) as bb, count(*) as n
      from public.hands_silver
      where ${baseFilters}
      and hero_position is not null
      group by hero_position
      order by hero_position;
    `,
    leakImpact: `
      select tag as learning_tag, avg(result_bb) as bb, count(*) as n
      from (
        select unnest(learning_tag) as tag, result_bb
        from public.hands_silver
        where ${baseFilters}
      ) t
      where tag is not null and tag <> ''
      group by tag
      having count(*) >= 3
      order by avg(result_bb) asc nulls last
      limit 8;
    `,
    recentTrend: `
      with base as (
        select hand_date, result_bb
        from public.hands_silver
        where ${baseFilters}
        order by hand_date asc, hand_id
        limit 200
      )
      select hand_date,
             avg(result_bb) over (order by hand_date
               rows between unbounded preceding and current row) as cum_avg_bb
      from base;
    `,
  };

  // Use one round-trip each
  const { data: overview, error: e1 } = await supabase.rpc("exec_sql_json", {
    q: sql.overview,
    p: params,
  } as any);

  const { data: seats, error: e2 } = await supabase.rpc("exec_sql_json", {
    q: sql.seatHeat,
    p: params,
  } as any);

  const { data: leaks, error: e3 } = await supabase.rpc("exec_sql_json", {
    q: sql.leakImpact,
    p: params,
  } as any);

  const { data: trend, error: e4 } = await supabase.rpc("exec_sql_json", {
    q: sql.recentTrend,
    p: params,
  } as any);

  const err = e1 || e2 || e3 || e4;
  if (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

  return NextResponse.json({
    overview: overview?.[0] ?? null,
    seats: seats ?? [],
    leaks: leaks ?? [],
    trend: trend ?? [],
  });
}
