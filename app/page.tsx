'use client';

import React, { useEffect, useMemo, useState } from 'react';

/* ====================== Types & helpers ====================== */

type Fields = {
  date?: string | null;
  stakes?: string | null;
  position?: string | null;
  cards?: string | null;
  board?: string | null;
  gto_strategy?: string | null;
  exploit_deviation?: string | null;
  learning_tag?: string[];
};

const SUIT_MAP: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_WORD: Record<string, string> = {
  spade: '♠', spades: '♠', heart: '♥', hearts: '♥',
  diamond: '♦', diamonds: '♦', club: '♣', clubs: '♣'
};
const isRed = (s: string) => s === '♥' || s === '♦';
const suitColor = (suit: string) => (isRed(suit) ? '#dc2626' : '#111827');

function suitifyToken(tok: string): string {
  const t = (tok || '').trim();
  if (!t) return '';

  // e.g. "K♠"
  const m0 = t.match(/^([2-9tjqka])([♥♦♣♠])$/i);
  if (m0) return `${m0[1].toUpperCase()}${m0[2]}`;

  // e.g. "Ks" / "k s" / "K/S"
  const m1 = t.replace(/[\s/]+/g, '').match(/^([2-9tjqka])([shdc])$/i);
  if (m1) return `${m1[1].toUpperCase()}${SUIT_MAP[m1[2].toLowerCase()]}`;

  // e.g. "K of spades"
  const m2 = t.match(/^([2-9tjqka])\s*(?:of)?\s*(spades?|hearts?|diamonds?|clubs?)$/i);
  if (m2) return `${m2[1].toUpperCase()}${SUIT_WORD[m2[2].toLowerCase()]}`;

  // single rank (preflop-only)
  const m3 = t.match(/^([2-9tjqka])$/i);
  if (m3) return m3[1].toUpperCase();

  return '';
}

function prettyCards(line: string): string {
  return (line || '')
    .split(/\s+/)
    .map(suitifyToken)
    .filter(Boolean)
    .join(' ');
}

function CardText({ c }: { c: string }) {
  if (!c) return null;
  const suit = c.slice(-1);
  return <span style={{ fontWeight: 700, color: suitColor(suit) }}>{c}</span>;
}

/* --- lightweight parsing from the story box (best effort; summary can override) --- */

function parseStakes(t: string): string {
  const m =
    t.match(/\$?\d+(?:\.\d+)?\s*\/\s*\$?\d+(?:\.\d+)?(?:\s*\+\s*\$?\d+(?:\.\d+)?\s*(?:bb|bba|ante))?/i) ||
    t.match(/\d+bb\/\d+bb(?:\s*\+\s*\d+bb\s*bba)?/i);
  return m ? m[0] : '';
}

function parsePosition(t: string): string {
  const up = ` ${t.toUpperCase()} `;
  const POS = ['SB','BB','BTN','CO','HJ','MP','UTG+2','UTG+1','UTG'];
  for (const p of POS) if (up.includes(` ${p} `)) return p.replace('+', '+');
  return '';
}

function parseHeroCardsSmart(t: string): string {
  const s = (t || '').toLowerCase();

  // "with Ks Kd", "hero has Kc Kh"
  let m = s.match(/\b(?:hero|i|holding|with|have|has)\b[^.\n]{0,20}?([2-9tjqka][shdc♥♦♣♠])\s+([2-9tjqka][shdc♥♦♣♠])/i);
  if (m) return prettyCards(`${m[1]} ${m[2]}`);

  // fallback: first two card-like tokens
  const tokens = Array.from(s.matchAll(/([2-9tjqka][shdc♥♦♣♠])/ig)).map(x => x[0]).slice(0,2);
  if (tokens.length === 2) return prettyCards(tokens.join(' '));

  return '';
}

