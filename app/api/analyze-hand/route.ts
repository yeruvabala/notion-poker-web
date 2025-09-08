/* app/api/analyze-hand/route.ts
 * Next.js Route Handler: analyze a free-text poker hand,
 * parse board + metadata, and produce concise + expanded GTO output.
 */

import OpenAI from "openai";

export const runtime = "nodejs";

// ---------- Utilities: card normalization ----------

const SUIT_MAP: Record<string, string> = {
  "s": "s", "♠": "s",
  "h": "h", "♥": "h",
  "d": "d", "♦": "d",
  "c": "c", "♣": "c",
};

const RANKS = new Set(["a","k","q","j","t","10","9","8","7","6","5","4","3","2"]);
const ORDINALS = new Set(["st","nd","rd","th"]); // avoid "3/4 th pot" -> "th" mis-read as Ten hearts

function normalizeOneCard(raw: string): string | null {
  if (!raw) return null;

  // strip trailing punctuation (e.g. "2c." -> "2c")
  const s = raw.replace(/[.,!?;:]+$/g, "");

  // unicode forms like "4♦" or "Q♠"
  const u = s.match(/^([akqjt2-9]|10)[♠♥♦♣]$/i);
  if (u) {
    const r = u[1].toLowerCase();
    return (r === "10" ? "t" : r) + SUIT_MAP[s[s.length-1]];
  }

  // two/three char ascii, e.g. "4d", "10h", "Th", "As"
  const m = s.match(/^(10|[akqjt2-9])([shdc])$/i);
  if (m) {
    const r = m[1].toLowerCase();
    const suit = m[2].toLowerCase();
    return (r === "10" ? "t" : r) + suit;
  }

  // Reject common ordinal tokens ("th", "st", ...) that are not cards.
  if (ORDINALS.has(s.toLowerCase())) return null;

  // Short 2-char like "th" could be Ten hearts, but only accept if preceded by a clear card context.
  // We intentionally do NOT attempt to normalize bare "th" here (too risky).
  return null;
}

function tokenizeWords(text: string): string[] {
  return text
    .replace(/\u00A0/g, " ")
    .split(/[\s,;:()\-]+/g)
    .filter(Boolean);
}

function tryNormalizeCardToken(tok: string): string | null {
  const clean = tok.replace(/[.?!]+$/g, "");
  // hard-block ordinals (th, st, rd, nd) & bb/eff artifacts
  const lower = clean.toLowerCase();
  if (ORDINALS.has(lower)) return null;
  if (lower === "bb" || lower === "eff") return null;
  return normalizeOneCard(clean);
}

function extractFlop(text: string): string[] | null {
  const words = tokenizeWords(text.toLowerCase());
  const iFlop = words.findIndex(w => w === "flop" || w === "flopp" || w === "flop:");
  const cards: string[] = [];

  const collect = (startIdx: number) => {
    for (let i = startIdx; i < words.length && cards.length < 3; i++) {
      const c = tryNormalizeCardToken(words[i]);
      if (c) cards.push(c);
    }
  };

  if (iFlop >= 0) {
    collect(iFlop + 1);
  }

  // Fallback: first triple of card tokens anywhere
  if (cards.length < 3) {
    const any: string[] = [];
    for (const w of words) {
      const c = tryNormalizeCardToken(w);
      if (c) any.push(c);
      if (any.length === 3) break;
    }
    if (any.length === 3) return any;
  }

  return cards.length === 3 ? cards : null;
}

function extractTurn(text: string): string | null {
  const words = tokenizeWords(text.toLowerCase());
  const iTurn = words.findIndex(w => w === "turn" || w === "turn:");
  if (iTurn >= 0) {
    for (let i = iTurn + 1; i < words.length; i++) {
      const c = tryNormalizeCardToken(words[i]);
      if (c) return c;
    }
  }
  // Fallback: 4th card seen overall
  const all: string[] = [];
  for (const w of words) {
    const c = tryNormalizeCardToken(w);
    if (c) all.push(c);
  }
  return all.length >= 4 ? all[3] : null;
}

