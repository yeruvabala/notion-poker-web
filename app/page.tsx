'use client';

import React, { useMemo, useState, useEffect } from 'react';

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

/** ---------------- Small utils ---------------- */
const trim = (s: any) => (typeof s === 'string' ? s.trim() : '');
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

/** normalize a single token like "as", "A♠", "ah", "Ad" to "A♠" */
const suitify = (card: string) => {
  const m = (card || '').replace(/\s+/g, '').match(/^([2-9TJQKA])([shdc♥♦♣♠])$/i);
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

const CardSpan = ({ c }: { c: string }) =>
  !c ? null : <span style={{ fontWeight: 600, color: suitColor(c.slice(-1)) }}>{c}</span>;

/** ---------------- Parsing helpers ---------------- */
const parseStakes = (t: string) => {
  // "$1/$3", "1/2/2 ante", "4k/8k/8k"
  const m1 = (t || '').match(/(\$?\d+(?:\.\d+)?)[\s]*[\/-][\s]*(\$?\d+(?:\.\d+)?)(?:\s*[\/-]\s*(\$?\d+(?:\.\d+)?))?/i);
  return m1 ? m1[0] : '';
};

const parseHeroPosition = (t: string) => {
  const up = (t || '').toUpperCase();
  const m1 = up.match(/\b(I|I'M|IM|I AM|HERO)\b[^.]{0,40}?\b(ON|FROM|IN)\s+(UTG\+\d|UTG|MP|HJ|CO|BTN|SB|BB)\b/);
  if (m1) return m1[3];
  const m2 = up.match(/\b(AM|I'M|IM|I)\b[^.]{0,10}?\bON\s+(UTG\+\d|UTG|MP|HJ|CO|BTN|SB|BB)\b/);
  if (m2) return m2[2];
  const m3 = up.match(/\bON\s+(SB|BB|BTN|CO|HJ|MP|UTG(?:\+\d)?)\b/);
  if (m3) return m3[1];
  const PREF = ['SB','BB','BTN','CO','HJ','MP','UTG+2','UTG+1','UTG'];
  for (const p of PREF) if (up.includes(` ${p} `)) return p;
  return '';
};

// Robust hero-card parser:
//  - "A4s" or "a4o"
//  - "A4♠" (assume both suit = suited shorthand)
//  - "As 4s", "Ah Qs"
//  - "A4 of spades", etc.
// For offsuit (A4o), suits are *not* required (defaults A♠ 4♥ for display).
const parseHeroCardsSmart = (t: string) => {
  const s = (t || '').toLowerCase();

  // 1) two explicit tokens "as 4s"
  let m = s.match(/([2-9tjqka][shdc♥♦♣♠])\s+([2-9tjqka][shdc♥♦♣♠])/i);
  if (m) return [suitify(m[1]), suitify(m[2])].join(' ');

  // 2) compact "A4s" / "A4o"
  m = s.match(/\b([2-9tjqka])\s*([2-9tjqka])\s*(s|o)\b/i);
  if (m) {
    const r1 = m[1].toUpperCase(), r2 = m[2].toUpperCase();
    const suited = m[3].toLowerCase() === 's';
    if (suited) return `${r1}♠ ${r2}♠`;   // display suited; suit color picked arbitrarily
    return `${r1}♠ ${r2}♥`;               // offsuit → distinct suits for clarity
  }

  // 3) odd "A4♠" → assume both that suit (suited shorthand)
  m = s.match(/\b([2-9tjqka])\s*([2-9tjqka])\s*([♥♦♣♠])\b/i);
  if (m) {
    const r1 = m[1].toUpperCase(), r2 = m[2].toUpperCase();
    const suitChar = m[3];
    return `${r1}${suitChar} ${r2}${suitChar}`;
  }

  // 4) "with Ah Qs"
  m = s.match(/\b(?:with|holding|have|having|i\s+have)\s+([2-9tjqka][shdc♥♦♣♠])\s+([2-9tjqka][shdc♥♦♣♠])\b/i);
  if (m) return [suitify(m[1]), suitify(m[2])].join(' ');

  // 5) "with A4s / A4o" or "with A4 of spades"
  m = s.match(/\b(?:with|holding|have|having|i\s+have)\s*([2-9tjqka])\s*([2-9tjqka])\s*(s|o|suited|offsuit)?(?:\s*of\s*(spades?|hearts?|diamonds?|clubs?))?/i);
  if (m) {
    const r1 = m[1].toUpperCase(), r2 = m[2].toUpperCase();
    const suitWord = (m[4] || '').toLowerCase();
    const suitChar = suitWord ? SUIT_WORD[suitWord] : '♠';
    const suited = m[3] === 's' || m[3] === 'suited' || !!suitWord;
    if (suited) return `${r1}${suitChar} ${r2}${suitChar}`;
    return `${r1}♠ ${r2}♥`;
  }

  // 6) "a4 of spades"
  m = s.match(/\b([2-9tjqka])\s*([2-9tjqka])\s*of\s*(spades?|hearts?|diamonds?|clubs?)\b/i);
  if (m) {
    const suitChar = SUIT_WORD[(m[3] || '').toLowerCase()];
    return `${m[1].toUpperCase()}${suitChar} ${m[2].toUpperCase()}${suitChar}`;
  }

  return '';
};

// Parse board from text tokens
const parseBoardFromText = (line: string) => {
  const arr = suitifyLine(line).split(' ').filter(Boolean);
  return {
    flop: arr.slice(0, 3).join(' ') || '',
    turn: arr[3] || '',
    river: arr[4] || '',
  };
};
const parseBoard = (t: string) => {
  const get3 = (c: string) => suitifyLine(c).split(' ').slice(0, 3).join(' ');
  const fm = (t || '').match(/flop[^\n:]*[:\-]*\s*([^\n]+)/i);
  const tm = (t || '').match(/turn[^\n:]*[:\-]*\s*([^\n]+)/i);
  const rm = (t || '').match(/river[^\n:]*[:\-]*\s*([^\n]+)/i);
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

// Simple mode/stage/ICM info
const parseMode = (t: string) => {
  const s = (t || '').toLowerCase();
  if (/\b(mtt|tournament|day ?\d|level ?\d+|players left|itm|bubble|final table|ft)\b/.test(s)) return 'MTT';
  if (/\$?\d+\s*\/\s*\$?\d+/.test(s) && !/\bplayers left\b/i.test(s)) return 'Cash';
  return '';
};
const parseICM = (t: string) => /\b(icm|bubble|final table|ft|ladder|payouts?|in the money|itm)\b/i.test(t || '');
const parsePlayersLeft = (t: string) => {
  const m = (t || '').match(/\b(\d{1,4})\s*(?:players?\s*)?(?:left|remain(?:ing)?)\b/i);
  return m ? Number(m[1]) : null;
};
const parseEffBB = (t: string) => {
  const m = (t || '').match(/\b(?:eff(?:ective)?|effective\s*stack|stack)\s*(\d+(?:\.\d+)?)\s*bb\b/i);
  return m ? Number(m[1]) : null;
};
const parseOpenX = (t: string) => {
  const m = (t || '').match(/(\d+(?:\.\d+)?)\s*x\b/i);
  return m ? Number(m[1]) : null;
};
// 4k/8k/8k → { sb:0.5, bb:1, ante:1 } in bb units; 1/3 → { sb:0.5, bb:1, ante:0 }
const parseBlindsToBBUnits = (t: string) => {
  const s = (t || '').replace(/,/g, '');
  const m = s.match(/(\d+(?:\.\d+)?[kKmM]?)\s*\/\s*(\d+(?:\.\d+)?[kKmM]?)(?:\s*\/\s*(\d+(?:\.\d+)?[kKmM]?))?/);
  if (!m) return null;
  const toNum = (x: string) => {
    const n = parseFloat(x.replace(/[kKmM]/i, ''));
    if (/m/i.test(x)) return n * 1_000_000;
    if (/k/i.test(x)) return n * 1_000;
    return n;
  };
  const a = toNum(m[1]), b = toNum(m[2]), c = m[3] ? toNum(m[3]) : 0;
  if (!b) return null;
  return { sb: a / b, bb: 1, ante: c ? c / b : 0 };
};

// Heuristic: is there postflop action/board?
const isPostflopHand = (raw: string) => {
  const s = (raw || '').toLowerCase();
  if (/flop|turn|river/.test(s)) return true;
  const b = parseBoard(raw);
  return Boolean(b.flop || b.turn || b.river);
};

/** ---------------- Component ---------------- */
export default function Page() {
  // INPUT
  const [input, setInput] = useState('');
  const [fields, setFields] = useState<Fields | null>(null);

  // Async state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // FE/SPR calculator state
  const [riskBB, setRiskBB] = useState<string>('');     // risk in bb
  const [rewardBB, setRewardBB] = useState<string>(''); // reward in bb (pot if folds)
  const [flopPotBB, setFlopPotBB] = useState<string>(''); // flop pot bb
  const [behindBB, setBehindBB] = useState<string>('');   // eff behind on flop

  // Lightweight parse for preview (client-side only)
  const preview = useMemo(() => ({
    mode: parseMode(input),                       // "MTT" | "Cash" | ""
    icm: parseICM(input),
    playersLeft: parsePlayersLeft(input),
    effBB: parseEffBB(input),
    openX: parseOpenX(input),
    stakes: parseStakes(input),
    position: parseHeroPosition(input),
    heroCards: parseHeroCardsSmart(input),
    board: parseBoard(input),
  }), [input]);

  const heroCards = (fields?.cards || preview.heroCards || '').trim();

  const boardFromAssist = parseBoardFromText(fields?.board || '');
  const flop = (boardFromAssist.flop || preview.board.flop || '').trim();
  const turn = (boardFromAssist.turn || preview.board.turn || '').trim();
  const river = (boardFromAssist.river || preview.board.river || '').trim();

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const pos = (fields?.position ?? preview.position ?? '').toUpperCase() || '';

  const postflop = useMemo(() => isPostflopHand(input), [input]);

  // Auto-suggest Risk/Reward and SPR from text (best-effort)
  useEffect(() => {
    // FE defaults
    const eff = preview.effBB ?? null;
    const blinds = parseBlindsToBBUnits(input);
    const prePot = blinds ? (blinds.sb + blinds.bb + (blinds.ante || 0)) : 0; // ≈ 2.5bb if BBA
    const openTo = preview.openX || null; // X * bb
    const rewardGuess = prePot + (openTo || 0); // very rough
    const riskGuess = eff || ''; // rough: jam ≈ eff stack

    if (!riskBB) setRiskBB(riskGuess ? String(riskGuess) : '');
    if (!rewardBB) setRewardBB(rewardGuess ? String(Math.round(rewardGuess * 10) / 10) : '');

    // SPR defaults
    if (!flopPotBB) {
      // crude flop pot estimate if BTN opens and BB defends: 2.5 + openTo + (openTo-1)
      let estFlopPot = 0;
      if (blinds && openTo) estFlopPot = (blinds.sb + blinds.bb + (blinds.ante || 0)) + openTo + Math.max(openTo - 1, 0);
      if (estFlopPot) setFlopPotBB(String(Math.round(estFlopPot * 10) / 10));
    }
    if (!behindBB && eff) setBehindBB(String(eff));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input, preview.effBB, preview.openX]);

  /** -------- Missing-info chips ---------- */
  type Chip = { label: string; insert: string; required?: boolean };
  const missingChips: Chip[] = useMemo(() => {
    const chips: Chip[] = [];
    if (!heroCards) {
      chips.push({ label: 'Add Hero Cards', insert: 'Cards (Hero): A♠ K♠   (edit this)' , required: true });
    }
    // Only require suits postflop
    if (postflop && heroCards && !/[♥♦♣♠]/.test(heroCards)) {
      chips.push({ label: 'Add suits for postflop', insert: 'Cards (Hero): A♠ K♠   (add suits; for offsuit write "A4o")', required: true });
    }
    if (!preview.stakes) {
      chips.push({ label: 'Add Blinds/Stakes', insert: 'Blinds/Ante: 4k/8k/8k  (or $1/$3)' });
    }
    if (!preview.effBB && preview.mode === 'MTT') {
      chips.push({ label: 'Add Effective BB', insert: 'Effective stack: 25bb' });
    }
    if (preview.mode === 'MTT' && preview.playersLeft == null) {
      chips.push({ label: 'Add Players Left', insert: 'Players left: 13 (ITM)' });
    }
    if (preview.mode === 'MTT' && !preview.icm) {
      chips.push({ label: 'Add ICM / Stage', insert: 'ICM: FT bubble / two shorter stacks' });
    }
    if (postflop && !flop) {
      chips.push({ label: 'Add Flop', insert: 'Flop: Kc 7s 2h' , required: true });
    }
    if (postflop && flop && !turn && /\bturn\b/i.test(input)) {
      chips.push({ label: 'Add Turn', insert: 'Turn: Ac' });
    }
    if (postflop && (turn || /\briver\b/i.test(input)) && !river) {
      chips.push({ label: 'Add River', insert: 'River: 3s' });
    }
    // Open size if mentioned as x but missing explicit line
    if (!preview.openX && /\braise|open/i.test(input)) {
      chips.push({ label: 'Add Open Size', insert: 'Open: 2.2x' });
    }
    return chips;
  }, [heroCards, preview, postflop, flop, turn, river, input]);

  const insertChip = (c: Chip) => {
    const needsNL = input.endsWith('\n') || input.length === 0 ? '' : '\n';
    setInput(prev => `${prev}${needsNL}${c.insert}\n`);
  };

  /** ---------- GTO analyze ---------- */
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
        board: [flop && `Flop: ${flop}`, turn && `Turn: ${turn}`, river && `River: ${river}`]
          .filter(Boolean)
          .join('  |  '),
        // Send full raw text so analyzer judges the whole line
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

  /** ---------- FE & SPR math ---------- */
  const riskNum = Number(riskBB) || 0;
  const rewNum = Number(rewardBB) || 0;
  const feNeeded = (riskNum > 0 && rewNum >= 0) ? (riskNum / (riskNum + rewNum)) : 0;

  const potFlopNum = Number(flopPotBB) || 0;
  const behindNum = Number(behindBB) || 0;
  const spr = (potFlopNum > 0 && behindNum >= 0) ? (behindNum / potFlopNum) : 0;

  /** ---------- UI ---------- */
  return (
    <main className="p-page">
      <div className="p-container">
        <header className="p-header">
          <h1 className="p-title">Only Poker</h1>
        </header>

        <section className="p-grid">
          {/* LEFT COLUMN */}
          <div className="p-col">
            {/* Hand input */}
            <div className="p-card">
              <div className="p-cardTitle">Hand Played</div>
              <textarea
                className="p-textarea"
                placeholder={[
                  'Tell the story with key facts. Examples:',
                  '• MTT L20 (4k/8k/8k), Eff 25bb. HJ (Hero) A♠Q♦ opens 2.2x, BB calls. Flop Q72r b33, turn A x/x, river 3 vbet 33 — called by QTo.',
                  '• Cash $1/$3, Eff 150bb. CO opens 2.5x, BTN calls, I’m SB A♠4♠ 3-bet 11.5bb, CO calls…',
                  '',
                  'Tips: If preflop-only, you can write A4s or A4o (no suits needed). If there’s postflop action, include suits for Hero and board.',
                ].join('\n')}
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

            {/* Row 1 — Situation Summary + Missing Info Chips */}
            <div className="p-card">
              <div className="p-subTitle">Situation Summary</div>
              <div className="summaryGrid">
                <div>
                  <div className="ibox">
                    <div className="iboxLabel">Mode</div>
                    <div className="iboxVal">{preview.mode || <span className="p-muted">(unknown)</span>}</div>
                  </div>
                </div>
                <div>
                  <div className="ibox">
                    <div className="iboxLabel">Blinds / Stakes</div>
                    <div className="iboxVal">{preview.stakes || <span className="p-muted">(unknown)</span>}</div>
                  </div>
                </div>
                <div>
                  <div className="ibox">
                    <div className="iboxLabel">Effective Stack (bb)</div>
                    <div className="iboxVal">{preview.effBB ?? <span className="p-muted">(unknown)</span>}</div>
                  </div>
                </div>
                <div>
                  <div className="ibox">
                    <div className="iboxLabel">Positions</div>
                    <div className="iboxVal">{pos || <span className="p-muted">(unknown)</span>}</div>
                  </div>
                </div>
                <div>
                  <div className="ibox">
                    <div className="iboxLabel">Hero Hand</div>
                    <div className="iboxVal">
                      {heroCards
                        ? heroCards.split(' ').map((c, i) => <span key={i} className="p-cardSpan"><CardSpan c={c} /></span>)
                        : <span className="p-muted">(unknown)</span>}
                    </div>
                  </div>
                </div>
                <div>
                  <div className="ibox">
                    <div className="iboxLabel">Board</div>
                    <div className="iboxVal">
                      {flop || turn || river ? (
                        <>
                          <span className="p-pill">Flop:&nbsp;{flop ? flop.split(' ').map((c,i)=>(<span key={i} className="p-cardSpan"><CardSpan c={c} />{i<2?' ':''}</span>)) : <span className="p-muted">—</span>}</span>{' '}
                          <span className="p-pill">Turn:&nbsp;{turn ? <CardSpan c={turn} /> : <span className="p-muted">—</span>}</span>{' '}
                          <span className="p-pill">River:&nbsp;{river ? <CardSpan c={river} /> : <span className="p-muted">—</span>}</span>
                        </>
                      ) : <span className="p-muted">(not applicable)</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Missing info chips */}
              {missingChips.length > 0 && (
                <>
                  <div className="p-muted" style={{marginTop:8, fontSize:12}}>Looks like some details would help. Click a chip to insert a line below:</div>
                  <div className="chips" style={{marginTop:8}}>
                    {missingChips.map((c, i) => (
                      <button
                        key={i}
                        className={`chipBtn ${c.required ? 'chipReq' : ''}`}
                        onClick={() => insertChip(c)}
                        title="Insert into Hand Played"
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Row 2 — FE Threshold + SPR */}
            <div className="p-card">
              <div className="p-subTitle">Fold-Equity Threshold & SPR</div>
              <div className="twoCol">
                {/* FE panel */}
                <div className="calcCard">
                  <div className="iboxLabel">FE calculator (bb units)</div>
                  <div className="calcRow">
                    <label className="calcLabel">Risk (bb)</label>
                    <input className="p-input" type="number" value={riskBB} onChange={e=>setRiskBB(e.target.value)} placeholder="e.g., jam = eff BB" />
                  </div>
                  <div className="calcRow">
                    <label className="calcLabel">Reward (bb)</label>
                    <input className="p-input" type="number" value={rewardBB} onChange={e=>setRewardBB(e.target.value)} placeholder="pre-pot + bet size" />
                  </div>
                  <div className="calcOut">
                    FE needed ≈ <b>{isFinite(feNeeded) ? Math.round(feNeeded * 100) : 0}%</b> &nbsp;
                    <span className="p-muted">(Risk / (Risk + Reward))</span>
                  </div>
                </div>

                {/* SPR panel */}
                <div className="calcCard">
                  <div className="iboxLabel">SPR (flop)</div>
                  <div className="calcRow">
                    <label className="calcLabel">Flop pot (bb)</label>
                    <input className="p-input" type="number" value={flopPotBB} onChange={e=>setFlopPotBB(e.target.value)} placeholder="e.g., 5.9" />
                  </div>
                  <div className="calcRow">
                    <label className="calcLabel">Behind (bb)</label>
                    <input className="p-input" type="number" value={behindBB} onChange={e=>setBehindBB(e.target.value)} placeholder="effective after preflop" />
                  </div>
                  <div className="calcOut">
                    SPR ≈ <b>{spr ? (Math.round(spr * 10) / 10) : 0}</b>
                  </div>
                  <div className="sprChips">
                    <span className="sprChip" title="commit frequently">SPR ≤ 2: jam / b50 / x</span>
                    <span className="sprChip" title="mixed sizings">SPR 2–5: b33 / b50 / x</span>
                    <span className="sprChip" title="range control">SPR 5+: b25–33 / x</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="p-col">
            {/* Top info card */}
            <div className="p-card">
              <div className="p-grid2">
                <InfoBox label="Date"><div>{today}</div></InfoBox>
                <InfoBox label="Position"><div>{pos || <span className="p-muted">(unknown)</span>}</div></InfoBox>
                <InfoBox label="Stakes"><div>{preview.stakes || <span className="p-muted">(unknown)</span>}</div></InfoBox>
                <InfoBox label="Hero Cards">
                  <div className="p-cards">
                    {heroCards
                      ? heroCards.split(' ').map((c, i) => <span key={i} className="p-cardSpan"><CardSpan c={c} /></span>)
                      : <span className="p-muted">(unknown)</span>}
                  </div>
                </InfoBox>
              </div>
            </div>

            {/* GTO Strategy */}
            <div className="p-card">
              <div className="p-subTitle">GTO Strategy (detailed)</div>
              <textarea
                className="p-input p-mono"
                rows={10}
                placeholder="Preflop/Flop/Turn/River plan with sizes…"
                value={fields?.gto_strategy ?? ''}
                onChange={e => fields && setFields({ ...fields, gto_strategy: e.target.value })}
              />
              <div className="p-help">We’ll auto-fill this after “Send”. You can also edit.</div>
            </div>

            {/* Exploit deviations */}
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
                  disabled={aiLoading}
                  onClick={() => analyzeParsedHand(fields ?? {})}
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

          --chipBg:#eef2ff; --chipBorder:#c7d2fe; --chipText:#1e3a8a;
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
        .p-btn.p-primary:hover{filter:brightness(1.05)}

        .p-input{
          width:100%; padding:10px 12px; border-radius:12px; border:1px solid var(--line);
          background:#ffffff; color:#0f172a; font-size:14.5px;
        }
        .p-input.p-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace; line-height:1.45}

        .p-help{margin-top:8px; font-size:12px; color:var(--muted)}
        .p-note{margin-top:10px; color:#166534}
        .p-err{margin-top:10px; color:#b91c1c}
        .p-muted{color:var(--muted)}

        .p-cards{}
        .p-cardSpan{margin-right:4px}

        .p-grid2{display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:8px}
        .ibox{background:#ffffff; border:1px solid var(--pillBorder); border-radius:12px; padding:10px 12px}
        .iboxLabel{font-size:11px; color:#6b7280; margin-bottom:3px}
        .iboxVal{font-size:14px}
        .p-pill{
          background:var(--pillBg); border:1px solid var(--pillBorder);
          padding:6px 10px; border-radius:999px; margin-right:6px;
        }

        .summaryGrid{
          display:grid;
          grid-template-columns: repeat(3, 1fr);
          gap:10px;
        }
        @media (max-width:900px){ .summaryGrid{grid-template-columns:1fr 1fr} }

        .chips{display:flex; gap:8px; flex-wrap:wrap}
        .chipBtn{
          background:var(--chipBg); border:1px solid var(--chipBorder); color:var(--chipText);
          padding:6px 10px; border-radius:999px; font-size:12.5px; cursor:pointer;
        }
        .chipBtn:hover{filter:brightness(1.02)}
        .chipReq{border-color:#a78bfa; background:#ede9fe}

        .twoCol{
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:12px;
        }
        @media (max-width:900px){ .twoCol{grid-template-columns:1fr} }

        .calcCard{ background:#fff; border:1px solid var(--pillBorder); border-radius:12px; padding:10px 12px }
        .calcRow{ display:flex; gap:10px; align-items:center; margin-top:8px }
        .calcLabel{ width:120px; font-size:12.5px; color:#6b7280 }
        .calcOut{ margin-top:10px; font-size:14px }
        .sprChips{ display:flex; gap:6px; flex-wrap:wrap; margin-top:8px }
        .sprChip{ background:#f3f4f6; border:1px solid #e5e7eb; border-radius:999px; padding:4px 8px; font-size:12px }
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
