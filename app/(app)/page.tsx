// app/(app)/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/browser';

export default function Page() {
  const router = useRouter();
  const supabase = createBrowserClient();

  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;

      if (!data.session) {
        router.replace('/login?redirectTo=/');
        return;
      }

      const { data: u } = await supabase.auth.getUser();
      setEmail(u.user?.email ?? null);
      setReady(true);
    })();

    return () => {
      mounted = false;
    };
  }, [router, supabase]);

  // Small branded skeleton while we check session
  if (!ready) {
    return <div className="p-6 text-lg font-semibold">Only Poker</div>;
  }

  return (
    <main className="p-6">
      <h1 className="text-3xl font-bold tracking-tight mb-6">Only Poker</h1>
      <p className="mb-6 text-slate-600">Signed in as <b>{email ?? 'unknown'}</b></p>

      {/* === Two-column layout (left 2 / right 1) === */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        {/* Left column */}
        <div className="xl:col-span-2 space-y-6">
          <section className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-slate-700">Hand Played</div>
            <textarea
              className="w-full rounded-xl border p-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200"
              rows={7}
              placeholder={`Type your hand like a story — stakes, position, cards, actions…

Example:
Cash 6-max 100bb. BTN (Hero) 2.3x, BB calls.
Flop 6♣ 6♦ 2♦ — bet 50%, call.
Turn K♦ — …`}
            />
            <div className="mt-4 flex gap-2">
              <button className="rounded-xl bg-indigo-600 px-3 py-2 text-white text-sm">Send</button>
              <button className="rounded-xl bg-slate-100 px-3 py-2 text-sm">Sync from Story</button>
              <button className="rounded-xl bg-slate-100 px-3 py-2 text-sm">Clear</button>
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-slate-700">Situation Summary</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div className="rounded-xl border p-3 text-sm">Mode: <b>Cash</b></div>
              <div className="rounded-xl border p-3 text-sm">Blinds / Stakes: <b>(unknown)</b></div>
              <div className="rounded-xl border p-3 text-sm">Eff Stack: <b>(optional)</b></div>
              <div className="rounded-xl border p-3 text-sm">Positions: <b>BTN vs BB</b></div>
              <div className="rounded-xl border p-3 text-sm">Hero: <b>K♠ K♦</b></div>
              <div className="rounded-xl border p-3 text-sm">Board: <b>J♣ T♣ 4♦ / 9♣ / 3♣</b></div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Source: Using story parse. Postflop: add exact suits (e.g., As 4s) for accuracy. “Sync from Story” copies the parse below.
            </p>
          </section>

          <section className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-slate-700">Fold-Equity Threshold & SPR</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border p-3 text-sm">FE calc (bb units): Risk / (Risk + Reward)</div>
              <div className="rounded-xl border p-3 text-sm">SPR buckets: ≤2 / 2–5 / 5+</div>
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="xl:col-span-1 space-y-6">
          <section className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-slate-700">Meta</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border p-3 text-sm">
                <div className="text-slate-500 text-xs">Date</div><div>2025-10-03</div>
              </div>
              <div className="rounded-xl border p-3 text-sm">
                <div className="text-slate-500 text-xs">Position</div><div>(unknown)</div>
              </div>
              <div className="rounded-xl border p-3 text-sm">
                <div className="text-slate-500 text-xs">Stakes</div><div>(unknown)</div>
              </div>
              <div className="rounded-xl border p-3 text-sm">
                <div className="text-slate-500 text-xs">Cards</div><div>(unknown)</div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-slate-700">GTO Strategy</div>
            <div className="rounded-xl border border-dashed p-3 text-slate-500">
              No strategy yet. Click Analyze or Edit.
            </div>
            <p className="mt-2 text-xs text-slate-500">Preview only. Click “Edit” to change the text.</p>
            <div className="mt-4">
              <button className="rounded-xl border px-3 py-2 text-sm">Edit</button>
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="mb-3 text-sm font-semibold text-slate-700">Exploitative Deviations</div>
            <div className="flex gap-2 justify-end">
              <button className="rounded-xl bg-slate-100 px-3 py-2 text-sm">Analyze Again</button>
              <button className="rounded-xl bg-indigo-600 px-3 py-2 text-white text-sm">Confirm &amp; Save</button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
