// app/(app)/study/page.tsx
'use client';

import "@/styles/onlypoker-theme.css";
import React, { useMemo, useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { createClient } from '@/lib/supabase/client';
import MobileStudyPage from './mobile-page';

type StudyDrill = {
  id?: string;
  question: string;
  answer?: string;
  explanation?: string;
};

type StudyChunk = {
  id: string;
  source_type?: string | null;
  title?: string | null;
  preview?: string | null;
  content: string;
  stakes_bucket?: string | null;
  position_norm?: string | null;
  street?: string | null;
  tags?: string[] | null;
};

type CoachAnswer = {
  summary?: string | null;
  rules?: string[] | null;
  drills?: StudyDrill[] | null;
};

type StudyAnswerResponse = {
  coach?: CoachAnswer | null;
  chunks?: StudyChunk[] | null;
};

const RANGE_OPTIONS = [
  { value: '1k', label: 'Last 1K hands' },
  { value: '10k', label: 'Last 10K hands' },
  { value: 'all', label: 'All time' },
];

const STAKES_OPTIONS = [
  { value: 'any', label: 'Any stakes' },
  { value: '5NL', label: '5NL and below' },
  { value: '10NL', label: '10NL' },
  { value: '25NL', label: '25NL' },
  { value: '50NL', label: '50NL+' },
];

const POSITION_OPTIONS = [
  { value: 'any', label: 'Any position' },
  { value: 'UTG', label: 'UTG' },
  { value: 'HJ', label: 'HJ' },
  { value: 'CO', label: 'CO' },
  { value: 'BTN', label: 'BTN' },
  { value: 'SB', label: 'SB' },
  { value: 'BB', label: 'BB' },
];

const STREET_OPTIONS = [
  { value: 'any', label: 'Any street' },
  { value: 'preflop', label: 'Preflop' },
  { value: 'flop', label: 'Flop' },
  { value: 'turn', label: 'Turn' },
  { value: 'river', label: 'River' },
];

export default function StudyPage() {
  // Mobile detection - render mobile page on native platforms OR mobile browsers
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const isNative = Capacitor.isNativePlatform();
    const isMobileBrowser = typeof window !== 'undefined' && window.innerWidth < 768;
    setIsMobile(isNative || isMobileBrowser);
  }, []);

  if (isMobile) {
    return <MobileStudyPage />;
  }

  // Avoid “Multiple GoTrueClient instances” warning
  const supabase = useMemo(() => createClient(), []);

  const [question, setQuestion] = useState('');
  const [range, setRange] = useState('10k');
  const [stakes, setStakes] = useState('10NL');
  const [position, setPosition] = useState('BTN');
  const [street, setStreet] = useState('any');

  const [coach, setCoach] = useState<CoachAnswer | null>(null);
  const [chunks, setChunks] = useState<StudyChunk[]>([]);
  const [activeDrillIndex, setActiveDrillIndex] = useState(0);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleAskCoach() {
    if (!question.trim()) {
      setErrorMsg('Type a question or describe a spot first.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      // 1) Get Supabase session so we can send the access token to the API
      const {
        data: { session },
        error: sErr,
      } = await supabase.auth.getSession();

      if (sErr) throw new Error(`Supabase error: ${sErr.message}`);
      if (!session) throw new Error('Please sign in to ask the coach.');

      const accessToken = session.access_token;

      const body = {
        q: question.trim(),
        range,
        stakes: stakes === 'any' ? null : stakes,
        position: position === 'any' ? null : position,
        street: street === 'any' ? null : street,
      };

      const res = await fetch('/api/study/answer', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(body),
      });

      if (res.status === 401) {
        throw new Error('Unauthorized. Please sign in again.');
      }

      const data = (await res.json()) as StudyAnswerResponse;

      if (!res.ok) {
        const msg =
          (data as any)?.error ||
          (data as any)?.message ||
          `Request failed with status ${res.status}`;
        throw new Error(msg);
      }

      const coachPayload = data.coach || {};
      const chunkPayload = data.chunks || [];

      setCoach(coachPayload);
      setChunks(chunkPayload as StudyChunk[]);
      setActiveDrillIndex(0);
    } catch (err: any) {
      console.error('Ask coach error', err);
      setErrorMsg(err?.message || 'Something went wrong asking the coach.');
    } finally {
      setLoading(false);
    }
  }

  const drills: StudyDrill[] = (coach?.drills || []) as StudyDrill[];
  const activeDrill =
    drills.length > 0 ? drills[Math.min(activeDrillIndex, drills.length - 1)] : null;

  function nextDrill() {
    if (!drills.length) return;
    setActiveDrillIndex((idx) => (idx + 1) % drills.length);
  }

  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 op-surface text-[#f3f4f6]">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        {/* Page header */}
        <header style={{ textAlign: 'center', marginBottom: 24, marginTop: 0 }}>
          <h1 className="homepage-title">Study</h1>
          {/* Card Suit Decorations with Shimmer */}
          <div className="suit-decoration">
            <span>♠</span>
            <span>♥</span>
            <span>♦</span>
            <span>♣</span>
          </div>
        </header>

        {/* Smart Search Header */}
        <section className="p-6 platinum-inner-border">
          <div className="flex flex-col gap-5">
            {/* Question input */}
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-[#737373]">
                Focus or question
              </label>
              <textarea
                rows={2}
                className="w-full px-4 py-3 text-sm outline-none transition disabled:opacity-50 platinum-inner-border bg-[#262626] text-[#E2E8F0] rounded-lg"
                placeholder="Ask a question or focus on a leak… e.g. “Why am I losing calling 3bets OOP?”"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
            </div>

            {/* Quick Topic Buttons */}
            <div className="flex flex-wrap gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#555] self-center mr-1">Quick topics:</span>
              {[
                { label: '3-Betting', query: 'How should I construct my 3-betting range?' },
                { label: 'C-Bet Strategy', query: 'When should I continuation bet and when should I check?' },
                { label: 'River Decisions', query: 'How do I make better river decisions with marginal hands?' },
                { label: 'Bluff Catching', query: 'When should I call down as a bluff catcher?' },
                { label: 'SB Defense', query: 'How should I defend my small blind vs button opens?' },
                { label: 'BTN Play', query: 'What are the key strategies for playing from the button?' },
              ].map((topic) => (
                <button
                  key={topic.label}
                  type="button"
                  onClick={() => setQuestion(topic.query)}
                  className="px-3 py-1.5 text-xs font-medium rounded-full border border-[#333] bg-[#1a1a1a] text-[#a3a3a3] hover:bg-[#252525] hover:text-white hover:border-[#444] transition-all"
                >
                  {topic.label}
                </button>
              ))}
            </div>

            {/* Filters + button row */}
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Range', val: range, set: setRange, opts: RANGE_OPTIONS },
                  { label: 'Stakes', val: stakes, set: setStakes, opts: STAKES_OPTIONS },
                  { label: 'Position', val: position, set: setPosition, opts: POSITION_OPTIONS },
                  { label: 'Street', val: street, set: setStreet, opts: STREET_OPTIONS },
                ].map((filter) => (
                  <div key={filter.label} className="flex items-center gap-2 px-2 py-1.5 shadow-sm platinum-inner-border bg-[#141414] rounded-lg">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#666]">
                      {filter.label}
                    </span>
                    <select
                      className="bg-transparent text-xs text-[#e5e5e5] font-medium outline-none cursor-pointer hover:text-white transition"
                      value={filter.val}
                      onChange={(e) => filter.set(e.target.value)}
                    >
                      {filter.opts.map((opt) => (
                        <option key={opt.value} value={opt.value} className="bg-[#1a1a1a] text-gray-200">
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>

              {/* Right side: status + button */}
              <div className="flex items-center justify-between gap-4 md:justify-end">
                <div className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-[#1c1c1c] border border-[#333] px-3 py-1 text-[11px] font-medium text-emerald-500 shadow-inner">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_5px_rgba(16,185,129,0.5)]" />
                  Knowledge base active
                </div>

                <button
                  type="button"
                  onClick={handleAskCoach}
                  disabled={loading}
                  className="btn btn-platinum-premium btn-analyze-premium"
                  style={{ minWidth: '160px' }}
                >
                  <span className="btn-text">
                    {loading ? '✨ Thinking…' : '✨ Ask Coach'}
                  </span>
                </button>
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs font-medium text-red-500 bg-red-900/20 border border-red-900/50 p-2 rounded-lg text-center">
                {errorMsg}
              </p>
            )}
          </div>
        </section>

        {/* Main two-column layout */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.3fr)]">
          {/* Left column – AI Coach / RAG output */}
          <div className="flex flex-col gap-4">
            {/* Strategy Snapshot */}
            <section className="p-6 platinum-inner-border">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold platinum-text-gradient">
                  Strategy Snapshot
                </h2>
                <span className="rounded-full bg-[#262626] border border-[#333] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#737373]">
                  Using: notes + hands
                </span>
              </div>
              {coach?.summary ? (
                <p className="text-sm leading-relaxed text-[#d4d4d4] whitespace-pre-line">
                  {coach.summary}
                </p>
              ) : (
                <p className="text-sm text-[#737373]">
                  Ask the coach a question to see a summary of what&apos;s going on in
                  this spot.
                </p>
              )}
            </section>

            {/* Key Rules */}
            <section className="p-6 platinum-inner-border">
              <h3 className="mb-4 text-sm font-bold platinum-text-gradient">
                Key Rules for This Spot
              </h3>
              {coach?.rules && coach.rules.length > 0 ? (
                <ul className="space-y-3 text-sm text-[#d4d4d4]">
                  {coach.rules.map((rule, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="mt-[6px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                      <span className="leading-relaxed">{rule}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-[#737373]">
                  When you ask a question, important heuristics and rules will show up
                  here.
                </p>
              )}
            </section>

            {/* Source Context */}
            <section className="p-6 platinum-inner-border">
              <h3 className="mb-4 text-sm font-bold platinum-text-gradient">
                Source Context
              </h3>
              {chunks.length === 0 ? (
                <p className="text-sm text-[#737373]">
                  The coach will show which notes, hands, and GTO snippets it used as
                  context.
                </p>
              ) : (
                <div className="space-y-3">
                  {chunks.map((chunk, idx) => {
                    const labelType = (chunk.source_type || '').toLowerCase();
                    const icon =
                      labelType === 'hand'
                        ? '♠️'
                        : labelType === 'note'
                          ? '📝'
                          : labelType === 'gto'
                            ? '📊'
                            : '📎';

                    const metaParts: string[] = [];
                    if (chunk.stakes_bucket) metaParts.push(chunk.stakes_bucket);
                    if (chunk.position_norm) metaParts.push(chunk.position_norm);
                    if (chunk.street) metaParts.push(chunk.street);
                    const meta =
                      metaParts.length > 0 ? metaParts.join(' • ') : undefined;

                    const tags = chunk.tags || [];

                    return (
                      <details
                        key={chunk.id || `${idx}`}
                        className="group bg-[#141414] rounded-xl px-4 py-3 text-sm text-[#d4d4d4] open:bg-[#1a1a1a] transition-all platinum-inner-border"
                      >
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-2 outline-none">
                          <div className="flex items-center gap-3">
                            <span className="text-base opacity-70">{icon}</span>
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-[#e5e5e5]">
                                {chunk.title ||
                                  (labelType === 'hand'
                                    ? 'Hand context'
                                    : labelType === 'note'
                                      ? 'Study note'
                                      : 'Source snippet')}
                              </span>
                              {meta && (
                                <span className="text-[10px] text-[#737373] mt-0.5">
                                  {meta}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] text-[#555] uppercase tracking-wider group-open:text-[#a3a3a3]">
                            View
                          </span>
                        </summary>
                        <div className="mt-3 border-t border-[#333] pt-3 text-xs leading-relaxed text-[#a3a3a3]">
                          {chunk.content}
                        </div>
                        {tags.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {tags.map((t) => (
                              <span
                                key={t}
                                className="rounded-md bg-[#262626] border border-[#333] px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#888]"
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                      </details>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Right column – Drill Engine */}
          <div className="flex flex-col gap-4">
            {/* Recommended drills */}
            <section className="p-6 platinum-inner-border">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold platinum-text-gradient">
                  Recommended Drills
                  {drills.length > 0 ? ` (${drills.length})` : ''}
                </h2>
                <span className="rounded-full bg-[#262626] border border-[#333] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#737373]">
                  Drill engine
                </span>
              </div>

              {activeDrill ? (
                <div className="flex flex-col gap-4">
                  <div className="rounded-xl bg-[#0f0f0f] p-5 shadow-inner platinum-inner-border">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-[#555]">
                      Scenario {activeDrillIndex + 1}
                    </p>
                    <p className="text-sm font-medium text-[#e5e5e5] leading-relaxed">
                      {activeDrill.question}
                    </p>
                    {activeDrill.answer && (
                      <details className="mt-4 text-sm group">
                        <summary className="cursor-pointer text-xs font-bold text-blue-400 hover:text-blue-300 transition select-none flex items-center gap-1">
                          <span>Show Answer</span>
                          <span className="text-[10px] opacity-50 ml-1">(Click to reveal)</span>
                        </summary>
                        <div className="mt-3 p-3 bg-[#1a1a1a] rounded-lg border border-[#333] text-[#d4d4d4]">
                          <p className="font-semibold text-[#f3f4f6] mb-1">Answer:</p>
                          <p>{activeDrill.answer}</p>
                          {activeDrill.explanation && (
                            <div className="mt-2 pt-2 border-t border-[#333] text-xs text-[#a3a3a3]">
                              <p className="font-bold text-[#737373] mb-1 uppercase tracking-wider">Explanation</p>
                              {activeDrill.explanation}
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={nextDrill}
                      className="btn-ony flex-1 py-2 text-xs uppercase tracking-wider"
                    >
                      Next Drill
                    </button>
                    <span className="text-xs text-[#555] font-mono">
                      {activeDrillIndex + 1} / {drills.length}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[#737373]">
                  Once the coach answers, you&apos;ll see tailored drills for this spot
                  here.
                </p>
              )}
            </section>

            {/* Drill list */}
            <section className="p-6 platinum-inner-border">
              <h3 className="mb-3 text-sm font-bold platinum-text-gradient">
                Drill List
              </h3>
              {drills.length === 0 ? (
                <p className="text-sm text-[#737373]">
                  No drills yet. Ask a question above to generate a set of exercises.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {drills.map((d, idx) => (
                    <li
                      key={d.id || idx}
                      className="flex items-start justify-between gap-3 rounded-lg bg-[#141414] px-3 py-2.5 hover:bg-[#1a1a1a] transition platinum-inner-border"
                    >
                      <div className="flex gap-3">
                        <span className="mt-[2px] text-xs font-bold text-[#555] font-mono">
                          {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                        </span>
                        <span className="text-[#d4d4d4] text-xs">{d.question}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Add to Plan stub */}
            <section className="p-6 opacity-60 hover:opacity-100 transition platinum-inner-border">
              <h3 className="mb-2 text-sm font-bold platinum-text-gradient">
                Add to Study Plan
              </h3>
              <p className="mb-4 text-xs text-[#a3a3a3]">
                Suggested: focus on your top leak from this query over the next 3 study
                sessions.
              </p>
              <button
                type="button"
                className="w-full btn-ony py-2 text-xs uppercase tracking-wider opacity-70 cursor-not-allowed"
                disabled
              >
                Add to Study Plan (coming soon)
              </button>
            </section>
          </div>
        </div>

        {/* Small helper footer */}
        <footer className="mt-4 text-xs text-[#555] text-center pb-8">
          To upload new hand histories, use the{' '}
          <span className="font-bold text-[#737373]">My Hands</span> tab.
        </footer>
      </div>
    </main>
  );
}
