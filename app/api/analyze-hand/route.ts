// app/api/analyze-hand/route.ts
import { NextResponse } from 'next/server';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;

// --- small helper: pull JSON out even if there is extra text around it
function tryParseJSON(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/\{[\s\S]*\}$/); // last JSON object in the string
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    return null;
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const position = body?.position ?? '';
    const stakes   = body?.stakes ?? '';
    const cards    = body?.cards ?? ''; // Hero hand, e.g. "A♠4♠"
    const villain  = body?.villainAction ?? ''; // free text of line

    // --- Build a compact description of the situation for the model
    const situation =
      `Position: ${position || 'SB vs CO (default)'} • Stakes: ${stakes || 'live/cash'} • Hero: ${cards || 'unknown'} • Villain line: ${villain || '—'}`;

    // --- RIGID spec the model must follow
    const system = `
You are a poker strategy assistant. Return ONLY strict JSON.

Keys:
- "gto_strategy" (string): 4 short lines (Preflop, Flop, Turn, River). Each line MUST include sizes and clear frequencies. Keep it <= 80 words total. Example style:
  "Preflop (SB vs CO, 150bb): 3-bet 10–12bb; A4s mixes (≈20–35%). Fold to 4-bets at this depth.
   Flop 4♦8♠2♣ (OOP, 3-bet pot): Small c-bet 25–33% ≈55–65%. With A♠4♠ prefer 25–33% (≈60%), mix checks; fold mostly vs raises ≥3×.
   Turn 5♥: Check range; with A♠4♠ (pair+gutter) call vs 33–50%, mix/fold vs 66–75%, fold vs overbet.
   River 9♥: After x/c turn, check; fold A♠4♠ vs 75%+. Value-bet only on A/3 rivers (50–66%), fold to raises."

- "exploit_deviation" (string): 2–4 sentences of pool exploits (≤ 60 words).

- "learning_tag" (array of 1–3 short strings): e.g. ["SB vs CO 3-bet pot", "Small-bet low boards"]

- "gto_expanded" (string): MULTI-LINE ASCII BRANCH MAP showing concrete, sizing-conditioned decisions. MUST use this exact format:

Preflop —
A) If CO opens 2.2–2.7bb → 3-bet 10–12bb with Axs at 20–35% freq; mix calls with A4s at low freq.
B) If CO 4-bets 20–25bb → Fold A4s at 150bb; rare 5-bet bluffs only at lower stacks.
C) If CO flats the 3-bet → Go to Flop.

Flop (K♣7♦2♠) — OOP in 3-bet pot
A) Hero bets small (25–33%) →
   1) CO folds → Take it.
   2) CO calls → Go to Turn.
   3) CO raises 3× → With {hand archetype}, fold; continue {mixes}…
   4) CO raises 5×+ → Mostly fold.
B) Hero checks →
   1) CO bets 33–50% → Action…
   2) CO bets 60–75% → Action…
   3) CO checks → Plan…

Turn (card) —
A) After small c-bet/call →
   1) vs 33–50% → Call with {made+draws}, fold {bottom pairs}; …
   2) vs 66–75% → Mix; lean folds with {weakest bluff-catchers}; …
   3) vs overbet → Mostly fold.
B) After check/check → Probe {50–66%} on {improving cards}; otherwise check.

River (card) —
A) After x/c turn → Check range.
   1) vs 50–60% → Call {top pairs/better}, fold {lowest pairs}.
   2) vs 75%+ → Over-fold {one-pair no blockers}; call {best bluff-catchers}.
B) After missed probe → Value bet {A/3 rivers 50–66%}; fold to raises.

CONSTRAINTS:
- Put actual board cards you infer from the hand text (if present) in the Flop/Turn/River headers.
- Always include sizes (bb or % pot) in branches.
- No markdown, no code blocks, no explanations outside JSON.
`;

    const user = `
Hand/situation:
${situation}

Task:
1) Produce "gto_strategy" in 4 lines exactly as in the example style above (with sizes + brief frequencies; ≤80 words).
2) Produce 2–4 sentence "exploit_deviation".
3) 1–3 "learning_tag".
4) Produce the full "gto_expanded" BRANCH MAP exactly in the ASCII layout shown in the spec, with A)/B)/C) and numbered sub-branches, and with size-conditioned decisions.

Return ONLY a single JSON object with those keys.
`;

    const resp = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini', // or your model
        temperature: 0.3,
        messages: [
          { role: 'system', content: system.trim() },
          { role: 'user', content: user.trim() }
        ]
      })
    });

    if (!resp.ok) {
      const err = await resp.text();
      return NextResponse.json({ error: `OpenAI error: ${err}` }, { status: 500 });
    }

    const data = await resp.json();
    const text = data?.choices?.[0]?.message?.content ?? '';
    const parsed = tryParseJSON(text);

    const out = {
      gto_strategy: parsed?.gto_strategy || '—',
      exploit_deviation: parsed?.exploit_deviation || '—',
      learning_tag: Array.isArray(parsed?.learning_tag) ? parsed.learning_tag.slice(0, 3) : [],
      gto_expanded: parsed?.gto_expanded || '—'
    };

    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Analyze failed' }, { status: 500 });
  }
}
