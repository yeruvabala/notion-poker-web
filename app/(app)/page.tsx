'use client';

import { useState } from 'react';

// types (keep it local for simplicity)
type Fields = {
  date?: string | null;
  stakes?: string | null;
  position?: string | null;
  cards?: string | null;
  board?: string | null;
  gto_strategy?: string | null;
  exploit_deviation?: string | null;
  learning_tag?: string[];
};

export default function Page() {
  // ----------------- UI state -----------------
  const [story, setStory] = useState('');
  const [mode, setMode] = useState<'Cash' | 'MTT'>('Cash');
  const [positions, setPositions] = useState('BTN vs BB');
  const [stakes, setStakes] = useState('');
  const [effStack, setEffStack] = useState(''); // free text (bb)
  const [heroCards, setHeroCards] = useState('K♠ K♦'); // free text
  const [board, setBoard] = useState('J♣ T♠ 4♦ / 9♣ / 3♣'); // free text

  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [position, setPosition] = useState<string>(''); // optional
  const [storyCards, setStoryCards] = useState<string>(''); // optional, separate from heroCards if you want

  const [gtoText, setGtoText] = useState('');
  const [gtoEditing, setGtoEditing] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // ----------------- Helpers -----------------
  function toast(e: unknown) {
    setErr((e as any)?.message || 'Something went wrong');
    setTimeout(() => setErr(null), 4000);
  }

  function fieldsForLLM(): Fields {
    return {
      date,
      stakes: stakes || null,
      position: position || null,
      cards: heroCards || null,
      board: board || null,
      gto_strategy: gtoText || null,
      exploit_deviation: null,
      learning_tag: [],
    };
  }

  // ----------------- Actions -----------------

  // Parse the free-text story -> summary fields (server /api/parse)
  async function onParse() {
    if (!story.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(story),
      });

      if (!res.ok) throw new Error(`Parse failed (${res.status})`);
      const json = await res.json();

      // Safely pluck fields if present
      if (json?.stakes) setStakes(json.stakes);
      if (json?.position) setPosition(json.position);
      if (json?.cards) setStoryCards(json.cards);
      if (json?.board) setBoard(json.board);
      if (json?.date) setDate(json.date);
    } catch (e) {
      toast(e);
    } finally {
      setBusy(false);
    }
  }

  // Sync “story parse” into the editable summary (just a helper for you)
  function onSyncFromStory() {
    if (storyCards && !heroCards) setHeroCards(storyCards);
    // leave other values as-is since we already assign them in onParse
  }

  // Ask LLM for GTO strategy using your /api/analyze-hand
  async function onAnalyze() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/analyze-hand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fieldsForLLM()),
      });
      const json = await res.json();
      if (!res.ok || json?.error) {
        throw new Error(json?.error || `Analyze failed (${res.status})`);
      }
      setGtoText(json.gto_strategy || '(no output)');
    } catch (e) {
      toast(e);
    } finally {
      setBusy(false);
    }
  }

  // Optional: save to Notion if you implemented /api/notion
  async function onSave() {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch('/api/notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fieldsForLLM()),
      });
      const json = await res.json();
      if (!res.ok || json?.error) throw new Error(json?.error || 'Save failed');
      // success — optionally show a toast or link
    } catch (e) {
      toast(e);
    } finally {
      setBusy(false);
    }
  }

  // ----------------- UI -----------------
  return (
    <main className="px-6 py-6">
      <h1 className="mb-2 text-2xl font-semibold tracking-tight">Only Poker</h1>

      {/* error toast */}
      {err && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </div>
      )}

      {/* Hand Played */}
      <section className="mb-6 rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Hand Played</h2>
        <textarea
          className="h-40 w-full rounded-xl border p-3 outline-none"
          placeholder="Type your hand like a story — stakes, position, cards, actions…"
          value={story}
          onChange={(e) => setStory(e.target.value)}
        />
        <div className="mt-3 flex gap-2">
          <button
            onClick={onParse}
            disabled={busy || !story.trim()}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-white disabled:opacity-60"
          >
            {busy ? 'Working…' : 'Send'}
          </button>
          <button
            onClick={onSyncFromStory}
            disabled={busy}
            className="rounded-xl border px-3 py-2"
          >
            Sync from Story
          </button>
          <button
            onClick={() => {
              setStory('');
              setErr(null);
            }}
            disabled={busy}
            className="rounded-xl border px-3 py-2"
          >
            Clear
          </button>
        </div>
      </section>

      {/* Meta + Strategy */}
      <div className="mb-6 grid gap-6 md:grid-cols-3">
        <section className="rounded-2xl border bg-white p-4 shadow-sm md:col-span-1">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Meta</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-slate-500">Date</label>
              <input
                type="date"
                className="w-full rounded-xl border px-3 py-2"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-500">Position</label>
              <input
                className="w-full rounded-xl border px-3 py-2"
                placeholder="(unknown)"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-500">Stakes</label>
              <input
                className="w-full rounded-xl border px-3 py-2"
                placeholder="(unknown)"
                value={stakes}
                onChange={(e) => setStakes(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-slate-500">Cards (story)</label>
              <input
                className="w-full rounded-xl border px-3 py-2"
                placeholder="(from parser)"
                value={storyCards}
                onChange={(e) => setStoryCards(e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-4 shadow-sm md:col-span-2">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">GTO Strategy</h2>

          {!gtoEditing ? (
            <div className="rounded-xl border p-3 text-slate-700 min-h-[84px]">
              {gtoText || 'No strategy yet. Click Analyze or Edit.'}
            </div>
          ) : (
            <textarea
              className="h-24 w-full rounded-xl border p-3"
              value={gtoText}
              onChange={(e) => setGtoText(e.target.value)}
            />
          )}

          <div className="mt-3 flex gap-2">
            <button
              onClick={onAnalyze}
              disabled={busy}
              className="rounded-xl border px-3 py-2"
            >
              {busy ? 'Analyzing…' : 'Analyze Again'}
            </button>

            <button
              onClick={() => setGtoEditing((v) => !v)}
              className="rounded-xl border px-3 py-2"
            >
              {gtoEditing ? 'Done' : 'Edit'}
            </button>

            <button
              onClick={onSave}
              disabled={busy}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-white disabled:opacity-60"
            >
              Confirm &amp; Save
            </button>
          </div>
        </section>
      </div>

      {/* Situation Summary */}
      <section className="mb-6 rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Situation Summary</h2>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="space-y-1">
            <label className="text-xs text-slate-500">Mode</label>
            <select
              className="w-full rounded-xl border px-3 py-2"
              value={mode}
              onChange={(e) => setMode(e.target.value as 'Cash' | 'MTT')}
            >
              <option value="Cash">Cash</option>
              <option value="MTT">MTT</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-500">Blinds / Stakes</label>
            <input
              className="w-full rounded-xl border px-3 py-2"
              placeholder="e.g., 2/5"
              value={stakes}
              onChange={(e) => setStakes(e.target.value)}
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs text-slate-500">Eff Stack (optional, bb)</label>
            <input
              className="w-full rounded-xl border px-3 py-2"
              placeholder="e.g., 70"
              value={effStack}
              onChange={(e) => setEffStack(e.target.value)}
            />
          </div>

          <div className="space-y-1 md:col-span-1">
            <label className="text-xs text-slate-500">Positions</label>
            <input
              className="w-full rounded-xl border px-3 py-2"
              placeholder="BTN vs BB"
              value={positions}
              onChange={(e) => setPositions(e.target.value)}
            />
          </div>

          <div className="space-y-1 md:col-span-1">
            <label className="text-xs text-slate-500">Hero</label>
            <input
              className="w-full rounded-xl border px-3 py-2"
              placeholder="K♠ K♦"
              value={heroCards}
              onChange={(e) => setHeroCards(e.target.value)}
            />
          </div>

          <div className="space-y-1 md:col-span-1">
            <label className="text-xs text-slate-500">Board</label>
            <input
              className="w-full rounded-xl border px-3 py-2"
              placeholder="J♣ T♠ 4♦ / 9♣ / 3♣"
              value={board}
              onChange={(e) => setBoard(e.target.value)}
            />
          </div>
        </div>

        <p className="mt-2 text-xs text-slate-500">
          Source: Using story parse. Postflop: add exact suits (e.g., As 4s) for accuracy. “Sync from
          Story” copies the parse below.
        </p>
      </section>

      {/* Fold-Equity & SPR — static helpers for now */}
      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Fold-Equity Threshold &amp; SPR</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border p-3 text-sm text-slate-700">
            FE calc (bb units): Risk / (Risk + Reward)
          </div>
          <div className="rounded-xl border p-3 text-sm text-slate-700">
            SPR buckets: ≤2 / 2–5 / 5+
          </div>
        </div>
      </section>
    </main>
  );
}
