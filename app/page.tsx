'use client';
import { useState } from 'react';

type Fields = {
  date?: string | null;
  stakes?: string | null;               // text (e.g., "1/3" or "$2/$5")
  position?: string | null;
  cards?: string | null;
  villain_action?: string | null;
  gto_strategy?: string | null;
  exploit_deviation?: string | null;
  learning_tag?: string[];
  // optional extras (safe to keep)
  board?: string | null;
  notes?: string | null;
};

export default function Home() {
  const [input, setInput] = useState('');
  const [fields, setFields] = useState<Fields | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function analyzeParsedHand(parsed: Fields) {
    setAiError(null);
    setAiLoading(true);
    try {
      const payload = {
        date: parsed.date ?? undefined,
        stakes: parsed.stakes ?? undefined,
        position: parsed.position ?? undefined,
        cards: parsed.cards ?? undefined,
        villainAction: parsed.villain_action ?? undefined,
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
      const tags: string[] =
        Array.isArray(data.learning_tag)
          ? data.learning_tag
          : typeof data.learning_tag === 'string'
            ? data.learning_tag.split(',').map((s: string) => s.trim()).filter(Boolean)
            : [];

      setFields(prev => ({
        ...(prev ?? parsed ?? {}),
        gto_strategy: data.gto_strategy || '',
        exploit_deviation: data.exploit_deviation || '',
        learning_tag: tags,
      }));
    } catch (e: any) {
      console.error(e);
      setAiError(e.message || 'AI analysis error');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleParse() {
    setStatus(null);
    setAiError(null);
    const res = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input }),
    });
    const data: Fields = await res.json();
    setFields(data);
    if (data) analyzeParsedHand(data);
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
      else setStatus(data.error || 'Failed');
    } catch (e: any) {
      setStatus(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="wrap">
      <div className="header">
        <div className="title">Notion Poker Ingest</div>
        <div className="breadcrumb">Paste → <b>Send</b> → Analyze → Save</div>
      </div>

      <div className="grid">
        {/* Left card */}
        <section className="card">
          <div className="cardTitle">HAND PLAYED</div>
          <div className="textareaWrap">
            <textarea
              className="textarea"
              placeholder="Paste the hand history or describe the hand in plain English..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
          </div>

          <div className="actions">
            <button
              className="btnPrimary"
              onClick={handleParse}
              disabled={!input.trim() || aiLoading}
            >
              {aiLoading ? 'Analyzing…' : 'Send'}
            </button>
            <button
              className="btnGhost"
              onClick={() => { setFields(null); setInput(''); setStatus(null); setAiError(null); }}
            >
              Clear
            </button>
          </div>

          {status && <div className="meta">{status}</div>}
          {aiError && <div className="error">{aiError}</div>}
        </section>

        {/* Right card */}
        <section className="card">
          {/* HEADER — show TAGS as title; fallback to date */}
          <div className="rightHeader">
            <div className="tagsRow">
              {fields?.learning_tag?.length
                ? fields.learning_tag!.map(t => (
                    <span key={t} className="chipMain">{t}</span>
                  ))
                : <div className="bigTitle">{fields?.date || '—'}</div>
              }
            </div>
            <div className="rightMeta">
              {[fields?.stakes || '—', fields?.cards || '—'].filter(Boolean).join(' • ')}
            </div>
          </div>

          {/* Properties */}
          <PropertyRow name="Cards" value={fields?.cards ?? '—'} />
          <PropertyRow name="Date" value={fields?.date ?? '—'} />
          <PropertyRow name="Position" value={fields?.position ?? '—'} />
          <PropertyRow name="Stakes" value={fields?.stakes ?? '—'} />
          <PropertyRow name="Villain Action" value={fields?.villain_action ?? '—'} />

          <PropertyRow
            name="GTO Strategy"
            value={fields?.gto_strategy ?? ''}
            long
          />
          <PropertyRow
            name="Exploit Deviation"
            value={fields?.exploit_deviation ?? ''}
            long
          />

          <div className="row">
            <span className="label">Learning Tag</span>
            <div className="value">
              {(fields?.learning_tag ?? []).length === 0 ? (
                <span className="muted">—</span>
              ) : (
                (fields!.learning_tag ?? []).map(t => (
                  <span key={t} className="chip">{t}</span>
                ))
              )}
            </div>
          </div>

          <div className="footerActions">
            <button
              className="btnGhost"
              onClick={handleParse}
              disabled={!input.trim() || aiLoading}
            >
              Analyze Again
            </button>
            <button
              className="btnPrimary"
              onClick={handleSave}
              disabled={saving || !fields}
            >
              {saving ? 'Saving…' : 'Confirm & Save to Notion'}
            </button>
          </div>
        </section>
      </div>

      {/* Styles */}
      <style jsx>{`
        .wrap {
          min-height: 100vh;
          background: #f7f8fb;
          padding: 28px 20px 60px;
          color: #0f172a;
          font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Noto Sans;
        }
        .header { max-width: 1200px; margin: 0 auto 16px auto; }
        .title { font-size: 28px; font-weight: 800; }
        .breadcrumb { color: #6b7280; margin-top: 4px; }

        .grid {
          max-width: 1200px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }
        @media (max-width: 1100px) {
          .grid { grid-template-columns: 1fr; }
        }

        .card {
          background: #fff;
          border-radius: 16px;
          box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06);
          padding: 18px 18px 16px;
        }
        .cardTitle {
          font-weight: 700;
          letter-spacing: .02em;
          color: #0f1c55;
          margin: 6px 6px 12px;
        }
        .textareaWrap {
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          overflow: hidden;
          background: #fcfdff;
        }
        .textarea {
          width: 100%;
          min-height: 270px;
          resize: vertical;
          padding: 14px;
          line-height: 1.55;
          font-size: 16px;
          border: none;
          outline: none;
          background: transparent;
          color: #0f172a;
        }

        .actions {
          display: flex;
          gap: 12px;
          align-items: center;
          padding: 14px 4px 2px;
        }
        .btnPrimary {
          background: #2643ff;
          color: #fff;
          padding: 10px 18px;
          border-radius: 12px;
          border: none;
          box-shadow: 0 6px 18px rgba(38, 67, 255, .28);
          font-weight: 700;
          cursor: pointer;
        }
        .btnPrimary:disabled {
          opacity: .6;
          cursor: not-allowed;
          box-shadow: none;
        }
        .btnGhost {
          background: #fff;
          color: #0f172a;
          padding: 10px 16px;
          border-radius: 12px;
          border: 1px solid #e5e7eb;
          font-weight: 700;
          cursor: pointer;
        }

        .meta { margin: 10px 6px 0; color: #374151; font-size: 14px; }
        .error { margin: 10px 6px 0; color: #b91c1c; font-size: 14px; }

        .rightHeader {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 6px 6px 14px;
        }
        .tagsRow { display: flex; gap: 8px; flex-wrap: wrap; }
        .chipMain {
          background: #e9eeff;
          color: #2947f0;
          border-radius: 999px;
          font-weight: 700;
          padding: 6px 12px;
          font-size: 14px;
        }
        .bigTitle { font-size: 26px; font-weight: 800; }
        .rightMeta { color: #6b7280; margin-left: 10px; white-space: nowrap; }

        .row {
          display: grid;
          grid-template-columns: 160px 1fr;
          gap: 14px;
          align-items: flex-start;
          padding: 10px 6px;
          border-top: 1px dashed #edf0f6;
        }
        .label {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          height: 28px;
          padding: 0 12px;
          border-radius: 999px;
          background: #eef2ff;
          color: #1e2aa8;
          font-weight: 700;
          font-size: 13px;
          white-space: nowrap;
        }
        .value { color: #111827; line-height: 1.55; }
        .muted { color: #9ca3af; }

        .long { white-space: pre-wrap; }

        .chip {
          display: inline-flex;
          align-items: center;
          height: 28px;
          padding: 0 12px;
          border-radius: 999px;
          background: #f1f5f9;
          color: #0f172a;
          margin: 0 8px 8px 0;
          font-weight: 600;
          font-size: 13px;
        }

        .footerActions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          padding: 14px 6px 2px;
        }
      `}</style>
    </main>
  );
}

/** Property row with a pill label */
function PropertyRow({ name, value, long = false }: { name: string; value: string; long?: boolean }) {
  return (
    <div className="row">
      <span className="label">{name}</span>
      <div className={`value ${long ? 'long' : ''}`}>{value || <span className="muted">—</span>}</div>
    </div>
  );
}
