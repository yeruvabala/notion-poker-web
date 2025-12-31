// app/(app)/HomeClient.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import "@/styles/onlypoker-theme.css";
import { createClient } from '@/lib/supabase/client'; // ← ADDED

/* ====================== Types & helpers ====================== */

type Fields = {
  date?: string | null;
  stakes?: string | null;
  position?: string | null;
  cards?: string | null; // hero cards, like "K♥ T♥"
  board?: string | null; // "Flop: … | Turn: … | River: …"
  gto_strategy?: string | null;
  exploit_deviation?: string | null;
  exploit_signals?: any;  // NEW: Agent 7 exploit signals
  learning_tag?: string[];
  hand_class?: string | null;
  source_used?: 'SUMMARY' | 'STORY' | null;
};

type RankSym = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';
const RANKS: RankSym[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
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

  const m0 = t.match(/^([2-9tjqka])([♥♦♣♠])$/i);
  if (m0) return `${m0[1].toUpperCase()}${m0[2]}`;

  const m1 = t.replace(/[\s/]+/g, '').match(/^([2-9tjqka])([shdc])$/i);
  if (m1) return `${m1[1].toUpperCase()}${SUIT_MAP[m1[2].toLowerCase()]}`;

  const m2 = t.match(/^([2-9tjqka])\s*(?:of)?\s*(spades?|hearts?|diamonds?|clubs?)$/i);
  if (m2) return `${m2[1].toUpperCase()}${SUIT_WORD[m2[2].toLowerCase()]}`;

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

/* ---------- story parsing (stakes, position, hero, board, actions) ---------- */

function parseStakes(t: string): string {
  const m =
    t.match(/\$?\d+(?:\.\d+)?\s*\/\s*\$?\d+(?:\.\d+)?(?:\s*\+\s*\$?\d+(?:\.\d+)?\s*(?:bb|bba|ante))?/i) ||
    t.match(/\d+bb\/\d+bb(?:\s*\+\s*\d+bb\s*bba)?/i);
  return m ? m[0] : '';
}

function parsePosition(t: string): string {
  // FIRST: Check for identity + position patterns BEFORE normalization
  // This catches "I... on the Button" even when far apart
  const identityPosMatch = t.match(/\b(I|hero|my|me)\b[^.!?]{0,100}\b(on\s+the\s+button|button|BTN|SB|BB|CO|HJ|MP|UTG)/i);
  if (identityPosMatch) {
    const pos = identityPosMatch[2].toLowerCase();
    if (/button|btn/i.test(pos)) return 'BTN';
    if (/\bbb\b/i.test(pos)) return 'BB';
    if (/\bsb\b/i.test(pos)) return 'SB';
    if (/\bco\b/i.test(pos)) return 'CO';
    if (/\bhj\b/i.test(pos)) return 'HJ';
    if (/\bmp\b/i.test(pos)) return 'MP';
    if (/\butg/i.test(pos)) return 'UTG';
  }

  // Normalize: fix typos and slang first
  let text = t;
  text = text.replace(/\b(otb|button|on the button)\b/gi, 'BTN');
  text = text.replace(/\bUnder the gun\b/gi, 'UTG');
  text = text.replace(/\bCutoff\b/gi, 'CO');
  text = text.replace(/\bHijack\b/gi, 'HJ');
  text = text.replace(/\bSmall blind\b/gi, 'SB');
  text = text.replace(/\bBig blind\b/gi, 'BB');

  // Identity-aware: extract hero's position
  // Pattern: "I/hero/my" followed by position or action from position
  const heroMatch = text.match(/\b(I|hero|my|me)\s+(?:am\s+)?(?:on\s+)?(?:the\s+)?(BTN|SB|BB|CO|HJ|MP|UTG)/i);
  if (heroMatch) return heroMatch[2].toUpperCase();

  // Pattern: "hero (BTN)" or "I (button)"
  const parenMatch = text.match(/\b(I|hero|my)\s*\(([^)]*(?:BTN|button|BB|SB|CO|HJ|MP|UTG)[^)]*)\)/i);
  if (parenMatch) {
    const pos = parenMatch[2];
    if (/BTN|button/i.test(pos)) return 'BTN';
    if (/BB/i.test(pos)) return 'BB';
    if (/SB/i.test(pos)) return 'SB';
    if (/CO/i.test(pos)) return 'CO';
    if (/HJ/i.test(pos)) return 'HJ';
    if (/MP/i.test(pos)) return 'MP';
    if (/UTG/i.test(pos)) return 'UTG';
  }

  // Fallback: search for standalone positions (case-insensitive)
  const up = ` ${text.toUpperCase()} `;
  const POS = ['BTN', 'BB', 'SB', 'CO', 'HJ', 'MP', 'UTG+2', 'UTG+1', 'UTG'];
  for (const p of POS) {
    if (up.includes(` ${p} `)) return p.replace('+', '+');
  }

  return '';
}

