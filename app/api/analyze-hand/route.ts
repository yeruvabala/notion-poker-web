// app/api/analyze-hand/route.ts
import { NextResponse } from "next/server";
import { openai } from "@/lib/openai";

/**
 * ============================================================
 * Poker analyze endpoint (policy-guided + detailed strategy)
 * - Never endorses user’s line; decides independently.
 * - Uses a small policy engine for short-stack preflop spots.
 * - Adds FE / SPR math hints to enrich "GTO Strategy".
 * - Returns ONLY { gto_strategy, exploit_deviation, learning_tag }.
 * ============================================================
 */

/* ---------------- Utilities ---------------- */
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

// Normalize to uppercase rank & detect suited/offsuit
// Accepts "A♠ 4♠", "As 4s", "A4s", "A4o", "a4 of spades", etc.
// Returns labels like "A4s", "A4o", "55" (pairs ignore suitedness).
function parseHandLabel(cards: string | null | undefined): string {
  const s = asText(cards).trim();
  if (!s) return "";

  // Extract ranks + suit tokens
  const toRank = (ch: string) => {
    const up = ch.toUpperCase();
    return "23456789TJQKA".includes(up) ? up : "";
  };

  // Try: explicit two tokens "As 4s" / "A♠ 4♠"
  const m1 = s.match(/([2-9TJQKA])\s*([shdc♥♦♣♠])[^A-Z0-9]*([2-9TJQKA])\s*([shdc♥♦♣♠])/i);
  if (m1) {
    const r1 = toRank(m1[1]);
    const r2 = toRank(m1[3]);
    const suit1 = m1[2];
    const suit2 = m1[4];
    if (!r1 || !r2) return "";
    if (r1 === r2) return `${r1}${r2}`; // pair
    const suited = (suit1 === suit2) || ("♥♦♣♠".includes(suit1) && suit1 === suit2);
    // upper-high-first (A4 not 4A)
    const [hi, lo] = "AKQJT98765432"
      .split("")
      .reduce((acc, r) => {
        if (r === r1 || r === r2) acc.push(r);
        return acc;
      }, [] as string[]);
    return `${hi}${lo}${suited ? "s" : "o"}`;
  }

  // Try: compact "A4s"/"A4o"
  const m2 = s.match(/\b([2-9TJQKA])\s*([2-9TJQKA])\s*([so])\b/i);
  if (m2) {
    const r1 = toRank(m2[1])!;
    const r2 = toRank(m2[2])!;
    if (r1 === r2) return `${r1}${r2}`;
    // sort high-first
    const order = "AKQJT98765432";
    const [hi, lo] = order.indexOf(r1) < order.indexOf(r2) ? [r1, r2] : [r2, r1];
    return `${hi}${lo}${m2[3].toLowerCase()}`;
  }

  // Try: “A4 of spades/hearts/…” → suited
  const m3 = s.match(/\b([2-9TJQKA])\s*([2-9TJQKA])\s*of\s*(spades?|hearts?|diamonds?|clubs?)\b/i);
  if (m3) {
    const r1 = toRank(m3[1])!;
    const r2 = toRank(m3[2])!;
    if (r1 === r2) return `${r1}${r2}`;
    const order = "AKQJT98765432";
    const [hi, lo] = order.indexOf(r1) < order.indexOf(r2) ? [r1, r2] : [r2, r1];
    return `${hi}${lo}s`;
  }

  // Fallback: try “A4” with optional suited word near it
  const m4 = s.match(/\b([2-9TJQKA])\s*([2-9TJQKA])\b/i);
  if (m4) {
    const r1 = toRank(m4[1])!;
    const r2 = toRank(m4[2])!;
    if (r1 === r2) return `${r1}${r2}`;
    const order = "AKQJT98765432";
    const [hi, lo] = order.indexOf(r1) < order.indexOf(r2) ? [r1, r2] : [r2, r1];
    // try to infer “suited/offsuit” words around
    const suitedWord = /\b(suited|same\s*suit)\b/i.test(s) ? "s" : (/\b(o|offsuit)\b/i.test(s) ? "o" : "");
    return `${hi}${lo}${suitedWord}`;
  }

  return ""; // unknown
}

// Pull a number like "12bb" / "12 bb" / "effective 12bb"
function extractEffBB(text: string): number | null {
  const s = text.toLowerCase();
  const m =
    s.match(/effective[^0-9]{0,6}(\d+(?:\.\d+)?)\s*bb/) ||
    s.match(/\b(\d+(?:\.\d+)?)\s*bb\b/);
  if (!m) return null;
  const v = parseFloat(m[1]);
  return isFinite(v) ? v : null;
}