function parseBoardFromStory(t: string) {
  const grab = (label: 'flop'|'turn'|'river') => {
    const m = t.match(new RegExp(`${label}[^:]*:\\s*([^\\n]+)`, 'i'));
    return m ? prettyCards(m[1]) : '';
  };
  const flop = grab('flop');
  const turn = grab('turn');
  const river = grab('river');
  return { flop, turn, river };
}

/* ====================== GTO Preview renderer ====================== */

// find this near the top of app/page.tsx:
const SECTION_HEADS = new Set([
  'SITUATION', 'RANGE SNAPSHOT',
  'PREFLOP', 'FLOP', 'TURN', 'RIVER',
  'NEXT CARDS', 'WHY', 'COMMON MISTAKES', 'LEARNING TAGS',
  'DECISION', 'PRICE', 'BOARD CLASS',
  // add:
  'RECOMMENDATION'
]);


function renderGTO(text: string) {
  const lines = (text || '').split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return <div className="muted">No strategy yet. Click Analyze or Edit.</div>;

  return (
    <div className="gtoBody">
      {lines.map((raw, i) => {
        const line = raw.trim();

        // "HEAD: content" → bold the head
        const m = line.match(/^([A-Z ]+):\s*(.*)$/);
        if (m && SECTION_HEADS.has(m[1].trim())) {
          return (
            <div key={i} className="gtoLine">
              <strong className="gtoHead">{m[1].trim()}:</strong>
              {m[2] ? <span className="gtoText"> {m[2]}</span> : null}
            </div>
          );
        }

        // bullets – keep them aligned
        if (/^[-•]/.test(line)) {
          return <div key={i} className="gtoBullet">{line.replace(/^\s*/, '')}</div>;
        }

        // default plain line
        return <div key={i} className="gtoLine">{line}</div>;
      })}
    </div>
  );
}

/* ====================== Page ====================== */

