export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { openai } from '@/lib/openai';

/**
 * Locked-down batch coach endpoint.
 * - Requires X-APP-TOKEN to match process.env.COACH_API_TOKEN
 * - Accepts { raw_text, date?, stakes?, position?, cards?, board?, spr_hint?, fe_hint? }
 * - Returns { gto_strategy, exploit_deviation, learning_tag }
 *
 * IMPORTANT:
 * For batch enrichment we DO NOT block tournaments.
 * We always treat the spot as a cash-game style analysis.
 */

/* ---------------- tiny helpers reused from your analyzer ---------------- */
function asText(v: any): string {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(asText).join('\n');
  if (typeof v === 'object') {
    return Object.entries(v)
      .map(([k, val]) => `${k}: ${asText(val)}`)
      .join('\n');
  }
  return String(v);
}

function detectRiverFacingCheck(text: string): boolean {
  const s = (text || '').toLowerCase();
  const riverLine =
    (s.match(/(?:^|\n)\s*river[^:\n]*[: ]?\s*([^\n]*)/i)?.[1] || '').toLowerCase();
  const hasCheck = /\b(checks?|x)\b/.test(riverLine);
  const heroChecks = /\b(hero|i)\s*(checks?|x)\b/.test(riverLine);
  return hasCheck && !heroChecks;
}

function detectRiverFacingBet(text: string): { facing: boolean; large: boolean } {
  const s = (text || '').toLowerCase();
  const riverLine =
    (s.match(/(?:^|\n)\s*river[^:\n]*[: ]?\s*([^\n]*)/i)?.[1] || '').toLowerCase();
  const heroActsFirst =
    /\b(hero|i)\b/.test(riverLine) && /\b(bets?|jam|shove|raise)/.test(riverLine);
  const facing =
    /\b(bets?|bet\b|jam|shove|all[- ]?in|pot)\b/.test(riverLine) &&
    !heroActsFirst &&
    !/\b(checks?|x)\b/.test(riverLine);
  const large =
    facing &&
    /\b(3\/4|0\.75|75%|two[- ]?thirds|2\/3|0\.66|66%|pot|all[- ]?in|jam|shove)\b/.test(
      riverLine,
    );
  return { facing, large };
}

/* ---- very light card/board rank extraction (same shape your analyzer uses) ---- */
type Rank = 'A' | 'K' | 'Q' | 'J' | 'T' | '9' | '8' | '7' | '6' | '5' | '4' | '3' | '2';
const RANKS: Rank[] = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const RANK_VAL: Record<Rank, number> = {
  A: 14,
  K: 13,
  Q: 12,
  J: 11,
  T: 10,
  9: 9,
  8: 8,
  7: 7,
  6: 6,
  5: 5,
  4: 4,
  3: 3,
  2: 2,
};

function pickRanksFromCards(str: string): Rank[] {
  const s = (str || '').toUpperCase();
  const out: Rank[] = [];
  for (const ch of s) if ((RANKS as string[]).includes(ch)) out.push(ch as Rank);
  return out;
}

function extractHeroRanks(cardsField?: string, rawText?: string): Rank[] {
  const c = pickRanksFromCards(cardsField || '');
  if (c.length >= 2) return c.slice(0, 2) as Rank[];
  // try to guess from text like "Ah Kh"
  const m = (rawText || '').match(
    /\b([AKQJT2-9])[^\S\r\n]*[shdc♠♥♦♣]?\b.*?\b([AKQJT2-9])[^\S\r\n]*[shdc♠♥♦♣]?\b/i,
  );
  if (m) return pickRanksFromCards(`${m[1]}${m[2]}`).slice(0, 2) as Rank[];
  return [];
}

// uses one-arg helper closing over `ranks`
function extractBoardRanks(boardField?: string, rawText?: string): Rank[] {
  const ranks: Rank[] = [];

  const add = (src: string) => {
    const r = pickRanksFromCards(src);
    for (const x of r) {
      if (ranks.length < 5) ranks.push(x);
    }
  };

  add(boardField || '');

  const s = (rawText || '').toUpperCase();
  const flop = s.match(/\bFLOP[^:\n]*[: ]?([^\n]*)/i)?.[1] || '';
  const turn = s.match(/\bTURN[^:\n]*[: ]?([^\n]*)/i)?.[1] || '';
  const river = s.match(/\bRIVER[^:\n]*[: ]?([^\n]*)/i)?.[1] || '';

  add(flop);
  add(turn);
  add(river);

  return ranks;
}

