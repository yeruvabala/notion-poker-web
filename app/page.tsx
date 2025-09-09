'use client';

import React, { useMemo, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

/* ============================================================
   Types
============================================================ */
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
type Grid = Record<string, Triple>;

type Pos = 'UTG' | 'MP' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

type NodeKind =
  | 'RFI'
  | 'LIMP_ISO'
  | 'LIMP_OVERLIMP'
  | 'LIMP_BACKRAISE'
  | 'SB_COMPLETE'
  | 'BB_CHECK'
  | 'VS_OPEN'           // HU vs open
  | 'SQUEEZE'           // open + caller(s) behind
  | 'OPENER_VS_3BET'    // opener facing 3-bet
  | 'CALLER_VS_3BET'    // caller facing 3-bet behind
  | 'COLD_4BET'         // open -> 3bet -> hero
  | 'THREEBETTOR_VS_4BET'
  | 'BVB_SB_OPEN'       // folded to SB
  | 'BVB_BB_VS_SB_RAISE'
  | 'BVB_BB_VS_SB_LIMP';

type Node =
  | { kind: 'RFI'; heroPos: Pos }
  | { kind: 'LIMP_ISO' | 'LIMP_OVERLIMP' | 'SB_COMPLETE' | 'BB_CHECK'; heroPos: Pos; limpers: number }
  | { kind: 'LIMP_BACKRAISE'; heroPos: Pos }
  | { kind: 'VS_OPEN'; heroPos: Pos; openerPos: Pos; heroIP: boolean }
  | { kind: 'SQUEEZE'; heroPos: Pos; openerPos: Pos; callers: number; heroIP: boolean }
  | { kind: 'OPENER_VS_3BET'; openerPos: Pos; threeBettorPos: Pos; openerIP: boolean }
  | { kind: 'CALLER_VS_3BET'; callerPos: Pos; threeBettorPos: Pos; callerIP: boolean }
  | { kind: 'COLD_4BET'; heroPos: Pos; openerPos: Pos; threeBettorPos: Pos; heroIP: boolean }
  | { kind: 'THREEBETTOR_VS_4BET'; threeBettorPos: Pos; fourBettorPos: Pos; threeBettorIP: boolean }
  | { kind: 'BVB_SB_OPEN' }
  | { kind: 'BVB_BB_VS_SB_RAISE' }
  | { kind: 'BVB_BB_VS_SB_LIMP' };

/* ============================================================
   Parsing helpers & utilities
============================================================ */
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
  (line || '')
    .replace(/[\/,|]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(suitify)
    .filter(Boolean)
    .join(' ');

const parseStakes = (t: string) => {
  const m = t.match(/(\$?\d+(?:\.\d+)?)[\s]*[\/-][\s]*(\$?\d+(?:\.\d+)?)/);
  return m ? `${m[1]}/${m[2]}` : '';
};

const parseBigBlindFromStakes = (stakes: string): number | null => {
  // accepts "1/3", "$2/$5", "200NL" (returns 2 as BB? skip), prefer explicit x/y
  const m = stakes.match(/(?:\$?\d+(?:\.\d+)?)\s*[\/-]\s*(\$?\d+(?:\.\d+)?)/);
  if (!m) return null;
  const raw = m[1].replace('$', '');
  const v = Number(raw);
  return Number.isFinite(v) ? v : null;
};

const parseStackBB = (t: string, stakes: string | undefined): number | null => {
  const s = t.toLowerCase();

  // explicit "200bb", "150 bb"
  const m1 = s.match(/(\d{2,3})\s*bb\b/);
  if (m1) return Math.max(20, Math.min(400, Number(m1[1])));

  // "$400 effective", "eff $300"
  const m2 = s.match(/\$?\s*(\d{2,5})(?:\.\d+)?\s*(effective|eff|stack)?/);
  if (m2 && stakes) {
    const bb = parseBigBlindFromStakes(stakes || '');
    const usd = Number(m2[1]);
    if (bb && usd) {
      const bbDepth = Math.round((usd / bb) * 1) as number;
      if (bbDepth >= 20 && bbDepth <= 400) return bbDepth;
    }
  }
  return null;
};

const POS_ALIASES: Record<string, Pos> = {
  utg: 'UTG', 'utg+1': 'MP', 'utg+2': 'MP',
  mp: 'MP', 'middle position': 'MP',
  hj: 'HJ', hijack: 'HJ',
  co: 'CO', cutoff: 'CO',
  btn: 'BTN', button: 'BTN',
  sb: 'SB', 'small blind': 'SB',
  bb: 'BB', 'big blind': 'BB',
};
function normalizePos(p: string): Pos {
  const up = p.toUpperCase();
  if (up.startsWith('UTG+')) return 'MP';
  const ok = ['UTG','MP','HJ','CO','BTN','SB','BB'] as const;
  return (ok.includes(up as Pos) ? (up as Pos) : 'BTN');
}
function findPosWord(s: string): Pos | null {
  const low = s.toLowerCase();
  for (const k of Object.keys(POS_ALIASES)) {
    if (low.includes(` ${k} `) || low.startsWith(`${k} `) || low.endsWith(` ${k}`)) return POS_ALIASES[k];
  }
  return null;
}

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

const parseHeroCardsSmart = (t: string) => {
  const s = t.toLowerCase();
  let m = s.match(/\b(?:with|holding|have|having|i\s+have)\s+([2-9tjqka][shdc♥♦♣♠])\s+([2-9tjqka][shdc♥♦♣♠])\b/i);
  if (m) return [suitify(m[1]), suitify(m[2])].join(' ');
  m = s.match(/\b([2-9tjqka])\s*([2-9tjqka])\s*(s|o|suited|offsuit)?(?:\s*of\s*(spades?|hearts?|diamonds?|clubs?))?/i);
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

/* ============================================================
   Ranks & grid labeling
============================================================ */
const RANKS = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'] as const;
function handLabel(i: number, j: number): string {
  const a = RANKS[i], b = RANKS[j];
  if (i === j) return `${a}${a}`;
  return i < j ? `${a}${b}s` : `${a}${b}o`;
}
const LABELS: string[] = (() => {
  const out: string[] = [];
  for (let i = 0; i < RANKS.length; i++) for (let j = 0; j < RANKS.length; j++) out.push(handLabel(i,j));
  return out;
})();

const rIndex: Record<string, number> = Object.fromEntries(RANKS.map((r, i) => [r, i]));
const atLeast = (rank: string, min: string) => rIndex[rank] <= rIndex[min];
const isPair = (lbl: string) => lbl.length === 2;
const isSuited = (lbl: string) => lbl.endsWith('s');
const isOff = (lbl: string) => lbl.endsWith('o');
const hi = (lbl: string) => lbl[0];
const lo = (lbl: string) => lbl.length === 2 ? lbl[1] : lbl[1];

/* ============================================================
   Node detection (cash)
   - Returns a Node or null (if not enough info)
============================================================ */
const order: Pos[] = ['UTG','MP','HJ','CO','BTN','SB','BB'];
const posIndex = (p: Pos) => order.indexOf(p);
const heroIPvs = (hero: Pos, villain: Pos): boolean => {
  // Postflop IP heuristic
  if (hero === 'BTN') return true;
  if (hero === 'SB' || hero === 'BB') return false;
  return posIndex(hero) > posIndex(villain);
};

function detectNode(text: string, heroPosRaw: string): Node | null {
  const heroPos = (heroPosRaw ? normalizePos(heroPosRaw) : '') as Pos | '';
  if (!heroPos) return null;

  const s = ` ${text.toLowerCase()} `;

  // Quick BvB lane
  if (heroPos === 'SB' && /\bfold(?:s|ed)?\s+to\s+(?:me|sb)\b/.test(s)) {
    return { kind: 'BVB_SB_OPEN' };
  }
  if (heroPos === 'BB') {
    if (/\bsb\s+(?:min-?raises?|raises?)\b/.test(s)) return { kind: 'BVB_BB_VS_SB_RAISE' };
    if (/\bsb\s+(?:limps?|completes?)\b/.test(s)) return { kind: 'BVB_BB_VS_SB_LIMP' };
  }

  // Limp family
  const limpers = (s.match(/\blimp(?:s|ed)?\b/g) || []).length;
  if (limpers > 0) {
    if (/\b(iso|isolate|isolates|iso-raises?)\b/.test(s)) {
      return { kind: 'LIMP_ISO', heroPos: heroPos, limpers };
    }
    if (/\blimp-?reraise\b|\bback-?raise\b/.test(s)) {
      return { kind: 'LIMP_BACKRAISE', heroPos: heroPos };
    }
    if (heroPos === 'SB' && /\bcompletes?\b|\blimp(?:s|ed)?\b/.test(s)) {
      return { kind: 'SB_COMPLETE', heroPos, limpers };
    }
    if (/\bover-?limp\b|\boverlimp\b/.test(s)) {
      return { kind: 'LIMP_OVERLIMP', heroPos, limpers };
    }
    if (/\breaches\s+bb\b|\bb\b\b\s*checks?\b/.test(s)) {
      return { kind: 'BB_CHECK', heroPos, limpers };
    }
  }

  // Explicit open + caller(s) → squeeze/overcall
  const opener = detectOpenerPos(s);
  const callers = (s.match(/\b(call|calls|flat|flats)\b/g) || []).length;
  const threet = /\b3\s*bet|3bet|three-?bet\b/;
  const fourt = /\b4\s*bet|4bet|four-?bet\b/;

  if (opener) {
    // If there is a 3-bet present before hero acts → cold 4-bet node
    if (threet.test(s) && !fourt.test(s)) {
      // Guess the 3-bettor seat if mentioned
      const threePos = detectSpecificPosAfterVerb(s, /(3\s*bet|3bet|three-?bet)/);
      const threeBettorPos: Pos = threePos || 'BTN';
      return { kind: 'COLD_4BET', heroPos: heroPos, openerPos: opener, threeBettorPos, heroIP: heroIPvs(heroPos, opener) };
    }
    // If someone already called the open → squeeze node
    if (callers >= 1) {
      return { kind: 'SQUEEZE', heroPos, openerPos: opener, callers, heroIP: heroIPvs(heroPos, opener) };
    }
    // else standard Vs-Open HU
    return { kind: 'VS_OPEN', heroPos, openerPos: opener, heroIP: heroIPvs(heroPos, opener) };
  }

  // Facing 3-bet / 4-bet dynamics described explicitly
  if (fourt.test(s)) {
    // If we 3-bet and face a 4-bet
    if (/\b(i|hero)\b[^.]{0,40}\b(3\s*bet|3bet|three-?bet)/i.test(text) && /\b4\s*bet|4bet|four-?bet/i.test(text)) {
      const threeBettorPos = heroPos as Pos;
      const fourBettorPos = detectSpecificPosAfterVerb(s, /(4\s*bet|4bet|four-?bet)/) || 'BTN';
      return { kind: 'THREEBETTOR_VS_4BET', threeBettorPos, fourBettorPos, threeBettorIP: true };
    }
  }
  if (threet.test(s) && /\b(i|hero)\s+opened\b|\bI\s+raise\b/i.test(text)) {
    const threePos = detectSpecificPosAfterVerb(s, /(3\s*bet|3bet|three-?bet)/) || 'BTN';
    const openerIP = heroIPvs(heroPos, threePos);
    return { kind: 'OPENER_VS_3BET', openerPos: heroPos, threeBettorPos: threePos, openerIP };
  }
  if (threet.test(s) && /\bI\s+call\b|\bI\s+flat\b/i.test(text)) {
    const threePos = detectSpecificPosAfterVerb(s, /(3\s*bet|3bet|three-?bet)/) || 'BTN';
    return { kind: 'CALLER_VS_3BET', callerPos: heroPos, threeBettorPos: threePos, callerIP: false };
  }

  // RFI only if clearly "folded to me"
  if (/\bfold(?:s|ed)?\s+to\s+(?:me|hero)\b/.test(s)) {
    return { kind: 'RFI', heroPos };
  }

  // Not enough info
  return null;
}

function detectOpenerPos(s: string): Pos | null {
  for (const [key, pos] of Object.entries(POS_ALIASES)) {
    const rex = new RegExp(`\\b${key}\\b[^.]{0,18}\\b(raises?|opens?)\\b`);
    if (rex.test(s)) return pos;
  }
  // "villain in cutoff raises"
  const m = s.match(/\bvillain\b[^.]{0,15}\b(in|from)\b[^.]{0,8}\b([a-z+ ]{2,8})\b[^.]{0,12}\b(raises?|opens?)\b/);
  if (m) {
    const p = POS_ALIASES[(m[2] || '').trim()];
    if (p) return p;
  }
  return null;
}
function detectSpecificPosAfterVerb(s: string, verbRe: RegExp): Pos | null {
  // find "BTN 3-bets", "SB 4-bets", etc.
  const m = s.match(new RegExp(`\\b(utg\\+?\\d?|utg|mp|hj|co|cutoff|btn|button|sb|bb)\\b[^.]{0,10}${verbRe.source}`, 'i'));
  if (!m) return null;
  return POS_ALIASES[m[1].toLowerCase()] || null;
}

/* ============================================================
   Baseline generators (deterministic)
   - All return full 169-cell grids with sane mixes.
   - Stack-aware (tighter at 100bb, looser at 200bb).
============================================================ */
const zeroTriple: Triple = { raise: 0, call: 0, fold: 100 };
const emptyGrid = (): Grid => Object.fromEntries(LABELS.map(L => [L, { ...zeroTriple }]));

const strengthScore = (L: string) => {
  // 0..100 crude hand strength/playability baseline
  if (isPair(L)) {
    const a = hi(L);
    return 45 + (12 - rIndex[a]) * 4; // AA=93.., 22~45
  }
  const a = hi(L), b = lo(L);
  if (a === 'A' && isSuited(L)) return 65 + Math.max(0, 8 - rIndex[b]) * 3; // Axs
  if (['K','Q','J','T'].includes(a) && isSuited(L)) return 58 + Math.max(0, 8 - rIndex[b]) * 2; // suited broadways
  if (isSuited(L) && Math.abs(rIndex[a] - rIndex[b]) === 1) return 55 + Math.max(0, 7 - Math.min(rIndex[a], rIndex[b])) * 2; // SCs
  if (a === 'A' && isOff(L)) return 50 + Math.max(0, 5 - rIndex[b]) * 3; // AKo..A9o
  if (['K','Q'].includes(a) && isOff(L) && rIndex[b] <= rIndex['T']) return 50; // KQo/QJo-ish
  if (isSuited(L)) return 45;
  return 35;
};

const clamp = (x: number) => Math.max(0, Math.min(100, Math.round(x)));

function normalizeTo100(raise: number, call: number): Triple {
  let r = clamp(raise), c = clamp(call);
  let f = 100 - r - c;
  if (f < 0) {
    const over = -f;
    if (c >= over) { c -= over; f = 0; }
    else { const left = over - c; c = 0; r = Math.max(0, r - left); f = 0; }
  }
  return { raise: r, call: c, fold: 100 - r - c };
}

function depthFactor(stackBB: number) {
  // shallow → less calling, more raise/fold; deep → more calling/playability
  if (stackBB <= 100) return { callMul: 0.85, raiseMul: 1.05 };
  if (stackBB >= 220) return { callMul: 1.15, raiseMul: 0.95 };
  return { callMul: 1.0, raiseMul: 1.0 };
}

/* ---------- RFI: Open / — / Fold ---------- */
function gridRFI(pos: Pos, stackBB: number): Grid {
  const g = emptyGrid();
  for (const L of LABELS) {
    const s = strengthScore(L);
    let open = 0;

    if (isPair(L)) {
      const a = hi(L);
      const min: Record<Pos, string> = { UTG:'6', MP:'5', HJ:'4', CO:'3', BTN:'2', SB:'4', BB:'9' };
      open = atLeast(a, min[pos]) ? 100 : 0;
      if (pos === 'CO' && atLeast(a,'3') && !atLeast(a,'9')) open = 80;
      if (pos === 'HJ' && atLeast(a,'5') && !atLeast(a,'9')) open = 80;
      if (pos === 'SB') open = atLeast(a,'4') ? 85 : 0;
    } else if (hi(L) === 'A') {
      if (isSuited(L)) {
        const b = lo(L);
        const min: Record<Pos, string> = { UTG:'5', MP:'4', HJ:'4', CO:'3', BTN:'2', SB:'3', BB:'9' };
        open = atLeast(b, min[pos]) ? 100 : 0;
      } else {
        const b = lo(L);
        const minOff: Record<Pos, string> = { UTG:'T', MP:'T', HJ:'9', CO:'9', BTN:'6', SB:'9', BB:'T' };
        open = atLeast(b, minOff[pos]) ? 100 : 0;
        if (pos === 'BTN' && atLeast(b,'3')) open = 75;
      }
    } else if (isSuited(L) && ['K','Q','J','T'].includes(hi(L))) {
      const b = lo(L);
      const minS: Record<Pos, string> = { UTG:'9', MP:'9', HJ:'8', CO:'7', BTN:'5', SB:'7', BB:'9' };
      open = atLeast(b, minS[pos]) ? 100 : 0;
      if (pos === 'BTN' && atLeast(b,'6')) open = 80;
    } else if (isOff(L) && ['K','Q','J','T'].includes(hi(L))) {
      const b = lo(L);
      const minO: Record<Pos, string> = { UTG:'Q', MP:'J', HJ:'T', CO:'T', BTN:'9', SB:'T', BB:'Q' };
      open = atLeast(b, minO[pos]) ? 100 : 0;
      if (pos === 'BTN' && (hi(L)==='K'||hi(L)==='Q') && atLeast(b,'8')) open = 70;
    } else if (isSuited(L)) {
      // suited connectors & junk
      if (Math.abs(rIndex[hi(L)] - rIndex[lo(L)]) === 1) {
        const allow: Record<Pos, number> = { UTG:0, MP:20, HJ:55, CO:85, BTN:100, SB:75, BB:0 };
        open = allow[pos];
      } else {
        if (pos === 'BTN') open = 35;
        else if (pos === 'CO') open = 18;
      }
    }

    const { callMul } = depthFactor(stackBB);
    const raise = clamp(open * (callMul >= 1.0 ? 1 : 1)); // RFI has no calling; minor depth effect baked in via thresholds
    g[L] = { raise, call: 0, fold: 100 - raise };
  }
  return g;
}

/* ---------- Vs Open HU: 3-bet / Call / Fold ---------- */
function gridVsOpen(hero: Pos, opener: Pos, heroIP: boolean, stackBB: number): Grid {
  const rfi = gridRFI(hero, stackBB);
  const g = emptyGrid();
  const { callMul, raiseMul } = depthFactor(stackBB);

  for (const L of LABELS) {
    const base = rfi[L].raise; // playability weight
    if (base === 0) { g[L] = { ...zeroTriple }; continue; }

    let raiseW = base, callW = 0;

    const pair = isPair(L), suited = isSuited(L), offsuit = isOff(L);
    if (hero === 'SB') {
      callW = base * (pair ? 0.55 : suited ? 0.5 : 0.3);
      raiseW = base - callW;
    } else if (hero === 'BB') {
      callW = base * (pair ? 0.8 : suited ? 0.75 : 0.55);
      raiseW = base - callW;
    } else if (heroIP) {
      callW = base * (pair ? 0.7 : suited ? 0.65 : 0.45);
      raiseW = base - callW;
    } else {
      callW = base * (pair ? 0.55 : suited ? 0.45 : 0.25);
      raiseW = base - callW;
    }

    // Polarize some bluff 3-bets with Axs & best SCs
    if (!pair && suited && (hi(L)==='A' || Math.abs(rIndex[hi(L)]-rIndex[lo(L)])===1)) {
      raiseW *= hero === 'SB' ? 1.15 : 1.05;
    }

    const R = base * 0.6 * raiseMul + (raiseW - base*0.4);
    const C = callW * callMul * (hero === 'SB' ? 0.9 : 1.0);

    g[L] = normalizeTo100(R, C);
  }
  return g;
}

/* ---------- Squeeze: Squeeze / Overcall / Fold ---------- */
function gridSqueeze(hero: Pos, opener: Pos, callers: number, heroIP: boolean, stackBB: number): Grid {
  const g = emptyGrid();
  const { callMul, raiseMul } = depthFactor(stackBB);

  for (const L of LABELS) {
    const s = strengthScore(L);
    let Rw = 0, Cw = 0;

    // Value squeezes: QQ+, AK; JJ/TT some; AQs
    if (isPair(L)) {
      const a = hi(L);
      if (['A','K'].includes(a)) Rw = 95;
      else if (a === 'Q') Rw = 70; // some calls if hero is BTN/BB
      else if (a === 'J') { Rw = 35; Cw = hero === 'BTN' || hero === 'BB' ? 45 : 35; }
      else if (a === 'T') { Rw = 20; Cw = 40; }
      else if (atLeast(a,'8')) { Rw = 10; Cw = 30; }
      else { Cw = hero === 'BB' ? 15 : 10; }
    } else if (hi(L) === 'A' && isSuited(L)) {
      const b = lo(L);
      if (atLeast(b,'Q')) { Rw = 55; Cw = 35; }
      else if (atLeast(b,'T')) { Rw = 25; Cw = 45; }
      else if (['5','4','3','2'].includes(b)) { Rw = 35; Cw = 5; } // A5s–A2s blocker bluffs
      else { Rw = 15; Cw = 25; }
    } else if (isSuited(L) && ['K','Q','J'].includes(hi(L))) {
      Rw = 15; Cw = 40; // playable overcalls IP; SB trims calling
    } else if (isSuited(L) && Math.abs(rIndex[hi(L)] - rIndex[lo(L)]) === 1) {
      Rw = 12; Cw = hero === 'BB' ? 35 : 20; // SCs IP more calls
    } else if (hi(L) === 'A' && isOff(L)) {
      if (lo(L) === 'K') Rw = 40, Cw = 20;
      else if (lo(L) === 'Q') Rw = 20, Cw = 15;
      else Cw = 0;
    }

    // Seat dynamics
    if (hero === 'SB') { Cw *= 0.6; Rw *= 1.1; }
    if (hero === 'BTN') { Cw *= 1.15; }
    if (hero === 'BB') { Cw *= 1.2; }

    // Depth effects
    Rw *= raiseMul; Cw *= callMul;

    g[L] = normalizeTo100(Rw, Cw);
  }
  return g;
}

/* ---------- Cold 4-bet: 4-bet / Call(vs 3b) / Fold ---------- */
function gridCold4bet(hero: Pos, opener: Pos, threeBettorPos: Pos, stackBB: number): Grid {
  const g = emptyGrid();
  const { callMul, raiseMul } = depthFactor(stackBB);

  for (const L of LABELS) {
    let Rw = 0, Cw = 0;

    if (isPair(L)) {
      const a = hi(L);
      if (a === 'A' || a === 'K') Rw = 100;
      else if (a === 'Q') Rw = 80; // some trap calls allowed IP
      else if (a === 'J') Rw = 30, Cw = 45;
      else if (a === 'T') Rw = 15, Cw = 40;
      else if (atLeast(a,'8')) Cw = 30;
    } else if (hi(L) === 'A' && isSuited(L)) {
      const b = lo(L);
      if (b === 'K') Rw = 85, Cw = 15;
      else if (b === 'Q') Rw = 35, Cw = 45;
      else if (b === 'J') Rw = 15, Cw = 35;
      else if (['5','4','3','2'].includes(b)) Rw = 40, Cw = 0; // A5s–A2s bluffs
      else Cw = 20;
    } else if (hi(L) === 'A' && isOff(L)) {
      if (lo(L) === 'K') Rw = 70, Cw = 20;
      else if (lo(L) === 'Q') Rw = 25, Cw = 15;
    } else if (isSuited(L) && ['K','Q'].includes(hi(L))) {
      Cw = 40; // KQs/QJs can sometimes trap-call IP
    }

    // SB cold-calls are extremely rare
    if (hero === 'SB') Cw *= 0.5;

    Rw *= raiseMul; Cw *= callMul * (hero === 'BTN' ? 1.1 : 1);
    g[L] = normalizeTo100(Rw, Cw);
  }
  return g;
}

/* ---------- Opener vs 3-bet: 4-bet / Call / Fold ---------- */
function gridOpenerVs3bet(openerPos: Pos, threeBettorPos: Pos, openerIP: boolean, stackBB: number): Grid {
  const g = emptyGrid();
  const { callMul, raiseMul } = depthFactor(stackBB);

  for (const L of LABELS) {
    let Rw = 0, Cw = 0;

    if (isPair(L)) {
      const a = hi(L);
      if (a === 'A' || a === 'K') Rw = 75, Cw = 25; // some slowplay
      else if (a === 'Q') Rw = 45, Cw = 45;
      else if (a === 'J') Rw = 20, Cw = 55;
      else if (atLeast(a,'6')) Cw = 45;
      else Cw = openerIP ? 40 : 25;
    } else if (hi(L) === 'A' && isSuited(L)) {
      const b = lo(L);
      if (b === 'K') Rw = 55, Cw = 40;
      else if (b === 'Q') Rw = 25, Cw = 55;
      else if (b === 'J') Rw = 15, Cw = 50;
      else if (['5','4','3','2'].includes(b)) Rw = 25, Cw = 25; // some 4b bluffs
      else Cw = 40;
    } else if (isSuited(L) && ['K','Q','J'].includes(hi(L))) {
      Cw = 45;
    } else if (isSuited(L) && Math.abs(rIndex[hi(L)] - rIndex[lo(L)]) === 1) {
      Cw = 35;
    } else if (hi(L) === 'A' && isOff(L)) {
      if (lo(L) === 'K') Rw = 35, Cw = 45;
      else if (lo(L) === 'Q') Rw = 15, Cw = 35;
    }

    // OOP opener 4-bets a bit more linear
    if (!openerIP) { Rw *= 1.1; Cw *= 0.9; }

    Rw *= raiseMul; Cw *= callMul;
    g[L] = normalizeTo100(Rw, Cw);
  }
  return g;
}

/* ---------- Caller vs 3-bet behind: Fold / Call / Back-4-bet ---------- */
function gridCallerVs3bet(callerPos: Pos, threeBettorPos: Pos, callerIP: boolean, stackBB: number): Grid {
  const g = emptyGrid();
  const { callMul, raiseMul } = depthFactor(stackBB);

  for (const L of LABELS) {
    let Rw = 0, Cw = 0;

    if (isPair(L)) {
      const a = hi(L);
      if (a === 'A' || a === 'K') Rw = 60; // back-4-bet jam rarely at 150–200bb; still pressure
      else if (a === 'Q') Rw = 25; Cw = 45;
      if (atLeast(a,'6')) Cw = 45;
    } else if (hi(L) === 'A' && isSuited(L)) {
      const b = lo(L);
      if (b === 'K') Rw = 25; Cw = 45;
      else if (['5','4','3','2'].includes(b)) Rw = 15; // rare back-4-bet bluff
      else Cw = 35;
    } else if (isSuited(L) && ['K','Q','J'].includes(hi(L))) {
      Cw = 35;
    } else if (isSuited(L) && Math.abs(rIndex[hi(L)] - rIndex[lo(L)]) === 1) {
      Cw = 25;
    }

    // SB caller is very constrained
    if (callerPos === 'SB') { Cw *= 0.7; Rw *= 1.1; }

    Rw *= raiseMul * 0.8; // back-4-bet rare
    Cw *= callMul;
    g[L] = normalizeTo100(Rw, Cw);
  }
  return g;
}

/* ---------- 3-bettor vs 4-bet: 5-bet jam / Call / Fold ---------- */
function grid3bettorVs4bet(threeBettorPos: Pos, fourBettorPos: Pos, stackBB: number): Grid {
  const g = emptyGrid();

  for (const L of LABELS) {
    let Jam = 0, Call = 0;
    if (isPair(L)) {
      const a = hi(L);
      if (a === 'A') Jam = 60, Call = 35;
      else if (a === 'K') Jam = 25, Call = 55;
      else if (a === 'Q') Call = 55;
      else if (a === 'J') Call = 30;
    } else if (hi(L) === 'A' && isSuited(L)) {
      if (lo(L) === 'K') Call = 55;
      else if (lo(L) === 'Q') Call = 30;
      else if (['5','4','3','2'].includes(lo(L))) Jam = 10; // rare
    } else if (hi(L) === 'A' && isOff(L) && lo(L) === 'K') {
      Call = 30;
    }
    // Deeper stacks (200bb) → fewer jams, more calls
    if (stackBB >= 180) { Jam *= 0.7; Call *= 1.1; }
    g[L] = normalizeTo100(Jam, Call);
  }
  return g;
}

/* ---------- Limp family grids ---------- */
function gridLimpIso(heroPos: Pos, limpers: number, stackBB: number): Grid {
  const g = emptyGrid();
  for (const L of LABELS) {
    const s = strengthScore(L);
    let Iso = 0, OL = 0;
    if (isPair(L)) { Iso = s >= 70 ? 80 : s >= 60 ? 50 : 20; OL = s >= 55 ? 40 : 10; }
    else if (hi(L) === 'A' && isSuited(L)) { Iso = 45; OL = 35; }
    else if (isSuited(L) && ['K','Q','J'].includes(hi(L))) { Iso = 30; OL = 40; }
    else if (isSuited(L) && Math.abs(rIndex[hi(L)] - rIndex[lo(L)]) === 1) { Iso = 25; OL = 35; }
    else if (hi(L) === 'A' && isOff(L)) { Iso = lo(L) === 'K' ? 40 : 10; }
    if (limpers >= 2) Iso = Math.min(100, Iso + 10); // size up, iso a bit tighter but stronger
    if (heroPos === 'SB') OL *= 1.1; // SB completes more
    g[L] = normalizeTo100(Iso, OL);
  }
  return g;
}
function gridOverLimp(heroPos: Pos, limpers: number, stackBB: number): Grid {
  const g = emptyGrid();
  for (const L of LABELS) {
    const s = strengthScore(L);
    let OL = 0;
    if (isPair(L) || (isSuited(L) && (['A','K','Q'].includes(hi(L)) || Math.abs(rIndex[hi(L)]-rIndex[lo(L)])===1))) {
      OL = Math.min(80, Math.max(20, s - 35));
    }
    if (heroPos === 'SB') OL *= 1.1;
    g[L] = normalizeTo100(0, OL);
  }
  return g;
}
function gridSBcomplete(limpers: number, stackBB: number): Grid {
  const g = emptyGrid();
  for (const L of LABELS) {
    const s = strengthScore(L);
    let Comp = Math.min(85, Math.max(15, s - 30));
    let Iso = 0;
    if (isPair(L) && hi(L) >= 'T') Iso = 30;
    if (hi(L) === 'A' && isSuited(L)) Iso = 25;
    g[L] = normalizeTo100(Iso, Comp);
  }
  return g;
}
function gridBBcheckVsLimps(stackBB: number): Grid {
  const g = emptyGrid();
  for (const L of LABELS) {
    const s = strengthScore(L);
    let Iso = 0;
    if (isPair(L) && hi(L) >= 'J') Iso = 25;
    if (hi(L) === 'A' && isSuited(L)) Iso = 20;
    if (isSuited(L) && Math.abs(rIndex[hi(L)] - rIndex[lo(L)]) === 1) Iso = 15;
    g[L] = normalizeTo100(Iso, 100 - Iso); // Call=check frequency
  }
  return g;
}

/* ---------- BvB: SB open; BB vs SB raise/limp ---------- */
function gridBvB_SBopen(stackBB: number): Grid {
  // Raise / Limp / Fold (we’ll still show as Raise/Call/Fold; "Call" = limp)
  const g = emptyGrid();
  for (const L of LABELS) {
    const s = strengthScore(L);
    let R = Math.min(100, Math.max(10, s - 25));
    let C = Math.max(0, 35 - Math.max(0, s - 55)); // some limp mix with middling hands
    g[L] = normalizeTo100(R, C);
  }
  return g;
}
function gridBvB_BBvsSBraise(stackBB: number): Grid {
  const g = emptyGrid();
  const { callMul, raiseMul } = depthFactor(stackBB);
  for (const L of LABELS) {
    const s = strengthScore(L);
    let C = Math.min(90, s); // BB defends very wide
    let R = Math.max(0, (s - 55) * 0.8); // polar 3-bet
    R *= raiseMul; C *= callMul;
    g[L] = normalizeTo100(R, C);
  }
  return g;
}
function gridBvB_BBvsSBlimp(stackBB: number): Grid {
  const g = emptyGrid();
  for (const L of LABELS) {
    const s = strengthScore(L);
    let Iso = Math.max(0, (s - 60) * 0.9);
    let Check = 100 - Iso;
    g[L] = normalizeTo100(Iso, Check);
  }
  return g;
}

/* ============================================================
   Cell background painter
============================================================ */
function cellBackground({ raise, call, fold }: Triple) {
  const r = clamp(raise|0);
  const c = clamp(call|0);
  const r2 = r, c2 = r + c, f2 = 100;
  return `linear-gradient(180deg, var(--raise) 0% ${r2}%, var(--call) ${r2}% ${c2}%, var(--fold) ${c2}% ${f2}%)`;
}

/* ============================================================
   Component
============================================================ */
export default function Page() {
  // Inputs
  const [input, setInput] = useState('');
  const [fields, setFields] = useState<Fields | null>(null);

  // Quick Assist
  const [heroAssist, setHeroAssist] = useState('');
  const [villainAssist, setVillainAssist] = useState('');
  const [boardAssist, setBoardAssist] = useState('');

  // Stack control (bb)
  const [stackBB, setStackBB] = useState<number>(200);
  const [autoStack, setAutoStack] = useState(true);

  // Async state
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  // Preview parse
  const preview = useMemo(() => ({
    stakes: parseStakes(input),
    position: parseHeroPosition(input),
    heroCards: parseHeroCardsSmart(input),
    board: parseBoard(input),
  }), [input]);

  // Parse stack (bb) from input when auto mode
  useEffect(() => {
    if (!autoStack) return;
    const bbParsed = parseStackBB(input, preview.stakes || undefined);
    if (bbParsed) setStackBB(bbParsed);
  }, [input, preview.stakes, autoStack]);

  const heroCards = (twoCardsFrom(heroAssist) || twoCardsFrom(preview.heroCards) || '').trim();
  const heroCardsValid = heroCards.split(' ').filter(Boolean).length === 2;
  const boardFromAssist = suitifyLine(boardAssist).split(' ');
  const flop = (boardFromAssist.slice(0,3).join(' ') || preview.board.flop || '');
  const turn = (boardFromAssist[3] || preview.board.turn || '');
  const river = (boardFromAssist[4] || preview.board.river || '');

  // Resolve node (or null)
  const node: Node | null = useMemo(() => detectNode(input, preview.position || ''), [input, preview.position]);

  // Cache signature
  const signature = useMemo(() => {
    if (!node) return 'NONE';
    return JSON.stringify({ node, stackBB });
  }, [node, stackBB]);

  // Deterministic grid factory
  const gridTriples: Grid = useMemo(() => {
    if (!node) return emptyGrid(); // all fold until resolved
    switch (node.kind) {
      case 'RFI': return gridRFI(node.heroPos, stackBB);
      case 'VS_OPEN': return gridVsOpen(node.heroPos, node.openerPos, node.heroIP, stackBB);
      case 'SQUEEZE': return gridSqueeze(node.heroPos, node.openerPos, node.callers, node.heroIP, stackBB);
      case 'COLD_4BET': return gridCold4bet(node.heroPos, node.openerPos, node.threeBettorPos, stackBB);
      case 'OPENER_VS_3BET': return gridOpenerVs3bet(node.openerPos, node.threeBettorPos, node.openerIP, stackBB);
      case 'CALLER_VS_3BET': return gridCallerVs3bet(node.callerPos, node.threeBettorPos, node.callerIP, stackBB);
      case 'THREEBETTOR_VS_4BET': return grid3bettorVs4bet(node.threeBettorPos, node.fourBettorPos, stackBB);
      case 'LIMP_ISO': return gridLimpIso(node.heroPos, node.limpers, stackBB);
      case 'LIMP_OVERLIMP': return gridOverLimp(node.heroPos, node.limpers, stackBB);
      case 'LIMP_BACKRAISE': return gridCold4bet('SB', 'HJ', 'BTN', stackBB); // use very tight template
      case 'SB_COMPLETE': return gridSBcomplete(node.limpers, stackBB);
      case 'BB_CHECK': return gridBBcheckVsLimps(stackBB);
      case 'BVB_SB_OPEN': return gridBvB_SBopen(stackBB);
      case 'BVB_BB_VS_SB_RAISE': return gridBvB_BBvsSBraise(stackBB);
      case 'BVB_BB_VS_SB_LIMP': return gridBvB_BBvsSBlimp(stackBB);
      default: return emptyGrid();
    }
  }, [signature]); // recompute when node or stack changes

  const opened = useMemo(() => Object.values(gridTriples).filter(t => t.raise + t.call > 0).length, [gridTriples]);

  /* ========== (Optional) Analyze hand server call — unchanged ========== */
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
      };
      const r = await fetch('/api/analyze-hand', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
          cards: heroCards,
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const heroPos: Pos = (fields?.position as Pos) || (preview.position ? normalizePos(preview.position) : 'BTN');

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
                placeholder="Type your hand like a story — stakes, position, stacks, actions..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
              />
              <div className="p-row p-gap">
                <button className="p-btn p-primary" onClick={handleParse} disabled={aiLoading}>
                  {aiLoading ? 'Analyzing…' : 'Send'}
                </button>
                <button
                  className="p-btn"
                  onClick={() => {
                    setInput(''); setFields(null); setStatus(null); setAiError(null);
                    setHeroAssist(''); setVillainAssist(''); setBoardAssist('');
                    setAutoStack(true); setStackBB(200);
                  }}
                >Clear</button>
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

            {/* Controls above grid */}
            <div className="p-row p-gap">
              <div className="stackBox">
                <label>Stack (bb)</label>
                <input
                  type="number" min={40} max={400} step={10}
                  value={stackBB}
                  onChange={(e)=>{ setStackBB(Number(e.target.value||200)); setAutoStack(false); }}
                />
              </div>
              <div className="p-muted" style={{fontSize:12}}>
                {node ? `${opened} / 169 combos shown` : 'Waiting for enough info to resolve node…'}
              </div>
            </div>

            {/* Grid */}
            <div className="p-card" style={{overflow:'visible'}}>
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
                          style={{ background: cellBackground(node ? t : zeroTriple) }}
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
                      : <span className="p-muted">(optional)</span>}
                  </div>
                </InfoBox>
                <InfoBox label="Date"><div>{today}</div></InfoBox>
                <InfoBox label="Position"><div>{preview.position || <span className="p-muted">(detecting…)</span>}</div></InfoBox>
                <InfoBox label="Stakes"><div>{(fields?.stakes ?? preview.stakes) || <span className="p-muted">(optional)</span>}</div></InfoBox>
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

      {/* Styles */}
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

        .p-card{background:linear-gradient(180deg,var(--card1),var(--card2) 60%,var(--card3));border:1px solid var(--border);border-radius:18px;padding:16px;box-shadow:0 10px 28px rgba(0,0,0,.08)}
        .p-cardTitle{font-size:13px;font-weight:700;letter-spacing:.15px;color:#334155;margin-bottom:10px}
        .p-subTitle{font-size:14px;font-weight:800;margin-bottom:10px;color:#111827}
        .p-textarea{width:100%;min-height:160px;resize:vertical;padding:12px 14px;border-radius:14px;border:1px solid var(--line);background:#ffffff;color:#0f172a;font-size:15px;line-height:1.5}

        .p-row{display:flex;align-items:center}
        .p-gap{gap:12px}
        .p-gapTop{margin-top:10px}
        .p-end{justify-content:flex-end}

        .p-btn{appearance:none;border:1px solid var(--line);background:#ffffff;color:#0f172a;padding:10px 14px;border-radius:12px;cursor:pointer;transition:transform .02s ease,background .15s ease,border-color .15s ease}
        .p-btn:hover{background:#f3f4f6}
        .p-btn:active{transform:translateY(1px)}
        .p-btn[disabled]{opacity:.55;cursor:not-allowed}
        .p-btn.p-primary{background:linear-gradient(180deg,var(--primary),var(--primary2));color:var(--btnText);border-color:#9db7ff;box-shadow:0 6px 18px rgba(59,130,246,.25)}
        .p-btn.p-primary:hover{filter:brightness(1.05)}

        .p-assist3{display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:10px}
        @media (max-width:800px){.p-assist3{grid-template-columns:1fr}}
        .p-input{width:100%;padding:10px 12px;border-radius:12px;border:1px solid var(--line);background:#ffffff;color:#0f172a;font-size:14.5px}
        .p-input.p-mono{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,'Courier New',monospace;line-height:1.45}
        .p-help{margin-top:8px;font-size:12px;color:var(--muted)}
        .p-muted{color:var(--muted)}

        .stackBox{display:flex;align-items:center;gap:8px;background:#fff;border:1px solid var(--line);border-radius:12px;padding:6px 10px}
        .stackBox label{font-size:12px;color:#334155}
        .stackBox input{width:90px;border:1px solid var(--line);border-radius:8px;padding:6px 8px}

        .p-topRow{display:flex;justify-content:space-between;align-items:center}
        .chips{display:flex;flex-wrap:wrap;gap:8px}
        .chip{background:var(--chipBg);border:1px solid var(--chipBorder);color:var(--chipText);padding:6px 10px;border-radius:999px;font-size:12.5px;letter-spacing:.2px}

        .p-grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px}
        .ibox{background:#ffffff;border:1px solid var(--pillBorder);border-radius:12px;padding:10px 12px}
        .iboxLabel{font-size:11px;color:#6b7280;margin-bottom:3px}
        .iboxVal{font-size:14px}

        .p-boardRow{display:flex;flex-wrap:wrap;gap:10px;font-size:16px}
        .p-pill{background:var(--pillBg);border:1px solid var(--pillBorder);padding:8px 12px;border-radius:12px}
        .p-cardSpan{margin-right:4px}
        .p-list{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:6px}
        .p-note{margin-top:10px;color:#166534}
        .p-err{margin-top:10px;color:#b91c1c}

        .legendRow{display:flex;align-items:center;gap:12px;margin-bottom:8px}
        .legendItem{display:flex;align-items:center;gap:6px;font-size:12.5px;color:#334155}
        .legendHint{margin-left:auto;font-size:12px;color:#64748b}
        .dot{width:12px;height:12px;border-radius:4px;display:inline-block;border:1px solid #cbd5e1}
        .dot.raise{background:var(--raise)}
        .dot.call{background:var(--call)}
        .dot.fold{background:var(--fold)}

        .rangeGrid{display:grid;grid-template-columns:28px repeat(13, 1fr);grid-auto-rows:26px;gap:4px;align-items:center;position:relative}
        .rangeHead{font-size:12px;color:#64748b;text-align:center;line-height:26px}
        .rangeCorner{width:28px;height:26px}
        .cell{border:1px solid #cbd5e1;border-radius:6px;font-size:11.5px;display:flex;align-items:center;justify-content:center;user-select:none;box-shadow:inset 0 0 0 1px rgba(0,0,0,.02);color:#111827;position:relative;transition:transform .08s ease,box-shadow .15s ease}
        .cell.show:hover{transform:scale(1.8);z-index:10;box-shadow:0 10px 24px rgba(0,0,0,.25)}
        .fixed .cell{cursor:default}
      `}</style>
    </main>
  );
}

/* Small info box used on the right-side top card */
function InfoBox({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ibox">
      <div className="iboxLabel">{label}</div>
      <div className="iboxVal">{children}</div>
    </div>
  );
}
