import { NextResponse } from 'next/server';
import { openai } from '@/lib/openai';

/* ---------------- helpers (exactly as you use) ---------------- */
function asText(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(asText).join('\n');
  if (typeof v === 'object') {
    return Object.entries(v).map(([k, val]) => `${k}: ${asText(val)}`).join('\n');
  }
  return String(v);
}

function looksLikeTournament(s: string): { isMTT: boolean; hits: string[] } {
  const text = (s || '').toLowerCase();
  const terms = [
    'tournament', 'mtt', 'icm', 'players left', 'final table', 'bubble', 'itm',
    'day 1', 'day 2', 'level ', 'bb ante', 'bba', 'ante', 'pay jump', 'payout',
  ];
  const hits = terms.filter(t => text.includes(t));
  const levelLike =
    /\b\d+(?:[kKmM]?)[/]\d+(?:[kKmM]?)(?:[/]\d+(?:[kKmM]?))?\b/.test(text) &&
    /ante|bba/.test(text);
  if (levelLike && !hits.includes('level-like')) hits.push('level-like');
  return { isMTT: hits.length > 0, hits };
}

function detectRiverFacingCheck(text: string): boolean {
  const s = (text || '').toLowerCase();
  const riverLine = (s.match(/(?:^|\n)\s*river[^:\n]*[: ]?\s*([^\n]*)/i)?.[1] || '').toLowerCase();
  const hasCheck = /\b(checks?|x)\b/.test(riverLine);
  const heroChecks = /\b(hero|i)\s*(checks?|x)\b/.test(riverLine);
  return hasCheck && !heroChecks;
}

function detectRiverFacingBet(text: string): { facing: boolean; large: boolean } {
  const s = (text || '').toLowerCase();
  const riverLine = (s.match(/(?:^|\n)\s*river[^:\n]*[: ]?\s*([^\n]*)/i)?.[1] || '').toLowerCase();
  const heroActsFirst = /\b(hero|i)\b/.test(riverLine) && /\b(bets?|jam|shove|raise)/.test(riverLine);
  const facing =
    /\b(bets?|bet\b|jam|shove|all[- ]?in|pot)\b/.test(riverLine) &&
    !heroActsFirst &&
    !/\b(checks?|x)\b/.test(riverLine);
  const large =
    facing &&
    /\b(3\/4|0\.75|75%|two[- ]?thirds|2\/3|0\.66|66%|pot|all[- ]?in|jam|shove)\b/.test(riverLine);
  return { facing, large };
}

type Rank = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';
const RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const RANK_VAL: Record<Rank, number> = { A: 14, K: 13, Q: 12, J: 11, T: 10, 9: 9, 8: 8, 7: 7, 6: 6, 5: 5, 4: 4, 3: 3, 2: 2 };

function pickRanksFromCards(str: string): Rank[] {
  const s = (str || '').toUpperCase();
  const out: Rank[] = [];
  for (const ch of s) if ((RANKS as string[]).includes(ch)) out.push(ch as Rank);
  return out;
}

function extractHeroRanks(cardsField?: string, rawText?: string): Rank[] {
  const c = pickRanksFromCards(cardsField || '');
  if (c.length >= 2) return c.slice(0, 2);
  const m = (rawText || '').match(/\bwith\s+([akqjt2-9hcds\s]+)\b/i);
  if (m) return pickRanksFromCards(m[1]).slice(0, 2);
  const m2 = (rawText || '').match(/\bhero\s+([akqjt2-9hcds\s]{2,10})\b/i);
  if (m2) return pickRanksFromCards(m2[1]).slice(0, 2);
  return [];
}