function extractRiver(text: string): string | null {
  const words = tokenizeWords(text.toLowerCase());
  const iRiver = words.findIndex(w => w === "river" || w === "river:");
  if (iRiver >= 0) {
    for (let i = iRiver + 1; i < words.length; i++) {
      const c = tryNormalizeCardToken(words[i]);
      if (c) return c;
    }
  }
  // Fallback: 5th card seen overall
  const all: string[] = [];
  for (const w of words) {
    const c = tryNormalizeCardToken(w);
    if (c) all.push(c);
  }
  return all.length >= 5 ? all[4] : null;
}

function prettyCard(c: string): string {
  const r = c[0];
  const s = c[1];
  const rank = r === "t" ? "10" : r.toUpperCase();
  const suit = { s: "♠", h: "♥", d: "♦", c: "♣" }[s] ?? "?";
  return `${rank}${suit}`;
}

// ---------- Light metadata parsing (position, stakes, stack) ----------

function detectPosition(t: string): string | null {
  const m = t.match(/\b(utg\+?1?|hj|lj|mp|co|btn|sb|bb)\b/i);
  return m ? m[1].toUpperCase() : null;
}

function detectStakes(t: string): string | null {
  const m = t.match(/\b(\d+)\s*\/\s*(\d+)\b/);
  if (m) return `${m[1]}/${m[2]}`;
  return null;
}

function detectStackBB(t: string): number | null {
  const m = t.match(/(\d+)\s*bb/i);
  if (m) return parseInt(m[1], 10);
  return null;
}

function detectHeroCards(t: string): string | null {
  // Accept "A4s", "Ah4h", "As4s" etc (first suited/combo mention wins)
  const m = t.match(/\b([akqjt2-9]{1,2})([shdc])([akqjt2-9]{1,2})\2\b/i); // Ah4h, As4s
  if (m) return `${m[1].toUpperCase()}${m[2].toLowerCase()}${m[3].toUpperCase()}${m[2].toLowerCase()}`;
  const m2 = t.match(/\b([akqjt2-9])([2-9akqjt])s\b/i); // A4s style
  if (m2) return `${m2[1].toUpperCase()}${m2[2].toUpperCase()}s`;
  return null;
}

// ---------- Prompt building ----------

function buildSystemPrompt() {
  return `
You are a poker strategy assistant. Return ONLY JSON.

Keys:
- gto_strategy (string): Concise but specific 4-line plan:
  "Preflop (SB vs CO, 150bb): 3-bet 10–12bb; A4s mixes (≈20–35%). Fold to 4-bets at this depth."
  "Flop 4♦8♠2♣ (OOP, 3-bet pot): Small c-bet 25–33% ≈55–65%. With A♠4♠ prefer 25–33% (~60%), mix checks; fold mostly vs raises ≥3×."
  "Turn 5♥: Check range; with A♠4♠ call vs 33–50%, mix/fold vs 66–75%, fold vs overbet."
  "River 9♥: After x/c turn, check; fold A♠4♠ vs 75%+. Value-bet only on A/3 rivers (50–66%), fold to raises."
- gto_expanded (string): Full branch map with bet sizes and sizing-conditioned responses (A/B/C bullets for each street).
- exploit_deviation (string): 2–4 short sentences on pool exploits for this node.
- learning_tag (array of 1–3 short strings).

No markdown, no extra keys, JSON object only.
`.trim();
}

function buildUserPrompt(ctx: {
  text: string;
  heroPos: string | null;
  stakes: string | null;
  stackBB: number | null;
  heroCards: string | null;
  flop: string[] | null;
  turn: string | null;
  river: string | null;
}) {
  const { heroPos, stakes, stackBB, heroCards, flop, turn, river } = ctx;

  const pos = heroPos ?? "SB/BTN/BB …";
  const stk = stakes ?? "live";
  const depth = stackBB ?? 100;

  const flopPretty = flop ? flop.map(prettyCard).join(" ") : "unknown";
  const turnPretty = turn ? prettyCard(turn) : "unknown";
  const riverPretty = river ? prettyCard(river) : "unknown";

  const hero = heroCards ?? "unknown";

  return `
Context:
- Hero position: ${pos}
- Stakes: ${stk}
- Effective stack: ${depth}bb
- Hero hand (if known): ${hero}
- Board:
  • Flop: ${flopPretty}
  • Turn: ${turnPretty}
  • River: ${riverPretty}

Task:
1) Produce "gto_strategy" in 4 lines exactly (Preflop, Flop, Turn, River) tailored to the above context.
2) Produce "gto_expanded": A–D branches per street with specific sizes, and sizing-conditioned responses (e.g., "vs 3× raise: fold"; "vs 50% bet: call").
3) "exploit_deviation": concise live-pool exploits relevant here.
4) "learning_tag": 2–3 brief tags (e.g., ["SB vs CO 3-bet pot","Small-bet low boards","Overfold big river"]).

User hand history:
${ctx.text}
`.trim();
}

