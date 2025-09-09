'use client';

import React, { useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/** ---------------- Types ---------------- */
type Fields = {
  date?: string | null;
  stakes?: string | null;               // TEXT, not number
  position?: string | null;
  cards?: string | null;
  villain_action?: string | null;       // tolerated in payload but not shown on the right card
  villian_action?: string | null;       // (typo tolerated)
  gto_strategy?: string | null;
  exploit_deviation?: string | null;
  learning_tag?: string[];
  board?: string | null;
  notes?: string | null;
};

/** ------------- Helpers (same “code behind”) ------------- */
const asText = (v: any): string =>
  typeof v === 'string'
    ? v
    : v == null
      ? ''
      : Array.isArray(v)
        ? v.map(asText).join('\n')
        : typeof v === 'object'
          ? Object.entries(v).map(([k, val]) => `${k}: ${asText(val)}`).join('\n')
          : String(v);

/** Light parsing to prefill preview */
const SUIT_MAP: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const suitColor = (suit: string) => (suit === '♥' || suit === '♦' ? '#dc2626' : '#111827');
const suitify = (card: string) => {
  const m = card.replace(/\s+/g, '').match(/^([2-9TJQKA])([shdc♥♦♣♠])$/i);
  if (!m) return '';
  const r = m[1].toUpperCase();
  const s = m[2].toLowerCase();
  const suit = SUIT_MAP[s] || ('♥♦♣♠'.includes(s) ? s : '');
  return suit ? `${r}${suit}` : '';
};
const suitifyLine = (line: string) =>
  (line || '').replace(/[,|]/g, ' ')
    .split(/\s+/).filter(Boolean)
    .map(suitify).filter(Boolean).join(' ');

const parseStakes = (t: string) => {
  const m = t.match(/(\$?\d+(?:\.\d+)?)[\s]*[\/-][\s]*(\$?\d+(?:\.\d+)?)/);
  return m ? `${m[1]}/${m[2]}` : '';
};
const parsePosition = (t: string) => {
  const POS = ['UTG','UTG+1','UTG+2','MP','HJ','CO','BTN','SB','BB'];
  const up = t.toUpperCase();
  for (const p of POS) if (up.includes(p)) return p;
  if (/\bBUTTON\b/i.test(t)) return 'BTN';
  if (/\bCUTOFF\b/i.test(t)) return 'CO';
  return '';
};
const parseHeroCards = (t: string) => {
  const m = t.replace(/\s{2,}/g, ' ').match(/([2-9TJQKA][shdc♥♦♣♠])\s*([2-9TJQKA][shdc♥♦♣♠])/i);
  if (!m) return '';
  const a = suitify(m[1]); const b = suitify(m[2]);
  return a && b ? `${a} ${b}` : '';
};
const parseBoard = (t: string) => {
  const get3 = (c: string) => suitifyLine(c).split(' ').slice(0, 3).join(' ');
  const fm = t.match(/flop[^\n:]*[:\-]*\s*([^\n]+)/i);
  const tm = t.match(/turn[^\n:]*[:\-]*\s*([^\n]+)/i);
  const rm = t.match(/river[^\n:]*[:\-]*\s*([^\n]+)/i);
  let flop = fm ? get3(fm[1]) : '';
  let turn = tm ? suitifyLine(tm[1]).split(' ')[0] || '' : '';
  let river = rm ? suitifyLine(rm[1]).split(' ')[0] || '' : '';
  if (!flop || !turn || !river) {
    const all = suitifyLine(t).split(' ');
    if (all.length >= 5) {
      flop = flop || all.slice(0, 3).join(' ');
      turn = turn || all[3];
      river = river || all[4];
    }
  }
  return { flop, turn, river };
};
const CardSpan = ({ c }: { c: string }) =>
  !c ? null : <span style={{ fontWeight: 600, color: suitColor(c.slice(-1)) }}>{c}</span>;

/** ---------------- Component ---------------- */
export default function Page() {
  // INPUT
  const [input, setInput] = useState('');
  const [fields, setFields] = useState<Fields | null>(null);

  // Quick Card Assist (local preview + what we send in board)
  const [flopBox, setFlopBox] = useState('');
  const [turnBox, setTurnBox] = useState('');
  const [riverBox, setRiverBox] = useState('');

  // Async state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Lightweight parse for preview
  const preview = useMemo(() => ({
    stakes: parseStakes(input),
    position: parsePosition(input),
    heroCards: parseHeroCards(input),
    board: parseBoard(input),
  }), [input]);

  // What to show in the Board pills (card assist overrides)
  const flop = (suitifyLine(flopBox) || preview.board.flop || '').trim();
  const turn = (suitify(turnBox) || preview.board.turn || '').trim();
  const river = (suitify(riverBox) || preview.board.river || '').trim();

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  /** Call /api/analyze-hand; use input text; include board (assist) for context */
  async function analyzeParsedHand(parsed: Fields) {
    setAiError(null);
    setAiLoading(true);
    try {
      const payload = {
        // analysis should primarily use the input text (server prompt already expects a narrative)
        date: parsed.date ?? undefined,
        stakes: parsed.stakes ?? preview.stakes || undefined,
        position: parsed.position ?? preview.position || undefined,
        cards: parsed.cards ?? preview.heroCards || undefined,
        villainAction: parsed.villain_action ?? parsed.villian_action ?? undefined,
        // pass corrected board from the assist; analysis can use it as extra context
        board: [flop && `Flop: ${flop}`, turn && `Turn: ${turn}`, river && `River: ${river}`].filter(Boolean).join('  |  '),
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
      setAiError(e.message || 'AI analysis error');
    } finally {
      setAiLoading(false);
    }
  }

  /** Parse → then auto-run AI (same as before) */
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
      // (Board assist remains user-controlled; we do not overwrite boxes)
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

  /** Learning-tag chips */
  function TagChips() {
    const chips = fields?.learning_tag?.filter(Boolean) ?? [];
    if (!chips.length) return null;
    return (
      <div className="chips" aria-label="tags">
        {chips.map((t, i) => (
          <span className="chip" key={i}>{t}</span>
        ))}
      </div>
    );
  }

  /** Render */
  return (
    <main className="p-page">
      <div className="p-container">
        <header className="p-header">
          <h1 className="p-title">Hand Played</h1>
        </header>

        <section className="p-grid">
          {/* LEFT COLUMN */}
          <div className="p-col">
            <div className="p-card">
              <div className="p-cardTitle">Hand Entry (Natural Language)</div>
              <textarea
                className="p-textarea"
                placeholder="Type your hand like a story — stakes, position, cards, actions..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <div className="p-row p-gap">
                <button className="p-btn p-primary" onClick={handleParse} disabled={!input.trim() || aiLoading}>
                  {aiLoading ? 'Analyzing…' : 'Send'}
                </button>
                <button
                  className="p-btn"
                  onClick={() => { setInput(''); setFields(null); setStatus(null); setAiError(null); }}
                >
                  Clear
                </button>
              </div>
              {aiError && <div className="p-err">{aiError}</div>}
              {status && <div className="p-note">{status}</div>}
            </div>

            <div className="p-card">
              <div className="p-cardTitle">Quick Card Assist (optional)</div>
              <div className="p-assist">
                <input className="p-input" value={flopBox} onChange={(e)=>setFlopBox(e.target.value)} placeholder="Ks 7d 2c" />
                <input className="p-input" value={turnBox} onChange={(e)=>setTurnBox(e.target.value)} placeholder="9c" />
                <input className="p-input" value={riverBox} onChange={(e)=>setRiverBox(e.target.value)} placeholder="4h" />
              </div>
              <div className="p-help">If parsing guesses wrong, correct the board here — the preview updates instantly.</div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="p-col">
            <div className="p-card">
              <div className="p-topRow">
                <TagChips />
              </div>

              <div className="p-grid2">
                <InfoBox label="Cards">
                  <div className="p-cards">
                    {preview.heroCards
                      ? preview.heroCards.split(' ').map((c, i) => <span key={i} className="p-cardSpan"><CardSpan c={c} /></span>)
                      : <span className="p-muted">(not found)</span>
                    }
                  </div>
                </InfoBox>

                <InfoBox label="Date"><div>{today}</div></InfoBox>
                <InfoBox label="Position"><div>{preview.position || <span className="p-muted">(unknown)</span>}</div></InfoBox>
                <InfoBox label="Stakes"><div>{preview.stakes || <span className="p-muted">(unknown)</span>}</div></InfoBox>
              </div>
            </div>

            <div className="p-card">
              <div className="p-subTitle">Board</div>
              <div className="p-boardRow">
                <div className="p-pill">Flop:&nbsp;{
                  flop
                    ? flop.split(' ').map((c,i)=>(<span key={i} className="p-cardSpan"><CardSpan c={c} />{i<2?' ':''}</span>))
                    : <span className="p-muted">unknown</span>
                }</div>
                <div className="p-pill">Turn:&nbsp;{turn ? <CardSpan c={turn} /> : <span className="p-muted">unknown</span>}</div>
                <div className="p-pill">River:&nbsp;{river ? <CardSpan c={river} /> : <span className="p-muted">unknown</span>}</div>
              </div>
            </div>

            <div className="p-card">
              <div className="p-subTitle">GTO Strategy (detailed)</div>
              <textarea
                className="p-input p-mono"
                rows={8}
                placeholder="Preflop/Flop/Turn/River plan with sizes…"
                value={fields?.gto_strategy ?? ''}
                onChange={e => fields && setFields({ ...fields, gto_strategy: e.target.value })}
              />
            </div>

            <div className="p-card">
              <div className="p-subTitle">Exploitative Deviations</div>
              <ul className="p-list">
                {(fields?.exploit_deviation || '')
                  .split(/(?<=\.)\s+/)
                  .filter(Boolean)
                  .map((line, i) => <li key={i}>{line}</li>)
                }
              </ul>

              <div className="p-row p-end p-gapTop">
                <button
                  className="p-btn"
                  disabled={!fields || aiLoading}
                  onClick={() => fields && analyzeParsedHand(fields)}
                >
                  {aiLoading ? 'Analyzing…' : 'Analyze Again'}
                </button>
                <button
                  className="p-btn p-primary"
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

      {/* ------------- Styles (no Tailwind required) ------------- */}
      <style jsx global>{`
        :root{
          --bg1:#e5e7eb; --bg2:#f1f5f9; --bg3:#cbd5e1;         /* page gradient */
          --card1:#f8fafc; --card2:#e5e7eb; --card3:#f1f5f9;     /* card gradient */
          --border:#d1d5db; --line:#d8dde6;
          --text:#0f172a; --muted:#6b7280;
          --primary:#3b82f6; --primary2:#2563eb; --btnText:#f8fbff;
          --chipBg:#eef2ff; --chipBorder:#c7d2fe; --chipText:#1e3a8a;
          --pillBg:#ffffff; --pillBorder:#e5e7eb;
        }
        *{box-sizing:border-box}
        html,body{margin:0;padding:0;background:linear-gradient(135deg,var(--bg2),var(--bg1),var(--bg3));color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
        .p-page{min-height:100vh;padding:24px}
        .p-container{max-width:1200px;margin:0 auto}
        .p-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
        .p-title{margin:0;font-size:28px;font-weight:800;letter-spacing:.2px}
        .p-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
        @media (max-width:980px){.p-grid{grid-template-columns:1fr}}

        .p-col{display:flex;flex-direction:column;gap:24px}

        .p-card{
          background:linear-gradient(180deg,var(--card1),var(--card2) 60%,var(--card3));
          border:1px solid var(--border);
          border-radius:18px; padding:16px;
          box-shadow:0 10px 28px rgba(0,0,0,.08);
        }
        .p-cardTitle{font-size:13px;font-weight:700;letter-spacing:.15px;color:#334155;margin-bottom:10px}
        .p-subTitle{font-size:14px;font-weight:800;margin-bottom:10px;color:#111827}
        .p-textarea{
          width:100%; min-height:160px; resize:vertical; padding:12px 14px;
          border-radius:14px; border:1px solid var(--line); background:#ffffff; color:var(--text); font-size:15px; line-height:1.5;
        }

        .p-row{display:flex;align-items:center}
        .p-gap{gap:12px}
        .p-gapTop{margin-top:10px}
        .p-end{justify-content:flex-end}

        .p-btn{
          appearance:none; border:1px solid var(--line); background:#ffffff; color:var(--text);
          padding:10px 14px; border-radius:12px; cursor:pointer; transition:transform .02s ease, background .15s ease, border-color .15s ease;
        }
        .p-btn:hover{background:#f3f4f6}
        .p-btn:active{transform:translateY(1px)}
        .p-btn[disabled]{opacity:.55;cursor:not-allowed}
        .p-btn.p-primary{
          background:linear-gradient(180deg,var(--primary),var(--primary2));
          color:var(--btnText); border-color:#9db7ff;
          box-shadow:0 6px 18px rgba(59,130,246,.25);
        }
        .p-btn.p-primary:hover{filter:brightness(1.05)}

        .p-assist{display:grid;grid-template-columns:1fr 120px 120px;gap:10px}
        @media (max-width:560px){.p-assist{grid-template-columns:1fr}}
        .p-input{
          width:100%; padding:10px 12px; border-radius:12px; border:1px solid var(--line);
          background:#ffffff; color:var(--text); font-size:14.5px;
        }
        .p-input.p-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace; line-height:1.45}

        .p-help{margin-top:8px; font-size:12px; color:var(--muted)}
        .p-muted{color:var(--muted)}

        .p-topRow{display:flex; justify-content:space-between; align-items:center}
        .chips{display:flex; flex-wrap:wrap; gap:8px}
        .chip{
          background:var(--chipBg); border:1px solid var(--chipBorder); color:var(--chipText);
          padding:6px 10px; border-radius:999px; font-size:12.5px; letter-spacing:.2px;
        }

        .p-grid2{display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:8px}
        .ibox{background:#ffffff; border:1px solid var(--pillBorder); border-radius:12px; padding:10px 12px}
        .iboxLabel{font-size:11px; color:#6b7280; margin-bottom:3px}
        .iboxVal{font-size:14px}

        .p-boardRow{display:flex; flex-wrap:wrap; gap:10px; font-size:16px}
        .p-pill{
          background:var(--pillBg); border:1px solid var(--pillBorder);
          padding:8px 12px; border-radius:12px;
        }
        .p-cardSpan{margin-right:4px}

        .p-list{margin:0; padding-left:18px; display:flex; flex-direction:column; gap:6px}
        .p-note{margin-top:10px; color:#166534}
        .p-err{margin-top:10px; color:#b91c1c}
      `}</style>
    </main>
  );
}

/** Small info box used on the right-side top card */
function InfoBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ibox">
      <div className="iboxLabel">{label}</div>
      <div className="iboxVal">{children}</div>
    </div>
  );
}