export default function Page() {
  /* ----- story text ----- */
  const [input, setInput] = useState('');

  /* ----- model results ----- */
  const [fields, setFields] = useState<Fields | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* ----- FE & SPR small calculators ----- */
  const [risk, setRisk] = useState<string>('');     // bb
  const [reward, setReward] = useState<string>(''); // bb
  const feNeeded = useMemo(() => {
    const r = parseFloat(risk);
    const w = parseFloat(reward);
    if (!isFinite(r) || !isFinite(w) || r < 0 || w <= 0) return '';
    const x = (r / (r + w)) * 100;
    return `${x.toFixed(1)}%`;
  }, [risk, reward]);

  const [flopPot, setFlopPot] = useState<string>(''); // bb
  const [behind, setBehind] = useState<string>('');   // bb behind after c-bet
  const spr = useMemo(() => {
    const p = parseFloat(flopPot);
    const b = parseFloat(behind);
    if (!isFinite(p) || !isFinite(b) || p <= 0) return '';
    return (b / p).toFixed(1);
  }, [flopPot, behind]);

  /* ----- preview (from story) ----- */
  const preview = useMemo(() => ({
    stakes: parseStakes(input),
    position: parsePosition(input),
    heroCards: parseHeroCardsSmart(input),
    board: parseBoardFromStory(input),
  }), [input]);

  /* ----- Situation Summary (editable) ----- */
  const [mode, setMode] = useState<'CASH' | 'MTT' | ''>('');
  const [stakes, setStakes] = useState<string>('');
  const [eff, setEff] = useState<string>('');
  const [position, setPosition] = useState<string>('');
  const [h1, setH1] = useState<string>('');   // hero card 1
  const [h2, setH2] = useState<string>('');   // hero card 2
  const [f1, setF1] = useState<string>('');   // flop 1
  const [f2, setF2] = useState<string>('');   // flop 2
  const [f3, setF3] = useState<string>('');   // flop 3
  const [tr, setTr] = useState<string>('');   // turn
  const [rv, setRv] = useState<string>('');   // river

  // single GTO box: toggle edit/preview
  const [gtoEdit, setGtoEdit] = useState(false);

  // on story change, prefill empty summary fields once
  useEffect(() => {
    if (!stakes && preview.stakes) setStakes(preview.stakes);
    if (!position && preview.position) setPosition(preview.position);
    if (!h1 || !h2) {
      const pcs = (preview.heroCards || '').split(' ').filter(Boolean);
      if (pcs.length === 2) { if (!h1) setH1(pcs[0]); if (!h2) setH2(pcs[1]); }
    }
    if (!f1 && !f2 && !f3) {
      const arr = (preview.board.flop || '').split(' ').filter(Boolean);
      if (arr.length === 3) { setF1(arr[0]); setF2(arr[1]); setF3(arr[2]); }
    }
    if (!tr && preview.board.turn) setTr(preview.board.turn);
    if (!rv && preview.board.river) setRv(preview.board.river);
  }, [preview]); // eslint-disable-line react-hooks/exhaustive-deps

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const heroCardsStr = useMemo(() => {
    const a = suitifyToken(h1);
    const b = suitifyToken(h2);
    return [a, b].filter(Boolean).join(' ');
  }, [h1, h2]);

  const flopStr = useMemo(() => {
    const a = suitifyToken(f1), b = suitifyToken(f2), c = suitifyToken(f3);
    return [a, b, c].filter(Boolean).join(' ');
  }, [f1, f2, f3]);

  const turnStr = suitifyToken(tr);
  const riverStr = suitifyToken(rv);

  /* ----- network calls ----- */

  async function analyze() {
    setError(null);
    setStatus(null);
    setAiLoading(true);
    try {
      const board = [
        flopStr && `Flop: ${flopStr}`,
        turnStr && `Turn: ${turnStr}`,
        riverStr && `River: ${riverStr}`,
      ].filter(Boolean).join('  |  ');

      const payload = {
        date: today,
        stakes: stakes || undefined,
        position: position || undefined,
        cards: heroCardsStr || undefined,
        board: board || undefined,
        notes: input || undefined,
        rawText: input || undefined,
        fe_hint: feNeeded,
        spr_hint: spr
      };

      const r = await fetch('/api/analyze-hand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e?.error || `Analyze failed (${r.status})`);
      }
      const data = await r.json();
      setFields(prev => ({
        ...(prev ?? {}),
        gto_strategy: (data?.gto_strategy ?? '') || '',
        exploit_deviation: (data?.exploit_deviation ?? '') || '',
        learning_tag: Array.isArray(data?.learning_tag) ? data.learning_tag : [],
        date: today,
        stakes,
        position,
        cards: heroCardsStr,
        board
      }));
    } catch (e: any) {
      setError(e?.message || 'Analyze error');
    } finally {
      setAiLoading(false);
    }
  }

  async function saveToNotion() {
    if (!fields) return;
    setSaving(true);
    setStatus(null);
    try {
      const r = await fetch('/api/notion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields }),
      });
      const data = await r.json();
      if (data?.ok) setStatus(`Saved! Open in Notion: ${data.url}`);
      else setStatus(data?.error || 'Failed to save');
    } catch (e: any) {
      setStatus(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  /* ====================== UI ====================== */

  return (
    <main className="p">
      <div className="wrap">
        <h1 className="title">Only Poker</h1>

        <div className="grid">
          {/* LEFT column */}
          <div className="col">
            {/* Story box */}
            <section className="card">
              <div className="cardTitle">Hand Played</div>
              <textarea
                className="textarea"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={`Type your hand like a story — stakes, position, cards, actions…

Example:
Cash 6-max 100bb. BTN (Hero) 2.3x, BB calls.
Flop 8♠ 6♠ 2♦ — bet 50%, call.
Turn K♦ — ...`}
              />
              <div className="row gap">
                <button className="btn primary" onClick={analyze} disabled={aiLoading || !input.trim()}>
                  {aiLoading ? 'Analyzing…' : 'Send'}
                </button>
                <button
                  className="btn"
                  onClick={() => {
                    setInput(''); setFields(null); setStatus(null); setError(null);
                    setMode(''); setStakes(''); setEff(''); setPosition('');
                    setH1(''); setH2(''); setF1(''); setF2(''); setF3(''); setTr(''); setRv('');
                    setRisk(''); setReward(''); setFlopPot(''); setBehind('');
                  }}
                >Clear</button>
              </div>
              {error && <div className="err">{error}</div>}
            </section>

            {/* Situation Summary (editable) */}
            <section className="card">
              <div className="cardTitle">Situation Summary</div>

              <div className="summaryGrid">
                <Info label="Mode">
                  <select className="input" value={mode} onChange={e=>setMode(e.target.value as any)}>
                    <option value="">(unknown)</option>
                    <option value="CASH">CASH</option>
                    <option value="MTT">MTT</option>
                  </select>
                </Info>

                <Info label="Blinds / Stakes">
                  <input className="input" value={stakes} onChange={e=>setStakes(e.target.value)} placeholder={preview.stakes || '(unknown)'} />
                </Info>

                <Info label="Effective Stack (bb)">
                  <input className="input" value={eff} onChange={e=>setEff(e.target.value)} placeholder="(optional)" />
                </Info>

                <Info label="Positions">
                  <input className="input" value={position} onChange={e=>setPosition(e.target.value.toUpperCase())} placeholder={preview.position || '(unknown)'} />
                </Info>

                <Info label="Hero Hand">
                  <div className="cardsRow">
                    <CardEditor value={h1} onChange={setH1} placeholder={(preview.heroCards || '').split(' ')[0] || 'K♠'} />
                    <CardEditor value={h2} onChange={setH2} placeholder={(preview.heroCards || '').split(' ')[1] || 'K♦'} />
                  </div>
                </Info>

                <Info label="Board">
                  <div className="boardRow">
                    <span className="pillLbl">Flop</span>
                    <CardEditor value={f1} onChange={setF1} placeholder={(preview.board.flop || '').split(' ')[0] || 'J♠'} />
                    <CardEditor value={f2} onChange={setF2} placeholder={(preview.board.flop || '').split(' ')[1] || 'T♠'} />
                    <CardEditor value={f3} onChange={setF3} placeholder={(preview.board.flop || '').split(' ')[2] || '4♣'} />
                  </div>
                  <div className="boardRow">
                    <span className="pillLbl">Turn</span>
                    <CardEditor value={tr} onChange={setTr} placeholder={preview.board.turn || '9♣'} />
                  </div>
                  <div className="boardRow">
                    <span className="pillLbl">River</span>
                    <CardEditor value={rv} onChange={setRv} placeholder={preview.board.river || '3♠'} />
                  </div>
                </Info>
              </div>

              <div className="hint">Postflop: add exact suits (e.g., <b>As 4s</b>) for best accuracy. Edits here override the story.</div>
            </section>

            {/* FE & SPR */}
            <section className="card">
              <div className="cardTitle">Fold-Equity Threshold & SPR</div>

              <div className="feSprGrid">
                <div className="box">
                  <div className="boxTitle">FE calculator (bb units)</div>
                  <div className="grid2">
                    <label className="lbl">Risk (bb)</label>
                    <input className="input" value={risk} onChange={e=>setRisk(e.target.value)} placeholder="e.g., jam = eff BB" />
                    <label className="lbl">Reward (bb)</label>
                    <input className="input" value={reward} onChange={e=>setReward(e.target.value)} placeholder="pre-pot + bet size" />
                  </div>
                  <div className="calcLine">
                    FE needed ≈ <b>{feNeeded || '0%'}</b> &nbsp;
                    <span className="muted">(Risk / (Risk + Reward))</span>
                  </div>
                </div>

                <div className="box">
                  <div className="boxTitle">SPR (flop)</div>
                  <div className="grid2">
                    <label className="lbl">Flop pot (bb)</label>
                    <input className="input" value={flopPot} onChange={e=>setFlopPot(e.target.value)} placeholder="e.g., 5.9" />
                    <label className="lbl">Behind (bb)</label>
                    <input className="input" value={behind} onChange={e=>setBehind(e.target.value)} placeholder="effective after prefl" />
                  </div>
                  <div className="calcLine">SPR ≈ <b>{spr || '0'}</b></div>
                  <div className="sprChips">
                    <span className="chip">SPR ≤ 2: jam / b50 / x</span>
                    <span className="chip">SPR 2–5: b33 / b50 / x</span>
                    <span className="chip">SPR 5+: b25–33 / x</span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* RIGHT column */}
          <div className="col">
            {/* top info card */}
            <section className="card">
              <div className="infoGrid">
                <Info label="Date"><div>{today}</div></Info>
                <Info label="Position"><div>{position || <span className="muted">(unknown)</span>}</div></Info>
                <Info label="Stakes"><div>{stakes || <span className="muted">(unknown)</span>}</div></Info>
                <Info label="Cards">
                  {heroCardsStr
                    ? heroCardsStr.split(' ').map((c,i)=>(
                        <span key={i} style={{marginRight:6}}><CardText c={c} /></span>
                      ))
                    : <span className="muted">(unknown)</span>
                  }
                </Info>
              </div>
            </section>

            {/* GTO Strategy — single box with Preview/Edit toggle */}
            <section className="card">
              <div className="cardTitleRow">
                <div className="cardTitle">GTO Strategy</div>
                <button
                  className="btn tiny"
                  onClick={() => setGtoEdit(v => !v)}
                  title={gtoEdit ? 'Finish editing' : 'Edit raw text'}
                >
                  {gtoEdit ? 'Done' : 'Edit'}
                </button>
              </div>

              {gtoEdit ? (
                <>
                  <textarea
                    className="textarea mono"
                    rows={12}
                    placeholder="Edit or add notes…"
                    value={fields?.gto_strategy ?? ''}
                    onChange={e => fields && setFields({ ...fields, gto_strategy: e.target.value })}
                  />
                  <div className="muted small">Editing raw text. Click “Done” to return to the formatted preview.</div>
                </>
              ) : (
                <>
                  <div className="gtoBox">{renderGTO(fields?.gto_strategy || '')}</div>
                  <div className="muted small">Preview only. Click “Edit” to change the text.</div>
                </>
              )}
            </section>

            {/* Exploitative Deviations */}
            <section className="card">
              <div className="cardTitle">Exploitative Deviations</div>
              <ul className="list">
                {(fields?.exploit_deviation || '')
                  .split(/(?<=\.)\s+/)
                  .filter(Boolean)
                  .map((s,i)=><li key={i}>{s}</li>)}
              </ul>

              <div className="row end gapTop">
                <button className="btn" onClick={analyze} disabled={aiLoading}>
                  {aiLoading ? 'Analyzing…' : 'Analyze Again'}
                </button>
                <button className="btn primary" onClick={saveToNotion} disabled={!fields || saving}>
                  {saving ? 'Saving…' : 'Confirm & Save to Notion'}
                </button>
              </div>
              {status && <div className="note">{status}</div>}
            </section>
          </div>
        </div>
      </div>

      {/* ===================== Styles ===================== */}
      <style jsx global>{`
        :root{
          --bg:#f3f4f6; --card:#ffffff; --line:#e5e7eb; --text:#0f172a; --muted:#6b7280;
          --primary:#2563eb; --primary2:#1d4ed8; --btnText:#f8fbff;
        }
        *{box-sizing:border-box}
        html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
        .p{padding:24px}
        .wrap{max-width:1200px;margin:0 auto}
        .title{margin:0 0 12px;font-size:28px;font-weight:800;text-align:center}
        .grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
        @media (max-width:980px){.grid{grid-template-columns:1fr}}

        .col{display:flex;flex-direction:column;gap:18px}
        .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px;box-shadow:0 8px 24px rgba(0,0,0,.06)}
        .cardTitle{font-size:13px;font-weight:800;color:#111827;margin-bottom:8px}
        .cardTitleRow{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px}
        .textarea{width:100%;min-height:140px;border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:#fff}
        .textarea.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,Monaco,monospace}
        .row{display:flex;align-items:center}
        .end{justify-content:flex-end}
        .gap{gap:10px}
        .gapTop{margin-top:10px}
        .btn{border:1px solid var(--line);background:#fff;padding:10px 14px;border-radius:12px;cursor:pointer}
        .btn.tiny{padding:6px 10px;border-radius:10px;font-size:12px}
        .btn.primary{background:linear-gradient(180deg,var(--primary),var(--primary2));color:var(--btnText);border-color:#9db7ff}
        .btn[disabled]{opacity:.6;cursor:not-allowed}
        .err{margin-top:10px;color:#b91c1c}
        .note{margin-top:10px;color:#166534}
        .muted{color:var(--muted)}
        .small{font-size:12px}

        .infoGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
        .summaryGrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
        @media (max-width:900px){.summaryGrid{grid-template-columns:1fr}}

        .ibox{border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:#fff;min-height:52px}
        .lblSmall{font-size:11px;color:#6b7280;margin-bottom:4px}
        .input{width:100%;border:1px solid var(--line);border-radius:10px;padding:8px 10px}
        .cardsRow{display:flex;gap:8px;align-items:center}
        .boardRow{display:flex;gap:8px;align-items:center;margin-top:6px}
        .pillLbl{font-size:12px;color:#6b7280;min-width:40px;text-align:right}

        .cardInput{width:64px;text-align:center;border:1px solid var(--line);border-radius:10px;padding:8px 8px}
        .cardInput:focus{outline:2px solid #bfdbfe}
        .cardEcho{margin-left:6px;font-size:14px}

        .hint{margin-top:8px;font-size:12px;color:#6b7280}

        .feSprGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
        @media (max-width:900px){.feSprGrid{grid-template-columns:1fr}}
        .box{border:1px solid var(--line);border-radius:12px;padding:10px}
        .boxTitle{font-size:12px;font-weight:700;margin-bottom:6px;color:#374151}
        .grid2{display:grid;grid-template-columns:120px 1fr;gap:8px;align-items:center}
        .lbl{font-size:12px;color:#6b7280}
        .calcLine{margin-top:8px}
        .sprChips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
        .chip{border:1px solid var(--line);border-radius:999px;padding:6px 10px;font-size:12px;background:#f8fafc}
        .list{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px}

        /* GTO preview styles */
        .gtoBox{border:1px dashed #cbd5e1;border-radius:12px;background:#f8fafc;padding:12px}
        .gtoBody{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,Monaco,monospace;font-size:13.5px;line-height:1.45}
        .gtoLine{margin:2px 0}
        .gtoHead{font-weight:800}
        .gtoBullet{margin:2px 0 2px 12px}
      `}</style>
    </main>
  );
}

/* ================ Small UI atoms ================ */

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ibox">
      <div className="lblSmall">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function CardEditor({
  value, onChange, placeholder
}: { value: string; onChange: (v: string)=>void; placeholder?: string }) {
  const [local, setLocal] = useState<string>(value || '');

  useEffect(()=>{ setLocal(value || ''); }, [value]);

  const norm = suitifyToken(local);
  const echo = norm ? <CardText c={norm} /> : <span style={{color:'#9ca3af'}}>{placeholder || ''}</span>;

  return (
    <div style={{display:'flex',alignItems:'center'}}>
      <input
        className="cardInput"
        value={local}
        onChange={(e)=>setLocal(e.target.value)}
        onBlur={()=>onChange(suitifyToken(local))}
        placeholder={placeholder || 'A♠'}
      />
      <div className="cardEcho" title="Normalized">{echo}</div>
    </div>
  );
}