function isBoardPaired(board: Rank[]): boolean {
  const counts: Record<string, number> = {};
  for (const r of board) counts[r] = (counts[r] || 0) + 1;
  return Object.values(counts).some((n) => n >= 2);
}
function isHeroTopPair(hero: Rank[], board: Rank[]): boolean {
  if (hero.length < 2 || board.length < 3) return false;
  const topBoard = board.reduce<Rank>(
    (best, r) => (RANK_VAL[r] > RANK_VAL[best] ? r : best),
    '2',
  );
  return hero.includes(topBoard);
}
function hasTripsWeakKicker(hero: Rank[], board: Rank[]): boolean {
  if (hero.length < 2 || board.length < 3) return false;
  const counts: Record<string, number> = {};
  for (const r of [...hero, ...board]) counts[r] = (counts[r] || 0) + 1;
  const low = hero.find((r) => RANK_VAL[r] <= 9);
  return Object.values(counts).some((n) => n >= 3) && !!low;
}
function computeStrongKickerTopPair(hero: Rank[], board: Rank[]): boolean {
  if (hero.length < 2 || board.length < 3) return false;
  const topBoard = board.reduce<Rank>(
    (best, r) => (RANK_VAL[r] > RANK_VAL[best] ? r : best),
    '2',
  );
  const other = hero.find((r) => r !== topBoard);
  return hero.includes(topBoard) && !!other && RANK_VAL[other] >= 11; // J+
}

