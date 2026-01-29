/**
 * Multi-Agent Poker Coach - Type Definitions
 * 
 * This file defines all TypeScript interfaces for agent contracts.
 * Each agent receives specific input and returns specific output.
 */

// ═══════════════════════════════════════════════════════════════
// COMMON TYPES
// ═══════════════════════════════════════════════════════════════

export type Street = 'preflop' | 'flop' | 'turn' | 'river';
export type ActionType = 'fold' | 'check' | 'call' | 'bet' | 'raise' | 'all-in';
export type Severity = 'minor' | 'moderate' | 'critical';
export type Leader = 'hero' | 'villain' | 'even';

export interface Position {
    hero: string;      // "UTG", "BTN", "BB", etc.
    villain: string;
}

export interface Action {
    street: Street;
    player: 'hero' | 'villain';
    action: ActionType;
    amount?: number;
}

export interface Stacks {
    hero: number;
    villain: number;
}

export interface PotSizes {
    preflop?: number;
    flop?: number;
    turn?: number;
    river?: number;
}

// ═══════════════════════════════════════════════════════════════
// HAND INPUT (Raw input to pipeline)
// ═══════════════════════════════════════════════════════════════

export interface HandInput {
    handId: string;
    cards: string;              // "K♥T♥" or "KhTh"
    board: string;              // "K♠9♦5♣ A♠ 2♣"
    positions: Position;
    actions: Action[];
    stacks: Stacks;
    potSizes: PotSizes;
    heroActions: HeroActions;   // What hero actually did
    lastBet?: number;           // Last bet to call (for pot odds)
    tableSize?: number;         // Number of players (e.g. 6, 9)
    villainContext?: {          // Context about how villain was determined
        type: 'opening' | 'sb_vs_bb' | 'facing_action' | 'vs_3bet' | 'vs_4bet';
        villain?: string;           // ADD: Villain position
        villainName?: string;
    };
}

export interface HeroActionDetail {
    action: ActionType;
    amount?: number;
}

/**
 * Track hero's FULL action sequence per street
 * Supports two actions per street (e.g., check → call)
 */
export interface HeroStreetActions {
    first?: HeroActionDetail;   // Hero's first action (check, bet, raise)
    second?: HeroActionDetail;  // Hero's response if villain acts (call, fold, raise)
}

export interface HeroActions {
    preflop?: HeroStreetActions;
    flop?: HeroStreetActions;
    turn?: HeroStreetActions;
    river?: HeroStreetActions;
}

// ═══════════════════════════════════════════════════════════════
// AGENT 0: Board Analyzer
// ═══════════════════════════════════════════════════════════════

export interface Agent0Input {
    board: string;
}

export interface BoardAnalysis {
    flop?: {                          // OPTIONAL: Only exists if Hero saw postflop
        cards: string;                // "K♠9♦5♣"
        texture: string;              // "K-high, rainbow, uncoordinated"
        draws_possible: string[];     // ["gutshot QJ", "backdoor flush"]
        scary_for: string;            // "weak pairs, overcards"
    };
    turn?: {
        card: string;                 // "A♠"
        impact: string;               // "Overcard, completes some flush draws"
        range_shift: string;          // "Favors villain's wider range"
        // NEW: GTO-aligned enhancements
        completes_draws?: string[];   // ["flush", "straight 56"] - draws completed
        is_scare_card?: boolean;      // True if this shifts advantage significantly
        barrel_recommendation?: string; // "continue betting" or "check back"
    };
    river?: {
        card: string;                 // "2♣"
        impact: string;               // "Blank, no new draws complete"
        // NEW: GTO-aligned enhancements
        completes_draws?: string[];   // ["flush"] - draws completed on river
        is_scare_card?: boolean;
        is_blank?: boolean;           // True if no draws complete, no overcards
    };
    summary: {
        is_paired: boolean;
        flush_possible: boolean;
        straight_possible: boolean;
        high_cards: string[];         // ["A", "K"]
    };
    // NEW: GTO-aligned strategic context
    cbet_recommendation?: {
        ip_frequency: number;         // 0.65 = 65% c-bet IP
        oop_frequency: number;        // 0.30 = 30% c-bet OOP
        reasoning: string;            // "Dry A-high board favors raiser"
    };
    sizing_recommendation?: {
        flop: string;                 // "small (33%)" or "large (66%)"
        turn?: string;                // "medium (50%)"
        reasoning: string;            // "Dry board - small sizing to deny equity"
    };
    // NEW: Range advantage context
    texture_advantage?: {
        favors: 'raiser' | 'caller' | 'neutral';
        confidence: 'high' | 'medium' | 'low';
        reasoning: string;            // "High card board favors opening range"
    };
}

