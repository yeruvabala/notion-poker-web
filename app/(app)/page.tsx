'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserClient } from '@/lib/supabase/browser';

type Parsed = {
  date?: string | null;
  stakes?: string | null;
  position?: string | null;
  cards?: string | null;
  gto_strategy?: string | null;
  exploit_deviation?: string | null;
  learning_tag?: string[];
};

export default function Page() {
  const router = useRouter();
  const supabase = createBrowserClient();

  const [checking, setChecking] = useState(true);
  const [email, setEmail] = useState<string | null>(null);

  // UI state (kept here so the content branch uses no hooks)
  const [story, setStory] = useState('');
  const [metaDate, setMetaDate] = useState<string>('');
  const [position, setPosition] = useState<string>('');
  const [stakes, setStakes] = useState<string>('');
  const [cards, setCards] = useState<string>('');
  const [gto, setGto] = useState<string>('');

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!alive) return;
      if (!data?.user) {
        router.replace('/login?redirectTo=/');
      } else {
        setEmail(data.user.email ?? null);
        setChecking(false);
      }
    });
    return () => { alive = false; };
  }, [router, supabase]);

  async function handleParse() {
    setGto('');
    try {
      const resp = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: story }),
      });
      const json: Parsed = await resp.json();
      setMetaDate(json?.date || '');
      setPosition(json?.position || '');
      setStakes(json?.stakes || '');
      setCards(json?.cards || '');
    } catch (e) {
      console.error('parse failed', e);
      alert('Parse failed. Please try again.');
    }
  }

  async function handleAnalyze() {
    try {
      const resp = await fetch('/api/analyze-hand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: metaDate,
          stakes,
          position,
          cards,
          text: story,
        }),
      });
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || 'Analyze failed');
      setGto(json?.gto_strategy || '');
    } catch (e) {
      console.error('analyze failed', e);
      alert('Analyze failed. Please try again.');
    }
  }

  if (checking) {
    return <div className="p-6 text-lg font-semibold">Only Poker</div>;
  }

  return (
    <main className="mx-auto max-w-[1200px] p-6">
      <h1 className="text-2xl font-bold mb-2">Only Poker</h1>
      {email && <p className="mb-6 text-sm text-slate-600">Signed in as {email}</p>}

      {/* Hand Played */}
      <section className="rounded-xl border bg-white p-4 shadow-sm mb-6">
        <h2 className="font-semibold mb-3">Hand Played</h2>
        <textarea
          className="w-full min-h-[150px] rounded-xl border p-3"
          value={story}
          onChange={(e) => setStory(e.target.value)}
          placeholder="Type your hand like a story — stakes, position, cards, actions…"
        />
        <div className="mt-3 flex gap-2">
          <button onClick={handleParse} className="rounded-xl bg-indigo-600 px-4 py-2 text-white">
            Send
          </button>
          <button onClick={() => setStory('')} className="rounded-xl border px-4 py-2">
            Clear
          </button>
        </div>
      </section>

      {/* Meta + GTO */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-xl border bg-white p-4 shadow-sm">
          <h3 className="font-semibold mb-3">Meta</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs text-slate-600 mb-1">Date</div>
              <input
                type="text"
                value={metaDate}
                onChange={(e) => setMetaDate(e.target.value)}
                className="w-full rounded-xl border p-2"
                placeholder="YYYY-MM-DD"
              />
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">Position</div>
              <input
                type="text"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
                className="w-full rounded-xl border p-2"
                placeholder="UTG/MP/CO/BTN/SB/BB"
              />
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">Stakes</div>
              <input
                type="text"
                value={stakes}
                onChange={(e) => setStakes(e.target.value)}
                className="w-full rounded-xl border p-2"
                placeholder="2/5, etc."
              />
            </div>
            <div>
              <div className="text-xs text-slate-600 mb-1">Cards (story)</div>
              <input
                type="text"
                value={cards}
                onChange={(e) => setCards(e.target.value)}
                className="w-full rounded-xl border p-2"
                placeholder="from parser"
              />
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-white p-4 shadow-sm">
          <h3 className="font-semibold mb-3">GTO Strategy</h3>
          <textarea
            className="w-full min-h-[120px] rounded-xl border p-3"
            value={gto}
            onChange={(e) => setGto(e.target.value)}
            placeholder="No strategy yet. Click Analyze or Edit."
          />
          <div className="mt-3 flex gap-2">
            <button onClick={handleAnalyze} className="rounded-xl border px-4 py-2">
              Analyze Again
            </button>
            <button className="rounded-xl bg-indigo-600 px-4 py-2 text-white">
              Confirm &amp; Save
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