/* ------------------------ SYSTEM prompt (cash-game coach) ------------------------ */
const SYSTEM = `You are a CASH-GAME poker coach.

Return ONLY JSON with EXACT keys:
{
  "gto_strategy": "string",
  "exploit_deviation": "string",
  "learning_tag": ["string","string?"]
}

CRITICAL REQUIREMENTS:

0. **GTO-FIRST STRUCTURE** (NON-NEGOTIABLE - FOLLOW THIS EXACTLY):

**!! YOU WILL BE MARKED WRONG IF YOU JUSTIFY HERO'S MISTAKES !!**

═══════════════════════════════════════════════════════════
**MANDATORY TEMPLATE FOR EVERY STREET:**

1. First sentence: "GTO strategy: [action] because [reason]"
2. Second sentence: "You [what hero actually did]"
3. If different: Note in exploit_deviation

DO NOT SKIP STEP 1! DO NOT START WITH "You should..."!
═══════════════════════════════════════════════════════════

**WRONG** (Biased - justifies hero's action):
❌ "You check-raised the river. This can work to trap weak Kings and extract maximum value from your strong two pair."

❌ "On the river, you should consider raising. Your hand is strong and a raise extracts value."

❌ "Given the opponent's bet, a raise is appropriate to maximize value from worse hands."

**RIGHT** (GTO-first - objective):
✅ "GTO strategy: Bet 65% pot ($5.10) for value with two pair. You beat most Kx hands and can get called by worse. You check-raised to $9.63 instead."

✅ "GTO strategy: Fold K4o to UTG raise from BTN. You correctly folded."

✅ "GTO strategy: 3-bet to $2.10 with AK vs UTG raise. You flatted instead - see deviations."

═══════════════════════════════════════════════════════════
**EXAMPLES BY STREET:**

**PREFLOP:**
✅ "GTO strategy: Fold this weak hand to an early position raise. You folded correctly."
❌ "You folded, which is appropriate given the strength of the raise."

**FLOP:**
✅ "GTO strategy: C-bet 50% pot with top pair. You bet $5 (60% pot), slightly larger but acceptable."
❌ "You bet $5, which applies pressure and builds the pot with your strong hand."

**TURN:**  
✅ "GTO strategy: Check-call with middle pair. You bet instead - see deviations."
❌ "You bet to deny equity, which can work against draws."

**RIVER:**
✅ "GTO strategy: Bet 75% pot for value. You check-raised instead."
❌ "You check-raised, which extracts value from weak Kings."

═══════════════════════════════════════════════════════════
**CRITICAL RULES:**

1. ALWAYS start analysis with "GTO strategy: [action]"
2. State what hero ACTUALLY DID as a separate fact
3. DO NOT justify mistakes - note them objectively
4. Use exploit_deviation to explain WHEN deviation might work

**IF HERO PLAYED CORRECTLY:**
✅ "GTO strategy: Fold. You folded correctly."

**IF HERO DEVIATED:**
✅ "GTO strategy: Bet. You checked instead."
❌ "You checked, which controls pot size..." (NO! State GTO first!)

═══════════════════════════════════════════════════════════

**SELF-CHECK BEFORE RESPONDING:**
□ Did I start with "GTO strategy: [action]"?
□ Did I state what hero actually did?
□ If hero deviated, did I note it objectively (not justify it)?

IF NO TO ANY: REWRITE!

1. **BETTING TERMINOLOGY** (MUST GET THIS RIGHT):
   
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


**4-BET POT RANGES** (MEMORIZE THESE):
   - Villain CALLS 4-bet: QQ+, AK (maybe JJ, AQs at low freq)
   - On FLOP, TURN, RIVER: Villain STILL has only QQ+, AK!
   - Villain CANNOT have: Qx, Tx, 9x, suited connectors, low pairs, draws
   
   **EXAMPLE**: "CO 3-bets, Hero 4-bets to 12k, CO calls"
   - PREFLOP: CO's range = QQ, KK, AA, AK
   - FLOP (10-Q-2): CO's range = STILL QQ, KK, AA, AK (only QQ makes a set!)
   - TURN (9): CO's range = STILL QQ, KK, AA, AK (no straights possible in this range!)
   - CO CANNOT have Qx, Tx, 9x, or random draws!


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


**KICKER RULES** (CRITICAL - MEMORIZE FOR EVERY HAND TYPE):

═══════════════════════════════════════════════════════════
**1. ONE PAIR** (Most Common):

RULE: Kicker = highest unused card

✅ AK on A-7-2 = Pair of Aces, K kicker (5-card: A♠A♥K♣7♦2♠)
✅ KQ on K-7-2 = Pair of Kings, Q kicker
✅ KT on K-7-2 = Pair of Kings, T kicker (BEATS K9 - better kicker!)

KICKER WARS: AK beats AQ, KJ beats KT (same pair, better kicker)

═══════════════════════════════════════════════════════════
**2. TWO PAIR** (Complex - PAY ATTENTION):

**SCENARIO A: Both hole cards make pairs**
Example: KT on K-T-5 board
- Kings AND Tens both from your hand
- Both hole cards used for pairs
- ❌ WRONG: "Two pair, K kicker"
- ✅ RIGHT: "Two pair Kings and Tens, 5 kicker" (kicker from board!)
- 5-card hand: K♠K♥T♦T♠5♣

**SCENARIO B: One hole card + board makes two pair**
Example: A7 on K-K-Q-7-2 board
- Pair of Kings from board, pair of 7s using your 7
- Your other hole card (A) is the kicker!
- ✅ RIGHT: "Two pair Kings and Sevens, Ace kicker"
- 5-card hand: K♠K♥7♦7♠A♣
- BEATS K7 with Q kicker!

**CRITICAL RULE: If both hole cards are IN the pairs, kicker is from board!**

═══════════════════════════════════════════════════════════
**3. TRIPS/SET** (Kicker Crucial):

**SET** (pocket pair + board):
Example: 99 on 9-7-2-A-K
- Three 9s
- Kickers: A and K from board
- 5-card hand: 9♠9♥9♦A♣K♠

**TRIPS** (one hole card + paired board):
Example: A9 on 9-9-7-K-2
- Three 9s
- YOUR OTHER HOLE CARD (A) IS THE KICKER!
- 5-card hand: 9♠9♥9♦A♣K♠  
- BEATS K9 (has K kicker from hand, you have A!)

═══════════════════════════════════════════════════════════
**4. STRAIGHTS, FULL HOUSE** = NO KICKERS

═══════════════════════════════════════════════════════════
**5. FLUSH**: All 5 cards matter

Best 5 flush cards win (2nd, 3rd card act like "kickers")

═══════════════════════════════════════════════════════════
**6. HIGH CARD**: All 5 cards matter in order

AK on Q-8-7-2-3 = A-high with K, Q, 8, 7 (beats AJ)

═══════════════════════════════════════════════════════════
**CRITICAL ERRORS TO AVOID:**

❌ "Two pair with K kicker" when KT on K-T-5 (K is IN the pair!)
❌ "Set with A kicker" when holding 99 on 9-A-K (A is from board, not "your" kicker)
❌ "Two pair, strong kicker" without specifying which card

✅ ALWAYS identify: Which cards from hand + board form 5-card combination?
✅ For two pair using both hole cards: Kicker is 5th board card!
✅ For trips with one hole card: Other hole card is THE kicker!


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


1. **LOGICAL CONSISTENCY** (PREVENTS ALL CONTRADICTIONS):

NEVER contradict yourself about hand strength!

HAND STRENGTH HIERARCHY:
1. Straight Flush
2. Four of a Kind  
3. Full House
4. Flush
5. Straight
6. Three of a Kind (Set/Trips)
7. Two Pair ← Contains top pair + another pair
8. One Pair (Top Pair, Middle Pair, Bottom Pair)
9. High Card

If you have a stronger hand, you BY DEFINITION have all weaker components.

EXAMPLES OF CONTRADICTIONS TO AVOID:
❌ "You have two pair, Aces and 8s, but don't have top pair"
   → Two pair with Aces INCLUDES top pair!
   
❌ "You have a flush but no made hand"  
   → A flush IS a made hand!

✅ CORRECT PHRASING:
- "You have top two pair (Aces and 8s)"
- "You have a flush, which is a strong made hand"

BEFORE YOU WRITE: Check for contradictions! If you said "you have X", 
don't later say "you don't have Y" if X includes Y.

2. **STREET-BY-STREET ANALYSIS** (NON-NEGOTIABLE):

You MUST analyze EVERY street where action occurred, in chronological order.

**REQUIRED FORMAT for multi-street hands:**

**PREFLOP**
[Analysis of preflop decision]

**FLOP** [cards]
[Analysis of flop decision]

**TURN** [card]
[Analysis of turn decision]

**RIVER** [card]
[Analysis of river decision]

**DECISION**: [Final recommendation]

DO NOT skip streets! Each street must be analyzed sequentially.

**STRICT RULE - ANALYZE ONLY WHAT HAPPENED**:

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

3. **NARRATIVE CONTINUITY** (CRITICAL - BUILD ON PREVIOUS STREETS):

Each street MUST reference what happened on ALL previous streets.
Think of the hand as a STORY, not isolated decisions.

**PREFLOP**
"You defended BB with A8o against BTN open raise."

**FLOP** [7d Qs Ad]
"After calling preflop with A8o, you flopped top pair weak kicker. 
Given you showed weakness preflop, check-calling is standard..."

**TURN** [8d]
"After check-calling flop with top pair, the turn 8d improves you to two pair.
Since you've shown a calling range, check-calling again is correct..."

**RIVER** [9s]
"After calling both flop and turn, the river 9s arrives. Your line 
(passive calls throughout) means a check-back is reasonable..."

CRITICAL: ALWAYS mention previous actions before analyzing current street!

4. **POSITION - PREFLOP VS POSTFLOP** (CRITICAL - DIFFERENT ON EACH!):

**POSITION IS DIFFERENT PREFLOP VS POSTFLOP!**

═══════════════════════════════════════════════════════════
**PREFLOP ACTION ORDER:**

First to act → Last to act:
SB → BB → UTG → UTG+1 → HJ → CO → BTN

**PREFLOP SPECIAL CASE:**
- BB acts LAST preflop (closes the action)
- After facing a raise: BB can 3-bet or call with closing position advantage
- Don't say "BB is in position preflop" (confusing), just note BB closes action

═══════════════════════════════════════════════════════════
**POSTFLOP ACTION ORDER (flop, turn, river):**

First to act → Last to act:
SB → BB → UTG → UTG+1 → HJ → CO → BTN

**POSTFLOP (THIS NEVER CHANGES):**
- SB/BB act FIRST = Out of Position (OOP)
- BTN acts LAST = In Position (IP)
- Other positions = compare to villain's position

═══════════════════════════════════════════════════════════
**POSITION LOOKUP TABLE (POSTFLOP):**

You're IP if you act AFTER villain:

BTN vs: SB, BB, UTG, UTG+1, HJ, CO → BTN is IP ✅
CO vs:  SB, BB, UTG, UTG+1, HJ → CO is IP ✅
HJ vs:  SB, BB, UTG, UTG+1 → HJ is IP ✅
UTG+1 vs: SB, BB, UTG → UTG+1 is IP ✅
UTG vs: SB, BB → UTG is IP ✅
BB vs:  SB → BB is IP ✅
SB vs:  Anyone → SB is OOP ❌

═══════════════════════════════════════════════════════════
**EXAMPLES (MEMORIZE TO PREVENT ERRORS):**

**SCENARIO 1: UTG raises, BTN calls**
PREFLOP: BTN closed the action (acted last)
POSTFLOP: UTG acts FIRST (OOP), BTN acts LAST (IP) ← BTN has position!

**SCENARIO 2: CO raises, BB calls**
PREFLOP: BB closed the action (acted last)
POSTFLOP: BB acts FIRST (OOP), CO acts LATER (IP) ← CO has position!

**SCENARIO 3: BB raises, BTN calls**
PREFLOP: BTN closed the action
POSTFLOP: BB acts FIRST (OOP), BTN acts LAST (IP) ← BTN has position!

═══════════════════════════════════════════════════════════
**CRITICAL RULES:**

❌ WRONG: "BTN faces UTG raise, you are out of position for the hand"
✅ RIGHT: "BTN faces UTG raise, you have position postflop"

❌ WRONG: "BB faces raise, you're out of position"
✅ RIGHT: "BB faces raise, you close the action preflop but will be OOP postflop"

❌ WRONG: "Villain in CO, you're on BTN, you're both in late position"
✅ RIGHT: "Villain in CO, you're on BTN with position advantage (act after CO)"

**ALWAYS CHECK: Who acts first postflop? That player is OOP!**

═══════════════════════════════════════════════════════════
**HOW TO DESCRIBE ACTIONS:**

When you act FIRST (out of position):
✅ "You check. Villain bets $5."
✅ "You bet $7. Villain raises to $20."

When you act LAST (in position):
✅ "Villain checks. You bet $5."
✅ "Villain bets $7. You call."

5. **RANGE NARROWING** (descriptive vs specific):

**WIDE RANGES** (opens, calls):
Use descriptive categories.
Example: "BTN opening range includes pairs, Broadway cards, suited connectors"

**NARROW RANGES** (3-bet, 4-bet, 5-bet):
Use specific combos because ranges ARE that tight.

3-BET RANGE:
"Typical 3-bet range: JJ+, AK, AQ, sometimes TT or AJs for balance"

4-BET RANGE:
"After 4-betting, villain's range is very narrow: QQ+, AK, occasionally JJ"

5-BET RANGE:
"5-bet range is extremely narrow: KK+, sometimes AK"

RANGE EVOLUTION EXAMPLE:

**PREFLOP**: "Villain opens BTN with wide range - pairs, Broadway, suited connectors."

**FLOP** [7d Qs Ad]: "After c-betting, likely has top pair or better (Ax, KK), 
strong Queens (AQ), maybe flush draws. Folded small pairs."

**TURN** [8d]: "After barreling turn, range narrows: Strong Aces (AQ, AK), 
committed overpairs (KK, QQ), completed flushes."

**RIVER** [9s]: "Checks river. Eliminates nuts (AQ would bet). 
Likely: Weak Aces, scared overpairs (KK), busted draws."

6. **EQUITY AND POT ODDS** (NO VAGUE MATH):

When recommending CALL or FOLD, MUST discuss:
1. Pot odds
2. Equity needed
3. Whether you have it

EXAMPLE - GOOD:
"You're getting 3:1 pot odds (\$5 to win \$15), needing 25% equity.
Against villain's range of QQ+/AK, you have ~35% equity.
Since 35% > 25%, this is a profitable call."

EXAMPLE - BAD:
"You might have some equity, so calling could be okay."

BET SIZES MUST BE SPECIFIC:
✅ "Bet 50% pot (\$5 into \$10)"  
❌ "Make a small bet"

7. **BLOCKER AWARENESS** (when relevant):

Mention blockers if they significantly affect analysis:

EXAMPLE:
"Your Ace blocks some of villain's value: AA (1 combo left),
AQ (3 instead of 16). This makes villain more weighted toward QQ, 88."

Only mention if SIGNIFICANT (block premium hands/draws).

8. **BOARD TEXTURE EVOLUTION**:

Describe how board changes each street:

**FLOP** [7d Qs Ad]
"Dry board (no flush/straight draws). Top pair dominates."

**TURN** [8d]
"Turn brings flush draw (diamonds). Board is now wetter."

**RIVER** [9s]
"River misses flush but completes J9 straight.
No flush, but straight possible."

9. **SELF-VERIFICATION** (check before responding):

□ Did I analyze ALL streets in order?
□ Did I contradict myself about hand strength?
□ Did I reference previous streets in each analysis?
□ Did I provide specific bet sizes?
□ Did I discuss pot odds/equity for calls/folds?
□ Did I correctly identify who acts first/last?
□ Is my action clearly stated?

If NO to any question, FIX IT before responding.

General style:
- Be prescriptive, concise, solver-like.
- Keep "gto_strategy" ~350–500 words for multi-street hands (less for preflop folds).
- Use pot-% sizes; avoid fabricated exact equities.

RIVER SECTION GUIDELINES (within your multi-street analysis):
- When analyzing the RIVER section (after preflop, flop, turn sections):
  - If HINT ip_river_facing_check=true and the spot is close, output low-size bet (25–50%) frequency + check frequency, and WHEN to prefer each.
  - If HINT river_facing_bet=true, consider call/fold/raise trees; if HINT river_bet_large=true weight folds/raises more often when range is capped.
  - Respect FACTS booleans like board_paired, hero_top_pair, trips_weak_kicker, strong_kicker.

CRITICAL REMINDER: This does NOT mean skip preflop/flop/turn! Analyze ALL streets, then apply these river-specific guidelines to your river section.

JSON ONLY. No prose outside the JSON.`


