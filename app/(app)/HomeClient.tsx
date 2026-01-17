// app/(app)/HomeClient.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import "@/styles/onlypoker-theme.css";
import { createClient } from '@/lib/supabase/client';
import { Capacitor } from '@capacitor/core';

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
  notes?: string | null; // User notes for the hand
  mistakes?: {
    decisions?: Array<{
      street: string;
      play_quality: 'optimal' | 'acceptable' | 'mistake';
      hero_action?: string;
      decision_point?: string;
    }>;
  } | null;
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

// ═══════════════════════════════════════════════════════════════════════════
// ADVANCED OPTIONS CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const TABLE_FORMATS = {
  'HU': { label: 'Heads-Up (2)', positions: ['BTN', 'BB'] },
  '6max': { label: '6-Max', positions: ['BTN', 'CO', 'HJ', 'UTG', 'SB', 'BB'] },
  '9max': { label: '9-Max', positions: ['BTN', 'CO', 'HJ', 'MP', 'UTG+2', 'UTG+1', 'UTG', 'SB', 'BB'] }
} as const;

const ACTION_TYPES = [
  { value: 'RFI', label: 'RFI (Opening)' },
  { value: 'facing_open', label: 'Facing Open' },
  { value: 'vs_3bet', label: 'Facing 3-Bet' },
  { value: 'vs_4bet', label: 'Facing 4-Bet' },
  { value: 'general', label: 'Auto-Detect (General)' }
] as const;

