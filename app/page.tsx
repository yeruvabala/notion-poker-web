'use client';
import { useState } from 'react';

type Fields = {
  date?: string | null;
  stakes?: string | null;            // text (e.g., "1/3", "$2/$5")
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

  // ---------- AI: analyze parsed hand and fill GTO/Exploit/Tags ----------
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

  // ---------- Parse raw text with /api/parse, then call analyzer ----------
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

  // ---------- Save to Notion ----------
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
    <main className="page">
      <header className="hero">
        <div className="hero__inner">
          <h1>Notion Poker Ingest</h1>
          <p>Paste → Parse → Analyze → Save</p>
        </div>
      </header>

      <div className="shell">
        <div className="grid">
          {/* LEFT: Editor */}
          <section className="card">
            <div className="card__title">
              <span className="dot dot--green" />
              Hand Text
            </div>
            <textarea
              className="text"
              placeholder="Paste your hand history or notes…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <div className="actions">
              <button
                className="btn btn--primary"
                onClick={handleParse}
                disabled={!input.trim() || aiLoading}
              >
                {aiLoading ? 'Analyzing…' : 'Parse & Analyze'}
              </button>
              <button
                className="btn"
                onClick={() => { setFields(null); setInput(''); setStatus(null); setAiError(null); }}
              >
                Clear
              </button>
            </div>
            {aiError && <div className="note note--error">⚠ {aiError}</div>}
            {status && <div className="note">{status}</div>}
          </section>

          {/* RIGHT: Notion-style Preview */}
          <section className="card card--glass">
            {!fields ? (
              <div className="empty">
                <div className="emoji">🃏</div>
                <div className="empty__title">Nothing parsed yet</div>
                <div className="empty__text">Paste a hand on the left and click <b>Parse & Analyze</b>.</div>
              </div>
            ) : (
              <>
                <div className="titlebar">
                  <div className="title">
                    {fields.date || 'New Page'}
                  </div>
                  <div className="subtitle">
                    {(fields.stakes || '—') + ' • ' + (fields.cards || '—')}
                  </div>
                </div>

                <div className="props">
                  <Prop name="Cards">
                    <InlineInput
                      value={fields.cards ?? ''}
                      onChange={(v) => setFields({ ...fields, cards: v })}
                      placeholder="A♠K♦"
                    />
                  </Prop>

                  <Prop name="Date">
                    <InlineInput
                      type="date"
                      value={fields.date ?? ''}
                      onChange={(v) => setFields({ ...fields, date: v })}
                    />
                  </Prop>

                  <Prop name="Exploit Deviation">
                    <InlineArea
                      value={fields.exploit_deviation ?? ''}
                      onChange={(v) => setFields({ ...fields, exploit_deviation: v })}
                      placeholder="Short, practical exploit notes…"
                    />
                  </Prop>

                  <Prop name="GTO Strategy">
                    <InlineArea
                      value={fields.gto_strategy ?? ''}
                      onChange={(v) => setFields({ ...fields, gto_strategy: v })}
                      placeholder={`Preflop: …\nFlop: …\nTurn: …\nRiver: …`}
                    />
                  </Prop>

                  <Prop name="Learning Tag">
                    <TagEditor
                      tags={fields.learning_tag ?? []}
                      onChange={(arr) => setFields({ ...fields, learning_tag: arr })}
                    />
                  </Prop>

                  <Prop name="Position">
                    <InlineInput
                      value={fields.position ?? ''}
                      onChange={(v) => setFields({ ...fields, position: v })}
                      placeholder="SB / BB / BTN…"
                    />
                  </Prop>

                  <Prop name="Stakes">
                    <InlineInput
                      value={fields.stakes ?? ''}
                      onChange={(v) => setFields({ ...fields, stakes: v })}
                      placeholder="1/3"
                    />
                  </Prop>

                  <Prop name="Villain Action">
                    <InlineArea
                      value={fields.villain_action ?? ''}
                      onChange={(v) => setFields({ ...fields, villain_action: v })}
                      placeholder="Raise to…, calls 3-bet…, etc."
                    />
                  </Prop>
                </div>

                <div className="save">
                  <button
                    className="btn btn--success"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? 'Saving…' : 'Confirm & Save to Notion'}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>

      {/* -------- STYLES (no Tailwind required) -------- */}
      <style jsx>{`
        :root{
          --bg: #0b1020;
          --ink: #0f172a;
          --ink-2: #334155;
          --ink-3: #64748b;
          --card: #ffffff;
          --glass: rgba(255,255,255,0.08);
          --line: rgba(15,23,42,0.08);
          --brand: #6366f1;
          --brand-2: #22d3ee;
          --accent: #10b981;
          --danger: #ef4444;
        }
        *{ box-sizing: border-box; }
        body{ margin:0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; background:#0b1020; color:#0b1020; }

        .page{ min-height:100vh; }
        .hero{
          background:
            radial-gradient(1200px 500px at 20% -10%, rgba(34,211,238,.25), transparent 60%),
            radial-gradient(1200px 500px at 80% -10%, rgba(99,102,241,.25), transparent 60%),
            linear-gradient(180deg, #0b1020 0%, #0b1020 60%, #0e1326 100%);
          padding: 52px 0 24px;
          color: #e5e7eb;
          border-bottom: 1px solid rgba(255,255,255,.08);
        }
        .hero__inner{ max-width:1100px; margin:0 auto; padding:0 20px; }
        .hero h1{ margin:0; font-size:28px; letter-spacing:.2px; }
        .hero p{ margin:6px 0 0; opacity:.8; }

        .shell{ max-width:1100px; margin:-28px auto 48px; padding:0 20px; }
        .grid{
          display:grid; gap:22px;
          grid-template-columns: 1fr 1fr;
        }
        @media (max-width: 980px){
          .grid{ grid-template-columns: 1fr; }
        }

        .card{
          background: var(--card);
          border: 1px solid var(--line);
          border-radius: 18px;
          padding: 18px;
          box-shadow:
            0 10px 30px rgba(2,6,23,.08),
            0 2px 6px rgba(2,6,23,.06);
        }
        .card--glass{
          background: linear-gradient(180deg, rgba(255,255,255,.8), rgba(255,255,255,.75));
          backdrop-filter: blur(6px);
        }

        .card__title{
          font-size:13px; font-weight:600; color:var(--ink-2);
          display:flex; align-items:center; gap:8px; margin-bottom:10px;
          letter-spacing:.2px; text-transform:uppercase;
        }
        .dot{ width:8px; height:8px; border-radius:50%; background:#94a3b8; }
        .dot--green{ background: var(--accent); }

        .text{
          width:100%; height:420px; resize:vertical;
          padding:14px 16px; border-radius:12px; border:1px solid var(--line);
          background:#fbfbfd; color:var(--ink);
          outline:none; font-size:15px; line-height:1.45;
        }
        .text:focus{ border-color: var(--brand); box-shadow: 0 0 0 3px rgba(99,102,241,.15); }

        .actions{ display:flex; gap:10px; margin-top:12px; }
        .btn{
          appearance:none; border:1px solid var(--line); background:#fff;
          color:var(--ink); padding:10px 14px; border-radius:12px;
          font-weight:600; cursor:pointer;
        }
        .btn:hover{ background:#f8fafc; }
        .btn:disabled{ opacity:.6; cursor:not-allowed; }
        .btn--primary{ background: linear-gradient(135deg, var(--brand), #7c83ff); color:#fff; border:none; }
        .btn--primary:hover{ filter: brightness(1.05); }
        .btn--success{ background: linear-gradient(135deg, var(--accent), #34d399); color:#fff; border:none; }
        .btn--success:hover{ filter: brightness(1.05); }

        .note{ margin-top:10px; font-size:13px; color:var(--ink-2); }
        .note--error{ color: var(--danger); }

        .empty{ text-align:center; padding:40px 16px; color:var(--ink-3); }
        .emoji{ font-size:38px; margin-bottom:8px; }
        .empty__title{ font-weight:700; color:var(--ink); }
        .empty__text{ margin-top:6px; }

        .titlebar{ padding:4px 6px 2px; }
        .title{ font-size:22px; font-weight:700; color:var(--ink); }
        .subtitle{ margin-top:4px; color:var(--ink-3); font-size:14px; }

        .props{ margin-top:16px; display:flex; flex-direction:column; gap:10px; }
        .prop{
          display:flex; gap:14px; align-items:flex-start;
          padding:10px 8px; border-radius:12px;
        }
        .prop:hover{ background:#f6f7fb; }
        .prop__name{ width:140px; min-width:140px; color:var(--ink-3); font-weight:600; }
        .prop__value{ flex:1; }

        .inline{
          min-height:40px; padding:10px 12px; border-radius:10px;
          border:1px dashed transparent; cursor:text; color:var(--ink);
          background:transparent; line-height:1.45;
        }
        .inline--ghost{ color:#9aa3b2; }
        .inline:focus{ outline:none; border-color: var(--brand); background:#fff; }

        .area{
          width:100%; min-height:84px; resize:vertical; padding:12px 12px;
          border-radius:10px; border:1px solid var(--line); background:#fff; color:var(--ink);
          line-height:1.45; outline:none;
        }
        .area:focus{ border-color: var(--brand); box-shadow: 0 0 0 3px rgba(99,102,241,.12); }

        .tags{ display:flex; flex-wrap:wrap; gap:8px; }
        .pill{
          background:#eef2ff; color:#3730a3; border:1px solid #c7d2fe;
          padding:4px 10px; border-radius:999px; font-size:13px; font-weight:600;
        }
        .pill--muted{ background:#f1f5f9; color:#0f172a; border-color:#e2e8f0; }

        .tagEdit{
          margin-top:8px; display:flex; gap:8px;
        }
        .tagInput{
          flex:1; padding:10px 12px; border-radius:10px; border:1px solid var(--line);
          outline:none; background:#fff; color:var(--ink);
        }
        .save{ margin-top:14px; }
      `}</style>
    </main>
  );
}