// Find the opener & formation quickly
function detectFormation(text: string, position?: string | null) {
  const s = (text || "").toLowerCase();
  const posUp = (position || "").toUpperCase();

  const heroIsBB = /\b(i|hero).{0,15}\b(bb|big blind)\b/i.test(text) || posUp === "BB";
  const heroIsSB = /\b(i|hero).{0,15}\b(sb|small blind)\b/i.test(text) || posUp === "SB";

  // Who raised?
  const sbOpened = /\b(sb|small blind)\b.{0,20}\b(raise|opens?)\b/i.test(text);
  const btnOpened = /\b(btn|button)\b.{0,20}\b(raise|opens?)\b/i.test(text);
  const coOpened = /\b(co|cutoff)\b.{0,20}\b(raise|opens?)\b/i.test(text);

  if (sbOpened && heroIsBB) return "SB_open_BB";
  if (btnOpened && heroIsBB) return "BTN_open_BB";
  if (coOpened && heroIsBB) return "CO_open_BB";
  if (btnOpened && heroIsSB) return "BTN_open_SB";
  return ""; // unknown/other
}

// Extract open size in BB (e.g., “2.5x”, “to 2.3bb”)
function extractOpenSizeBB(text: string): number | null {
  const s = text.toLowerCase();
  // “raises to 2.5bb” / “opens 2.2x”
  const toBB = s.match(/\b(to|=)\s*(\d+(?:\.\d+)?)\s*bb\b/);
  if (toBB) return parseFloat(toBB[2]);
  const mult = s.match(/\b(\d+(?:\.\d+)?)\s*x\b/);
  if (mult) return parseFloat(mult[1]);
  return null;
}

// Very light ante detector (true if BB ante likely present)
function hasAnte(text: string): boolean {
  const s = text.toLowerCase();
  return /\bante|bba|big\s*blind\s*ante\b/.test(s);
}

// Simple equity guess for 55 vs a call range from SB after open (very rough)
function approxEquity55VsSBCall(): number {
  // Typical SB 2.5x → call vs jam range contains: 22+, A8o+, A5s+, KQo, KJs+, QJs, JTs, T9s… 55 has ~36–40%
  return 0.38;
}

/* ---------------- Short-stack policy engine ----------------
   Goal: where we’re confident (common spots), fix the decision
   so the model *explains* the correct play instead of endorsing
   the user line.
---------------------------------------------------------------- */
type PolicyDecision = { action: "Jam" | "Call" | "Fold"; reason: string };

function shortStackPolicy(
  formation: string,
  effBB: number | null,
  handLabel: string
): PolicyDecision | null {
  if (!effBB || effBB <= 0) return null;

  // Normalize hand category helpers
  const isPair = /^[2-9TJQKA]\1$/.test(handLabel);
  const rankOrder = "23456789TJQKA";
  const pairRankIdx = isPair ? rankOrder.indexOf(handLabel[0]) : -1;

  // === SB opens, Hero BB, 10–14bb: low pairs (22–66) → JAM ===
  if (formation === "SB_open_BB" && effBB >= 10 && effBB <= 14) {
    if (isPair && pairRankIdx >= 0 && pairRankIdx <= rankOrder.indexOf("6")) {
      return {
        action: "Jam",
        reason:
          "Short-stack MTT: SB opens wide; 22–66 realize equity poorly postflop. Jam leverages fold equity and avoids rough SPR play.",
      };
    }
  }

  // === Generic: Unknown formation or deeper stacks → no forced rule ===
  return null;
}

/* ---------------- System prompt ---------------- */
const SYSTEM = `You are a tough, no-nonsense poker coach.
Return STRICT JSON with EXACT keys:
{
  "gto_strategy": "string",
  "exploit_deviation": "string",
  "learning_tag": ["string", "string?"]
}
Rules:
- Do NOT endorse what the user did; decide independently.
- Be prescriptive. Start with Preflop. Include sizes (bb or % pot) and the *final action* for the key node.
- If a clear preflop decision exists (jam/call/fold), state it plainly first.
- Add a brief "Why" section with 2–5 bullets (fold-equity math, equity when called, SPR, formation).
- If info is missing and suits matter postflop, list what's missing in one line (e.g., "Need suits to evaluate flush blockers").
- Keep exploit_deviation to 2–4 crisp sentences about pool tendencies and how to deviate.
- Use short, practical learning_tag values (1–3 max).
- No markdown, no extra keys. JSON only.`;

