import { NextResponse } from 'next/server';

type Board = { flop?: string[]; turn?: string | null; river?: string | null };
type RequestBody = {
  text?: string;
  overrideBoard?: Board;
};

function normSuit(ch: string) {
  return ({ '♠': 's', '♣': 'c', '♥': 'h', '♦': 'd' } as any)[ch] ?? ch.toLowerCase();
}
function normalizeCardToken(raw: string): string | null {
  if (!raw) return null;
  let t = raw.trim().toLowerCase();
  t = t.replace(/[♠♣♥♦]/g, (m) => normSuit(m));
  const m = t.match(/^(10|[2-9]|[akqjt])([shdc])$/i);
  if (!m) return null;
  return `${m[1].toLowerCase()}${m[2].toLowerCase()}`;
}
function parseCardsInline(str: string, max = 3): string[] {
  const tokens = str
    .replace(/\u00A0/g, ' ')
    .replace(/[^\w\s]/g, (ch) => (/[♠♣♥♦]/.test(ch) ? ch : ' '))
    .split(/\s+/)
    .filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const a = normalizeCardToken(tokens[i]);
    if (a) {
      out.push(a);
      if (out.length >= max) break;
    }
  }
  return out;
}

// Parse board from text: supports “Flop Ks 7d 2c. Turn 9c. River 4h”. If nothing found, returns {}.
function parseBoardFromText(text = ''): Board {
  const out: Board = {};
  const lower = text.toLowerCase();

  // Flop
  {
    const m =
      lower.match(/flop[^.:\n]*?([akqjt2-9][shdc♠♣♥♦])[^a-z0-9]+([akqjt2-9][shdc♠♣♥♦])[^a-z0-9]+([akqjt2-9][shdc♠♣♥♦])/i) ||
      lower.match(/flop[^.:\n]*?([akqjt2-9][shdc♠♣♥♦]\s+[akqjt2-9][shdc♠♣♥♦]\s+[akqjt2-9][shdc♠♣♥♦])/i);
    if (m) {
      const list = parseCardsInline(m[0], 3);
      if (list.length === 3) out.flop = list;
    }
  }

  // Turn
  {
    const m =
      lower.match(/turn[^.:\n]*?([akqjt2-9][shdc♠♣♥♦])/i) ||
      lower.match(/turn\s+is\s+([akqjt2-9][shdc♠♣♥♦])/i);
    if (m) {
      const c = normalizeCardToken(m[1]);
      if (c) out.turn = c;
    }
  }

  // River
  {
    const m =
      lower.match(/river[^.:\n]*?([akqjt2-9][shdc♠♣♥♦])/i) ||
      lower.match(/river\s+is\s+([akqjt2-9][shdc♠♣♥♦])/i);
    if (m) {
      const c = normalizeCardToken(m[1]);
      if (c) out.river = c;
    }
  }

  return out;
}

function parseStakes(text = ''): string {
  const m = text.match(/\b(\d\/\d|\d{2,3}nl)\b/i);
  return m ? m[1].toUpperCase() : '—';
}
function parsePositions(text = ''): { hero?: string; villain?: string } {
  const pos = ['SB', 'BB', 'BTN', 'CO', 'UTG', 'MP'];
  const hero = pos.find((p) => new RegExp(`\\b${p}\\b`, 'i').test(text));
  // very rough villain guess: vs CO / vs UTG in text
  const villain = pos.find((p) => new RegExp(`\\bvs\\s+${p}\\b`, 'i').test(text)) || undefined;
  return { hero, villain };
}
function parseHeroCards(text = ''): string {
  // e.g., "with Ah Qs", "with A4s"
  const m2 = text.match(/\bwith\s+([akqjt2-9][shdc])\s*([akqjt2-9][shdc])\b/i);
  if (m2) {
    const a = normalizeCardToken(m2[1])!;
    const b = normalizeCardToken(m2[2])!;
    // Try to return something friendly like "Ah Qs"
    const fmt = (c: string) => c[0].toUpperCase().replace('T', '10') + ' ' + c[1].toLowerCase();
    return `${fmt(a)} ${fmt(b)}`.replace(' ', '');
  }
  const m1 = text.match(/\bwith\s+([akqjt2-9]{2}s)\b/i); // "A4s"
  if (m1) return m1[1].toUpperCase();
  return '—';
}
function parseVillainAction(text = ''): string {
  // Grab sentence fragments with raise/bet/call
  const parts = text
    .split(/[\.\n]/)
    .map((s) => s.trim())
    .filter((s) => /(raise|bet|call|check)/i.test(s));
  return parts.join(', ').replace(/\s+/g, ' ').trim() || '—';
}
function parseStackBB(text = ''): number {
  const m = text.match(/(\d+)\s*bb/i);
  return m ? parseInt(m[1], 10) : 100;
}

function prettyBoard(board: Board) {
  const fmt = (c?: string | null) => {
    if (!c) return '—';
    const r = c.slice(0, -1).toUpperCase().replace('T', '10');
    const s = c.slice(-1);
    const suit = { h: '♥', d: '♦', c: '♣', s: '♠' } as any;
    return `${r}${suit[s] ?? ''}`;
  };
  const flop = (board.flop ?? []).map(fmt).join(' ');
  return {
    flop: flop || '— — —',
    turn: fmt(board.turn || undefined),
    river: fmt(board.river || undefined),
  };
}
function textureTags(board: Board): string[] {
  const flop = board.flop ?? [];
  if (flop.length !== 3) return [];
  const suits = flop.map((c) => c.slice(-1));
  const uniq = new Set(suits).size;
  const ranks = flop.map((c) => c[0]).join('');
  const low = /[2-6]/.test(ranks) && !/[A|K|Q|J|10]/i.test(ranks);
  const tags: string[] = [];
  if (uniq === 3) tags.push('rainbow');
  if (uniq === 2) tags.push('two-tone');
  if (uniq === 1) tags.push('monotone');
  if (low) tags.push('low-board');
  return tags;
}

