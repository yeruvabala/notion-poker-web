'use client';

import React, { useMemo, useState, useEffect } from 'react';

/** ---------------- Types ---------------- */
type Fields = {
  date?: string | null;
  stakes?: string | null;          // TEXT, not number
  position?: string | null;
  cards?: string | null;
  villain_action?: string | null;
  villian_action?: string | null;  // tolerated typo
  gto_strategy?: string | null;
  exploit_deviation?: string | null;
  learning_tag?: string[];
  board?: string | null;
  notes?: string | null;

  // New parsed helpers from /api/parse
  mode?: 'cash' | 'mtt' | '';
  eff_bb?: number | null;
  blinds?: string | null;
  icm_context?: boolean | null;
};

type JudgeMistake = {
  street: 'preflop' | 'flop' | 'turn' | 'river';
  hero_action: string;
  why_wrong: string;
  better_line: string;
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

const parseStakes = (t: string) => {
  const m = t.match(/(\$?\d+(?:\.\d+)?)[\s]*[\/-][\s]*(\$?\d+(?:\.\d+)?)/);
  return m ? `${m[1]}/${m[2]}` : '';
};

const parseHeroPosition = (t: string) => {
  const up = ` ${t.toUpperCase()} `;
  const PREF = ['SB','BB','BTN','CO','HJ','MP','UTG+2','UTG+1','UTG'];
  for (const p of PREF) if (up.includes(` ${p} `)) return p;
  const m = up.match(/\b(I|I'M|IM|I AM|HERO)\b[^.]{0,40}?\b(ON|FROM|IN)\s+(UTG\+\d|UTG|MP|HJ|CO|BTN|SB|BB)\b/);
  if (m) return m[3];
  return '';
};

const parseHeroCardsSmart = (t: string) => {
  const s = t.toLowerCase();
  let m = s.match(/\b(?:with|holding|have|i\s+have)\s+([2-9tjqka][shdc♥♦♣♠])\s+([2-9tjqka][shdc♥♦♣♠])\b/i);
  if (m) return [suitify(m[1]), suitify(m[2])].join(' ');
  m = s.match(/\b(?:with|holding|have|i\s+have)\s*([2-9tjqka])\s*([2-9tjqka])\s*(s|o|suited|offsuit)?(?:\s*of\s*(spades?|hearts?|diamonds?|clubs?))?/i);
  if (m) {
    const r1 = m[1].toUpperCase(), r2 = m[2].toUpperCase();
    const suitWord = (m[4] || '').toLowerCase();
    const suitChar = suitWord ? SUIT_WORD[suitWord] : '♠';
    const suited = m[3] === 's' || m[3] === 'suited' || !!suitWord;
    if (suited) return `${r1}${suitChar} ${r2}${suitChar}`;
    return `${r1}♠ ${r2}♥`;
  }
  return '';
};

const parseBoardFromText = (line: string) => {
  const arr = suitifyLine(line).split(' ').filter(Boolean);
  return { flop: arr.slice(0, 3).join(' ') || '', turn: arr[3] || '', river: arr[4] || '' };
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

const twoCardsFrom = (line: string) => suitifyLine(line).split(' ').slice(0, 2).join(' ');
const CardSpan = ({ c }: { c: string }) => !c ? null : <span style={{ fontWeight: 600, color: suitColor(c.slice(-1)) }}>{c}</span>;

/** ---------- Grid helpers ---------- */
const RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'] as const;
const rIndex: Record<string, number> = Object.fromEntries(RANKS.map((r, i) => [r, i]));
function handLabel(i: number, j: number): string {
  const a = RANKS[i], b = RANKS[j];
  if (i === j) return `${a}${a}`;
  return i < j ? `${a}${b}s` : `${a}${b}o`;
}
const atLeast = (rank: string, min: string) => rIndex[rank] <= rIndex[min];
const oneOf = (x: string, arr: string[]) => arr.includes(x);

/** Baseline open decision by position (approx, compact rules) */
function defaultOpen(pos: string, label: string, mode: 'cash'|'mtt'|''): boolean {
  pos = (pos || '').toUpperCase();
  const [a, b, t] = label.length === 3 ? [label[0], label[1], label[2]] : [label[0], label[1], 'p'];
  const pair = t === 'p', suited = t === 's', offsuit = t === 'o';

  // Slightly tighter UTG/MP in MTT mode to mimic GTO @ deeper stacks
  const tightenMTT = (p: string, r: string) => (mode === 'mtt' && (p === 'UTG' || p === 'MP') ? String.fromCharCode(Math.max(r.charCodeAt(0), '6'.charCodeAt(0))) : r);

  // Pairs
  const pairMin: Record<string, string> = {
    UTG: '6', MP: '4', HJ: '2', CO: '2', BTN: '2', SB: '2', BB: '2'
  };
  if (pair) return atLeast(a, tightenMTT(pos, pairMin[pos] || '2'));

  if (a === 'A') {
    if (suited) return true;
    const minOff: Record<string, string> = { UTG:'T', MP:'T', HJ:'9', CO:'8', BTN:'2', SB:'5', BB:'T' };
    return atLeast(b, tightenMTT(pos, minOff[pos] || 'T'));
  }

  if (suited && oneOf(a, ['K','Q','J','T'])) {
    const min: Record<string, Record<string,string>> = {
      K:{UTG:'9',MP:'9',HJ:'8',CO:'6',BTN:'2',SB:'7'},
      Q:{UTG:'T',MP:'9',HJ:'9',CO:'8',BTN:'5',SB:'8'},
      J:{UTG:'T',MP:'9',HJ:'9',CO:'8',BTN:'7',SB:'8'},
      T:{UTG:'9',MP:'9',HJ:'8',CO:'8',BTN:'7',SB:'8'},
    };
    return atLeast(b, (min as any)[a]?.[pos] ?? '9');
  }

  if (offsuit && oneOf(a, ['K','Q','J','T'])) {
    const min: Record<string, Record<string,string>> = {
      K:{UTG:'Q',MP:'J',HJ:'T',CO:'T',BTN:'8',SB:'9'},
      Q:{UTG:'T',MP:'T',HJ:'T',CO:'T',BTN:'8',SB:'9'},
      J:{UTG:'X',MP:'X',HJ:'X',CO:'T',BTN:'9',SB:'9'},
      T:{UTG:'X',MP:'X',HJ:'X',CO:'X',BTN:'9',SB:'9'},
    };
    const m = (min as any)[a]?.[pos];
    if (!m || m === 'X') return false;
    return atLeast(b, m);
  }

  if (suited) {
    const SC = [['9','8'],['8','7'],['7','6'],['6','5'],['5','4']];
    const isSC = SC.some(([x,y]) => (a === x && b === y) || (a === y && b === x));
    if (isSC) {
      const okPos = { UTG:false, MP:true, HJ:true, CO:true, BTN:true, SB:true, BB:false };
      return (okPos as any)[pos] ?? false;
    }
  }

  if (suited && (pos === 'BTN' || pos === 'SB')) {
    const LATE_MIN: Record<string,string> = { K:'2',Q:'5',J:'7',T:'7','9':'7','8':'6','7':'5' };
    const m = (LATE_MIN as any)[a];
    if (m) return atLeast(b, m);
  }

  return false;
}

/** ----------------- Node & meta detection (client-side hints) ----------------- */
function parseGameMode(text: string): 'cash'|'mtt'|'' {
  const s = text.toLowerCase();
  if (/\b(tournament|mtt|icm|bubble|final table|day\s*\d|ante|bb\s*ante|blinds?\s*\d)/i.test(s)) return 'mtt';
  if (/(\$?\d+\/\$?\d+|\b1\/3\b|\b2\/5\b|\b5\/10\b)/.test(s)) return 'cash';
  return '';
}
function parseEffBB(text: string): number | null {
  const m = text.toLowerCase().match(/(\d+)\s*bb(?:\s*eff|\s*effective)?/);
  return m ? Math.max(1, parseInt(m[1], 10)) : null;
}
function parseBlinds(text: string): string {
  const s = text.replace(/,/g, ' ');
  const m1 = s.match(/\$?\d+(?:\.\d+)?\s*\/\s*\$?\d+(?:\.\d+)?/); // cash $1/$3
  if (m1) return m1[0];
  const m2 = s.match(/\b(\d+[kKmM]?)\s*\/\s*(\d+[kKmM]?)(?:\s*\/\s*(\d+[kKmM]?))?\s*(?:ante|bb\s*ante)?/i);
  if (m2) return m2[0];
  return '';
}
function parseICMHints(text: string): boolean {
  return /\b(icm|bubble|final table|ladder|payouts?|in the money|itm)\b/i.test(text);
}
function detectIsRFI(text: string): boolean {
  const s = text.toLowerCase();
  // If hero 3-bets/4-bets → not RFI
  if (/\b(i|i'm|im|hero)\b[^.]{0,40}\b(3 ?bet|three[- ]bet|4 ?bet|four[- ]bet|re[- ]?raise)\b/i.test(s)) return false;
  // If villain opens before any hero raise → not RFI
  if (/\b(villain|utg|mp|hj|co|btn|sb|bb)\b[^.]{0,30}\b(raise|opens?)\b/i.test(s) &&
      !/\b(i|i'm|im|hero)\b[^.]{0,15}\b(raise|open)s?\b/i.test(s)) return false;
  // Hero opens pre
  if (/\b(i|i'm|im|hero)\b[^.]{0,20}\b(raise|open)s?\b/i.test(s)) return true;
  return false;
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

  // Async state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Judge
  const [mistakes, setMistakes] = useState<JudgeMistake[]>([]);
  const [judgeSummary, setJudgeSummary] = useState<string>('');

  // Lightweight parse for preview (client-side)
  const preview = useMemo(() => ({
    stakes: parseStakes(input),
    position: parseHeroPosition(input),
    heroCards: parseHeroCardsSmart(input),
    board: parseBoard(input),
    mode: parseGameMode(input),
    eff_bb: parseEffBB(input),
    blinds: parseBlinds(input),
    icm_context: parseICMHints(input),
    isRFI: detectIsRFI(input),
  }), [input]);

  // Resolve preview values with assists
  const heroCards = (twoCardsFrom(heroAssist) || fields?.cards || preview.heroCards || '').trim();
  const boardFromAssist = parseBoardFromText(boardAssist);
  const flop = (boardAssist ? boardFromAssist.flop : preview.board.flop) || '';
  const turn = (boardAssist ? boardFromAssist.turn : preview.board.turn) || '';
  const river = (boardAssist ? boardFromAssist.river : preview.board.river) || '';

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const pos = (fields?.position ?? preview.position ?? '').toUpperCase() || 'BTN';
  const mode: 'cash'|'mtt'|'' = (fields?.mode ?? preview.mode ?? '');

  const isRFI = preview.isRFI; // live decision to lock/unlock grid

  // Rebase edits if position changes
  useEffect(() => {
    if (lastPosForEdits && lastPosForEdits === pos) return;
    setRangeEdits({});
    setLastPosForEdits(pos);
  }, [pos, lastPosForEdits]);

  /** Parse → Analyze → Judge */
  async function handleParse() {
    setStatus(null);
    setAiError(null);
    setMistakes([]);
    setJudgeSummary('');
    try {
      const res = await fetch('/api/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      });
      const parsed: Fields = await res.json();
      setFields(parsed);

      // Analyze (best line)
      analyzeParsedHand(parsed);

      // Judge (only if we have some actions in text)
      if (/\b(raise|call|fold|bet|check|3 ?bet|4 ?bet|jam|shove)\b/i.test(input)) {
        judgeHand(parsed);
      }
    } catch (e: any) {
      setAiError(e.message || 'Parse failed');
    }
  }

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
        notes: parsed.notes ?? '',
        // New!
        mode: parsed.mode ?? preview.mode ?? '',
        eff_bb: parsed.eff_bb ?? preview.eff_bb ?? null,
        blinds: parsed.blinds ?? preview.blinds ?? '',
        icm_context: parsed.icm_context ?? preview.icm_context ?? false,
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

  async function judgeHand(parsed: Fields) {
    try {
      const payload = {
        text: input,
        mode: parsed.mode ?? preview.mode ?? '',
        eff_bb: parsed.eff_bb ?? preview.eff_bb ?? null,
        blinds: parsed.blinds ?? preview.blinds ?? '',
        icm_context: parsed.icm_context ?? preview.icm_context ?? false,
        board: [flop, turn, river].filter(Boolean).join(' '),
      };
      const r = await fetch('/api/judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (r.ok) {
        const j = await r.json();
        setMistakes(Array.isArray(j.mistakes) ? j.mistakes : []);
        setJudgeSummary(j.short_summary || '');
      }
    } catch (_e) {}
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
  const toggleHand = (label: string) =>
    isRFI && setRangeEdits(prev => ({ ...prev, [label]: !(prev[label] ?? defaultOpen(pos, label, mode || 'cash')) }));

  const resetRange = () => { setRangeEdits({}); setLastPosForEdits(pos); };

  const openFlags: Record<string, boolean> = {};
  RANKS.forEach((_, i) => {
    RANKS.forEach((__, j) => {
      const lbl = handLabel(i, j);
      openFlags[lbl] = rangeEdits.hasOwnProperty(lbl)
        ? rangeEdits[lbl]
        : defaultOpen(pos, lbl, mode || 'cash');
    });
  });
  const openCount = Object.values(openFlags).filter(Boolean).length;
  const openPct = Math.round((openCount / 169) * 100);

  /** tiny status helpers */
  const needPieces: string[] = [];
  if (!preview.mode) needPieces.push('game type (Cash or MTT)');
  if (preview.mode === 'mtt' && !preview.eff_bb) needPieces.push('effective stack (e.g., “18bb eff”)');
  if (!preview.position) needPieces.push('your position (UTG…SB)');
  const hasNeed = needPieces.length > 0;

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
                placeholder={`Tell the story like this:

• Game: "Cash $1/$3"  OR  "MTT blinds 2k/4k/4k ante"
• Effective stacks: "150bb eff" (or "18bb eff, UTG covers")
• Positions: "I'm SB / villain CO / BTN…"
• Actions with sizes: "CO opens 2.5bb, I 3-bet 11.5bb, he calls…"
• Board: "Flop Ks 7d 2c; Turn 9c; River 4h"
• Context (MTT): "in the money / bubble / 10 left / short stack 7bb"
• Reads (optional) & Result (optional)`}
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />

              {/* tiny detected/missing strip */}
              <div className="p-detected">
                <span className="p-muted">
                  <strong>Detected:</strong>&nbsp;
                  {preview.mode ? (preview.mode === 'mtt' ? 'Tournament' : 'Cash') : '—'}
                  {preview.blinds ? ` • Blinds ${preview.blinds}` : ''}
                  {preview.eff_bb ? ` • Eff ${preview.eff_bb}bb` : ''}
                  {preview.position ? ` • ${preview.position}` : ''}
                  {preview.icm_context ? ' • ICM/bubble' : ''}
                  {isRFI ? ' • Node: RFI' : ' • Node: not RFI'}
                </span>
                {hasNeed && (
                  <span className="p-need">
                    <strong>Need:</strong> {needPieces.join(', ')} — add to your text.
                  </span>
                )}
              </div>

              <div className="p-row p-gap">
                <button className="p-btn p-primary" onClick={handleParse} disabled={!input.trim() || aiLoading}>
                  {aiLoading ? 'Analyzing…' : 'Send'}
                </button>
                <button
                  className="p-btn"
                  onClick={() => {
                    setInput(''); setFields(null); setStatus(null); setAiError(null);
                    setHeroAssist(''); setVillainAssist(''); setBoardAssist('');
                    setMistakes([]); setJudgeSummary('');
                  }}
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

            {/* --- Interactive Opening Range Grid --- */}
            <div className="p-card">
              <div className="p-subTitle">
                Hero Open Range — {pos} <span className="p-muted">({openPct}% of 169)</span>
              </div>

              {!isRFI && (
                <div className="p-lockRibbon">
                  Ranges locked — this hand is not an RFI (open-raise) spot.
                </div>
              )}
              {hasNeed && (
                <div className="p-ambiguous">
                  Ambiguous input: {needPieces.join(', ')}. Grid shown as folds until provided.
                </div>
              )}

              <div className={`rangeGrid ${!isRFI ? 'locked' : ''}`}>
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
                          title={`${lbl} — ${open ? 'Open' : 'Fold'}${isRFI ? ' (click to toggle)' : ''}`}
                          onClick={() => isRFI && toggleHand(lbl)}
                        >
                          {lbl}
                        </button>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>

              <div className="p-row p-gapTop" style={{justifyContent:'space-between'}}>
                <div className="p-muted" style={{fontSize:12}}>Click cells to toggle. Suited = upper triangle, Offsuit = lower, Pairs = diagonal.</div>
                <button className="p-btn" onClick={resetRange} disabled={!isRFI}>Reset to {pos} default</button>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="p-col">
            <div className="p-card">
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
                <InfoBox label="Position"><div>{(fields?.position ?? preview.position) || <span className="p-muted">(unknown)</span>}</div></InfoBox>
                <InfoBox label="Stakes / Blinds">
                  <div>
                    {(fields?.stakes ?? preview.stakes) || (fields?.blinds ?? preview.blinds) || <span className="p-muted">(unknown)</span>}
                    {mode ? <span className="p-badge">{mode.toUpperCase()}</span> : null}
                    {preview.icm_context ? <span className="p-badge icm">ICM</span> : null}
                    {preview.eff_bb ? <span className="p-badge">{preview.eff_bb}bb eff</span> : null}
                  </div>
                </InfoBox>
              </div>
            </div>

            {/* Mistakes appear ONLY if judge flags wrong actions */}
            {mistakes.length > 0 && (
              <div className="p-card p-mistakes">
                <div className="p-subTitle">Mistakes detected</div>
                {judgeSummary && <div className="p-muted" style={{marginBottom:8}}>{judgeSummary}</div>}
                <ul className="p-list">
                  {mistakes.map((m,i)=>(
                    <li key={i}>
                      <strong>{m.street.toUpperCase()}:</strong> {m.hero_action}
                      <div className="p-muted">Why wrong: {m.why_wrong}</div>
                      <div>Better: <em>{m.better_line}</em></div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="p-card">
              <div className="p-subTitle">Board</div>
              <div className="p-boardRow">
                <div className="p-pill">Flop:&nbsp;{
                  flop ? flop.split(' ').map((c,i)=>(<span key={i} className="p-cardSpan"><CardSpan c={c} />{i<2?' ':''}</span>))
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
          --range-open:#ee8d73; --range-fold:#3b3f46;
          --range-suited:#f6efe9; --range-offsuit:#eef0f3; --range-pair:#faf6f0;
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
          border:1px solid var(--border); border-radius:18px; padding:16px;
          box-shadow:0 10px 28px rgba(0,0,0,.08);
        }
        .p-cardTitle{font-size:13px;font-weight:700;letter-spacing:.15px;color:#334155;margin-bottom:10px}
        .p-subTitle{font-size:14px;font-weight:800;margin-bottom:10px;color:#111827}
        .p-textarea{
          width:100%; min-height:170px; resize:vertical; padding:12px 14px;
          border-radius:14px; border:1px solid var(--line); background:#ffffff; color:#0f172a; font-size:15px; line-height:1.5;
        }
        .p-detected{display:flex; flex-direction:column; gap:4px; margin:10px 0 4px}
        .p-need{color:#b45309} /* amber-ish */
        .p-row{display:flex;align-items:center}
        .p-gap{gap:12px} .p-gapTop{margin-top:10px} .p-end{justify-content:flex-end}
        .p-btn{
          appearance:none; border:1px solid var(--line); background:#ffffff; color:#0f172a;
          padding:10px 14px; border-radius:12px; cursor:pointer; transition:transform .02s, background .15s, border-color .15s;
        }
        .p-btn:hover{background:#f3f4f6} .p-btn:active{transform:translateY(1px)}
        .p-btn[disabled]{opacity:.55;cursor:not-allowed}
        .p-btn.p-primary{background:linear-gradient(180deg,var(--primary),var(--primary2)); color:var(--btnText); border-color:#9db7ff; box-shadow:0 6px 18px rgba(59,130,246,.25)}
        .p-assist3{display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:10px}
        @media (max-width:800px){.p-assist3{grid-template-columns:1fr}}
        .p-input{width:100%; padding:10px 12px; border-radius:12px; border:1px solid var(--line); background:#ffffff; color:#0f172a; font-size:14.5px;}
        .p-input.p-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace; line-height:1.45}
        .p-help{margin-top:8px; font-size:12px; color:var(--muted)}
        .p-muted{color:var(--muted)}
        .p-grid2{display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:8px}
        .ibox{background:#ffffff; border:1px solid var(--pillBorder); border-radius:12px; padding:10px 12px}
        .iboxLabel{font-size:11px; color:#6b7280; margin-bottom:3px}
        .iboxVal{font-size:14px}
        .p-boardRow{display:flex; flex-wrap:wrap; gap:10px; font-size:16px}
        .p-pill{background:var(--pillBg); border:1px solid var(--pillBorder); padding:8px 12px; border-radius:12px}
        .p-cardSpan{margin-right:4px}
        .p-list{margin:0; padding-left:18px; display:flex; flex-direction:column; gap:6px}
        .p-note{margin-top:10px; color:#166534} .p-err{margin-top:10px; color:#b91c1c}
        .p-badge{display:inline-block; margin-left:6px; padding:.5px 6px; border-radius:999px; font-size:11px; background:#eef2ff; color:#1e3a8a; border:1px solid #c7d2fe}
        .p-badge.icm{background:#fff7ed; color:#9a3412; border-color:#fed7aa}
        /* Range grid */
        .rangeGrid{display:grid; grid-template-columns: 28px repeat(13, 1fr); grid-auto-rows: 26px; gap: 4px; align-items:center; position:relative}
        .rangeGrid.locked{pointer-events:none; opacity:.92}
        .rangeHead{font-size:12px; color:#64748b; text-align:center; line-height:26px}
        .rangeCorner{width:28px;height:26px}
        .cell{border:1px solid #cbd5e1; border-radius:6px; font-size:11.5px; display:flex; align-items:center; justify-content:center; cursor:pointer; user-select:none; transition:transform .02s ease, filter .15s ease, box-shadow .15s ease; box-shadow: inset 0 0 0 1px rgba(0,0,0,.02)}
        .cell.suited{background:var(--range-suited)} .cell.offsuit{background:var(--range-offsuit)} .cell.pair{background:var(--range-pair)}
        .cell.open{background:var(--range-open); color:#222; border-color:#e2a08e}
        .cell.fold{background:#374151; color:#e5e7eb; border-color:#4b5563}
        .cell:hover{filter:brightness(1.07)}
        .p-lockRibbon{margin-bottom:8px; font-size:12.5px; color:#334155}
        .p-ambiguous{margin-bottom:8px; font-size:12.5px; color:#9a3412}
        .p-mistakes{border-left:4px solid #ef4444}
      `}</style>
    </main>
  );
}

/** Small info box */
function InfoBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ibox">
      <div className="iboxLabel">{label}</div>
      <div className="iboxVal">{children}</div>
    </div>
  );
}
