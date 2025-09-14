'use client';

import React, { useEffect, useMemo, useState } from 'react';

/** =================== Types =================== */
type Fields = {
  date?: string | null;
  stakes?: string | null;
  position?: string | null;
  cards?: string | null;
  gto_strategy?: string | null;
  exploit_deviation?: string | null;
  learning_tag?: string[];
  board?: string | null;
  notes?: string | null;
};

/** =================== Small helpers =================== */
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

const SUIT_MAP: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_WORD: Record<string, string> = {
  spade: '♠', spades: '♠',
  heart: '♥', hearts: '♥',
  diamond: '♦', diamonds: '♦',
  club: '♣', clubs: '♣',
};
const suitColor = (suit: string) => (suit === '♥' || suit === '♦' ? '#dc2626' : '#111827');

function suitifyOne(token: string): string {
  const t = (token || '').replace(/\s+/g, '');
  // Accept "Js", "J♠", "jS"
  let m = t.match(/^([2-9TJQKA])([shdc♠♥♦♣])$/i);
  if (m) {
    const r = m[1].toUpperCase();
    const s = m[2].toLowerCase();
    const suit = SUIT_MAP[s] || (/[♠♥♦♣]/.test(s) ? s : '');
    return suit ? `${r}${suit}` : '';
  }
  // Accept "J of spades"
  m = t.match(/^([2-9TJQKA])(?:of)?(spades?|hearts?|diamonds?|clubs?)$/i);
  if (m) {
    const r = m[1].toUpperCase();
    const suit = SUIT_WORD[(m[2] || '').toLowerCase()] || '♠';
    return `${r}${suit}`;
  }
  return '';
}

const CardSpan = ({ c }: { c: string }) =>
  !c ? null : <span style={{ fontWeight: 700, color: suitColor(c.slice(-1)) }}>{c}</span>;

const joinDefined = (parts: Array<string | undefined>) =>
  parts.filter(Boolean).join(' ');

