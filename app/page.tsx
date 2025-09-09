'use client';

import React, { useMemo, useState } from 'react';

// --------- Helpers ---------
const SUIT_ICON: Record<string, string> = { h: '♥', d: '♦', c: '♣', s: '♠' };
function suitColor(s: string) {
  return s === 'h' || s === 'd' ? 'text-rose-600' : 'text-slate-800';
}
function prettyCard(raw: string) {
  if (!raw) return '—';
  const m = raw.trim().toLowerCase().match(/^(10|[2-9]|[akqjt])([shdc])$/i);
  if (!m) return raw.toUpperCase();
  const rank = m[1].toUpperCase().replace('T', '10');
  const suit = m[2].toLowerCase();
  return `${rank}${SUIT_ICON[suit] ?? ''}`;
}

function parseCardList(input: string): string[] {
  // Accept: "ks 7d 2c" or "K♠ 7♦ 2♣" etc.
  const cleaned = input
    .replace(/[♠♣♥♦]/g, (ch) => ({ '♠': 's', '♣': 'c', '♥': 'h', '♦': 'd' }[ch] as string))
    .replace(/\u00A0/g, ' ')
    .toLowerCase();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  for (const t of tokens) {
    const m = t.match(/^(10|[2-9]|[akqjt])([shdc])$/i);
    if (m) out.push(`${m[1].toLowerCase()}${m[2].toLowerCase()}`);
    if (out.length === 3) break;
  }
  return out;
}

function parseSingleCard(input: string): string | undefined {
  const [c] = parseCardList(input);
  return c;
}

function chip(text: React.ReactNode) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
      {text}
    </span>
  );
}

