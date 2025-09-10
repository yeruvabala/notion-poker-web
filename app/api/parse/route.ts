// app/api/parse/route.ts

// app/api/parse/route.ts (top of file or above POST)
type ParsedFields = {
  date: string | null;
  stakes: string | null;
  position: string | null;
  cards: string | null;
  board: string | null;
  notes: string | null;
  villain_action: string | null;
};

export async function POST(req: Request) {
  // ...
  const out: ParsedFields = {
    date: null,
    stakes: null,
    position: null,
    cards: null,
    board: null,
    notes: null,
    villain_action: null,
  };

  const b = parseBoard(input); // your existing function
  out.board =
    ([b.flop && `Flop: ${b.flop}`, b.turn && `Turn: ${b.turn}`, b.river && `River: ${b.river}`]
      .filter((x): x is string => Boolean(x))
      .join('  |  ')) || null;

  return NextResponse.json(out);
}


import { NextResponse } from 'next/server';

function suitify(card: string) {
  const SUIT_MAP: Record<string, string> = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const m = card.replace(/\s+/g, '').match(/^([2-9TJQKA])([shdc♥♦♣♠])$/i);
  if (!m) return '';
  const r = m[1].toUpperCase();
  const s = m[2].toLowerCase();
  const suit = SUIT_MAP[s] || ('♥♦♣♠'.includes(s) ? s : '');
  return suit ? `${r}${suit}` : '';
}
const SUIT_WORD: Record<string, string> = {
  spade: '♠', spades: '♠',
  heart: '♥', hearts: '♥',
  diamond: '♦', diamonds: '♦',
  club: '♣', clubs: '♣',
};
const suitifyLine = (line: string) =>
  (line || '').replace(/[\/,|]/g, ' ')
    .split(/\s+/).filter(Boolean)
    .map(suitify).filter(Boolean).join(' ');

function parseStakes(t: string) {
  const m = t.match(/(\$?\d+(?:\.\d+)?)[\s]*[\/-][\s]*(\$?\d+(?:\.\d+)?)/);
  return m ? `${m[1]}/${m[2]}` : '';
}
function parsePosition(t: string) {
  const up = ` ${t.toUpperCase()} `;
  const PREF = ['SB','BB','BTN','CO','HJ','MP','UTG+2','UTG+1','UTG'];
  for (const p of PREF) if (up.includes(` ${p} `)) return p;
  const m = up.match(/\b(I|I'M|IM|I AM|HERO)\b[^.]{0,40}?\b(ON|FROM|IN)\s+(UTG\+\d|UTG|MP|HJ|CO|BTN|SB|BB)\b/);
  if (m) return m[3];
  return '';
}
function parseCards(t: string) {
  const s = t.toLowerCase();
  let m = s.match(/\b(?:with|holding|have|i\s+have)\s+([2-9tjqka][shdc♥♦♣♠])\s+([2-9tjqka][shdc♥♦♣♠])\b/i);
  if (m) return [suitify(m[1]), suitify(m[2])].join(' ');
  m = s.match(/\b(?:with|holding|have|i\s+have)\s*([2-9tjqka])\s*([2-9tjqka])\s*(s|o|suited|offsuit)?(?:\s*of\s*(spades?|hearts?|diamonds?|clubs?))?/i);
  if (m) {
    const r1 = m[1].toUpperCase(), r2 = m[2].toUpperCase();
    const suitWord = (m[4] || '').toLowerCase();
    const suitChar = suitWord ? SUIT_WORD[suitWord] : '♠';
    const suited = m[3] === 's' || m[3] === 'suited' || !!suitWord;
    return suited ? `${r1}${suitChar} ${r2}${suitChar}` : `${r1}♠ ${r2}♥`;
  }
  return '';
}
function parseBoard(text: string) {
  const get3 = (c: string) => suitifyLine(c).split(' ').slice(0, 3).join(' ');
  const fm = text.match(/flop[^\n:]*[:\-]*\s*([^\n]+)/i);
  const tm = text.match(/turn[^\n:]*[:\-]*\s*([^\n]+)/i);
  const rm = text.match(/river[^\n:]*[:\-]*\s*([^\n]+)/i);
  let flop = fm ? get3(fm[1]) : '';
  let turn = tm ? suitifyLine(tm[1]).split(' ')[0] || '' : '';
  let river = rm ? suitifyLine(rm[1]).split(' ')[0] || '' : '';
  if (!flop || !turn || !river) {
    const all = suitifyLine(text).split(' ');
    if (all.length >= 5) {
      flop = flop || all.slice(0, 3).join(' ');
      turn = turn || all[3];
      river = river || all[4];
    }
  }
  return { flop, turn, river };
}
function parseMode(t: string): 'cash'|'mtt'|'' {
  const s = t.toLowerCase();
  if (/\b(tournament|mtt|icm|bubble|final table|day\s*\d|ante|bb\s*ante|blinds?\s*\d)/i.test(s)) return 'mtt';
  if (/(\$?\d+\/\$?\d+|\b1\/3\b|\b2\/5\b|\b5\/10\b)/.test(s)) return 'cash';
  return '';
}
function parseEffBB(t: string): number | null {
  const m = t.toLowerCase().match(/(\d+)\s*bb(?:\s*eff|\s*effective)?/);
  return m ? Math.max(1, parseInt(m[1], 10)) : null;
}
function parseBlinds(t: string) {
  const s = t.replace(/,/g, ' ');
  const m1 = s.match(/\$?\d+(?:\.\d+)?\s*\/\s*\$?\d+(?:\.\d+)?/);
  if (m1) return m1[0];
  const m2 = s.match(/\b(\d+[kKmM]?)\s*\/\s*(\d+[kKmM]?)(?:\s*\/\s*(\d+[kKmM]?))?\s*(?:ante|bb\s*ante)?/i);
  return m2 ? m2[0] : '';
}
function parseICM(t: string) {
  return /\b(icm|bubble|final table|ladder|payouts?|in the money|itm)\b/i.test(t);
}

export async function POST(req: Request) {
  const { input = '' } = await req.json().catch(() => ({ input: '' }));
  const out = {
    date: null,
    stakes: parseStakes(input) || null,
    position: parsePosition(input) || null,
    cards: parseCards(input) || null,
    villain_action: null,
    gto_strategy: null,
    exploit_deviation: null,
    learning_tag: [],
    board: null,
    notes: null,
    mode: parseMode(input) || '',
    eff_bb: parseEffBB(input),
    blinds: parseBlinds(input) || null,
    icm_context: parseICM(input),
  };
  const b = parseBoard(input);
  out.board = [b.flop && `Flop: ${b.flop}`, b.turn && `Turn: ${b.turn}`, b.river && `River: ${b.river}`]
    .filter(Boolean).join('  |  ') || null;
  return NextResponse.json(out);
}
