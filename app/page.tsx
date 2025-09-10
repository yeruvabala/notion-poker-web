'use client';

import React, { useMemo, useState, useEffect } from 'react';
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

// Prefer hero mentions; avoid villain position
const parseHeroPosition = (t: string) => {
  const up = t.toUpperCase();

  // "I'm/I am/hero ... on SB/BTN/..."
  const m1 = up.match(/\b(I|I'M|IM|I AM|HERO)\b[^.]{0,40}?\b(ON|FROM|IN)\s+(UTG\+\d|UTG|MP|HJ|CO|BTN|SB|BB)\b/);
  if (m1) return m1[3];

  // "am on SB", "I on SB"
  const m2 = up.match(/\b(AM|I'M|IM|I)\b[^.]{0,10}?\bON\s+(UTG\+\d|UTG|MP|HJ|CO|BTN|SB|BB)\b/);
  if (m2) return m2[2];

  // generic "on SB"
  const m3 = up.match(/\bON\s+(SB|BB|BTN|CO|HJ|MP|UTG(?:\+\d)?)\b/);
  if (m3) return m3[1];

  // fallback preference
  const PREF = ['SB','BB','BTN','CO','HJ','MP','UTG+2','UTG+1','UTG'];
  for (const p of PREF) if (up.includes(` ${p} `)) return p;
  return '';
};

// Find hero cards near "with/holding/I have", handle Ah Qs, A4s, "a4 of spades"
const parseHeroCardsSmart = (t: string) => {
  const s = t.toLowerCase();

  // "with Ah Qs"
  let m = s.match(/\b(?:with|holding|have|having|i\s+have)\s+([2-9tjqka][shdc♥♦♣♠])\s+([2-9tjqka][shdc♥♦♣♠])\b/i);
  if (m) return [suitify(m[1]), suitify(m[2])].join(' ');

  // "with A4s / A4o" or "with A4 of spades"
  m = s.match(/\b(?:with|holding|have|having|i\s+have)\s*([2-9tjqka])\s*([2-9tjqka])\s*(s|o|suited|offsuit)?(?:\s*of\s*(spades?|hearts?|diamonds?|clubs?))?/i);
  if (m) {
    const r1 = m[1].toUpperCase(), r2 = m[2].toUpperCase();
    const suitWord = (m[4] || '').toLowerCase();
    const suitChar = suitWord ? SUIT_WORD[suitWord] : '♠';
    const suited = m[3] === 's' || m[3] === 'suited' || !!suitWord;
    if (suited) return `${r1}${suitChar} ${r2}${suitChar}`;
    // offsuit: show distinct suits for clarity
    return `${r1}♠ ${r2}♥`;
  }

  // "a4 of spades"
  m = s.match(/\b([2-9tjqka])\s*([2-9tjqka])\s*of\s*(spades?|hearts?|diamonds?|clubs?)\b/i);
  if (m) {
    const suitChar = SUIT_WORD[(m[3] || '').toLowerCase()];
    return `${m[1].toUpperCase()}${suitChar} ${m[2].toUpperCase()}${suitChar}`;
  }

  // fallback: require "with" nearby to avoid reading the board
  m = s.match(/\bwith\b[^.]{0,40}?([2-9tjqka][shdc♥♦♣♠])\s+([2-9tjqka][shdc♥♦♣♠])\b/i);
  if (m) return [suitify(m[1]), suitify(m[2])].join(' ');

  return '';
};

// Parse "Ks 7d 2c 9c 4h" → {flop,turn,river}
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

const twoCardsFrom = (line: string) =>
  suitifyLine(line).split(' ').slice(0, 2).join(' ');

const CardSpan = ({ c }: { c: string }) =>
  !c ? null : <span style={{ fontWeight: 600, color: suitColor(c.slice(-1)) }}>{c}</span>;

/** ---------- Opening Range Grid helpers ---------- */
const RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'] as const;
const rIndex: Record<string, number> = Object.fromEntries(RANKS.map((r, i) => [r, i]));

/** Build label for matrix cell */
function handLabel(i: number, j: number): string {
  const a = RANKS[i], b = RANKS[j];
  if (i === j) return `${a}${a}`;
  return i < j ? `${a}${b}s` : `${a}${b}o`; // upper triangle suited
}

/** Small comparator helpers */
const atLeast = (rank: string, min: string) => rIndex[rank] <= rIndex[min]; // A-high ordering
const oneOf = (x: string, arr: string[]) => arr.includes(x);

/** Baseline open decision by position (approx, intentionally compact rules) */
function defaultOpen(pos: string, label: string): boolean {
  pos = (pos || '').toUpperCase();
  const [a, b, t] = label.length === 3 ? [label[0], label[1], label[2]] : [label[0], label[1], 'p']; // p = pair
  const pair = t === 'p';
  const suited = t === 's';
  const offsuit = t === 'o';

  // Pairs
  const pairMin: Record<string, string> = {
    UTG: '6',   MP: '4',  HJ: '2',  CO: '2',  BTN: '2',  SB: '2',  BB: '2'
  };
  if (pair) return atLeast(a, pairMin[pos] || '2');

  // Any Ace suited opens everywhere; offsuit tightens early
  if (a === 'A') {
    if (suited) return true;
    // offsuit ATo+ UTG/MP, A9o+ HJ, A8o+ CO, A2o+ BTN, A5o+ SB (wheel blocker)
    const minOff: Record<string, string> = { UTG: 'T', MP: 'T', HJ: '9', CO: '8', BTN: '2', SB: '5', BB: 'T' };
    return atLeast(b, minOff[pos] || 'T');
  }

  // Broadways suited
  if (suited && oneOf(a, ['K','Q','J','T'])) {
    const min: Record<string, Record<string,string>> = {
      K: { UTG:'9', MP:'9', HJ:'8', CO:'6', BTN:'2', SB:'7' },
      Q: { UTG:'T', MP:'9', HJ:'9', CO:'8', BTN:'5', SB:'8' },
      J: { UTG:'T', MP:'9', HJ:'9', CO:'8', BTN:'7', SB:'8' },
      T: { UTG:'9', MP:'9', HJ:'8', CO:'8', BTN:'7', SB:'8' },
    };
    return atLeast(b, (min as any)[a]?.[pos] ?? '9');
  }

  // Broadways offsuit
  if (offsuit && oneOf(a, ['K','Q','J','T'])) {
    const min: Record<string, Record<string,string>> = {
      K: { UTG:'Q', MP:'J', HJ:'T', CO:'T', BTN:'8', SB:'9' }, // KQo/KJo/KTo… BTN K8o+
      Q: { UTG:'T', MP:'T', HJ:'T', CO:'T', BTN:'8', SB:'9' }, // QTo+ late
      J: { UTG:'X', MP:'X', HJ:'X', CO:'T', BTN:'9', SB:'9' }, // JTo CO+, J9o BTN+
      T: { UTG:'X', MP:'X', HJ:'X', CO:'X', BTN:'9', SB:'9' }, // T9o BTN/SB
    };
    const m = (min as any)[a]?.[pos];
    if (!m || m === 'X') return false;
    return atLeast(b, m);
  }

  // Suited connectors & gappers (Q9s-, J8s-, T8s-, 98s, 87s, 76s, 65s, 54s widen later)
  if (suited) {
    const SC = [
      ['9','8'], ['8','7'], ['7','6'], ['6','5'], ['5','4']
    ];
    const isSC = SC.some(([x,y]) => (a === x && b === y) || (a === y && b === x));
    if (isSC) {
      const okPos = { UTG:false, MP:true, HJ:true, CO:true, BTN:true, SB:true, BB:false };
      return (okPos as any)[pos] ?? false;
    }
  }

  // Very late wide BTN/SB catch-all for suited junk like K2s, Q5s, J7s, T7s, 97s, 86s, 75s
  if (suited && (pos === 'BTN' || pos === 'SB')) {
    const LATE_MIN: Record<string,string> = { K:'2', Q:'5', J:'7', T:'7', '9':'7','8':'6','7':'5' };
    const m = (LATE_MIN as any)[a];
    if (m) return atLeast(b, m);
  }

  // Default: tight fold
  return false;
}

/** --- Detect RFI only (locks grid when false) --- */
function detectIsRFI(text: string, heroPos: string): boolean {
  const H = (heroPos || '').toUpperCase();
  if (!H) return false;

  // Lowercase once; strip stack units like "35 bb" / "20 sb"
  const raw = (text || '').toLowerCase();
  const t = raw.replace(/\d+\s*(bb|sb)\b/g, ' ');

  // Anything that clearly makes it a non-RFI node
  if (/\b(3[-\s]?bet|re[-\s]?raise|reraise)\b/.test(t)) return false;
  if (/\b(limp|complete|overlimp)\b/.test(t)) return false;

  // If a position is stated as the raiser AND hero responds by calling/3-betting → not RFI
  const villainRaiserAndHeroResponds =
    /\b(utg\+?2?|utg|mp|hj|co|button|btn|sb|bb)\b[^\.\n]{0,40}\b(raise|opens?)\b/.test(t) &&
    /\b(i|hero)\b[^\.\n]{0,50}\b(call|flat|3[-\s]?bet|reraise)\b/.test(t);
  if (villainRaiserAndHeroResponds) return false;

  // Hero opens: allow a wider window and common phrasing variants
  const heroOpens =
    /\b(i|hero)\b[^\.\n]{0,120}\b(open(?:s|ed)?|raise[sd]?)\b/.test(t) ||                // "hero ... raises"
    /\b(folds?\s+to\s+(me|btn|button|sb|bb|co|hj|mp|utg))\b[^\.\n]{0,80}\b(raise|open)\b/.test(t) ||
    /\b(on|from)\s+(utg\+?2?|utg|mp|hj|co|btn|button|sb|bb)\b[^\.\n]{0,80}\b(i|hero)\b[^\.\n]{0,60}\b(raise|open)\b/.test(t);

  return !!heroOpens;
}


/** ---------------- Component ---------------- */
export default function Page() {
  // INPUT
  const [input, setInput] = useState('');
  const [fields, setFields] = useState<Fields | null>(null);

  // Quick Card Assist (hero, villain, entire board)
  const [heroAssist, setHeroAssist] = useState('');
  const [villainAssist, setVillainAssist] = useState('');
  const [boardAssist, setBoardAssist] = useState('');

  // Opening range edits (user toggles)
  const [rangeEdits, setRangeEdits] = useState<Record<string, boolean>>({});
  const [lastPosForEdits, setLastPosForEdits] = useState<string>('');

  // Grid lock state
  const [isRFI, setIsRFI] = useState<boolean>(false);
  const [gridLockMsg, setGridLockMsg] = useState<string | null>(null);

  // Async state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Lightweight parse for preview (client-side only)
  const preview = useMemo(() => ({
    stakes: parseStakes(input),
    position: parseHeroPosition(input),
    heroCards: parseHeroCardsSmart(input),
    board: parseBoard(input),
  }), [input]);

  // Resolve preview values with assists
  const heroCards = (twoCardsFrom(heroAssist) || fields?.cards || preview.heroCards || '').trim();

  const boardFromAssist = parseBoardFromText(boardAssist);
  const flop = (boardAssist ? boardFromAssist.flop : preview.board.flop) || '';
  const turn = (boardAssist ? boardFromAssist.turn : preview.board.turn) || '';
  const river = (boardAssist ? boardFromAssist.river : preview.board.river) || '';

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const pos = (fields?.position ?? preview.position ?? '').toUpperCase() || 'BTN';

  // Rebase edits if position changes
  useEffect(() => {
    if (lastPosForEdits && lastPosForEdits === pos) return;
    setRangeEdits({});
    setLastPosForEdits(pos);
  }, [pos, lastPosForEdits]);

  // Lock/unlock grid based on whether this is an RFI spot
  useEffect(() => {
    const rfi = detectIsRFI(input, pos);
    setIsRFI(rfi);
    setGridLockMsg(rfi ? null : 'Ranges locked — this hand is not an RFI (open-raise) spot.');
  }, [input, pos]);

  /** Call /api/analyze-hand; use input text; include overrides from assists */
  async function analyzeParsedHand(parsed: Fields) {
    setAiError(null);
    setAiLoading(true);
    try {
      const payload = {
        date: parsed.date ?? undefined,
        stakes: parsed.stakes ?? (preview.stakes || undefined),
        position: parsed.position ?? (preview.position || undefined),
        cards: parsed.cards ?? (heroCards || undefined), // hero override
        villainAction: parsed.villain_action ?? parsed.villian_action ?? undefined,
        // pass corrected board from the assist; analysis can use it as extra context
        board: [flop && `Flop: ${flop}`, turn && `Turn: ${turn}`, river && `River: ${river}`]
          .filter(Boolean)
          .join('  |  '),
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

  /** Range grid state helpers */
  const toggleHand = (label: string) =>
    setRangeEdits(prev => ({ ...prev, [label]: !(prev[label] ?? defaultOpen(pos, label)) }));

  const resetRange = () => { setRangeEdits({}); setLastPosForEdits(pos); };

  const openFlags: Record<string, boolean> = {};
  RANKS.forEach((_, i) => {
    RANKS.forEach((__, j) => {
      const lbl = handLabel(i, j);
      if (!isRFI) {
        // Non-RFI node → show “fold look” and lock
        openFlags[lbl] = false;
      } else {
        openFlags[lbl] = Object.prototype.hasOwnProperty.call(rangeEdits, lbl)
          ? !!rangeEdits[lbl]
          : defaultOpen(pos, lbl);
      }
    });
  });
  const openCount = Object.values(openFlags).filter(Boolean).length;
  const openPct = Math.round((openCount / 169) * 100);

  /** Render */
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
                  onClick={() => { setInput(''); setFields(null); setStatus(null); setAiError(null); setHeroAssist(''); setVillainAssist(''); setBoardAssist(''); }}
                >
                  Clear
                </button>
              </div>
              {aiError && <div className="p-err">{aiError}</div>}
              {status && <div className="p-note">{status}</div>}
            </div>

            <div className="p-card">
              <div className="p-cardTitle">Quick Card Assist (optional)</div>
              <div className="p-assist3">
                <input className="p-input" value={heroAssist} onChange={(e)=>setHeroAssist(e.target.value)} placeholder="Hero: Ah Qs" />
                <input className="p-input" value={villainAssist} onChange={(e)=>setVillainAssist(e.target.value)} placeholder="Villain (optional): Kc Kd" />
                <input className="p-input" value={boardAssist} onChange={(e)=>setBoardAssist(e.target.value)} placeholder="Board: Ks 7d 2c 9c 4h" />
              </div>
              <div className="p-help">If parsing guesses wrong, correct the board here — the preview updates instantly.</div>
            </div>

            {/* --- RFI grid (locks when not RFI) --- */}
            <div className="p-card">
              <div className="p-subTitle">
                Hero Open Range — {pos} <span className="p-muted">({openPct}% of 169)</span>
                {!isRFI && (
                  <span className="p-muted" style={{ marginLeft: 8, fontSize: 12 }}>
                    · {gridLockMsg}
                  </span>
                )}
              </div>

              <div className={`lockWrap ${!isRFI ? 'locked' : ''}`}>
                <div className="rangeGrid">
                  <div className="rangeCorner" />
                  {RANKS.map((r, j) => <div key={`h-${j}`} className="rangeHead">{r}</div>)}
                  {RANKS.map((r, i) => (
                    <React.Fragment key={`row-${i}`}>
                      <div className="rangeHead">{r}</div>
                      {RANKS.map((c, j) => {
                        const lbl = handLabel(i, j);
                        const open = openFlags[lbl];
                        return (
                          <button
                            key={lbl}
                            className={`cell ${open ? 'open' : 'fold'} ${i === j ? 'pair' : (i < j ? 'suited' : 'offsuit')}`}
                            title={
                              isRFI
                                ? `${lbl} — ${open ? 'Open' : 'Fold'} (click to toggle)`
                                : `${lbl} — grid locked (non-RFI node)`
                            }
                            onClick={() => isRFI && toggleHand(lbl)}
                            disabled={!isRFI}
                          >
                            {lbl}
                          </button>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>

                {!isRFI && (
                  <div className="lockOverlay">
                    <span>Not an RFI spot — grid is read-only</span>
                  </div>
                )}
              </div>

              <div className="p-row p-gapTop" style={{justifyContent:'space-between'}}>
                <div className="p-muted" style={{fontSize:12}}>
                  Click cells to toggle. Suited = upper triangle, Offsuit = lower, Pairs = diagonal.
                </div>
                <button className="p-btn" onClick={resetRange} disabled={!isRFI}>
                  Reset to {pos} default
                </button>
              </div>
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
                    {heroCards
                      ? heroCards.split(' ').map((c, i) => <span key={i} className="p-cardSpan"><CardSpan c={c} /></span>)
                      : <span className="p-muted">(not found)</span>
                    }
                  </div>
                </InfoBox>

                <InfoBox label="Date"><div>{today}</div></InfoBox>

                <InfoBox label="Position">
                  <div>{(fields?.position ?? preview.position) || <span className="p-muted">(unknown)</span>}</div>
                </InfoBox>

                <InfoBox label="Stakes">
                  <div>{(fields?.stakes ?? preview.stakes) || <span className="p-muted">(unknown)</span>}</div>
                </InfoBox>
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

          --range-open:#ee8d73;      /* orange-ish like screenshot */
          --range-fold:#3b3f46;      /* dark gray */
          --range-suited:#f6efe9;
          --range-offsuit:#eef0f3;
          --range-pair:#faf6f0;
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
          border-radius:14px; border:1px solid var(--line); background:#ffffff; color:var(--text); font-size:15px; line-height:1.5;
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

        .p-assist3{display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:10px}
        @media (max-width:800px){.p-assist3{grid-template-columns:1fr}}
        .p-input{
          width:100%; padding:10px 12px; border-radius:12px; border:1px solid var(--line);
          background:#ffffff; color:#0f172a; font-size:14.5px;
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

        /* ------- Range grid styles ------- */
        .rangeGrid{
          display:grid;
          grid-template-columns: 28px repeat(13, 1fr);
          grid-auto-rows: 26px;
          gap: 4px;
          align-items:center;
        }
        .rangeHead{
          font-size:12px; color:#64748b; text-align:center; line-height:26px;
        }
        .rangeCorner{width:28px;height:26px}
        .cell{
          border:1px solid #cbd5e1;
          border-radius:6px;
          font-size:11.5px;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; user-select:none;
          transition:transform .02s ease, filter .15s ease, box-shadow .15s ease;
          box-shadow: inset 0 0 0 1px rgba(0,0,0,.02);
        }
        .cell.suited{background:var(--range-suited)}
        .cell.offsuit{background:var(--range-offsuit)}
        .cell.pair{background:var(--range-pair)}
        .cell.open{background:var(--range-open); color:#222; border-color:#e2a08e}
        .cell.fold{background:#374151; color:#e5e7eb; border-color:#4b5563}
        .cell:hover{filter:brightness(1.07)}

        /* ---- Lock styles when not RFI ---- */
        .lockWrap{ position:relative }
        .lockWrap.locked{ pointer-events:none; }
        .lockWrap.locked .cell{ filter: grayscale(.15) brightness(.95); }
        .lockOverlay{
          position:absolute; inset:0;
          display:flex; align-items:center; justify-content:center;
          background: rgba(255,255,255,.35);
          border-radius: 14px;
          font-size: 12px; color:#334155; font-weight:600;
        }
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
