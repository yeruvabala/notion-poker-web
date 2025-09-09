// app/api/range/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

/**
 * Returns an AI-generated preflop decision map (169 combos).
 * For each label (AA, AKs, AKo, ... 32o) we want { raise, call, fold } that sum to 100.
 */
const SYSTEM = `You are a poker preflop range assistant.
Given a short hand description (stakes, position, hero cards, and context like "CO opened, SB 3-bet", etc.),
return a JSON object with:
- position: the hero position you used (UTG/MP/HJ/CO/BTN/SB/BB).
- scenario: one concise line (e.g., "SB 3-bet vs CO open", "BTN open", "BB vs BTN open", etc.).
- grid: an object with EXACTLY 169 keys for all hand labels in a 13x13 grid:
  AA, AKs, AQs, AJs, ATs, A9s, ... A2s,
  AKo, KKo, QQo, ..., 22o (use "o" only for off-suit non-diagonal),
  For pairs use "TT", "99", ..., "22" (no "o" or "s").
Each grid value must be: { "raise": <int>, "call": <int>, "fold": <int> } (all integers 0..100, summing to 100).
Use poker best-practice baselines and the provided context to modulate frequencies.
If information is missing, use a sensible default for that player pool and position.
Output JSON only, with the exact keys: position, scenario, grid.`;

const LABELS = buildLabels();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { input, position, heroCards, stakes, board } = body ?? {};
    const user = [
      `Text: ${input || ""}`,
      `Position: ${position || "unknown"}`,
      `Hero: ${heroCards || ""}`,
      `Stakes: ${stakes || ""}`,
      `Board: ${board || ""}`,
      `Return JSON only.`,
    ].join("\n");

    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
      response_format: { type: "json_object" },
    });

    const raw = resp?.choices?.[0]?.message?.content?.trim() || "{}";
    const parsed = safeJSON(raw);

    // Normalize to a full 169-map even if model drops a few labels
    const gridIn = (parsed?.grid ?? parsed?.range) || {};
    const gridOut: Record<string, { raise: number; call: number; fold: number }> = {};
    for (const lbl of LABELS) gridOut[lbl] = normalizeTriple(gridIn[lbl]);

    return NextResponse.json({
      position: parsed?.position || position || "",
      scenario: parsed?.scenario || "",
      grid: gridOut,
    });
  } catch (e: any) {
    console.error("range route error:", e?.message || e);
    return NextResponse.json(
      { error: e?.message || "Failed to generate range" },
      { status: 500 }
    );
  }
}

/** Helpers */
function safeJSON(s: string) {
  try { return JSON.parse(s); } catch { return {}; }
}
function normalizeTriple(x: any) {
  const r = clampInt(x?.raise), c = clampInt(x?.call), f = clampInt(x?.fold);
  const sum = r + c + f;
  if (sum === 0) return { raise: 0, call: 0, fold: 100 };
  if (sum === 100) return { raise: r, call: c, fold: f };
  // normalize to 100
  const rr = Math.round((r * 100) / sum);
  const cc = Math.round((c * 100) / sum);
  const ff = 100 - rr - cc;
  return { raise: rr, call: cc, fold: ff };
}
function clampInt(v: any) {
  const n = Math.max(0, Math.min(100, Math.round(Number(v ?? 0))));
  return Number.isFinite(n) ? n : 0;
}
function buildLabels() {
  const R = ["A","K","Q","J","T","9","8","7","6","5","4","3","2"];
  const out: string[] = [];
  for (let i = 0; i < R.length; i++) {
    for (let j = 0; j < R.length; j++) {
      if (i === j) out.push(`${R[i]}${R[j]}`);
      else if (i < j) out.push(`${R[i]}${R[j]}s`);
      else out.push(`${R[i]}${R[j]}o`);
    }
  }
  return out;
}