function parseHeroCardsSmart(t: string): string {
  const s = (t || '').toLowerCase();

  // Pattern 1: Cards with suits already attached (e.g., "with Ad Kd", "i got KK")
  let m = s.match(/\b(?:hero|i|holding|with|have|has|got)\b[^.\n]{0,30}?([2-9tjqka][shdc♥♦♣♠])\s+([2-9tjqka][shdc♥♦♣♠])/i);
  if (m) return prettyCards(`${m[1]} ${m[2]}`);

  // Pattern 2: Rank words (e.g., "Ace King suited" or "pocket aces")
  const rankWords: Record<string, string> = {
    'ace': 'A', 'king': 'K', 'queen': 'Q', 'jack': 'J', 'ten': 'T',
    'nine': '9', 'eight': '8', 'seven': '7', 'six': '6', 'five': '5',
    'four': '4', 'three': '3', 'two': '2', 'deuce': '2'
  };

  const wordPattern = Object.keys(rankWords).join('|');
  const rankWordMatch = s.match(new RegExp(`\\b(${wordPattern})\\s+(${wordPattern})`, 'i'));
  if (rankWordMatch) {
    const r1 = rankWords[rankWordMatch[1].toLowerCase()];
    const r2 = rankWords[rankWordMatch[2].toLowerCase()];

    // Check for suited/offsuit indicators
    const afterCards = s.slice(rankWordMatch.index! + rankWordMatch[0].length);
    let suit = 's'; // default spades
    if (/suited|ss|dd|hh|cc|diamonds?/i.test(afterCards.slice(0, 20))) {
      suit = /diamonds?|dd/i.test(afterCards.slice(0, 20)) ? 'd' : 's';
    }
    return prettyCards(`${r1}${suit} ${r2}${suit}`);
  }

  // Pattern 3: Rank abbreviations with context (e.g., "i got KK", "with AK")
  // CRITICAL: Require context words to avoid matching blinds like "1k-2k-2k"
  const abbrMatch = s.match(/\b(?:hero|i|holding|with|have|has|got)\b[^.\n]{0,30}?([akqjt2-9]{2})\b/i);
  if (abbrMatch) {
    const ranks = abbrMatch[1].toUpperCase();
    const afterRanks = s.slice(abbrMatch.index! + abbrMatch[0].length);

    // FIXED: Default to OFFSUIT (different suits) instead of suited
    let suit1 = 's', suit2 = 'd';

    // Check for specific suit indicators immediately after ranks (using anchor ^)
    if (/^\s*(dd|diamonds?)/i.test(afterRanks)) {
      suit1 = suit2 = 'd'; // Both diamonds
    } else if (/^\s*(hh|hearts?)/i.test(afterRanks)) {
      suit1 = suit2 = 'h'; // Both hearts
    } else if (/^\s*(cc|clubs?)/i.test(afterRanks)) {
      suit1 = suit2 = 'c'; // Both clubs
    } else if (/^\s*(suited|ss|spades?)/i.test(afterRanks)) {
      suit1 = suit2 = 's'; // Both spades
    }
    // else: keep default offsuit (s, d)

    return prettyCards(`${ranks[0]}${suit1} ${ranks[1]}${suit2}`);
  }

  // Pattern 4: Any two cards with suits (fallback)
  const tokens = Array.from(s.matchAll(/([2-9tjqka][shdc♥♦♣♠])/ig)).map(x => x[0]).slice(0, 2);
  if (tokens.length === 2) return prettyCards(tokens.join(' '));

  return '';
}

function parseBoardFromStory(t: string) {
  const src = (t || '').toLowerCase();

  const grab = (label: 'flop' | 'turn' | 'river') => {
    const rx = new RegExp(`\\b${label}\\b(?:\\s+is)?\\s*:?\\s*([^\\n]*)`, 'i');
    const m = src.match(rx);
    return m ? m[1] : '';
  };

  const takeCards = (line: string, n: number) => {
    if (!line) return [];
    const raw = line.replace(/[.,;|]/g, ' ').split(/\s+/).filter(Boolean);
    const cards: string[] = [];
    for (const tok of raw) {
      const c = suitifyToken(tok);
      if (c) cards.push(c);
      if (cards.length >= n) break;
    }
    return cards;
  };

  const flopLine = grab('flop');
  const turnLine = grab('turn');
  const riverLine = grab('river');

  const flopArr = takeCards(flopLine, 3);
  const turnArr = takeCards(turnLine, 1);
  const riverArr = takeCards(riverLine, 1);

  return {
    flop: flopArr.join(' '),
    turn: turnArr[0] || '',
    river: riverArr[0] || '',
  };
}

function parseActionHint(text: string): string {
  const s = text.toLowerCase().replace(/villian|villain/gi, 'villain');
  const riverLine = s.split('\n').find(l => /river|riv /.test(l));
  if (!riverLine) return '';

  const betMatch = riverLine.match(/(villain|btn|utg|sb|bb).{0,20}\bbet[s]?\b[^0-9%]*(\d{1,3})\s?%/i)
    || riverLine.match(/(villain|btn|utg|sb|bb).{0,20}\bbet[s]?\b[^a-z0-9]*(?:([1-4])\/([1-4]))\s*pot/i);
  if (betMatch) {
    if (betMatch[2] && betMatch[3]) {
      const p = Math.round((Number(betMatch[2]) / Number(betMatch[3])) * 100);
      return `RIVER: facing-bet ~${p}%`;
    }
    if (betMatch[2]) return `RIVER: facing-bet ~${betMatch[2]}%`;
  }

  if (/check(?:s|ed)?\s*(?:through)?/.test(riverLine)) return 'RIVER: check-through';

  return '';
}

/* ---------- determine hand class deterministically ---------- */

const PLACEHOLDER_SET = new Set(['J♣', 'J♠', 'T♦', '4♠', '4♣', '9♣', '9♠', '3♣', '3♠']);

function isPlaceholder(v: string | undefined) {
  const x = (v || '').trim();
  if (!x) return true;
  return PLACEHOLDER_SET.has(x);
}

function ranksOnly(card: string) {
  return (card || '').replace(/[♥♦♣♠]/g, '').toUpperCase();
}

