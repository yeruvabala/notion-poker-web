Skip to content
AkshayRY's projects
AkshayRY's projects

Hobby

notion-poker-web

9TK6anzgz


Find…
F

Source
Output
app/page.tsx

'use client';

import React, { useEffect, useMemo, useState } from 'react';

/* ====================== Types & helpers ====================== */

type Fields = {
  date?: string | null;
  stakes?: string | null;
  position?: string | null;
  cards?: string | null; // hero cards, like "K♥ T♥"
  board?: string | null; // "Flop: … | Turn: … | River: …"
  gto_strategy?: string | null;
  exploit_deviation?: string | null;
  learning_tag?: string[];
  hand_class?: string | null;
  source_used?: 'SUMMARY' | 'STORY' | null;
};

type RankSym = 'A'|'K'|'Q'|'J'|'T'|'9'|'8'|'7'|'6'|'5'|'4'|'3'|'2';
const RANKS: RankSym[] = ['A','K','Q','J','T','9','8','7','6','5','4','3','2'];
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
notion-poker-web – Deployment Source – Vercel
