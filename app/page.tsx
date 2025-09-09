'use client';

import React, { useMemo, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

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

type Triple = { raise: number; call: number; fold: number };

type Scenario =
  | { kind: 'RFI'; heroPos: Pos }
  | { kind: 'VS_OPEN'; heroPos: Pos; openerPos: Pos };

type Pos = 'UTG' | 'MP' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

/** ------------- Parse helpers ------------- */
const SUIT_MAP: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
const SUIT_WORD: Record<string, string> = {
  spade: '♠', spades: '♠', heart: '♥', hearts: '♥', diamond: '♦', diamonds: '♦', club: '♣', clubs: '♣',
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

const POS_ALIASES: Record<string, Pos> = {
  utg: 'UTG', 'utg+1': 'MP', 'utg+2': 'MP', mp: 'MP', 'middle position': 'MP',
  hj: 'HJ', hijack: 'HJ',
  co: 'CO', cutoff: 'CO',
  btn: 'BTN', button: 'BTN',
  sb: 'SB', 'small blind': 'SB',
  bb: 'BB', 'big blind': 'BB',
};

function findPosWord(s: string): Pos | null {
  const low = s.toLowerCase();
  for (const k of Object.keys(POS_ALIASES)) {
    if (low.includes(` ${k} `) || low.startsWith(`${k} `) || low.endsWith(` ${k}`)) return POS_ALIASES[k];
  }
  return null;
}

// Prefer hero mentions; avoid villain position
const parseHeroPosition = (t: string) => {
  const up = t.toUpperCase();

  const m1 = up.match(/\b(I|I'M|IM|I AM|HERO)\b[^.]{0,40}?\b(ON|FROM|IN)\s+(UTG\+\d|UTG|MP|HJ|CO|BTN|SB|BB)\b/);
  if (m1) return normalizePos(m1[3]);
  const m2 = up.match(/\b(AM|I'M|IM|I)\b[^.]{0,10}?\bON\s+(UTG\+\d|UTG|MP|HJ|CO|BTN|SB|BB)\b/);
  if (m2) return normalizePos(m2[2]);
  const m3 = up.match(/\bON\s+(SB|BB|BTN|CO|HJ|MP|UTG(?:\+\d)?)\b/);
  if (m3) return normalizePos(m3[1]);

  const alias = findPosWord(` ${t} `);
  return alias ?? '';
};

function normalizePos(p: string): Pos {
  const up = p.toUpperCase();
  if (up.startsWith('UTG+')) return 'MP';
  return (['UTG','MP','HJ','CO','BTN','SB','BB'] as Pos[]).includes(up as Pos) ? (up as Pos) : 'BTN';
}

// Find hero cards near "with/holding/I have", handle Ah Qs, A4s, "a4 of spades"
const parseHeroCardsSmart = (t: string) => {
  const s = t.toLowerCase();
  let m = s.match(/\b(?:with|holding|have|having|i\s+have)\s+([2-9tjqka][shdc♥♦♣♠])\s+([2-9tjqka][shdc♥♦♣♠])\b/i);
  if (m) return [suitify(m[1]), suitify(m[2])].join(' ');
  m = s.match(/\b(?:with|holding|have|having|i\s+have)\s*([2-9tjqka])\s*([2-9tjqka])\s*(s|o|suited|offsuit)?(?:\s*of\s*(spades?|hearts?|diamonds?|clubs?))?/i);
  if (m) {
    const r1 = m[1].toUpperCase(), r2 = m[2].toUpperCase();
    const suitWord = (m[4] || '').toLowerCase();
    const suitChar = suitWord ? SUIT_WORD[suitWord] : '♠';
    const suited = m[3] === 's' || m[3] === 'suited' || !!suitWord;
    if (suited) return `${r1}${suitChar} ${r2}${suitChar}`;
    return `${r1}♠ ${r2}♥`;
  }
  m = s.match(/\b([2-9tjqka])\s*([2-9tjqka])\s*of\s*(spades?|hearts?|diamonds?|clubs?)\b/i);
  if (m) {
    const suitChar = SUIT_WORD[(m[3] || '').toLowerCase()];
    return `${m[1].toUpperCase()}${suitChar} ${m[2].toUpperCase()}${suitChar}`;
  }
  m = s.match(/\bwith\b[^.]{0,40}?([2-9tjqka][shdc♥♦♣♠])\s+([2-9tjqka][shdc♥♦♣♠])\b/i);
  if (m) return [suitify(m[1]), suitify(m[2])].join(' ');
  return '';
};

// Parse "Ks 7d 2c 9c 4h" → {flop,turn,river}
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
    if (all.length >= 5) { flop = flop || all.slice(0, 3).join(' '); turn = turn || all[3]; river = river || all[4]; }
  }
  return { flop, turn, river };
};

const twoCardsFrom = (line: string) =>
  suitifyLine(line).split(' ').slice(0, 2).join(' ');

const CardSpan = ({ c }: { c: string }) =>
  !c ? null : <span style={{ fontWeight: 600, color: suitColor(c.slice(-1)) }}>{c}</span>;

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

/** ---------- Ranks / labels ---------- */
const RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'] as const;
function handLabel(i: number, j: number): string {
  const a = RANKS[i], b = RANKS[j];
  if (i === j) return `${a}${a}`;
  return i < j ? `${a}${b}s` : `${a}${b}o`;
}
const LABELS = (() => {
  const out: string[] = [];
  for (let i = 0; i < RANKS.length; i++) for (let j = 0; j < RANKS.length; j++) out.push(handLabel(i,j));
  return out;
})();

/** ---------- Scenario detection ---------- */
function detectOpener(text: string): Pos | null {
  const t = ` ${text.toLowerCase()} `;
  // Explicit “<pos> raises / opens”
  for (const [key, pos] of Object.entries(POS_ALIASES)) {
    const rex = new RegExp(`\\b${key}\\b[^.]{0,18}\\b(raises?|opens?)\\b`);
    if (rex.test(t)) return pos;
  }
  // “villain in cutoff raises”
  const m = t.match(/\bvillain\b[^.]{0,15}\b(in|from)\b[^.]{0,8}\b([a-z+ ]{2,8})\b[^.]{0,12}\b(raises?|opens?)\b/);
  if (m) {
    const p = POS_ALIASES[(m[2] || '').trim()];
    if (p) return p;
  }
  return null;
}

function detectScenario(input: string, heroPos: Pos): Scenario {
  const opener = detectOpener(input);
  if (!opener || opener === heroPos) return { kind: 'RFI', heroPos };
  return { kind: 'VS_OPEN', heroPos, openerPos: opener };
}

/** ---------- Baseline grid generator ---------- */
type Grid = Record<string, Triple>;
const zeroTriple: Triple = { raise: 0, call: 0, fold: 100 };

function emptyGrid(): Grid {
  const g: Grid = {};
  for (const L of LABELS) g[L] = { ...zeroTriple };
  return g;
}

const rIndex: Record<string, number> = Object.fromEntries(RANKS.map((r, i) => [r, i]));
const atLeast = (rank: string, min: string) => rIndex[rank] <= rIndex[min];

function isPair(lbl: string) { return lbl.length === 2; }
function isSuited(lbl: string) { return lbl.length === 3 && lbl.endsWith('s'); }
function isOff(lbl: string) { return lbl.length === 3 && lbl.endsWith('o'); }
function hi(lbl: string) { return lbl[0]; }
function lo(lbl: string) { return isPair(lbl) ? lbl[1] : lbl[1]; }

/** RFI (open) baselines by position — % raise, call=0, fold=100-raise */
function gridRFI(pos: Pos): Grid {
  const g = emptyGrid();
  for (const L of LABELS) {
    const pair = isPair(L);
    const suited = isSuited(L);
    const offsuit = isOff(L);
    const a = hi(L), b = lo(L);
    let open = 0;

    // Pairs: tighten early, widen late
    if (pair) {
      const min: Record<Pos, string> = { UTG:'6', MP:'4', HJ:'3', CO:'2', BTN:'2', SB:'2', BB:'9' };
      open = atLeast(a, min[pos]) ? 100 : 0;
      if (pos === 'CO' && atLeast(a,'3') && !atLeast(a,'9')) open = 80;
      if (pos === 'HJ' && atLeast(a,'5') && !atLeast(a,'9')) open = 80;
      if (pos === 'SB') open = atLeast(a,'4') ? 90 : 0;
    }

    // Suited Ax: always good opens; offsuit gets trimmed early
    else if (a === 'A') {
      if (suited) {
        const min: Record<Pos, string> = { UTG:'5', MP:'4', HJ:'3', CO:'2', BTN:'2', SB:'2', BB:'9' };
        open = atLeast(b, min[pos]) ? 100 : 0;
      } else {
        const minOff: Record<Pos, string> = { UTG:'T', MP:'T', HJ:'9', CO:'8', BTN:'5', SB:'8', BB:'T' };
        open = atLeast(b, minOff[pos]) ? 100 : 0;
        if (pos === 'BTN' && atLeast(b,'2')) open = 70;
        if (pos === 'SB' && atLeast(b,'5')) open = 60;
      }
    }

    // Broadways suited
    else if (suited && ['K','Q','J','T'].includes(a)) {
      const minS: Record<Pos, string> = { UTG:'9', MP:'9', HJ:'8', CO:'6', BTN:'2', SB:'7', BB:'9' };
      open = atLeast(b, minS[pos]) ? 100 : 0;
      if (pos === 'BTN' && atLeast(b,'7')) open = 80;
      if (pos === 'SB' && atLeast(b,'7')) open = 70;
    }

    // Broadways off
    else if (offsuit && ['K','Q','J','T'].includes(a)) {
      const minO: Record<Pos, string> = { UTG:'Q', MP:'J', HJ:'T', CO:'T', BTN:'9', SB:'T', BB:'Q' };
      open = atLeast(b, minO[pos]) ? 100 : 0;
      if (pos === 'BTN' && (a==='K'||a==='Q') && atLeast(b,'8')) open = 70;
    }

    // Suited connectors / gappers (late widen)
    else if (suited) {
      const goodSC = (x:string,y:string)=> (a===x&&b===y)||(a===y&&b===x);
      const SC = [['9','8'], ['8','7'], ['7','6'], ['6','5'], ['5','4']];
      const isSC = SC.some(([x,y])=>goodSC(x,y));
      if (isSC) {
        const allow: Record<Pos, number> = { UTG:0, MP:20, HJ:60, CO:90, BTN:100, SB:80, BB:0 };
        open = allow[pos];
      } else {
        if (pos === 'BTN') open = 40;
        else if (pos === 'CO') open = 20;
      }
    }

    const raise = Math.max(0, Math.min(100, Math.round(open)));
    g[L] = { raise, call: 0, fold: 100 - raise };
  }
  return g;
}

/** VS OPEN tables — core node we discussed: SB vs CO.
 *  For other pairs we apply analogous logic (BB calls more, BTN calls more & 3-bets polar, etc.)
 */
function gridVsOpen(hero: Pos, opener: Pos): Grid {
  const g = emptyGrid();

  // Helper to set a group with a mix
  const set = (labels: string[], mix: Triple) => { for (const L of labels) g[L] = { ...mix }; };

  const sx = (hi: string, lows: string[]) => lows.map(l => `${hi}${l}s`);

  /** --- SB vs CO (agreed baseline) --- */
  if (hero === 'SB' && opener === 'CO') {
    // Pairs
    set(['AA','KK','QQ'], { raise:100, call:0, fold:0 });
    set(['JJ'], { raise:70, call:30, fold:0 });
    set(['TT'], { raise:60, call:40, fold:0 });
    set(['99','88','77','66'], { raise:30, call:60, fold:10 });
    set(['55','44','33','22'], { raise:10, call:50, fold:40 });

    // Suited Ax
    set(['AKs'], { raise:100, call:0, fold:0 });
    set(['AQs'], { raise:70, call:30, fold:0 });
    set(['AJs'], { raise:50, call:40, fold:10 });
    set(['ATs'], { raise:30, call:50, fold:20 });
    set(sx('A',['9','8','7','6']), { raise:25, call:45, fold:30 });
    set(sx('A',['5','4','3','2']), { raise:45, call:25, fold:30 });

    // Offsuit Ax
    set(['AKo'], { raise:100, call:0, fold:0 });
    set(['AQo'], { raise:60, call:20, fold:20 });
    set(['AJo'], { raise:30, call:30, fold:40 });
    set(['ATo'], { raise:10, call:20, fold:70 });
    for (const b of ['9','8','7','6','5','4','3','2']) set([`A${b}o`], { raise:0, call:0, fold:100 });

    // Suited broadways
    set(['KQs'], { raise:60, call:40, fold:0 });
    set(['KJs'], { raise:35, call:45, fold:20 });
    set(['KTs'], { raise:20, call:45, fold:35 });
    set(['QJs'], { raise:30, call:55, fold:15 });
    set(['QTs'], { raise:15, call:45, fold:40 });
    set(['JTs'], { raise:20, call:55, fold:25 });
    set(['T9s'], { raise:15, call:50, fold:35 });

    // Off broadways
    set(['KQo'], { raise:15, call:25, fold:60 });
    set(['KJo'], { raise:10, call:20, fold:70 });
    set(['QJo'], { raise:0, call:20, fold:80 });
    set(['JTo'], { raise:0, call:5, fold:95 });

    // Other suited Kx/Qx
    set(['K9s'], { raise:10, call:40, fold:50 });
    set(['K8s'], { raise:5, call:30, fold:65 });
    set(['K7s','K6s'], { raise:0, call:25, fold:75 });
    set(['Q9s'], { raise:10, call:40, fold:50 });
    set(['Q8s'], { raise:5, call:25, fold:70 });
    set(['Q7s','Q6s'], { raise:0, call:20, fold:80 });

    // SCs / gappers
    set(['98s'], { raise:15, call:50, fold:35 });
    set(['87s','76s','65s'], { raise:10, call:45, fold:45 });
    set(['54s'], { raise:10, call:35, fold:55 });
    set(['43s'], { raise:5, call:25, fold:70 });
    set(['32s'], { raise:0, call:20, fold:80 });

    // Fill the rest with folds
    for (const L of LABELS) if (!(L in g) || g[L].fold === 100) g[L] = { ...zeroTriple };
    return g;
  }

  /** --- BTN vs CO open: call more, polar 3-bet --- */
  if (hero === 'BTN' && opener === 'CO') {
    // Pairs
    set(['AA','KK','QQ'], { raise:65, call:35, fold:0 });
    set(['JJ','TT'], { raise:40, call:60, fold:0 });
    set(['99','88','77'], { raise:25, call:70, fold:5 });
    set(['66','55','44','33','22'], { raise:10, call:65, fold:25 });

    // Suited Ax (polarize with A5–A2s)
    set(['AKs'], { raise:70, call:30, fold:0 });
    set(['AQs','AJs'], { raise:45, call:55, fold:0 });
    set(['ATs','A9s','A8s'], { raise:25, call:65, fold:10 });
    set(sx('A',['7','6']), { raise:15, call:65, fold:20 });
    set(sx('A',['5','4','3','2']), { raise:40, call:40, fold:20 });

    // Offsuit Ax
    set(['AKo'], { raise:70, call:30, fold:0 });
    set(['AQo'], { raise:35, call:45, fold:20 });
    set(['AJo'], { raise:15, call:40, fold:45 });
    for (const b of ['T','9','8','7','6','5','4','3','2']) set([`A${b}o`], { raise:0, call:0, fold:100 });

    // Suited broadways
    set(['KQs','QJs','KJs'], { raise:30, call:70, fold:0 });
    set(['KTs','QTs','JTs'], { raise:20, call:70, fold:10 });
    set(['T9s'], { raise:15, call:70, fold:15 });

    // Off broadways
    set(['KQo'], { raise:15, call:55, fold:30 });
    set(['QJo'], { raise:5, call:40, fold:55 });
    set(['JTo'], { raise:0, call:25, fold:75 });

    // SCs/gappers
    set(['98s','87s','76s','65s'], { raise:15, call:70, fold:15 });
    set(['54s','43s'], { raise:10, call:60, fold:30 });

    for (const L of LABELS) if (!(L in g) || g[L].fold === 100) g[L] = { ...zeroTriple };
    return g;
  }

  /** --- BB vs BTN open: defend a lot, 3-bet value + polar --- */
  if (hero === 'BB' && opener === 'BTN') {
    // Pairs
    set(['AA','KK','QQ'], { raise:65, call:35, fold:0 });
    set(['JJ','TT'], { raise:35, call:60, fold:5 });
    set(['99','88','77','66','55','44','33','22'], { raise:15, call:75, fold:10 });

    // Suited Ax
    set(['AKs'], { raise:55, call:45, fold:0 });
    set(['AQs','AJs'], { raise:30, call:65, fold:5 });
    set(['ATs','A9s','A8s','A7s','A6s'], { raise:15, call:70, fold:15 });
    set(['A5s','A4s','A3s','A2s'], { raise:25, call:60, fold:15 });

    // Off Ax
    set(['AKo'], { raise:50, call:45, fold:5 });
    set(['AQo'], { raise:20, call:55, fold:25 });
    set(['AJo'], { raise:10, call:45, fold:45 });
    for (const b of ['T','9','8','7','6','5','4','3','2']) set([`A${b}o`], { raise:0, call:15, fold:85 });

    // Suited broadways
    set(['KQs','QJs','KJs'], { raise:20, call:75, fold:5 });
    set(['KTs','QTs','JTs'], { raise:10, call:75, fold:15 });
    set(['T9s'], { raise:10, call:75, fold:15 });

    // Off broadways
    set(['KQo'], { raise:10, call:55, fold:35 });
    set(['QJo','KJo'], { raise:5, call:45, fold:50 });
    set(['JTo'], { raise:0, call:35, fold:65 });

    // SCs/gappers
    set(['98s','87s','76s','65s','54s'], { raise:10, call:75, fold:15 });
    set(['43s','32s'], { raise:5, call:60, fold:35 });

    for (const L of LABELS) if (!(L in g) || g[L].fold === 100) g[L] = { ...zeroTriple };
    return g;
  }

  /** --- Generic fallback (other hero/opener combos) --- */
  const rfi = gridRFI(hero);
  for (const L of LABELS) {
    const base = rfi[L].raise; // 0..100 playability weight
    if (base === 0) { g[L] = { ...zeroTriple }; continue; }

    // seat tendencies
    let raiseW = 0, callW = 0;
    const pair = isPair(L), suited = isSuited(L), offsuit = isOff(L);
    if (hero === 'BB') {          // lots of flats, some 3-bet
      callW = base * (pair ? 0.8 : suited ? 0.75 : 0.55);
      raiseW = base - callW;
    } else if (hero === 'BTN') {  // flat a lot; polar 3-bet
      callW = base * (pair ? 0.75 : suited ? 0.7 : 0.5);
      raiseW = base - callW;
    } else if (hero === 'SB') {   // less flat than BB/BTN, more 3-bet
      callW = base * (pair ? 0.6 : suited ? 0.55 : 0.35);
      raiseW = base - callW;
    } else {                      // CO/HJ/MP vs earlier seats
      callW = base * (pair ? 0.55 : suited ? 0.45 : 0.25);
      raiseW = base - callW;
    }

    // ----- FIXED: use let, then normalize totals -----
    const clamp = (x: number) => Math.max(0, Math.min(100, Math.round(x)));
    let raise = clamp(raiseW);
    let call  = clamp(callW);
    let fold  = 100 - raise - call;

    if (fold < 0) {
      const over = -fold;
      if (call >= over) {
        call -= over;
        fold = 0;
      } else {
        const leftover = over - call;
        call = 0;
        raise = Math.max(0, raise - leftover);
        fold = 0;
      }
    }

    g[L] = { raise, call, fold };
  }
  return g;
}

/** Gradient background for a cell: raise (top) / call (middle) / fold (bottom) */
function cellBackground({ raise, call, fold }: Triple) {
  const r = Math.max(0, Math.min(100, raise|0));
  const c = Math.max(0, Math.min(100, call|0));
  const f = Math.max(0, Math.min(100, fold|0));
  const r2 = r, c2 = r + c, f2 = 100;
  return `linear-gradient(180deg, var(--raise) 0% ${r2}%, var(--call) ${r2}% ${c2}%, var(--fold) ${c2}% ${f2}%)`;
}

/** ---------------- Component ---------------- */
export default function Page() {
  // INPUT
  const [input, setInput] = useState('');
  const [fields, setFields] = useState<Fields | null>(null);

  // Card Assist
  const [heroAssist, setHeroAssist] = useState('');
  const [villainAssist, setVillainAssist] = useState('');
  const [boardAssist, setBoardAssist] = useState('');

  // Async state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Lightweight parse for preview
  const preview = useMemo(() => ({
    stakes: parseStakes(input),
    position: parseHeroPosition(input),
    heroCards: parseHeroCardsSmart(input),
    board: parseBoard(input),
  }), [input]);

  // Resolve values with assist (Hero cards are REQUIRED)
  const heroCards = (twoCardsFrom(heroAssist) || twoCardsFrom(preview.heroCards) || '').trim();
  const heroCardsValid = heroCards.split(' ').filter(Boolean).length === 2;

  const boardFromAssist = parseBoardFromText(boardAssist);
  const flop = (boardAssist ? boardFromAssist.flop : preview.board.flop) || '';
  const turn = (boardAssist ? boardFromAssist.turn : preview.board.turn) || '';
  const river = (boardAssist ? boardFromAssist.river : preview.board.river) || '';
  const heroPos: Pos = (fields?.position as Pos) || (normalizePos(preview.position || 'BTN'));
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  /** Scenario + grid (deterministic, no API) */
  const scenario: Scenario = useMemo(() => detectScenario(input, heroPos), [input, heroPos]);
  const gridTriples: Record<string, Triple> = useMemo(() => {
    if (scenario.kind === 'RFI') return gridRFI(scenario.heroPos);
    return gridVsOpen(scenario.heroPos, scenario.openerPos);
  }, [scenario]);

  const opened = Object.values(gridTriples).filter(t => t.raise + t.call > 0).length;

  /** Analyze hand (server AI) */
  async function analyzeParsedHand(parsed: Fields) {
    setAiError(null);
    setAiLoading(true);
    try {
      const payload = {
        date: parsed.date ?? undefined,
        stakes: parsed.stakes ?? (preview.stakes || undefined),
        position: parsed.position ?? (preview.position || undefined),
        cards: parsed.cards ?? (heroCards || undefined),   // REQUIRED & validated
        villainAction: parsed.villain_action ?? parsed.villian_action ?? undefined,
        board: [flop && `Flop: ${flop}`, turn && `Turn: ${turn}`, river && `River: ${river}`].filter(Boolean).join('  |  '),
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
          cards: heroCards, // persist the validated hero cards
        };
      });
    } catch (e: any) {
      setAiError(e.message || 'AI analysis error');
    } finally {
      setAiLoading(false);
    }
  }

  /** Parse → then AI */
  async function handleParse() {
    setStatus(null);
    setAiError(null);
    try {
      if (!heroCardsValid) throw new Error('Please enter your two Hero cards (e.g., Ah Qs).');
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

  const scenarioLabel =
    scenario.kind === 'RFI'
      ? `${scenario.heroPos} — RFI`
      : `${scenario.heroPos} vs ${scenario.openerPos} open`;

  return (
    <main className="p-page">
      <div className="p-container">
        <header className="p-header">
          <h1 className="p-title">Only Poker</h1>
        </header>

        <section className="p-grid">
          {/* LEFT */}
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
                <button
                  className="p-btn p-primary"
                  onClick={handleParse}
                  disabled={!input.trim() || !heroCardsValid || aiLoading}
                  title={!heroCardsValid ? 'Enter Hero cards (e.g., Ah Qs) in the assist box' : undefined}
                >
                  {aiLoading ? 'Analyzing…' : 'Send'}
                </button>
                <button
                  className="p-btn"
                  onClick={() => {
                    setInput('');
                    setFields(null);
                    setStatus(null);
                    setAiError(null);
                    setHeroAssist('');
                    setVillainAssist('');
                    setBoardAssist('');
                  }}
                >
                  Clear
                </button>
              </div>
              {!heroCardsValid && <div className="p-err" style={{marginTop:8}}>Hero cards required — e.g., <strong>Ah Qs</strong> or <strong>Ks Kd</strong>.</div>}
              {aiError && <div className="p-err">{aiError}</div>}
              {status && <div className="p-note">{status}</div>}
            </div>

            <div className="p-card">
              <div className="p-cardTitle">Quick Card Assist (optional)</div>
              <div className="p-assist3">
                <input className="p-input" value={heroAssist} onChange={(e)=>setHeroAssist(e.target.value)} placeholder="Hero: Ah Qs (required)" />
                <input className="p-input" value={villainAssist} onChange={(e)=>setVillainAssist(e.target.value)} placeholder="Villain (optional): Kc Kd" />
                <input className="p-input" value={boardAssist} onChange={(e)=>setBoardAssist(e.target.value)} placeholder="Board: Ks 7d 2c 9c 4h" />
              </div>
              <div className="p-help">If parsing guesses wrong, correct the board here — the preview updates instantly.</div>
            </div>

            {/* --- Deterministic Range Grid --- */}
            <div className="p-card" style={{overflow:'visible'}}>
              <div className="p-subTitle">Hero Decision Frequencies — {scenarioLabel} <span className="p-muted">({opened} / 169 combos shown)</span></div>

              <div className="legendRow">
                <div className="legendItem"><span className="dot raise" /> Raise</div>
                <div className="legendItem"><span className="dot call" /> Call</div>
                <div className="legendItem"><span className="dot fold" /> Fold</div>
                <div className="legendHint">Hover a cell to zoom; tooltip shows exact %</div>
              </div>

              <div className="rangeGrid fixed">
                <div className="rangeCorner" />
                {RANKS.map((r, j) => <div key={`h-${j}`} className="rangeHead">{r}</div>)}
                {RANKS.map((r, i) => (
                  <React.Fragment key={`row-${i}`}>
                    <div className="rangeHead">{r}</div>
                    {RANKS.map((c, j) => {
                      const lbl = handLabel(i, j);
                      const t = gridTriples[lbl] || zeroTriple;
                      return (
                        <div
                          key={lbl}
                          className={`cell show ${i === j ? 'pair' : (i < j ? 'suited' : 'offsuit')}`}
                          style={{ background: cellBackground(t) }}
                          title={`${lbl}: Raise ${t.raise}%, Call ${t.call}%, Fold ${t.fold}%`}
                        >
                          {lbl}
                        </div>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="p-col">
            <div className="p-card">
              <div className="p-topRow"><TagChips /></div>

              <div className="p-grid2">
                <InfoBox label="Cards">
                  <div className="p-cards">
                    {heroCardsValid
                      ? heroCards.split(' ').map((c, i) => <span key={i} className="p-cardSpan"><CardSpan c={c} /></span>)
                      : <span className="p-muted">(required)</span>}
                  </div>
                </InfoBox>
                <InfoBox label="Date"><div>{today}</div></InfoBox>
                <InfoBox label="Position"><div>{heroPos}</div></InfoBox>
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

          --raise:#ee8d73;      /* raise */
          --call:#60a5fa;       /* call  */
          --fold:#374151;       /* fold  */
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

        .p-assist3{display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:10px}
        @media (max-width:800px){.p-assist3{grid-template-columns:1fr}}
        .p-input{
          width:100%; padding:10px 12px; border-radius:12px; border:1px solid var(--line);
          background:#ffffff; color:#0f172a; font-size:14.5px;
        }
        .p-input.p-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace; line-height:1.45}

        .p-help{margin-top:8px; font-size:12px; color:#6b7280}
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

        /* ------- Range grid styles (fixed) ------- */
        .legendRow{display:flex; align-items:center; gap:12px; margin-bottom:8px}
        .legendItem{display:flex; align-items:center; gap:6px; font-size:12.5px; color:#334155}
        .legendHint{margin-left:auto; font-size:12px; color:#64748b}
        .dot{width:12px;height:12px;border-radius:4px;display:inline-block;border:1px solid #cbd5e1}
        .dot.raise{background:var(--raise)}
        .dot.call{background:var(--call)}
        .dot.fold{background:var(--fold)}

        .rangeGrid{
          display:grid;
          grid-template-columns: 28px repeat(13, 1fr);
          grid-auto-rows: 26px;
          gap: 4px;
          align-items:center;
          position:relative;
        }
        .rangeHead{font-size:12px; color:#64748b; text-align:center; line-height:26px}
        .rangeCorner{width:28px;height:26px}
        .cell{
          border:1px solid #cbd5e1;
          border-radius:6px;
          font-size:11.5px;
          display:flex; align-items:center; justify-content:center;
          user-select:none;
          box-shadow: inset 0 0 0 1px rgba(0,0,0,.02);
          color:#111827;
          position:relative;
          transition: transform .08s ease, box-shadow .15s ease;
        }
        .cell.show:hover{
          transform: scale(1.8);
          z-index: 10;
          box-shadow: 0 10px 24px rgba(0,0,0,.25);
        }
        .fixed .cell{ cursor:default }
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