const SUITS_CONFIG = [
  { value: '♠', label: '♠', color: '#111827' },
  { value: '♥', label: '♥', color: '#dc2626' },
  { value: '♦', label: '♦', color: '#dc2626' },
  { value: '♣', label: '♣', color: '#111827' }
] as const;

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

  // Normalize: abbreviations and 9-max support
  let text = t;
  // Common abbreviations → standard names
  text = text.replace(/\bbut\b/gi, 'button');
  text = text.replace(/\bcut\b/gi, 'cutoff');
  text = text.replace(/\bhi\b/gi, 'hijack');
  text = text.replace(/\bdealer\b/gi, 'button');
  text = text.replace(/\bsmall\b/gi, 'SB');
  text = text.replace(/\bbig\b/gi, 'BB');
  // 9-max abbreviations → standard format
  text = text.replace(/\butg1\b/gi, 'UTG+1');
  text = text.replace(/\butg2\b/gi, 'UTG+2');
  text = text.replace(/\bmiddle\b/gi, 'MP');
  text = text.replace(/\bmid\b/gi, 'MP');
  // Full words → abbreviations
  text = text.replace(/\b(otb|on the button)\b/gi, 'BTN');
  text = text.replace(/\b(button)\b/gi, 'BTN');
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

  // Pattern 3: Rank abbreviations with context (e.g., "i got KK", "with AK", "with KJs")
  // CRITICAL: Require context words to avoid matching blinds like "1k-2k-2k"
  // UPDATED: Now captures optional 's' or 'o' suffix for suited/offsuit
  const abbrMatch = s.match(/\b(?:hero|i|holding|with|have|has|got)\b[^.\n]{0,30}?([akqjt2-9]{2})([so])?\b/i);
  if (abbrMatch) {
    const ranks = abbrMatch[1].toUpperCase();
    const suitedness = abbrMatch[2]; // 's', 'o', or undefined
    const afterRanks = s.slice(abbrMatch.index! + abbrMatch[0].length);

    // Handle explicit 's' or 'o' suffix
    if (suitedness === 's') {
      // Suited: Both same suit
      return prettyCards(`${ranks[0]}s ${ranks[1]}s`);
    } else if (suitedness === 'o') {
      // Offsuit: Different suits
      return prettyCards(`${ranks[0]}s ${ranks[1]}d`);
    } else {
      // No suffix - check for other indicators or default to offsuit
      let suit1 = 's', suit2 = 'd'; // Default offsuit

      // Check for specific suit indicators immediately after ranks
      if (/^\s*(dd|diamonds?)/i.test(afterRanks)) {
        suit1 = suit2 = 'd'; // Both diamonds
      } else if (/^\s*(hh|hearts?)/i.test(afterRanks)) {
        suit1 = suit2 = 'h'; // Both hearts
      } else if (/^\s*(cc|clubs?)/i.test(afterRanks)) {
        suit1 = suit2 = 'c'; // Both clubs
      } else if (/^\s*(suited|ss|spades?)/i.test(afterRanks)) {
        suit1 = suit2 = 's'; // Both spades
      }

      return prettyCards(`${ranks[0]}${suit1} ${ranks[1]}${suit2}`);
    }
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

function renderGTO(text: string, mistakes?: Fields['mistakes']) {
  const lines = (text || '').split(/\r?\n/).filter(l => l.trim().length);

  // Robot watermark SVG component
  const robotWatermark = (
    <div className="gto-watermark">
      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="robotWatermarkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: '#e0e0e0' }} />
            <stop offset="25%" style={{ stopColor: '#909090' }} />
            <stop offset="50%" style={{ stopColor: '#d0d0d0' }} />
            <stop offset="75%" style={{ stopColor: '#707070' }} />
            <stop offset="100%" style={{ stopColor: '#a0a0a0' }} />
          </linearGradient>
        </defs>
        {/* Robot Head */}
        <rect x="5" y="6" width="14" height="12" rx="2" stroke="url(#robotWatermarkGradient)" strokeWidth="1.5" fill="none" />
        {/* Antenna */}
        <line x1="12" y1="6" x2="12" y2="3" stroke="url(#robotWatermarkGradient)" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="12" cy="2" r="1" fill="url(#robotWatermarkGradient)" />
        {/* Eyes */}
        <circle cx="9" cy="11" r="1.5" fill="url(#robotWatermarkGradient)" />
        <circle cx="15" cy="11" r="1.5" fill="url(#robotWatermarkGradient)" />
        {/* Mouth */}
        <rect x="9" y="14" width="6" height="2" rx="0.5" fill="url(#robotWatermarkGradient)" />
        {/* Ears */}
        <rect x="3" y="9" width="2" height="4" rx="0.5" fill="url(#robotWatermarkGradient)" />
        <rect x="19" y="9" width="2" height="4" rx="0.5" fill="url(#robotWatermarkGradient)" />
      </svg>
    </div>
  );

  // Empty state - just show the robot centered (no animations)
  if (!lines.length) return (
    <div className="gto-box-content gto-empty">
      {robotWatermark}
    </div>
  );

  // Street headers that should be color-coded
  const STREET_HEADERS = new Set(['PREFLOP', 'FLOP', 'TURN', 'RIVER']);

  // Build street color map from hero's actual play classification
  const streetColors: { [key: string]: string } = {};


  if (mistakes?.decisions && mistakes.decisions.length > 0) {
    // Use hero's actual play quality from classification decisions
    for (const decision of mistakes.decisions) {
      const street = decision.street?.toUpperCase();
      if (street && STREET_HEADERS.has(street)) {
        // Map play_quality to color class
        if (decision.play_quality === 'optimal') {
          streetColors[street] = 'street-optimal';
        } else if (decision.play_quality === 'acceptable') {
          streetColors[street] = 'street-acceptable';
        } else if (decision.play_quality === 'mistake') {
          streetColors[street] = 'street-mistake';
        }
      }
    }
  }

  // Get color class for a street header
  const getStreetColorClass = (street: string): string => {
    return streetColors[street.toUpperCase()] || '';
  };

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

  // Colorize Hero (blue) and Villain (red) text
  const colorizeText = (text: string): React.ReactNode[] => {
    // Split by Hero and Villain keywords, preserving the delimiters
    const parts = text.split(/(Hero|Villain)/gi);
    return parts.map((part, idx) => {
      const lower = part.toLowerCase();
      if (lower === 'hero') {
        return <span key={idx} className="hero-text">{part}</span>;
      }
      if (lower === 'villain') {
        return <span key={idx} className="villain-text">{part}</span>;
      }
      return part;
    });
  };

  return (
    <div className="gto-box-content">
      {robotWatermark}
      <div className="gtoBody">
        {lines.map((raw, i) => {
          const line = raw.trim();

          // Handle markdown bold format: **PREFLOP (Initial):** etc.
          // Strip asterisks for matching, keep for display
          const cleanLine = line.replace(/\*\*/g, '');
          const m = cleanLine.match(/^([A-Z][A-Z ]+)(?:\s*\([^)]+\))?:\s*(.*)$/);

          // Check if this is a street header (PREFLOP, FLOP, TURN, RIVER)
          if (m) {
            const headerWord = m[1].trim().split(' ')[0]; // Get first word (PREFLOP from "PREFLOP (Initial)")
            const isStreetHeader = STREET_HEADERS.has(headerWord);

            if (isStreetHeader || SECTION_HEADS.has(m[1].trim())) {
              const colorClass = isStreetHeader ? getStreetColorClass(headerWord) : '';
              const fullHeaderMatch = cleanLine.match(/^([A-Z][A-Z ]+(?:\s*\([^)]+\))?):/);
              const fullHeader = fullHeaderMatch ? fullHeaderMatch[1] : m[1];

              return (
                <div key={i} className={`gtoLine ${colorClass}`}>
                  <strong className={`gtoHead ${colorClass}`}>{fullHeader}:</strong>
                  {m[2] ? <span className="gtoText"> {colorizeText(m[2])}</span> : null}
                </div>
              );
            }
          }

          // Bullet points - apply Hero/Villain coloring
          if (/^[-•└]/.test(line)) {
            return <div key={i} className="gtoBullet gto-platinum-text">{colorizeText(line.replace(/^\s*/, ''))}</div>;
          }

          // Highlight concepts in regular text
          const highlighted = highlightConcepts(line);
          if (highlighted.includes('**')) {
            const parts = highlighted.split(/\*\*/);
            return (
              <div key={i} className="gtoLine gto-platinum-text">
                {parts.map((part, j) =>
                  j % 2 === 1 ? <strong key={j} className="concept-highlight">{part}</strong> : colorizeText(part)
                )}
              </div>
            );
          }

          return <div key={i} className="gtoLine gto-platinum-text">{colorizeText(line)}</div>;
        })}
      </div>
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

  // Native app detection for mobile-specific layouts
  const isNativeApp = typeof window !== 'undefined' && Capacitor.isNativePlatform();

  // ════════════════════════════════════════════════════════════════════════════
  // SESSION MODE STATE
  // ════════════════════════════════════════════════════════════════════════════
  interface Session { id: string; name: string; hand_count?: number; }
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null);
  const [sessionElapsed, setSessionElapsed] = useState<string>('00:00');
  const [sessionHandCount, setSessionHandCount] = useState(0);
  const [currentHandSaved, setCurrentHandSaved] = useState(false);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const [recentSessions, setRecentSessions] = useState<Session[]>([]);
  const [newSessionName, setNewSessionName] = useState('');
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Toast notification state
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });

  // Show toast with auto-dismiss
  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 2500);
  };

  // Session timer effect
  useEffect(() => {
    if (!sessionStartTime) {
      setSessionElapsed('00:00');
      return;
    }
    const interval = setInterval(() => {
      const diff = Date.now() - sessionStartTime.getTime();
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setSessionElapsed(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

  // Load active session from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('activeSession');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setActiveSession(parsed.session);
        setSessionStartTime(new Date(parsed.startTime));
        setSessionHandCount(parsed.handCount || 0);
      } catch { }
    }
  }, []);

  // Persist active session to localStorage
  useEffect(() => {
    if (activeSession && sessionStartTime) {
      localStorage.setItem('activeSession', JSON.stringify({
        session: activeSession,
        startTime: sessionStartTime.toISOString(),
        handCount: sessionHandCount
      }));
    } else {
      localStorage.removeItem('activeSession');
    }
  }, [activeSession, sessionStartTime, sessionHandCount]);

  // Fetch recent sessions when modal opens
  const fetchRecentSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch('/api/sessions');
      const data = await res.json();
      if (data.ok) setRecentSessions(data.sessions || []);
    } catch { }
    setLoadingSessions(false);
  };

  // Start a new session
  const startSession = async (name: string) => {
    try {
      const res = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (data.ok) {
        setActiveSession(data.session);
        setSessionStartTime(new Date());
        setSessionHandCount(0);
        setShowSessionModal(false);
        setNewSessionName('');
        showToast(`📁 Session "${name}" started`);
      }
    } catch { }
  };

  // Resume an existing session
  const resumeSession = (session: Session) => {
    setActiveSession(session);
    setSessionStartTime(new Date());
    setSessionHandCount(session.hand_count || 0);
    setShowSessionModal(false);
    showToast(`📁 Resumed "${session.name}"`);
  };

  // Exit current session
  const exitSession = async () => {
    if (activeSession) {
      // Mark session as inactive
      await fetch('/api/sessions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeSession.id, is_active: false })
      });
    }
    setActiveSession(null);
    setSessionStartTime(null);
    setSessionHandCount(0);
    showToast('Session ended');
  };

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
  const [villainPosition, setVillainPosition] = useState<string>('');

  // NEW: Table format and action type for Advanced Options redesign
  const [tableFormat, setTableFormat] = useState<'HU' | '6max' | '9max'>('6max');
  const [actionType, setActionType] = useState<string>('RFI');

  const [h1, setH1] = useState<string>('');   // hero card 1
  const [h2, setH2] = useState<string>('');   // hero card 2
  const [f1, setF1] = useState<string>('');   // flop 1
  const [f2, setF2] = useState<string>('');   // flop 2
  const [f3, setF3] = useState<string>('');   // flop 3
  const [tr, setTr] = useState<string>('');   // turn
  const [rv, setRv] = useState<string>('');   // river

  // Reset "saved" state when hand data changes (placed after h1/h2 are defined)
  useEffect(() => {
    setCurrentHandSaved(false);
  }, [input, fields, h1, h2]);

  // NEW: Interactive Preflop Action Builder
  interface PreflopAction {
    player: 'H' | 'V';
    action: 'raise' | 'call' | 'fold' | '3bet' | '4bet' | 'limp';
    amount?: number; // in bb
  }
  const [preflopActions, setPreflopActions] = useState<PreflopAction[]>([]);
  const [isAddingAction, setIsAddingAction] = useState(false);
  const [pendingPlayer, setPendingPlayer] = useState<'H' | 'V' | null>(null);
  const [pendingAction, setPendingAction] = useState<string>('');
  const [pendingAmount, setPendingAmount] = useState<string>('');

  // Calculate pot from preflop actions (starts with 1.5bb for SB+BB)
  const calculatePot = (actions: PreflopAction[]): number => {
    let pot = 1.5; // SB (0.5) + BB (1.0)
    for (const act of actions) {
      if (act.amount) pot += act.amount;
    }
    return pot;
  };

  // NEW: Postflop Action Builder for Flop
  interface PostflopAction {
    player: 'H' | 'V';
    action: 'check' | 'bet' | 'call' | 'raise' | 'fold';
    amount?: number; // in bb
  }
  // Flop actions
  const [flopActions, setFlopActions] = useState<PostflopAction[]>([]);
  const [isAddingFlopAction, setIsAddingFlopAction] = useState(false);
  const [pendingFlopPlayer, setPendingFlopPlayer] = useState<'H' | 'V' | null>(null);
  const [pendingFlopAction, setPendingFlopAction] = useState<string>('');
  const [pendingFlopAmount, setPendingFlopAmount] = useState<string>('');

  // Turn actions
  const [turnActions, setTurnActions] = useState<PostflopAction[]>([]);
  const [isAddingTurnAction, setIsAddingTurnAction] = useState(false);
  const [pendingTurnPlayer, setPendingTurnPlayer] = useState<'H' | 'V' | null>(null);
  const [pendingTurnAction, setPendingTurnAction] = useState<string>('');
  const [pendingTurnAmount, setPendingTurnAmount] = useState<string>('');

  // River actions
  const [riverActions, setRiverActions] = useState<PostflopAction[]>([]);
  const [isAddingRiverAction, setIsAddingRiverAction] = useState(false);
  const [pendingRiverPlayer, setPendingRiverPlayer] = useState<'H' | 'V' | null>(null);
  const [pendingRiverAction, setPendingRiverAction] = useState<string>('');
  const [pendingRiverAmount, setPendingRiverAmount] = useState<string>('');

  // Determine first actor postflop (OOP acts first)
  // Determine first actor postflop (OOP acts first)
  const getFirstActorPostflop = (): 'H' | 'V' => {
    // Special HU Logic: SB is Button, acts LAST postflop. BB acts FIRST.
    if (tableFormat === 'HU') {
      const heroPos = position || 'SB';
      const villainPos = villainPosition || 'BB';

      // If Hero is active (SB/low index) and Villain is BB (high index), SB acts LAST.
      // So if Hero=SB (Index 0), Villain=BB (Index 1) => Hero acts LAST ('V').
      // Logic: In HU, LOWER index (SB) acts LAST. HIGHER index (BB) acts FIRST.
      // Standard: Lower acts First.
      // HU: Lower acts Last.

      const positionOrder = ['SB', 'BB']; // Just need relative order
      const heroIndex = positionOrder.indexOf(heroPos) === -1 ? 0 : positionOrder.indexOf(heroPos); // Default to SB (0) if not found
      const villainIndex = positionOrder.indexOf(villainPos) === -1 ? 1 : positionOrder.indexOf(villainPos); // Default to BB (1) if not found

      // If Hero is SB (0) and Villain is BB (1):
      // Hero (0) < Villain (1). We want Hero to act LAST ('V').
      // So condition: if Hero < Villain => 'V' (Villain acts first).
      return heroIndex < villainIndex ? 'V' : 'H';
    }

    // Standard Ring Game Logic
    const positionOrder = ['SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'HJ', 'CO', 'BTN'];
    const heroPos = position || 'BTN';
    const villainPos = villainPosition || 'BB';
    const heroIndex = positionOrder.indexOf(heroPos);
    const villainIndex = positionOrder.indexOf(villainPos);
    // Lower index = more OOP, OOP acts first
    return heroIndex < villainIndex ? 'H' : 'V';
  };

  // Calculate total pot including all streets
  const calculateTotalPot = (): number => {
    let pot = calculatePot(preflopActions); // Start with preflop pot
    // Add flop bets/calls/raises
    for (const act of flopActions) {
      if (act.amount && (act.action === 'bet' || act.action === 'call' || act.action === 'raise')) {
        pot += act.amount;
      }
    }
    // Add turn bets/calls/raises
    for (const act of turnActions) {
      if (act.amount && (act.action === 'bet' || act.action === 'call' || act.action === 'raise')) {
        pot += act.amount;
      }
    }
    // Add river bets/calls/raises
    for (const act of riverActions) {
      if (act.amount && (act.action === 'bet' || act.action === 'call' || act.action === 'raise')) {
        pot += act.amount;
      }
    }
    return pot;
  };

  // Get all currently used cards (for duplicate prevention)
  const getUsedCards = (excludeField?: 'h1' | 'h2' | 'f1' | 'f2' | 'f3' | 'tr' | 'rv'): Set<string> => {
    const allCards = { h1, h2, f1, f2, f3, tr, rv };
    const cards = Object.entries(allCards)
      .filter(([field, card]) => card && field !== excludeField)
      .map(([_, card]) => card);
    return new Set(cards);
  };

  // Find the first available suit for a rank, with fallback order: ♠ → ♥ → ♦ → ♣
  const getFirstAvailableSuit = (rank: string, preferredSuit: string, excludeField: 'h1' | 'h2' | 'f1' | 'f2' | 'f3' | 'tr' | 'rv'): string | null => {
    if (!rank) return preferredSuit;
    const usedCards = getUsedCards(excludeField);
    const suitOrder = [preferredSuit, '♠', '♥', '♦', '♣'].filter((s, i, arr) => arr.indexOf(s) === i); // Remove duplicates, keep order
    for (const suit of suitOrder) {
      if (!usedCards.has(rank + suit)) {
        return suit;
      }
    }
    return null; // All suits taken for this rank
  };

  // Get counts of used ranks to disable them if all 4 suits are taken
  const getUsedRankCounts = (excludeField?: 'h1' | 'h2' | 'f1' | 'f2' | 'f3' | 'tr' | 'rv'): Record<string, number> => {
    const allCards = { h1, h2, f1, f2, f3, tr, rv };
    const counts: Record<string, number> = {};
    Object.entries(allCards).forEach(([field, card]) => {
      if (card && field !== excludeField) {
        const rank = card.slice(0, -1);
        counts[rank] = (counts[rank] || 0) + 1;
      }
    });
    return counts;
  };

  const [showAdvanced, setShowAdvanced] = useState(true); // Hand section open by default
  const [transparencyData, setTransparencyData] = useState<{
    assumptions: any[];
    confidence: number;
    message: string;
  } | null>(null); // Transparency metadata from API

  // ══════════════════════════════════════════════════════════════════════════
  // CORRECTION TRACKING: For data flywheel (Phase 3 of LLM Fallback system)
  // ══════════════════════════════════════════════════════════════════════════
  const [initialParsedState, setInitialParsedState] = useState<{
    heroPosition: string;
    heroCards: string;
    effectiveStack: string;
    capturedAt: number;
  } | null>(null);
  const [isAiFallback, setIsAiFallback] = useState(false);
  const [parsingConfidence, setParsingConfidence] = useState(0);

  // Track when user manually overrides via Advanced Options
  // Only log corrections when user explicitly changes something
  const [userOverrodeFields, setUserOverrodeFields] = useState<{
    position: boolean;
    cards: boolean;
    stack: boolean;
  }>({ position: false, cards: false, stack: false });

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

  // ══════════════════════════════════════════════════════════════════════════
  // CAPTURE INITIAL STATE: For correction logging (data flywheel)
  // ══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    // Capture initial parsed state when preview has meaningful data
    // Only capture once per input (when input changes significantly)
    if (!initialParsedState && (preview.position || preview.heroCards)) {
      setInitialParsedState({
        heroPosition: preview.position || '',
        heroCards: preview.heroCards || '',
        effectiveStack: eff || '100',
        capturedAt: Date.now()
      });
    }
  }, [preview.position, preview.heroCards, initialParsedState, eff]);

  // Reset initial state when input changes significantly
  useEffect(() => {
    if (input.length < 5) {
      setInitialParsedState(null);
    }
  }, [input]);

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

    // Use manually entered cards/board from Advanced Options if no preview data
    const manualHeroCards = [h1, h2].filter(Boolean).join('');
    const manualBoard = [
      [f1, f2, f3].filter(Boolean).length > 0 && `Flop: ${[f1, f2, f3].filter(Boolean).join(' ')}`,
      tr && `Turn: ${tr}`,
      rv && `River: ${rv}`,
    ].filter(Boolean).join('  |  ');

    const capturedBoard = preview.board.flop ? [
      preview.board.flop && `Flop: ${preview.board.flop}`,
      preview.board.turn && `Turn: ${preview.board.turn}`,
      preview.board.river && `River: ${preview.board.river}`,
    ].filter(Boolean).join('  |  ') : manualBoard;

    const capturedHeroCards = preview.heroCards || manualHeroCards || '';
    const capturedPosition = (preview.position || position || '').toUpperCase() || '';
    const capturedStakes = preview.stakes || stakes || '';
    const currentInput = input || '';
    const capturedActionHint = preview.action_hint || '';
    const capturedHandClass = derivedHandClass || '';

    // ══════════════════════════════════════════════════
    // STEP 1: IMMEDIATE CLEAR - Reset previous ANALYSIS data only
    // ══════════════════════════════════════════════════
    setFields(null);  // Clear old analysis results INSTANTLY
    setError(null);
    setStatus(null);
    // NOTE: We do NOT clear manual input fields (cards, position, board)
    // Those should persist until user explicitly clicks Clear


    // ══════════════════════════════════════════════════
    // STEP 2: LOADING STATE - Show user something is happening
    // ══════════════════════════════════════════════════
    setAiLoading(true);

    // ══════════════════════════════════════════════════
    // STEP 2.5: LOG CORRECTIONS (Data Flywheel)
    // ══════════════════════════════════════════════════
    // Compare initial parsed state vs what user is submitting
    // If different, log the correction for improvement analysis
    if (initialParsedState) {
      const finalState = {
        heroPosition: capturedPosition,
        heroCards: capturedHeroCards,
        effectiveStack: eff || '100'
      };

      // Check if user made any corrections via Advanced Options
      // Only count as correction if user MANUALLY changed something
      const hasUserOverride = userOverrodeFields.position || userOverrodeFields.cards || userOverrodeFields.stack;

      const hasCorrections = hasUserOverride && (
        initialParsedState.heroPosition !== finalState.heroPosition ||
        initialParsedState.heroCards !== finalState.heroCards ||
        initialParsedState.effectiveStack !== finalState.effectiveStack
      );

      if (hasCorrections) {
        // Fire-and-forget: Don't await, don't block analysis
        fetch('/api/system/log-correction', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            raw_input_text: currentInput,
            parser_output: {
              heroPosition: initialParsedState.heroPosition,
              heroCards: initialParsedState.heroCards,
              effectiveStack: parseInt(initialParsedState.effectiveStack) || 100
            },
            user_corrected: {
              heroPosition: finalState.heroPosition,
              heroCards: finalState.heroCards,
              effectiveStack: parseInt(finalState.effectiveStack) || 100
            },
            was_ai_fallback: isAiFallback,
            parsing_confidence: parsingConfidence
          })
        }).catch(err => console.warn('[Correction Log] Failed:', err));

        console.log('[Flywheel] Logged correction:', {
          from: initialParsedState,
          to: finalState,
          wasAiFallback: isAiFallback,
          overrodeFields: userOverrodeFields
        });
      }

      // Reset for next analysis
      setInitialParsedState(null);
      setUserOverrodeFields({ position: false, cards: false, stack: false });
    }

    try {
      // Build structured board from individual card fields
      const boardCards = [f1, f2, f3, tr, rv].filter(Boolean);

      // Use CAPTURED data from preview (parsed from input text)
      const payload = {
        date: today,
        stakes: stakes || capturedStakes || undefined, // Include stakes for future SPR/range adjustments
        position: capturedPosition || undefined,
        villain_position: villainPosition || undefined, // Villain position from Advanced Options
        cards: capturedHeroCards || undefined,
        board: capturedBoard || undefined,
        board_cards: boardCards.length > 0 ? boardCards : undefined, // Structured board array
        notes: currentInput || undefined,
        raw_text: currentInput || undefined, // API expects snake_case
        fe_hint: feNeeded || undefined,
        spr_hint: spr || undefined,
        action_hint: capturedActionHint || undefined,
        action_type: actionType || undefined, // User-selected action type from Advanced Options
        table_format: tableFormat || undefined, // Table format (HU/6max/9max)
        effective_stack: eff || undefined, // Effective Stack from input
        preflop_actions: preflopActions.length > 0 ? preflopActions : undefined, // Explicit preflop action chain
        flop_actions: flopActions.length > 0 ? flopActions : undefined, // Postflop: Flop actions
        turn_actions: turnActions.length > 0 ? turnActions : undefined, // Postflop: Turn actions
        river_actions: riverActions.length > 0 ? riverActions : undefined, // Postflop: River actions
        pot_size: (preflopActions.length > 0 || flopActions.length > 0) ? calculateTotalPot() : undefined, // Full pot calculation
        hand_class: undefined, // Recalculated by API
        source_used: 'STORY' // Using preview which parses from story
      };

      const r = await fetch('/api/coach/analyze-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-app-token': '7f8dc46687ee09ccbff411d4a1507bc08bfb97bf556430a95f5413b59bd780d0'
        },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        console.error('[HomeClient] API Error:', e);
        throw new Error(e?.details || e?.error || `Analyze failed (${r.status})`);
      }

      // ══════════════════════════════════════════════════
      // STEP 3: UPDATE - Set new data from API response
      // ══════════════════════════════════════════════════
      const data = await r.json();

      // DEBUG: Log what we received
      console.log('[HomeClient] API Response:', {
        transparency: data?.transparency,
        gto_strategy_preview: data?.gto_strategy?.substring(0, 200)
      });

      // Capture transparency metadata from API
      if (data?.transparency) {
        setTransparencyData(data.transparency);
      }


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
        source_used: 'STORY', // Using preview which parses from story
        mistakes: data?.mistakes || null  // Store play classification for street coloring
      });
    } catch (e: any) {
      setError(e?.message || 'Analyze error');
    } finally {
      setAiLoading(false);
    }
  }

  // Check if we have enough data to save (either fields from analysis OR hero cards from Hand Builder)
  const canSave = () => {
    // Can save if we have analysis results
    if (fields) return true;
    // Can save if we have hero cards from Hand Builder
    if (h1 && h2) return true;
    return false;
  };

  // ************** Session-aware save to Supabase **************
  async function saveToDb(isQuickSave = false) {
    if (!canSave()) return;
    setSaving(true); setStatus(null);
    try {
      // Build save payload - use fields if available, otherwise use Hand Builder state
      const today = new Date().toISOString().slice(0, 10);
      const heroCards = h1 && h2 ? `${h1} ${h2}` : (fields?.cards || '');
      const boardStr = [f1, f2, f3, tr, rv].filter(Boolean).join(' ') || (fields?.board || '');

      const savePayload = fields ? {
        ...fields,
        source: isQuickSave ? 'quick_save' : (activeSession ? 'manual' : 'quick_save'),
        session_id: isQuickSave ? null : activeSession?.id || null,
      } : {
        // Build from Hand Builder state when no analysis
        date: today,
        stakes: stakes || null,
        position: position || null,
        cards: heroCards || null,
        board: boardStr || null,
        hand_class: null,
        source_used: 'HAND_BUILDER',
        gto_strategy: null,
        exploit_deviation: null,
        exploit_signals: null,
        learning_tag: null,
        source: isQuickSave ? 'quick_save' : (activeSession ? 'manual' : 'quick_save'),
        session_id: isQuickSave ? null : activeSession?.id || null,
      };

      const r = await fetch('/api/hands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(savePayload),
      });
      const data = await r.json();
      if (!r.ok || !data?.ok) throw new Error(data?.error || 'Save failed');

      // Update state and show feedback
      setCurrentHandSaved(true);
      if (activeSession) {
        setSessionHandCount(c => c + 1);
        showToast(`✓ Saved to ${activeSession.name}`);
      } else {
        showToast('✓ Quick saved');
      }
    } catch (e: any) {
      setStatus(e?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  // Quick save handler (no session)
  const handleQuickSave = () => saveToDb(true);

  // Handle Note button click
  const handleNoteClick = () => {
    if (activeSession) {
      // Session active - one-click save
      saveToDb(false);
    } else {
      // No session - show modal
      fetchRecentSessions();
      setShowSessionModal(true);
    }
  };

  // Keyboard shortcut: Cmd+S / Ctrl+S to save
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (fields && !saving && !currentHandSaved) {
          if (activeSession) {
            saveToDb(false);
          } else {
            fetchRecentSessions();
            setShowSessionModal(true);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fields, saving, currentHandSaved, activeSession]);
  // *******************************************************************
  const suitColor = (suit: string) => (isRed(suit) ? '#ef4444' : '#e5e7eb'); // Platinum for black suits

  return (
    <div className="op-surface">
      {/* Subtle background pattern */}
      <div className="dashboard-bg-pattern" />

      <main className="p">
        <div className="wrap">
          {/* Header - Premium Animated Design */}
          <div style={{ textAlign: 'center', marginBottom: 40, marginTop: 20 }}>
            <h1 className="homepage-title">Only Poker</h1>

            {/* Card Suit Decorations with Shimmer */}
            <div className="suit-decoration">
              <span>♠</span>
              <span>♥</span>
              <span>♦</span>
              <span>♣</span>
            </div>
          </div>

          {/* Top-right User Profile Pill */}
          {userEmail && (
            <div className="user-profile-pill">
              <span className="preview-badge-pill">Preview</span>
              <span className="user-avatar">{userEmail.charAt(0)}</span>
              <span className="user-email-text">{userEmail}</span>
            </div>
          )}

          {/* Session Bar - shows when session is active */}
          {activeSession && (
            <div className="session-bar">
              <div className="session-bar-left">
                <span className="session-icon">📁</span>
                <span className="session-name">{activeSession.name}</span>
              </div>
              <div className="session-bar-center">
                <span className="session-timer-icon">🕐</span>
                <span className="session-timer">{sessionElapsed}</span>
                <span className="session-divider">•</span>
                <span className="session-count">{sessionHandCount} hands</span>
              </div>
              <button className="session-exit-btn" onClick={exitSession}>
                Exit Session
              </button>
            </div>
          )}

          {/* Toast notification */}
          {toast.visible && (
            <div className="toast-notification">
              {toast.message}
            </div>
          )}

          {/* Session Modal */}
          {showSessionModal && (
            <div className="session-modal-overlay" onClick={() => setShowSessionModal(false)}>
              <div className="session-modal" onClick={(e) => e.stopPropagation()}>
                <div className="session-modal-header">
                  <h3>Save Hand</h3>
                  <button className="session-modal-close" onClick={() => setShowSessionModal(false)}>×</button>
                </div>

                <div className="session-modal-options">
                  <button className="session-option quick-save" onClick={() => { handleQuickSave(); setShowSessionModal(false); }}>
                    <span className="option-icon">⚡</span>
                    <span className="option-label">Quick Save</span>
                    <span className="option-hint">One-off save, no session</span>
                  </button>

                  <div className="session-option-divider">or</div>

                  <div className="session-start-new">
                    <span className="option-icon">📁</span>
                    <input
                      type="text"
                      className="session-name-input"
                      value={newSessionName}
                      onChange={(e) => setNewSessionName(e.target.value)}
                      placeholder="Session name (e.g., Sunday Grind)"
                      onKeyDown={(e) => e.key === 'Enter' && newSessionName.trim() && startSession(newSessionName.trim())}
                    />
                    <button
                      className="session-start-btn"
                      onClick={() => newSessionName.trim() && startSession(newSessionName.trim())}
                      disabled={!newSessionName.trim()}
                    >
                      Start
                    </button>
                  </div>
                </div>

                {recentSessions.length > 0 && (
                  <div className="session-recent">
                    <div className="session-recent-header">Recent Sessions</div>
                    <div className="session-recent-list">
                      {recentSessions.slice(0, 5).map((session) => (
                        <button
                          key={session.id}
                          className="session-recent-item"
                          onClick={() => resumeSession(session)}
                        >
                          <span className="recent-name">{session.name}</span>
                          <span className="recent-count">{session.hand_count || 0} hands</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {loadingSessions && (
                  <div className="session-loading">Loading sessions...</div>
                )}
              </div>
            </div>
          )}

          <div className="grid">
            {/* LEFT column */}
            <div className="col ony-left-bg">
              {/* Story box - TEMPORARILY HIDDEN */}
              {false && <section className="card ony-card platinum-container-frame">
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
                    className="btn btn-platinum-premium btn-analyze-premium"
                    style={{ flex: 1 }}
                    onClick={analyze}
                    disabled={aiLoading || (!input.trim() && !(h1 && h2 && preflopActions.length > 0))}
                  >
                    <span className="btn-text">{aiLoading ? 'Analyzing…' : '✨ Analyze Hand'}</span>
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

                {/* Live Preview Chips */}
                {(preview.position || preview.stakes || preview.heroCards || preview.board.flop) && (
                  <div className="parsed-preview">
                    {preview.position && <span className="preview-chip">📍 {preview.position}</span>}
                    {preview.stakes && <span className="preview-chip">💰 {preview.stakes}</span>}
                    {preview.heroCards && <span className="preview-chip">🃏 {preview.heroCards}</span>}
                    {preview.board.flop && <span className="preview-chip">🎲 Flop: {preview.board.flop}</span>}
                    {preview.board.turn && <span className="preview-chip">Turn: {preview.board.turn}</span>}
                    {preview.board.river && <span className="preview-chip">River: {preview.board.river}</span>}
                  </div>
                )}

                {/* Transparency Warning - Live Preview (shows AS YOU TYPE) */}
                {(preview.position || preview.stakes || preview.heroCards || preview.board.flop) && (
                  <div className="transparency-note">
                    <div className="transparency-header">
                      <span className="transparency-icon">💡</span>
                      <span className="transparency-title">
                        {transparencyData
                          ? `Analysis used (Confidence: ${transparencyData?.confidence ?? 'N/A'}%)`
                          : 'Will detect from your story:'}
                      </span>
                    </div>

                    {/* Show API transparency if available, otherwise show preview */}
                    {transparencyData?.message ? (
                      <>
                        <div className="transparency-message">
                          {transparencyData?.message}
                        </div>
                        <div className="transparency-items">
                          {transparencyData?.assumptions?.map((assumption: any, idx: number) => {
                            const emoji = assumption.source === 'inferred' ? '🔍'
                              : assumption.source === 'defaulted' ? '📊'
                                : '✅';
                            const className = assumption.source === 'inferred' ? 'inferred'
                              : assumption.source === 'defaulted' ? 'defaulted'
                                : 'detected';

                            return (
                              <div key={idx} className={`transparency-item ${className}`} title={assumption.reasoning}>
                                {emoji} <strong>{assumption.field}:</strong> {String(assumption.value)}
                                <span className="transparency-confidence">({assumption.confidence}%)</span>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : (
                      <div className="transparency-items">
                        {preview.position && <span className="transparency-item detected">✅ Position: {preview.position}</span>}
                        {preview.stakes && <span className="transparency-item detected">✅ Stakes: {preview.stakes}</span>}
                        {preview.heroCards && <span className="transparency-item detected">✅ Hero Cards: {preview.heroCards}</span>}
                        {preview.board.flop && <span className="transparency-item detected">✅ Board: {preview.board.flop}{preview.board.turn ? ` ${preview.board.turn}` : ''}{preview.board.river ? ` ${preview.board.river}` : ''}</span>}

                        {/* Show what will be ASSUMED */}
                        {!preview.stakes && <span className="transparency-item defaulted">📊 Effective Stack: 100bb (will default)</span>}
                        <span className="transparency-item inferred">🔍 Opponent Position: Will auto-detect from story</span>
                        <span className="transparency-item inferred">🔍 Bet Sizing: Will estimate from story</span>
                      </div>
                    )}

                    <div className="transparency-hint">
                      💡 Click "Advanced Options" to override any assumptions
                    </div>
                  </div>
                )}
              </section>}

              {/* Hand Input (Always Visible) */}
              <section className="card ony-card platinum-container-frame glass-card">
                <div className="section-header section-accent-gold">
                  <span className="section-header-icon">✍️</span>
                  <span className="section-header-title">Hand Builder</span>
                </div>
                <div className="hand-content">
                  {/* Row 1: Table Format + Position */}
                  <div style={{ display: 'grid', gridTemplateColumns: isNativeApp ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div className="ibox platinum-inner-border">
                      <div className="lblSmall">Table Format</div>
                      <div style={{ display: 'flex', alignItems: 'center', background: '#1f1f1f', borderRadius: '8px', padding: '6px 10px', border: '1px solid #3a3a3a' }}>
                        <select
                          className="option-selector"
                          value={tableFormat}
                          onChange={(e) => setTableFormat(e.target.value as 'HU' | '6max' | '9max')}
                          style={{ appearance: 'none', WebkitAppearance: 'none', background: 'transparent', border: 'none', fontSize: '14px', fontWeight: 500, color: '#e5e7eb', cursor: 'pointer', width: '100%', outline: 'none' }}
                        >
                          {Object.entries(TABLE_FORMATS).map(([key, val]) => (
                            <option key={key} value={key}>{val.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="ibox platinum-inner-border">
                      <div className="lblSmall">Villain Position</div>
                      <div style={{ display: 'flex', alignItems: 'center', background: '#1f1f1f', borderRadius: '8px', padding: '6px 10px', border: '1px solid #3a3a3a' }}>
                        <select
                          className="option-selector"
                          value={villainPosition}
                          onChange={(e) => { setVillainPosition(e.target.value); setUserOverrodeFields(prev => ({ ...prev, position: true })); }}
                          style={{ appearance: 'none', WebkitAppearance: 'none', background: 'transparent', border: 'none', fontSize: '14px', fontWeight: 500, color: '#e5e7eb', cursor: 'pointer', width: '100%', outline: 'none' }}
                        >
                          <option value="">(auto-detect)</option>
                          {TABLE_FORMATS[tableFormat].positions.map((pos) => (
                            <option key={pos} value={pos}>{pos}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Action Type + Effective Stack */}
                  <div style={{ display: 'grid', gridTemplateColumns: isNativeApp ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div className="ibox platinum-inner-border">
                      <div className="lblSmall">Action Type</div>
                      <div style={{ display: 'flex', alignItems: 'center', background: '#1f1f1f', borderRadius: '8px', padding: '6px 10px', border: '1px solid #3a3a3a' }}>
                        <select
                          className="option-selector"
                          value={actionType}
                          onChange={(e) => setActionType(e.target.value)}
                          style={{ appearance: 'none', WebkitAppearance: 'none', background: 'transparent', border: 'none', fontSize: '14px', fontWeight: 500, color: '#e5e7eb', cursor: 'pointer', width: '100%', outline: 'none' }}
                        >
                          {ACTION_TYPES.map((at) => (
                            <option key={at.value} value={at.value}>{at.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="ibox platinum-inner-border">
                      <div className="lblSmall">Effective Stack (bb)</div>
                      <div style={{ display: 'flex', alignItems: 'center', background: '#1f1f1f', borderRadius: '8px', padding: '6px 10px', border: '1px solid #3a3a3a' }}>
                        <input
                          className="option-selector"
                          value={eff}
                          onChange={e => { setEff(e.target.value); setUserOverrodeFields(prev => ({ ...prev, stack: true })); }}
                          placeholder="100"
                          style={{ background: 'transparent', border: 'none', fontSize: '14px', fontWeight: 500, color: '#e5e7eb', width: '100%', outline: 'none' }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Hero Hand + Hero Position */}
                  <div style={{ display: 'grid', gridTemplateColumns: isNativeApp ? '1fr' : '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    {/* Hero Hand - Card selectors */}
                    <div className="ibox platinum-inner-border">
                      <div className="lblSmall">Hero Hand</div>
                      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'flex-start', padding: '4px 0' }}>
                        {/* Card 1 - Premium Playing Card Style */}
                        <div className="hero-card-input">
                          <select
                            value={h1 ? h1.slice(0, -1) : ''}
                            onChange={(e) => {
                              if (!e.target.value) {
                                setH1('');
                                setUserOverrodeFields(prev => ({ ...prev, cards: true }));
                                return;
                              }
                              const preferredSuit = h1 ? h1.slice(-1) : '♠';
                              const availableSuit = getFirstAvailableSuit(e.target.value, preferredSuit, 'h1');
                              if (availableSuit) {
                                setH1(e.target.value + availableSuit);
                                setUserOverrodeFields(prev => ({ ...prev, cards: true }));
                              }
                            }}
                            className="rank-selector"
                            title="Select rank"
                          >
                            <option value="">🂠</option>
                            {(() => {
                              const rankCounts = getUsedRankCounts('h1');
                              return RANKS.map(r => {
                                const disabled = (rankCounts[r] || 0) >= 4;
                                return <option key={r} value={r} disabled={disabled} style={{ color: disabled ? '#666' : undefined }}>{r}</option>;
                              });
                            })()}
                          </select>
                          <select
                            value={h1 ? h1.slice(-1) : ''}
                            onChange={(e) => {
                              const rank = h1 ? h1.slice(0, -1) : '';
                              const newCard = (rank || 'A') + e.target.value;
                              const usedCards = getUsedCards('h1');
                              if (e.target.value && !usedCards.has(newCard)) {
                                setH1(newCard);
                                setUserOverrodeFields(prev => ({ ...prev, cards: true }));
                              }
                            }}
                            className={`suit-selector ${h1 && isRed(h1.slice(-1)) ? 'suit-red' : ''}`}
                            title="Select suit"
                          >
                            <option value="">?</option>
                            {(() => {
                              const rank = h1 ? h1.slice(0, -1) : '';
                              const usedCards = getUsedCards('h1');
                              return SUITS_CONFIG.map(s => {
                                const wouldBe = rank + s.value;
                                const isUsed = !!(rank && usedCards.has(wouldBe));
                                return <option key={s.value} value={s.value} disabled={isUsed} style={{ color: isUsed ? '#666' : undefined }}>{s.label}</option>;
                              });
                            })()}
                          </select>
                        </div>

                        {/* Card 2 - Premium Playing Card Style */}
                        <div className="hero-card-input">
                          <select
                            value={h2 ? h2.slice(0, -1) : ''}
                            onChange={(e) => {
                              if (!e.target.value) {
                                setH2('');
                                setUserOverrodeFields(prev => ({ ...prev, cards: true }));
                                return;
                              }
                              const preferredSuit = h2 ? h2.slice(-1) : '♠';
                              const availableSuit = getFirstAvailableSuit(e.target.value, preferredSuit, 'h2');
                              if (availableSuit) {
                                setH2(e.target.value + availableSuit);
                                setUserOverrodeFields(prev => ({ ...prev, cards: true }));
                              }
                            }}
                            className="rank-selector"
                            title="Select rank"
                          >
                            <option value="">🂠</option>
                            {(() => {
                              const rankCounts = getUsedRankCounts('h2');
                              return RANKS.map(r => {
                                const disabled = (rankCounts[r] || 0) >= 4;
                                return <option key={r} value={r} disabled={disabled} style={{ color: disabled ? '#666' : undefined }}>{r}</option>;
                              });
                            })()}
                          </select>
                          <select
                            value={h2 ? h2.slice(-1) : ''}
                            onChange={(e) => {
                              const rank = h2 ? h2.slice(0, -1) : '';
                              const newCard = (rank || 'A') + e.target.value;
                              const usedCards = getUsedCards('h2');
                              if (e.target.value && !usedCards.has(newCard)) {
                                setH2(newCard);
                                setUserOverrodeFields(prev => ({ ...prev, cards: true }));
                              }
                            }}
                            className={`suit-selector ${h2 && isRed(h2.slice(-1)) ? 'suit-red' : ''}`}
                            title="Select suit"
                          >
                            <option value="">?</option>
                            {(() => {
                              const rank = h2 ? h2.slice(0, -1) : '';
                              const usedCards = getUsedCards('h2');
                              return SUITS_CONFIG.map(s => {
                                const wouldBe = rank + s.value;
                                const isUsed = !!(rank && usedCards.has(wouldBe));
                                return <option key={s.value} value={s.value} disabled={isUsed} style={{ color: isUsed ? '#666' : undefined }}>{s.label}</option>;
                              });
                            })()}
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Hero Position dropdown */}
                    <div className="ibox platinum-inner-border">
                      <div className="lblSmall">Hero Position</div>
                      <div style={{ display: 'flex', alignItems: 'center', background: '#1f1f1f', borderRadius: '8px', padding: '6px 10px', border: '1px solid #3a3a3a' }}>
                        <select
                          className="option-selector"
                          value={position}
                          onChange={(e) => { setPosition(e.target.value); setUserOverrodeFields(prev => ({ ...prev, position: true })); }}
                          style={{ appearance: 'none', WebkitAppearance: 'none', background: 'transparent', border: 'none', fontSize: '14px', fontWeight: 500, color: '#e5e7eb', cursor: 'pointer', width: '100%', outline: 'none' }}
                        >
                          <option value="">{preview.position || '(auto-detect)'}</option>
                          {TABLE_FORMATS[tableFormat].positions.map((pos) => (
                            <option key={pos} value={pos}>{pos}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                  {/* CSS for hover shine effect */}
                  <style>{`
                      .rank-selector, .suit-selector, .option-selector {
                        transition: filter 0.15s ease, text-shadow 0.15s ease;
                      }
                      .rank-selector:hover, .suit-selector:hover, .option-selector:hover {
                        filter: brightness(1.3);
                        text-shadow: 0 0 8px rgba(200, 200, 200, 0.6);
                      }
                    `}</style>

                  {/* Row 4: Board (optional) - Same style as Hero Hand */}
                  <div className="ibox platinum-inner-border">
                    <div className="lblSmall">Board (optional - leave empty for preflop)</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {/* Preflop Action Builder */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <span style={{ width: '40px', color: '#9ca3af', fontSize: '12px' }}>Preflop</span>

                          {/* Render existing actions as chips */}
                          {preflopActions.map((act, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '2px',
                                background: act.player === 'H' ? '#1a365d' : '#4a1d1d',
                                borderRadius: '12px',
                                padding: '4px 8px',
                                fontSize: '12px',
                                fontWeight: 500,
                                color: '#e5e7eb',
                                cursor: 'pointer',
                              }}
                              title="Click to edit"
                              onClick={() => {
                                // Remove this and all subsequent actions, then open edit mode for this player
                                const playerToEdit = act.player;
                                setPreflopActions(prev => prev.slice(0, idx));
                                setIsAddingAction(true);
                                setPendingPlayer(playerToEdit);
                                setPendingAction('');
                                setPendingAmount('');
                              }}
                            >
                              <span style={{ fontWeight: 700 }}>{act.player}</span>
                              <span>:</span>
                              <span>{act.amount ? `${act.amount}bb` : ''}</span>
                              <span style={{ opacity: 0.8 }}>{act.action}</span>
                            </div>
                          ))}

                          {/* Arrow after actions - hide if last action is call/fold (betting ends) */}
                          {preflopActions.length > 0 && !isAddingAction &&
                            preflopActions[preflopActions.length - 1]?.action !== 'call' &&
                            preflopActions[preflopActions.length - 1]?.action !== 'fold' && (
                              <span style={{ color: '#6b7280', fontSize: '12px' }}>→</span>
                            )}

                          {/* Add Action Button - hide if last action is call/fold (betting ends) */}
                          {!isAddingAction && (
                            preflopActions.length === 0 ||
                            (preflopActions[preflopActions.length - 1]?.action !== 'call' &&
                              preflopActions[preflopActions.length - 1]?.action !== 'fold')
                          ) ? (
                            <button
                              onClick={() => setIsAddingAction(true)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: '#2a2a2a',
                                border: '1px dashed #4a4a4a',
                                borderRadius: '12px',
                                padding: '4px 10px',
                                fontSize: '14px',
                                color: '#9ca3af',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                              onMouseOver={(e) => { e.currentTarget.style.borderColor = '#6b7280'; e.currentTarget.style.color = '#e5e7eb'; }}
                              onMouseOut={(e) => { e.currentTarget.style.borderColor = '#4a4a4a'; e.currentTarget.style.color = '#9ca3af'; }}
                            >
                              {preflopActions.length === 0 ? '?' : '+'}
                            </button>
                          ) : isAddingAction ? (
                            /* Action Entry Form */
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              {/* Player Selector - Auto-alternate after actions */}
                              {!pendingPlayer ? (
                                (() => {
                                  // Determine next player based on last action
                                  const lastAction = preflopActions.length > 0 ? preflopActions[preflopActions.length - 1] : null;
                                  const nextPlayer = lastAction ? (lastAction.player === 'H' ? 'V' : 'H') : null;

                                  if (nextPlayer) {
                                    // Auto-show only the alternating player
                                    return (
                                      <>
                                        <button
                                          onClick={() => setPendingPlayer(nextPlayer)}
                                          style={{
                                            background: nextPlayer === 'H' ? '#1a365d' : '#4a1d1d',
                                            border: 'none',
                                            borderRadius: '8px',
                                            padding: '4px 8px',
                                            fontSize: '12px',
                                            fontWeight: 700,
                                            color: nextPlayer === 'H' ? '#93c5fd' : '#fca5a5',
                                            cursor: 'pointer'
                                          }}
                                        >{nextPlayer}</button>
                                        <button
                                          onClick={() => { setIsAddingAction(false); setPendingPlayer(null); setPendingAction(''); setPendingAmount(''); }}
                                          style={{ background: 'transparent', border: 'none', fontSize: '12px', color: '#6b7280', cursor: 'pointer', padding: '4px' }}
                                        >✕</button>
                                      </>
                                    );
                                  } else {
                                    // First action - show both H and V
                                    return (
                                      <>
                                        <button
                                          onClick={() => setPendingPlayer('H')}
                                          style={{ background: '#1a365d', border: 'none', borderRadius: '8px', padding: '4px 8px', fontSize: '12px', fontWeight: 700, color: '#93c5fd', cursor: 'pointer' }}
                                        >H</button>
                                        <button
                                          onClick={() => setPendingPlayer('V')}
                                          style={{ background: '#4a1d1d', border: 'none', borderRadius: '8px', padding: '4px 8px', fontSize: '12px', fontWeight: 700, color: '#fca5a5', cursor: 'pointer' }}
                                        >V</button>
                                        <button
                                          onClick={() => { setIsAddingAction(false); setPendingPlayer(null); setPendingAction(''); setPendingAmount(''); }}
                                          style={{ background: 'transparent', border: 'none', fontSize: '12px', color: '#6b7280', cursor: 'pointer', padding: '4px' }}
                                        >✕</button>
                                      </>
                                    );
                                  }
                                })()
                              ) : (
                                /* Action + Amount Entry */
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                  <span style={{ fontWeight: 700, color: pendingPlayer === 'H' ? '#93c5fd' : '#fca5a5', fontSize: '12px' }}>{pendingPlayer}:</span>
                                  <input
                                    type="number"
                                    placeholder="bb"
                                    min="0"
                                    value={pendingAmount}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      // Prevent negative numbers
                                      if (val === '' || parseFloat(val) >= 0) {
                                        setPendingAmount(val);
                                      }
                                    }}
                                    style={{ width: '40px', background: '#1f1f1f', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '2px 4px', fontSize: '12px', color: '#e5e7eb', outline: 'none' }}
                                  />
                                  <select
                                    value={pendingAction}
                                    onChange={(e) => {
                                      const action = e.target.value;
                                      if (!action) return; // Ignore empty selection

                                      // Parse preset sizes from action value
                                      let finalAction = action;
                                      let amount = pendingAmount;

                                      // Handle preset raise sizes
                                      if (action.startsWith('raise_')) {
                                        finalAction = 'raise';
                                        amount = action.replace('raise_', '');
                                      } else if (action.startsWith('3bet_')) {
                                        finalAction = '3bet';
                                        amount = action.replace('3bet_', '');
                                      } else if (action.startsWith('4bet_')) {
                                        finalAction = '4bet';
                                        amount = action.replace('4bet_', '');
                                      } else if (action === 'limp') {
                                        finalAction = 'limp';
                                        amount = '1';
                                      } else if (action === 'call') {
                                        // Get amount from last raise
                                        const raises = preflopActions.filter(a =>
                                          a.action === 'raise' || a.action === '3bet' || a.action === '4bet'
                                        );
                                        const lastRaise = raises[raises.length - 1];
                                        if (lastRaise?.amount) {
                                          amount = lastRaise.amount.toString();
                                        }
                                      } else if (action === 'raise' && pendingAmount) {
                                        finalAction = 'raise';
                                      } else if (action === '3bet' && pendingAmount) {
                                        finalAction = '3bet';
                                      } else if (action === '4bet' && pendingAmount) {
                                        finalAction = '4bet';
                                      }

                                      // Auto-submit if we have a valid action
                                      const currentPlayer = pendingPlayer;
                                      setPreflopActions(prev => [...prev, {
                                        player: pendingPlayer!,
                                        action: finalAction as any,
                                        amount: amount ? parseFloat(amount) : undefined
                                      }]);

                                      // If call/fold, close form. Otherwise, advance to next player.
                                      if (finalAction === 'call' || finalAction === 'fold') {
                                        setIsAddingAction(false);
                                        setPendingPlayer(null);
                                        setPendingAction('');
                                        setPendingAmount('');
                                      } else {
                                        setPendingPlayer(currentPlayer === 'H' ? 'V' : 'H');
                                        setPendingAction('');
                                        setPendingAmount('');
                                      }
                                    }}
                                    style={{ background: '#1f1f1f', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '2px 4px', fontSize: '12px', color: '#e5e7eb', outline: 'none', cursor: 'pointer' }}
                                  >
                                    <option value="">action</option>
                                    {/* Context-aware action options with preset sizes */}
                                    {(() => {
                                      const hasCustom = pendingAmount && parseFloat(pendingAmount) > 0;
                                      const raises = preflopActions.filter(a =>
                                        a.action === 'raise' || a.action === '3bet' || a.action === '4bet'
                                      );
                                      const raiseCount = raises.length;

                                      // First action (no prior raises) - limp, raise presets
                                      if (raiseCount === 0) {
                                        return (
                                          <>
                                            <option value="fold">fold</option>
                                            <option value="limp">limp (1bb)</option>
                                            <optgroup label="Raise">
                                              <option value="raise_2">raise 2bb</option>
                                              <option value="raise_2.2">raise 2.2bb</option>
                                              <option value="raise_2.5">raise 2.5bb</option>
                                              <option value="raise_3">raise 3bb</option>
                                              <option value="raise_4">raise 4bb</option>
                                              {hasCustom && <option value="raise">raise {pendingAmount}bb</option>}
                                            </optgroup>
                                          </>
                                        );
                                      }
                                      // After open (1 raise) - call or 3bet presets
                                      else if (raiseCount === 1) {
                                        const openAmount = raises[0]?.amount || 2.5;
                                        return (
                                          <>
                                            <option value="fold">fold</option>
                                            <option value="call">call ({openAmount}bb)</option>
                                            <optgroup label="3-Bet">
                                              <option value="3bet_7">3bet 7bb</option>
                                              <option value="3bet_8">3bet 8bb</option>
                                              <option value="3bet_9">3bet 9bb</option>
                                              <option value="3bet_10">3bet 10bb</option>
                                              <option value="3bet_12">3bet 12bb</option>
                                              {hasCustom && <option value="3bet">3bet {pendingAmount}bb</option>}
                                            </optgroup>
                                          </>
                                        );
                                      }
                                      // After 3bet (2 raises) - call or 4bet presets
                                      else if (raiseCount === 2) {
                                        const threeBetAmount = raises[1]?.amount || 9;
                                        return (
                                          <>
                                            <option value="fold">fold</option>
                                            <option value="call">call ({threeBetAmount}bb)</option>
                                            <optgroup label="4-Bet">
                                              <option value="4bet_18">4bet 18bb</option>
                                              <option value="4bet_20">4bet 20bb</option>
                                              <option value="4bet_22">4bet 22bb</option>
                                              <option value="4bet_25">4bet 25bb</option>
                                              {hasCustom && <option value="4bet">4bet {pendingAmount}bb</option>}
                                            </optgroup>
                                          </>
                                        );
                                      }
                                      // After 4bet+ (3+ raises) - just fold/call
                                      else {
                                        const lastRaiseAmount = raises[raises.length - 1]?.amount || 24;
                                        return (
                                          <>
                                            <option value="fold">fold</option>
                                            <option value="call">call ({lastRaiseAmount}bb)</option>
                                          </>
                                        );
                                      }
                                    })()}
                                  </select>
                                  <button
                                    onClick={() => {
                                      if (pendingAction) {
                                        const currentPlayer = pendingPlayer;
                                        const actionToAdd = pendingAction;
                                        setPreflopActions(prev => [...prev, {
                                          player: pendingPlayer!,
                                          action: pendingAction as any,
                                          amount: pendingAmount ? parseFloat(pendingAmount) : undefined
                                        }]);

                                        // If call or fold, action sequence is complete - close form
                                        if (actionToAdd === 'call' || actionToAdd === 'fold') {
                                          setIsAddingAction(false);
                                          setPendingPlayer(null);
                                          setPendingAction('');
                                          setPendingAmount('');
                                        } else {
                                          // Raise/3bet/4bet - auto-advance to alternate player
                                          setPendingPlayer(currentPlayer === 'H' ? 'V' : 'H');
                                          setPendingAction('');
                                          setPendingAmount('');
                                        }
                                      }
                                    }}
                                    disabled={!pendingAction}
                                    style={{
                                      background: pendingAction ? '#22c55e' : '#2a2a2a',
                                      border: 'none',
                                      borderRadius: '4px',
                                      padding: '2px 6px',
                                      fontSize: '12px',
                                      color: pendingAction ? '#fff' : '#6b7280',
                                      cursor: pendingAction ? 'pointer' : 'not-allowed'
                                    }}
                                  >✓</button>
                                  <button
                                    onClick={() => { setPendingPlayer(null); setPendingAction(''); setPendingAmount(''); }}
                                    style={{ background: 'transparent', border: 'none', fontSize: '12px', color: '#6b7280', cursor: 'pointer', padding: '2px' }}
                                  >←</button>
                                </div>
                              )}
                            </div>
                          ) : null}
                        </div>

                        {/* Pot Display */}
                        <div style={{
                          background: '#1f1f1f',
                          borderRadius: '8px',
                          padding: '4px 10px',
                          fontSize: '12px',
                          color: (preflopActions.length > 0 || flopActions.length > 0) ? '#22c55e' : '#6b7280',
                          fontWeight: 500,
                          whiteSpace: 'nowrap'
                        }}>
                          Pot: {preflopActions.length > 0 ? `${calculateTotalPot().toFixed(1)}bb` : '--'}
                        </div>
                      </div>

                      {/* Flop */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ width: '40px', color: '#9ca3af', fontSize: '12px' }}>Flop</span>
                        {/* Flop Card 1 */}
                        <div style={{ display: 'flex', alignItems: 'center', background: '#1f1f1f', borderRadius: '6px', padding: '4px 6px', border: '1px solid #3a3a3a' }}>
                          <select className="rank-selector" value={f1 ? f1.slice(0, -1) : ''} onChange={(e) => { if (!e.target.value) { setF1(''); return; } const ps = f1 ? f1.slice(-1) : '♠'; const as = getFirstAvailableSuit(e.target.value, ps, 'f1'); if (as) setF1(e.target.value + as); }} style={{ appearance: 'none', WebkitAppearance: 'none', background: 'transparent', border: 'none', fontSize: '16px', fontWeight: 600, color: '#e5e7eb', cursor: 'pointer', width: '20px', textAlign: 'center', outline: 'none' }} title="Rank"><option value="">🂠</option>{(() => { const c = getUsedRankCounts('f1'); return RANKS.map(r => { const d = (c[r] || 0) >= 4; return <option key={r} value={r} disabled={d} style={{ color: d ? '#666' : undefined }}>{r}</option>; }); })()}</select>
                          <select className="suit-selector" value={f1 ? f1.slice(-1) : ''} onChange={(e) => { const rank = f1 ? f1.slice(0, -1) : ''; const newCard = (rank || 'A') + e.target.value; const usedCards = getUsedCards('f1'); if (e.target.value && !usedCards.has(newCard)) setF1(newCard); }} style={{ appearance: 'none', WebkitAppearance: 'none', background: 'transparent', border: 'none', fontSize: '16px', fontWeight: 600, color: f1 && isRed(f1.slice(-1)) ? '#ef4444' : '#e5e7eb', cursor: 'pointer', width: '20px', textAlign: 'center', outline: 'none' }} title="Suit"><option value="">?</option>{(() => { const rank = f1 ? f1.slice(0, -1) : ''; const usedCards = getUsedCards('f1'); return SUITS_CONFIG.map(s => { const wouldBe = rank + s.value; const isUsed = !!(rank && usedCards.has(wouldBe)); return <option key={s.value} value={s.value} disabled={isUsed}>{s.label}</option>; }); })()}</select>
                        </div>
                        {/* Flop Card 2 */}
                        <div style={{ display: 'flex', alignItems: 'center', background: '#1f1f1f', borderRadius: '6px', padding: '4px 6px', border: '1px solid #3a3a3a' }}>
                          <select className="rank-selector" value={f2 ? f2.slice(0, -1) : ''} onChange={(e) => { if (!e.target.value) { setF2(''); return; } const ps = f2 ? f2.slice(-1) : '♠'; const as = getFirstAvailableSuit(e.target.value, ps, 'f2'); if (as) setF2(e.target.value + as); }} style={{ appearance: 'none', WebkitAppearance: 'none', background: 'transparent', border: 'none', fontSize: '16px', fontWeight: 600, color: '#e5e7eb', cursor: 'pointer', width: '20px', textAlign: 'center', outline: 'none' }} title="Rank"><option value="">🂠</option>{(() => { const c = getUsedRankCounts('f2'); return RANKS.map(r => { const d = (c[r] || 0) >= 4; return <option key={r} value={r} disabled={d} style={{ color: d ? '#666' : undefined }}>{r}</option>; }); })()}</select>
                          <select className="suit-selector" value={f2 ? f2.slice(-1) : ''} onChange={(e) => { const rank = f2 ? f2.slice(0, -1) : ''; const newCard = (rank || 'A') + e.target.value; const usedCards = getUsedCards('f2'); if (e.target.value && !usedCards.has(newCard)) setF2(newCard); }} style={{ appearance: 'none', WebkitAppearance: 'none', background: 'transparent', border: 'none', fontSize: '16px', fontWeight: 600, color: f2 && isRed(f2.slice(-1)) ? '#ef4444' : '#e5e7eb', cursor: 'pointer', width: '20px', textAlign: 'center', outline: 'none' }} title="Suit"><option value="">?</option>{(() => { const rank = f2 ? f2.slice(0, -1) : ''; const usedCards = getUsedCards('f2'); return SUITS_CONFIG.map(s => { const wouldBe = rank + s.value; const isUsed = !!(rank && usedCards.has(wouldBe)); return <option key={s.value} value={s.value} disabled={isUsed}>{s.label}</option>; }); })()}</select>
                        </div>
                        {/* Flop Card 3 */}
                        <div style={{ display: 'flex', alignItems: 'center', background: '#1f1f1f', borderRadius: '6px', padding: '4px 6px', border: '1px solid #3a3a3a' }}>
                          <select className="rank-selector" value={f3 ? f3.slice(0, -1) : ''} onChange={(e) => { if (!e.target.value) { setF3(''); return; } const ps = f3 ? f3.slice(-1) : '♠'; const as = getFirstAvailableSuit(e.target.value, ps, 'f3'); if (as) setF3(e.target.value + as); }} style={{ appearance: 'none', WebkitAppearance: 'none', background: 'transparent', border: 'none', fontSize: '16px', fontWeight: 600, color: '#e5e7eb', cursor: 'pointer', width: '20px', textAlign: 'center', outline: 'none' }} title="Rank"><option value="">🂠</option>{(() => { const c = getUsedRankCounts('f3'); return RANKS.map(r => { const d = (c[r] || 0) >= 4; return <option key={r} value={r} disabled={d} style={{ color: d ? '#666' : undefined }}>{r}</option>; }); })()}</select>
                          <select className="suit-selector" value={f3 ? f3.slice(-1) : ''} onChange={(e) => { const rank = f3 ? f3.slice(0, -1) : ''; const newCard = (rank || 'A') + e.target.value; const usedCards = getUsedCards('f3'); if (e.target.value && !usedCards.has(newCard)) setF3(newCard); }} style={{ appearance: 'none', WebkitAppearance: 'none', background: 'transparent', border: 'none', fontSize: '16px', fontWeight: 600, color: f3 && isRed(f3.slice(-1)) ? '#ef4444' : '#e5e7eb', cursor: 'pointer', width: '20px', textAlign: 'center', outline: 'none' }} title="Suit"><option value="">?</option>{(() => { const rank = f3 ? f3.slice(0, -1) : ''; const usedCards = getUsedCards('f3'); return SUITS_CONFIG.map(s => { const wouldBe = rank + s.value; const isUsed = !!(rank && usedCards.has(wouldBe)); return <option key={s.value} value={s.value} disabled={isUsed}>{s.label}</option>; }); })()}</select>
                        </div>
                      </div>

                      {/* Flop Action Builder - show only when flop cards are filled */}
                      {f1 && f2 && f3 && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between', marginLeft: '48px' }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ color: '#6b7280', fontSize: '11px', fontStyle: 'italic' }}>Action:</span>

                            {/* Render existing flop actions as chips */}
                            {flopActions.map((act, idx) => (
                              <div
                                key={idx}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                  background: act.player === 'H' ? '#1a365d' : '#4a1d1d',
                                  borderRadius: '12px',
                                  padding: '4px 8px',
                                  fontSize: '12px',
                                  fontWeight: 500,
                                  color: '#e5e7eb',
                                  cursor: 'pointer',
                                }}
                                title="Click to edit"
                                onClick={() => {
                                  const playerToEdit = act.player;
                                  setFlopActions(prev => prev.slice(0, idx));
                                  setIsAddingFlopAction(true);
                                  setPendingFlopPlayer(playerToEdit);
                                  setPendingFlopAction('');
                                  setPendingFlopAmount('');
                                }}
                              >
                                <span style={{ fontWeight: 700 }}>{act.player}</span>
                                <span>:</span>
                                <span>{act.amount ? `${act.amount}bb` : ''}</span>
                                <span style={{ opacity: 0.8 }}>{act.action}</span>
                              </div>
                            ))}

                            {/* Arrow after actions - hide if action ended (call/fold/check-check) */}
                            {(() => {
                              const lastAction = flopActions[flopActions.length - 1];
                              const secondLastAction = flopActions[flopActions.length - 2];
                              const isCheckCheck = lastAction?.action === 'check' && secondLastAction?.action === 'check';
                              const actionEnded = lastAction?.action === 'call' || lastAction?.action === 'fold' || isCheckCheck;
                              return flopActions.length > 0 && !isAddingFlopAction && !actionEnded && (
                                <span style={{ color: '#6b7280', fontSize: '12px' }}>→</span>
                              );
                            })()}

                            {/* Add Action Button - hide if action ended (call/fold/check-check) */}
                            {(() => {
                              const lastAction = flopActions[flopActions.length - 1];
                              const secondLastAction = flopActions[flopActions.length - 2];
                              const isCheckCheck = lastAction?.action === 'check' && secondLastAction?.action === 'check';
                              const actionEnded = lastAction?.action === 'call' || lastAction?.action === 'fold' || isCheckCheck;
                              return !isAddingFlopAction && (flopActions.length === 0 || !actionEnded);
                            })() ? (
                              <button
                                onClick={() => {
                                  setIsAddingFlopAction(true);
                                  // Auto-set first actor based on position
                                  if (flopActions.length === 0) {
                                    setPendingFlopPlayer(getFirstActorPostflop());
                                  }
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: '#2a2a2a',
                                  border: '1px dashed #4a4a4a',
                                  borderRadius: '12px',
                                  padding: '4px 10px',
                                  fontSize: '14px',
                                  color: '#9ca3af',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseOver={(e) => { e.currentTarget.style.borderColor = '#6b7280'; e.currentTarget.style.color = '#e5e7eb'; }}
                                onMouseOut={(e) => { e.currentTarget.style.borderColor = '#4a4a4a'; e.currentTarget.style.color = '#9ca3af'; }}
                              >
                                {flopActions.length === 0 ? '?' : '+'}
                              </button>
                            ) : isAddingFlopAction ? (
                              /* Flop Action Entry Form */
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                {/* Player already selected (show player badge) */}
                                {pendingFlopPlayer ? (
                                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 700, color: pendingFlopPlayer === 'H' ? '#93c5fd' : '#fca5a5', fontSize: '12px' }}>{pendingFlopPlayer}:</span>

                                    {/* Custom input - % for bet, bb for raise */}
                                    {(() => {
                                      const bets = flopActions.filter(a => a.action === 'bet' || a.action === 'raise');
                                      const hasBet = bets.length > 0;
                                      return (
                                        <input
                                          type="number"
                                          placeholder={hasBet ? "bb" : "%"}
                                          min="0"
                                          value={pendingFlopAmount}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '' || parseFloat(val) >= 0) {
                                              setPendingFlopAmount(val);
                                            }
                                          }}
                                          style={{ width: '35px', background: '#1f1f1f', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '2px 4px', fontSize: '12px', color: '#e5e7eb', outline: 'none' }}
                                          title={hasBet ? "Enter custom raise amount in bb" : "Enter custom % of pot (e.g., 40 for 40%)"}
                                        />
                                      );
                                    })()}

                                    <select
                                      value={pendingFlopAction}
                                      onChange={(e) => {
                                        const action = e.target.value;
                                        if (!action) return;

                                        const currentPot = calculateTotalPot();
                                        let finalAction = action;
                                        let amount: number | undefined = undefined;

                                        // Handle bet percentage options
                                        if (action.startsWith('bet_')) {
                                          finalAction = 'bet';
                                          const pct = parseFloat(action.replace('bet_', '')) / 100;
                                          amount = parseFloat((currentPot * pct).toFixed(1));
                                        } else if (action === 'bet_custom' && pendingFlopAmount) {
                                          finalAction = 'bet';
                                          const pct = parseFloat(pendingFlopAmount) / 100;
                                          amount = parseFloat((currentPot * pct).toFixed(1));
                                        } else if (action === 'call') {
                                          const lastBet = flopActions.filter(a => a.action === 'bet' || a.action === 'raise').pop();
                                          if (lastBet?.amount) {
                                            amount = lastBet.amount;
                                          }
                                        } else if (action.startsWith('raise_')) {
                                          // Handle raise multiplier options
                                          finalAction = 'raise';
                                          const lastBet = flopActions.filter(a => a.action === 'bet' || a.action === 'raise').pop();
                                          const facingAmount = lastBet?.amount || 0;
                                          if (action === 'raise_custom' && pendingFlopAmount) {
                                            amount = parseFloat(pendingFlopAmount);
                                          } else {
                                            const multiplier = parseFloat(action.replace('raise_', ''));
                                            amount = parseFloat((facingAmount * multiplier).toFixed(1));
                                          }
                                        }

                                        // Auto-submit
                                        const currentPlayer = pendingFlopPlayer;
                                        setFlopActions(prev => [...prev, {
                                          player: pendingFlopPlayer!,
                                          action: finalAction as any,
                                          amount: amount
                                        }]);

                                        // Check if action should end
                                        const isCheckCheck = finalAction === 'check' && flopActions.length > 0 && flopActions[flopActions.length - 1]?.action === 'check';

                                        if (finalAction === 'call' || finalAction === 'fold' || isCheckCheck) {
                                          setIsAddingFlopAction(false);
                                          setPendingFlopPlayer(null);
                                          setPendingFlopAction('');
                                          setPendingFlopAmount('');
                                        } else {
                                          setPendingFlopPlayer(currentPlayer === 'H' ? 'V' : 'H');
                                          setPendingFlopAction('');
                                          setPendingFlopAmount('');
                                        }
                                      }}
                                      style={{ background: '#1f1f1f', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '2px 4px', fontSize: '12px', color: '#e5e7eb', outline: 'none', cursor: 'pointer' }}
                                    >
                                      <option value="">action</option>
                                      {/* Postflop action options based on context */}
                                      {(() => {
                                        const bets = flopActions.filter(a => a.action === 'bet' || a.action === 'raise');
                                        const hasBet = bets.length > 0;
                                        const lastBet = bets[bets.length - 1];

                                        // No prior bets - show check/fold and bet options
                                        if (!hasBet) {
                                          const hasCustomPct = pendingFlopAmount && parseFloat(pendingFlopAmount) > 0;
                                          return (
                                            <>
                                              <option value="check">check</option>
                                              <option value="fold">fold</option>
                                              <optgroup label="Bet">
                                                <option value="bet_33">bet 33%</option>
                                                <option value="bet_50">bet 50%</option>
                                                <option value="bet_75">bet 75%</option>
                                                <option value="bet_100">bet Pot</option>
                                                {hasCustomPct && <option value="bet_custom">bet {pendingFlopAmount}%</option>}
                                              </optgroup>
                                            </>
                                          );
                                        }
                                        // Facing a bet - show fold, call, raise options
                                        else {
                                          const facingAmount = lastBet?.amount || 0;
                                          const hasCustomAmount = pendingFlopAmount && parseFloat(pendingFlopAmount) > 0;
                                          return (
                                            <>
                                              <option value="fold">fold</option>
                                              <option value="call">call ({facingAmount}bb)</option>
                                              <optgroup label="Raise">
                                                <option value="raise_2">raise 2x ({(facingAmount * 2).toFixed(1)}bb)</option>
                                                <option value="raise_3">raise 3x ({(facingAmount * 3).toFixed(1)}bb)</option>
                                                <option value="raise_4">raise 4x ({(facingAmount * 4).toFixed(1)}bb)</option>
                                                {hasCustomAmount && <option value="raise_custom">raise {pendingFlopAmount}bb</option>}
                                              </optgroup>
                                            </>
                                          );
                                        }
                                      })()}
                                    </select>
                                    <button
                                      onClick={() => { setPendingFlopPlayer(null); setPendingFlopAction(''); setPendingFlopAmount(''); setIsAddingFlopAction(false); }}
                                      style={{ background: 'transparent', border: 'none', fontSize: '12px', color: '#6b7280', cursor: 'pointer', padding: '2px' }}
                                    >←</button>
                                  </div>
                                ) : (
                                  /* Select player if not auto-set */
                                  <>
                                    <button
                                      onClick={() => setPendingFlopPlayer('H')}
                                      style={{ background: '#1a365d', border: 'none', borderRadius: '8px', padding: '4px 8px', fontSize: '12px', fontWeight: 700, color: '#93c5fd', cursor: 'pointer' }}
                                    >H</button>
                                    <button
                                      onClick={() => setPendingFlopPlayer('V')}
                                      style={{ background: '#4a1d1d', border: 'none', borderRadius: '8px', padding: '4px 8px', fontSize: '12px', fontWeight: 700, color: '#fca5a5', cursor: 'pointer' }}
                                    >V</button>
                                    <button
                                      onClick={() => { setIsAddingFlopAction(false); setPendingFlopPlayer(null); setPendingFlopAction(''); setPendingFlopAmount(''); }}
                                      style={{ background: 'transparent', border: 'none', fontSize: '12px', color: '#6b7280', cursor: 'pointer', padding: '4px' }}
                                    >✕</button>
                                  </>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )}

                      {/* Turn */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ width: '40px', color: '#9ca3af', fontSize: '12px' }}>Turn</span>
                        <div style={{ display: 'flex', alignItems: 'center', background: '#1f1f1f', borderRadius: '6px', padding: '4px 6px', border: '1px solid #3a3a3a' }}>
                          <select className="rank-selector" value={tr ? tr.slice(0, -1) : ''} onChange={(e) => { if (!e.target.value) { setTr(''); return; } const ps = tr ? tr.slice(-1) : '♠'; const as = getFirstAvailableSuit(e.target.value, ps, 'tr'); if (as) setTr(e.target.value + as); }} style={{ appearance: 'none', WebkitAppearance: 'none', background: 'transparent', border: 'none', fontSize: '16px', fontWeight: 600, color: '#e5e7eb', cursor: 'pointer', width: '20px', textAlign: 'center', outline: 'none' }} title="Rank"><option value="">🂠</option>{(() => { const c = getUsedRankCounts('tr'); return RANKS.map(r => { const d = (c[r] || 0) >= 4; return <option key={r} value={r} disabled={d} style={{ color: d ? '#666' : undefined }}>{r}</option>; }); })()}</select>
                          <select className="suit-selector" value={tr ? tr.slice(-1) : ''} onChange={(e) => { const rank = tr ? tr.slice(0, -1) : ''; const newCard = (rank || 'A') + e.target.value; const usedCards = getUsedCards('tr'); if (e.target.value && !usedCards.has(newCard)) setTr(newCard); }} style={{ appearance: 'none', WebkitAppearance: 'none', background: 'transparent', border: 'none', fontSize: '16px', fontWeight: 600, color: tr && isRed(tr.slice(-1)) ? '#ef4444' : '#e5e7eb', cursor: 'pointer', width: '20px', textAlign: 'center', outline: 'none' }} title="Suit"><option value="">?</option>{(() => { const rank = tr ? tr.slice(0, -1) : ''; const usedCards = getUsedCards('tr'); return SUITS_CONFIG.map(s => { const wouldBe = rank + s.value; const isUsed = !!(rank && usedCards.has(wouldBe)); return <option key={s.value} value={s.value} disabled={isUsed}>{s.label}</option>; }); })()}</select>
                        </div>
                      </div>

                      {/* Turn Action Builder - show only when turn card is filled */}
                      {tr && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between', marginLeft: '48px' }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ color: '#6b7280', fontSize: '11px', fontStyle: 'italic' }}>Action:</span>
                            {/* Existing turn actions */}
                            {turnActions.map((act, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '2px', background: act.player === 'H' ? '#1a365d' : '#4a1d1d', borderRadius: '12px', padding: '4px 8px', fontSize: '12px', fontWeight: 500, color: '#e5e7eb', cursor: 'pointer' }} title="Click to edit" onClick={() => { setTurnActions(prev => prev.slice(0, idx)); setIsAddingTurnAction(true); setPendingTurnPlayer(act.player); setPendingTurnAction(''); setPendingTurnAmount(''); }}>
                                <span style={{ fontWeight: 700 }}>{act.player}</span>:<span>{act.amount ? `${act.amount}bb` : ''}</span><span style={{ opacity: 0.8 }}>{act.action}</span>
                              </div>
                            ))}
                            {/* Arrow/button visibility */}
                            {(() => {
                              const lastAction = turnActions[turnActions.length - 1];
                              const secondLastAction = turnActions[turnActions.length - 2];
                              const isCheckCheck = lastAction?.action === 'check' && secondLastAction?.action === 'check';
                              const actionEnded = lastAction?.action === 'call' || lastAction?.action === 'fold' || isCheckCheck;
                              return turnActions.length > 0 && !isAddingTurnAction && !actionEnded && <span style={{ color: '#6b7280', fontSize: '12px' }}>→</span>;
                            })()}
                            {(() => {
                              const lastAction = turnActions[turnActions.length - 1];
                              const secondLastAction = turnActions[turnActions.length - 2];
                              const isCheckCheck = lastAction?.action === 'check' && secondLastAction?.action === 'check';
                              const actionEnded = lastAction?.action === 'call' || lastAction?.action === 'fold' || isCheckCheck;
                              return !isAddingTurnAction && (turnActions.length === 0 || !actionEnded);
                            })() ? (
                              <button onClick={() => { setIsAddingTurnAction(true); if (turnActions.length === 0) setPendingTurnPlayer(getFirstActorPostflop()); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2a2a2a', border: '1px dashed #4a4a4a', borderRadius: '12px', padding: '4px 10px', fontSize: '14px', color: '#9ca3af', cursor: 'pointer' }}>{turnActions.length === 0 ? '?' : '+'}</button>
                            ) : isAddingTurnAction ? (
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                {pendingTurnPlayer ? (
                                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 700, color: pendingTurnPlayer === 'H' ? '#93c5fd' : '#fca5a5', fontSize: '12px' }}>{pendingTurnPlayer}:</span>
                                    <input type="number" placeholder={turnActions.some(a => a.action === 'bet' || a.action === 'raise') ? "bb" : "%"} min="0" value={pendingTurnAmount} onChange={(e) => { if (e.target.value === '' || parseFloat(e.target.value) >= 0) setPendingTurnAmount(e.target.value); }} style={{ width: '35px', background: '#1f1f1f', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '2px 4px', fontSize: '12px', color: '#e5e7eb', outline: 'none' }} />
                                    <select value={pendingTurnAction} onChange={(e) => {
                                      const action = e.target.value; if (!action) return;
                                      const currentPot = calculateTotalPot();
                                      let finalAction = action, amount: number | undefined;
                                      if (action.startsWith('bet_')) { finalAction = 'bet'; const pct = action === 'bet_custom' ? parseFloat(pendingTurnAmount) / 100 : parseFloat(action.replace('bet_', '')) / 100; amount = parseFloat((currentPot * pct).toFixed(1)); }
                                      else if (action === 'call') { const lastBet = turnActions.filter(a => a.action === 'bet' || a.action === 'raise').pop(); if (lastBet?.amount) amount = lastBet.amount; }
                                      else if (action.startsWith('raise_')) { finalAction = 'raise'; const lastBet = turnActions.filter(a => a.action === 'bet' || a.action === 'raise').pop(); const facingAmount = lastBet?.amount || 0; if (action === 'raise_custom') amount = parseFloat(pendingTurnAmount); else { const mult = parseFloat(action.replace('raise_', '')); amount = parseFloat((facingAmount * mult).toFixed(1)); } }
                                      const currentPlayer = pendingTurnPlayer;
                                      setTurnActions(prev => [...prev, { player: pendingTurnPlayer!, action: finalAction as any, amount }]);
                                      const isCheckCheck = finalAction === 'check' && turnActions.length > 0 && turnActions[turnActions.length - 1]?.action === 'check';
                                      if (finalAction === 'call' || finalAction === 'fold' || isCheckCheck) { setIsAddingTurnAction(false); setPendingTurnPlayer(null); setPendingTurnAction(''); setPendingTurnAmount(''); }
                                      else { setPendingTurnPlayer(currentPlayer === 'H' ? 'V' : 'H'); setPendingTurnAction(''); setPendingTurnAmount(''); }
                                    }} style={{ background: '#1f1f1f', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '2px 4px', fontSize: '12px', color: '#e5e7eb', outline: 'none', cursor: 'pointer' }}>
                                      <option value="">action</option>
                                      {(() => {
                                        const bets = turnActions.filter(a => a.action === 'bet' || a.action === 'raise');
                                        const hasBet = bets.length > 0;
                                        if (!hasBet) { const hasCustom = pendingTurnAmount && parseFloat(pendingTurnAmount) > 0; return <><option value="check">check</option><option value="fold">fold</option><optgroup label="Bet"><option value="bet_33">bet 33%</option><option value="bet_50">bet 50%</option><option value="bet_75">bet 75%</option><option value="bet_100">bet Pot</option>{hasCustom && <option value="bet_custom">bet {pendingTurnAmount}%</option>}</optgroup></>; }
                                        else { const lastBet = bets[bets.length - 1]; const facingAmount = lastBet?.amount || 0; const hasCustom = pendingTurnAmount && parseFloat(pendingTurnAmount) > 0; return <><option value="fold">fold</option><option value="call">call ({facingAmount}bb)</option><optgroup label="Raise"><option value="raise_2">raise 2x ({(facingAmount * 2).toFixed(1)}bb)</option><option value="raise_3">raise 3x ({(facingAmount * 3).toFixed(1)}bb)</option><option value="raise_4">raise 4x ({(facingAmount * 4).toFixed(1)}bb)</option>{hasCustom && <option value="raise_custom">raise {pendingTurnAmount}bb</option>}</optgroup></>; }
                                      })()}
                                    </select>
                                    <button onClick={() => { setPendingTurnPlayer(null); setPendingTurnAction(''); setPendingTurnAmount(''); setIsAddingTurnAction(false); }} style={{ background: 'transparent', border: 'none', fontSize: '12px', color: '#6b7280', cursor: 'pointer', padding: '2px' }}>←</button>
                                  </div>
                                ) : (
                                  <><button onClick={() => setPendingTurnPlayer('H')} style={{ background: '#1a365d', border: 'none', borderRadius: '8px', padding: '4px 8px', fontSize: '12px', fontWeight: 700, color: '#93c5fd', cursor: 'pointer' }}>H</button><button onClick={() => setPendingTurnPlayer('V')} style={{ background: '#4a1d1d', border: 'none', borderRadius: '8px', padding: '4px 8px', fontSize: '12px', fontWeight: 700, color: '#fca5a5', cursor: 'pointer' }}>V</button><button onClick={() => { setIsAddingTurnAction(false); setPendingTurnPlayer(null); }} style={{ background: 'transparent', border: 'none', fontSize: '12px', color: '#6b7280', cursor: 'pointer', padding: '4px' }}>✕</button></>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )}

                      {/* River */}
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ width: '40px', color: '#9ca3af', fontSize: '12px' }}>River</span>
                        <div style={{ display: 'flex', alignItems: 'center', background: '#1f1f1f', borderRadius: '6px', padding: '4px 6px', border: '1px solid #3a3a3a' }}>
                          <select className="rank-selector" value={rv ? rv.slice(0, -1) : ''} onChange={(e) => { if (!e.target.value) { setRv(''); return; } const ps = rv ? rv.slice(-1) : '♠'; const as = getFirstAvailableSuit(e.target.value, ps, 'rv'); if (as) setRv(e.target.value + as); }} style={{ appearance: 'none', WebkitAppearance: 'none', background: 'transparent', border: 'none', fontSize: '16px', fontWeight: 600, color: '#e5e7eb', cursor: 'pointer', width: '20px', textAlign: 'center', outline: 'none' }} title="Rank"><option value="">🂠</option>{(() => { const c = getUsedRankCounts('rv'); return RANKS.map(r => { const d = (c[r] || 0) >= 4; return <option key={r} value={r} disabled={d} style={{ color: d ? '#666' : undefined }}>{r}</option>; }); })()}</select>
                          <select className="suit-selector" value={rv ? rv.slice(-1) : ''} onChange={(e) => { const rank = rv ? rv.slice(0, -1) : ''; const newCard = (rank || 'A') + e.target.value; const usedCards = getUsedCards('rv'); if (e.target.value && !usedCards.has(newCard)) setRv(newCard); }} style={{ appearance: 'none', WebkitAppearance: 'none', background: 'transparent', border: 'none', fontSize: '16px', fontWeight: 600, color: rv && isRed(rv.slice(-1)) ? '#ef4444' : '#e5e7eb', cursor: 'pointer', width: '20px', textAlign: 'center', outline: 'none' }} title="Suit"><option value="">?</option>{(() => { const rank = rv ? rv.slice(0, -1) : ''; const usedCards = getUsedCards('rv'); return SUITS_CONFIG.map(s => { const wouldBe = rank + s.value; const isUsed = !!(rank && usedCards.has(wouldBe)); return <option key={s.value} value={s.value} disabled={isUsed}>{s.label}</option>; }); })()}</select>
                        </div>
                      </div>

                      {/* River Action Builder - show only when river card is filled */}
                      {rv && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between', marginLeft: '48px' }}>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span style={{ color: '#6b7280', fontSize: '11px', fontStyle: 'italic' }}>Action:</span>
                            {/* Existing river actions */}
                            {riverActions.map((act, idx) => (
                              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '2px', background: act.player === 'H' ? '#1a365d' : '#4a1d1d', borderRadius: '12px', padding: '4px 8px', fontSize: '12px', fontWeight: 500, color: '#e5e7eb', cursor: 'pointer' }} title="Click to edit" onClick={() => { setRiverActions(prev => prev.slice(0, idx)); setIsAddingRiverAction(true); setPendingRiverPlayer(act.player); setPendingRiverAction(''); setPendingRiverAmount(''); }}>
                                <span style={{ fontWeight: 700 }}>{act.player}</span>:<span>{act.amount ? `${act.amount}bb` : ''}</span><span style={{ opacity: 0.8 }}>{act.action}</span>
                              </div>
                            ))}
                            {/* Arrow/button visibility */}
                            {(() => {
                              const lastAction = riverActions[riverActions.length - 1];
                              const secondLastAction = riverActions[riverActions.length - 2];
                              const isCheckCheck = lastAction?.action === 'check' && secondLastAction?.action === 'check';
                              const actionEnded = lastAction?.action === 'call' || lastAction?.action === 'fold' || isCheckCheck;
                              return riverActions.length > 0 && !isAddingRiverAction && !actionEnded && <span style={{ color: '#6b7280', fontSize: '12px' }}>→</span>;
                            })()}
                            {(() => {
                              const lastAction = riverActions[riverActions.length - 1];
                              const secondLastAction = riverActions[riverActions.length - 2];
                              const isCheckCheck = lastAction?.action === 'check' && secondLastAction?.action === 'check';
                              const actionEnded = lastAction?.action === 'call' || lastAction?.action === 'fold' || isCheckCheck;
                              return !isAddingRiverAction && (riverActions.length === 0 || !actionEnded);
                            })() ? (
                              <button onClick={() => { setIsAddingRiverAction(true); if (riverActions.length === 0) setPendingRiverPlayer(getFirstActorPostflop()); }} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#2a2a2a', border: '1px dashed #4a4a4a', borderRadius: '12px', padding: '4px 10px', fontSize: '14px', color: '#9ca3af', cursor: 'pointer' }}>{riverActions.length === 0 ? '?' : '+'}</button>
                            ) : isAddingRiverAction ? (
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                {pendingRiverPlayer ? (
                                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                    <span style={{ fontWeight: 700, color: pendingRiverPlayer === 'H' ? '#93c5fd' : '#fca5a5', fontSize: '12px' }}>{pendingRiverPlayer}:</span>
                                    <input type="number" placeholder={riverActions.some(a => a.action === 'bet' || a.action === 'raise') ? "bb" : "%"} min="0" value={pendingRiverAmount} onChange={(e) => { if (e.target.value === '' || parseFloat(e.target.value) >= 0) setPendingRiverAmount(e.target.value); }} style={{ width: '35px', background: '#1f1f1f', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '2px 4px', fontSize: '12px', color: '#e5e7eb', outline: 'none' }} />
                                    <select value={pendingRiverAction} onChange={(e) => {
                                      const action = e.target.value; if (!action) return;
                                      const currentPot = calculateTotalPot();
                                      let finalAction = action, amount: number | undefined;
                                      if (action.startsWith('bet_')) { finalAction = 'bet'; const pct = action === 'bet_custom' ? parseFloat(pendingRiverAmount) / 100 : parseFloat(action.replace('bet_', '')) / 100; amount = parseFloat((currentPot * pct).toFixed(1)); }
                                      else if (action === 'call') { const lastBet = riverActions.filter(a => a.action === 'bet' || a.action === 'raise').pop(); if (lastBet?.amount) amount = lastBet.amount; }
                                      else if (action.startsWith('raise_')) { finalAction = 'raise'; const lastBet = riverActions.filter(a => a.action === 'bet' || a.action === 'raise').pop(); const facingAmount = lastBet?.amount || 0; if (action === 'raise_custom') amount = parseFloat(pendingRiverAmount); else { const mult = parseFloat(action.replace('raise_', '')); amount = parseFloat((facingAmount * mult).toFixed(1)); } }
                                      const currentPlayer = pendingRiverPlayer;
                                      setRiverActions(prev => [...prev, { player: pendingRiverPlayer!, action: finalAction as any, amount }]);
                                      const isCheckCheck = finalAction === 'check' && riverActions.length > 0 && riverActions[riverActions.length - 1]?.action === 'check';
                                      if (finalAction === 'call' || finalAction === 'fold' || isCheckCheck) { setIsAddingRiverAction(false); setPendingRiverPlayer(null); setPendingRiverAction(''); setPendingRiverAmount(''); }
                                      else { setPendingRiverPlayer(currentPlayer === 'H' ? 'V' : 'H'); setPendingRiverAction(''); setPendingRiverAmount(''); }
                                    }} style={{ background: '#1f1f1f', border: '1px solid #3a3a3a', borderRadius: '4px', padding: '2px 4px', fontSize: '12px', color: '#e5e7eb', outline: 'none', cursor: 'pointer' }}>
                                      <option value="">action</option>
                                      {(() => {
                                        const bets = riverActions.filter(a => a.action === 'bet' || a.action === 'raise');
                                        const hasBet = bets.length > 0;
                                        if (!hasBet) { const hasCustom = pendingRiverAmount && parseFloat(pendingRiverAmount) > 0; return <><option value="check">check</option><option value="fold">fold</option><optgroup label="Bet"><option value="bet_33">bet 33%</option><option value="bet_50">bet 50%</option><option value="bet_75">bet 75%</option><option value="bet_100">bet Pot</option>{hasCustom && <option value="bet_custom">bet {pendingRiverAmount}%</option>}</optgroup></>; }
                                        else { const lastBet = bets[bets.length - 1]; const facingAmount = lastBet?.amount || 0; const hasCustom = pendingRiverAmount && parseFloat(pendingRiverAmount) > 0; return <><option value="fold">fold</option><option value="call">call ({facingAmount}bb)</option><optgroup label="Raise"><option value="raise_2">raise 2x ({(facingAmount * 2).toFixed(1)}bb)</option><option value="raise_3">raise 3x ({(facingAmount * 3).toFixed(1)}bb)</option><option value="raise_4">raise 4x ({(facingAmount * 4).toFixed(1)}bb)</option>{hasCustom && <option value="raise_custom">raise {pendingRiverAmount}bb</option>}</optgroup></>; }
                                      })()}
                                    </select>
                                    <button onClick={() => { setPendingRiverPlayer(null); setPendingRiverAction(''); setPendingRiverAmount(''); setIsAddingRiverAction(false); }} style={{ background: 'transparent', border: 'none', fontSize: '12px', color: '#6b7280', cursor: 'pointer', padding: '2px' }}>←</button>
                                  </div>
                                ) : (
                                  <><button onClick={() => setPendingRiverPlayer('H')} style={{ background: '#1a365d', border: 'none', borderRadius: '8px', padding: '4px 8px', fontSize: '12px', fontWeight: 700, color: '#93c5fd', cursor: 'pointer' }}>H</button><button onClick={() => setPendingRiverPlayer('V')} style={{ background: '#4a1d1d', border: 'none', borderRadius: '8px', padding: '4px 8px', fontSize: '12px', fontWeight: 700, color: '#fca5a5', cursor: 'pointer' }}>V</button><button onClick={() => { setIsAddingRiverAction(false); setPendingRiverPlayer(null); }} style={{ background: 'transparent', border: 'none', fontSize: '12px', color: '#6b7280', cursor: 'pointer', padding: '4px' }}>✕</button></>
                                )}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Action Buttons */}
                  <div style={{ display: 'flex', gap: '12px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #3a3a3a' }}>
                    <button
                      className="btn btn-platinum-premium btn-analyze-premium"
                      style={{ flex: 2, padding: '14px 24px', whiteSpace: 'nowrap' }}
                      onClick={analyze}
                      disabled={aiLoading || !(h1 && h2 && preflopActions.length > 0)}
                    >
                      <span className="btn-text">{aiLoading ? 'Analyzing…' : '✨ Analyze Hand'}</span>
                    </button>
                    <button
                      className={`btn-session-save ${currentHandSaved
                        ? 'btn-saved'
                        : activeSession
                          ? 'btn-save-active'
                          : 'btn-note'
                        }`}
                      style={{ flex: 1 }}
                      onClick={handleNoteClick}
                      disabled={!canSave() || saving || currentHandSaved}
                    >
                      <span className="save-icon">
                        {currentHandSaved ? '✓' : '📝'}
                      </span>
                      {saving
                        ? 'Saving…'
                        : currentHandSaved
                          ? 'Saved'
                          : activeSession
                            ? 'Save'
                            : 'Note'}
                    </button>
                    <button
                      className="btn-session-save btn-note"
                      style={{ flex: 1 }}
                      onClick={() => {
                        setFields(null); setStatus(null); setError(null);
                        setStakes(''); setEff(''); setPosition('');
                        setH1(''); setH2(''); setF1(''); setF2(''); setF3(''); setTr(''); setRv('');
                        setPreflopActions([]); setFlopActions([]); setTurnActions([]); setRiverActions([]);
                        setTransparencyData(null);
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              </section>


            </div>

            {/* RIGHT column */}
            <div className="col">

              {/* GTO Strategy - FIRST */}
              <section className="card ony-card platinum-container-frame glass-card">
                <div className="section-header section-accent-blue">
                  <span className="section-header-icon">🤖</span>
                  <span className="section-header-title">GTO Strategy</span>
                </div>

                <div className={`gtoBox gto-strategy-box${aiLoading ? ' loading' : fields?.gto_strategy ? ' populated' : ''}`}>{renderGTO(fields?.gto_strategy || '', fields?.mistakes)}</div>
              </section>

              {/* Play Review - SECOND (Premium Design) */}
              <section className="card ony-card platinum-container-frame glass-card">
                <div className="section-header section-accent-green">
                  <span className="section-header-icon">📊</span>
                  <span className="section-header-title">Play Review</span>
                </div>
                <div className={`play-review-box${aiLoading ? ' loading' : fields?.exploit_deviation ? ' populated' : ''}`}>
                  {/* Chart Watermark */}
                  <div className="play-review-watermark">
                    <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="chartWatermarkGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" style={{ stopColor: '#e0e0e0' }} />
                          <stop offset="25%" style={{ stopColor: '#909090' }} />
                          <stop offset="50%" style={{ stopColor: '#d0d0d0' }} />
                          <stop offset="75%" style={{ stopColor: '#707070' }} />
                          <stop offset="100%" style={{ stopColor: '#a0a0a0' }} />
                        </linearGradient>
                      </defs>
                      {/* Rising chart bars */}
                      <rect x="3" y="16" width="3" height="5" rx="0.5" fill="url(#chartWatermarkGradient)" />
                      <rect x="8" y="12" width="3" height="9" rx="0.5" fill="url(#chartWatermarkGradient)" />
                      <rect x="13" y="8" width="3" height="13" rx="0.5" fill="url(#chartWatermarkGradient)" />
                      <rect x="18" y="4" width="3" height="17" rx="0.5" fill="url(#chartWatermarkGradient)" />
                      {/* Trend line */}
                      <path d="M4.5 15 L9.5 11 L14.5 7 L19.5 3" stroke="url(#chartWatermarkGradient)" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                      {/* Arrow tip */}
                      <path d="M17 3 L19.5 3 L19.5 5.5" stroke="url(#chartWatermarkGradient)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    </svg>
                  </div>

                  {/* Play Review Content */}
                  <div className="play-review-content">
                    {fields?.exploit_deviation ? (
                      <>
                        <ul className="play-review-list">
                          {(fields.exploit_deviation || '')
                            .split(/(?<=\.)\s+/)
                            .filter(Boolean)
                            .map((s, i) => {
                              // Parse markdown **bold** syntax and colorize classification dots
                              const parts = s.split(/\*\*/);

                              // Helper to colorize dots based on classification keywords
                              const colorizeDots = (text: string): React.ReactNode => {
                                // Replace colored dots with properly colored spans
                                // 🟢 for Optimal (green), 🟡 for Acceptable (yellow), 🔴 for Mistake (red)
                                const dotRegex = /(🟢|🟡|🔴)/g;
                                const textParts = text.split(dotRegex);

                                return textParts.map((part, idx) => {
                                  if (part === '🟢') {
                                    return <span key={idx} className="classification-dot-optimal">{part}</span>;
                                  } else if (part === '🟡') {
                                    return <span key={idx} className="classification-dot-acceptable">{part}</span>;
                                  } else if (part === '🔴') {
                                    return <span key={idx} className="classification-dot-mistake">{part}</span>;
                                  }
                                  return part;
                                });
                              };

                              return (
                                <li key={i}>
                                  {parts.map((part, j) =>
                                    j % 2 === 1 ? <strong key={j}>{colorizeDots(part)}</strong> : colorizeDots(part)
                                  )}
                                </li>
                              );
                            })}
                        </ul>

                        {/* Quick Actions */}
                        <div className="play-review-actions">
                          <button
                            className="btn-insight-sparkle"
                            onClick={() => {
                              // Get a random insight from learning tags or create one
                              const insights = fields?.learning_tag || ['Keep studying!'];
                              const randomInsight = insights[Math.floor(Math.random() * insights.length)];
                              setStatus(`✨ ${randomInsight}`);
                              setTimeout(() => setStatus(null), 3000);
                            }}
                          >
                            <span className="sparkle-icon">✨</span>
                            Quick Insight
                          </button>

                          {/* Smart Note/Save Button */}
                          <button
                            className={`btn-session-save ${currentHandSaved
                              ? 'btn-saved'
                              : activeSession
                                ? 'btn-save-active'
                                : 'btn-note'
                              }`}
                            onClick={handleNoteClick}
                            disabled={!canSave() || saving || currentHandSaved}
                          >
                            <span className="save-icon">
                              {currentHandSaved ? '✓' : '📝'}
                            </span>
                            {saving
                              ? 'Saving…'
                              : currentHandSaved
                                ? 'Saved'
                                : activeSession
                                  ? 'Save'
                                  : 'Note'}
                            {!activeSession && !currentHandSaved && (
                              <span className="keyboard-hint">⌘S</span>
                            )}
                          </button>
                        </div>
                        {status && <div className="play-review-status">{status}</div>}
                      </>
                    ) : (
                      <div className="play-review-empty">
                        <span className="empty-hint">Analyze a hand to see your play review</span>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {/* Exploit Signals - THIRD */}
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

              {/* Key Concepts - LAST */}
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

          .gtoBox{border-radius:12px;padding:12px;color:#CBD5E1}
          .gtoBody{font-family:var(--font-inter),'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;letter-spacing:-0.01em}
          .gtoLine{margin:4px 0}
          .gtoHead{font-weight:700;color:#E2E8F0}
          .gtoBullet{margin:2px 0 2px 12px}
          .concept-highlight{color:#60a5fa;font-weight:700}
          
          /* Platinum gradient text for GTO body */
          .gto-platinum-text{
            background: linear-gradient(to right, #6b7280 0%, #ffffff 40%, #ffffff 60%, #6b7280 100%);
            -webkit-background-clip: text;
            background-clip: text;
            color: transparent;
            -webkit-text-fill-color: transparent;
          }
          
          /* Street header color coding - Optimal (Champagne Gold) - matches holographic chip */
          .street-optimal .gtoHead,
          .gtoHead.street-optimal{
            color: #FFD700;
            font-weight: 700;
          }
          
          /* Street header color coding - Acceptable (Cool Silver) - matches holographic chip */
          .street-acceptable .gtoHead,
          .gtoHead.street-acceptable{
            color: #C0C0C0;
            font-weight: 700;
          }
          
          /* Street header color coding - Mistake (Deep Rose) - matches holographic chip */
          .street-mistake .gtoHead,
          .gtoHead.street-mistake{
            color: #FF6B9D;
            font-weight: 700;
          }
          
          /* Hero text - Blue (matches H: action chips) */
          .hero-text{
            color: #60a5fa;
            font-weight: 600;
          }
          
          /* Villain text - Red (matches V: action chips) */
          .villain-text{
            color: #f87171;
            font-weight: 600;
          }
          
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

          /* Live Preview Chips */
          .parsed-preview{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px;padding:12px;background:rgba(38,38,38,0.5);border-radius:12px;border:1px dashed #525252}
          .preview-chip{
            display:inline-block;
            padding:6px 12px;
            border-radius:999px;
            font-size:12px;
            font-weight:600;
            background:linear-gradient(135deg,#e5e5e5,#9ca3af);
            color:#121212;
            border:none;
            box-shadow:0 2px 4px rgba(0,0,0,0.2);
          }
          
          /* Advanced Options Accordion */
          .advanced-toggle{
            width:100%;
            background:transparent;
            border:none;
            padding:12px 0;
            display:flex;
            justify-content:space-between;
            align-items:center;
            cursor:pointer;
            color:#E2E8F0;
            transition:all 0.2s;
          }
          .advanced-toggle:hover{opacity:0.8}
          .advanced-title{font-size:13px;font-weight:700;color:#E2E8F0}
          .advanced-arrow{font-size:12px;color:#94A3B8;transition:transform 0.2s}
          .advanced-content{
            padding-top:12px;
            animation:slideDown 0.3s ease-out;
          }
          @keyframes slideDown{
            from{opacity:0;transform:translateY(-10px)}
            to{opacity:1;transform:translateY(0)}
          }

          /* Transparency Note */
          .transparency-note{
            margin-top:16px;
            padding:14px;
            background:rgba(59,130,246,0.08);
            border:1px solid rgba(59,130,246,0.2);
            border-radius:12px;
          }
          .transparency-header{
            display:flex;
            align-items:center;
            gap:8px;
            margin-bottom:10px;
          }
          .transparency-icon{font-size:16px}
          .transparency-title{font-size:12px;font-weight:700;color:#60a5fa}
          .transparency-message{
            font-size:12px;
            color:#94A3B8;
            margin-bottom:10px;
            padding:8px;
            background:rgba(0,0,0,0.2);
            border-radius:6px;
          }
          .transparency-items{
            display:flex;
            flex-direction:column;
            gap:6px;
            margin-bottom:10px;
          }
          .transparency-item{
            font-size:11px;
            padding:4px 8px;
            border-radius:6px;
            display:inline-block;
          }
          .transparency-item.missing{
            background:rgba(239,68,68,0.1);
            border:1px solid rgba(239,68,68,0.3);
            color:#fca5a5;
          }
          .transparency-item.defaulted{
            background:rgba(251,191,36,0.1);
            border:1px solid rgba(251,191,36,0.3);
            color:#fde047;
          }
          .transparency-item.inferred{
            background:rgba(34,197,94,0.1);
            border:1px solid rgba(34,197,94,0.3);
            color:#86efac;
          }
          .transparency-hint{
            font-size:11px;
            color:#94A3B8;
            font-style:italic;
            margin-top:8px;
          }
          .transparency-confidence{
            font-size:10px;
            color:#94A3B8;
            margin-left:4px;
          }
        `}</style>
      </main >
    </div >
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
        onChange={(e) => {
          const val = e.target.value;
          setLocal(val);
          onChange(suitifyToken(val)); // Update parent immediately!
        }}
        placeholder={placeholder || 'A♠'}
      />
      <div className="cardEcho" title="Normalized">{echo}</div>
    </div>
  );
}