// ═══════════════════════════════════════════════════════════════
// AGENT 1: Range Builder
// ═══════════════════════════════════════════════════════════════

export interface Agent1Input {
    boardAnalysis: BoardAnalysis;
    positions: Position;
    actions: Action[];
    tableSize?: number;
    stacks: Stacks;      // NEW: For Phase 8 (Stack Depth)
    streetsPlayed?: {    // NEW: Track which streets Hero actually played
        preflop: boolean;
        flop: boolean;
        turn: boolean;
        river: boolean;
    };
}

export interface RangeInfo {
    description: string;            // "22+, ATs+, KQs, AJo+"
    combos: number;                 // 156
    spectrum: string;               // "Top 12% of hands"
    allCombos?: string[];           // NEW: Exact list of combos ["AhKs", "7h7d", ...] -- Phase 5
    stats?: {                       // NEW: Detailed stats for Agent 3 -- Phase 6
        distribution: Record<string, number>; // e.g. { "monster": 12, "air": 30 }
        totalCombos: number;
        topHands: string[];
    };
}

export interface StreetRange {
    hero_range: string | RangeInfo;
    villain_range: string | RangeInfo;
    range_notes?: string;           // "Villain range polarized after turn raise"
}

export interface RangeData {
    preflop: {
        hero_range: RangeInfo;
        villain_range: RangeInfo;
    };
    flop?: StreetRange;
    turn?: StreetRange;
    river?: StreetRange;
}

// ═══════════════════════════════════════════════════════════════
// Phase 12: Unified Hero Classification
// ═══════════════════════════════════════════════════════════════

export interface HeroClassification {
    bucket2D: string;           // "(3,2)" from HandClassifier
    tier: string;               // "MONSTER", "STRONG", "MARGINAL", "DRAW_STRONG", "DRAW_WEAK", "AIR"
    percentile: string;         // "Top 30%"
    description: string;        // "Top pair strong kicker + Flush draw"
    interpretation: string;     // "Strong spot - can apply pressure"
}

export interface Agent1Output {
    ranges: RangeData;
    heroClassification: HeroClassification;
}

// ═══════════════════════════════════════════════════════════════
// AGENT 2: Equity Calculator
// ═══════════════════════════════════════════════════════════════

export interface Agent2Input {
    heroHand: string;
    villainRange: string | RangeInfo;           // From Agent 1 (text or structured)
    board: string;
    potSize: number;
    betSize: number;
    preflopSpot?: string;                       // NEW: V2 spot key for action frequencies (e.g., 'BB_vs_BTN')
}

export interface EquityData {
    equity_vs_range: number;        // 0.432 (43.2%)
    pot_odds: {
        pot_size: number;             // 15.50
        to_call: number;              // 5.00
        odds_ratio: string;           // "3.1:1"
        equity_needed: number;        // 0.244 (24.4%)
    };
    decision: string;               // "CALL - equity exceeds pot odds"
    equity_vs_value?: number;       // NEW: Phase 10 (Split Equity)
    equity_vs_bluffs?: number;      // NEW: Phase 10 (Split Equity)
    villain_action_frequencies?: {  // NEW: V2 GTO action frequencies for this spot
        fold_pct: number;
        call_pct: number;
        raise_pct: number;
        spot?: string;
    };
    breakdown?: {
        beats: string[];              // ["Kx weak kicker", "missed draws"]
        loses_to: string[];           // ["AK", "two pair+", "sets"]
    };
}

// ═══════════════════════════════════════════════════════════════
// AGENT 3: Advantage Analyzer
// ═══════════════════════════════════════════════════════════════