/* ---------- “Notion-like” property rows & editors ---------- */

function Prop({ name, children }: { name: string; children: any }) {
  return (
    <div className="prop">
      <div className="prop__name">{name}</div>
      <div className="prop__value">{children}</div>
    </div>
  );
}

function InlineInput({
  value, onChange, placeholder = '', type = 'text'
}: { value: string; onChange: (v: string) => void; placeholder?: string; type?: 'text'|'date' }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <input
        className="inline"
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e)=>onChange(e.target.value)}
        onBlur={()=>setEditing(false)}
        autoFocus
      />
    );
  }
  return (
    <div
      className={`inline ${value ? '' : 'inline--ghost'}`}
      onClick={()=>setEditing(true)}
    >
      {value || '—'}
    </div>
  );
}

function InlineArea({
  value, onChange, placeholder = ''
}: { value: string; onChange: (v: string)=>void; placeholder?: string }) {
  const [editing, setEditing] = useState(false);
  if (editing) {
    return (
      <textarea
        className="area"
        value={value}
        placeholder={placeholder}
        onChange={(e)=>onChange(e.target.value)}
        onBlur={()=>setEditing(false)}
        autoFocus
      />
    );
  }
  return (
    <div
      className={`inline ${value ? '' : 'inline--ghost'}`}
      onClick={()=>setEditing(true)}
      style={{whiteSpace:'pre-wrap'}}
    >
      {value || '—'}
    </div>
  );
}

function TagEditor({
  tags, onChange
}: { tags: string[]; onChange:(arr:string[])=>void }) {
  const [text, setText] = useState('');
  const pills = (tags || []).map((t, i) => (
    <span key={i} className="pill">{t}</span>
  ));
  return (
    <>
      <div className="tags">
        {pills.length ? pills : <span className="pill pill--muted">No tags</span>}
      </div>
      <div className="tagEdit">
        <input
          className="tagInput"
          placeholder="Add tag and press Enter…"
          value={text}
          onChange={(e)=>setText(e.target.value)}
          onKeyDown={(e)=>{
            if (e.key === 'Enter' && text.trim()) {
              onChange([...(tags||[]), text.trim()]);
              setText('');
            }
          }}
        />
        <button
          className="btn"
          onClick={()=>{
            if (text.trim()) {
              onChange([...(tags||[]), text.trim()]);
              setText('');
            }
          }}
        >Add</button>
        {!!(tags && tags.length) && (
          <button
            className="btn"
            onClick={()=>onChange([])}
            title="Clear all tags"
          >Clear</button>
        )}
      </div>
    </>
  );
}
