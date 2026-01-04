/**
 * ParserFallbacks: Smart defaults and inference for incomplete hand data
 * 
 * Architecture:
 * - Tier 1: Smart defaults (automatic, instant)
 * - Tier 2: Context-based inference (pattern matching)
 * - Tier 3: Confidence scoring (for transparency)
 * 
 * Design Pattern: Strategy + Builder
 */

export type Position = 'UTG' | 'UTG+1' | 'UTG+2' | 'HJ' | 'CO' | 'BTN' | 'SB' | 'BB';

import { parseWithLLM, isLLMParsingEnabled } from './llmParser';

export interface HandContext {
    // What we know for sure
    heroPosition?: Position;
    heroCards?: string;
    board?: string;
    stakes?: string;
    effectiveStack?: number;

    // What we're trying to infer
    villainPosition?: Position;
    actions?: string;
    betSize?: number;
    potSize?: number;

    // Raw story text for inference
    rawText?: string;
}

export interface FallbackResult {
    value: any;
    source: 'detected' | 'inferred' | 'defaulted' | 'AI_Inferred';
    confidence: number; // 0-100
    reasoning: string;
}

export interface EnrichedHandContext extends HandContext {
    // Metadata about what was filled in
    assumptions: Array<{
        field: string;
        value: any;
        source: 'detected' | 'inferred' | 'defaulted' | 'AI_Inferred';
        confidence: number;
        reasoning: string;
    }>;

    // NEW: Scenario/intent classification
    scenario?: 'opening' | 'facing_action' | 'postflop';

    // NEW: LLM Fallback tracking
    isAiFallback?: boolean;
    parsingConfidence?: number; // Overall parsing confidence 0-100
}

// ============================================================================
// ENHANCED PATTERN LIBRARY (Phase 1)
// ============================================================================

const ENHANCED_PATTERNS = {
    // Card detection - multiple formats
    cards: {
        // Standard: "A♠ K♥" or "Ah Kh"
        standard: /\b([AKQJT2-9][shdc♠♥♦♣])\s*([AKQJT2-9][shdc♠♥♦♣])\b/i,
        // Shorthand suited: "AKs", "KJs"
        shorthandSuited: /\b([AKQJT2-9])([AKQJT2-9])s\b/i,
        // Shorthand offsuit: "AKo", "KJo"
        shorthandOffsuit: /\b([AKQJT2-9])([AKQJT2-9])o\b/i,
        // Pairs: "AA", "KK", "QQ"
        pairs: /\b([AKQJT2-9])\1\b/,
        // Context-aware: "hero with KJs", "I have AKo"
        withContext: /(?:hero|i|me)\s+(?:with|have|has|holding|dealt)\s+([AKQJT2-9]{2}[so]?)/i
    },

    // Position detection - enhanced variations (6-max + 9-max support)
    positions: {
        // Explicit: "hero on HJ", "at BTN", "on UTG+1", "in middle"
        explicit: /(?:hero|i|me|my).*?\b(?:on|at|from|in)\s+(BTN|button|but|dealer|CO|cutoff|cut|HJ|hijack|hi|UTG\+?[12]?|utg[12]?|MP|middle|mid|SB|BB|small\s+blind|big\s+blind|small|big)\b/i,
        // Action-based: "opens from HJ"
        actionBased: /(?:open|raise|fold)s?\s+(?:from|in|on)\s+(BTN|CO|HJ|UTG\+?[12]?|MP|SB|BB)\b/i,
        // Possessive: "HJ's action"
        possessive: /\b(BTN|CO|HJ|UTG\+?[12]?|MP|SB|BB)(?:'s|s')\s+(?:action|hand|decision)\b/i,
        // Standalone: "HJ" in context
        standalone: /\b(BTN|button|CO|cutoff|HJ|hijack|UTG\+?[12]?|MP|middle|SB|BB)\b/i
    },

    // Intent classification - NEW
    intent: {
        // Opening scenario: "should open", "can I raise"
        opening: /\b(?:should|can|do|does|would).*?(?:open|raise|fold|play)\s+(?:this|the)?\s*hand\b/i,
        // Facing action: "action on hero", "villain raised"
        facingAction: /\b(?:facing|action\s+on|villain|opponent|he|they).*?(?:raise|bet|3-?bet|4-?bet)/i,
        // Postflop: "on the flop", "turn card"
        postflop: /\b(?:flop|turn|river)\b/i
    },

    // Board detection - street-aware
    board: {
        flop: /flop:?\s*([AKQJT2-9][shdc♠♥♦♣])\s*([AKQJT2-9][shdc♠♥♦♣])\s*([AKQJT2-9][shdc♠♥♦♣])/i,
        turn: /turn:?\s*([AKQJT2-9][shdc♠♥♦♣])/i,
        river: /river:?\s*([AKQJT2-9][shdc♠♥♦♣])/i,
        inline: /board.*?([AKQJT2-9][shdc♠♥♦♣](?:\s*[AKQJT2-9][shdc♠♥♦♣]){2,4})/i
    }
};

