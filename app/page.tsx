// app/page.tsx
'use client';

import React, { useMemo, useState } from 'react';

type Analysis = {
  gto_strategy?: string;
  exploit_deviation?: string;
  learning_tag?: string[];
  gto_expanded?: string;
  facts?: {
    effStackBB?: number | null;
    flop?: string[] | null;
    turn?: string | null;
    river?: string | null;
    position?: string | null;
  };
};

export default function Page() {
  // LEFT: the freeform input
  const [rawText, setRawText] = useState('');

  // RIGHT: parsed/editable-ish fields you already show
  const [fields, setFields] = useState({
    cards: '',
    position: '',
    stakes: '',
    villain_action: '',
  });

  // API response
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [showExpanded, setShowExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const chips = useMemo(() => {
    const f = analysis?.facts;
    if (!f) return [];
    return [
      f.effStackBB ? `Stack: ${f.effStackBB}bb` : null,
      f.flop?.length ? `Flop: ${f.flop.join(' ')}` : null,
      f.turn ? `Turn: ${f.turn}` : null,
      f.river ? `River: ${f.river}` : null,
    ].filter(Boolean) as string[];
  }, [analysis]);

  async function handleAnalyze() {
    setError(null);
    setLoading(true);
    setShowExpanded(false);
    try {
      const res = await fetch('/api/analyze-hand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText,
          position: fields.position,
          stakes: fields.stakes,
          villainAction: fields.villain_action,
          cards: fields.cards,
        }),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || 'Request failed');
      }
      const data = (await res.json()) as Analysis;
      setAnalysis(data);
    } catch (e: any) {
      setError(e?.message || 'Failed to analyze hand');
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }

  function handleClear() {
    setRawText('');
    setFields({
      cards: '',
      position: '',
      stakes: '',
      villain_action: '',
    });
    setAnalysis(null);
    setShowExpanded(false);
    setError(null);
  }

  return (
    <main style={{ padding: '16px', maxWidth: 1280, margin: '0 auto' }}>
      {/* Top breadcrumbs (unchanged) */}
      <div style={{ opacity: 0.75, fontSize: 14, marginBottom: 8 }}>
        Paste → Send → Analyze → Save
      </div>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: '1fr 1fr' }}>
        {/* LEFT COLUMN */}
        <section>
          <h2 style={{ margin: '0 0 8px' }}>HAND PLAYED</h2>

          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={14}
            style={{
              width: '100%',
              resize: 'vertical',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              padding: 12,
              borderRadius: 8,
              border: '1px solid var(--border, #333)',
              background: 'var(--panel, #0B1220)',
              color: 'var(--fg, #E6EAF2)',
            }}
            placeholder="Paste the hand history or describe the hand in plain English..."
          />

          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button
              onClick={handleAnalyze}
              disabled={loading}
              style={{
                padding: '8px 14px',
                borderRadius: 12,
                border: 'none',
                background:
                  'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                color: 'white',
                cursor: 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Analyzing…' : 'Send'}
            </button>

            <button
              onClick={handleClear}
              style={{
                padding: '8px 14px',
                borderRadius: 12,
                border: '1px solid var(--border, #333)',
                background: 'var(--panel, #0B1220)',
                color: 'var(--fg, #E6EAF2)',
                cursor: 'pointer',
              }}
            >
              Clear
            </button>
          </div>

          {!!error && (
            <div style={{ color: '#ef4444', marginTop: 8 }}>
              {error}
            </div>
          )}
        </section>

        {/* RIGHT COLUMN */}
        <section
          style={{
            borderRadius: 12,
            padding: 12,
            background: 'var(--panel, #0B1220)',
            color: 'var(--fg, #E6EAF2)',
            border: '1px solid var(--border, #333)',
          }}
        >
          {/* Chips row from learning tags (if you want to surface them) */}
          {analysis?.learning_tag?.length ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {analysis.learning_tag.map((t, i) => (
                <span
                  key={i}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: 'rgba(59,130,246,0.15)',
                    border: '1px solid rgba(59,130,246,0.4)',
                    fontSize: 12,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}

          {/* Cards */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
              Cards
            </div>
            <input
              value={fields.cards}
              onChange={(e) =>
                setFields((f) => ({ ...f, cards: e.target.value }))
              }
              placeholder="A♠4♠"
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 10,
                background: 'var(--panel, #0B1220)',
                border: '1px solid var(--border, #333)',
                color: 'var(--fg, #E6EAF2)',
              }}
            />
          </div>

          {/* Position */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
              Position
            </div>
            <input
              value={fields.position}
              onChange={(e) =>
                setFields((f) => ({ ...f, position: e.target.value }))
              }
              placeholder="SB / BTN / BB …"
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 10,
                background: 'var(--panel, #0B1220)',
                border: '1px solid var(--border, #333)',
                color: 'var(--fg, #E6EAF2)',
              }}
            />
          </div>

          {/* Stakes */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
              Stakes
            </div>
            <input
              value={fields.stakes}
              onChange={(e) =>
                setFields((f) => ({ ...f, stakes: e.target.value }))
              }
              placeholder="1/3, 2/5 Live …"
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 10,
                background: 'var(--panel, #0B1220)',
                border: '1px solid var(--border, #333)',
                color: 'var(--fg, #E6EAF2)',
              }}
            />
          </div>

          {/* Villain Action */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>
              Villain Action
            </div>
            <textarea
              value={fields.villain_action}
              onChange={(e) =>
                setFields((f) => ({ ...f, villain_action: e.target.value }))
              }
              rows={2}
              placeholder="raises to 2.55bb, calls 3-bet, calls flop bet, bets turn, calls river"
              style={{
                width: '100%',
                padding: 10,
                borderRadius: 10,
                background: 'var(--panel, #0B1220)',
                border: '1px solid var(--border, #333)',
                color: 'var(--fg, #E6EAF2)',
                fontFamily: 'inherit',
              }}
            />
          </div>

          {/* GTO Strategy + Facts chips */}
          <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>GTO Strategy</div>
            {chips.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {chips.map((c, i) => (
                  <span
                    key={i}
                    style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      border: '1px solid rgba(148,163,184,0.35)',
                      background: 'rgba(148,163,184,0.08)',
                      fontSize: 12,
                    }}
                  >
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>

          <textarea
            value={analysis?.gto_strategy || ''}
            readOnly
            rows={4}
            placeholder="Preflop/Flop/Turn/River plan…"
            style={{
              width: '100%',
              padding: 10,
              borderRadius: 10,
              background: 'var(--panel, #0B1220)',
              border: '1px solid var(--border, #333)',
              color: 'var(--fg, #E6EAF2)',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              marginBottom: 8,
            }}
          />

          {/* Toggle for expanded */}
          <div style={{ marginBottom: 12 }}>
            {!showExpanded ? (
              <button
                onClick={() => setShowExpanded(true)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--border, #333)',
                  background: 'var(--panel, #0B1220)',
                  color: 'var(--fg, #E6EAF2)',
                  cursor: 'pointer',
                }}
              >
                Show GTO Expanded
              </button>
            ) : (
              <button
                onClick={() => setShowExpanded(false)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 10,
                  border: '1px solid var(--border, #333)',
                  background: 'var(--panel, #0B1220)',
                  color: 'var(--fg, #E6EAF2)',
                  cursor: 'pointer',
                }}
              >
                Hide GTO Expanded
              </button>
            )}
          </div>

          {showExpanded && (
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                border: '1px solid var(--border, #333)',
                background: 'var(--panel, #0B1220)',
                color: 'var(--fg, #E6EAF2)',
                borderRadius: 10,
                padding: 12,
                marginBottom: 16,
                maxHeight: 360,
                overflow: 'auto',
              }}
            >
              {analysis?.gto_expanded || ''}
            </pre>
          )}

          {/* Exploit Deviation */}
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
            Exploit Deviation
          </div>
          <textarea
            value={analysis?.exploit_deviation || ''}
            readOnly
            rows={3}
            placeholder="Pool exploits / deviations…"
            style={{
              width: '100%',
              padding: 10,
              borderRadius: 10,
              background: 'var(--panel, #0B1220)',
              border: '1px solid var(--border, #333)',
              color: 'var(--fg, #E6EAF2)',
              fontFamily: 'inherit',
            }}
          />

          {/* Footer actions (leave as-is; hook to your Notion save if you have) */}
          <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
            <button
              onClick={handleAnalyze}
              disabled={loading}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid var(--border, #333)',
                background: 'var(--panel, #0B1220)',
                color: 'var(--fg, #E6EAF2)',
                cursor: 'pointer',
              }}
            >
              Analyze Again
            </button>
            <button
              // Hook this to your Notion POST if you already had it wired
              onClick={() => alert('Hook this to your Notion save route')}
              style={{
                padding: '8px 12px',
                borderRadius: 10,
                border: '1px solid var(--border, #333)',
                background: 'var(--panel, #0B1220)',
                color: 'var(--fg, #E6EAF2)',
                cursor: 'pointer',
              }}
            >
              Confirm & Save to Notion
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