function handClass(heroCards: string, flop: string, turn: string, river: string): string {
  const hero = heroCards.split(' ').filter(Boolean);
  const board = [flop, turn, river].join(' ').trim().split(' ').filter(Boolean);
  const all = [...hero, ...board];

  if (hero.length !== 2 || board.length < 3) return 'Unknown';

  const suit = (c: string) => c.slice(-1);
  const rank = (c: string) => c.slice(0, -1).toUpperCase();

  const counts: Record<string, number> = {};
  for (const c of all) counts[rank(c)] = (counts[rank(c)] || 0) + 1;

  const ranks = Object.values(counts).sort((a, b) => b - a);
  const flush = (() => {
    const sCount: Record<string, number> = {};
    for (const c of all) sCount[suit(c)] = (sCount[suit(c)] || 0) + 1;
    return Object.values(sCount).some(n => n >= 5);
  })();

  const rankToVal: Record<string, number> = {
    A: 14, K: 13, Q: 12, J: 11, T: 10, 9: 9, 8: 8, 7: 7, 6: 6, 5: 5, 4: 4, 3: 3, 2: 2
  };
  const uniqVals = Array.from(new Set(all.map(rank).map(r => rankToVal[r]).filter(Boolean))).sort((a, b) => b - a);
  let straight = false;
  if (uniqVals.length >= 5) {
    let run = 1;
    for (let i = 1; i < uniqVals.length; i++) {
      if (uniqVals[i] === uniqVals[i - 1] - 1) { run++; if (run >= 5) { straight = true; break; } }
      else if (uniqVals[i] !== uniqVals[i - 1]) run = 1;
    }
    if (!straight && uniqVals.includes(14)) {
      const wheel = [5, 4, 3, 2, 1].every(v => uniqVals.includes(v === 1 ? 14 : v));
      if (wheel) straight = true;
    }
  }

  if (ranks[0] === 4) return 'Quads';
  if (ranks[0] === 3 && ranks[1] === 2) return 'Full House';
  if (flush && straight) return 'Straight Flush';
  if (flush) return 'Flush';
  if (straight) return 'Straight';
  if (ranks[0] === 3) return 'Trips';
  if (ranks[0] === 2 && ranks[1] === 2) return 'Two Pair';
  if (ranks[0] === 2) return 'Pair';
  return 'High Card';
}

/* ====================== GTO Preview renderer ====================== */

const SECTION_HEADS = new Set([
  'SITUATION', 'RANGE SNAPSHOT',
  'PREFLOP', 'FLOP', 'TURN', 'RIVER',
  'NEXT CARDS', 'WHY', 'COMMON MISTAKES', 'LEARNING TAGS',
  'DECISION', 'PRICE', 'BOARD CLASS', 'RECOMMENDATION', 'MIXED'
]);

function renderGTO(text: string) {
  const lines = (text || '').split(/\r?\n/).filter(l => l.trim().length);
  if (!lines.length) return <div className="muted">No strategy yet. Click Analyze or Edit.</div>;

  const highlightConcepts = (text: string) => {
    const concepts = [
      'Range Advantage', 'Nut Advantage', 'Blockers', 'Pot Odds', 'MDF',
      'Polarized', 'Condensed', 'Value vs Showdown', 'Minimum Defense Frequency',
      'Showdown Value', 'Three Streets of Value'
    ];
    let result = text;
    concepts.forEach(concept => {
      const regex = new RegExp(`\\b(${concept})\\b`, 'gi');
      result = result.replace(regex, '**$1**');
    });
    return result;
  };

  return (
    <div className="gtoBody">
      {lines.map((raw, i) => {
        const line = raw.trim();
        const m = line.match(/^([A-Z ]+):\s*(.*)$/);
        if (m && SECTION_HEADS.has(m[1].trim())) {
          return (
            <div key={i} className="gtoLine">
              <strong className="gtoHead">{m[1].trim()}:</strong>
              {m[2] ? <span className="gtoText"> {m[2]}</span> : null}
            </div>
          );
        }
        if (/^[-•]/.test(line)) return <div key={i} className="gtoBullet">{line.replace(/^\s*/, '')}</div>;

        const highlighted = highlightConcepts(line);
        if (highlighted.includes('**')) {
          const parts = highlighted.split(/\*\*/);
          return (
            <div key={i} className="gtoLine">
              {parts.map((part, j) =>
                j % 2 === 1 ? <strong key={j} className="concept-highlight">{part}</strong> : part
              )}
            </div>
          );
        }

        return <div key={i} className="gtoLine">{line}</div>;
      })}
    </div>
  );
}

/* ====================== Tag Color Helper ====================== */

function getTagClass(tag: string): string {
  const t = tag.toLowerCase().replace('#', '');
  if (t.includes('range')) return 'tag-blue';
  if (t.includes('nut')) return 'tag-purple';
  if (t.includes('blocker')) return 'tag-orange';
  if (t.includes('value') || t.includes('thin')) return 'tag-green';
  if (t.includes('bluff') || t.includes('fold')) return 'tag-red';
  if (t.includes('mdf') || t.includes('pot')) return 'tag-yellow';
  return 'tag-gray';
}

/* ====================== Page ====================== */

