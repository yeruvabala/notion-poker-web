'use client';

import React, { useMemo, useState, useEffect } from 'react';

/** ---------------- Types ---------------- */
type Fields = {
  date?: string | null;
  stakes?: string | null;
  position?: string | null;
  cards?: string | null;
  villain_action?: string | null;
  villian_action?: string | null; // tolerate common typo
  gto_strategy?: string | null;
  exploit_deviation?: string | null;
  learning_tag?: string[];
  board?: string | null;
  notes?: string | null;
};

/** ---------------- Small utils ---------------- */
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

/** ---------------- Suit helpers (canonical + color) ---------------- */
const SUITS: Record<string, string> = {
  s: '♠', spade: '♠', spades: '♠', '♠': '♠',
  h: '♥', heart: '♥', hearts: '♥', '♥': '♥',
  d: '♦', diamond: '♦', diamonds: '♦', '♦': '♦',
  c: '♣', club: '♣', clubs: '♣', '♣': '♣',
};
const RANKS_SET = new Set(['2','3','4','5','6','7','8','9','T','J','Q','K','A']);

function suitChar(x: string): string {
  const k = (x || '').toLowerCase().trim();
  return SUITS[k] || '';
}

/** "Ks", "K s", "K♠", "K of spades" → "K♠" ('' if invalid) */
function canonicalizeCardToken(token: string): string {
  const t = (token || '').replace(/\s+/g, ' ').trim();
  if (!t) return '';

  // "K s" / "Ks" / "K♠"
  const m1 = t.match(/^([2-9TJQKA])\s*([shdc♠♥♦♣])$/i);
  if (m1) {
    const r = m1[1].toUpperCase();
    const s = suitChar(m1[2]);
    return (RANKS_SET.has(r) && s) ? `${r}${s}` : '';
  }
  // "K of spades"
  const m2 = t.match(/^([2-9TJQKA])(?:\s+of)?\s+(spades?|hearts?|diamonds?|clubs?)$/i);
  if (m2) {
    const r = m2[1].toUpperCase();
    const s = suitChar(m2[2]);
    return (RANKS_SET.has(r) && s) ? `${r}${s}` : '';
  }
  // Already "K♠"
  const m3 = t.match(/^([2-9TJQKA])(♠|♥|♦|♣)$/);
  if (m3) {
    const r = m3[1].toUpperCase();
    const s = m3[2];
    return (RANKS_SET.has(r) && s) ? `${r}${s}` : '';
  }
  // Squashed "Ks"
  const m4 = t.match(/^([2-9TJQKA])([shdc])$/i);
  if (m4) {
    const r = m4[1].toUpperCase();
    const s = suitChar(m4[2]);
    return (RANKS_SET.has(r) && s) ? `${r}${s}` : '';
  }
  return '';
}

function cardSuitClass(card: string) {
  const s = (card || '').slice(-1);
  return (s === '♥' || s === '♦') ? 'red' : 'blk';
}

function splitTwoCards(cards: string): [string, string] {
  const parts = (cards || '').trim().split(/\s+/).slice(0, 2);
  const a = canonicalizeCardToken(parts[0] || '');
  const b = canonicalizeCardToken(parts[1] || '');
  return [a, b];
}

const suitColor = (suit: string) => (suit === '♥' || suit === '♦' ? '#dc2626' : '#111827');
const CardSpan = ({ c }: { c: string }) =>
  !c ? null : <span style={{ fontWeight: 600, color: suitColor(c.slice(-1)) }}>{c}</span>;

