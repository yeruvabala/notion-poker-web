'use client';

import { useState } from 'react';

type Fields = {
  date?: string | null;
  stakes?: string | number | null; // text for your Notion mapping
  position?: string | null;
  cards?: string | null;
  villain_action?: string | null;

  // analysis
  gto_strategy?: string | null;
  exploit_deviation?: string | null;
  learning_tag?: string[];
  gto_expanded?: string | null; // full branch map
};

export default function Home() {
  const [input, setInput] = useState<string>('');            // user hand text
  const [fields, setFields] = useState<Fields | null>(null); // parsed + AI filled, starts empty
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [showExpanded, setShowExpanded] = useState(false);

  // Helpers
  const safe = (v?: string | null) => (v && v.trim().length ? v : '—');
  const canSend = input.trim().length > 0 && !aiLoading;

  async function handleSend() {
    if (!input.trim()) return;
    setAiError(null);
    setStatus(null);
    setAiLoading(true);
    setShowExpanded(false);

    try {
      // 1) parse
      const p = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input })
      });
      if (!p.ok) {
        const err = await p.json().catch(() => ({} as any));
        throw new Error(err?.error || `Parse failed (${p.status})`);
      }
      const parsed: Partial<Fields> = await p.json();

      // 2) analyze
      const payload = {
        date: parsed.date ?? undefined,
        stakes: parsed.stakes ?? undefined,
        position: parsed.position ?? undefined,
        cards: parsed.cards ?? undefined,
        villainAction: parsed.villain_action ?? undefined,
      };
      const a = await fetch('/api/analyze-hand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!a.ok) {
        const err = await a.json().catch(() => ({} as any));
        throw new Error(err?.error || `Analyze failed (${a.status})`);
      }
      const analyzed = await a.json();

      // Normalize tags
      const tags: string[] =
        Array.isArray(analyzed.learning_tag)
          ? analyzed.learning_tag
          : typeof analyzed.learning_tag === 'string'
            ? analyzed.learning_tag
                .split(',')
                .map((s: string) => s.trim())
                .filter(Boolean)
            : [];

      setFields({
        date: parsed.date ?? null,
        stakes: parsed.stakes ?? null,
        position: parsed.position ?? null,
        cards: parsed.cards ?? null,
        villain_action: parsed.villain_action ?? null,

        gto_strategy: analyzed.gto_strategy ?? null,
        exploit_deviation: analyzed.exploit_deviation ?? null,
        learning_tag: tags,
        gto_expanded: analyzed.gto_expanded ?? null,
      });
    } catch (e: any) {
      setAiError(e?.message || 'Analyze error');
    } finally {
      setAiLoading(false);
    }
  }

  function handleClear() {
    setInput('');
    setFields(null);
    setAiError(null);
    setStatus(null);
    setShowExpanded(false);
  }

  async function handleSave() {
    if (!fields) return;
    setSaving(true);
    setStatus(null);
    try {
      const r = await fetch('/api/notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
      const data = await r.json();
      if (data?.ok) setStatus(`Saved! Open in Notion: ${data.url}`);
      else setStatus(data?.error || 'Failed to save');
    } catch (e: any) {
      setStatus(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main style={{ maxWidth: 1200, margin: '0 auto', padding: '20px' }}>
      {/* Top crumbs */}
      <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 8 }}>
        Paste → <strong>Send</strong> → Analyze → Save
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left: Hand Played */}
        <section
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 16,
            background: '#fff'
          }}
        >
          <h2 style={{ margin: '4px 0 8px', fontWeight: 700, letterSpacing: 0.3 }}>
            HAND PLAYED
          </h2>

          <textarea
            placeholder="Paste the hand history or describe the hand"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            style={{
              width: '100%',
              minHeight: 260,
              border: '1px solid #e5e7eb',
              borderRadius: 8,
              padding: 12,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              fontSize: 16,
              outline: 'none'
            }}
          />

          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button
              onClick={handleSend}
              disabled={!canSend}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border: '1px solid #1d4ed8',
                background: canSend ? '#2563eb' : '#93c5fd',
                color: '#fff',
                cursor: canSend ? 'pointer' : 'not-allowed'
              }}
            >
              {aiLoading ? 'Analyzing…' : 'Send'}
            </button>
            <button
              onClick={handleClear}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border: '1px solid #e5e7eb',
                background: '#fff'
              }}
            >
              Clear
            </button>
          </div>

          {/* Error / status */}
          <div style={{ marginTop: 10, minHeight: 22 }}>
            {aiError && (
              <span style={{ color: '#dc2626' }}>{aiError}</span>
            )}
            {status && (
              <span style={{ color: '#065f46' }}>{status}</span>
            )}
          </div>
        </section>

        {/* Right: Result column */}
        <section
          style={{
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            padding: 16,
            background: '#fff'
          }}
        >
          {/* Optional chips from learning_tag */}
          {fields?.learning_tag?.length ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
              {fields.learning_tag.map((t, i) => (
                <span
                  key={`${t}-${i}`}
                  style={{
                    background: '#eef2ff',
                    color: '#3730a3',
                    border: '1px solid #c7d2fe',
                    padding: '6px 10px',
                    borderRadius: 999,
                    fontSize: 12
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}

          <Field name="Cards" value={safe(fields?.cards)} />
          <Field name="Position" value={safe(fields?.position)} />
          <Field name="Stakes" value={safe(String(fields?.stakes ?? ''))} />
          <Field name="Villain Action" value={safe(fields?.villain_action)} large />

          <Field name="GTO Strategy" value={safe(fields?.gto_strategy)} large />

          {/* GTO Expanded toggle only when we actually have it */}
          {fields?.gto_expanded ? (
            <div style={{ marginBottom: 10 }}>
              <button
                onClick={() => setShowExpanded((s) => !s)}
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  border: '1px solid #e5e7eb',
                  background: '#fff',
                  fontSize: 14
                }}
              >
                {showExpanded ? 'Hide GTO Expanded' : 'Show GTO Expanded'}
              </button>
            </div>
          ) : null}

          {showExpanded && fields?.gto_expanded ? (
            <pre
              style={{
                whiteSpace: 'pre-wrap',
                border: '1px solid #e5e7eb',
                background: '#fafafa',
                borderRadius: 8,
                padding: 10,
                fontFamily:
                  'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                fontSize: 13,
                marginTop: 8,
                marginBottom: 12,
              }}
            >
              {fields.gto_expanded}
            </pre>
          ) : null}

          <Field name="Exploit Deviation" value={safe(fields?.exploit_deviation)} large />

          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button
              onClick={handleSend}
              disabled={!input.trim() || aiLoading}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border: '1px solid #e5e7eb',
                background: '#f3f4f6',
                color: '#111827',
                cursor: input.trim() && !aiLoading ? 'pointer' : 'not-allowed'
              }}
            >
              Analyze Again
            </button>
            <button
              onClick={handleSave}
              disabled={!fields || saving}
              style={{
                padding: '8px 14px',
                borderRadius: 10,
                border: '1px solid #1d4ed8',
                background: fields && !saving ? '#2563eb' : '#93c5fd',
                color: '#fff',
                cursor: fields && !saving ? 'pointer' : 'not-allowed'
              }}
            >
              {saving ? 'Saving…' : 'Confirm & Save to Notion'}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}

/** Labeled field block that matches your light theme */
function Field({
  name,
  value,
  large = false,
}: {
  name: string;
  value: string;
  large?: boolean;
}) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div
        style={{
          display: 'inline-block',
          fontSize: 12,
          fontWeight: 700,
          color: '#374151',
          background: '#eef2ff',
          border: '1px solid #c7d2fe',
          padding: '6px 10px',
          borderRadius: 999,
          marginBottom: 6,
        }}
      >
        {name}
      </div>
      <div
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 8,
          padding: 12,
          minHeight: large ? 64 : 42,
          fontSize: 14,
          background: '#fff',
          whiteSpace: 'pre-wrap',
        }}
      >
        {value || '—'}
      </div>
    </div>
  );
}