// Confidence levels for different detection methods
const CONFIDENCE_LEVELS = {
    EXPLICIT: 95,      // Direct exact match
    STRONG_PATTERN: 85, // Strong contextual pattern
    INFERRED: 70,      // Logical inference
    WEAK_PATTERN: 60,  // Ambiguous pattern
    DEFAULT: 30        // Fallback value
};

// ============================================================================
// TIER 1: SMART DEFAULTS
// ============================================================================

const DEFAULTS = {
    effectiveStack: 100, // bb - most common cash game depth
    betSize: 50, // % pot - GTO standard c-bet
    tableSize: 6, // 6-max is most popular
    preflopPotSize: (blinds: string) => {
        // Standard open = 2.5bb, 3-bet = 3× open
        return 6; // bb (assumes single raise)
    },
} as const;

/**
 * Apply smart defaults to missing fields
 */
export function applyDefaults(context: HandContext): EnrichedHandContext {
    const assumptions: EnrichedHandContext['assumptions'] = [];

    const enriched: EnrichedHandContext = { ...context, assumptions };

    // Default effective stack
    if (!enriched.effectiveStack) {
        enriched.effectiveStack = DEFAULTS.effectiveStack;
        assumptions.push({
            field: 'effectiveStack',
            value: DEFAULTS.effectiveStack,
            source: 'defaulted',
            confidence: 70,
            reasoning: '100bb is the most common cash game stack depth'
        });
    }

    // Default bet size (if action mentions "facing bet" but no size)
    if (enriched.actions?.includes('facing bet') && !enriched.betSize) {
        enriched.betSize = DEFAULTS.betSize;
        assumptions.push({
            field: 'betSize',
            value: DEFAULTS.betSize,
            source: 'defaulted',
            confidence: 60,
            reasoning: '50% pot is a standard GTO continuation bet size'
        });
    }

    return enriched;
}

// ============================================================================
// TIER 2: INTELLIGENT INFERENCE
// ============================================================================

/**
 * Infer villain position from action context
 */
export function inferVillainPosition(context: HandContext): FallbackResult | null {
    const text = (context.rawText || '').toLowerCase();

    // Pattern 1: Explicit mention "BB 3-bets" or "SB raises"
    const positionPattern = /\b(utg|hj|co|btn|sb|bb)\s+(3-?bets?|raises?|opens?|bets?|calls?)/i;
    const match = text.match(positionPattern);

    if (match) {
        const pos = match[1].toUpperCase() as Position;
        return {
            value: pos,
            source: 'inferred',
            confidence: 90,
            reasoning: `Detected "${match[0]}" in hand story`
        };
    }

    // Pattern 2: Contextual inference from hero position + action
    if (context.heroPosition === 'BTN') {
        // If hero is BTN and facing 3-bet, likely from blinds
        if (/3-?bet/i.test(text)) {
            return {
                value: 'BB',
                source: 'inferred',
                confidence: 75,
                reasoning: 'BTN facing 3-bet typically comes from BB (most common defense position)'
            };
        }

        // If hero is BTN facing flop c-bet after raising preflop
        if (/c-?bet|continuation/i.test(text) || /flop.*bet/i.test(text)) {
            return {
                value: 'BB',
                source: 'inferred',
                confidence: 70,
                reasoning: 'BTN vs blind heads-up is most common postflop scenario'
            };
        }
    }

    // Pattern 3: Blind vs blind
    if (context.heroPosition === 'SB' && /raise|3-?bet/i.test(text)) {
        return {
            value: 'BB',
            source: 'inferred',
            confidence: 85,
            reasoning: 'SB facing aggression is almost always from BB'
        };
    }

    return null;
}

/**
 * Infer action sequence from story fragments
 */