/** ---------------- Light parsing (for preview only) ---------------- */
const parseStakes = (t: string) => {
  const m = t.match(/(\$?\d+(?:\.\d+)?)[\s]*[\/-][\s]*(\$?\d+(?:\.\d+)?)/);
  return m ? `${m[1]}/${m[2]}` : '';
};
const parseHeroPosition = (t: string) => {
  const up = (t || '').toUpperCase();
  const m1 = up.match(/\b(I|I'M|IM|I AM|HERO)\b[^.]{0,40}?\b(ON|FROM|IN)\s+(UTG\+\d|UTG|MP|HJ|CO|BTN|SB|BB)\b/);
  if (m1) return m1[3];
  const m2 = up.match(/\bON\s+(SB|BB|BTN|CO|HJ|MP|UTG(?:\+\d)?)\b/);
  if (m2) return m2[1];
  const PREF = ['SB','BB','BTN','CO','HJ','MP','UTG+2','UTG+1','UTG'];
  for (const p of PREF) if (up.includes(` ${p} `)) return p;
  return '';
};
// permissive: finds two tokens that look like cards anywhere
const parseHeroCardsSmart = (t: string) => {
  const s = (t || '').toLowerCase();
  const m = s.match(/([2-9tjqka][shdc♠♥♦♣])\s+([2-9tjqka][shdc♠♥♦♣])/i);
  if (m) {
    const a = canonicalizeCardToken(m[1]); const b = canonicalizeCardToken(m[2]);
    return [a,b].filter(Boolean).join(' ');
  }
  return '';
};
function suitifyLine(line: string) {
  return (line || '').trim().split(/\s+/).map(canonicalizeCardToken).filter(Boolean).join(' ');
}
const parseBoard = (t: string) => {
  const get3 = (c: string) => suitifyLine(c).split(' ').slice(0, 3).join(' ');
  const fm = t.match(/flop[^\n:]*[:\-]*\s*([^\n]+)/i);
  const tm = t.match(/turn[^\n:]*[:\-]*\s*([^\n]+)/i);
  const rm = t.match(/river[^\n:]*[:\-]*\s*([^\n]+)/i);
  let flop = fm ? get3(fm[1]) : '';
  let turn = tm ? suitifyLine(tm[1]).split(' ')[0] || '' : '';
  let river = rm ? suitifyLine(rm[1]).split(' ')[0] || '' : '';
  return { flop, turn, river };
}
const parseBoardFromText = (line: string) => {
  const arr = suitifyLine(line).split(' ').filter(Boolean);
  return { flop: arr.slice(0,3).join(' ') || '', turn: arr[3] || '', river: arr[4] || '' };
};
const twoCardsFrom = (line: string) => suitifyLine(line).split(' ').slice(0, 2).join(' ');

/** ---------------- Editable Card Pill ---------------- */
function CardPillEditable({
  value,
  onChange,
  placeholder = '—'
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  const [raw, setRaw] = useState(value);
  useEffect(() => { setRaw(value); }, [value]);

  function commit(v: string) {
    const canon = canonicalizeCardToken(v);
    onChange(canon); // '' allowed
    setRaw(canon || '');
  }
  return (
    <div className="cardPill">
      <input
        className={`cardIn ${cardSuitClass(raw)}`}
        value={raw}
        placeholder={placeholder}
        onChange={(e) => setRaw(e.target.value)}
        onBlur={() => commit(raw)}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        spellCheck={false}
      />
    </div>
  );
}

/** ---------------- Page ---------------- */
export default function Page() {
  // INPUT & parsed fields
  const [input, setInput] = useState('');
  const [fields, setFields] = useState<Fields | null>(null);

  // Assists (source of truth when present)
  const [heroAssist, setHeroAssist] = useState('');     // e.g., "Ks Kd"
  const [boardAssist, setBoardAssist] = useState('');   // e.g., "Js Ts 4c 9c 3s"
  const [villainAssist, setVillainAssist] = useState(''); // optional pass-through

  // Async
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Preview from free text (very light)
  const preview = useMemo(() => ({
    stakes: parseStakes(input),
    position: parseHeroPosition(input),
    heroCards: parseHeroCardsSmart(input),
    board: parseBoard(input),
  }), [input]);

  // Resolve effective hero cards (assist wins)
  const heroCards = (twoCardsFrom(heroAssist) || fields?.cards || preview.heroCards || '').trim();

  // Resolve board (assist wins)
  const boardFromAssist = parseBoardFromText(boardAssist);
  const flop = (boardAssist ? boardFromAssist.flop : preview.board.flop) || '';
  const turn = (boardAssist ? boardFromAssist.turn : preview.board.turn) || '';
  const river = (boardAssist ? boardFromAssist.river : preview.board.river) || '';

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  /** ---- API calls ---- */
  async function analyzeParsedHand(parsed: Fields) {
    setAiError(null);
    setAiLoading(true);
    try {
      const payload = {
        date: parsed.date ?? undefined,
        stakes: parsed.stakes ?? (preview.stakes || undefined),
        position: parsed.position ?? (preview.position || undefined),
        cards: parsed.cards ?? (heroCards || undefined),
        villainAction: parsed.villain_action ?? parsed.villian_action ?? undefined,
        board: [flop && `Flop: ${flop}`, turn && `Turn: ${turn}`, river && `River: ${river}`].filter(Boolean).join('  |  '),
        notes: parsed.notes ?? input,
        rawText: input
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

  /** ---- UI ---- */
  function TagChips() {
    const chips = fields?.learning_tag?.filter(Boolean) ?? [];
    if (!chips.length) return null;
    return (
      <div className="chips" aria-label="tags">
        {chips.map((t, i) => <span className="chip" key={i}>{t}</span>)}
      </div>
    );
  }

  return (
    <main className="p-page">
      <div className="p-container">
        <header className="p-header">
          <h1 className="p-title">Only Poker</h1>
        </header>

        <section className="p-grid">
          {/* LEFT */}
          <div className="p-col">
            {/* Hand Played */}
            <div className="p-card">
              <div className="p-cardTitle">Hand Played</div>
              <textarea
                className="p-textarea"
                placeholder="Type your hand like a story — stakes, position, cards, actions…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <div className="p-row p-gap">
                <button className="p-btn p-primary" onClick={handleParse} disabled={!input.trim() || aiLoading}>
                  {aiLoading ? 'Analyzing…' : 'Send'}
                </button>
                <button
                  className="p-btn"
                  onClick={() => { setInput(''); setFields(null); setStatus(null); setAiError(null); setHeroAssist(''); setVillainAssist(''); setBoardAssist(''); }}
                >
                  Clear
                </button>
              </div>
              {aiError && <div className="p-err">{aiError}</div>}
              {status && <div className="p-note">{status}</div>}
            </div>

            {/* Quick Card Assist (raw text, optional) */}
            <div className="p-card">
              <div className="p-cardTitle">Quick Card Assist (source of truth)</div>
              <div className="p-assist3">
                <input className="p-input" value={heroAssist} onChange={(e)=>setHeroAssist(e.target.value)} placeholder="Hero (exact suits): Ks Kd" />
                <input className="p-input" value={villainAssist} onChange={(e)=>setVillainAssist(e.target.value)} placeholder="Villain (optional): Kc Kd" />
                <input className="p-input" value={boardAssist} onChange={(e)=>setBoardAssist(e.target.value)} placeholder="Board: Js Ts 4c 9c 3s" />
              </div>
              <div className="p-help">Postflop: exact suits give best accuracy. These fields override whatever the story parser guesses.</div>
            </div>

            {/* Situation Summary (editable hero + board) */}
            <div className="p-card">
              <div className="p-subTitle">Situation Summary</div>

              <div className="sumGrid">
                <div className="sumItem">
                  <div className="sumLabel">Mode</div>
                  <div className="sumVal">CASH</div>
                </div>
                <div className="sumItem">
                  <div className="sumLabel">Blinds / Stakes</div>
                  <div className="sumVal">{(fields?.stakes ?? preview.stakes) || '(unknown)'}</div>
                </div>
                <div className="sumItem">
                  <div className="sumLabel">Effective Stack (bb)</div>
                  <div className="sumVal">(unknown)</div>
                </div>
                <div className="sumItem">
                  <div className="sumLabel">Positions</div>
                  <div className="sumVal">{(fields?.position ?? preview.position) || '(unknown)'}</div>
                </div>

                {/* HERO CARDS editable */}
                <div className="sumItem">
                  <div className="sumLabel">Hero Hand</div>
                  <div className="sumVal row">
                    <CardPillEditable
                      value={splitTwoCards(heroCards)[0]}
                      onChange={(c1) => {
                        const [, b] = splitTwoCards(heroCards);
                        const joined = [c1, b].filter(Boolean).join(' ');
                        setHeroAssist(joined);
                      }}
                    />
                    <CardPillEditable
                      value={splitTwoCards(heroCards)[1]}
                      onChange={(c2) => {
                        const [a] = splitTwoCards(heroCards);
                        const joined = [a, c2].filter(Boolean).join(' ');
                        setHeroAssist(joined);
                      }}
                    />
                  </div>
                </div>

                {/* BOARD editable */}
                <div className="sumItem sumBoard">
                  <div className="sumLabel">Board</div>
                  <div className="sumVal col">
                    <div className="boardRow">
                      <span className="boardLbl">Flop</span>
                      <CardPillEditable
                        value={(flop.split(' ')[0] || '')}
                        onChange={(v) => {
                          const f = [v, flop.split(' ')[1] || '', flop.split(' ')[2] || ''].filter(Boolean).join(' ');
                          const joined = [f, turn, river].filter(Boolean).join(' ');
                          setBoardAssist(joined);
                        }}
                        placeholder="—"
                      />
                      <CardPillEditable
                        value={(flop.split(' ')[1] || '')}
                        onChange={(v) => {
                          const f = [flop.split(' ')[0] || '', v, flop.split(' ')[2] || ''].filter(Boolean).join(' ');
                          const joined = [f, turn, river].filter(Boolean).join(' ');
                          setBoardAssist(joined);
                        }}
                        placeholder="—"
                      />
                      <CardPillEditable
                        value={(flop.split(' ')[2] || '')}
                        onChange={(v) => {
                          const f = [flop.split(' ')[0] || '', flop.split(' ')[1] || '', v].filter(Boolean).join(' ');
                          const joined = [f, turn, river].filter(Boolean).join(' ');
                          setBoardAssist(joined);
                        }}
                        placeholder="—"
                      />
                    </div>

                    <div className="boardRow">
                      <span className="boardLbl">Turn</span>
                      <CardPillEditable
                        value={turn}
                        onChange={(v) => {
                          const joined = [flop, v, river].filter(Boolean).join(' ');
                          setBoardAssist(joined);
                        }}
                        placeholder="—"
                      />
                    </div>

                    <div className="boardRow">
                      <span className="boardLbl">River</span>
                      <CardPillEditable
                        value={river}
                        onChange={(v) => {
                          const joined = [flop, turn, v].filter(Boolean).join(' ');
                          setBoardAssist(joined);
                        }}
                        placeholder="—"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-help" style={{marginTop:10}}>
                Postflop: add exact suits (e.g., <b>As 4s</b>) for best accuracy. Edits here override the story.
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="p-col">
            <div className="p-card">
              <div className="p-topRow">
                <TagChips />
              </div>

              <div className="p-grid2">
                <InfoBox label="Date"><div>{today}</div></InfoBox>
                <InfoBox label="Position"><div>{(fields?.position ?? preview.position) || <span className="p-muted">(unknown)</span>}</div></InfoBox>
                <InfoBox label="Stakes"><div>{(fields?.stakes ?? preview.stakes) || <span className="p-muted">(unknown)</span>}</div></InfoBox>
                <InfoBox label="Cards">
                  <div className="p-cards">
                    {heroCards
                      ? heroCards.split(' ').map((c, i) => <span key={i} className="p-cardSpan"><CardSpan c={c} /></span>)
                      : <span className="p-muted">(not found)</span>}
                  </div>
                </InfoBox>
              </div>
            </div>

            <div className="p-card">
              <div className="p-subTitle">GTO Strategy (detailed)</div>
              <textarea
                className="p-input p-mono"
                rows={12}
                placeholder="Preflop/Flop/Turn/River plan with sizes…"
                value={fields?.gto_strategy ?? ''}
                onChange={e => fields && setFields({ ...fields, gto_strategy: e.target.value })}
              />
              <div className="p-help">We’ll auto-fill this after “Send”. You can also edit.</div>
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

      {/* ------------- Styles ------------- */}
      <style jsx global>{`
        :root{
          --bg1:#e5e7eb; --bg2:#f1f5f9; --bg3:#cbd5e1;
          --card1:#f8fafc; --card2:#e5e7eb; --card3:#f1f5f9;
          --border:#d1d5db; --line:#d8dde6;
          --text:#0f172a; --muted:#6b7280;
          --primary:#3b82f6; --primary2:#2563eb; --btnText:#f8fbff;
          --pillBg:#ffffff; --pillBorder:#e5e7eb;
        }
        *{box-sizing:border-box}
        html,body{margin:0;padding:0;background:linear-gradient(135deg,var(--bg2),var(--bg1),var(--bg3));color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
        .p-page{min-height:100vh;padding:24px}
        .p-container{max-width:1200px;margin:0 auto}
        .p-header{display:flex;align-items:center;justify-content:center;margin-bottom:16px}
        .p-title{margin:0;font-size:28px;font-weight:800;letter-spacing:.2px;text-align:center}
        .p-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
        @media (max-width:980px){.p-grid{grid-template-columns:1fr}}

        .p-col{display:flex;flex-direction:column;gap:24px}
        .p-card{background:linear-gradient(180deg,var(--card1),var(--card2) 60%,var(--card3));border:1px solid var(--border);border-radius:18px;padding:16px;box-shadow:0 10px 28px rgba(0,0,0,.08)}
        .p-cardTitle{font-size:13px;font-weight:700;letter-spacing:.15px;color:#334155;margin-bottom:10px}
        .p-subTitle{font-size:14px;font-weight:800;margin-bottom:10px;color:#111827}
        .p-textarea{width:100%;min-height:160px;resize:vertical;padding:12px 14px;border-radius:14px;border:1px solid var(--line);background:#fff;color:#0f172a;font-size:15px;line-height:1.5}
        .p-row{display:flex;align-items:center}
        .p-gap{gap:12px}
        .p-gapTop{margin-top:10px}
        .p-end{justify-content:flex-end}
        .p-btn{appearance:none;border:1px solid var(--line);background:#fff;color:#0f172a;padding:10px 14px;border-radius:12px;cursor:pointer;transition:transform .02s ease,background .15s ease,border-color .15s ease}
        .p-btn:hover{background:#f3f4f6}
        .p-btn:active{transform:translateY(1px)}
        .p-btn[disabled]{opacity:.55;cursor:not-allowed}
        .p-btn.p-primary{background:linear-gradient(180deg,var(--primary),var(--primary2));color:var(--btnText);border-color:#9db7ff;box-shadow:0 6px 18px rgba(59,130,246,.25)}
        .p-btn.p-primary:hover{filter:brightness(1.05)}
        .p-assist3{display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:10px}
        @media (max-width:800px){.p-assist3{grid-template-columns:1fr}}
        .p-input{width:100%;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:#fff;color:#0f172a;font-size:14.5px}
        .p-input.p-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace;line-height:1.45}
        .p-help{margin-top:8px;font-size:12px;color:var(--muted)}
        .p-muted{color:var(--muted)}
        .p-topRow{display:flex;justify-content:space-between;align-items:center}
        .chips{display:flex;flex-wrap:wrap;gap:8px}
        .chip{background:#eef2ff;border:1px solid #c7d2fe;color:#1e3a8a;padding:6px 10px;border-radius:999px;font-size:12.5px;letter-spacing:.2px}

        .p-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px}
        .ibox{background:#fff;border:1px solid var(--pillBorder);border-radius:12px;padding:10px 12px}
        .iboxLabel{font-size:11px;color:#6b7280;margin-bottom:3px}
        .iboxVal{font-size:14px}
        .p-cards{display:flex;gap:6px;align-items:center}
        .p-cardSpan{margin-right:0}

        .p-list{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px}
        .p-note{margin-top:10px;color:#166534}
        .p-err{margin-top:10px;color:#b91c1c}

        /* Situation Summary grid + editable pills */
        .sumGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
        @media (max-width:900px){.sumGrid{grid-template-columns:1fr}}
        .sumItem{background:#fff;border:1px solid var(--pillBorder);border-radius:12px;padding:10px 12px}
        .sumLabel{font-size:11px;color:#6b7280;margin-bottom:4px}
        .sumVal{font-size:14px;color:#0f172a}
        .sumVal.row{display:flex;gap:8px;align-items:center}
        .sumVal.col{display:flex;flex-direction:column;gap:6px}
        .boardRow{display:flex;align-items:center;gap:8px}
        .boardLbl{font-size:12px;color:#64748b;width:40px}

        .cardPill{display:inline-flex;align-items:center}
        .cardIn{width:56px;padding:6px 8px;border-radius:10px;border:1px solid var(--pillBorder);font-size:14px;text-align:center;background:#fff;outline:none}
        .cardIn.blk{color:#111827}
        .cardIn.red{color:#dc2626}
        .cardIn::placeholder{color:#9ca3af}
      `}</style>
    </main>
  );
}

/** Small info box (right column) */
function InfoBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ibox">
      <div className="iboxLabel">{label}</div>
      <div className="iboxVal">{children}</div>
    </div>
  );
}