// ---------- Route handler ----------

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const text: string = (body?.text ?? "").toString();

    // Parse structure
    const flop = extractFlop(text);
    const turn = extractTurn(text);
    const river = extractRiver(text);

    const heroPos = detectPosition(text);
    const stakes = detectStakes(text);
    const stackBB = detectStackBB(text);
    const heroCards = detectHeroCards(text);

    // Keep villain_action as the sentence that contains "raises" or "bets".
    let villain_action = "";
    const firstAction = text.match(/.*?(raises|bets|leads|calls).*?(\n|$)/i);
    if (firstAction) villain_action = firstAction[0].trim();

    // Build prompt
    const system = buildSystemPrompt();
    const user = buildUserPrompt({
      text,
      heroPos,
      stakes,
      stackBB,
      heroCards,
      flop,
      turn,
      river,
    });

    let gto_strategy = "";
    let gto_expanded = "";
    let exploit_deviation = "";
    let learning_tag: string[] = [];

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      const openai = new OpenAI({ apiKey });
      const resp = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });

      const content = resp.choices?.[0]?.message?.content ?? "";
      try {
        const parsed = JSON.parse(content);
        gto_strategy = parsed.gto_strategy ?? "";
        gto_expanded = parsed.gto_expanded ?? "";
        exploit_deviation = parsed.exploit_deviation ?? "";
        learning_tag = Array.isArray(parsed.learning_tag)
          ? parsed.learning_tag
          : [];
      } catch {
        // If the model didn't return valid JSON, soft fallback
        gto_strategy =
          "Preflop: 3-bet 10–12bb; Axs mix. Flop: small c-bet mix; fold vs 3× raises. Turn: check high freq; defend pair+draws vs 50%. River: fold weak one-pair vs 75%+.";
        gto_expanded =
          "A) Preflop 3-bet 10–12bb. B) Flop 25–33%: continue vs calls; fold vs 3× raise. C) Turn check; vs 50% bet call pair+draws; fold vs 75%+. D) River check; fold weak pair vs big bet.";
        exploit_deviation =
          "Live pools overfold to large river bets and under-bluff; fold weak pairs more often. Increase small c-bets on low boards.";
        learning_tag = ["SB vs CO 3-bet pot", "Small-bet low boards"];
      }
    } else {
      // No API key fallback
      gto_strategy =
        "Preflop: 3-bet 10–12bb; Axs mix. Flop: small c-bet mix; fold vs 3× raises. Turn: check high freq; defend pair+draws vs 50%. River: fold weak one-pair vs 75%+.";
      gto_expanded =
        "A) Preflop 3-bet 10–12bb.\nB) Flop 25–33%: continue vs calls; fold vs 3× raise.\nC) Turn check; vs 50% bet call pair+draws; fold vs 75%+.\nD) River check; fold weak pair vs big bet.";
      exploit_deviation =
        "Live pools overfold to large river bets and under-bluff; fold weak pairs more often. Increase small c-bets on low boards.";
      learning_tag = ["SB vs CO 3-bet pot", "Small-bet low boards"];
    }

    // Build the response your UI expects
    const result = {
      parsed: {
        position: heroPos,
        stakes,
        stack_bb: stackBB,
        cards: heroCards,
        villain_action,
        board: {
          flop,
          turn,
          river,
          flop_pretty: flop ? flop.map(prettyCard).join(" ") : null,
          turn_pretty: turn ? prettyCard(turn) : null,
          river_pretty: river ? prettyCard(river) : null,
        },
      },
      gto_strategy,
      gto_expanded,
      exploit_deviation,
      learning_tag,
    };

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        error: "Failed to analyze hand",
        detail: err?.message ?? String(err),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