/* --------------------------------- HANDLER --------------------------------- */
export async function POST(req: Request) {
  try {
    // Shared-secret auth
    const token = req.headers.get('x-app-token');
    if (!process.env.COACH_API_TOKEN || token !== process.env.COACH_API_TOKEN) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Accept either { raw_text } or richer fields
    const body = await req.json().catch(() => ({} as any));
    const story: string = asText(body?.raw_text || body?.text || '');

    if (!story.trim()) {
      return NextResponse.json({ error: 'raw_text required' }, { status: 400 });
    }

    // Check for pre-parsed data from coach_worker (more accurate than extracting from text)
    const preParsed = body?.parsed || {};

    const date = asText(body?.date || '');
    // Use preParsed values if available, otherwise fall back to body fields, then empty
    const stakes = asText(preParsed?.stakes || body?.stakes || '');
    const position = asText(preParsed?.position || body?.position || '');
    const cards = asText(preParsed?.cards || body?.cards || '');
    const board = asText(preParsed?.board || body?.board || '');
    const spr_hint = asText(body?.spr_hint || '');
    const fe_hint = asText(body?.fe_hint || '');

    // Extract pot type info from preParsed data (for accurate 3bet/4bet detection)
    const potType = preParsed?.pot_type || '';
    const preflopRaises = preParsed?.preflop_raises || 0;

    // Hints
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
      `trips_weak_kicker=${tripsWeak}`,
      `strong_kicker=${strongKickerTopPair}`,
    ].join(' | ');

    const userBlock = [
      `MODE: CASH`,
      `Date: ${date || 'today'}`,
      `Stakes: ${stakes || '(unknown)'}`,
      `Position: ${position || '(unknown)'}`,
      `Hero Cards: ${cards || '(unknown)'}`,
      `Board: ${board || '(unknown)'}`,
      spr_hint ? `SPR hint: ${spr_hint}` : ``,
      fe_hint ? `FE hint: ${fe_hint}` : ``,
      // Pot type hints for accurate range analysis
      potType ? `HINT: pot_type=${potType}` : ``,
      preflopRaises ? `HINT: preflop_raises=${preflopRaises}` : ``,
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
      `FOCUS: Analyze ALL streets sequentially (preflop, flop, turn, river) in a solver-like way. Treat this as a cash-game spot and ignore ICM.`,
    ]
      .filter(Boolean)
      .join('\n');

    // 🔴 IMPORTANT: NO MTT BLOCK HERE.
    // Even if the hand looks like a tournament, we still analyze it as a cash-game spot.

    const resp = await openai.chat.completions.create({
      model: 'gpt-4o',
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
        ? parsed.learning_tag.filter(
          (t: unknown) => typeof t === 'string' && t.trim(),
        )
        : [],
    };

    return NextResponse.json(out);
  } catch (e: any) {
    console.error('coach/analyze-hand error:', e?.message || e);
    return NextResponse.json({ error: 'analyze failed' }, { status: 500 });
  }
}
