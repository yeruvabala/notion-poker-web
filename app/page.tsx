'use client';

import React, { useMemo, useState, useEffect } from 'react';

/** ---------------- Types ---------------- */
type Fields = {
  date?: string | null;
  stakes?: string | null;
  position?: string | null;
  cards?: string | null;
  villain_action?: string | null;
  villian_action?: string | null;
  gto_strategy?: string | null;
  exploit_deviation?: string | null;
  learning_tag?: string[];
  board?: string | null;
  notes?: string | null;
};

type Street = 'preflop' | 'flop' | 'turn' | 'river';

type HeroHand = {
  r1: string;               // e.g., 'A'
  r2: string;               // e.g., '4'
  suited: boolean | null;   // true/false when known, null if 'A4' ambiguous (preflop allowed)
  s1: string | null;        // 's','h','d','c' when exactly known, else null
  s2: string | null;
  exact: boolean;           // true when explicit suits (or explicit offsuit), else false
  label: string;            // pretty version to show in UI (e.g., 'A♠ 4♠' or 'A4s')
};

/** ------------- Helpers ------------- */
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

const parseStakes = (t: string) => {
  const m = t.match(/(\$?\d+(?:\.\d+)?)[\s]*[\/-][\s]*(\$?\d+(?:\.\d+)?)/);
  return m ? `${m[1]}/${m[2]}` : '';
};