// --------- Page ---------
export default function PokerStudyHandEntry() {
  // Natural language text (left)
  const [handText, setHandText] = useState(
    '2/5 Live — BTN with Ah Qs. Opened $15, BB 3-bet $50, I called. Flop Ks 7d 2c, villain c-bet $30 into $100, I folded. Turn 9c. River 4h.'
  );

  // Quick Assist manual board (user controlled)
  const [flopInput, setFlopInput] = useState('Ks 7d 2c');
  const [turnInput, setTurnInput] = useState('9c');
  const [riverInput, setRiverInput] = useState('4h');

  // Parsed/preview fields (right)
  const [cards, setCards] = useState<string>('T♥ A♥'); // header cards; purely cosmetic header example
  const [position, setPosition] = useState<string>('BTN');
  const [stakes, setStakes] = useState<string>('2/5');
  const [villainAction, setVillainAction] = useState<string>('villain c-bet $30 into $100, I folded. Turn 9c. River 4h.');
  const [gtoBaseline, setGtoBaseline] = useState<string>(
    'Based on common solver heuristics for similar nodes. Connect a solver later to replace with exact frequencies.'
  );
  const [exploits, setExploits] = useState<string[]>([
    'Adjust c-bet sizing upward vs calling stations; reduce bluffs.',
    'Float wider vs range-wide 1/3 c-bets with backdoors/blockers.',
    'Fold more vs large turn barrels in pools that underbluff turns.',
  ]);

  // Derived board (manual input has priority)
  const flop3 = useMemo(() => parseCardList(flopInput), [flopInput]);
  const turn1 = useMemo(() => parseSingleCard(turnInput), [turnInput]);
  const river1 = useMemo(() => parseSingleCard(riverInput), [riverInput]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // ---- Actions ----
  async function analyze() {
    try {
      const res = await fetch('/api/analyze-hand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: handText }),
      });
      const data = await res.json();

      // If your API returns ui fields like earlier, wire them here:
      if (data?.ui) {
        setStakes(data.ui.stakes && data.ui.stakes !== '—' ? data.ui.stakes : stakes);
        setPosition(data.ui.position && data.ui.position !== '—' ? data.ui.position : position);
        // Show cards in header if present; otherwise keep current example
        if (data.ui.cards && data.ui.cards !== '—') setCards(data.ui.cards);
        if (data.ui.villain_action) setVillainAction(data.ui.villain_action);

        // If board came back, prefill the quick-assist fields (user can edit after)
        const b = data.parsed?.board;
        if (b?.flop?.length === 3) setFlopInput(b.flop.join(' '));
        if (b?.turn) setTurnInput(b.turn);
        if (b?.river) setRiverInput(b.river);
      }
    } catch (e) {
      // no-op on error; UI still works with manual board entry
      console.error('analyze failed', e);
    }
  }

  async function saveToNotion() {
    // Build the authoritative board from the Quick Assist inputs:
    const payload = {
      date: today,
      stakes,
      position,
      cards,
      villain_action: villainAction,
      gto_strategy: gtoBaseline, // replace with your real GTO content
      exploit_deviation: exploits.join(' • '),
      board: {
        flop: flop3,
        turn: turn1,
        river: river1,
      },
      hand_text: handText,
    };

    try {
      await fetch('/api/save-to-notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      alert('Saved to Notion (if your API is wired).');
    } catch (e) {
      console.error(e);
      alert('Tried to save. Check API wiring in /api/save-to-notion.');
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 p-6 text-slate-800">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <header className="flex items-center justify-between">
          <h1 className="text-3xl font-semibold tracking-tight">Poker Study — Hand Entry</h1>
        </header>

        {/* Layout */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left column */}
          <div className="space-y-6">
            {/* Natural Language Entry */}
            <section className="rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur">
              <div className="border-b border-slate-200 p-4">
                <h2 className="text-sm font-semibold text-slate-600">Hand Entry (Natural Language)</h2>
              </div>
              <div className="p-4">
                <textarea
                  value={handText}
                  onChange={(e) => setHandText(e.target.value)}
                  className="h-40 w-full resize-none rounded-lg border border-slate-200 bg-slate-50/70 p-3 font-mono text-[13px] outline-none focus:border-slate-300"
                  placeholder="Paste the hand history or describe the hand in plain English…"
                />
                <div className="mt-3 flex gap-10">
                  <button
                    onClick={analyze}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800"
                  >
                    Analyze
                  </button>
                  <button
                    onClick={() => {
                      setHandText('');
                      setFlopInput('');
                      setTurnInput('');
                      setRiverInput('');
                    }}
                    className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700 shadow hover:bg-slate-200"
                  >
                    Clear
                  </button>
                </div>
              </div>
            </section>

            {/* Quick Card Assist */}
            <section className="rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur">
              <div className="border-b border-slate-200 p-4">
                <h2 className="text-sm font-semibold text-slate-600">Quick Card Assist (optional)</h2>
              </div>
              <div className="p-4">
                <div className="grid gap-3 md:grid-cols-3">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Flop (3 cards)</label>
                    <input
                      value={flopInput}
                      onChange={(e) => setFlopInput(e.target.value)}
                      placeholder="Ks 7d 2c"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">Turn</label>
                    <input
                      value={turnInput}
                      onChange={(e) => setTurnInput(e.target.value)}
                      placeholder="9c"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-slate-500">River</label>
                    <input
                      value={riverInput}
                      onChange={(e) => setRiverInput(e.target.value)}
                      placeholder="4h"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                    />
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  If parsing guesses wrong, correct the board here — the preview updates instantly.
                </p>
              </div>
            </section>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            {/* Summary (stakes • position • cards + fields) */}
            <section className="rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur">
              <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  {chip(stakes)}
                  {chip(position)}
                  {chip(cards)}
                </div>
                <div className="text-sm text-slate-500">{today}</div>
              </div>
              <div className="grid gap-4 p-4 md:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Cards</label>
                  <div className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm">{cards}</div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Stakes</label>
                  <div className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm">{stakes}</div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Position</label>
                  <div className="w-full rounded-lg border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm">{position}</div>
                </div>
                <div className="md:col-span-2">
                  <label className="mb-1 block text-xs font-semibold text-slate-500">Villain Action</label>
                  <textarea
                    value={villainAction}
                    onChange={(e) => setVillainAction(e.target.value)}
                    className="h-20 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                    placeholder="villain action summary…"
                  />
                </div>
              </div>
            </section>

            {/* Board Preview */}
            <section className="rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur">
              <div className="border-b border-slate-200 p-4">
                <h2 className="text-sm font-semibold text-slate-600">Board</h2>
              </div>
              <div className="flex flex-wrap items-center gap-4 p-4">
                {/* Flop */}
                <div>
                  <div className="text-xs font-semibold text-slate-500">Flop:</div>
                  <div className="mt-1 flex gap-2">
                    {flop3.length === 3
                      ? flop3.map((c, idx) => {
                          const s = c.slice(-1);
                          return (
                            <span
                              key={idx}
                              className={`inline-flex items-center rounded-lg bg-slate-100 px-3 py-1 text-sm font-semibold ${suitColor(
                                s
                              )}`}
                            >
                              {prettyCard(c)}
                            </span>
                          );
                        })
                      : chip('— — —')}
                  </div>
                </div>

                {/* Turn */}
                <div>
                  <div className="text-xs font-semibold text-slate-500">Turn:</div>
                  <div className="mt-1">
                    {turn1 ? (
                      <span
                        className={`inline-flex items-center rounded-lg bg-slate-100 px-3 py-1 text-sm font-semibold ${suitColor(
                          (turn1 as string).slice(-1)
                        )}`}
                      >
                        {prettyCard(turn1)}
                      </span>
                    ) : (
                      chip('—')
                    )}
                  </div>
                </div>

                {/* River */}
                <div>
                  <div className="text-xs font-semibold text-slate-500">River:</div>
                  <div className="mt-1">
                    {river1 ? (
                      <span
                        className={`inline-flex items-center rounded-lg bg-slate-100 px-3 py-1 text-sm font-semibold ${suitColor(
                          (river1 as string).slice(-1)
                        )}`}
                      >
                        {prettyCard(river1)}
                      </span>
                    ) : (
                      chip('—')
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* GTO Baseline */}
            <section className="rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur">
              <div className="border-b border-slate-200 p-4">
                <h2 className="text-sm font-semibold text-slate-600">GTO Baseline (approx)</h2>
              </div>
              <div className="p-4">
                <textarea
                  value={gtoBaseline}
                  onChange={(e) => setGtoBaseline(e.target.value)}
                  className="h-24 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-slate-300"
                />
              </div>
            </section>

            {/* Exploitative Deviations */}
            <section className="rounded-2xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur">
              <div className="border-b border-slate-200 p-4">
                <h2 className="text-sm font-semibold text-slate-600">Exploitative Deviations</h2>
              </div>
              <div className="p-4">
                <ul className="list-disc space-y-1 pl-5 text-sm">
                  {exploits.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            </section>

            {/* Footer actions */}
            <div className="flex flex-wrap gap-3 pt-2">
              <button
                onClick={analyze}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow hover:bg-slate-50"
              >
                Analyze Again
              </button>
              <button
                onClick={saveToNotion}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow hover:bg-slate-800"
              >
                Confirm &amp; Save to Notion
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
