// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

/* ----------------------------- Utilities ----------------------------- */

type ParsedBoard = { flop: string; turn: string; river: string };

function asText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(asText).join("\n");
  if (typeof v === "object")
    return Object.entries(v)
      .map(([k, val]) => `${k}: ${asText(val)}`)
      .join("\n");
  return String(v);
}

function looksLikeTournament(s: string): { isMTT: boolean; hits: string[] } {
  const text = (s || "").toLowerCase();
  const terms = [
    "tournament",
    "mtt",
    "icm",
    "players left",
    "final table",
    "bubble",
    "itm",
    "payout",
    "pay jump",
    "level ",
    "day 1",
    "day 2",
    "ante",
    "bb ante",
    "bba",
  ];
  const hits = terms.filter((t) => text.includes(t));
  // “1k/2k/2k” + ante-like hints
  const levelLike =
    /\b\d+(?:[kKmM]?)[/]\d+(?:[kKmM]?)(?:[/]\d+(?:[kKmM]?))?\b/.test(text) &&
    /ante|bba/.test(text);
  if (levelLike && !hits.includes("level-like")) hits.push("level-like");
  return { isMTT: hits.length > 0, hits };
}

function parseBoard(raw: string): ParsedBoard {
  const out: ParsedBoard = { flop: "", turn: "", river: "" };
  if (!raw) return out;

  // Expected formats supported:
  //  - "Flop: Qh 7d 2c  |  Turn: Kd  |  River: 3c"
  //  - "Qh 7d 2c Kd 3c"
  const norm = raw.replace(/\u2660|\u2665|\u2666|\u2663/g, (s) => s); // keep suit glyphs if present

  const fm = norm.match(/flop[^:]*:\s*([^\n|]+)/i);
  const tm = norm.match(/turn[^:]*:\s*([^\n|]+)/i);
  const rm = norm.match(/river[^:]*:\s*([^\n|]+)/i);

  const clean = (s: string) =>
    s
      .replace(/[|]/g, " ")
      .replace(/,/g, " ")
      .trim()
      .split(/\s+/)
      .slice(0, 5);

  if (fm) {
    const f = clean(fm[1]);
    out.flop = f.slice(0, 3).join(" ");
  }
  if (tm) {
    const t = clean(tm[1]);
    out.turn = t[0] || "";
  }
  if (rm) {
    const r = clean(rm[1]);
    out.river = r[0] || "";
  }

  if (!out.flop || !out.turn || !out.river) {
    const all = clean(norm);
    if (!out.flop && all.length >= 3) out.flop = all.slice(0, 3).join(" ");
    if (!out.turn && all.length >= 4) out.turn = all[3];
    if (!out.river && all.length >= 5) out.river = all[4];
  }
  return out;
}

/* ----------------------------- System Prompt ----------------------------- */

/**
 * We force a structured template the model must fill.
 * It’s CASH-ONLY and contains turn & river guardrails.
 */
const SYSTEM = `
You are a CASH-GAME poker coach. CASH ONLY.

Return ONLY strict JSON with EXACT keys:
{
  "gto_strategy": "string",
  "exploit_deviation": "string",
  "learning_tag": ["string", "string?"]
}

Never endorse the user's line. Give the EV-max line as if advising beforehand.

### Output TEMPLATE (use these headings verbatim; short, crisp bullets):
SITUATION
- Pot type + positions + effective stacks + pot size + SPR.
- Board (if given).

PREFLOP
- Action (sizes).
- Range snapshot (Hero).
- Vs action (brief).

FLOP (<flop-cards>)
- Range/Nuts: who has advantage and why (1 line).
- Sizing plan: 1–2 sizes with percentages.
- Value: short list.
- Semi-bluffs: short list (note blockers/unblockers).
- Vs raise: continue / fold rules.

TURN (<turn-card or "unknown">)
- Card bucket: high overcard / low overcard / straightening / flush-completing / blank.
- Who improves: say which range improves (BTN vs BB logic if applicable).
- Sizing family: pick one family (50–66% or 70–100% or 25–33%) and say why.
- Value barrels: short list.
- Semi-bluffs: short list (prefer good blockers).
- Slowdowns: what checks more.
- Vs raise: continue / fold rules.
- FE rough math: “FE ≈ risk/(risk+reward)” with a **one-line** numeric example based on the current street’s pot and a reasonable size.

RIVER (<river-card or "depends">)
- Classify result card: flush/4-straight/paired/brick.
- Value plan: sizing + which hands.
- Bluff plan: which blockers to prefer; when to give up.
- Vs raise: catching rules.

WHY
- 2–4 bullets: range edge, SPR leverage, pressure on the pool’s bluff-catchers, blocker logic.

### Guardrails (use when applicable)
- BTN vs BB on A/K/Q turns after c-betting: aggressor retains range edge → prefer **mid size (50–66%)** to pressure 8x/6x/underpairs and draws.
- Global river nudges:
  - Flush completes: polarize; value big with flushes/boats; bluff with high-spade blockers.
  - 4-straight cards: polarize; select bluffs that block their calls (e.g., A5 on 5-straight).
  - Paired: value thinner at 40–60%; bluff less.
  - Bricks: thin value with top pair; choose bluffs that unblock folds and block their calls.

Keep everything compact and prescriptive. No markdown. No extra keys.
`;

