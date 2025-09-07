'use client';
import { useState } from 'react';

type Fields = {
  date?: string | null;
  stakes?: string | null;            // text like "1/3", "$2/$5"
  position?: string | null;
  cards?: string | null;
  villain_action?: string | null;
  gto_strategy?: string | null;
  exploit_deviation?: string | null;
  learning_tag?: string[];
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
      console.error(e);
      setAiError(e.message || 'AI analysis error');
    } finally {
      setAiLoading(false);
    }
  }

  async function handleSend() {
    if (aiLoading) return;
    if (!input.trim()) return; // keep button visible; guard here
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
    if (fields && !aiLoading) {
      analyzeParsedHand(fields);
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
    <main className="page">
      <header className="hero">
        <div className="hero__inner">
          <h1>Notion Poker Ingest</h1>
          <p>Paste → <b>Send</b> → Analyze → Save</p>
        </div>
      </header>

      <div className="shell">
        <div className="grid">
          {/* LEFT */}
          <section className="left card">
            <div className="card__title">HAND PLAYED</div>

            <textarea
              className="text"
              placeholder="Paste the hand history or describe the hand in plain English..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />

            <div className="actions">
              <button className="btn btn--pill btn--primary" onClick={handleSend}>
                {aiLoading ? 'Sending…' : 'Send'}
              </button>
              <button
                className="btn btn--pill btn--ghost-danger"
                onClick={() => { setFields(null); setInput(''); setStatus(null); setAiError(null); }}
              >
                Clear
              </button>
            </div>

            {aiError && <div className="note note--error">⚠ {aiError}</div>}
            {status && <div className="note">{status}</div>}
          </section>

          {/* RIGHT */}
          <section className="right card card--soft">
            {!fields ? (
              <div className="empty">
                <div className="emoji">🃏</div>
                <div className="empty__title">Nothing parsed yet</div>
                <div className="empty__text">Paste a hand on the left and hit <b>Send</b>.</div>
              </div>
            ) : (
              <>
                <div className="topbar">
                  <div className="topbar__title">{fields.date || 'New Page'}</div>
                  <div className="topbar__meta">
                    {(fields.stakes || '—')}{' • '}{fields.cards || '—'}
                  </div>
                </div>

                <div className="rows">
                  <Row label="Cards">
                    <div className="val">{fields.cards || '—'}</div>
                  </Row>

                  <Row label="Date">
                    <div className="val">{fields.date || '—'}</div>
                  </Row>

                  <Row label="Exploit Deviation">
                    <div className="val val--clamp">{fields.exploit_deviation || '—'}</div>
                  </Row>

                  <Row label="GTO Strategy">
                    <div className="val val--clamp">{fields.gto_strategy || '—'}</div>
                  </Row>

                  <Row label="Learning Tag">
                    <Tags
                      tags={fields.learning_tag ?? []}
                      onAdd={(t) => setFields({ ...fields!, learning_tag: [...(fields!.learning_tag ?? []), t] })}
                      onClear={() => setFields({ ...fields!, learning_tag: [] })}
                    />
                  </Row>

                  <Row label="Position">
                    <div className="val">{fields.position || '—'}</div>
                  </Row>

                  <Row label="Stakes">
                    <div className="val">{fields.stakes || '—'}</div>
                  </Row>

                  <Row label="Villain Action">
                    <div className="val">{fields.villain_action || '—'}</div>
                  </Row>
                </div>

                <div className="footer">
                  <button className="btn btn--pill btn--light" onClick={handleAnalyzeAgain}>
                    {aiLoading ? 'Analyzing…' : 'Analyze Again'}
                  </button>
                  <button className="btn btn--pill btn--primary" onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Confirm & Save to Notion'}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      <style jsx>{`
        :root{
          --bg: #f6f7fb;
          --ink: #0f172a;
          --ink-2: #334155;
          --line: #e9edf7;
          --card: #ffffff;

          --blue: #2563eb;
          --blue-2: #1d4ed8;
          --chip-bg: #eef2ff;
          --chip-br: #c7d2fe;
          --chip-ink:#1e3a8a;

          --danger: #ef4444;
          --ghost-danger-bg:#fff1f1;
          --ghost-danger-ink:#b91c1c;
        }

        *{ box-sizing: border-box; }
        body{ margin:0; background:var(--bg); color:var(--ink); font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; }

        .hero{ padding: 22px 0 10px; }
        .hero__inner{ max-width:1100px; margin:0 auto; padding:0 20px; }
        .hero h1{ margin:0 0 4px 0; font-size:28px; }
        .hero p{ margin:0; color:var(--ink-2); }

        .shell{ max-width:1100px; margin:0 auto; padding:0 20px 28px; }
        .grid{ display:grid; gap:20px; grid-template-columns: 1fr 1fr; }
        @media (max-width: 980px){ .grid{ grid-template-columns: 1fr; } }

        .card{
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 16px;
          padding: 16px;
          box-shadow: 0 10px 24px rgba(2,6,23,.04);
        }
        .card--soft{ background:#fbfcff; }

        .left .card__title{
          margin-top:4px;
          font-size:12px; font-weight:900; letter-spacing:.35px; color:#1e40af;
        }

        .text{
          width:100%; height:400px; resize:vertical;
          margin-top:10px;
          padding:14px 16px; border-radius:12px; border:1px solid var(--line);
          background:#fff; color:var(--ink);
          outline:none; font-size:15px; line-height:1.55;
        }
        .text:focus{ border-color: var(--blue); box-shadow: 0 0 0 3px rgba(37,99,235,.12); }

        .actions{ display:flex; gap:10px; margin-top:12px; }

        .btn{
          appearance:none; border:1px solid var(--line);
          padding:9px 14px; border-radius:10px; font-weight:800; cursor:pointer;
          transition: transform .03s ease, filter .15s ease;
        }
        .btn--pill{ border-radius:999px; }
        .btn:hover{ transform: translateY(-1px); }
        .btn:active{ transform: translateY(0); }
        .btn--primary{
          color:#fff; border:none; background: linear-gradient(135deg, var(--blue), var(--blue-2));
          box-shadow: 0 6px 14px rgba(37,99,235,.25);
        }
        .btn--light{
          background:#f3f6ff; color:#0f1c3a; border:1px solid #dfe7ff;
        }
        .btn--ghost-danger{
          color:var(--ghost-danger-ink);
          background: var(--ghost-danger-bg);
          border:1px solid #ffd3d3;
        }
        .btn--primary:disabled{
          background:#e5edff; color:#0f1c3a; box-shadow:none; border:1px solid #dbe6ff;
        }

        .note{ margin-top:10px; font-size:13px; color:var(--ink-2); }
        .note--error{ color: var(--danger); }

        .right .topbar{
          display:flex; justify-content:space-between; align-items:flex-start;
          padding: 6px 6px 2px 6px;
        }
        .topbar__title{ font-size:20px; font-weight:900; }
        .topbar__meta{ font-size:14px; color:var(--ink-2); }

        .rows{ margin-top:8px; }
        .row{ padding:14px 0; border-top:1px dashed var(--line); display:flex; gap:14px; align-items:flex-start; }
        .row:first-child{ border-top:none; padding-top:4px; }

        .label{
          min-width:126px; display:inline-flex; align-items:center; justify-content:center;
          padding:7px 12px; border-radius:999px;
          background:var(--chip-bg); border:1px solid var(--chip-br); color:var(--chip-ink);
          font-size:12px; font-weight:900; letter-spacing:.3px;
        }
        .val{ color:var(--ink); }
        .val--clamp{
          display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;
        }

        .tags{ display:flex; flex-wrap:wrap; gap:8px; margin-bottom:8px; }
        .pill{ background:#e0e7ff; color:#1e3a8a; border:1px solid #c7d2fe; padding:4px 10px; border-radius:999px; font-size:13px; font-weight:700; }
        .tagbar{ display:flex; gap:8px; }
        .tagInput{
          flex:1; padding:10px 12px; border-radius:999px; border:1px solid #dbe6ff;
          outline:none; background:#fff; color:var(--ink);
        }
        .tagBtn{ padding:9px 12px; border-radius:999px; border:1px solid #dbe6ff; background:#fff; font-weight:800; }
        .tagBtn:hover{ transform: translateY(-1px); }

        .footer{ margin-top:14px; display:flex; gap:10px; justify-content:flex-end; }
        .empty{ text-align:center; padding:42px 16px; color:var(--ink-2); }
        .emoji{ font-size:38px; margin-bottom:8px; }
        .empty__title{ font-weight:800; color:var(--ink); }
        .empty__text{ margin-top:6px; }
      `}</style>
    </main>
  );
}

/* ---------- UI helpers ---------- */

function Row({ label, children }: { label: string; children: any }) {
  return (
    <div className="row">
      <div className="label">{label}</div>
      <div style={{flex:1}}>{children}</div>
    </div>
  );
}

function Tags({
  tags, onAdd, onClear
}: { tags: string[]; onAdd:(t:string)=>void; onClear:()=>void }) {
  const [text, setText] = useState('');
  return (
    <>
      <div className="tags">
        {tags.length ? tags.map((t, i) => <span key={i} className="pill">{t}</span>) :
          <span className="pill" style={{opacity:.65}}>No tags</span>}
      </div>
      <div className="tagbar">
        <input
          className="tagInput"
          placeholder="Add tag and press Enter"
          value={text}
          onChange={(e)=>setText(e.target.value)}
          onKeyDown={(e)=>{
            if (e.key === 'Enter' && text.trim()) { onAdd(text.trim()); setText(''); }
          }}
        />
        <button className="tagBtn" onClick={()=>{ if(text.trim()) { onAdd(text.trim()); setText(''); }}}>Add</button>
        <button className="tagBtn" onClick={onClear}>Clear</button>
      </div>
    </>
  );
}
