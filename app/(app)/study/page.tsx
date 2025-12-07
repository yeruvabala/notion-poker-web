// app/(app)/study/page.tsx
'use client';

import React, { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

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
    <main className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        {/* Page header */}
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-slate-900">Study</h1>
          <p className="text-sm text-slate-600">
            Ask the coach about leaks or spots. We&apos;ll use your notes and hands to
            answer, then turn it into drills you can practice.
          </p>
        </header>

        {/* Smart Search Header */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4">
            {/* Question input */}
            <div>
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Focus or question
              </label>
              <textarea
                rows={2}
                className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none ring-0 transition focus:border-sky-400 focus:bg-white focus:ring-1 focus:ring-sky-400"
                placeholder="Ask a question or focus on a leak… e.g. “Why am I losing calling 3bets OOP?”"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
              />
            </div>

            {/* Filters + button row */}
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-2 text-xs">
                {/* Range */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Range
                  </span>
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800"
                    value={range}
                    onChange={(e) => setRange(e.target.value)}
                  >
                    {RANGE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Stakes */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Stakes
                  </span>
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800"
                    value={stakes}
                    onChange={(e) => setStakes(e.target.value)}
                  >
                    {STAKES_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Position */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Position
                  </span>
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                  >
                    {POSITION_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Street */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
                    Street
                  </span>
                  <select
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                  >
                    {STREET_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Right side: status + button */}
              <div className="flex items-center justify-between gap-3 md:justify-end">
                <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Knowledge base: up to date
                </div>

                <button
                  type="button"
                  onClick={handleAskCoach}
                  disabled={loading}
                  className="inline-flex items-center justify-center rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-sky-400"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Thinking…
                    </span>
                  ) : (
                    'Ask Coach'
                  )}
                </button>
              </div>
            </div>

            {errorMsg && (
              <p className="text-xs font-medium text-red-600">{errorMsg}</p>
            )}
          </div>
        </section>

        {/* Main two-column layout */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1.3fr)]">
          {/* Left column – AI Coach / RAG output */}
          <div className="flex flex-col gap-4">
            {/* Strategy Snapshot */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-2 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">
                  Strategy Snapshot
                </h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Using: notes + hands
                </span>
              </div>
              {coach?.summary ? (
                <p className="text-sm leading-relaxed text-slate-800 whitespace-pre-line">
                  {coach.summary}
                </p>
              ) : (
                <p className="text-sm text-slate-500">
                  Ask the coach a question to see a summary of what&apos;s going on in
                  this spot.
                </p>
              )}
            </section>

            {/* Key Rules */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">
                Key Rules for This Spot
              </h3>
              {coach?.rules && coach.rules.length > 0 ? (
                <ul className="space-y-1.5 text-sm text-slate-800">
                  {coach.rules.map((rule, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="mt-[5px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sky-500" />
                      <span>{rule}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">
                  When you ask a question, important heuristics and rules will show up
                  here.
                </p>
              )}
            </section>

            {/* Source Context */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">
                Source Context
              </h3>
              {chunks.length === 0 ? (
                <p className="text-sm text-slate-500">
                  The coach will show which notes, hands, and GTO snippets it used as
                  context.
                </p>
              ) : (
                <div className="space-y-2">
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
                        className="group rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
                      >
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-base">{icon}</span>
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold text-slate-900">
                                {chunk.title ||
                                  (labelType === 'hand'
                                    ? 'Hand context'
                                    : labelType === 'note'
                                    ? 'Study note'
                                    : 'Source snippet')}
                              </span>
                              {meta && (
                                <span className="text-[11px] text-slate-500">
                                  {meta}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-[11px] text-slate-400">
                            View
                          </span>
                        </summary>
                        <div className="mt-2 border-t border-slate-200 pt-2 text-xs leading-relaxed text-slate-800">
                          {chunk.content}
                        </div>
                        {tags.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {tags.map((t) => (
                              <span
                                key={t}
                                className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-700"
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
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-900">
                  Recommended Drills
                  {drills.length > 0 ? ` (${drills.length})` : ''}
                </h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide text-slate-500">
                  Drill engine
                </span>
              </div>

              {activeDrill ? (
                <div className="flex flex-col gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Scenario {activeDrillIndex + 1}
                    </p>
                    <p className="text-sm font-medium text-slate-900">
                      {activeDrill.question}
                    </p>
                    {activeDrill.answer && (
                      <details className="mt-3 text-sm text-slate-800">
                        <summary className="cursor-pointer text-xs font-semibold text-sky-700">
                          Show answer &amp; explanation
                        </summary>
                        <div className="mt-1 text-sm text-slate-800">
                          <p className="font-semibold">Answer: {activeDrill.answer}</p>
                          {activeDrill.explanation && (
                            <p className="mt-1 text-sm text-slate-700">
                              {activeDrill.explanation}
                            </p>
                          )}
                        </div>
                      </details>
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={nextDrill}
                      className="inline-flex flex-1 items-center justify-center rounded-full bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-sky-700"
                    >
                      Next Drill
                    </button>
                    <span className="text-xs text-slate-500">
                      {activeDrillIndex + 1} / {drills.length}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  Once the coach answers, you&apos;ll see tailored drills for this spot
                  here.
                </p>
              )}
            </section>

            {/* Drill list */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="mb-2 text-sm font-semibold text-slate-900">
                Drill List
              </h3>
              {drills.length === 0 ? (
                <p className="text-sm text-slate-500">
                  No drills yet. Ask a question above to generate a set of exercises.
                </p>
              ) : (
                <ul className="space-y-1.5 text-sm text-slate-800">
                  {drills.map((d, idx) => (
                    <li
                      key={d.id || idx}
                      className="flex items-start justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                    >
                      <div className="flex gap-2">
                        <span className="mt-[2px] text-xs font-semibold text-slate-500">
                          Q{idx + 1}.
                        </span>
                        <span>{d.question}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Add to Plan stub */}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h3 className="mb-1 text-sm font-semibold text-slate-900">
                Add to Study Plan
              </h3>
              <p className="mb-3 text-sm text-slate-600">
                Suggested: focus on your top leak from this query over the next 3 study
                sessions. Planning &amp; scheduling will live here.
              </p>
              <button
                type="button"
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 shadow-sm transition hover:bg-slate-50"
              >
                Add to Study Plan (coming soon)
              </button>
            </section>
          </div>
        </div>

        {/* Small helper footer */}
        <footer className="mt-2 text-xs text-slate-500">
          To upload new hand histories, use the{' '}
          <span className="font-medium">My Hands</span> tab. This Study view reads from
          your existing notes &amp; hands.
        </footer>
      </div>
    </main>
  );
}