function extractBoardRanks(boardField?: string, rawText?: string): Rank[] {
  const a = pickRanksFromCards(boardField || '');
  if (a.length) return a;
  const s = rawText || '';
  const ranks: Rank[] = [];
  const add = (line: string) => pickRanksFromCards(line).forEach(r => ranks.push(r));
  const flop = s.match(/flop[^:\n]*[: ]?([^\n]*)/i)?.[1] || '';
  const turn = s.match(/turn[^:\n]*[: ]?([^\n]*)/i)?.[1] || '';
  const river = s.match(/river[^:\n]*[: ]?([^\n]*)/i)?.[1] || '';
  add(flop); add(turn); add(river);
  return ranks;
}
function isBoardPaired(board: Rank[]): boolean {
  const counts: Record<string, number> = {};
  for (const r of board) counts[r] = (counts[r] || 0) + 1;
  return Object.values(counts).some(n => n >= 2);
}
function isHeroTopPair(hero: Rank[], board: Rank[]): boolean {
  if (hero.length < 2 || board.length < 3) return false;
  const topBoard = board.reduce<Rank>((best, r) => (RANK_VAL[r] > RANK_VAL[best] ? r : best), '2');
  return hero.includes(topBoard);
}
function hasTripsWeakKicker(hero: Rank[], board: Rank[]): boolean {
  if (hero.length < 2 || board.length < 3) return false;
  const counts: Record<string, number> = {};
  for (const r of board) counts[r] = (counts[r] || 0) + 1;
  const paired = RANKS.filter(r => (counts[r] || 0) >= 2);
  if (!paired.length) return false;
  const heroCounts: Record<string, number> = {};
  for (const r of hero) heroCounts[r] = (heroCounts[r] || 0) + 1;
  const tripsRank = paired.find(r => (heroCounts[r] || 0) === 1);
  if (!tripsRank) return false;
  const other = hero[0] === tripsRank ? hero[1] : hero[0];
  if (!other) return false;
  return RANK_VAL[other] <= RANK_VAL['Q'];
}
function computeStrongKickerTopPair(hero: Rank[], board: Rank[]): boolean {
  if (hero.length < 2 || board.length < 3) return false;
  const topBoard = board.reduce<Rank>((best, r) => (RANK_VAL[r] > RANK_VAL[best] ? r : best), '2');
  if (!hero.includes(topBoard)) return false;
  const other = hero[0] === topBoard ? hero[1] : hero[0];
  return other === 'A';
}