/* ---------------- Handler ---------------- */
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
    } = (body ?? {}) as {
      date?: string | null;
      stakes?: string | null;
      position?: string | null;
      cards?: string | null;
      villainAction?: string | null;
      board?: string | null;
      notes?: string | null;
      rawText?: string | null;
    };

    const fullText = [rawText, notes].filter(Boolean).join("\n");
    const handLabel = parseHandLabel(cards);
    const effBB = extractEffBB(fullText);
    const formation = detectFormation(fullText, position);
    const openSize = extractOpenSizeBB(fullText);
    const ante = hasAnte(fullText);

    // Small policy engine (only where very confident)
    const policy = shortStackPolicy(formation, effBB, handLabel);

    // Build math hints (only when we can make reasonable assumptions)
    let feHint = "";
    if (formation === "SB_open_BB" && effBB && openSize) {
      // Risk ≈ effBB - 1 (we've posted 1bb)
      const risk = Math.max(effBB - 1, 0);
      // Reward ≈ villain open + blinds + ante (approx). If BBA, add 1bb ante.
      const reward = (openSize || 0) + 1 /*BB*/ + 0.5 /*SB approx*/ + (ante ? 1 : 0);
      const fe0 = risk > 0 ? risk / (risk + reward) : 0;
      const eqCall = approxEquity55VsSBCall();
      feHint =
        `Risk≈${risk.toFixed(1)}bb, Reward≈${reward.toFixed(1)}bb → FE₀≈${Math.round(
          fe0 * 100
        )}% (zero-equity). With ~${Math.round(eqCall * 100)}% equity when called, FE threshold is lower.`;
    }

    // Situation block sent to the model (normalized + policy guidance)
    const situationLines = [
      `Date: ${date || "today"}`,
      `Mode/Stakes: ${stakes ?? ""}`,
      `Hero Position: ${position ?? ""}`,
      `Hero Hand: ${handLabel || asText(cards) || ""}`,
      `Formation: ${formation || "(unknown)"}`,
      `Effective Stack: ${effBB ? `${effBB}bb` : "(unknown)"}`,
      `Open Size: ${openSize ? `${openSize}bb` : "(unknown)"}`,
      `Antes: ${ante ? "Yes" : "No/Unknown"}`,
      `Board: ${board || ""}`,
      `Villain Action: ${villainAction || ""}`,
      policy ? `POLICY_DECISION: ${policy.action} preflop. Rationale: ${policy.reason}` : "",
      feHint ? `MATH_HINT: ${feHint}` : "",
      "",
      "Raw:",
      fullText || "(none)",
    ]
      .filter(Boolean)
      .join("\n");

    // Single LLM call (deterministic) — we *guide* it with POLICY_DECISION/MATH_HINT
    const resp = await openai.chat.completions.create({
      model: "gpt-4o", // upgrade from mini for better consistency
      temperature: 0,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: situationLines },
      ],
      response_format: { type: "json_object" },
      // max_tokens: 700, // uncomment & tune if you need longer outputs
    });

    const raw = resp?.choices?.[0]?.message?.content?.trim() || "{}";

    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {
        gto_strategy: raw,
        exploit_deviation: "",
        learning_tag: [],
      };
    }

    // Post-guard: if we had a policy decision and model didn't clearly state it in preflop line,
    // prefix our preflop directive so users always get the correct action.
    let gto = asText(parsed?.gto_strategy || "");
    const preHasJam = /\b(jam|shove)\b/i.test(gto);
    const preHasCall = /\bcall\b/i.test(gto);
    const preHasFold = /\bfold\b/i.test(gto);

    if (policy) {
      const want = policy.action.toLowerCase();
      const ok =
        (want === "jam" && preHasJam) ||
        (want === "call" && preHasCall) ||
        (want === "fold" && preHasFold);

      if (!ok) {
        const prefix = `Preflop: ${policy.action} (${effBB ? `${effBB}bb` : "short stack"} vs ${formation || "opener"}).`;
        const why =
          feHint ||
          "Why: Short-stack tournament dynamics favor taking fold equity over playing low SPR postflop.";
        gto = `${prefix}\n${gto ? gto + "\n" : ""}Why:\n• ${why}`;
      }
    }

    // Add a Why section if model forgot, but we have math hints
    const hasWhy = /\n\s*Why\b/i.test(gto);
    if (feHint && !hasWhy) {
      gto = `${gto}\n\nWhy:\n• ${feHint}`.trim();
    }

    // Reasonable default tags
    const tagsFromPolicy: string[] = [];
    if (formation) tagsFromPolicy.push(formation.replace(/_/g, " "));
    if (effBB) tagsFromPolicy.push(`${Math.round(effBB)}bb`);
    if (policy) tagsFromPolicy.push(`${policy.action} pre`);

    const out = {
      gto_strategy: gto,
      exploit_deviation: asText(parsed?.exploit_deviation || ""),
      learning_tag: Array.isArray(parsed?.learning_tag) && parsed.learning_tag.length
        ? parsed.learning_tag
        : tagsFromPolicy,
    };

    return NextResponse.json(out);
  } catch (e: any) {
    const msg = e?.message || "Failed to analyze hand";
    console.error("analyze-hand error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