export interface Agent3Input {
    boardAnalysis: BoardAnalysis;
    ranges: RangeData;
    heroHand: string;
}

export interface StreetAdvantage {
    range_advantage: {
        leader: Leader;
        percentage: string;           // "Hero 65%"
        reason: string;               // "Tight range hits K-high better"
    };
    nut_advantage: {
        leader: Leader;
        hero_strongest: string;       // "Sets (KK)"
        villain_strongest: string;    // "Two pair max (capped)"
        reason: string;               // "Hero has AA, KK; villain doesn't"
    };
}

export interface AdvantageData {
    flop: StreetAdvantage;
    turn?: StreetAdvantage & { shift?: string };   // "Range advantage flipped to villain"
    river?: StreetAdvantage & { shift?: string };
    blocker_effects?: BlockerEffects;              // Added for blocker analysis
    // NEW: Hero's specific hand vs villain range (with card removal)
    hero_spot_analysis?: {
        hand_strength: string;          // "Top Pair Good Kicker", "Second Pair", etc.
        vs_villain_range: string;       // "Ahead of 62% of villain's range"
        board_impact?: string;          // "A♠ hurt your hand (Ace helped villain's Ax)"
        shift_impact?: string;          // "You went from AHEAD to BEHIND"
    };
}

// Blocker Effects - tracks which strong hands hero blocks
export interface BlockerEffects {
    hero_blocks: string[];          // ["A♠ blocks nut flush", "K blocks KK, AK combos"]
    strategic_impact: string;       // "Hero can bluff more (blocks villain's nuts)"
}

// ═══════════════════════════════════════════════════════════════
// AGENT 4: SPR Calculator (Pure JS - No LLM)
// ═══════════════════════════════════════════════════════════════

export interface Agent4Input {
    potSizes: PotSizes;
    stacks: Stacks;
}

// Phase 13: Enhanced SPR Types
export type SPRZone = 'POT_COMMITTED' | 'COMMITTED' | 'MEDIUM' | 'DEEP' | 'VERY_DEEP';

export interface CommitmentThresholds {
    min_hand_strength: string;      // "Top pair+" or "Sets+"
    can_fold_tptk: boolean;         // true if SPR > 8
    can_fold_overpair: boolean;     // true if SPR > 13
    shove_zone: boolean;            // true if SPR < 3
}

export interface PotOddsData {
    current: number;                // 0.33 (need 33% equity to call)
    after_call?: number;            // 0.28 (pot odds if we call)
    implied_multiplier?: number;    // 1.5 (need 1.5x pot on later streets)
}

export interface StackCommitmentData {
    percent_invested: number;       // 0.35 (35% of stack in pot)
    remaining_bb: number;           // 75 BB remaining
    pot_bb: number;                 // 25 BB in pot
}

export interface OptimalSizing {
    value_bet: string;              // "50-66% pot"
    bluff_bet: string;              // "33-50% pot"
    all_in_threshold: number;       // 3.0 (SPR threshold to shove)
}

export interface FutureSPR {
    after_half_pot_bet?: number;    // SPR after 0.5x pot bet
    after_pot_bet?: number;         // SPR after 1x pot bet
    streets_remaining: number;      // 2 (turn + river)
}

export interface SPRData {
    // Core metrics (existing)
    effective_stack: number;
    flop_spr?: number;
    turn_spr?: number;
    river_spr?: number;

    // SPR zone classification (NEW)
    spr_zone: SPRZone;
    zone_description: string;       // "Pot committed - shove/fold territory"

    // Strategic thresholds (NEW)
    commitment_thresholds: CommitmentThresholds;

    // Pot odds & geometry (NEW)
    pot_odds?: PotOddsData;

    // Stack commitment (NEW)
    stack_commitment: StackCommitmentData;

    // Bet sizing guidance (NEW)
    optimal_sizing: OptimalSizing;

    // Future SPR projection (NEW)
    future_spr: FutureSPR;

    // Legacy (keep for compatibility)
    commitment_analysis: {
        flop?: string;
        turn?: string;
        river?: string;
    };
}