/* ----------------------------- Handler ----------------------------- */

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      date,
      stakes,
      position,
      cards,
      villainAction = "",
      board = "",
      notes = "",
      rawText = "",
    } = body ?? {};

    const parsedBoard = parseBoard(board);
    const turnForHeader = parsedBoard.turn || "unknown";
    const flopForHeader = parsedBoard.flop || "unknown";
    const riverForHeader = parsedBoard.river || "depends";

    // Build user block; include detected board cards so model can echo them in headers.
    const userBlock = [
      `Date: ${date || "today"}`,
      `Stakes: ${stakes ?? ""}`,
      `Position: ${position ?? ""}`,
      `Hero Cards: ${cards ?? ""}`,
      `Board Detected: Flop(${flopForHeader}) Turn(${turnForHeader}) River(${riverForHeader})`,
      `Villain Action: ${villainAction ?? ""}`,
      "",
      "Raw hand text:",
      (rawText || notes || "").trim() || "(none provided)",
    ].join("\n");

    // Cash-only guard
    const { isMTT, hits } = looksLikeTournament(userBlock);
    if (isMTT) {
      const out = {
        gto_strategy:
          `Cash-only beta: your text looks like a TOURNAMENT hand (${hits.join(
            ", "
          )}). This endpoint analyzes CASH games only. Please re-enter as a cash hand (omit ICM/players-left).`,
        exploit_deviation: "",
        learning_tag: ["cash-only", "mtt-blocked"],
      };
      return NextResponse.json(out);
    }

    // Ask the model for structured JSON
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userBlock },
      ],
      response_format: { type: "json_object" },
    });

    const raw = resp?.choices?.[0]?.message?.content?.trim() || "{}";

    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { gto_strategy: raw, exploit_deviation: "", learning_tag: [] };
    }

    // Ensure the TURN/RIVER headers include cards if the model forgot
    let gto = asText(parsed?.gto_strategy || "");
    if (turnForHeader !== "unknown" && !/TURN\s*\(/i.test(gto)) {
      // Prepend explicit turn header if missing — rare safeguard.
      gto = gto.replace(
        /(\nFLOP[^\n]*\n[\s\S]*?)(\nRIVER|\nWHY|$)/i,
        (_m, a, b) => `${a}\nTURN (${turnForHeader})\n- (fill as above)\n${b}`
      );
    }
    if (riverForHeader !== "depends" && !/RIVER\s*\(/i.test(gto)) {
      gto = gto.replace(/\nWHY\b/i, `\nRIVER (${riverForHeader})\n- (fill as above)\n\nWHY`);
    }

    const out = {
      gto_strategy: gto,
      exploit_deviation: asText(parsed?.exploit_deviation || ""),
      learning_tag: Array.isArray(parsed?.learning_tag)
        ? parsed.learning_tag.filter((t: any) => typeof t === "string" && t.trim())
        : [],
    };

    return NextResponse.json(out);
  } catch (e: any) {
    const msg = e?.message || "Failed to analyze hand";
    console.error("analyze-hand error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