export function inferActionSequence(context: HandContext): FallbackResult | null {
    const text = (context.rawText || '').toLowerCase();

    // Pattern 1: Preflop action
    if (/open|raise|3-?bet|4-?bet/i.test(text)) {
        if (/3-?bet.*call/i.test(text)) {
            return {
                value: 'hero_open_villain_3bet_hero_call',
                source: 'inferred',
                confidence: 85,
                reasoning: 'Detected "3-bet" followed by "call" in story'
            };
        }

        if (/raise.*call/i.test(text) || /open.*call/i.test(text)) {
            return {
                value: 'hero_open_villain_call',
                source: 'inferred',
                confidence: 80,
                reasoning: 'Detected "raise/open" followed by "call" in story'
            };
        }
    }

    // Pattern 2: Postflop facing bet
    if (/(flop|turn|river).*facing\s+(?:a\s+)?bet/i.test(text)) {
        return {
            value: 'facing_bet',
            source: 'inferred',
            confidence: 90,
            reasoning: 'Explicitly stated "facing bet" on specific street'
        };
    }

    // Pattern 3: Check-through scenario
    if (/checks?\s+through/i.test(text) || /both\s+check/i.test(text)) {
        return {
            value: 'check_check',
            source: 'inferred',
            confidence: 95,
            reasoning: 'Detected "checks through" or "both check" in story'
        };
    }

    return null;
}

/**
 * Infer pot size from preflop action
 */
export function inferPotSize(context: HandContext): FallbackResult | null {
    const text = (context.rawText || '').toLowerCase();

    // If 3-bet pot
    if (/3-?bet/i.test(text)) {
        const potSize = 15; // bb (standard 3-bet pot: 2.5bb open × 3 × 2 players)
        return {
            value: potSize,
            source: 'inferred',
            confidence: 75,
            reasoning: 'Standard 3-bet pot is approximately 15bb (2.5bb open × 3 × 2 callers)'
        };
    }

    // If single raised pot
    if (/raise|open/i.test(text) && !/3-?bet/i.test(text)) {
        const potSize = 6; // bb (2.5bb open × 2 players + blinds)
        return {
            value: potSize,
            source: 'inferred',
            confidence: 70,
            reasoning: 'Standard single raised pot is approximately 6bb (2.5bb × 2 + blinds)'
        };
    }

    return null;
}

/**
 * Infer hero cards from story text (ENHANCED Phase 1)
 */
export function inferHeroCards(context: HandContext): FallbackResult | null {
    const text = context.rawText || '';

    // Try patterns in order of confidence

    // Pattern 1: Context-aware ("hero with KJs", "I have AKo")
    const contextMatch = text.match(ENHANCED_PATTERNS.cards.withContext);
    if (contextMatch) {
        const handStr = contextMatch[1];
        return {
            value: normalizeCardFormat(handStr),
            source: 'inferred',
            confidence: CONFIDENCE_LEVELS.EXPLICIT,
            reasoning: `Detected "${handStr}" explicitly mentioned for hero`
        };
    }

    // Pattern 2: Shorthand suited ("KJs", "AKs")
    const suitedMatch = text.match(ENHANCED_PATTERNS.cards.shorthandSuited);
    if (suitedMatch) {
        const rank1 = suitedMatch[1];
        const rank2 = suitedMatch[2];
        return {
            value: `${rank1}${rank2}s`,
            source: 'inferred',
            confidence: CONFIDENCE_LEVELS.STRONG_PATTERN,
            reasoning: `Detected suited hand "${rank1}${rank2}s"`
        };
    }

    // Pattern 3: Shorthand offsuit ("KJo", "AKo")
    const offsuitMatch = text.match(ENHANCED_PATTERNS.cards.shorthandOffsuit);
    if (offsuitMatch) {
        const rank1 = offsuitMatch[1];
        const rank2 = offsuitMatch[2];
        return {
            value: `${rank1}${rank2}o`,
            source: 'inferred',
            confidence: CONFIDENCE_LEVELS.STRONG_PATTERN,
            reasoning: `Detected offsuit hand "${rank1}${rank2}o"`
        };
    }

    // Pattern 4: Pairs ("KK", "AA")
    const pairMatch = text.match(ENHANCED_PATTERNS.cards.pairs);
    if (pairMatch) {
        const rank = pairMatch[1];
        return {
            value: `${rank}${rank}`,
            source: 'inferred',
            confidence: CONFIDENCE_LEVELS.STRONG_PATTERN,
            reasoning: `Detected pocket pair "${rank}${rank}"`
        };
    }

    // Pattern 5: Standard format ("A♠ K♥" or "Ah Kd")
    const standardMatch = text.match(ENHANCED_PATTERNS.cards.standard);
    if (standardMatch) {
        const card1 = standardMatch[1];
        const card2 = standardMatch[2];
        return {
            value: `${card1}${card2}`,
            source: 'inferred',
            confidence: CONFIDENCE_LEVELS.STRONG_PATTERN,
            reasoning: `Detected specific cards "${card1} ${card2}"`
        };
    }

    return null;
}

