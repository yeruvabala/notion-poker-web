// app/api/parse/route.ts
import { NextResponse } from 'next/server';
import { openai } from '@/lib/openai';

// Simple fallback parser if OPENAI_API_KEY is missing
function cheapParse(text: string) {
  const out: any = { learning_tag: [] as string[] };

  // Stakes like 1/2 or $1/$2
  const stakes = text.match(/\$?\d+(\.\d+)?\s*\/\s*\$?\d+(\.\d+)?/i);
  if (stakes) out.stakes = stakes[0];

  // Hero cards (very naive)
  const hero = text.match(/\b([AKQJT2-9]{1,2}\s*[♠♥♦♣shdc]?)\s+([AKQJT2-9]{1,2}\s*[♠♥♦♣shdc]?)\b/);
  if (hero) out.cards = hero[0];

  if (/button|btn/i.test(text) && /bb|big blind/i.test(text)) out.position = 'BTN vs BB';
  else if (/utg/i.test(text)) out.position = 'UTG';
  else if (/mp/i.test(text)) out.position = 'MP';

  const flop = text.match(/\b([AKQJT2-9]{1,2}[♠♥♦♣shdc]?\s+){3}/i);
  const turn = text.match(/\bturn\s+([AKQJT2-9]{1,2}[♠♥♦♣shdc]?)\b/i);
  const river = text.match(/\briver\s+([AKQJT2-9]{1,2}[♠♥♦♣shdc]?)\b/i);
  if (flop) {
    const f = flop[0].trim();
    const t = turn?.[1] ? ` / ${turn[1]}` : '';
    const r = river?.[1] ? ` / ${river[1]}` : '';
    out.board = `${f}${t}${r}`.replace(/\s+/g, ' ');
  }
  return out;
}

