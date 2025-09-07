'use client';
import { useState } from 'react';

/* ---------- Types ---------- */
type Fields = {
  date?: string | null;
  stakes?: string | null;          // text like "1/3", "$2/$5"
  position?: string | null;
  cards?: string | null;
  villain_action?: string | null;
  gto_strategy?: string | null;
  exploit_deviation?: string | null;
  learning_tag?: string[];
  board?: string | null;
  notes?: string | null;
};

/* ============================================================
   PAGE
============================================================ */
export default function Page() {
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
          gto_strategy: data.gto_strategy || '',
          exploit_deviation: data.exploit_deviation || '',
          learning_tag: tags,
        };
      });
    } catch (e: any) {
      setAiError(e.message || 'AI analysis error');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSend() {
    if (!input.trim() || aiLoading) return;
    setStatus(null);
    setAiError(null);

    const res = await fetch('/api/parse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input })
    });

    const data: Fields = await res.json();
    setFields(data);
    if (data) analyzeParsedHand(data);
  }

  function handleAnalyzeAgain() {
    if (fields && !aiLoading) analyzeParsedHand(fields);
  }

  async function handleSave() {
    if (!fields) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
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
    <main className="np-page">
      <header className="np-hero">
        <div className="np-hero__inner">
          <h1>Notion Poker Ingest</h1>
          <p>Paste → <b>Send</b> → Analyze → Save</p>
        </div>
      </header>

      <div className="np-shell">
        <div className="np-grid">
          {/* LEFT CARD */}
          <section className="np-card">
            <div className="np-card__title">HAND PLAYED</div>

            <textarea
              className="np-text"
              placeholder="Paste the hand history or describe the hand in plain English..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />

            <div className="np-actions">
              <button className="np-btn np-btn--pill np-btn--primary" onClick={handleSend}>
                {aiLoading ? 'Sending…' : 'Send'}
              </button>
              <button
                className="np-btn np-btn--pill np-btn--ghost-danger"
                onClick={() => { setInput(''); setFields(null); setStatus(null); setAiError(null); }}
              >
                Clear
              </button>
            </div>

            {aiError && <div className="np-note np-note--error">⚠ {aiError}</div>}
            {status && <div className="np-note">{status}</div>}
          </section>

          {/* RIGHT CARD */}
          <section className="np-card np-card--soft">
            {!fields ? (
              <div className="np-empty">
                <div className="np-emoji">🃏</div>
                <div className="np-empty__title">Nothing parsed yet</div>
                <div className="np-empty__text">Paste a hand on the left and hit <b>Send</b>.</div>
              </div>
            ) : (
              <>
                <div className="np-topbar">
                  <div className="np-topbar__title">{fields.date || 'New Page'}</div>
                  <div className="np-topbar__meta">{(fields.stakes || '—')} • {fields.cards || '—'}</div>
                </div>

                <div className="np-rows">
                  <NPRow label="Cards">
                    <div className="np-val">{fields.cards || '—'}</div>
                  </NPRow>

                  <NPRow label="Date">
                    <div className="np-val">{fields.date || '—'}</div>
                  </NPRow>

                  <NPRow label="Exploit Deviation">
                    <div className="np-val np-val--clamp">{fields.exploit_deviation || '—'}</div>
                  </NPRow>

                  <NPRow label="GTO Strategy">
                    <div className="np-val np-val--clamp">{fields.gto_strategy || '—'}</div>
                  </NPRow>

                  <NPRow label="Learning Tag">
                    <NPTags
                      tags={fields.learning_tag ?? []}
                      onAdd={(t) => setFields({ ...fields!, learning_tag: [...(fields!.learning_tag ?? []), t] })}
                      onClear={() => setFields({ ...fields!, learning_tag: [] })}
                    />
                  </NPRow>

                  <NPRow label="Position">
                    <div className="np-val">{fields.position || '—'}</div>
                  </NPRow>

                  <NPRow label="Stakes">
                    <div className="np-val">{fields.stakes || '—'}</div>
                  </NPRow>

                  <NPRow label="Villain Action">
                    <div className="np-val">{fields.villain_action || '—'}</div>
                  </NPRow>
                </div>

                <div className="np-footer">
                  <button className="np-btn np-btn--pill np-btn--light" onClick={handleAnalyzeAgain}>
                    {aiLoading ? 'Analyzing…' : 'Analyze Again'}
                  </button>
                  <button className="np-btn np-btn--pill np-btn--primary" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Confirm & Save to Notion'}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {/* ------------- SCOPED STYLES (prefixed to ensure they apply) ------------- */}
      <style jsx>{`
        :root{
          --np-bg: #f6f7fb;
          --np-ink: #0f172a;
          --np-ink-2: #334155;
          --np-line: #e9edf7;
          --np-card: #ffffff;

          --np-blue: #1e3a8a;
          --np-blue-2: #1d4ed8;

          --np-chip-bg: #eef2ff;
          --np-chip-br: #c7d2fe;
          --np-chip-ink:#1e3a8a;

          --np-danger: #ef4444;
          --np-ghost-danger-bg:#fff1f1;
          --np-ghost-danger-ink:#b91c1c;
        }
        *{ box-sizing:border-box; }
        body{ background:var(--np-bg); color:var(--np-ink); }

        .np-page{ font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; }
        .np-hero{ padding: 22px 0 10px; }
        .np-hero__inner{ max-width:1100px; margin:0 auto; padding:0 20px; }
        .np-hero h1{ margin:0 0 4px 0; font-size:28px; }
        .np-hero p{ margin:0; color:var(--np-ink-2); }

        .np-shell{ max-width:1100px; margin:0 auto; padding:0 20px 28px; }
        .np-grid{ display:grid; gap:20px; grid-template-columns: 1fr 1fr; }
        @media (max-width: 980px){ .np-grid{ grid-template-columns: 1fr; } }

        .np-card{
          background: var(--np-card);
          border: 1px solid var(--np-line);
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 10px 24px rgba(2,6,23,.05);
        }
        .np-card--soft{ background:#fbfcff; }
        .np-card__title{ margin:6px 0 8px; font-size:12px; font-weight:900; letter-spacing:.35px; color:#1e40af; }

        .np-text{
          width:100%; height:360px; resize:vertical;
          padding:14px 16px; border-radius:12px; border:1px solid var(--np-line);
          background:#fff; color:var(--np-ink);
          outline:none; font-size:15px; line-height:1.55;
        }
        .np-text:focus{ border-color:#93c5fd; box-shadow: 0 0 0 3px rgba(59,130,246,.15); }

        .np-actions{ display:flex; gap:10px; margin-top:12px; }

        .np-btn{
          appearance:none; border:1px solid var(--np-line);
          padding:10px 15px; border-radius:10px; font-weight:800; cursor:pointer;
          transition: transform .03s ease, filter .15s ease, opacity .15s ease;
          color:var(--np-ink);
        }
        .np-btn--pill{ border-radius:999px; }
        .np-btn:hover{ transform: translateY(-1px); }
        .np-btn:active{ transform: translateY(0); }
        .np-btn--primary{
          color:#fff; border:none;
          background: linear-gradient(135deg, var(--np-blue), var(--np-blue-2));
          box-shadow: 0 6px 14px rgba(37,99,235,.28);
        }
        .np-btn--primary:disabled{
          background:#e6ecff; color:#26324d; box-shadow:none; border:1px solid #dfe7ff;
        }
        .np-btn--light{ background:#f2f6ff; color:#0f1c3a; border:1px solid #dbe6ff; }
        .np-btn--ghost-danger{
          color:var(--np-ghost-danger-ink);
          background: var(--np-ghost-danger-bg);
          border:1px solid #ffd3d3;
        }

        .np-note{ margin-top:10px; font-size:13px; color:var(--np-ink-2); }
        .np-note--error{ color: var(--np-danger); }

        .np-empty{ text-align:center; padding:42px 16px; color:var(--np-ink-2); }
        .np-emoji{ font-size:38px; margin-bottom:8px; }
        .np-empty__title{ font-weight:800; color:var(--np-ink); }
        .np-empty__text{ margin-top:6px; }

        .np-topbar{
          display:flex; justify-content:space-between; align-items:flex-start;
          padding: 6px 6px 10px 6px;
        }
        .np-topbar__title{ font-size:20px; font-weight:900; }
        .np-topbar__meta{ font-size:14px; color:var(--np-ink-2); }

        .np-rows{ margin-top:4px; }
        .np-row{ padding:14px 0; border-top:1px dashed var(--np-line); display:flex; gap:14px; align-items:flex-start; }
        .np-row:first-child{ border-top:none; padding-top:0; }

        .np-label{
          min-width:126px; display:inline-flex; align-items:center; justify-content:center;
          padding:7px 12px; border-radius:999px;
          background:var(--np-chip-bg); border:1px solid var(--np-chip-br); color:var(--np-chip-ink);
          font-size:12px; font-weight:900; letter-spacing:.3px; white-space:nowrap;
        }
        .np-val{ color:var(--np-ink); }
        .np-val--clamp{
          display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;
        }

        .np-tags{ display:flex; flex-wrap:wrap; gap:8px; margin-bottom:8px; }
        .np-pill{ background:#e0e7ff; color:#1e3a8a; border:1px solid #c7d2fe; padding:4px 10px; border-radius:999px; font-size:13px; font-weight:700; }
        .np-tagbar{ display:flex; gap:8px; }
        .np-tagInput{
          flex:1; padding:10px 12px; border-radius:999px; border:1px solid #dbe6ff;
          outline:none; background:#fff; color:var(--np-ink);
        }
        .np-tagBtn{ padding:9px 12px; border-radius:999px; border:1px solid #dbe6ff; background:#fff; font-weight:800; }
        .np-tagBtn:hover{ transform: translateY(-1px); }

        .np-footer{ margin-top:16px; display:flex; gap:10px; justify-content:flex-end; }
      `}</style>
    </main>
  );
}

/* ---------- Small UI helpers (prefixed) ---------- */

function NPRow({ label, children }: { label: string; children: any }) {
  return (
    <div className="np-row">
      <div className="np-label">{label}</div>
      <div style={{flex:1}}>{children}</div>
    </div>
  );
}

function NPTags({
  tags, onAdd, onClear
}: { tags: string[]; onAdd:(t:string)=>void; onClear:()=>void }) {
  const [text, setText] = useState('');
  return (
    <>
      <div className="np-tags">
        {tags.length ? tags.map((t, i) => <span key={i} className="np-pill">{t}</span>) :
          <span className="np-pill" style={{opacity:.65}}>No tags</span>}
      </div>
      <div className="np-tagbar">
        <input
          className="np-tagInput"
          placeholder="Add tag and press Enter"
          value={text}
          onChange={(e)=>setText(e.target.value)}
          onKeyDown={(e)=>{
            if (e.key === 'Enter' && text.trim()) { onAdd(text.trim()); setText(''); }
          }}
        />
        <button className="np-tagBtn" onClick={()=>{ if(text.trim()) { onAdd(text.trim()); setText(''); }}}>Add</button>
        <button className="np-tagBtn" onClick={onClear}>Clear</button>
      </div>
    </>
  );
}