function makeGTOCompact({
  board,
  heroPos,
  villainPos,
  stackBB,
}: {
  board: Board;
  heroPos?: string;
  villainPos?: string;
  stackBB: number;
}) {
  const pBoard = prettyBoard(board);
  const oop = heroPos === 'SB' || heroPos === 'BB';
  const posStr = heroPos && villainPos ? `${heroPos} vs ${villainPos}` : heroPos ? heroPos : '—';
  return [
    `Preflop (${posStr}, ${stackBB}bb): 3-bet 10–12bb; suited wheel/wide Ax mixes at low–mid freq. Fold to 4-bets at this depth.`,
    `Flop ${pBoard.flop} (${oop ? 'OOP' : 'IP'}, 3-bet pot): Small c-bet 25–33% ≈55–65%. With marginal pairs/backdoors, prefer 25–33%; mix checks. Fold mostly vs raises ≥3×.`,
    `Turn ${pBoard.turn}: Check range often; with pair+draws call vs 33–50%, mix/fold vs 66–75%, fold vs overbet.`,
    `River ${pBoard.river}: After x/c turn, check; fold weak one-pair vs 75%+. Value-bet only on clear improves (A/3 for A4s) 50–66%; fold to raises.`,
  ].join('\n');
}

function makeGTOExpanded({
  board,
  oop,
}: {
  board: Board;
  oop: boolean;
}) {
  const pBoard = prettyBoard(board);
  return [
    `Preflop —`,
    `  1. 3-bet (10–12bb)`,
    `     A) vs 4-bet: fold most Ax-low; mix 5-bet bluffs only at lower stacks`,
    `     B) vs flat: play post (range advantage w/ overpairs)`,
    ``,
    `Flop — ${pBoard.flop} (${oop ? 'OOP' : 'IP'})`,
    `  1. C-bet 25–33% (55–65%)`,
    `     A) vs raise ≤2.5x: continue top pairs, strong draws, some backdoor+pair`,
    `     B) vs raise 3x+: fold marginal pairs/backdoor-only hands`,
    `  2. Check (balance)`,
    `     A) vs 50% stab: continue pair+gutter+, backdoor+over, fold air`,
    ``,
    `Turn — ${pBoard.turn}`,
    `  1. Check most`,
    `     A) vs 33–50%: call pair+draws, 2nd pairs w/ good blockers`,
    `     B) vs 66–75%: mix; continue best pairs+draws, fold weakest pairs`,
    `     C) vs overbet: fold most one-pair`,
    `  2. Bet (polar) 60–75% with overpairs, strong 2p/sets, some A3 bdf combos`,
    ``,
    `River — ${pBoard.river}`,
    `  1. After x/c turn ⇒ check`,
    `     A) vs 75%+: overfold bottom pairs; call stronger 4x/5x blocking value`,
    `     B) vs small (25–40%): call more often with good blockers`,
    `  2. On improve (A/3 for A4s) ⇒ value-bet 50–66%, fold to raises`,
  ].join('\n');
}

function makeExploits(stakes: string, tags: string[]): string {
  const lowBoard = tags.includes('low-board');
  const isLive = /\b(1\/3|2\/5|live|200nl)\b/i.test(stakes);
  const bullets: string[] = [];
  if (isLive) {
    bullets.push('Pools call too wide preflop vs 3-bets—value expand slightly');
    bullets.push('Large turn barrels under-bluffed—overfold marginal pairs vs 66–75%+');
  }
  if (lowBoard) {
    bullets.push('Small c-bet performs well on disconnected, rainbow flops');
  }
  if (!bullets.length) bullets.push('Adjust exploitatively to population sizing tells and timing.');
  return bullets.join('\n');
}

// --------- Route ---------
export async function POST(req: Request) {
  const body = (await req.json()) as RequestBody;
  const text = body?.text ?? '';

  // 1) Parse from text
  const parsedBoardFromText = parseBoardFromText(text);
  const stakes = parseStakes(text);
  const pos = parsePositions(text);
  const heroCards = parseHeroCards(text);
  const villainAction = parseVillainAction(text);
  const stackBB = parseStackBB(text);

  // 2) Apply override from UI if present (takes precedence)
  const override = body?.overrideBoard || {};
  const finalBoard: Board = {
    flop: Array.isArray(override.flop) && override.flop.length === 3 ? override.flop : parsedBoardFromText.flop,
    turn: override.turn ?? parsedBoardFromText.turn ?? null,
    river: override.river ?? parsedBoardFromText.river ?? null,
  };

  // 3) Generate outputs
  const compact = makeGTOCompact({
    board: finalBoard,
    heroPos: pos.hero,
    villainPos: pos.villain,
    stackBB,
  });
  const expanded = makeGTOExpanded({
    board: finalBoard,
    oop: pos.hero === 'SB' || pos.hero === 'BB',
  });
  const exploits = makeExploits(stakes, textureTags(finalBoard));

  // Return structure expected by page.tsx
  return NextResponse.json({
    ui: {
      stakes: stakes || '—',
      position: pos.hero || '—',
      cards: heroCards || '—',
      villain_action: villainAction || '—',
      gto_strategy: compact,
      gto_expanded: expanded,
      exploit_deviation: exploits,
    },
    parsed: {
      board: finalBoard,
      stack_bb: stackBB,
      hero_position: pos.hero || null,
      villain_position: pos.villain || null,
    },
  });
}
