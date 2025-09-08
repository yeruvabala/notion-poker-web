'use client';

import React from 'react';

type Analysis = {
  gto_strategy?: string;
  exploit_deviation?: string;
  learning_tag?: string[];
  gto_expanded_text?: string;
  facts?: {
    effStackBB?: number | null;
    flop?: string[] | null;
    turn?: string | null;
    river?: string | null;
    position?: string | null;
  };
};

export default function Page() {
  const [rawText, setRawText] = React.useState('');
  const [fields, setFields] = React.useState({
    cards: '',
    position: '',
    stakes: '',
    villain_action: '',
  });

  const [analysis, setAnalysis] = React.useState<Analysis | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [showExpanded, setShowExpanded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const gtoText = React.useMemo(() => analysis?.gto_strategy ?? '', [analysis]);
  const expandedText = React.useMemo(
    () => analysis?.gto_expanded_text ?? '',
    [analysis]
  );

  const stackChip = React.useMemo(() => {
    const n = analysis?.facts?.effStackBB;
    return Number.isFinite(n as any) ? `${n}bb` : '';
  }, [analysis]);

  async function onSend() {
    setError(null);
    setLoading(true);
    setAnalysis(null);
    setShowExpanded(false);
    try {
      const res = await fetch('/api/analyze-hand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText,
          position: fields.position,
          stakes: fields.stakes,
          cards: fields.cards,
          villainAction: fields.villain_action,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed');
      setAnalysis(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to analyze hand');
    } finally {
      setLoading(false);
    }
  }

  function onClear() {
    setRawText('');
    setFields({ cards: '', position: '', stakes: '', villain_action: '' });
    setAnalysis(null);
    setShowExpanded(false);
    setError(null);
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, padding: 24 }}>
      {/* LEFT: input */}
      <div>
        <h2>HAND PLAYED</h2>
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="Paste the hand history or describe the hand in plain English…"
          style={{
            width: '100%',
            height: 260,
            borderRadius: 8,
            padding: 12,
            background: '#0d1117',
            color: '#eee',
            fontFamily: 'ui-monospace, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          }}
        />
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <button onClick={onSend} disabled={loading} style={{ padding: '8px 16px' }}>
            {loading ? 'Analyzing…' : 'Send'}
          </button>
          <button onClick={onClear} style={{ padding: '8px 16px' }}>Clear</button>
        </div>
        {error && <div style={{ color: '#f33', marginTop: 8 }}>{error}</div>}
      </div>

      {/* RIGHT: parsed + analysis */}
      <div>
        {/* Top chips (optional, keep your existing UI) */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          {stackChip && (
            <span style={{
              fontSize: 12, padding: '4px 8px', borderRadius: 999,
              background: '#1f6feb', color: 'white'
            }}>
              Stack: {stackChip}
            </span>
          )}
        </div>

        {/* Cards */}
        <section style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Cards</div>
          <input
            value={fields.cards}
            onChange={(e) => setFields({ ...fields, cards: e.target.value })}
            placeholder="A♠4♠"
            style={{ width: '100%', padding: 10, borderRadius: 8, background: '#0d1117', color: '#eee' }}
          />
        </section>

        {/* Position */}
        <section style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Position</div>
          <input
            value={fields.position}
            onChange={(e) => setFields({ ...fields, position: e.target.value })}
            placeholder="SB / BTN / BB …"
            style={{ width: '100%', padding: 10, borderRadius: 8, background: '#0d1117', color: '#eee' }}
          />
        </section>

        {/* Stakes */}
        <section style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Stakes</div>
          <input
            value={fields.stakes}
            onChange={(e) => setFields({ ...fields, stakes: e.target.value })}
            placeholder="1/3, 2/5 Live …"
            style={{ width: '100%', padding: 10, borderRadius: 8, background: '#0d1117', color: '#eee' }}
          />
        </section>

        {/* Villain Action */}
        <section style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Villain Action</div>
          <textarea
            value={fields.villain_action}
            onChange={(e) => setFields({ ...fields, villain_action: e.target.value })}
            placeholder="raises to 2.5bb, calls 3-bet, calls flop bet, bets turn, calls river"
            style={{ width: '100%', padding: 10, borderRadius: 8, background: '#0d1117', color: '#eee', height: 60 }}
          />
        </section>

        {/* GTO Strategy (concise) */}
        <section style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ fontSize: 12, opacity: 0.7 }}>GTO Strategy</div>
          </div>
          <textarea
            readOnly
            value={gtoText}
            placeholder=""
            style={{
              width: '100%', minHeight: 110, borderRadius: 8, padding: 10,
              background: '#0d1117', color: '#eee', whiteSpace: 'pre-wrap'
            }}
          />
        </section>

        {/* Expanded tree */}
        <section style={{ marginBottom: 12 }}>
          <button
            onClick={() => setShowExpanded((s) => !s)}
            disabled={!expandedText}
            style={{ padding: '6px 12px', marginBottom: 8 }}
          >
            {showExpanded ? 'Hide GTO Expanded' : 'Show GTO Expanded'}
          </button>
          {showExpanded && (
            <textarea
              readOnly
              value={expandedText}
              style={{
                width: '100%', minHeight: 260, borderRadius: 8, padding: 10,
                background: '#0d1117', color: '#eee', whiteSpace: 'pre', fontFamily: 'ui-monospace, Menlo, Monaco, Consolas, "Courier New", monospace'
              }}
            />
          )}
        </section>

        {/* Exploit Deviations */}
        <section style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 4 }}>Exploit Deviation</div>
          <textarea
            readOnly
            value={analysis?.exploit_deviation ?? ''}
            style={{
              width: '100%', minHeight: 80, borderRadius: 8, padding: 10,
              background: '#0d1117', color: '#eee', whiteSpace: 'pre-wrap'
            }}
          />
        </section>

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={onSend} disabled={loading} style={{ padding: '8px 16px' }}>
            {loading ? 'Analyzing…' : 'Analyze Again'}
          </button>
          <button style={{ padding: '8px 16px' }}>Confirm & Save to Notion</button>
        </div>
      </div>
    </div>
  );
}
