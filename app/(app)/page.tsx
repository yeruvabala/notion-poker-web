'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/browser';

type Parsed = {
  date?: string | null;
  stakes?: string | null;
  position?: string | null;
  cards?: string | null;
  board?: string | null;
  learning_tag?: string[];
};

export default function Page() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);
  const [ready, setReady] = useState(false);

  // ---------- auth guard ----------
  useEffect(() => {
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      if (!data.session) router.replace('/login?redirectTo=/');
      else setReady(true);
    });
    return () => { alive = false; };
  }, [router, supabase]);

  // while checking session
  if (!ready) return <div className="p-6 text-lg font-semibold">Only Poker</div>;

  // ---------- UI state ----------
  const [story, setStory] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // meta
  const [date, setDate] = useState<string>('');
  const [storyCards, setStoryCards] = useState<string>('');
  const [stakes, setStakes] = useState<string>('');
  const [position, setPosition] = useState<string>('BTN vs BB');
  const [board, setBoard] = useState<string>('');

  // situation summary
  const [mode, setMode] = useState<'Cash' | 'MTT'>('Cash');
  const [hero, setHero] = useState<string>('A♠ K♦');
  const [blinds, setBlinds] = useState<string>('');
  const [effStack, setEffStack] = useState<string>('');

  // outputs
  const [gto, setGto] = useState<string>('');
  const [exploit, setExploit] = useState<string>('');

  function clearAll() {
    setErr(null);
    setStory('');
    setGto('');
    setExploit('');
    setDate('');
    setStakes('');
    setPosition('BTN vs BB');
    setStoryCards('');
    setBoard('');
    setHero('A♠ K♦');
    setBlinds('');
    setEffStack('');
  }

  // ---------- actions ----------
  async function onParse() {
    if (!story.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(story), // accepts string or {input}
      });
      const json: Parsed & { error?: string } = await res.json();
      if (!res.ok) throw new Error(json?.error || `Parse failed (${res.status})`);

      if (json.date) setDate(json.date);
      if (json.stakes !== undefined) setStakes(json.stakes || '');
      if (json.position !== undefined) setPosition(json.position || '');
      if (json.cards !== undefined) setStoryCards(json.cards || '');
      if (json.board !== undefined) setBoard(json.board || '');
    } catch (e: any) {
      setErr(e?.message || 'Parse failed');
    } finally {
      setBusy(false);
    }
  }

  async function onAnalyze() {
    setBusy(true);
    setErr(null);
    try {
      const body = {
        text: story,
        mode,
        icm_context: false,
        eff_bb: effStack ? Number(effStack) : null,
        blinds,
        board,
        hero_cards: hero || storyCards,
        meta: { date, stakes, position, cards: storyCards },
      };

      const res = await fetch('/api/analyze-hand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || `Analyze failed (${res.status})`);

      setGto(json?.gto_strategy || '');
      setExploit(json?.exploit_deviation || '');
    } catch (e: any) {
      setErr(e?.message || 'Analyze failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1200px] px-6 py-6">
      <h1 className="text-2xl font-semibold tracking-tight mb-4">Only Poker</h1>

      {/* Hand Played */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm mb-4">
        <p className="font-medium mb-2">Hand Played</p>
        <textarea
          className="h-32 w-full resize-y rounded-xl border p-3 outline-none"
          placeholder="Type your hand like a story — stakes, position, cards, actions…"
          value={story}
          onChange={(e) => setStory(e.target.value)}
        />
        <div className="mt-3 flex gap-2">
          <button
            disabled={busy || !story.trim()}
            onClick={onParse}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-white disabled:opacity-60"
          >
            {busy ? 'Working…' : 'Send'}
          </button>
          <button
            disabled={busy}
            onClick={onParse}
            className="rounded-xl border px-4 py-2"
            title="Parse from story into fields below"
          >
            Sync from Story
          </button>
          <button
            disabled={busy}
            onClick={clearAll}
            className="rounded-xl border px-4 py-2"
          >
            Clear
          </button>
        </div>
        {err && <div className="mt-2 text-sm text-red-600">{err}</div>}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Meta */}
        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="font-medium mb-3">Meta</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-600">Date</label>
              <input
                type="date"
                value={date || ''}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 w-full rounded-xl border p-2"
              />
            </div>
            <div>
              <label className="text-xs text-slate-600">Position</label>
              <input
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                placeholder="(unknown)"
                className="mt-1 w-full rounded-xl border p-2"
              />
            </div>
            <div>
              <label className="text-xs text-slate-600">Stakes</label>
              <input
                value={stakes}
                onChange={(e) => setStakes(e.target.value)}
                placeholder="(unknown)"
                className="mt-1 w-full rounded-xl border p-2"
              />
            </div>
            <div>
              <label className="text-xs text-slate-600">Cards (story)</label>
              <input
                value={storyCards}
                onChange={(e) => setStoryCards(e.target.value)}
                placeholder="(from parser)"
                className="mt-1 w-full rounded-xl border p-2"
              />
            </div>
          </div>
        </section>

        {/* GTO Strategy */}
        <section className="rounded-2xl border bg-white p-4 shadow-sm">
          <p className="font-medium mb-3">GTO Strategy</p>
          <div className="rounded-xl border bg-slate-50 p-3 min-h-[64px] text-sm">
            {gto || 'No strategy yet. Click Analyze or Edit.'}
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={onAnalyze}
              disabled={busy}
              className="rounded-xl border px-4 py-2"
            >
              {busy ? 'Analyzing…' : 'Analyze Again'}
            </button>
            <button
              onClick={() => {
                const t = prompt('Edit GTO Strategy:', gto || '');
                if (t !== null) setGto(t);
              }}
              className="rounded-xl border px-4 py-2"
            >
              Edit
            </button>
            <button className="rounded-xl bg-indigo-600 px-4 py-2 text-white">
              Confirm & Save
            </button>
          </div>
        </section>
      </div>

      {/* Situation Summary */}
      <section className="mt-4 rounded-2xl border bg-white p-4 shadow-sm">
        <p className="font-medium mb-3">Situation Summary</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-slate-600">Mode</label>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as any)}
              className="mt-1 w-full rounded-xl border p-2"
            >
              <option>Cash</option>
              <option>MTT</option>
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-600">Blinds / Stakes</label>
            <input
              value={blinds}
              onChange={(e) => setBlinds(e.target.value)}
              placeholder="e.g., 2/5"
              className="mt-1 w-full rounded-xl border p-2"
            />
          </div>
          <div>
            <label className="text-xs text-slate-600">Eff Stack (optional, bb)</label>
            <input
              value={effStack}
              onChange={(e) => setEffStack(e.target.value)}
              placeholder="e.g., 70"
              className="mt-1 w-full rounded-xl border p-2"
            />
          </div>
          <div>
            <label className="text-xs text-slate-600">Hero</label>
            <input
              value={hero}
              onChange={(e) => setHero(e.target.value)}
              placeholder="A♠ K♦"
              className="mt-1 w-full rounded-xl border p-2"
            />
          </div>
          <div className="xl:col-span-4">
            <label className="text-xs text-slate-600">Board</label>
            <input
              value={board}
              onChange={(e) => setBoard(e.target.value)}
              placeholder="J♣ T♦ 4♠ / 9♣ / 3♣"
              className="mt-1 w-full rounded-xl border p-2"
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Source: Using story parse. Postflop: add exact suits (e.g., As 4s) for accuracy.
          “Sync from Story” copies the parse below.
        </p>
      </section>

      {/* Exploits (optional area – currently shows whatever analyze sets) */}
      <section className="mt-4 rounded-2xl border bg-white p-4 shadow-sm">
        <p className="font-medium mb-3">Exploitative Deviations</p>
        <div className="rounded-xl border bg-slate-50 p-3 min-h-[48px] text-sm">
          {exploit || '—'}
        </div>
      </section>
    </div>
  );
}
