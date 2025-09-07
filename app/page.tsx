'use client';
import { useState } from 'react';

type Fields = {
  date?: string | null;
  stakes?: string | number | null;
  position?: string | null;
  cards?: string | null;
  villain_action?: string | null;
  gto_strategy?: string | null;
  exploit_deviation?: string | null;
  learning_tag?: string[] | null;
};

export default function Home() {
  const [input, setInput] = useState('');
  const [fields, setFields] = useState<Fields | null>(null);

  const [sending, setSending] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  async function handleSend() {
    setStatus(null);
    setAiError(null);
    setSending(true);
    try {
      // 1) Parse
      const r = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      });
      const parsed = (await r.json()) as Fields;
      setFields(parsed);

      // 2) Analyze to fill GTO / Exploit / Tags
      if (parsed) {
        await analyzeParsedHand(parsed);
      }
    } catch (e: any) {
      setStatus(e?.message || 'Failed to parse');
    } finally {
      setSending(false);
    }
  }

  async function analyzeParsedHand(parsed: Fields) {
    setAiBusy(true);
    setAiError(null);
    try {
      const payload = {
        date: parsed.date ?? undefined,
        stakes: parsed.stakes ?? undefined,
        position: parsed.position ?? undefined,
        cards: parsed.cards ?? undefined,
        villainAction: parsed.villain_action ?? undefined,
        board: '',
        notes: '',
      };
      const r = await fetch('/api/analyze-hand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err?.error || `Analyze failed (${r.status})`);
      }

      const data = await r.json();
      const tags: string[] =
        Array.isArray(data.learning_tag)
          ? data.learning_tag
          : typeof data.learning_tag === 'string'
            ? data.learning_tag.split(',').map((s: string) => s.trim()).filter(Boolean)
            : [];

      setFields(prev => ({
        ...(prev ?? {}),
        gto_strategy: data.gto_strategy || '',
        exploit_deviation: data.exploit_deviation || '',
        learning_tag: tags,
      }));
    } catch (e: any) {
      setAiError(e?.message || 'Failed to analyze hand');
    } finally {
      setAiBusy(false);
    }
  }

  async function handleSave() {
    if (!fields) return;
    setSaveLoading(true);
    setStatus(null);
    try {
      const r = await fetch('/api/notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
      const data = await r.json();
      if (data.ok) setStatus(`Saved! Open in Notion: ${data.url}`);
      else setStatus(data.error || 'Failed to save to Notion');
    } catch (e: any) {
      setStatus(e?.message || 'Save failed');
    } finally {
      setSaveLoading(false);
    }
  }

  function clearAll() {
    setInput('');
    setFields(null);
    setStatus(null);
    setAiError(null);
  }

  const tagChips = fields?.learning_tag?.filter(Boolean) ?? [];

  return (
    <main className="page">
      <div className="container">
        <header className="brand">
          <h1>Notion Poker Ingest</h1>
          <div className="crumbs">Paste <span>→</span> <b>Send</b> <span>→</span> Analyze <span>→</span> Save</div>
        </header>

        <section className="grid">
          {/* LEFT PANEL */}
          <div className="panel">
            <div className="panel-title">HAND PLAYED</div>
            <div className="editor">
              <textarea
                aria-label="Hand text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Paste the hand history or describe the hand in plain English..."
              />
            </div>
            <div className="panel-actions">
              <button className="btn btn-primary" onClick={handleSend} disabled={!input.trim() || sending}>
                {sending ? 'Sending…' : 'Send'}
              </button>
              <button className="btn btn-ghost" onClick={clearAll}>Clear</button>
            </div>
            {(status || aiError) && (
              <div className={`status ${aiError ? 'is-error' : ''}`}>{aiError || status}</div>
            )}
          </div>

          {/* RIGHT PANEL */}
          <div className="card">
            <div className="card-head">
              <div className="chips">
                {tagChips.length > 0
                  ? tagChips.map((t) => <span key={t} className="chip">{t}</span>)
                  : <span className="chip chip-muted">Tags</span>}
              </div>
              <div className="meta">
                {fields?.stakes ? <span>{String(fields.stakes)}</span> : <span>—</span>}
                <span>•</span>
                {fields?.cards ? <span>{fields.cards}</span> : <span>—</span>}
              </div>
            </div>

            <KV label="Cards">{fields?.cards || '—'}</KV>
            <KV label="Position">{fields?.position || '—'}</KV>
            <KV label="Stakes">{fields?.stakes ? String(fields.stakes) : '—'}</KV>
            <KV label="Villain Action">{fields?.villain_action || '—'}</KV>

            <KV label="GTO Strategy">
              <div className="valueBox">{fields?.gto_strategy || (aiBusy ? 'Analyzing…' : '—')}</div>
            </KV>

            <KV label="Exploit Deviation">
              <div className="valueBox">{fields?.exploit_deviation || (aiBusy ? 'Analyzing…' : '—')}</div>
            </KV>

            <div className="card-actions">
              <button className="btn btn-ghost" onClick={() => fields && analyzeParsedHand(fields)} disabled={!fields || aiBusy}>
                {aiBusy ? 'Analyzing…' : 'Analyze Again'}
              </button>
              <button className="btn btn-strong" onClick={handleSave} disabled={!fields || saveLoading}>
                {saveLoading ? 'Saving…' : 'Confirm & Save to Notion'}
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Styles — all here so the format stays consistent */}
      <style jsx global>{`
        :root{
          --bg:#0b1020;
          --card:#ffffff;
          --ink:#0f172a;
          --muted:#6b7280;
          --ring:rgba(15,23,42,.08);
          --pill:#eef2ff;
          --pill-ink:#3730a3;
          --chip:#eef6ff;
          --chip-ink:#0b5fd7;
          --primary:#2d55ff;
          --primary-ink:#ffffff;
          --ghost:#e5e7eb;
          --ghost-ink:#111827;
          --value-bg:#f8fafc;
          --value-ring:#e5e7eb;
          --error:#c1121f;
        }
        *{box-sizing:border-box}
        body{margin:0;background:#f6f7fb;color:var(--ink);font:16px/1.45 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
        .page{padding:32px 20px}
        .container{max-width:1200px;margin:0 auto}
        .brand h1{margin:0 0 6px 0;font-size:28px;font-weight:800;letter-spacing:.2px}
        .crumbs{color:var(--muted);margin-bottom:18px}
        .crumbs span{margin:0 .35rem;color:#9ca3af}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
        @media (max-width:1000px){.grid{grid-template-columns:1fr;}}
        .panel{
          background:var(--card);
          border-radius:18px;
          box-shadow:0 10px 24px rgba(2,6,23,.04), 0 1px 0 var(--ring);
          padding:18px;
        }
        .panel-title{font-size:13px;font-weight:800;letter-spacing:.08em;color:#374151;margin:6px 6px 10px}
        .editor{padding:8px 10px;border-radius:14px;border:1px solid var(--ring);background:#fff;overflow:hidden}
        .editor textarea{
          width:100%;height:320px;border:0;outline:0;resize:vertical;
          font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
          font-size:16px;line-height:1.55;color:#0b1220;background:#fff;
        }
        .panel-actions{display:flex;gap:12px;align-items:center;margin:12px 4px 0}
        .card{
          background:var(--card);
          border-radius:18px;
          box-shadow:0 10px 24px rgba(2,6,23,.04), 0 1px 0 var(--ring);
          padding:18px;
        }
        .card-head{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px}
        .chips{display:flex;gap:8px;flex-wrap:wrap}
        .chip{
          background:var(--chip);color:var(--chip-ink);
          padding:.35rem .6rem;border-radius:999px;font-size:13px;font-weight:700;
          box-shadow:inset 0 0 0 1px rgba(11,95,215,.18);
        }
        .chip-muted{background:#f3f4f6;color:#6b7280;box-shadow:inset 0 0 0 1px #e5e7eb}
        .meta{display:flex;gap:8px;color:var(--muted);font-weight:600}
        .kv{padding:10px 12px;border-radius:14px;border:1px solid var(--ring);background:#fff;display:grid;grid-template-columns:auto 1fr;gap:12px;align-items:start;margin:8px 0}
        .pill{
          background:var(--pill);color:var(--pill-ink);
          padding:.25rem .6rem;border-radius:999px;font-size:12px;font-weight:800;letter-spacing:.04em;white-space:nowrap;
          box-shadow:inset 0 0 0 1px rgba(55,48,163,.2);
        }
        .kv .val{font-weight:600;color:#0f172a}
        .valueBox{
          background:var(--value-bg);
          border-radius:12px;
          padding:10px 12px;
          border:1px solid var(--value-ring);
          white-space:pre-line;
          line-height:1.5;
          color:#0f172a;
        }
        .card-actions{display:flex;gap:12px;justify-content:flex-end;margin-top:12px}
        .btn{
          appearance:none;border:0;border-radius:999px;padding:.65rem 1rem;font-weight:800;letter-spacing:.02em;cursor:pointer;transition:transform .02s ease;
        }
        .btn:active{transform:translateY(1px)}
        .btn-primary{background:var(--primary);color:var(--primary-ink);box-shadow:0 6px 14px rgba(45,85,255,.22)}
        .btn-ghost{background:var(--ghost);color:var(--ghost-ink)}
        .btn-strong{background:#0b5fd7;color:#fff;box-shadow:0 6px 14px rgba(11,95,215,.22)}
        .status{margin-top:10px;color:#0b5fd7;font-weight:700}
        .status.is-error{color:var(--error)}
      `}</style>
    </main>
  );
}

function KV({ label, children }: { label: string; children: any }) {
  return (
    <div className="kv">
      <span className="pill">{label}</span>
      <div className="val">{children}</div>
    </div>
  );
}