/* ------------------- SYSTEM PROMPT ------------------- */
const SYSTEM = `You are a CASH-GAME poker coach. CASH ONLY.

Return ONLY JSON with EXACT keys:
{
  "gto_strategy": "string",
  "exploit_deviation": "string",
  "learning_tag": ["string","string?"]
}

CRITICAL REQUIREMENTS:

0. **BETTING TERMINOLOGY** (MUST GET THIS RIGHT):
   
   **HOW TO COUNT RAISES** (step by step):
   - Find EVERY "raise", "raised", "raises to", "reraise", "reraised" in preflop action
   - Count them: 1st=Open, 2nd=3-bet, 3rd=4-bet, 4th=5-bet
   
   **NARRATIVE TEXT EXAMPLES**:
   - "UTG raised to 1.1k and CO raised to 3k and I reraised to 12k"
     → UTG raised (1st), CO raised (2nd=3-bet), I reraised (3rd=**4-bet**)
     → Hero **4-bets**, NOT 3-bets!
   
   - "UTG opens, I 3-bet, UTG 4-bets, I jam"
     → UTG opens (1st), I 3-bet (2nd), UTG 4-bets (3rd), I jam (4th=**5-bet**)
   
   - "BTN raises, I reraise from BB"
     → BTN raises (1st), I reraise (2nd=**3-bet**)
   
   **KEY WORDS THAT INDICATE A RAISE**:
   - "raised", "raises", "reraise", "reraised", "3-bet", "4-bet", "5-bet"
   - Size increases: "to 3k" after "to 1k" = another raise
   
   **ALWAYS count before writing! If you see 3 raises before Hero acts, Hero's raise is a 4-bet!**

1. **STREET-BY-STREET ANALYSIS**:
   You MUST analyze strategy at ALL provided streets in chronological order:
   - If preflop action exists → Discuss preflop strategy
   - If flop cards exist → Discuss flop strategy  
   - If turn card exists → Discuss turn strategy
   - If river card exists → Discuss river strategy
   
   DO NOT skip streets! Analyze each street's decision sequentially.

2. **STRICT RULE - ANALYZE ONLY WHAT HAPPENED**:
   
   **CRITICAL**: DO NOT discuss hypothetical future streets!
   
   - If hand ended preflop (everyone folded) → Analyze ONLY preflop
   - If hand ended on flop → Analyze ONLY preflop and flop
   - If hand ended on turn → Analyze ONLY preflop, flop, and turn
   - If hand went to river/showdown → Analyze ALL streets
   
   **WRONG**: "If this hand had reached the river, you would..."
   **WRONG**: "In a typical river situation, you would..."
   **WRONG**: "On future streets, you should..."
   
   **RIGHT**: "**PREFLOP** [analysis] **DECISION**: Fold. Hand ended preflop."
   **RIGHT**: "**PREFLOP** [analysis] **FLOP** [analysis] **DECISION**: Opponent folded to your bet."
   
   If the hand didn't reach a street, DO NOT mention that street at all!

3. **RANGE-BASED ANALYSIS** (CRITICAL FOR ACCURATE STRATEGY):
   
   **STEP 1: Construct Villain's Range from Preflop Action**
   - 3-bet caller range: JJ+, AKs, AKo, sometimes AQs, TT
   - 4-bet caller range: QQ+, AK (VERY narrow! No Q9, no suited connectors!)
   - 5-bet range: KK+, AKs
   - Cold caller range: Wider, includes suited connectors, pocket pairs
   
   **STEP 2: MAINTAIN Range Consistency on ALL Streets**
   **CRITICAL**: Once you establish villain's preflop range, you CANNOT add hands later!
   - 4-bet caller on flop/turn/river = STILL only QQ+, AK
   - They CANNOT suddenly have Qx, Tx, 9x, draws, or suited connectors
   - The range can only get NARROWER, never wider!
   
   **WRONG**: "Preflop: CO range is QQ+, AK" → "Turn: CO could have Qx or draws"
   **RIGHT**: "Preflop: CO range is QQ+, AK" → "Turn: CO's range is still QQ, KK, AA, AK"
   
   **STEP 3: Calculate POT ODDS and MDF for Decisions**
   When facing an all-in or large bet, you MUST calculate:
   
   1. **Pot Odds** = Risk / (Risk + Pot) = equity needed to call
      Example: 50k into 24k pot → 50k / 124k = 40% equity needed
   
   2. **Count Combos** vs narrowed range:
      - QQ: 6 combos (3 if Q on board)
      - KK: 6 combos
      - AA: 6 combos (1 if we have AA)
      - AK: 16 combos
   
   3. **Calculate Equity** vs each combo:
      - AA vs QQ set: ~20% equity
      - AA vs KK: ~82% equity
      - AA vs AK: ~90% equity
   
   4. **Compare**: If your equity > pot odds → CALL. If equity < pot odds → FOLD.
   
   **EXAMPLE**: Hero has AA, faces 50k all-in on 10-Q-2-9
   - CO's range: QQ(3), KK(6), AA(1), AK(16) = 26 combos
   - Hero beats: KK(6), AK(16) = 22 combos (~85%)
   - Hero loses to: QQ set(3) = 3 combos (~12%)
   - Hero's equity: ~80%
   - Pot odds: ~40%
   - 80% > 40% → **CALL**!
   
   **4-BET POT RANGES** (MEMORIZE THESE):
   - Villain CALLS 4-bet: QQ+, AK (maybe JJ, AQs at low freq)
   - On FLOP, TURN, RIVER: Villain STILL has only QQ+, AK!
   - Villain CANNOT have: Qx, Tx, 9x, suited connectors, low pairs, draws
   
   **EXAMPLE**: "CO 3-bets, Hero 4-bets to 12k, CO calls"
   - PREFLOP: CO's range = QQ, KK, AA, AK
   - FLOP (10-Q-2): CO's range = STILL QQ, KK, AA, AK (only QQ makes a set!)
   - TURN (9): CO's range = STILL QQ, KK, AA, AK (no straights possible in this range!)
   - CO CANNOT have Qx, Tx, 9x, or random draws!

STRUCTURE FOR "gto_strategy":

**PREFLOP** (if preflop action mentioned)
Range analysis, opening strategy, 3-bet/defend strategy.

**FLOP** (if flop cards provided)
Range advantage, board texture, c-bet strategy or check strategy.

**TURN** (if turn card provided)
How turn changed dynamics, sizing adjustments, range narrowing.

**RIVER** (if river card provided)
Value vs bluff decision, showdown equity, final action.

**FUTURE SCENARIOS** (if hand incomplete)
Hypothetical cards and strategy adjustments.

**DECISION**: Final recommended action with sizing.

RIVER RULES (guardrails):
- If HINT ip_river_facing_check=true and spot is close, output MIXED plan.
- If HINT trips_weak_kicker=true, default to CALL vs sizable bets.
- If HINT strong_kicker=true, do NOT call kicker weak.
- If HINT hero_top_pair=false, do NOT say "top pair".
- If HINT board_paired=true and hero doesn't hold paired rank, do NOT imply trips.

HAND CLASSIFICATION (MUST BE ACCURATE):
- **SET** = Pocket pair + board card matches (AA on A-K-Q = set of aces)
- **OVERPAIR** = Pocket pair HIGHER than all board cards (AA on 10-Q-2 = overpair, NOT a set!)
- **TOP PAIR** = One card matches highest board card (AK on A-7-2 = top pair)
- **TWO PAIR** = Two cards each match different board cards
- **TRIPS** = One card matches a PAIRED BOARD (Ax on A-A-5 = trips)

**CRITICAL DISTINCTION - SET vs OVERPAIR**:
- AA on board 10-Q-2-9 = **OVERPAIR** (no Ace on board!)
- AA on board A-K-Q = **SET** (Ace IS on board)
- Check EVERY board card! If hero's pair rank is NOT on the board = OVERPAIR!
- NEVER say "set" or "top set" unless hero's pair rank appears on the board!

BOTTOM PAIR & SHOWDOWN VALUE (CRITICAL FOR RIVER DECISIONS):

**BOTTOM PAIR DEFINITION**:
- Bottom pair = Your pair matches the LOWEST card on the board
- Example: 44 on board 6-J-4-K-8 = bottom pair (4 is lowest)
- Example: 33 on board 3-8-K-A-2 = NOT bottom pair (2 is lowest, you have 2nd pair)

**BOTTOM PAIR = SHOWDOWN HAND, NOT VALUE BET**:
- Bottom pair is a CHECK-BEHIND hand on river
- You beat: Ace-high, missed draws (but they FOLD to a bet!)
- You lose to: Any pair 5+, middle pair, top pair (and they CALL a bet!)
- Result: If you bet, you get called by better, folded by worse = REVERSE VALUE BET
- **CORRECT PLAY: Check behind, win at showdown vs missed draws/ace-high**

**VALUE BET REQUIREMENT** (apply to EVERY river bet):
Must beat 3+ hands that will CALL (not fold) your bet.

Examples:
- Middle pair on 6-J-9-K-8: Beats bottom pairs (6s, 8s) that might call = MARGINAL value bet (small size only)
- Bottom pair on 6-J-4-K-8: ONLY beats ace-high/missed draws (they fold!) = NOT a value bet, CHECK

**WAY AHEAD OR WAY BEHIND** (critical concept):
If your hand is in a "way ahead or way behind" spot:
- "Way ahead": You beat hands that will FOLD to a bet (ace-high, missed draws)
- "Way behind": You lose to hands that will CALL a bet (better pairs)
- **SOLUTION: CHECK, do not bet. Win at showdown vs worse hands.**

**WHEN VILLAIN BETS TURN THEN CHECKS RIVER**:
Villain's check indicates:
- Has SOME showdown value (else would bluff)
- But not strong enough to value bet river
- Likely: Weak pair (bottom/middle), ace-high, missed draw
- **With bottom pair: CHECK behind (you beat ace-high at showdown, lose to pairs that call)**
- **With middle+ pair: Consider thin value bet (can get called by worse pairs)**

**SPECIFIC EXAMPLE** (bottom pair on river):
- Hero: 43 (bottom pair of 4s)
- Board: 6-J-4-K-8
- Villain bet turn, checked river
- Villain likely has: Weak pair, ace-high, missed draw
- Hero beats at showdown: Ace-high, missed draws
- Hero loses to if bet and called: 66, 88, JJ, KK, any Kx
- **VERDICT: CHECK (not bet) - wins vs ace-high at showdown, loses if bet and called**

General style:
- Be prescriptive, concise, solver-like
- Keep "gto_strategy" ~250-350 words (longer for multi-street analysis)
- Use pot-% sizes; avoid fabricated exact equities
- CASH only; ignore ICM/players-left
- Do NOT narrate what Hero "did." Give best play(s) now
- **CRITICAL**: Use the EXACT "Hero Cards" from the input. Do NOT use example hands or fabricate cards!

EXAMPLE OUTPUT (multi-street with river):

PREFLOP
Hero defends BB with T9s vs BTN open. Hand has good playability...

FLOP (Td 7s 2h)
You flop top pair. Check-call is standard vs c-bet...

TURN (8s)
Turn brings backdoor flush. Check-raise to 12bb applies pressure...

RIVER (2s)
River brings a spade, completing the flush. Your T9s is now a flush...

DECISION: Jam for value on river.

---

EXAMPLE OUTPUT (incomplete hand - no river):

PREFLOP
Hero defends BB...

FLOP (...) 
...

TURN (5♠)
Turn is 5♠. You lead out 1/2 pot...

FUTURE RIVER SCENARIOS (river card not provided):
- Blank rivers (3c, 4h, Kd): Continue aggression, jam for value
- Flush completing rivers: Check-fold, villain likely has it
- Pairing rivers: Jam, likely best hand

DECISION: On turn, betting 1/2 pot is optimal.
`;