/** =================== CardInput (rank + suit chips) =================== */
function CardInput({
  label,
  value,
  onChange,
}: {
  label?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const rank = (value || '').slice(0, 1) || '';
  const suit = (value || '').slice(1) || '';

  const setRank = (r: string) => onChange(r && suit ? `${r}${suit}` : r);
  const setSuit = (s: string) => onChange(rank ? `${rank}${s}` : s);

  const ranks = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];
  const suits = ['♠','♥','♦','♣'];

  return (
    <div className="ccard">
      {label && <div className="ccardLabel">{label}</div>}
      <div className="ccardRow">
        <select className="p-input ccardSel" value={rank} onChange={e=>setRank(e.target.value)}>
          <option value="">–</option>
          {ranks.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <div className="ccardSuits">
          {suits.map(s => (
            <button
              key={s}
              type="button"
              className={`ccardSuit ${s===suit ? 'active':''}`}
              style={{ color: suitColor(s) }}
              onClick={()=>setSuit(s)}
              aria-label={`Suit ${s}`}
            >
              {s}
            </button>
          ))}
        </div>
        {value && (
          <div className="ccardPreview"><CardSpan c={value} /></div>
        )}
      </div>
    </div>
  );
}

/** =================== CoachCard (pretty GTO box) =================== */
type CoachPlan = { preflop: string[]; flop: string[]; turn: string[]; river: string[] };
type CoachData = {
  decision: string;
  price?: string;
  rangeHero?: string;
  rangeVillain?: string;
  why: string[];
  plan: CoachPlan;
  mistakes: string[];
};

function parseCoachCard(text: string): CoachData {
  const clean = (text || '').replace(/\r/g, '');

  const grab = (label: string) => {
    const re = new RegExp(`^${label}\\s*:([\\s\\S]*?)(?:^\\w+\\s*:|\\Z)`, 'im');
    const m = clean.match(re);
    return m ? m[1].trim() : '';
  };

  const decision = grab('DECISION').replace(/^\-+\s*/gm, '').split('\n')[0] || '';
  const price = grab('PRICE');
  const range = grab('RANGE');

  let rangeHero = '', rangeVillain = '';
  if (range) {
    const mh = range.match(/hero\s*([^;,\n]+)/i);
    const mv = range.match(/villain\s*([^;,\n]+)/i);
    rangeHero = mh ? mh[1].trim() : '';
    rangeVillain = mv ? mv[1].trim() : '';
    if (!rangeHero && !rangeVillain) rangeHero = range;
  }

  const lines = (block: string) =>
    block
      .split(/\n+/)
      .map(s => s.replace(/^[•\-]\s*/, '').trim())
      .filter(Boolean);

  const why = lines(grab('WHY'));

  const planBlock = grab('PLAN');
  const street = (name: string) => {
    const re = new RegExp(`\\b${name}\\s*:\\s*([\\s\\S]*?)(?:^\\s*\\-\\s*\\w+\\s*:|\\Z)`, 'im');
    const m = planBlock.match(re);
    return m ? lines(m[1]) : [];
  };
  const plan: CoachPlan = {
    preflop: street('Preflop'),
    flop: street('Flop'),
    turn: street('Turn'),
    river: street('River'),
  };

  const mistakes = lines(grab('MISTAKES'));
  return { decision, price, rangeHero, rangeVillain, why, plan, mistakes };
}

function colorForDecision(d: string) {
  const s = (d || '').toLowerCase();
  if (s.includes('fold')) return '#ef4444';
  if (s.includes('jam') || s.includes('all-in')) return '#10b981';
  if (s.includes('bet')) return '#3b82f6';
  if (s.includes('check')) return '#6b7280';
  if (s.includes('call')) return '#f59e0b';
  return '#334155';
}

function Badge({ children, tone='#475569' }: { children: React.ReactNode; tone?: string }) {
  return (
    <span
      className="cc-badge"
      style={{ borderColor: tone, color: tone, background: '#ffffff' }}
    >
      {children}
    </span>
  );
}

function BulletList({ items }: { items: string[] }) {
  if (!items?.length) return null;
  return (
    <ul className="cc-ul">
      {items.map((t, i) => <li key={i}>{t}</li>)}
    </ul>
  );
}

function StreetCol({ title, items }: { title: string; items: string[] }) {
  if (!items?.length) return null;
  return (
    <div className="cc-street">
      <div className="cc-streetTitle">{title}</div>
      <BulletList items={items} />
    </div>
  );
}

function CoachCard({ text, onChange }: { text: string; onChange: (v: string) => void }) {
  const [rawMode, setRawMode] = useState(false);
  const data = parseCoachCard(text);
  const tone = colorForDecision(data.decision);

  if (rawMode) {
    return (
      <div className="coachCard">
        <textarea
          className="p-input p-mono"
          rows={12}
          value={text}
          onChange={(e)=>onChange(e.target.value)}
        />
        <div className="cc-actions">
          <button className="p-btn" onClick={()=>setRawMode(false)}>Done</button>
        </div>
      </div>
    );
  }

  return (
    <div className="coachCard">
      <div className="cc-head">
        <div className="cc-decision" style={{ background: tone + '1a', borderColor: tone }}>
          <span className="cc-dot" style={{ background: tone }} />
          {data.decision || '—'}
        </div>
        {data.price ? <Badge tone={tone}>Price: {data.price}</Badge> : null}
        <div className="cc-spacer" />
        <button className="p-btn" onClick={()=>setRawMode(true)}>Edit</button>
      </div>

      {(data.rangeHero || data.rangeVillain) && (
        <div className="cc-range">
          {data.rangeHero && <Badge>Hero: {data.rangeHero}</Badge>}
          {data.rangeVillain && <Badge>Villain: {data.rangeVillain}</Badge>}
        </div>
      )}

      {data.why?.length ? (
        <div className="cc-section">
          <div className="cc-title">Why</div>
          <BulletList items={data.why} />
        </div>
      ) : null}

      {(data.plan.preflop.length + data.plan.flop.length + data.plan.turn.length + data.plan.river.length) > 0 && (
        <div className="cc-section">
          <div className="cc-title">Plan</div>
          <div className="cc-planGrid">
            <StreetCol title="Preflop" items={data.plan.preflop} />
            <StreetCol title="Flop" items={data.plan.flop} />
            <StreetCol title="Turn" items={data.plan.turn} />
            <StreetCol title="River" items={data.plan.river} />
          </div>
        </div>
      )}

      {data.mistakes?.length ? (
        <div className="cc-section">
          <div className="cc-title">Mistakes</div>
          <ul className="cc-ul cc-warn">
            {data.mistakes.map((t, i) => <li key={i}>{t}</li>)}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** =================== Page =================== */
export default function Page() {
  // Input narrative
  const [input, setInput] = useState('');

  // Parsed / server fields
  const [fields, setFields] = useState<Fields | null>(null);

  // Async state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Situation Summary editors
  const [mode, setMode] = useState<'CASH'|'MTT'|''>('CASH');
  const [stakes, setStakes] = useState('');
  const [effStack, setEffStack] = useState('');
  const [position, setPosition] = useState('SB');

  const [heroA, setHeroA] = useState('K♥');
  const [heroB, setHeroB] = useState('K♠');

  const [f1, setF1] = useState('J♠');
  const [f2, setF2] = useState('T♠');
  const [f3, setF3] = useState('4♣');
  const [turn, setTurn] = useState('9♣');
  const [river, setRiver] = useState('3♠');

  // Top-right info
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const cardsStr = useMemo(() => joinDefined([heroA, heroB]), [heroA, heroB]);

  const boardStr = useMemo(() => {
    const flop = joinDefined([f1, f2, f3]);
    const t = turn;
    const r = river;
    return [flop && `Flop: ${flop}`, t && `Turn: ${t}`, r && `River: ${r}`].filter(Boolean).join('  |  ');
  }, [f1, f2, f3, turn, river]);

  /** ------------- API calls ------------- */
  async function analyzeParsedHand(parsed: Fields) {
    setAiError(null);
    setAiLoading(true);
    try {
      const payload = {
        date: today,
        stakes: stakes || parsed.stakes || undefined,
        position: position || parsed.position || undefined,
        cards: cardsStr || parsed.cards || undefined,
        board: boardStr || parsed.board || undefined,
        notes: parsed.notes ?? input,
        rawText: input,
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
          cards: cardsStr || base.cards || '',
          position,
          stakes: stakes || base.stakes || '',
          board: boardStr,
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

  return (
    <main className="p-page">
      <div className="p-container">
        <header className="p-header">
          <h1 className="p-title">Only Poker</h1>
        </header>

        <section className="p-grid">
          {/* LEFT COLUMN */}
          <div className="p-col">
            <div className="p-card">
              <div className="p-cardTitle">Hand Played</div>
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
                  onClick={() => {
                    setInput('');
                    setFields(null);
                    setStatus(null);
                    setAiError(null);
                  }}
                >
                  Clear
                </button>
              </div>
              {aiError && <div className="p-err">{aiError}</div>}
              {status && <div className="p-note">{status}</div>}
            </div>

            {/* Situation Summary (editable) */}
            <div className="p-card">
              <div className="p-subTitle">Situation Summary</div>

              <div className="sumGrid">
                <div className="ibox">
                  <div className="iboxLabel">Mode</div>
                  <select className="p-input" value={mode} onChange={e=>setMode(e.target.value as any)}>
                    <option value="CASH">CASH</option>
                    <option value="MTT">MTT</option>
                  </select>
                </div>

                <div className="ibox">
                  <div className="iboxLabel">Blinds / Stakes</div>
                  <input className="p-input" value={stakes} onChange={e=>setStakes(e.target.value)} placeholder="$1/$2" />
                </div>

                <div className="ibox">
                  <div className="iboxLabel">Effective Stack (bb)</div>
                  <input className="p-input" value={effStack} onChange={e=>setEffStack(e.target.value)} placeholder="e.g., 100" />
                </div>
              </div>

              <div className="sumGrid">
                <div className="ibox">
                  <div className="iboxLabel">Positions</div>
                  <select className="p-input" value={position} onChange={e=>setPosition(e.target.value)}>
                    {['UTG','MP','HJ','CO','BTN','SB','BB'].map(p=> <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>

                <div className="ibox">
                  <div className="iboxLabel">Hero Hand</div>
                  <div className="heroRow">
                    <CardInput value={heroA} onChange={setHeroA} />
                    <span className="heroPlus">+</span>
                    <CardInput value={heroB} onChange={setHeroB} />
                  </div>
                </div>

                <div className="ibox">
                  <div className="iboxLabel">Board</div>
                  <div className="boardEdit">
                    <div className="boardRow">
                      <span className="pillLbl">Flop</span>
                      <CardInput value={f1} onChange={setF1} />
                      <CardInput value={f2} onChange={setF2} />
                      <CardInput value={f3} onChange={setF3} />
                    </div>
                    <div className="boardRow">
                      <span className="pillLbl">Turn</span>
                      <CardInput value={turn} onChange={setTurn} />
                    </div>
                    <div className="boardRow">
                      <span className="pillLbl">River</span>
                      <CardInput value={river} onChange={setRiver} />
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-help">Postflop: add exact suits (e.g., <b>As 4s</b>) for best accuracy. Edits here override the story.</div>
            </div>

            {/* FE & SPR */}
            <div className="p-card">
              <div className="p-subTitle">Fold-Equity Threshold & SPR</div>
              <div className="sprGrid">
                <div className="ibox">
                  <div className="iboxLabel">FE calculator (bb units)</div>
                  <div className="feRow">
                    <div className="feCol">
                      <div className="feLbl">Risk (bb)</div>
                      <input className="p-input" placeholder="e.g., jam = eff BB" />
                    </div>
                    <div className="feCol">
                      <div className="feLbl">Reward (bb)</div>
                      <input className="p-input" placeholder="pre-pot + bet size" />
                    </div>
                  </div>
                  <div className="p-muted" style={{marginTop:6}}>FE needed ≈ 0%  <span className="p-muted"> (Risk / (Risk + Reward))</span></div>
                </div>

                <div className="ibox">
                  <div className="iboxLabel">SPR (flop)</div>
                  <div className="feRow">
                    <div className="feCol">
                      <div className="feLbl">Flop pot (bb)</div>
                      <input className="p-input" placeholder="e.g., 5.9" />
                    </div>
                    <div className="feCol">
                      <div className="feLbl">Behind (bb)</div>
                      <input className="p-input" placeholder="effective after prefl" />
                    </div>
                  </div>
                  <div className="sprChips">
                    <span className="sprChip">SPR ≤ 2: jam / b50 / x</span>
                    <span className="sprChip">SPR 2–5: b33 / b50 / x</span>
                    <span className="sprChip">SPR 5+: b25–33 / x</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="p-col">
            <div className="p-card">
              <div className="p-grid2">
                <InfoBox label="Date"><div>{today}</div></InfoBox>
                <InfoBox label="Position"><div>{position}</div></InfoBox>
                <InfoBox label="Stakes"><div>{stakes || <span className="p-muted">(unknown)</span>}</div></InfoBox>
                <InfoBox label="Cards">
                  <div className="p-cards">
                    {cardsStr
                      ? cardsStr.split(' ').map((c, i) => <span key={i} className="p-cardSpan"><CardSpan c={c} /></span>)
                      : <span className="p-muted">(unknown)</span>
                    }
                  </div>
                </InfoBox>
              </div>
            </div>

            <div className="p-card">
              <div className="p-subTitle">GTO Strategy</div>
              <CoachCard
                text={fields?.gto_strategy ?? ''}
                onChange={(val)=> fields && setFields({ ...fields, gto_strategy: val })}
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

      {/* ============== Styles ============== */}
      <style jsx global>{`
        :root{
          --bg1:#eef2f7; --bg2:#f8fafc;
          --card1:#ffffff; --card2:#f3f4f6; --card3:#f8fafc;
          --border:#e5e7eb; --line:#e5e7eb;
          --text:#0f172a; --muted:#6b7280;
          --primary:#3b82f6; --primary2:#2563eb; --btnText:#f8fbff;
        }
        *{box-sizing:border-box}
        html,body{margin:0;background:linear-gradient(135deg,var(--bg2),var(--bg1));color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
        .p-page{min-height:100vh;padding:24px}
        .p-container{max-width:1220px;margin:0 auto}
        .p-header{display:flex;align-items:center;justify-content:center;margin-bottom:16px}
        .p-title{margin:0;font-size:28px;font-weight:800;letter-spacing:.2px}
        .p-grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}
        @media (max-width:980px){.p-grid{grid-template-columns:1fr}}
        .p-col{display:flex;flex-direction:column;gap:24px}

        .p-card{
          background:linear-gradient(180deg,var(--card1),var(--card2) 55%,var(--card3));
          border:1px solid var(--border);
          border-radius:18px; padding:16px;
          box-shadow:0 8px 24px rgba(0,0,0,.06);
        }
        .p-cardTitle{font-size:13px;font-weight:700;color:#334155;margin-bottom:10px}
        .p-subTitle{font-size:14px;font-weight:800;margin-bottom:10px;color:#111827}
        .p-textarea{
          width:100%; min-height:160px; resize:vertical; padding:12px 14px;
          border-radius:14px; border:1px solid var(--line); background:#ffffff; color:#0f172a; font-size:15px; line-height:1.5;
        }
        .p-row{display:flex;align-items:center}
        .p-gap{gap:12px}
        .p-gapTop{margin-top:10px}
        .p-end{justify-content:flex-end}
        .p-btn{
          appearance:none; border:1px solid var(--line); background:#ffffff; color:#0f172a;
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

        .p-grid2{display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:4px}
        .ibox{background:#ffffff; border:1px solid var(--border); border-radius:12px; padding:10px 12px}
        .iboxLabel{font-size:11px; color:#6b7280; margin-bottom:6px}
        .p-input{
          width:100%; padding:10px 12px; border-radius:12px; border:1px solid var(--line);
          background:#ffffff; color:#0f172a; font-size:14.5px;
        }
        .p-input.p-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace; line-height:1.45}
        .p-help{margin-top:8px; font-size:12px; color:var(--muted)}
        .p-muted{color:var(--muted)}
        .p-cardSpan{margin-right:4px}
        .p-list{margin:0; padding-left:18px; display:flex; flex-direction:column; gap:6px}

        /* Situation Summary */
        .sumGrid{display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-bottom:12px}
        @media (max-width:980px){ .sumGrid{ grid-template-columns:1fr } }
        .heroRow{display:flex; align-items:center; gap:10px}
        .heroPlus{font-weight:700; color:#64748b}

        .boardEdit{display:flex; flex-direction:column; gap:8px}
        .boardRow{display:flex; align-items:center; gap:10px}
        .pillLbl{font-size:12px; font-weight:700; color:#475569; width:40px}

        /* CardInput */
        .ccard{}
        .ccardLabel{font-size:11px; color:#6b7280; margin-bottom:4px}
        .ccardRow{display:flex; align-items:center; gap:8px}
        .ccardSel{width:70px}
        .ccardSuits{display:flex; gap:6px}
        .ccardSuit{
          border:1px solid #e5e7eb; background:#fff; border-radius:8px; padding:6px 9px; cursor:pointer;
        }
        .ccardSuit.active{box-shadow:0 0 0 2px rgba(59,130,246,.25)}
        .ccardPreview{min-width:24px; text-align:center}

        /* SPR/FE */
        .sprGrid{display:grid; grid-template-columns:1fr 1fr; gap:12px}
        @media (max-width:980px){ .sprGrid{grid-template-columns:1fr} }
        .feRow{display:flex; gap:10px}
        .feCol{flex:1}
        .feLbl{font-size:11px; color:#6b7280; margin-bottom:4px}
        .sprChips{display:flex; flex-wrap:wrap; gap:8px; margin-top:8px}
        .sprChip{border:1px solid #e5e7eb; background:#fff; border-radius:999px; padding:6px 10px; font-size:12.5px}

        /* ---- CoachCard styles ---- */
        .coachCard{
          border:1px solid #e5e7eb; background:#fff; border-radius:14px; padding:12px;
        }
        .cc-head{display:flex; align-items:center; gap:10px; margin-bottom:8px}
        .cc-decision{
          border:1px solid; padding:8px 12px; border-radius:999px;
          font-weight:700; letter-spacing:.2px; display:flex; align-items:center; gap:8px;
        }
        .cc-dot{width:10px;height:10px;border-radius:50%}
        .cc-spacer{flex:1}
        .cc-badge{
          display:inline-flex; align-items:center; gap:6px;
          padding:6px 10px; border-radius:999px; border:1px solid; font-size:12.5px;
        }
        .cc-range{display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px}
        .cc-section{margin-top:8px}
        .cc-title{font-size:12px; font-weight:800; color:#334155; margin-bottom:6px; text-transform:uppercase; letter-spacing:.5px}
        .cc-planGrid{
          display:grid; grid-template-columns:repeat(4,1fr); gap:10px;
        }
        @media (max-width:900px){ .cc-planGrid{ grid-template-columns:1fr 1fr } }
        .cc-street{border:1px solid #eef2f7; background:#fafbff; border-radius:10px; padding:8px}
        .cc-streetTitle{font-weight:700; font-size:12.5px; margin-bottom:4px; color:#1f2937}
        .cc-ul{margin:0; padding-left:18px; display:flex; flex-direction:column; gap:4px}
        .cc-ul li{color:#0f172a}
        .cc-ul.cc-warn li{color:#b45309}
        .cc-actions{display:flex; justify-content:flex-end; margin-top:8px}
      `}</style>
    </main>
  );
}

/** Small info box used on the right-side top card */
function InfoBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ibox">
      <div className="iboxLabel">{label}</div>
      <div className="iboxVal">{children}</div>
    </div>
  );
}
