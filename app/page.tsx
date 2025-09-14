'use client';

import React, { useMemo, useState, useEffect } from 'react';

/** ---------------- Types ---------------- */
type Fields = {
  date?: string | null;
  stakes?: string | null;
  position?: string | null;
  cards?: string | null;
  board?: string | null;
  gto_strategy?: string | null;
  exploit_deviation?: string | null;
  learning_tag?: string[];
  notes?: string | null;
};

/** ---------------- Small helpers ---------------- */
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

const suitify = (card: string) => {
  const m = card.replace(/\s+/g, '').match(/^([2-9TJQKA])([shdc♥♦♣♠])$/i);
  if (!m) return '';
  const r = m[1].toUpperCase();
  const s = m[2].toLowerCase();
  const suit = SUIT_MAP[s] || ('♥♦♣♠'.includes(s) ? s : '');
  return suit ? `${r}${suit}` : '';
};
const suitifyLine = (line: string) =>
  (line || '').replace(/[\/,|]/g, ' ')
    .split(/\s+/).filter(Boolean)
    .map(suitify).filter(Boolean).join(' ');

const parseBoardFromFree = (t: string) => {
  const arr = suitifyLine(t).split(' ').filter(Boolean);
  return {
    flop: arr.slice(0, 3).join(' ') || '',
    turn: arr[3] || '',
    river: arr[4] || ''
  };
};