/**
 * Helper: Normalize card format to consistent notation
 */
function normalizeCardFormat(handStr: string): string {
    // Preserve suited/offsuit notation
    // "KJs" → "KJs" (keep lowercase s)
    // "KJo" → "KJo" (keep lowercase o)
    const upper = handStr.toUpperCase();
    const last = handStr.slice(-1);

    // If last char is 's' or 'o', keep it lowercase
    if (last === 's' || last === 'o') {
        return upper.slice(0, -1) + last;
    }

    return upper;
}

/**
 * Infer intent/scenario type from story (NEW Phase 1)
 */
export function inferIntent(context: HandContext): FallbackResult | null {
    const text = (context.rawText || '').toLowerCase();

    // Postflop has highest priority (most specific)
    if (ENHANCED_PATTERNS.intent.postflop.test(text)) {
        return {
            value: 'postflop',
            source: 'inferred',
            confidence: CONFIDENCE_LEVELS.EXPLICIT,
            reasoning: 'Detected postflop street mentioned (flop/turn/river)'
        };
    }

    // 3-bet/4-bet scenarios are facing action, not opening
    if (/3-?bet|4-?bet/i.test(text)) {
        return {
            value: 'facing_action',
            source: 'inferred',
            confidence: CONFIDENCE_LEVELS.STRONG_PATTERN,
            reasoning: 'Detected 3-bet/4-bet scenario (facing raise)'
        };
    }

    // Facing action (villain raised/bet)
    if (ENHANCED_PATTERNS.intent.facingAction.test(text)) {
        return {
            value: 'facing_action',
            source: 'inferred',
            confidence: CONFIDENCE_LEVELS.STRONG_PATTERN,
            reasoning: 'Detected facing aggression (villain raised/bet)'
        };
    }

    // Opening scenario (should/can hero open)
    if (ENHANCED_PATTERNS.intent.opening.test(text)) {
        return {
            value: 'opening',
            source: 'inferred',
            confidence: CONFIDENCE_LEVELS.STRONG_PATTERN,
            reasoning: 'Detected opening decision (should/can hero open)'
        };
    }

    return null;
}


// ============================================================================
// TIER 3: CONFIDENCE SCORING
// ============================================================================

/**
 * Calculate overall confidence score for analysis
 */
export function calculateOverallConfidence(enriched: EnrichedHandContext): number {
    if (enriched.assumptions.length === 0) {
        return 100; // Perfect - no assumptions made
    }

    // Weighted average based on field importance
    const weights: Record<string, number> = {
        villainPosition: 3, // Most critical
        effectiveStack: 2,
        actions: 2,
        betSize: 1,
        potSize: 1,
    };

    let totalWeight = 0;
    let weightedSum = 0;

    for (const assumption of enriched.assumptions) {
        const weight = weights[assumption.field] || 1;
        totalWeight += weight;
        weightedSum += assumption.confidence * weight;
    }

    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 100;
}

function calculateParsingConfidence(context: EnrichedHandContext): number {
    let score = 0;

    // Critical fields (20 points each)
    if (context.heroPosition) {
        const isDefaulted = context.assumptions.some(a =>
            a.field === 'heroPosition' && a.source === 'defaulted'
        );
        score += isDefaulted ? 5 : 20;
    }

    if (context.heroCards) {
        const isDefaulted = context.assumptions.some(a =>
            a.field === 'heroCards' && a.source === 'defaulted'
        );
        score += isDefaulted ? 5 : 20;
    }

    if (context.effectiveStack && context.effectiveStack !== 100) {
        score += 20;
    }

    // Important fields (10 points each)
    if (context.villainPosition) score += 10;
    if (context.scenario) score += 10;
    if (context.potSize && context.potSize !== 6) score += 10;

    // Bonus: No defaulted critical fields
    const hasDefaultedCritical = context.assumptions.some(a =>
        a.source === 'defaulted' && ['heroPosition', 'heroCards'].includes(a.field)
    );
    if (!hasDefaultedCritical && (context.heroPosition || context.heroCards)) {
        score += 10;
    }

    return Math.min(score, 100);
}