export default function HomeClient() {
  const [input, setInput] = useState('');

  const [fields, setFields] = useState<Fields | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  // editable summary
  const [mode, setMode] = useState<'CASH' | 'MTT' | ''>('CASH');
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

  const [gtoEdit, setGtoEdit] = useState(false);

  // ← ADDED: read signed-in user's email and show it under the title
  const supabase = createClient();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (!error && !cancelled) setUserEmail(data?.user?.email ?? null);
      } catch { }
    })();
    return () => { cancelled = true; };
  }, [supabase]);

  // AUTO-PARSING: Call LLM parser on input change (with debounce)
  const [parsing, setParsing] = useState(false);
  useEffect(() => {
    // Skip auto-parsing if currently analyzing (prevents interference)
    if (aiLoading) return;

    const timer = setTimeout(async () => {
      if (!input.trim() || input.length < 10) return; // Skip very short inputs

      setParsing(true);
      try {
        const res = await fetch('/api/parse', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ input }),
        });

        if (res.ok) {
          const parsed = await res.json();

          // Auto-populate fields ONLY if they're currently empty
          if (parsed.stakes && !stakes) setStakes(parsed.stakes);
          if (parsed.position && !position) setPosition(parsed.position);

          // Parse hero cards
          if (parsed.cards) {
            const cards = parsed.cards.split(' ').filter(Boolean);
            if (cards.length >= 2 && !h1 && !h2) {
              setH1(cards[0]);
              setH2(cards[1]);
            }
          }

          // Parse board cards (look for "Flop:", "Turn:", "River:")
          if (parsed.board) {
            const flopMatch = parsed.board.match(/Flop:\s*([^,\n]+)/i);
            const turnMatch = parsed.board.match(/Turn:\s*([^,\n]+)/i);
            const riverMatch = parsed.board.match(/River:\s*([^,\n]+)/i);

            if (flopMatch && !f1 && !f2 && !f3) {
              const flopCards = flopMatch[1].trim().split(/\s+/).filter(Boolean);
              if (flopCards[0]) setF1(flopCards[0]);
              if (flopCards[1]) setF2(flopCards[1]);
              if (flopCards[2]) setF3(flopCards[2]);
            }
            if (turnMatch && !tr) {
              const turnCard = turnMatch[1].trim().split(/\s+/)[0];
              if (turnCard) setTr(turnCard);
            }
            if (riverMatch && !rv) {
              const riverCard = riverMatch[1].trim().split(/\s+/)[0];
              if (riverCard) setRv(riverCard);
            }
          }
        }
      } catch (err) {
        console.error('Auto-parse error:', err);
      } finally {
        setParsing(false);
      }
    }, 1500); // 1.5 second debounce

    return () => clearTimeout(timer);
  }, [input]); // Only re-run when input changes

  // parsed preview from story
  const preview = useMemo(() => ({
    stakes: parseStakes(input),
    position: parsePosition(input),
    heroCards: parseHeroCardsSmart(input),
    board: parseBoardFromStory(input),
    action_hint: parseActionHint(input)
  }), [input]);

  function syncFromStory() {
    if (!stakes && preview.stakes) setStakes(preview.stakes);
    if (!position && preview.position) setPosition(preview.position);
    const pcs = (preview.heroCards || '').split(' ').filter(Boolean);
    if ((!h1 || !h2) && pcs.length === 2) {
      if (!h1) setH1(pcs[0]); if (!h2) setH2(pcs[1]);
    }
    const arr = (preview.board.flop || '').split(' ').filter(Boolean);
    if ((!f1 && !f2 && !f3) && arr.length === 3) { setF1(arr[0]); setF2(arr[1]); setF3(arr[2]); }
    if (!tr && preview.board.turn) setTr(preview.board.turn);
    if (!rv && preview.board.river) setRv(preview.board.river);
  }

  const sourceUsed: 'SUMMARY' | 'STORY' = useMemo(() => {
    const heroOK = (!isPlaceholder(h1) && !!suitifyToken(h1)) && (!isPlaceholder(h2) && !!suitifyToken(h2));
    const flopOK = (!isPlaceholder(f1) && !!suitifyToken(f1)) && (!isPlaceholder(f2) && !!suitifyToken(f2)) && (!isPlaceholder(f3) && !!suitifyToken(f3));
    const turnOK = (!isPlaceholder(tr) && !!suitifyToken(tr));
    const riverOK = (!isPlaceholder(rv) && !!suitifyToken(rv));
    return (heroOK || flopOK || turnOK || riverOK) ? 'SUMMARY' : 'STORY';
  }, [h1, h2, f1, f2, f3, tr, rv]);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const heroCardsStr = useMemo(() => {
    if (sourceUsed === 'SUMMARY') {
      const a = suitifyToken(h1); const b = suitifyToken(h2);
      return [a, b].filter(Boolean).join(' ');
    }
    return preview.heroCards || '';
  }, [sourceUsed, h1, h2, preview.heroCards]);

  const flopStr = useMemo(() => {
    if (sourceUsed === 'SUMMARY') {
      const a = suitifyToken(f1), b = suitifyToken(f2), c = suitifyToken(f3);
      return [a, b, c].filter(Boolean).join(' ');
    }
    return preview.board.flop || '';
  }, [sourceUsed, f1, f2, f3, preview.board.flop]);

  const turnStr = useMemo(() => (sourceUsed === 'SUMMARY' ? suitifyToken(tr) : preview.board.turn || ''), [sourceUsed, tr, preview.board.turn]);
  const riverStr = useMemo(() => (sourceUsed === 'SUMMARY' ? suitifyToken(rv) : preview.board.river || ''), [sourceUsed, rv, preview.board.river]);

  const actionHint = useMemo(() => preview.action_hint || '', [preview.action_hint]);

  const derivedHandClass = useMemo(() => handClass(heroCardsStr, flopStr, turnStr, riverStr), [heroCardsStr, flopStr, turnStr, riverStr]);

  async function analyze() {
    // ══════════════════════════════════════════════════
    // STEP 0: CAPTURE DATA BEFORE CLEARING
    // ══════════════════════════════════════════════════
    // CRITICAL: Capture ALL data BEFORE clearing fields
    // Otherwise sourceUsed changes and we lose the data!
    const capturedBoard = [
      preview.board.flop && `Flop: ${preview.board.flop}`,
      preview.board.turn && `Turn: ${preview.board.turn}`,
      preview.board.river && `River: ${preview.board.river}`,
    ].filter(Boolean).join('  |  ');

    const capturedHeroCards = preview.heroCards || '';
    const capturedPosition = (preview.position || '').toUpperCase() || '';
    const capturedStakes = preview.stakes || '';
    const currentInput = input || '';
    const capturedActionHint = preview.action_hint || '';
    const capturedHandClass = derivedHandClass || '';

    // ══════════════════════════════════════════════════
    // STEP 1: IMMEDIATE CLEAR - Reset all previous data
    // ══════════════════════════════════════════════════
    setFields(null);  // Clear all old hand data INSTANTLY
    setError(null);
    setStatus(null);

    // Clear manual input fields to prevent state persistence
    setPosition('');
    setStakes('');
    setH1(''); setH2('');
    setF1(''); setF2(''); setF3('');
    setTr(''); setRv('');

    // ══════════════════════════════════════════════════
    // STEP 2: LOADING STATE - Show user something is happening
    // ══════════════════════════════════════════════════
    setAiLoading(true);

    try {
      // Use CAPTURED data from preview (parsed from input text)
      const payload = {
        date: today,
        stakes: capturedStakes || undefined,
        position: capturedPosition || undefined,
        cards: capturedHeroCards || undefined,
        board: capturedBoard || undefined,
        notes: currentInput || undefined,
        rawText: currentInput || undefined,
        fe_hint: feNeeded || undefined,
        spr_hint: spr || undefined,
        action_hint: capturedActionHint || undefined,
        hand_class: undefined, // Recalculated by API
        source_used: 'PREVIEW' // Using preview parse, not manual fields
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

      // ══════════════════════════════════════════════════
      // STEP 3: UPDATE - Set new data from API response
      // ══════════════════════════════════════════════════
      const data = await r.json();
      setFields({
        gto_strategy: (data?.gto_strategy ?? '') || '',
        exploit_deviation: (data?.exploit_deviation ?? '') || '',
        exploit_signals: data?.exploit_signals || null,  // NEW: Agent 7
        learning_tag: Array.isArray(data?.learning_tag) ? data.learning_tag : [],
        date: today,
        stakes: payload.stakes || '',
        position: payload.position || '',
        cards: capturedHeroCards, // Use CAPTURED value
        board: capturedBoard, // Fix: use captured board
        hand_class: undefined, // Let API calculate
        source_used: 'STORY' // Using preview which parses from story
      });
    } catch (e: any) {
      setError(e?.message || 'Analyze error');
    } finally {
      setAiLoading(false);
    }
  }

  // ************** NEW: save to Supabase via /api/hands **************
  async function saveToDb() {
    if (!fields) return;
    setSaving(true); setStatus(null);
    try {
      const r = await fetch('/api/hands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) throw new Error(data?.error || 'Save failed');
      setStatus('Saved to Supabase ✓');
    } catch (e: any) {
      setStatus(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }
  // *******************************************************************
  const suitColor = (suit: string) => (isRed(suit) ? '#ef4444' : '#e5e7eb'); // Platinum for black suits

  return (
    <div className="op-surface">
      <main className="p">
        <div className="wrap">
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 40, marginTop: 20 }}>
            <h1 className="text-5xl font-extrabold uppercase tracking-wide mb-2 platinum-text-gradient">Only Poker</h1>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, opacity: 0.9 }}>
              <div style={{ height: 1, width: 80, background: 'linear-gradient(90deg, transparent, #a3a3a3)' }}></div>
              <div style={{ fontSize: 18, letterSpacing: 6, lineHeight: 1 }}>
                <span style={{ color: '#e5e7eb', textShadow: '0 0 10px rgba(229,231,235,0.4)' }}>♠️</span>
                <span style={{ color: '#e5e7eb', textShadow: '0 0 10px rgba(229,231,235,0.4)' }}>♥️</span>
                <span style={{ color: '#e5e7eb', textShadow: '0 0 10px rgba(229,231,235,0.4)' }}>♣️</span>
                <span style={{ color: '#e5e7eb', textShadow: '0 0 10px rgba(229,231,235,0.4)' }}>♦️</span>
              </div>
              <div style={{ height: 1, width: 80, background: 'linear-gradient(90deg, #a3a3a3, transparent)' }}></div>
            </div>
            {userEmail && (
              <div className="small muted" style={{ marginTop: 8 }}>
                Signed in as {userEmail}
              </div>
            )}
          </div>

          <div className="grid">
            {/* LEFT column */}
            <div className="col ony-left-bg">
              {/* Story box */}
              <section className="card ony-card platinum-container-frame">
                <div className="cardTitle platinum-text-gradient">Hand Played</div>
                <textarea
                  className="w-full h-40 p-4 resize-none focus:outline-none platinum-inner-border"
                  style={{ background: '#262626', color: '#E2E8F0' }}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={`Type your hand like a story — stakes, position, cards, actions…

Example:
Cash 6-max 100bb. BTN (Hero) 2.3x, BB calls.
Flop 8♠ 6♠ 2♦ — bet 50%, call.
Turn K♦ — ...`}
                />
                <div className="row gap">
                  <button
                    className="btn btn-platinum-premium"
                    style={{ flex: 1 }}
                    onClick={analyze}
                    disabled={aiLoading || !input.trim()}
                  >
                    {aiLoading ? 'Analyzing…' : 'Analyze Hand'}
                  </button>
                  <button
                    className="btn btn-platinum-premium btn-ony--sm"
                    onClick={syncFromStory}
                    title="Copy stakes/position/hero/board from the story preview into the editors"
                  >
                    Sync
                  </button>
                  <button
                    className="btn btn-ony btn-ony--sm"
                    onClick={() => {
                      setInput(''); setFields(null); setStatus(null); setError(null);
                      setStakes(''); setEff(''); setPosition('');
                      setH1(''); setH2(''); setF1(''); setF2(''); setF3(''); setTr(''); setRv('');
                      setRisk(''); setReward(''); setFlopPot(''); setBehind('');
                    }}
                  >
                    Clear
                  </button>
                </div>
                {error && <div className="err">{error}</div>}
              </section>

              {/* Situation Summary (editable) */}
              <section className="card ony-card platinum-container-frame">
                <div className="cardTitle platinum-text-gradient">Situation Summary</div>

                <div className="summaryGrid">
                  <Info label="Mode">
                    <select className="input input-ony platinum-inner-border" value={mode} onChange={e => setMode(e.target.value as any)}>
                      <option value="CASH">CASH</option>
                      <option value="MTT">MTT</option>
                    </select>
                  </Info>

                  <Info label="Blinds / Stakes">
                    <input className="input input-ony platinum-inner-border" value={stakes} onChange={e => setStakes(e.target.value)} placeholder={preview.stakes || '(unknown)'} />
                  </Info>

                  <Info label="Effective Stack (bb)">
                    <input className="input input-ony platinum-inner-border" value={eff} onChange={e => setEff(e.target.value)} placeholder="(optional)" />
                  </Info>

                  <Info label="Positions">
                    <input className="input input-ony platinum-inner-border" value={position} onChange={e => setPosition(e.target.value.toUpperCase())} placeholder={preview.position || '(unknown)'} />
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

                <div className="hint">
                  <b>Source:</b> <span className="chip">{sourceUsed === 'SUMMARY' ? 'Using: Summary editors' : 'Using: Story parse'}</span>
                  &nbsp; • Postflop: add exact suits (e.g., <b>As 4s</b>) for accuracy. “Sync from Story” copies the parse below.
                </div>
                {actionHint && <div className="hint">Detected action: <b>{actionHint}</b></div>}
              </section>

              {/* FE & SPR */}
              <section className="card ony-card platinum-container-frame">
                <div className="cardTitle">Fold-Equity Threshold & SPR</div>

                <div className="feSprGrid">
                  <div className="box platinum-inner-border">
                    <div className="boxTitle">FE calculator (bb units)</div>
                    <div className="grid2">
                      <label className="lbl">Risk (bb)</label>
                      <input className="input input-ony platinum-inner-border" value={risk} onChange={e => setRisk(e.target.value)} placeholder="e.g., jam = eff BB" />
                      <label className="lbl">Reward (bb)</label>
                      <input className="input input-ony platinum-inner-border" value={reward} onChange={e => setReward(e.target.value)} placeholder="pre-pot + bet size" />
                    </div>
                    <div className="calcLine">
                      FE needed ≈ <b>{feNeeded || '0%'}</b> &nbsp;
                      <span className="muted">(Risk / (Risk + Reward))</span>
                    </div>
                  </div>

                  <div className="box platinum-inner-border">
                    <div className="boxTitle">SPR (flop)</div>
                    <div className="grid2">
                      <label className="lbl">Flop pot (bb)</label>
                      <input className="input input-ony platinum-inner-border" value={flopPot} onChange={e => setFlopPot(e.target.value)} placeholder="e.g., 5.9" />
                      <label className="lbl">Behind (bb)</label>
                      <input className="input input-ony platinum-inner-border" value={behind} onChange={e => setBehind(e.target.value)} placeholder="effective after prefl" />
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
              <section className="card ony-card platinum-container-frame">
                <div className="infoGrid">
                  <Info label="Date"><div>{today}</div></Info>
                  <Info label="Position"><div>{(position || preview.position) || <span className="muted">(unknown)</span>}</div></Info>
                  <Info label="Stakes"><div>{(stakes || preview.stakes) || <span className="muted">(unknown)</span>}</div></Info>
                  <Info label="Cards">
                    {heroCardsStr
                      ? heroCardsStr.split(' ').map((c, i) => (
                        <span key={i} style={{ marginRight: 6 }}><CardText c={c} /></span>
                      ))
                      : <span className="muted">(unknown)</span>
                    }
                  </Info>
                </div>
              </section>


              {/* Learning Tags */}
              {fields?.learning_tag && fields.learning_tag.length > 0 && (
                <section className="card ony-card platinum-container-frame">
                  <div className="cardTitle platinum-text-gradient">Key Concepts</div>
                  <div className="learning-tags-container">
                    {fields.learning_tag.map((tag, i) => (
                      <span key={i} className={`learning-tag ${getTagClass(tag)}`}>
                        {tag}
                      </span>
                    ))}
                  </div>
                  <div className="muted small" style={{ marginTop: 8 }}>Tags identify the strategic concepts in this hand</div>
                </section>
              )}

              {/* GTO Strategy */}
              <section className="card ony-card platinum-container-frame">
                <div className="cardTitleRow">
                  <div className="cardTitle platinum-text-gradient">GTO Strategy</div>
                  <span className="chip small">{sourceUsed === 'SUMMARY' ? 'Using: Summary editors' : 'Using: Story parse'}</span>
                  <button
                    className="btn btn-ony btn-ony--sm"
                    onClick={() => setGtoEdit(v => !v)}
                    title={gtoEdit ? 'Finish editing' : 'Edit raw text'}
                  >
                    {gtoEdit ? 'Done' : 'Edit'}
                  </button>
                </div>

                {gtoEdit ? (
                  <>
                    <textarea
                      className="textarea input-ony mono platinum-inner-border"
                      rows={12}
                      placeholder="Edit or add notes…"
                      value={fields?.gto_strategy ?? ''}
                      onChange={e => fields && setFields({ ...fields, gto_strategy: e.target.value })}
                    />
                    <div className="muted small">Editing raw text. Click “Done” to return to the formatted preview.</div>
                  </>
                ) : (
                  <>
                    <div className="gtoBox platinum-inner-border">{renderGTO(fields?.gto_strategy || '')}</div>
                    <div className="muted small">Preview only. Click “Edit” to change the text.</div>
                  </>
                )}
              </section>

              {/* Exploit Signals - NEW! */}
              {fields?.exploit_signals && fields.exploit_signals.length > 0 && (
                <section className="card ony-card platinum-container-frame">
                  <div className="cardTitle platinum-text-gradient">🎯 Exploit Signals</div>
                  <div className="muted small" style={{ marginBottom: 12 }}>
                    Hover over each player type to see adjusted strategy
                  </div>
                  <div className="exploit-icons">
                    {fields.exploit_signals.map((archetype: any) => (
                      <div key={archetype.id} className="exploit-icon-wrapper">
                        <div className="exploit-icon" title={archetype.description}>
                          <span className="exploit-emoji">{archetype.icon}</span>
                          <span className="exploit-name">{archetype.name}</span>
                        </div>
                        <div className="exploit-popup">
                          <div className="exploit-popup-title">
                            vs {archetype.icon} {archetype.name.toUpperCase()}
                          </div>
                          <div className="exploit-popup-desc">{archetype.description}</div>
                          {archetype.streets && archetype.streets.map((street: any, idx: number) => (
                            <div key={idx} className="exploit-street">
                              <strong>{street.street}:</strong>{' '}
                              {street.adjustedAction} {street.adjustedFreq}%
                              <span className="exploit-gto"> (GTO: {street.gtoFreq}%)</span>
                              <span className={`exploit-arrow ${street.direction}`}>
                                {street.direction === 'increase' ? ' ↑' : street.direction === 'decrease' ? ' ↓' : ' →'}
                              </span>
                              <div className="exploit-reason">{street.reason}</div>
                            </div>
                          ))}
                          <div className="exploit-advice">💡 {archetype.overallAdvice}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Play Review (formerly Exploitative Deviations) */}
              <section className="card ony-card platinum-container-frame">
                <div className="cardTitle platinum-text-gradient">📊 Play Review</div>
                <ul className="list platinum-inner-border">
                  {(fields?.exploit_deviation || '')
                    .split(/(?<=\.)\s+/)
                    .filter(Boolean)
                    .map((s, i) => <li key={i}>{s}</li>)}
                </ul>

                <div className="row end gapTop">
                  <button className="btn btn-platinum-premium" onClick={analyze} disabled={aiLoading}>
                    {aiLoading ? 'Analyzing…' : 'Analyze Again'}
                  </button>
                  <button className="btn btn-ony" onClick={saveToDb} disabled={!fields || saving}>
                    {saving ? 'Saving…' : 'Confirm & Save to Supabase'}
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
            --bg:#1c1c1c; --card:#1e1e1e; --line:#525252; --text:#E2E8F0; --muted:#94A3B8;
            --primary:#e5e7eb; --primary2:#9ca3af; --btnText:#121212;
          }
          *{box-sizing:border-box}
          html,body{margin:0;padding:0;background:#1c1c1c !important;color:#E2E8F0;font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial}
          h1,h2,h3,h4,h5,h6,p,span,label{color:#E2E8F0}
          input,textarea,select{color:#E2E8F0 !important}
          ::placeholder{color:#94A3B8 !important;opacity:1}
          .p{padding:24px}
          .wrap{max-width:1200px;margin:0 auto}
          .title{margin:0 0 12px;font-size:28px;font-weight:800;text-align:center; color:#E2E8F0;}
          .grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
          @media (max-width:980px){.grid{grid-template-columns:1fr}}

          .col{display:flex;flex-direction:column;gap:18px}
          .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px;box-shadow:0 8px 24px rgba(0,0,0,.3)}
          .cardTitle{font-size:13px;font-weight:800;color:#E2E8F0;margin-bottom:8px}
          .cardTitleRow{display:flex;align-items:center;gap:10px;justify-content:space-between;margin-bottom:8px}
          .textarea{width:100%;min-height:140px;padding:12px 14px;color:#E2E8F0}
          .textarea.mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,Monaco,monospace}
          .row{display:flex;align-items:center}
          .end{justify-content:flex-end}
          .gap{gap:10px}
          .gapTop{margin-top:10px}
          .btn{border:1px solid var(--line);background:#262626;padding:10px 14px;border-radius:12px;cursor:pointer;color:#E2E8F0;}
          .btn.tiny{padding:6px 10px;border-radius:10px;font-size:12px}
          .btn.primary{background:linear-gradient(135deg,#e5e5e5,#9ca3af);color:#121212;border:none;}
          .btn[disabled]{opacity:.6;cursor:not-allowed}
          .err{margin-top:10px;color:#ef4444}
          .note{margin-top:10px;color:#22c55e}
          .muted{color:var(--muted)}
          .small{font-size:12px}

          .infoGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
          .summaryGrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
          @media (max-width:900px){.summaryGrid{grid-template-columns:1fr}}

          .ibox{border:1px solid var(--line);border-radius:12px;padding:10px 12px;background:#262626;min-height:52px}
          .lblSmall{font-size:11px;color:#94A3B8;margin-bottom:4px}
          .input{width:100%;border:1px solid #a3a3a3;border-radius:10px;padding:8px 10px;background:#262626;color:#E2E8F0}
          .cardsRow{display:flex;gap:8px;align-items:center}
          .boardRow{display:flex;gap:8px;align-items:center;margin-top:6px}
          .pillLbl{font-size:12px;color:#94A3B8;min-width:40px;text-align:right}

          .cardInput{width:64px;text-align:center;border:1px solid #a3a3a3;border-radius:10px;padding:8px 8px;background:#262626;color:#E2E8F0}
          .cardInput:focus{outline:2px solid #d4d4d4}
          .cardEcho{margin-left:6px;font-size:14px}

          .hint{margin-top:8px;font-size:12px;color:#94A3B8}
          .chip{border:1px solid var(--line);border-radius:999px;padding:6px 10px;font-size:12px;background:#333}
          .chip.small{padding:4px 8px;font-size:11px}

          .feSprGrid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
          @media (max-width:900px){.feSprGrid{grid-template-columns:1fr}}
          .box{border:1px solid var(--line);border-radius:12px;padding:10px}
          .boxTitle{font-size:12px;font-weight:700;margin-bottom:6px;color:#E2E8F0}
          .grid2{display:grid;grid-template-columns:120px 1fr;gap:8px;align-items:center}
          .lbl{font-size:12px;color:#94A3B8}
          .calcLine{margin-top:8px}
          .sprChips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
          .list{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px}

          .gtoBox{border:1px dashed #525252;border-radius:12px;background:#1e1e1e;padding:12px;color:#CBD5E1}
          .gtoBody{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,Monaco,monospace;font-size:13.5px;line-height:1.45}
          .gtoLine{margin:2px 0}
          .gtoHead{font-weight:800;color:#E2E8F0}
          .gtoBullet{margin:2px 0 2px 12px}
          .concept-highlight{color:#60a5fa;font-weight:700}
          
          .learning-tags-container{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}
          .learning-tag{display:inline-block;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:600;border:2px solid;cursor:pointer;transition:all 0.2s}
          .learning-tag:hover{transform:translateY(-2px);filter:brightness(1.2)}
          .tag-blue{background:#1e3a8a;border-color:#3b82f6;color:#93c5fd}
          .tag-purple{background:#581c87;border-color:#a855f7;color:#d8b4fe}
          .tag-orange{background:#7c2d12;border-color:#f97316;color:#fdba74}
          .tag-green{background:#14532d;border-color:#22c55e;color:#86efac}
          .tag-red{background:#7f1d1d;border-color:#ef4444;color:#fca5a5}
          .tag-yellow{background:#713f12;border-color:#eab308;color:#fde047}
          .tag-gray{background:#374151;border-color:#9ca3af;color:#d1d5db}

          /* Exploit Signals Styles */
          .exploit-icons{display:flex;gap:16px;justify-content:center;flex-wrap:wrap}
          .exploit-icon-wrapper{position:relative}
          .exploit-icon{display:flex;flex-direction:column;align-items:center;padding:12px 20px;border:1px solid var(--line);border-radius:12px;background:#262626;cursor:pointer;transition:all 0.2s}
          .exploit-icon:hover{background:#333;transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,0.3)}
          .exploit-emoji{font-size:28px;margin-bottom:4px}
          .exploit-name{font-size:12px;color:#E2E8F0;font-weight:600}
          .exploit-popup{position:absolute;top:100%;left:50%;transform:translateX(-50%);width:280px;background:#1e1e1e;border:1px solid var(--line);border-radius:12px;padding:12px;opacity:0;visibility:hidden;transition:all 0.2s;z-index:100;margin-top:8px;box-shadow:0 8px 24px rgba(0,0,0,0.5)}
          .exploit-icon-wrapper:hover .exploit-popup{opacity:1;visibility:visible}
          .exploit-popup-title{font-size:14px;font-weight:700;color:#E2E8F0;margin-bottom:8px}
          .exploit-popup-desc{font-size:11px;color:#94A3B8;margin-bottom:12px}
          .exploit-street{font-size:12px;color:#E2E8F0;margin-bottom:8px;padding-left:8px;border-left:2px solid #525252}
          .exploit-gto{color:#94A3B8}
          .exploit-arrow{font-weight:700}
          .exploit-arrow.increase{color:#22c55e}
          .exploit-arrow.decrease{color:#ef4444}
          .exploit-arrow.same{color:#94A3B8}
          .exploit-reason{font-size:11px;color:#60a5fa;margin-top:2px}
          .exploit-advice{font-size:11px;color:#fde047;margin-top:12px;padding-top:8px;border-top:1px solid #525252}
        `}</style>
      </main>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ibox platinum-inner-border">
      <div className="lblSmall">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function CardEditor({
  value, onChange, placeholder
}: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [local, setLocal] = useState<string>(value || '');
  useEffect(() => { setLocal(value || ''); }, [value]);

  const norm = suitifyToken(local);
  const echo = norm
    ? <CardText c={norm} />
    : <span style={{ color: '#9ca3af' }}>{placeholder || ''}</span>;

  return (
    <div style={{ display: 'flex', alignItems: 'center' }}>
      <input
        className="cardInput input-ony platinum-inner-border"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => onChange(suitifyToken(local))}
        placeholder={placeholder || 'A♠'}
      />
      <div className="cardEcho" title="Normalized">{echo}</div>
    </div>
  );
}