const CardSpan = ({ c }: { c: string }) =>
  !c ? null : <span style={{ fontWeight: 700, color: suitColor(c.slice(-1)) }}>{c}</span>;

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
    const re = new RegExp(`^\\s*${label}\\s*:\\s*([\\s\\S]*?)(?:^\\s*[A-Z][A-Z ]*?:|\\Z)`, 'im');
    const m = clean.match(re);
    return m ? m[1].trim() : '';
  };

  // Decision
  const known = ['PRICE','RANGE','WHY','PLAN','MISTAKES','PREFLOP','FLOP','TURN','RIVER'];
  let decision = grab('DECISION');
  if (!decision) {
    const firstLabelIdx = known
      .map(lbl => {
        const i = clean.search(new RegExp(`\\b${lbl}\\s*:`, 'i'));
        return i < 0 ? Infinity : i;
      })
      .reduce((a, b) => Math.min(a, b), Infinity);
    const head = (firstLabelIdx === Infinity ? clean : clean.slice(0, firstLabelIdx)).trim();
    const mAct = head.match(/^(?:decision\s*:\s*)?([A-Z][^\.\n]{0,80})(?:[\.!\n]|$)/i);
    decision = mAct ? mAct[1].trim() : '';
  }

  const price = grab('PRICE');

  // Range
  const rangeBlock = grab('RANGE');
  let rangeHero = '', rangeVillain = '';
  if (rangeBlock) {
    const mh = rangeBlock.match(/hero[^:]*:\s*([^;\n]+)/i);
    const mv = rangeBlock.match(/villain[^:]*:\s*([^;\n]+)/i);
    if (mh) rangeHero = mh[1].trim();
    if (mv) rangeVillain = mv[1].trim();
    if (!mh && !mv) rangeHero = rangeBlock;
  }

  // Why bullets
  const whyBlock = grab('WHY');
  const why = whyBlock
    ? whyBlock
        .split(/(?:^[\-\u2022]\s*| - |•|\n)+/m)
        .map(s => s.replace(/^[\-\u2022]\s*/, '').trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];

  // Plan streets (accept top-level or inside PLAN)
  const planBlock = grab('PLAN') || clean;
  const street = (name: string) => {
    const re = new RegExp(`\\b${name}\\s*:\\s*([\\s\\S]*?)(?:^\\s*[A-Z][A-Z ]*?:|\\Z)`, 'im');
    const m = planBlock.match(re);
    const raw = m ? m[1] : '';
    return raw
      .split(/\n+/)
      .map(s => s.replace(/^[\-\u2022]\s*/, '').trim())
      .filter(Boolean)
      .slice(0, 8);
  };
  const plan: CoachPlan = {
    preflop: street('PREFLOP'),
    flop: street('FLOP'),
    turn: street('TURN'),
    river: street('RIVER'),
  };

  const mistakes = (grab('MISTAKES') || '')
    .split(/\n+/)
    .map(s => s.replace(/^[\-\u2022]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 6);

  const noContent =
    !decision && !price && !rangeBlock && !why.length &&
    !plan.preflop.length && !plan.flop.length && !plan.turn.length && !plan.river.length;

  if (noContent) {
    return {
      decision: '—',
      price: '',
      why: [clean],
      plan: { preflop: [], flop: [], turn: [], river: [] },
      mistakes: [],
    };
  }
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
    <span className="cc-badge" style={{ borderColor: tone, color: tone, background: '#ffffff' }}>
      {children}
    </span>
  );
}
function BulletList({ items }: { items: string[] }) {
  if (!items?.length) return null;
  return <ul className="cc-ul">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>;
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
        <div className="cc-actions"><button className="p-btn" onClick={()=>setRawMode(false)}>Done</button></div>
      </div>
    );
  }

  return (
    <div className="coachCard">
      <div className="cc-head">
        <div className="cc-decision" style={{ borderColor: tone, background: tone + '10' }}>
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
  // raw hand story
  const [input, setInput] = useState('');

  // model fields
  const [fields, setFields] = useState<Fields | null>(null);

  // editable summary
  const [mode, setMode] = useState<'CASH'|'MTT'>('CASH');
  const [stakes, setStakes] = useState('');
  const [eff, setEff] = useState('');
  const [position, setPosition] = useState('SB');

  // hero & board editors (simple text, exact suits recommended)
  const [heroText, setHeroText] = useState('');         // e.g., "K♥ K♠"
  const [flopText, setFlopText] = useState('');         // e.g., "J♠ T♠ 4♣"
  const [turnText, setTurnText] = useState('');         // e.g., "9♣"
  const [riverText, setRiverText] = useState('');       // e.g., "3♠"

  // async state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  // live board preview from editor if present in story
  const previewBoard = useMemo(() => parseBoardFromFree([flopText, turnText, riverText].filter(Boolean).join(' ')), [flopText, turnText, riverText]);

  const heroCards = (fields?.cards || suitifyLine(heroText) || '').trim();
  const flop = previewBoard.flop;
  const turn = previewBoard.turn;
  const river = previewBoard.river;

  /** Call /api/analyze-hand using story + edited summary */
  async function analyze() {
    setAiError(null);
    setAiLoading(true);
    try {
      const payload = {
        date: today,
        stakes: stakes || fields?.stakes || undefined,
        position: position || fields?.position || undefined,
        cards: heroCards || undefined,
        board: [flop && `Flop: ${flop}`, turn && `Turn: ${turn}`, river && `River: ${river}`].filter(Boolean).join('  |  '),
        notes: input,
        rawText: input
      };

      const r = await fetch('/api/analyze-hand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const err = await r.json().catch(()=> ({}));
        throw new Error(err?.error || `AI analyze failed (${r.status})`);
      }
      const data = await r.json();
      setFields(prev => ({
        ...(prev ?? {}),
        date: today,
        stakes: payload.stakes ?? null,
        position: payload.position ?? null,
        cards: payload.cards ?? null,
        board: payload.board ?? null,
        gto_strategy: asText(data.gto_strategy),
        exploit_deviation: asText(data.exploit_deviation),
        learning_tag: Array.isArray(data.learning_tag) ? data.learning_tag : []
      }));
    } catch (e: any) {
      setAiError(e.message || 'AI analysis error');
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <main className="p-page">
      <div className="p-container">
        <header className="p-header"><h1 className="p-title">Only Poker</h1></header>

        <section className="p-grid">
          {/* LEFT: story + summary + calculators */}
          <div className="p-col">
            <div className="p-card">
              <div className="p-cardTitle">Hand Played</div>
              <textarea
                className="p-textarea"
                placeholder="Tell the hand like a story — positions, actions, sizes, stacks…"
                value={input}
                onChange={(e)=>setInput(e.target.value)}
              />
              <div className="p-row p-gap">
                <button className="p-btn p-primary" onClick={analyze} disabled={aiLoading || !input.trim()}>
                  {aiLoading ? 'Analyzing…' : 'Send'}
                </button>
                <button className="p-btn" onClick={()=>{
                  setInput(''); setFields(null); setHeroText(''); setFlopText(''); setTurnText(''); setRiverText('');
                }}>Clear</button>
              </div>
              {aiError && <div className="p-err">{aiError}</div>}
            </div>

            {/* Situation Summary (editable) */}
            <div className="p-card">
              <div className="p-subTitle">Situation Summary</div>

              <div className="ss-grid">
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
                  <input className="p-input" value={eff} onChange={e=>setEff(e.target.value)} placeholder="e.g., 100" />
                </div>
              </div>

              <div className="ss-grid">
                <div className="ibox">
                  <div className="iboxLabel">Positions</div>
                  <select className="p-input" value={position} onChange={e=>setPosition(e.target.value)}>
                    {['UTG','MP','HJ','CO','BTN','SB','BB'].map(p=> <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div className="ibox">
                  <div className="iboxLabel">Hero Hand</div>
                  <input
                    className="p-input"
                    value={heroText}
                    onChange={e=>setHeroText(e.target.value)}
                    placeholder="K♥ K♠  (exact suits best)"
                  />
                  <div className="p-preview">{heroCards
                    ? heroCards.split(' ').map((c,i)=>(<span key={i} className="p-cardSpan"><CardSpan c={c} />{i<1?' ':''}</span>))
                    : <span className="p-muted">(not set)</span>
                  }</div>
                </div>
                <div className="ibox">
                  <div className="iboxLabel">Board</div>
                  <div className="board-edit">
                    <input className="p-input" value={flopText} onChange={e=>setFlopText(e.target.value)} placeholder="Flop: J♠ T♠ 4♣" />
                    <input className="p-input" value={turnText} onChange={e=>setTurnText(e.target.value)} placeholder="Turn: 9♣" />
                    <input className="p-input" value={riverText} onChange={e=>setRiverText(e.target.value)} placeholder="River: 3♠" />
                  </div>
                  <div className="p-preview">
                    Flop:&nbsp;{flop ? flop.split(' ').map((c,i)=>(<span key={i} className="p-cardSpan"><CardSpan c={c} />{i<2?' ':''}</span>)) : <span className="p-muted">—</span>}
                    &nbsp;&nbsp;Turn:&nbsp;{turn ? <CardSpan c={turn} /> : <span className="p-muted">—</span>}
                    &nbsp;&nbsp;River:&nbsp;{river ? <CardSpan c={river} /> : <span className="p-muted">—</span>}
                  </div>
                </div>
              </div>

              <div className="p-help">Postflop: add exact suits (e.g., <b>As 4s</b>) for best accuracy. Edits here override the story.</div>
            </div>

            {/* Fold-Equity & SPR helper (simple) */}
            <div className="p-card">
              <div className="p-subTitle">Fold-Equity Threshold & SPR</div>
              <div className="ss-grid">
                <div className="ibox">
                  <div className="iboxLabel">FE calculator (bb units)</div>
                  <div className="row-2">
                    <input className="p-input" placeholder="Risk (bb), e.g. jam = eff BB" />
                    <input className="p-input" placeholder="Reward (bb) = pre-pot + bet size" />
                  </div>
                  <div className="p-muted" style={{marginTop:6}}>FE needed ≈ Risk / (Risk + Reward)</div>
                </div>
                <div className="ibox">
                  <div className="iboxLabel">SPR (flop)</div>
                  <div className="row-2">
                    <input className="p-input" placeholder="Flop pot (bb)" />
                    <input className="p-input" placeholder="Behind (bb)" />
                  </div>
                  <div className="p-muted" style={{marginTop:6}}>Rules of thumb: SPR ≤2 jam/b50; SPR 2–5 b33/b50; SPR 5+ b25–33 / x</div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: top facts + GTO panel + exploits */}
          <div className="p-col">
            <div className="p-card">
              <div className="p-grid2">
                <InfoBox label="Date"><div>{today}</div></InfoBox>
                <InfoBox label="Position"><div>{position}</div></InfoBox>
                <InfoBox label="Stakes"><div>{stakes || <span className="p-muted">(unknown)</span>}</div></InfoBox>
                <InfoBox label="Cards">
                  <div className="p-cards">
                    {heroCards
                      ? heroCards.split(' ').map((c, i) => <span key={i} className="p-cardSpan"><CardSpan c={c} /></span>)
                      : <span className="p-muted">(unknown)</span>
                    }
                  </div>
                </InfoBox>
              </div>
            </div>

            <div className="p-card">
              <div className="p-subTitle">GTO Strategy</div>
              <CoachCard
                text={fields?.gto_strategy ?? 'Preflop/Flop/Turn/River plan with sizes…'}
                onChange={(v)=> fields && setFields({ ...fields, gto_strategy: v })}
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
                <button className="p-btn" disabled={aiLoading} onClick={analyze}>
                  {aiLoading ? 'Analyzing…' : 'Analyze Again'}
                </button>
                <button className="p-btn p-primary" disabled={!fields}>Confirm & Save to Notion</button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ------------- Styles ------------- */}
      <style jsx global>{`
        :root{
          --bg1:#eef2f7; --bg2:#f8fafc;
          --card:#ffffff; --line:#e5e7eb; --muted:#6b7280; --text:#0f172a;
          --primary:#3b82f6; --primary2:#2563eb; --btnText:#f8fbff;
        }
        *{box-sizing:border-box}
        html,body{margin:0;padding:0;background:linear-gradient(180deg,var(--bg2),var(--bg1));color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
        .p-page{min-height:100vh;padding:22px}
        .p-container{max-width:1250px;margin:0 auto}
        .p-header{display:flex;justify-content:center;margin-bottom:12px}
        .p-title{margin:0;font-size:28px;font-weight:800;letter-spacing:.2px}
        .p-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
        @media (max-width:980px){.p-grid{grid-template-columns:1fr}}

        .p-col{display:flex;flex-direction:column;gap:20px}
        .p-card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px}
        .p-cardTitle{font-size:13px;font-weight:800;margin-bottom:8px;color:#111827}
        .p-subTitle{font-size:14px;font-weight:800;margin-bottom:10px}
        .p-textarea{width:100%;min-height:160px;resize:vertical;border:1px solid var(--line);border-radius:12px;padding:12px 14px;font-size:15px}
        .p-row{display:flex;align-items:center}.p-gap{gap:10px}.p-end{justify-content:flex-end}.p-gapTop{margin-top:10px}
        .p-btn{appearance:none;border:1px solid var(--line);background:#fff;padding:10px 14px;border-radius:12px;cursor:pointer}
        .p-btn:hover{background:#f8fafc}.p-btn.p-primary{background:linear-gradient(180deg,var(--primary),var(--primary2));border-color:#99b3ff;color:var(--btnText)}
        .p-err{margin-top:8px;color:#b91c1c}
        .p-help{margin-top:6px;font-size:12px;color:var(--muted)}
        .p-muted{color:var(--muted)}
        .p-grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .ibox{border:1px solid var(--line);border-radius:12px;padding:10px}
        .iboxLabel{font-size:11px;color:#6b7280;margin-bottom:4px}
        .p-input{width:100%;padding:9px 11px;border:1px solid var(--line);border-radius:10px;background:#fff}
        .p-input.p-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace}

        .ss-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:6px}
        @media (max-width:900px){.ss-grid{grid-template-columns:1fr}}
        .board-edit{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
        .p-preview{margin-top:6px}
        .p-cardSpan{margin-right:4px}

        .p-list{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px}

        /* ---- CoachCard styles ---- */
        .coachCard{border:1px solid #e5e7eb;background:#fff;border-radius:14px;padding:12px}
        .cc-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}
        .cc-decision{
          border:1px solid;
          padding:8px 12px;border-radius:999px;
          font-weight:700;letter-spacing:.2px;
          display:flex;align-items:center;gap:8px;
          white-space:normal;word-break:break-word;max-width:100%;
        }
        .cc-dot{width:10px;height:10px;border-radius:50%}
        .cc-spacer{flex:1}
        .cc-badge{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;border:1px solid;font-size:12.5px}
        .cc-range{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px}
        .cc-section{margin-top:8px}
        .cc-title{font-size:12px;font-weight:800;color:#334155;margin-bottom:6px;text-transform:uppercase;letter-spacing:.5px}
        .cc-planGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
        @media (max-width:900px){.cc-planGrid{grid-template-columns:1fr 1fr}}
        .cc-street{border:1px solid #eef2f7;background:#fafbff;border-radius:10px;padding:8px}
        .cc-streetTitle{font-weight:700;font-size:12.5px;margin-bottom:4px;color:#1f2937}
        .cc-ul{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:4px}
        .cc-ul li{color:#0f172a}
        .cc-ul.cc-warn li{color:#b45309}
        .cc-actions{display:flex;justify-content:flex-end;margin-top:8px}
      `}</style>
    </main>
  );
}

/** Small info box on right */
function InfoBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ibox">
      <div className="iboxLabel">{label}</div>
      <div>{children}</div>
    </div>
  );
}