// ============================================================================
// MAIN ENRICHMENT FUNCTION
// ============================================================================

/**
 * Enrich incomplete hand data with smart defaults and inference
 * 
 * @param context - Partial hand data from user input
 * @returns Enriched context with transparency metadata
 */
export async function enrichHandContext(context: HandContext): Promise<EnrichedHandContext> {

    // Step 1: Apply defaults
    let enriched = applyDefaults(context);

    // Step 2: Try to infer missing critical fields

    // Infer villain position (CRITICAL)
    if (!enriched.villainPosition) {
        const result = inferVillainPosition(context);
        if (result) {
            enriched.villainPosition = result.value;
            enriched.assumptions.push({
                field: 'villainPosition',
                value: result.value,
                source: result.source,
                confidence: result.confidence,
                reasoning: result.reasoning
            });
        }
    }

    // Infer hero cards
    if (!enriched.heroCards) {
        const result = inferHeroCards(context);
        if (result) {
            enriched.heroCards = result.value;
            // Also set enriched.hand for compatibility if that's what route.ts uses?
            // route.ts uses enriched.hand
            // HandContext doesn't have 'hand' field defined in interface I saw?
            // Wait, route.ts logic: enriched?.hand
            // ParserFallbacks interface has heroCards.
            // I should check if I need to map it or if route.ts casts it.
            // route.ts line 203: heroCards: cards.
            // Wait, route.ts line 184-208 uses enriched object returned by ParserFallbacks.
            // I need to check if route.ts uses `enriched.hand` or `enriched.heroCards`.
            // In step 10653 view, line 277 used `enriched?.hand`.
            // So `EnrichedHandContext` must have `hand`?
            // Interface definition (Step 10697, line 14): heroCards?: string.
            // It does NOT have `hand`.
            // So route.ts `enriched?.hand` might be WRONG or I missed where `hand` is added.
            // Actually, in `route.ts` line 201: `enriched = enrichHandContext(...)`.
            // Line 192: `let enriched`.
            // TS might be loose here or I missed a type def.
            // I will use `enriched.heroCards` here, and check route.ts matches.

            enriched.assumptions.push({
                field: 'heroCards',
                value: result.value,
                source: result.source,
                confidence: result.confidence,
                reasoning: result.reasoning
            });
        }
    }

    // NEW: Infer scenario/intent (Phase 1)
    if (!enriched.scenario) {
        const result = inferIntent(context);
        if (result) {
            enriched.scenario = result.value;
            enriched.assumptions.push({
                field: 'scenario',
                value: result.value,
                source: result.source,
                confidence: result.confidence,
                reasoning: result.reasoning
            });
        }
    }

    // Infer action sequence
    if (!enriched.actions) {
        const result = inferActionSequence(context);
        if (result) {
            enriched.actions = result.value;
            enriched.assumptions.push({
                field: 'actions',
                value: result.value,
                source: result.source,
                confidence: result.confidence,
                reasoning: result.reasoning
            });
        }
    }

    // Infer pot size
    if (!enriched.potSize) {
        const result = inferPotSize(context);
        if (result) {
            enriched.potSize = result.value;
            enriched.assumptions.push({
                field: 'potSize',
                value: result.value,
                source: result.source,
                confidence: result.confidence,
                reasoning: result.reasoning
            });
        }
    }

    // Step 3: Calculate parsing confidence
    const parsingConfidence = calculateParsingConfidence(enriched);

    // Step 4: LLM Fallback Trigger
    const needsLLMFallback =
        parsingConfidence < 50 ||
        !enriched.heroPosition ||
        !enriched.heroCards;

    let isAiFallback = false;

    if (needsLLMFallback && context.rawText && isLLMParsingEnabled()) {
        console.log('[Parser] Low confidence (' + parsingConfidence + '%), trying LLM fallback...');

        const llmResult = await parseWithLLM(context.rawText);

        if (llmResult) {
            isAiFallback = true;

            // Merge: Only fill null/undefined fields
            if (!enriched.heroPosition && llmResult.heroPosition) {
                enriched.heroPosition = llmResult.heroPosition as Position;
                enriched.assumptions.push({
                    field: 'heroPosition',
                    value: llmResult.heroPosition,
                    source: 'AI_Inferred',
                    confidence: 65,
                    reasoning: 'Regex failed, AI detected pattern from context'
                });
            }

            if (!enriched.heroCards && llmResult.heroCards) {
                enriched.heroCards = llmResult.heroCards;
                enriched.assumptions.push({
                    field: 'heroCards',
                    value: llmResult.heroCards,
                    source: 'AI_Inferred',
                    confidence: 65,
                    reasoning: 'Regex failed, AI detected cards from story'
                });
            }

            if (!enriched.villainPosition && llmResult.villainPosition) {
                enriched.villainPosition = llmResult.villainPosition as Position;
                enriched.assumptions.push({
                    field: 'villainPosition',
                    value: llmResult.villainPosition,
                    source: 'AI_Inferred',
                    confidence: 65,
                    reasoning: 'AI detected opponent position'
                });
            }

            if (!enriched.effectiveStack && llmResult.effectiveStack) {
                enriched.effectiveStack = llmResult.effectiveStack;
                enriched.assumptions.push({
                    field: 'effectiveStack',
                    value: llmResult.effectiveStack,
                    source: 'AI_Inferred',
                    confidence: 60,
                    reasoning: 'AI detected stack size'
                });
            }

            if (!enriched.scenario && llmResult.scenario) {
                enriched.scenario = llmResult.scenario as 'opening' | 'facing_action' | 'postflop';
                enriched.assumptions.push({
                    field: 'scenario',
                    value: llmResult.scenario,
                    source: 'AI_Inferred',
                    confidence: 70,
                    reasoning: 'AI detected hand scenario type'
                });
            }
        }
    }

    // Step 5: Add tracking fields
    enriched.isAiFallback = isAiFallback;
    enriched.parsingConfidence = parsingConfidence;

    return enriched;
}