/* ------------------- handler ------------------- */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      date,
      stakes,
      position,
      cards,
      board = '',
      notes = '',
      rawText = '',
      fe_hint,
      spr_hint,
    }: {
      date?: string;
      stakes?: string;
      position?: string;
      cards?: string;
      board?: string;
      notes?: string;
      rawText?: string;
      fe_hint?: string;
      spr_hint?: string;
    } = body ?? {};

    const story = rawText || notes || '';

    const ipRiverFacingCheck = detectRiverFacingCheck(story);
    const { facing: riverFacingBet, large: riverBetLarge } = detectRiverFacingBet(story);

    const heroRanks = extractHeroRanks(cards, story);
    const boardRanks = extractBoardRanks(board, story);

    const boardPaired = isBoardPaired(boardRanks);
    const heroTopPair = isHeroTopPair(heroRanks, boardRanks);
    const tripsWeak = hasTripsWeakKicker(heroRanks, boardRanks);
    const strongKickerTopPair = computeStrongKickerTopPair(heroRanks, boardRanks);

    const facts = [
      `Hero ranks: ${heroRanks.join(',') || '(unknown)'}`,
      `Board ranks: ${boardRanks.join(',') || '(unknown)'}`,
      `board_paired=${boardPaired}`,
      `hero_top_pair=${heroTopPair}`,
    ].join(' | ');

    // DETECT CURRENT STREET from board and raw text
    let currentStreet = 'Unknown';
    const numBoardCards = boardRanks.length;
    if (numBoardCards === 0) currentStreet = 'Preflop';
    else if (numBoardCards === 3) currentStreet = 'Flop';
    else if (numBoardCards === 4) currentStreet = 'Turn';
    else if (numBoardCards >= 5) currentStreet = 'River';

    // Override with explicit street mentions in raw text if action is pending
    const storyLower = story.toLowerCase();
    if (/flop[^:]*:.*hero\?|flop.*action on hero|what do i do.*flop/i.test(storyLower)) {
      currentStreet = 'Flop';
    } else if (/turn[^:]*:.*hero\?|turn.*action on hero|what do i do.*turn/i.test(storyLower)) {
      currentStreet = 'Turn';
    } else if (/river[^:]*:.*hero\?|river.*action on hero|what do i do.*river/i.test(storyLower)) {
      currentStreet = 'River';
    }

    const userBlock = [
      `MODE: CASH`,
      `Date: ${date || 'today'}`,
      `Stakes: ${stakes || '(unknown)'}`,
      `Position: ${position || '(unknown)'}`,
      `Hero Cards: ${cards || '(unknown)'}`,
      `Board: ${board || '(unknown)'}`,
      `CURRENT STREET: ${currentStreet}`,
      spr_hint ? `SPR hint: ${spr_hint}` : ``,
      fe_hint ? `FE hint: ${fe_hint}` : ``,
      `HINT: ip_river_facing_check=${ipRiverFacingCheck ? 'true' : 'false'}`,
      `HINT: river_facing_bet=${riverFacingBet ? 'true' : 'false'}`,
      riverFacingBet ? `HINT: river_bet_large=${riverBetLarge ? 'true' : 'false'}` : ``,
      `HINT: board_paired=${boardPaired ? 'true' : 'false'}`,
      `HINT: hero_top_pair=${heroTopPair ? 'true' : 'false'}`,
      `HINT: trips_weak_kicker=${tripsWeak ? 'true' : 'false'}`,
      `HINT: strong_kicker=${strongKickerTopPair ? 'true' : 'false'}`,
      ``,
      `FACTS: ${facts}`,
      ``,
      `RAW HAND TEXT:`,
      story.trim() || '(none provided)',
      ``,
      `FOCUS: Decide the ${currentStreet} action in a solver-like way. Respect the CURRENT STREET and HINTS above.`,
    ].filter(Boolean).join('\n');

    const { isMTT, hits } = looksLikeTournament(userBlock);
    if (isMTT) {
      return NextResponse.json({
        gto_strategy: `Cash-only mode: your text looks like a TOURNAMENT hand (${hits.join(', ')}). Please re-enter as a cash hand (omit ICM/players-left).`,
        exploit_deviation: '',
        learning_tag: ['cash-only', 'mtt-blocked'],
      });
    }

    // OpenAI call
    const resp = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: userBlock },
      ],
    });

    const raw = resp?.choices?.[0]?.message?.content?.trim() || '{}';
    let parsed: any = {};
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { gto_strategy: raw, exploit_deviation: '', learning_tag: [] };
    }

    const out = {
      gto_strategy: asText(parsed?.gto_strategy || ''),
      exploit_deviation: asText(parsed?.exploit_deviation || ''),
      learning_tag: Array.isArray(parsed?.learning_tag)
        ? parsed.learning_tag.filter((t: unknown) => typeof t === 'string' && t.trim())
        : [],
    };

    return NextResponse.json(out);
  } catch (e: any) {
    console.error('analyze-hand error:', e?.message || e);
    return NextResponse.json({ error: 'Failed to analyze hand' }, { status: 500 });
  }
}
