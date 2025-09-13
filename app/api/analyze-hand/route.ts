// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

/** Simple tournament detector */
function looksLikeTournament(s: string): { isMTT: boolean; hits: string[] } {
  const text = (s || "").toLowerCase();
  const terms = [
    "tournament","mtt","icm","players left","left","itm","in the money","final table","bubble",
    "level ","l1","l2","l10","bba","bb ante","ante","day 1","day 2","min-cash","pay jump","payout"
  ];
  const hits = terms.filter(t => text.includes(t));
  // also catch “$xxx mtt” or typical level formats like “1k/2k/2k”
  const levelLike = /\b\d+(?:[kKmM]?)[/]\d+(?:[kKmM]?)(?:[/]\d+(?:[kKmM]?))?\b/.test(text) && /ante|bba/.test(text);
  if (levelLike && !hits.includes("level-like")) hits.push("level-like");
  return { isMTT: hits.length > 0, hits };
}

const SYSTEM = `You are a CASH-GAME poker coach. CASH ONLY.
Return ONLY JSON with EXACT keys:
{
  "gto_strategy": "string",
  "exploit_deviation": "string",
  "learning_tag": ["string", "string?"]
}
Rules:
- Assume CASH game. Ignore any tournament/ICM/bubble/players-left concepts.
- If stacks are not given, assume ~100bb effective.
- Do NOT endorse what the user did; recommend the EV-max line as if advising ahead of time.
- Be concrete: actions + sizes (bb or % pot). Use Preflop / Flop / Turn / River headings in plain text.
- Include a short "Why" section with the key idea (range advantage, board texture, SPR, fold-equity threshold ≈ risk/(risk+reward)).
- Keep it compact and prescriptive. No markdown, no extra keys.`;

function asText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v.map(asText).join("\n");
  if (typeof v === "object")
    return Object.entries(v).map(([k, val]) => `${k}: ${asText(val)}`).join("\n");
  return String(v);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      date, stakes, position, cards, villainAction = "", board = "", notes = "", rawText = ""
    } = body ?? {};

    // Build a compact user block
    const userBlock = [
      `Date: ${date || "today"}`,
      `Stakes: ${stakes ?? ""}`,
      `Position: ${position ?? ""}`,
      `Hero Cards: ${cards ?? ""}`,
      `Board: ${board ?? ""}`,
      `Villain Action: ${villainAction ?? ""}`,
      "",
      "Raw hand text:",
      (rawText || notes || "").trim() || "(none provided)"
    ].join("\n");

    // Cash-only guard
    const { isMTT, hits } = looksLikeTournament(userBlock);
    if (isMTT) {
      const out = {
        gto_strategy:
          `Cash-only beta: your text looks like a TOURNAMENT hand (${hits.join(", ")}). ` +
          `This build analyzes CASH games only. Please re-enter as a cash hand (omit ICM/players-left).`,
        exploit_deviation: "",
        learning_tag: ["cash-only", "mtt-blocked"]
      };
      return NextResponse.json(out);
    }

    // Normal CASH analysis
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: userBlock }
      ],
      response_format: { type: "json_object" }
    });

    const raw = resp?.choices?.[0]?.message?.content?.trim() || "{}";

    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { gto_strategy: raw, exploit_deviation: "", learning_tag: [] };
    }

    const out = {
      gto_strategy: asText(parsed?.gto_strategy || ""),
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
