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
    source: 'detected' | 'inferred' | 'defaulted';
    confidence: number; // 0-100
    reasoning: string;
}

export interface EnrichedHandContext extends HandContext {
    // Metadata about what was filled in
    assumptions: Array<{
        field: string;
        value: any;
        source: 'detected' | 'inferred' | 'defaulted';
        confidence: number;
        reasoning: string;
    }>;
}

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
 * Infer hero cards from story text
 */
export function inferHeroCards(context: HandContext): FallbackResult | null {
    const text = (context.rawText || '').toLowerCase(); // Actually, extraction needs Case usually? 
    // normalizeHand handles case. But regex needs to be careful.

    // Pattern 1: "Hero has KK", "BTN with KK", "I have AKs"
    // Allow Hero, I, or any Position as the subject
    const explicitPattern = /(?:hero|i|utg|hj|co|btn|sb|bb)\b.*?\b(?:has|have|with|dealt|holding|holds)\s+([2-9tjqka][shdc]?\s*[2-9tjqka][shdc]?)/i;
    const match = context.rawText?.match(explicitPattern);

    if (match) {
        return {
            value: match[1].replace(/\s+/g, ''), // "K K" -> "KK"
            source: 'inferred',
            confidence: 95,
            reasoning: `Detected hand "${match[1]}" assigned to Hero`
        };
    }

    // Pattern 2: Standalone strong hands (e.g. "KK", "AKs") at start or in context
    // This is risky, skipping for now to avoid false positives.

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

// ============================================================================
// MAIN ENRICHMENT FUNCTION
// ============================================================================

/**
 * Enrich incomplete hand data with smart defaults and inference
 * 
 * @param context - Partial hand data from user input
 * @returns Enriched context with transparency metadata
 */
export function enrichHandContext(context: HandContext): EnrichedHandContext {
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