// ═══════════════════════════════════════════════════════════════
// AGENT 5: GTO Strategy Generator
// ═══════════════════════════════════════════════════════════════

export interface Agent5Input {
    boardAnalysis: BoardAnalysis;
    ranges: RangeData;
    equity: EquityData;
    advantages: AdvantageData;
    spr: SPRData;
    heroHand: string;
    positions: Position;        // ADD: Hero and villain positions
    actions: Action[];          // ADD: Full action history
    streetsPlayed?: {           // NEW: Which streets Hero actually saw
        preflop: boolean;
        flop: boolean;
        turn: boolean;
        river: boolean;
    };
    villainContext?: {          // NEW: Context about how villain was determined
        type: 'opening' | 'sb_vs_bb' | 'facing_action' | 'vs_3bet' | 'vs_4bet';
        villain?: string;           // Villain's position (e.g., 'SB', 'BB')
        villainName?: string;       // Villain's player name (e.g., 'Arepitarica')
    };
    heroClassification?: HeroClassification;  // Phase 12: Unified classification from Agent 1
}

export interface SingleAction {
    action: ActionType;
    sizing?: string;                // "65% pot" or "$6.50"
    reasoning: string;              // "Range + nut advantage = value bet"
    frequency?: number;             // 0.6 = 60% of the time (optional)
}

/**
 * Mixed Strategy Recommendation
 * 
 * Supports GTO spots where multiple actions have frequency:
 * - Primary: The most frequent action (50%+)
 * - Alternative: Secondary action that's also GTO-approved (10-49%)
 */
export interface MixedActionRecommendation {
    primary: SingleAction;          // Main GTO action (highest frequency)
    alternative?: SingleAction;     // Secondary GTO action (if mixed strategy)
}

/**
 * How hero's play compares to GTO
 */
export type PlayQuality = 'optimal' | 'acceptable' | 'mistake';

/**
 * Legacy single action (for simpler preflop)
 */
export interface ActionRecommendation {
    action: ActionType;
    sizing?: string;
    reasoning: string;
}

/**
 * Decision Tree for a Street
 * 
 * Now uses MixedActionRecommendation for each decision point
 * to support GTO mixed strategies (e.g., check 60% / bet 40%)
 */
export interface StreetDecisionTree {
    // Decision Point 1: Hero's initial action (when first to act)
    initial_action?: MixedActionRecommendation;

    // Decision Point 2A: If hero checks and villain bets
    if_check_and_villain_bets?: MixedActionRecommendation;

    // Decision Point 2B: If hero bets and villain raises
    if_bet_and_villain_raises?: MixedActionRecommendation;

    // For IP situations: What to do when villain checks to hero (ALIASES)
    if_villain_checks_to_hero?: MixedActionRecommendation;
    if_villain_checks?: MixedActionRecommendation;  // Alias used by GTO Agent

    // For IP situations: What to do when villain bets into hero (ALIASES)
    if_villain_bets_into_hero?: MixedActionRecommendation;
    if_villain_bets?: MixedActionRecommendation;  // Alias used by GTO Agent

    // If hero bets and villain raises (IP situations)
    if_hero_bets_and_villain_raises?: MixedActionRecommendation;  // Used by GTO Agent
}

/**
 * Decision Tree for Preflop
 * Handles the sequence: Open -> Response to 3bet -> Response to 4bet
 */
export interface PreflopDecisionTree {
    initial_action: MixedActionRecommendation;        // RFI, Limp, Fold, or Response to Open
    response_to_3bet?: MixedActionRecommendation;     // If Hero Opened and faces 3-bet
    response_to_4bet?: MixedActionRecommendation;     // If Hero 3-bet and faces 4-bet
    _hero_is_3bettor?: boolean;                       // Flag: Hero made the 3-bet (for UI labeling)
}

export interface GTOStrategy {
    preflop: PreflopDecisionTree;   // UPDATED: Now a tree like postflop
    flop?: StreetDecisionTree;
    turn?: StreetDecisionTree;
    river?: StreetDecisionTree;
}

// ═══════════════════════════════════════════════════════════════
// AGENT 6: Mistake Detector
// ═══════════════════════════════════════════════════════════════