const parseHeroPosition = (t: string) => {
  const up = t.toUpperCase();
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

/* ---------- Street detector ---------- */
function detectStreet(raw: string): Street {
  const s = (raw || '').toLowerCase();
  // Board tokens from plain text
  const cardTokens = (s.match(/\b[2-9tjqka][shdc♥♦♣♠]\b/g) || []).length;
  if (/river\b|river:/.test(s) || cardTokens >= 5) return 'river';
  if (/turn\b|turn:/.test(s) || cardTokens >= 4) return 'turn';
  if (/flop\b|flop:|c-?bet|cbets?/.test(s) || cardTokens >= 3) return 'flop';
  return 'preflop';
}

/* ---------- Hero input parser (strict: only from Hero input) ---------- */
function parseHeroAssist(input: string, street: Street): { hand: HeroHand | null; error: string | null } {
  const txt = (input || '').trim();
  if (!txt) return { hand: null, error: 'Add Hero cards (e.g., A4s / A4o or exact: As 4s).' };

  // 1) Exact suits like "As 4s" or "A♥ Q♠"
  let m = txt.match(/^\s*([2-9TJQKA])\s*([♥♦♣♠shdc])\s+([2-9TJQKA])\s*([♥♦♣♠shdc])\s*$/i);
  if (m) {
    const r1 = m[1].toUpperCase();
    const s1 = (m[2] || '').toLowerCase();
    const r2 = m[3].toUpperCase();
    const s2 = (m[4] || '').toLowerCase();
    const suit1 = SUIT_MAP[s1] ? s1 : ({ '♥':'h','♦':'d','♣':'c','♠':'s' } as any)[m[2]];
    const suit2 = SUIT_MAP[s2] ? s2 : ({ '♥':'h','♦':'d','♣':'c','♠':'s' } as any)[m[4]];
    const hand: HeroHand = {
      r1, r2,
      suited: suit1 === suit2,
      s1: suit1, s2: suit2,
      exact: true,
      label: `${r1}${SUIT_MAP[suit1]} ${r2}${SUIT_MAP[suit2]}`
    };
    return { hand, error: null };
  }

  // 2) Compact ranks + s/o: "A4s" / "A4o"
  m = txt.match(/^\s*([2-9TJQKA])\s*([2-9TJQKA])\s*([so])\s*$/i);
  if (m) {
    const r1 = m[1].toUpperCase();
    const r2 = m[2].toUpperCase();
    const isSuited = m[3].toLowerCase() === 's';
    const hand: HeroHand = {
      r1, r2,
      suited: isSuited,
      s1: null, s2: null,
      exact: true,                       // exact for preflop decisions
      label: `${r1}${r2}${isSuited ? 's' : 'o'}`
    };
    // If postflop and only 's'/'o' provided, gently warn to add exact suits (but allow send)
    if (street !== 'preflop' && isSuited) {
      return { hand, error: 'Post-flop: add exact suits (e.g., As 4s) for best accuracy.' };
    }
    return { hand, error: null };
  }

  // 3) Rank + suit word pattern: "A 4 of spades"
  m = txt.match(/^\s*([2-9TJQKA])\s*([2-9TJQKA])\s*(?:of\s+)?(spades?|hearts?|diamonds?|clubs?)\s*$/i);
  if (m) {
    const r1 = m[1].toUpperCase(), r2 = m[2].toUpperCase();
    const s = (m[3] || '').toLowerCase();
    const suitChar = ({ spade:'s',spades:'s',heart:'h',hearts:'h',diamond:'d',diamonds:'d',club:'c',clubs:'c' } as any)[s];
    const hand: HeroHand = {
      r1, r2,
      suited: true,
      s1: suitChar, s2: suitChar,
      exact: true,
      label: `${r1}${SUIT_MAP[suitChar]} ${r2}${SUIT_MAP[suitChar]}`
    };
    return { hand, error: null };
  }

  // 4) Bare ranks like "A4"
  m = txt.match(/^\s*([2-9TJQKA])\s*([2-9TJQKA])\s*$/i);
  if (m) {
    const r1 = m[1].toUpperCase(), r2 = m[2].toUpperCase();
    const hand: HeroHand = {
      r1, r2,
      suited: null,
      s1: null, s2: null,
      exact: false,
      label: `${r1}${r2}`
    };
    const error = (street === 'preflop')
      ? 'Add s/o if you can (A4s or A4o).'
      : 'Post-flop: add exact suits (e.g., As 4s) for accuracy.';
    return { hand, error };
  }

  return { hand: null, error: 'Unrecognized format. Use A4s/A4o or exact suits like As 4s.' };
}

/* ---------- Board parsing from Assist ---------- */
function hasSuitToken(c: string): boolean {
  return /[shdc♥♦♣♠]$/i.test(c || '');
}
function parseBoardAssist(input: string) {
  const raw = (input || '').trim();
  if (!raw) return { flop: '', turn: '', river: '', tokens: [] as string[] };
  const parts = raw.replace(/\s*\|\s*/g, ' | ').trim().split(/\s+/);
  const tokens: string[] = [];

  for (const p of parts) {
    if (p === '|') { tokens.push('|'); continue; }
    const norm = suitify(p);
    if (norm) tokens.push(norm);
  }

  const barIdx1 = tokens.indexOf('|');
  const barIdx2 = barIdx1 >= 0 ? tokens.indexOf('|', barIdx1 + 1) : -1;

  const flopArr = (barIdx1 >= 0 ? tokens.slice(0, barIdx1) : tokens.slice(0, 3)).filter(t => t !== '|');
  const turnArr = (barIdx1 >= 0 && barIdx2 >= 0 ? tokens.slice(barIdx1 + 1, barIdx2) : (barIdx1 >= 0 ? tokens.slice(barIdx1 + 1) : tokens.slice(3, 4))).filter(t => t !== '|');
  const riverArr = (barIdx2 >= 0 ? tokens.slice(barIdx2 + 1) : tokens.slice(4, 5)).filter(t => t !== '|');

  return {
    flop: flopArr.slice(0,3).join(' '),
    turn: turnArr.slice(0,1).join(' '),
    river: riverArr.slice(0,1).join(' '),
    tokens
  };
}

/* ---------- Text parsers used only for preview ---------- */
const parseBoardFromText = (line: string) => {
  const arr = suitifyLine(line).split(' ').filter(Boolean);
  return {
    flop: arr.slice(0, 3).join(' ') || '',
    turn: arr[3] || '',
    river: arr[4] || '',
  };
};
const parseBoardStory = (t: string) => {
  const get3 = (c: string) => suitifyLine(c).split(' ').slice(0, 3).join(' ');
  const fm = t.match(/flop[^\n:]*[:\-]*\s*([^\n]+)/i);
  const tm = t.match(/turn[^\n:]*[:\-]*\s*([^\n]+)/i);
  const rm = t.match(/river[^\n:]*[:\-]*\s*([^\n]+)/i);
  let flop = fm ? get3(fm[1]) : '';
  let turn = tm ? suitifyLine(tm[1]).split(' ')[0] || '' : '';
  let river = rm ? suitifyLine(rm[1]).split(' ')[0] || '' : '';
  return { flop, turn, river };
};

const twoCardsFrom = (line: string) =>
  suitifyLine(line).split(' ').slice(0, 2).join(' ');

const CardSpan = ({ c }: { c: string }) =>
  !c ? null : <span style={{ fontWeight: 600, color: suitColor(c.slice(-1)) }}>{c}</span>;

/** ---------- Range Grid helpers ---------- */
const RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'] as const;
const rIndex: Record<string, number> = Object.fromEntries(RANKS.map((r, i) => [r, i]));
function handLabel(i: number, j: number): string {
  const a = RANKS[i], b = RANKS[j];
  if (i === j) return `${a}${a}`;
  return i < j ? `${a}${b}s` : `${a}${b}o`;
}
const atLeast = (rank: string, min: string) => rIndex[rank] <= rIndex[min];
const oneOf = (x: string, arr: string[]) => arr.includes(x);

/** Baseline open decision by position (approx) */
function defaultOpen(pos: string, label: string): boolean {
  pos = (pos || '').toUpperCase();
  const [a, b, t] = label.length === 3 ? [label[0], label[1], label[2]] : [label[0], label[1], 'p'];
  const pair = t === 'p';
  const suited = t === 's';
  const offsuit = t === 'o';
  const pairMin: Record<string, string> = {
    UTG: '6', MP: '4', HJ: '2', CO: '2', BTN: '2', SB: '2', BB: '2'
  };
  if (pair) return atLeast(a, pairMin[pos] || '2');
  if (a === 'A') {
    if (suited) return true;
    const minOff: Record<string, string> = { UTG: 'T', MP: 'T', HJ: '9', CO: '8', BTN: '2', SB: '5', BB: 'T' };
    return atLeast(b, minOff[pos] || 'T');
  }
  if (suited && oneOf(a, ['K','Q','J','T'])) {
    const min: Record<string, Record<string,string>> = {
      K: { UTG:'9', MP:'9', HJ:'8', CO:'6', BTN:'2', SB:'7' },
      Q: { UTG:'T', MP:'9', HJ:'9', CO:'8', BTN:'5', SB:'8' },
      J: { UTG:'T', MP:'9', HJ:'9', CO:'8', BTN:'7', SB:'8' },
      T: { UTG:'9', MP:'9', HJ:'8', CO:'8', BTN:'7', SB:'8' },
    };
    return atLeast(b, (min as any)[a]?.[pos] ?? '9');
  }
  if (offsuit && oneOf(a, ['K','Q','J','T'])) {
    const min: Record<string, Record<string,string>> = {
      K: { UTG:'Q', MP:'J', HJ:'T', CO:'T', BTN:'8', SB:'9' },
      Q: { UTG:'T', MP:'T', HJ:'T', CO:'T', BTN:'8', SB:'9' },
      J: { UTG:'X', MP:'X', HJ:'X', CO:'T', BTN:'9', SB:'9' },
      T: { UTG:'X', MP:'X', HJ:'X', CO:'X', BTN:'9', SB:'9' },
    };
    const m = (min as any)[a]?.[pos];
    if (!m || m === 'X') return false;
    return atLeast(b, m);
  }
  if (suited) {
    const SC = [['9','8'], ['8','7'], ['7','6'], ['6','5'], ['5','4']];
    const isSC = SC.some(([x,y]) => (a === x && b === y) || (a === y && b === x));
    if (isSC) {
      const okPos = { UTG:false, MP:true, HJ:true, CO:true, BTN:true, SB:true, BB:false };
      return (okPos as any)[pos] ?? false;
    }
  }
  if (suited && (pos === 'BTN' || pos === 'SB')) {
    const LATE_MIN: Record<string,string> = { K:'2', Q:'5', J:'7', T:'7', '9':'7','8':'6','7':'5' };
    const m = (LATE_MIN as any)[a];
    if (m) return atLeast(b, m);
  }
  return false;
}

/** ----- Simple RFI detector ----- */
function detectRFI(raw: string): { isRFI: boolean; reasonIfLocked: string } {
  const s = (raw || '').toLowerCase();
  const has3bet = /\b3[-\s]?bet|\b3bet|\bre[-\s]?raise|\b4[-\s]?bet|\bjam|\bshove\b/i.test(s);
  const heroRaiseIdx = (() => {
    const patterns = [
      /\b(i|i'm|im|i am|hero)\b[^.]{0,40}?\b(raise|raises|open|opens)\b/i,
    ];
    let idx = Infinity;
    for (const r of patterns) {
      const m = r.exec(s);
      if (m && m.index < idx) idx = m.index;
    }
    return idx;
  })();
  const villainRaiseIdx = (() => {
    const r = /\b(villain|utg\+?\d?|utg|mp|hj|co|button|btn|sb|bb)\b[^.]{0,30}?\b(raise|raises|open|opens)\b/i;
    const m = r.exec(s);
    if (!m) return Infinity;
    if (/\b(i|i'm|im|i am|hero)\b/.test(m[0])) return Infinity;
    return m.index;
  })();
  const unopened = heroRaiseIdx < villainRaiseIdx;
  if (!unopened) return { isRFI: false, reasonIfLocked: 'Not an RFI spot — someone else opened before Hero.' };
  if (has3bet) return { isRFI: false, reasonIfLocked: 'Not a pure RFI — preflop 3-bet/jam detected.' };
  return { isRFI: true, reasonIfLocked: '' };
}

/** ---------------- Component ---------------- */
export default function Page() {
  const [input, setInput] = useState('');
  const [fields, setFields] = useState<Fields | null>(null);

  // Quick Card Assist inputs (source of truth)
  const [heroAssist, setHeroAssist] = useState('');
  const [villainAssist, setVillainAssist] = useState('');
  const [boardAssist, setBoardAssist] = useState('');

  // Async/UI state
  const [rangeEdits, setRangeEdits] = useState<Record<string, boolean>>({});
  const [lastPosForEdits, setLastPosForEdits] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Preview
  const preview = useMemo(() => ({
    stakes: parseStakes(input),
    position: parseHeroPosition(input),
    storyBoard: parseBoardStory(input),  // only for preview, never used as truth
  }), [input]);

  const street: Street = useMemo(() => detectStreet(input), [input]);

  // Hero hand: MUST come from heroAssist
  const heroParsed = useMemo(() => parseHeroAssist(heroAssist, street), [heroAssist, street]);
  const heroHand = heroParsed.hand;

  // Board: primary source is Board Assist
  const boardFromAssist = useMemo(() => parseBoardAssist(boardAssist), [boardAssist]);
  const flop = boardFromAssist.flop;
  const turn = boardFromAssist.turn;
  const river = boardFromAssist.river;

  // Validation gates
  const heroOk = !!heroHand;
  const needsBoard = street !== 'preflop';
  const boardOk =
    !needsBoard ||
    (flop.split(' ').length === 3 && flop.split(' ').every(hasSuitToken) &&
     (!turn || hasSuitToken(turn)) &&
     (!river || hasSuitToken(river)));

  const canSend = heroOk && boardOk && !aiLoading && !!input.trim();

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const pos = (fields?.position ?? preview.position ?? '').toUpperCase() || 'BTN';

  // RFI lock logic for grid
  const rfiInfo = useMemo(() => detectRFI(input), [input]);
  const gridLocked = !rfiInfo.isRFI;

  useEffect(() => {
    if (lastPosForEdits && lastPosForEdits === pos) return;
    setRangeEdits({});
    setLastPosForEdits(pos);
  }, [pos, lastPosForEdits]);

  async function analyzeParsedHand(parsed: Fields) {
    setAiError(null);
    setAiLoading(true);
    try {
      const payload = {
        date: parsed.date ?? undefined,
        stakes: parsed.stakes ?? (preview.stakes || undefined),
        position: parsed.position ?? (preview.position || undefined),

        // NEW: structured context
        street,
        hero_hand: heroHand
          ? { r1: heroHand.r1, r2: heroHand.r2, suited: heroHand.suited, s1: heroHand.s1, s2: heroHand.s2, exact: heroHand.exact }
          : null,
        requires_board_suits: needsBoard,

        // Board to the model
        board_struct: { flop, turn, river },
        board: [flop && `Flop: ${flop}`, turn && `Turn: ${turn}`, river && `River: ${river}`]
          .filter(Boolean)
          .join('  |  '),

        // keep for backward compat + extra context
        cards: heroHand ? heroHand.label : undefined,
        villainAction: parsed.villain_action ?? parsed.villian_action ?? undefined,
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

  /** Range grid state helpers */
  const toggleHand = (label: string) => {
    if (gridLocked) return;
    setRangeEdits(prev => ({ ...prev, [label]: !(prev[label] ?? defaultOpen(pos, label)) }));
  };
  const resetRange = () => { if (!gridLocked) { setRangeEdits({}); setLastPosForEdits(pos); } };

  const openFlags: Record<string, boolean> = {};
  RANKS.forEach((_, i) => {
    RANKS.forEach((__, j) => {
      const lbl = handLabel(i, j);
      openFlags[lbl] = rangeEdits.hasOwnProperty(lbl) ? rangeEdits[lbl] : defaultOpen(pos, lbl);
    });
  });
  const openCount = Object.values(openFlags).filter(Boolean).length;
  const openPct = Math.round((openCount / 169) * 100);

  /** Render */
  return (
    <main className="p-page">
      <div className="p-container">
        <header className="p-header"><h1 className="p-title">Only Poker</h1></header>

        <section className="p-grid">
          {/* LEFT */}
          <div className="p-col">
            <div className="p-card">
              <div className="p-cardTitle">Hand Played</div>
              <textarea
                className="p-textarea"
                placeholder="Tell the story — stakes, positions, effective stacks, hero cards, actions…"
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <div className="p-row p-gap">
                <button className="p-btn p-primary" onClick={handleParse} disabled={!canSend}>
                  {aiLoading ? 'Analyzing…' : 'Send'}
                </button>
                <button
                  className="p-btn"
                  onClick={() => { setInput(''); setFields(null); setStatus(null); setAiError(null); setHeroAssist(''); setVillainAssist(''); setBoardAssist(''); }}
                >
                  Clear
                </button>
              </div>

              {/* Inline validation hints */}
              {!heroOk && <div className="p-err" style={{marginTop:8}}>Add Hero cards in the Hero box (e.g., <b>A4s</b> / <b>A4o</b> or exact: <b>As 4s</b>).</div>}
              {heroParsed.error && heroOk && <div className="p-note" style={{marginTop:8}}>{heroParsed.error}</div>}
              {needsBoard && !boardOk && (
                <div className="p-err" style={{marginTop:8}}>
                  Post-flop detected. Enter the board with suits in the Board box (e.g., <b>Kc 7s 2s | 5h | 9h</b>).
                </div>
              )}
              {aiError && <div className="p-err" style={{marginTop:8}}>{aiError}</div>}
              {status && <div className="p-note" style={{marginTop:8}}>{status}</div>}
            </div>

            <div className="p-card">
              <div className="p-cardTitle">Quick Card Assist (source of truth)</div>
              <div className="p-assist3">
                <input className="p-input" value={heroAssist} onChange={(e)=>setHeroAssist(e.target.value)} placeholder="Hero: A4s / A4o (or exact: As 4s)" />
                <input className="p-input" value={villainAssist} onChange={(e)=>setVillainAssist(e.target.value)} placeholder="Villain (optional): Kc Kd" />
                <input className="p-input" value={boardAssist} onChange={(e)=>setBoardAssist(e.target.value)} placeholder="Board: Kc 7s 2s | 5h | 9h" />
              </div>
              <div className="p-help">
                Preflop-only: suits aren’t required. If there’s a board, enter exact suits for postflop accuracy.
              </div>
            </div>

            {/* Range grid (RFI only editable) */}
            <div className="p-card">
              <div className="p-subTitle">
                Hero Open Range — {pos} <span className="p-muted">({openPct}% of 169)</span>
                {gridLocked && <span className="p-muted"> · Ranges locked — this hand is not an RFI (open-raise) spot.</span>}
              </div>
              <div className={`rangeGrid ${gridLocked ? 'grid-locked' : ''}`}>
                <div className="rangeCorner" />
                {RANKS.map((r, j) => <div key={`h-${j}`} className="rangeHead">{r}</div>)}
                {RANKS.map((r, i) => (
                  <React.Fragment key={`row-${i}`}>
                    <div className="rangeHead">{r}</div>
                    {RANKS.map((c, j) => {
                      const lbl = handLabel(i, j);
                      const open = openFlags[lbl];
                      const title = gridLocked
                        ? `${lbl} — grid is read-only (not an RFI spot)`
                        : `${lbl} — ${open ? 'Open' : 'Fold'} (click to toggle)`;
                      return (
                        <button
                          key={lbl}
                          className={`cell ${open ? 'open' : 'fold'} ${i === j ? 'pair' : (i < j ? 'suited' : 'offsuit')} ${gridLocked ? 'cell-locked' : ''}`}
                          title={title}
                          onClick={() => toggleHand(lbl)}
                          disabled={gridLocked}
                        >
                          {lbl}
                        </button>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
              {gridLocked && rfiInfo.reasonIfLocked && (
                <div className="p-muted" style={{fontSize:12, marginTop:8}}>
                  {rfiInfo.reasonIfLocked}
                </div>
              )}
              <div className="p-row p-gapTop" style={{justifyContent:'space-between'}}>
                <div className="p-muted" style={{fontSize:12}}>Suited = upper triangle, Offsuit = lower, Pairs = diagonal.</div>
                <button className="p-btn" onClick={resetRange} disabled={gridLocked}>Reset to {pos} default</button>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="p-col">
            <div className="p-card">
              <div className="p-grid2">
                <InfoBox label="Cards">
                  <div className="p-cards">
                    {heroHand
                      ? heroHand.label.split(' ').map((c, i) => <span key={i} className="p-cardSpan"><CardSpan c={c} /></span>)
                      : <span className="p-muted">(not set)</span>
                    }
                  </div>
                </InfoBox>
                <InfoBox label="Date"><div>{today}</div></InfoBox>
                <InfoBox label="Position"><div>{(fields?.position ?? preview.position) || <span className="p-muted">(unknown)</span>}</div></InfoBox>
                <InfoBox label="Stakes"><div>{(fields?.stakes ?? preview.stakes) || <span className="p-muted">(unknown)</span>}</div></InfoBox>
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
                rows={10}
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
                <button className="p-btn" disabled={!fields || aiLoading} onClick={() => fields && analyzeParsedHand(fields)}>
                  {aiLoading ? 'Analyzing…' : 'Analyze Again'}
                </button>
                <button className="p-btn p-primary" disabled={!fields || saving} onClick={handleSave}>
                  {saving ? 'Saving…' : 'Confirm & Save to Notion'}
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Styles */}
      <style jsx global>{`
        :root{
          --bg1:#e5e7eb; --bg2:#f1f5f9; --bg3:#cbd5e1;
          --card1:#f8fafc; --card2:#e5e7eb; --card3:#f1f5f9;
          --border:#d1d5db; --line:#d8dde6;
          --text:#0f172a; --muted:#6b7280;
          --primary:#3b82f6; --primary2:#2563eb; --btnText:#f8fbff;
          --pillBg:#ffffff; --pillBorder:#e5e7eb;
          --range-open:#ee8d73; --range-fold:#3b3f46; --range-suited:#f6efe9; --range-offsuit:#eef0f3; --range-pair:#faf6f0;
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
        .p-cardTitle{font-size:13px;font-weight:700;color:#334155;margin-bottom:10px}
        .p-subTitle{font-size:14px;font-weight:800;margin-bottom:10px;color:#111827}
        .p-textarea{width:100%;min-height:160px;resize:vertical;padding:12px 14px;border-radius:14px;border:1px solid var(--line);background:#fff;color:#0f172a;font-size:15px;line-height:1.5}
        .p-row{display:flex;align-items:center}
        .p-gap{gap:12px}
        .p-gapTop{margin-top:10px}
        .p-end{justify-content:flex-end}
        .p-btn{appearance:none;border:1px solid var(--line);background:#fff;color:#0f172a;padding:10px 14px;border-radius:12px;cursor:pointer;transition:transform .02s ease, background .15s ease, border-color .15s ease;}
        .p-btn:hover{background:#f3f4f6}
        .p-btn:active{transform:translateY(1px)}
        .p-btn[disabled]{opacity:.55;cursor:not-allowed}
        .p-btn.p-primary{background:linear-gradient(180deg,var(--primary),var(--primary2));color:var(--btnText);border-color:#9db7ff;box-shadow:0 6px 18px rgba(59,130,246,.25)}
        .p-assist3{display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:10px}
        @media (max-width:800px){.p-assist3{grid-template-columns:1fr}}
        .p-input{width:100%;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:#fff;color:#0f172a;font-size:14.5px}
        .p-help{margin-top:8px;font-size:12px;color:#6b7280}
        .p-note{margin-top:8px;color:#166534}
        .p-err{margin-top:8px;color:#b91c1c}
        .p-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px}
        .ibox{background:#fff;border:1px solid var(--pillBorder);border-radius:12px;padding:10px 12px}
        .iboxLabel{font-size:11px;color:#6b7280;margin-bottom:3px}
        .iboxVal{font-size:14px}
        .p-boardRow{display:flex;flex-wrap:wrap;gap:10px;font-size:16px}
        .p-pill{background:var(--pillBg);border:1px solid var(--pillBorder);padding:8px 12px;border-radius:12px}
        .p-cardSpan{margin-right:4px}
        .p-list{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px}
        .rangeGrid{display:grid;grid-template-columns:28px repeat(13, 1fr);grid-auto-rows:26px;gap:4px;align-items:center}
        .rangeHead{font-size:12px;color:#64748b;text-align:center;line-height:26px}
        .rangeCorner{width:28px;height:26px}
        .cell{border:1px solid #cbd5e1;border-radius:6px;font-size:11.5px;display:flex;align-items:center;justify-content:center;cursor:pointer;user-select:none;transition:transform .02s ease, filter .15s ease, box-shadow .15s ease;box-shadow: inset 0 0 0 1px rgba(0,0,0,.02)}
        .cell.suited{background:#f6efe9}
        .cell.offsuit{background:#eef0f3}
        .cell.pair{background:#faf6f0}
        .cell.open{background:#ee8d73;color:#222;border-color:#e2a08e}
        .cell.fold{background:#374151;color:#e5e7eb;border-color:#4b5563}
        .cell:hover{filter:brightness(1.07)}
        .cell-locked{opacity:.6;cursor:not-allowed}
        .grid-locked .cell:hover{filter:none}
      `}</style>
    </main>
  );
}

function InfoBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ibox">
      <div className="iboxLabel">{label}</div>
      <div className="iboxVal">{children}</div>
    </div>
  );
}
