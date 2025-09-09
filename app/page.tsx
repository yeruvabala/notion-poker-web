'use client';

import React, { useState } from 'react';
import type { ReactNode } from 'react';

type Fields = {
  date?: string | null;
  stakes?: string | null;        // TEXT, not number
  position?: string | null;
  cards?: string | null;
  villain_action?: string | null;
  villian_action?: string | null; // tolerate typo from upstream
  gto_strategy?: string | null;
  exploit_deviation?: string | null;
  learning_tag?: string[];
  board?: string | null;
  notes?: string | null;
};

// Coerce any value into readable text
const asText = (v: any): string =>
  typeof v === 'string'
    ? v
    : v == null
      ? ''
      : Array.isArray(v)
        ? v.map(asText).join('\n')
        : typeof v === 'object'
          ? Object.entries(v)
              .map(([k, val]) => `${k}: ${asText(val)}`)
              .join('\n')
          : String(v);

export default function Page() {
  const [input, setInput] = useState('');
  const [fields, setFields] = useState<Fields | null>(null);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Call /api/analyze-hand and fill GTO/Exploit/Tags
  async function analyzeParsedHand(parsed: Fields) {
    setAiError(null);
    setAiLoading(true);
    try {
      const payload = {
        date: parsed.date ?? undefined,
        stakes: parsed.stakes ?? undefined,
        position: parsed.position ?? undefined,
        cards: parsed.cards ?? undefined,
        villainAction: parsed.villain_action ?? parsed.villian_action ?? undefined,
        board: parsed.board ?? '',
        notes: parsed.notes ?? '',
      };

      const r = await fetch('/api/analyze-hand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err?.error || `AI analyze failed (${r.status})`);
      }

      const data = await r.json();

      setFields(prev => {
        const base = prev ?? parsed ?? {};
        const tags: string[] =
          Array.isArray(data.learning_tag)
            ? data.learning_tag
            : typeof data.learning_tag === 'string'
              ? data.learning_tag.split(',').map((s: string) => s.trim()).filter(Boolean)
              : [];

        return {
          ...base,
          gto_strategy: asText(data.gto_strategy),
          exploit_deviation: asText(data.exploit_deviation),
          learning_tag: tags,
        };
      });
    } catch (e: any) {
      console.error(e);
      setAiError(e.message || 'AI analysis error');
    } finally {
      setAiLoading(false);
    }
  }

  // Parse → then auto-run AI
  async function handleParse() {
    setStatus(null);
    setAiError(null);
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      });
      const parsed: Fields = await res.json();
      setFields(parsed);
      if (parsed) analyzeParsedHand(parsed);
    } catch (e: any) {
      setAiError(e.message || 'Parse failed');
    }
  }

  async function handleSave() {
    if (!fields) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
      const data = await res.json();
      if (data.ok) setStatus(`Saved! Open in Notion: ${data.url}`);
      else setStatus(data.error || 'Failed to save');
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setSaving(false);
    }
  }

  function TagChips() {
    const chips = fields?.learning_tag?.filter(Boolean) ?? [];
    if (!chips.length) return null;
    return (
      <div className="chipRow" aria-label="tags">
        {chips.map((t, i) => (
          <span className="chip" key={i}>{t}</span>
        ))}
      </div>
    );
  }

  return (
    <main className="page">
      <div className="container">
        <header className="brand">
          <h1>Notion Poker Ingest</h1>
          <nav className="crumbs">
            <span>Paste</span> <span className="arrow">→</span> <strong>Send</strong> <span className="arrow">→</span> <span>Analyze</span> <span className="arrow">→</span> <span>Save</span>
          </nav>
        </header>

        <section className="columns">
          {/* LEFT: free text */}
          <div className="col left">
            <div className="card">
              <div className="cardTitle">HAND PLAYED</div>
              <textarea
                className="textarea"
                placeholder="Paste the hand history or describe the hand in plain English…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <div className="row gap">
                <button className="btn primary" onClick={handleParse} disabled={!input.trim() || aiLoading}>
                  {aiLoading ? 'Analyzing…' : 'Send'}
                </button>
                <button
                  className="btn"
                  onClick={() => { setInput(''); setFields(null); setStatus(null); setAiError(null); }}
                >
                  Clear
                </button>
              </div>
              {aiError && <div className="err">{aiError}</div>}
              {status && <div className="note">{status}</div>}
            </div>
          </div>

          {/* RIGHT: parsed + AI */}
          <div className="col right">
            <div className="card">
              <div className="row spaceBetween">
                <TagChips />
                <div className="meta">
                  {fields?.stakes && fields?.cards && (
                    <span className="metaText">{fields.stakes} • {fields.cards}</span>
                  )}
                </div>
              </div>

              <PropertyRow label="Cards">
                <div className="value">{fields?.cards || '—'}</div>
              </PropertyRow>

              <PropertyRow label="Position">
                <div className="value">{fields?.position || '—'}</div>
              </PropertyRow>

              <PropertyRow label="Stakes">
                <input
                  className="input"
                  placeholder="1/3, 2/5, 200NL, etc."
                  value={fields?.stakes ?? ''}
                  onChange={e => fields && setFields({ ...fields, stakes: e.target.value })}
                />
              </PropertyRow>

              <PropertyRow label="Villain Action">
                <textarea
                  className="input"
                  rows={2}
                  placeholder="Villain action summary…"
                  value={fields?.villain_action ?? ''}
                  onChange={e => fields && setFields({ ...fields, villain_action: e.target.value })}
                />
              </PropertyRow>

              <PropertyRow label="GTO Strategy">
                <textarea
                  className="input mono"
                  rows={6}
                  placeholder="Preflop/Flop/Turn/River plan…"
                  value={fields?.gto_strategy ?? ''}
                  onChange={e => fields && setFields({ ...fields, gto_strategy: e.target.value })}
                />
              </PropertyRow>

              <PropertyRow label="Exploit Deviation">
                <textarea
                  className="input"
                  rows={5}
                  placeholder="Pool exploits / deviations…"
                  value={fields?.exploit_deviation ?? ''}
                  onChange={e => fields && setFields({ ...fields, exploit_deviation: e.target.value })}
                />
              </PropertyRow>

              <div className="row end gapTop">
                <button
                  className="btn"
                  disabled={!fields || aiLoading}
                  onClick={() => fields && analyzeParsedHand(fields)}
                >
                  {aiLoading ? 'Analyzing…' : 'Analyze Again'}
                </button>
                <button
                  className="btn primary"
                  disabled={!fields || saving}
                  onClick={handleSave}
                >
                  {saving ? 'Saving…' : 'Confirm & Save to Notion'}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      <style jsx global>{`
        :root {
          --bg: #0b1220;
          --panel: #0f172a;
          --muted: #94a3b8;
          --line: rgba(148, 163, 184, 0.15);
          --text: #e5e7eb;
          --pill-bg: #0b2f7c;
          --pill-border: #2563eb;
          --chip-bg: #10224a;
          --primary: #3b82f6;
          --primary-2: #1d4ed8;
          --btn-text: #eaf2ff;
          --danger: #ef4444;
          --ok: #22c55e;
        }
        * { box-sizing: border-box; }
        html, body { margin: 0; padding: 0; background: linear-gradient(180deg, #0a0f1f, #0b1220); color: var(--text); font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Noto Sans; }
        .page { min-height: 100vh; padding: 24px; }
        .container { max-width: 1200px; margin: 0 auto; }
        .brand h1 { margin: 0 0 4px; font-size: 28px; letter-spacing: 0.2px; }
        .crumbs { color: var(--muted); font-size: 14px; margin-bottom: 18px; }
        .crumbs .arrow { opacity: 0.7; margin: 0 6px; }

        .columns { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
        @media (max-width: 980px) { .columns { grid-template-columns: 1fr; } }

        .card {
          background: rgba(15, 23, 42, 0.9);
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.25);
        }
        .cardTitle { font-weight: 700; letter-spacing: .4px; margin-bottom: 10px; color: #bcd0ff; }

        .textarea {
          width: 100%;
          min-height: 260px;
          resize: vertical;
          padding: 12px 14px;
          border-radius: 12px;
          border: 1px solid var(--line);
          background: #0a1326;
          color: var(--text);
          font-size: 16px;
          line-height: 1.5;
        }

        .row { display: flex; align-items: center; }
        .spaceBetween { justify-content: space-between; }
        .end { justify-content: flex-end; }
        .gap { gap: 12px; }
        .gapTop { margin-top: 10px; }

        .btn {
          appearance: none; border: 1px solid var(--line);
          background: #0c1a33; color: var(--text);
          padding: 10px 14px; border-radius: 12px; cursor: pointer;
          transition: transform .02s ease, background .15s ease, border-color .15s ease;
        }
        .btn:hover { background: #0d213f; }
        .btn:active { transform: translateY(1px); }
        .btn[disabled] { opacity: 0.55; cursor: not-allowed; }

        .btn.primary {
          background: linear-gradient(180deg, var(--primary), var(--primary-2));
          border-color: #274c99;
          color: var(--btn-text);
          box-shadow: 0 6px 20px rgba(35, 122, 255, .25);
        }
        .btn.primary:hover { filter: brightness(1.05); }

        .chipRow { display: flex; flex-wrap: wrap; gap: 8px; }
        .chip {
          background: var(--chip-bg);
          border: 1px solid var(--pill-border);
          padding: 6px 10px;
          border-radius: 999px;
          font-size: 12.5px;
          color: #cfe0ff;
          letter-spacing: .2px;
        }

        .meta .metaText { color: var(--muted); font-size: 14px; }

        .propRow {
          display: grid;
          grid-template-columns: 160px 1fr;
          gap: 14px;
          align-items: start;
          padding: 12px 10px;
          border-top: 1px dashed var(--line);
        }
        .propRow:first-of-type { border-top: 0; }

        .pill {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 32px;
          padding: 0 10px;
          border-radius: 999px;
          background: #0b1a36;
          border: 1px solid #2a3b6a;
          color: #bcd0ff;
          font-weight: 700;
          font-size: 12.5px;
          letter-spacing: .25px;
          white-space: nowrap;
        }
        .value { white-space: pre-wrap; }

        .input {
          width: 100%;
          padding: 10px 12px;
          background: #0a1326;
          color: var(--text);
          border: 1px solid var(--line);
          border-radius: 12px;
          font-size: 14.5px;
        }
        .input.mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
          line-height: 1.45;
        }

        .note { margin-top: 10px; color: #c7f9cc; }
        .err { margin-top: 10px; color: var(--danger); }

        .col.left .card { padding-bottom: 18px; }
      `}</style>
    </main>
  );
}

function PropertyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="propRow">
      <div className="pill">{label}</div>
      <div>{children}</div>
    </div>
  );
}