// Phase 14: Strategic leak categories
export type LeakCategory =
    // Core leaks (detectable from single hand)
    | 'spr_awareness'           // Folding in shove zone
    | 'equity_miscalculation'   // Folding with correct pot odds
    | 'range_awareness'         // Folding top of range
    | 'postflop_value'          // Missing value bets (checking with strong hands)
    | 'postflop_bluff'          // Bad bluffs (betting with weak hands)

    // Street-specific fallbacks (Phase 14.5)
    | 'preflop_mistake'         // Preflop deviation from GTO
    | 'flop_mistake'            // Flop strategy issue
    | 'turn_mistake'            // Turn strategy issue
    | 'river_mistake';          // River strategy issue

export interface StrategicLeakCategory {
    category: LeakCategory;
    count: number;
    examples: string[];
}

export interface Agent6Input {
    boardAnalysis: BoardAnalysis;
    ranges: RangeData;
    equity: EquityData;
    advantages: AdvantageData;
    spr: SPRData;
    gtoStrategy: GTOStrategy;
    heroActions: HeroActions;
    positions: Position;        // ADD: Hero and villain positions
    heroClassification?: HeroClassification; // Phase 14: Add hero classification context
}

export interface MistakeContext {
    equity?: string;                // "18% vs value range"
    pot_odds?: string;              // "Needed 25%"
    spr?: string;                   // "SPR 2.2 - pot committed"
    advantages?: string;            // "Villain 60% range advantage"
}

export interface MistakeRecord {
    street: Street;
    gto_recommendation: {
        action: ActionType;
        sizing?: string;
        reasoning: string;
    };
    hero_action: {
        action: ActionType;
        amount?: number;
    };
    is_mistake: boolean;
    severity: Severity;
    ev_impact: number;              // -14.20 (negative = lost EV)
    reasoning: string;              // "Called with insufficient equity"
    context_used: MistakeContext;
    flag_for_analysis: boolean;
    category: string;               // "crying_call", "missed_value", "bad_bluff"
}

/**
 * 3-Tier Classification for a single decision point
 */
export type DecisionPoint = 'initial_action' | 'facing_bet' | 'facing_raise';

export interface DecisionClassification {
    street: Street;
    decision_point: DecisionPoint;
    hero_action: ActionType;
    gto_primary: SingleAction;
    gto_alternative?: SingleAction;
    play_quality: PlayQuality;  // 'optimal' | 'acceptable' | 'mistake'
    reasoning: string;
    leak_category?: LeakCategory; // Phase 14: Categorized leak
}

/**
 * Summary of all decision classifications
 */
export interface ClassificationSummary {
    optimal_count: number;
    acceptable_count: number;
    mistake_count: number;
    overall_assessment: string;
}

export interface MistakeAnalysis {
    mistakes: MistakeRecord[];
    total_ev_lost: number;
    severity_summary: {
        critical: number;
        moderate: number;
        minor: number;
    };
    primary_leak?: string;

    // NEW: 3-tier classification data
    decisions?: DecisionClassification[];
    summary?: ClassificationSummary;
    leak_categories?: StrategicLeakCategory[]; // Phase 14: Strategic leak analysis
    worst_leak?: string;                       // Phase 14: Identified worst leak
}

// ═══════════════════════════════════════════════════════════════
// FINAL OUTPUT (What user sees)
// ═══════════════════════════════════════════════════════════════

export interface CoachOutput {
    gto_strategy: string;           // Formatted strategy text
    exploit_deviation: string;      // Formatted deviation text (renamed: Play Review)
    exploit_signals?: any;          // NEW: Agent 7 exploit signals per villain type
    learning_tag: string[];         // ["river value bet", "pot odds"]

    // Structured data for analysis tab
    structured_data?: {
        mistakes: MistakeRecord[];
        ranges: RangeData;
        equity: EquityData;
        advantages: AdvantageData;
    };

    // Phase 12-14.5: Enhanced coaching data top-level access
    heroClassification?: HeroClassification | null;
    spr?: SPRData | null;
    mistakes?: MistakeAnalysis | null;
}