// ============================================================================
// TRANSPARENCY HELPERS
// ============================================================================

/**
 * Generate human-readable transparency message
 */
export function generateTransparencyMessage(enriched: EnrichedHandContext): string {
    if (enriched.assumptions.length === 0) {
        return '✅ All values detected from your hand story';
    }

    const criticalAssumptions = enriched.assumptions.filter(a =>
        ['villainPosition', 'actions'].includes(a.field)
    );

    const minorAssumptions = enriched.assumptions.filter(a =>
        !['villainPosition', 'actions'].includes(a.field)
    );

    const parts: string[] = [];

    if (criticalAssumptions.length > 0) {
        const items = criticalAssumptions.map(a => {
            const emoji = a.source === 'inferred' ? '🔍' : '⚠️';
            return `${emoji} ${formatFieldName(a.field)}: ${formatValue(a.field, a.value)}`;
        });
        parts.push(items.join(', '));
    }

    if (minorAssumptions.length > 0) {
        const items = minorAssumptions.map(a =>
            `${formatFieldName(a.field)}: ${formatValue(a.field, a.value)}`
        );
        parts.push(`Also assumed: ${items.join(', ')}`);
    }

    return parts.join(' • ');
}

/**
 * Generate detailed transparency breakdown (for tooltip/modal)
 */
export function generateDetailedBreakdown(enriched: EnrichedHandContext): string {
    const lines: string[] = [
        '# Analysis Assumptions',
        '',
        'The following values were inferred or defaulted:',
        ''
    ];

    for (const assumption of enriched.assumptions) {
        const emoji = assumption.source === 'detected' ? '✅'
            : assumption.source === 'inferred' ? '🔍'
                : '⚠️';

        lines.push(`## ${emoji} ${formatFieldName(assumption.field)}`);
        lines.push(`- **Value:** ${formatValue(assumption.field, assumption.value)}`);
        lines.push(`- **Confidence:** ${assumption.confidence}%`);
        lines.push(`- **Reasoning:** ${assumption.reasoning}`);
        lines.push('');
    }

    return lines.join('\n');
}

// ============================================================================
// FORMATTING HELPERS
// ============================================================================

function formatFieldName(field: string): string {
    const names: Record<string, string> = {
        villainPosition: 'Opponent Position',
        effectiveStack: 'Stack Depth',
        betSize: 'Bet Size',
        potSize: 'Pot Size',
        actions: 'Action Sequence'
    };
    return names[field] || field;
}

function formatValue(field: string, value: any): string {
    if (field === 'effectiveStack') return `${value}bb`;
    if (field === 'betSize') return `${value}% pot`;
    if (field === 'potSize') return `${value}bb`;
    return String(value);
}