function sanitizeHandHistory(text: string): string {
  let cleaned = text;

  // TYPO FIXING (aggressive)
  cleaned = cleaned.replace(/\brasie\b/gi, 'raise');
  cleaned = cleaned.replace(/\braies\b/gi, 'raise');
  cleaned = cleaned.replace(/\bcheks\b/gi, 'checks');
  cleaned = cleaned.replace(/\bvillian\b/gi, 'villain');
  cleaned = cleaned.replace(/\bvillan\b/gi, 'villain');
  cleaned = cleaned.replace(/\bbord\b/gi, 'flop');
  cleaned = cleaned.replace(/\bfllop\b/gi, 'flop');

  // Position normalization
  cleaned = cleaned.replace(/\b(OTB|On the button|Button)\b/gi, 'BTN');
  cleaned = cleaned.replace(/\bUnder the gun\b/gi, 'UTG');
  cleaned = cleaned.replace(/\bCutoff\b/gi, 'CO');
  cleaned = cleaned.replace(/\bHijack\b/gi, 'HJ');
  cleaned = cleaned.replace(/\bSmall blind\b/gi, 'SB');
  cleaned = cleaned.replace(/\bBig blind\b/gi, 'BB');

  // Action normalization
  cleaned = cleaned.replace(/\b(x|X)\b/g, 'checks');
  cleaned = cleaned.replace(/\b(peel|peels|flat|flats)\b/gi, 'calls');
  cleaned = cleaned.replace(/\b(fire|fires|barrel|barrels)\b/gi, 'bets');
  cleaned = cleaned.replace(/\b(jam|jams|shove|shoves)\b/gi, 'all-in');

  return cleaned;
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const rawInput =
      typeof body === 'string'
        ? body
        : typeof body?.input === 'string'
          ? body.input
          : '';

    if (!rawInput.trim()) {
      return NextResponse.json({ error: 'Missing input' }, { status: 400 });
    }

    // SANITIZE: Fix typos and normalize slang
    const input = sanitizeHandHistory(rawInput);

    // Fallback if no key configured
    if (!process.env.OPENAI_API_KEY) {
      const approx = cheapParse(input);
      return NextResponse.json(approx);
    }

    const SYSTEM = `You are a poker study parser. Parse ANY poker notation style into structured JSON.

NOTATION STYLES TO HANDLE:

1. PROFESSIONAL ABBREVIATIONS:
   - "SRP" = Single Raised Pot, "3BP" = 3-Bet Pot, "4BP" = 4-Bet Pot
   - "V" = Villain, "H" = Hero
   - "b33" = bet 33%, "b75" = bet 75%, "b2/3p" = bet 2/3 pot
   - "x" = check, "C" = call, "F" = fold, "R" = raise
   - "F(...)" = Flop, "T(...)" = Turn, "R(...)" = River
   - "EP", "MP", "LP" = early/middle/late position
   - "eff" = effective stack
   - "w/" = with
   
2. BETTING TERMINOLOGY (CRITICAL):
   **Raise Sequence** (count ALL raises from preflop start):
   - 1st raise = "Open" or "Raise" (e.g., "UTG raises to 3bb")
   - 2nd raise = "3-bet" or "Re-raise" (e.g., "BTN 3-bets to 9bb")
   - 3rd raise = "4-bet" or "Re-re-raise" (e.g., "UTG 4-bets to 27bb")
   - 4th raise = "5-bet" (e.g., "BTN 5-bets all-in")
   
   **Examples**:
   - "UTG raises 3bb, CO raises 10bb, Hero raises 30bb" = Hero **4-bets**
   - "SB raises 2.5bb, Hero raises 7bb" = Hero **3-bets**
   - "UTG raises, MP raises, Hero raises" = Hero **4-bets**
   
   **Action Abbreviations**:
   - "c-bet" = continuation bet
   - "donk" = out-of-position bet
   - "probe" = turn donk bet
   - "3b", "4b", "5b" = 3-bet, 4-bet, 5-bet
   
2. BOARD NOTATION:
   - "J-8-2r" = J♠ 8♥ 2♦ (rainbow - different suits)
   - "F(Ks 7h 2d)" = Flop K♠ 7♥ 2♦
   - "T(Qs)" = Turn Q♠
   - "Ah Kh Qh" = A♥ K♥ Q♥
   
3. ACTION ABBREVIATIONS:
   - "x/c" = check/call
   - "x/r" = check/raise  
   - "probe" = donk bet (out of position bet)
   - "jam" = all-in
   - "3b" = 3-bet, "4b" = 4-bet
   - "flats" = calls

4. NARRATIVE TEXT (Amateur):
   - "Ten Nine of hearts" = T♥ 9♥
   - "Ace King suited" = A♠ K♠
   - "Flop comes..." = extract cards from context
   - "I check call" = Hero checks, then calls

IDENTITY RULES:
- "Hero" is the USER. Words like "I", "me", "my" refer to Hero.
- "H" or "Hero" in notation = user's position
- "V" or "Villain" = opponent
- If text says "BTN vs BB", assume Hero is the FIRST position (BTN) unless stated otherwise.
- "SB(Hero)" or "Hero (CO)" = explicit Hero position

CARD/SUIT RULES:
- If cards/board are missing suits, assign generic ones (e.g. AhKh, Ks7h2d) so UI doesn't break.
- "r" suffix = rainbow (all different suits)
- "s" suffix on hand = suited (same suit)
- "87s" = 8♠ 7♠

FEW-SHOT EXAMPLES:

Example 1 (Pro notation):
Input: "SRP. SB(Hero) vs BB. 120bb. KdJc. F(Ks 7h 2d): b33, C."
Output: {
  "position": "SB",
  "cards": "Kd Jc",
  "board": "Flop: Ks 7h 2d",
  "stakes": null
}

Example 2 (Pro narrative):
Input: "Hero in BB w/ 87s. UTG opens, I call. Flop J-8-2r. x, x."
Output: {
  "position": "BB",
  "cards": "8s 7s",
  "board": "Flop: Jh 8d 2c"
}

Example 3 (Amateur narrative):
Input: "I'm in the Big Blind with Ten Nine of hearts. Button opens to 2.5bb and I call."
Output: {
  "position": "BB",
  "cards": "Th 9h",
  "board": null
}

Example 4 (Complex pro notation):
Input: "$2/$5 live. EP raises to $20, Hero (BTN) flats 55. Flop ($65): 8s 5d 2c."
Output: {
  "stakes": "$2/$5",
  "position": "BTN",
  "cards": "5h 5c",
  "board": "Flop: 8s 5d 2c"
}

Example 5 (Position 'vs' scenarios):
Input: "100bb eff. BTN vs BB (Hero). I have Th9h."
Output: {
  "position": "BB",
  "cards": "Th 9h",
  "board": null
}

Return STRICT JSON with keys:
{
  "date": "YYYY-MM-DD" | null,
  "stakes": string | null,
  "position": string | null,
  "cards": string | null,
  "board": string | null,
  "learning_tag": string[]
}`;

    const user = `Text: ${new Date().toISOString().slice(0, 10)}
Rules: If date missing, you may set today's date. Stakes is a free-form string (e.g., "$2/$5" or "2/5").` + '\n\n' + input;

    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: user },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = resp?.choices?.[0]?.message?.content?.trim() || '{}';
    const parsed = JSON.parse(raw);
    parsed.learning_tag = Array.isArray(parsed.learning_tag) ? parsed.learning_tag : [];
    return NextResponse.json(parsed);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Parse failed' }, { status: 500 });
  }
}
