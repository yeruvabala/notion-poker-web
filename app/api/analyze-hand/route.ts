import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* -------------------------- helpers: cards/stack -------------------------- */
const suitUnicode = { d: '♦', c: '♣', h: '♥', s: '♠' } as const;
const unicodeToLetter: Record<string, 'd' | 'c' | 'h' | 's'> = {
  '♦': 'd', '♣': 'c', '♥': 'h', '♠': 's',
};
const rankMap: Record<string, string> = {
  a: 'A', k: 'K', q: 'Q', j: 'J', t: 'T',
  '10': 'T', '9': '9','8':'8','7':'7','6':'6','5':'5','4':'4','3':'3','2':'2',
};
function normalizeOneCard(tok: string): string | null {
  if (!tok) return null;
  let raw = tok.trim().toLowerCase();
  const u = raw.slice(-1);
  if (unicodeToLetter[u]) {
    const r = raw.slice(0, -1);
    const R = rankMap[r] || rankMap[r.replace(/[^a-z0-9]/g, '')] || r.toUpperCase();
    return `${R}${u}`;
  }
  const s = raw.slice(-1);
  if (/[cdhs]/.test(s)) {
    const suit = suitUnicode[s as 'c'|'d'|'h'|'s'];
    const core = raw.slice(0, -1);
    const R = rankMap[core] || rankMap[core.replace(/[^a-z0-9]/g, '')] || core.toUpperCase();
    return `${R}${suit}`;
  }
  return null;
}
function allMatches(re: RegExp, text: string): RegExpMatchArray[] {
  const out: RegExpMatchArray[] = [];
  re.lastIndex = 0;
  let m: RegExpMatchArray | null;
  while ((m = re.exec(text)) !== null) out.push(m);
  return out;
}
function extractEffStackBB(text: string): number | null {
  const eff = allMatches(/(\d{2,3})\s*bb\b[^\n]{0,20}\b(eff|effective)\b/gi, text)
    .map(m => parseInt(m[1], 10))
    .filter(n => !Number.isNaN(n));
  if (eff.length) return Math.max(...eff);
  const plain = allMatches(/(\d{2,3})\s*bb\b/gi, text)
    .map(m => parseInt(m[1], 10))
    .filter(n => !Number.isNaN(n));
  if (plain.length) return Math.max(...plain);
  return null;
}
function extractFlop(text: string): string[] | null {
  const m = text.match(
    /flop[^a-z0-9]*([akqjt2-9][cdhs♦♣♥♠])[^a-z0-9]+([akqjt2-9][cdhs♦♣♥♠])[^a-z0-9]+([akqjt2-9][cdhs♦♣♥♠])/i
  );
  if (!m) return null;
  const c1 = normalizeOneCard(m[1]);
  const c2 = normalizeOneCard(m[2]);
  const c3 = normalizeOneCard(m[3]);
  return c1 && c2 && c3 ? [c1, c2, c3] : null;
}
function extractTurn(text: string): string | null {
  const m = text.match(/turn[^a-z0-9]*([akqjt2-9][cdhs♦♣♥♠])/i);
  return m ? normalizeOneCard(m[1]) : null;
}
function extractRiver(text: string): string | null {
  const m = text.match(/river[^a-z0-9]*([akqjt2-9][cdhs♦♣♥♠])/i);
  return m ? normalizeOneCard(m[1]) : null;
}
function safeJsonParse<T = any>(s: string): T | null {
  try {
    const a = s.indexOf('{');
    const b = s.lastIndexOf('}');
    if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1));
  } catch {}
  return null;
}
function coerceGtoStrategy(v: any): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') {
    const pre = v.preflop || v.Preflop;
    const flp = v.flop || v.Flop;
    const trn = v.turn || v.Turn;
    const rvr = v.river || v.River;
    return [pre, flp, trn, rvr].filter(Boolean).join('\n');
  }
  return String(v);
}

/* ------------------------ render expanded branch map ----------------------- */
type SizeResponses = Record<string, string>; // e.g., {"25–33%":"bet (60%)", "50%":"check", ...}
interface TreeOption {
  action: string;          // "bet" | "check" | "raise" | ...
  size?: string;           // "25–33%" | "10–12bb" | "75%" | "overbet"
  frequency?: string;      // "60%" | "mix" | "low freq"
  notes?: string;
  vs?: Record<string, string | SizeResponses>; // e.g., {"raise 3x": "fold 70%", "bet (50%)": {"call":"x","raise":"y"}}
}
interface StreetTree {
  header?: string;         // "Preflop (SB vs CO, 150bb)", "Flop 4♦8♠2♣ (OOP, 3-bet pot)"
  options?: TreeOption[];
}
interface ExpandedTree {
  preflop?: StreetTree;
  flop?: StreetTree;
  turn?: StreetTree;
  river?: StreetTree;
}
function line(indent: number, s: string) {
  return `${'  '.repeat(indent)}${s}`;
}
function renderOption(indent: number, o: TreeOption): string[] {
  const L: string[] = [];
  const base = [`${o.action}${o.size ? ` (${o.size})` : ''}${o.frequency ? ` — ${o.frequency}` : ''}${o.notes ? ` — ${o.notes}` : ''}`];
  L.push(line(indent, `- ${base.join('')}`));
  if (o.vs) {
    for (const k of Object.keys(o.vs)) {
      const v = o.vs[k];
      if (typeof v === 'string') {
        L.push(line(indent + 1, `vs ${k}: ${v}`));
      } else if (v && typeof v === 'object') {
        L.push(line(indent + 1, `vs ${k}:`));
        for (const sub of Object.keys(v)) {
          L.push(line(indent + 2, `${sub}: ${v[sub]}`));
        }
      }
    }
  }
  return L;
}
function renderStreet(title: string, st?: StreetTree): string[] {
  if (!st) return [];
  const L: string[] = [];
  L.push(line(0, `${title}${st.header ? ` — ${st.header}` : ''}`));
  if (st.options?.length) {
    for (const opt of st.options) L.push(...renderOption(1, opt));
  } else {
    L.push(line(1, '(no data)'));
  }
  return L;
}
function renderExpanded(tree?: ExpandedTree): string {
  if (!tree) return '';
  const out: string[] = [];
  out.push(...renderStreet('Preflop', tree.preflop));
  out.push('');
  out.push(...renderStreet('Flop', tree.flop));
  out.push('');
  out.push(...renderStreet('Turn', tree.turn));
  out.push('');
  out.push(...renderStreet('River', tree.river));
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* --------------------------------- route ---------------------------------- */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawText = String(body?.rawText || '');

    const facts = {
      position: String(body?.position || '') || 'unknown',
      stakes: String(body?.stakes || ''),
      cards: String(body?.cards || ''),
      villainAction: String(body?.villainAction || ''),
      effStackBB: extractEffStackBB(rawText),
      flop: extractFlop(rawText),
      turn: extractTurn(rawText),
      river: extractRiver(rawText),
    };

    const system = `
You are a poker strategy assistant. Return ONLY JSON with the exact keys and types:

{
  "gto_strategy": {
    "preflop": "Preflop (SB vs CO, <stack>bb): 3-bet 10–12bb; ...",
    "flop": "Flop <C1><C2><C3> (OOP, 3-bet pot): ...",
    "turn": "Turn <card>: ...",
    "river": "River <card>: ..."
  },
  "exploit_deviation": "2–4 short sentences with pool exploits.",
  "learning_tag": ["tag1","tag2"],
  "gto_expanded_tree": {
    "preflop": { "header": "SB vs CO, <stack>bb", "options": [ { "action":"3-bet", "size":"10–12bb", "frequency":"20–35%", "vs": { "4-bet": "fold 80–90%" } }, { "action":"flat", "frequency":"low mix" } ] },
    "flop":    { "header": "Board <C1><C2><C3>", "options": [ { "action":"bet", "size":"25–33%", "frequency":"55–65%", "vs": { "raise 3x":"fold most", "raise 2x":"mix call/fold" } }, { "action":"check", "vs": { "50% bet":"call with pair+draws", "75% bet":"fold more" } } ] },
    "turn":    { "header": "Card <card>", "options": [ { "action":"check", "frequency":"75–85%", "vs": { "50% bet":"call with pair+gutshot", "75% bet":"mix/fold", "overbet":"fold" } } ] },
    "river":   { "header": "Card <card>", "options": [ { "action":"check", "vs": { "75% bet":"fold bottom pair", "50–60% bet":"mix call with better bluff-catchers" } } ] }
  }
}

Hard constraints:
- No markdown, no prose outside the JSON object.
- Always fill the tree with size-conditioned responses like shown. Keep it specific, not vague.
- If a fact is missing (e.g., board card), write "unknown" in headers.
- Keep output under 900 tokens.`;

    const user = {
      role: 'user' as const,
      content: JSON.stringify({ facts }, null, 2),
    };

    const resp = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
      temperature: 0.2,
      messages: [{ role: 'system', content: system.trim() }, user],
    });

    const raw = resp.choices?.[0]?.message?.content || '';
    const parsed = safeJsonParse<any>(raw) || {};

    // Normalize concise strategy
    const gto_strategy = coerceGtoStrategy(parsed.gto_strategy);
    const exploit = String(parsed.exploit_deviation || '');
    const tags = Array.isArray(parsed.learning_tag)
      ? parsed.learning_tag.slice(0, 3).map((s: any) => String(s))
      : [];

    // Render expanded
    let expandedText = '';
    let tree: ExpandedTree | undefined = undefined;
    if (parsed.gto_expanded_tree && typeof parsed.gto_expanded_tree === 'object') {
      tree = parsed.gto_expanded_tree as ExpandedTree;
      // auto-fill headers with facts when model omitted them
      if (tree.preflop && !tree.preflop.header) {
        tree.preflop.header = `${facts.position || 'SB'} vs CO, ${facts.effStackBB || 'unknown'}bb`;
      }
      if (tree.flop && !tree.flop.header) {
        tree.flop.header = facts.flop ? `Board ${facts.flop.join(' ')}` : 'Board unknown';
      }
      if (tree.turn && !tree.turn.header) {
        tree.turn.header = `Card ${facts.turn || 'unknown'}`;
      }
      if (tree.river && !tree.river.header) {
        tree.river.header = `Card ${facts.river || 'unknown'}`;
      }
      expandedText = renderExpanded(tree);
    } else if (typeof parsed.gto_expanded_text === 'string') {
      expandedText = parsed.gto_expanded_text;
    }

    return NextResponse.json({
      gto_strategy,
      exploit_deviation: exploit,
      learning_tag: tags,
      gto_expanded_text: expandedText,
      facts,
    });
  } catch (e) {
    console.error('analyze-hand error', e);
    return NextResponse.json({ error: 'Failed to analyze hand' }, { status: 500 });
  }
}
