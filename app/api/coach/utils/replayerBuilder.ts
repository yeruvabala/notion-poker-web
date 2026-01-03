/**
 * replayerBuilder.ts - Build replayer_data from text input
 * 
 * This is a TypeScript port of backend/replayer_parser.py functionality,
 * specifically for text-based hand input (not file uploads).
 * 
 * Key differences from Python version:
 * - Uses enriched context from ParserFallbacks
 * - Optimized for single-hand stories (not multi-hand files)
 * - Returns same JSON structure as replayer_parser.py
 */

import type { EnrichedHandContext } from './ParserFallbacks';

export interface ReplayerData {
    players: Player[];
    board: string[];
    pot: number;
    street: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
    sb: number;
    bb: number;
    dealerSeat: number;
    actions: Action[];
}

export interface Player {
    name: string;
    seatIndex: number;
    isHero: boolean;
    cards: string[] | null;
    isActive: boolean;
    stack: number;
    position: string;
}

export interface Action {
    player: string;
    action: string;
    amount: number | null;
    street: string;
    decision?: string; // Special marker for pending decisions
}

/**
 * Convert shorthand card notation to literal cards with suits
 * KJs → ["K♠", "J♥"] (suited uses same suit)
 * AKo → ["A♠", "K♥"] (offsuit uses different suits)
 * 99 → ["9♠", "9♦"] (pairs use different suits)
 * Already literal → pass through
 */
function convertShorthandToLiteral(cardStr: string): string[] {
    // Already has suits (literal format) - pass through
    if (/[♠♥♦♣shdc]/.test(cardStr)) {
        return cardStr.split(/\s+/).filter(c => c.length >= 2);
    }

    // Shorthand format: "KJs", "AKo", "99"
    const match = cardStr.match(/^([AKQJT2-9])([AKQJT2-9])([so])?$/i);
    if (!match) {
        // Not recognized format, return as-is
        return [cardStr];
    }

    const [_, rank1, rank2, suitedness] = match;

    // Suited (or not specified, default to suited for variety)
    if (suitedness === 's' || !suitedness) {
        return [`${rank1}♠`, `${rank2}♠`]; // Same suit
    }

    // Offsuit
    return [`${rank1}♠`, `${rank2}♥`]; // Different suits
}

/**
 * Build replayer_data from text story + enriched context
 * 
 * @param rawText - Original hand history text
 * @param enriched - Enriched context from ParserFallbacks
 * @param hints - Optional manual overrides (position, cards, board)
 * @returns ReplayerData structure compatible with agent pipeline
 */
export function buildReplayerData(
    rawText: string,
    enriched?: EnrichedHandContext,
    hints?: {
        position?: string;
        cards?: string;
        board?: string;
        boardRanks?: string[];
    }
): ReplayerData {

    // ════════════════════════════════════════════════════════════
    // STEP 1: Extract Hero Cards (with shorthand support)
    // ════════════════════════════════════════════════════════════
    const visibleCards = hints?.cards || enriched?.heroCards || '';
    const heroCards = visibleCards
        ? convertShorthandToLiteral(visibleCards)
        : [];

    // ════════════════════════════════════════════════════════════
    // STEP 2: Build Board with Rainbow Suits
    // ════════════════════════════════════════════════════════════
    // Avoid false monotone classification by using different suits
    const rainbowSuits = ['♠', '♥', '♦', '♣'];
    const boardRanks = hints?.boardRanks || [];
    const boardCards = boardRanks.length > 0
        ? boardRanks.map((rank, idx) => `${rank}${rainbowSuits[idx % 4]}`)
        : [];

    // ════════════════════════════════════════════════════════════
    // STEP 3: Determine Street
    // ════════════════════════════════════════════════════════════
    const street: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' =
        boardCards.length >= 5 ? 'river'
            : boardCards.length >= 4 ? 'turn'
                : boardCards.length >= 3 ? 'flop'
                    : 'preflop';

    // ════════════════════════════════════════════════════════════
    // STEP 4: Build Action Sequence
    // ════════════════════════════════════════════════════════════
    const actionSequence = enriched?.actions || '';
    const replayerActions: Action[] = [];

    // Detect 3-bet scenario
    const isVillain3Bet = actionSequence.includes('villain_3bet') || /3-?bet/i.test(rawText);
    const hasHeroOpen = actionSequence.includes('hero_open');

    // Hero opens (RFI)
    if (hasHeroOpen || (isVillain3Bet && !hasHeroOpen)) {
        replayerActions.push({
            player: 'Hero',
            action: 'raises',
            amount: 2.5,
            street: 'preflop'
        });
    }

    // Villain 3-bets
    if (isVillain3Bet) {
        replayerActions.push({
            player: 'Villain',
            action: 'raises',
            amount: 7,
            street: 'preflop'
        });
    }

    // Hero calls 3-bet
    if (actionSequence.includes('hero_call')) {
        replayerActions.push({
            player: 'Hero',
            action: 'calls',
            amount: 7,
            street: 'preflop'
        });
    }

    // Hero 4-bets (if mentioned)
    if (/[45]-?bet/i.test(rawText)) {
        replayerActions.push({
            player: 'Hero',
            action: 'raises',
            amount: null,
            street: 'preflop'
        });
    }

    // Flop action: Facing a bet
    if (street === 'flop' && /facing\s+(?:a\s+)?bet/i.test(rawText)) {
        // Villain bets
        replayerActions.push({
            player: 'Villain',
            action: 'bets',
            amount: null,
            street: 'flop'
        });

        // Hero's decision is pending (GTO analysis target)
        replayerActions.push({
            player: 'Hero',
            action: 'pending',
            amount: null,
            street: 'flop',
            decision: 'facing_bet'
        });
    }

    // ════════════════════════════════════════════════════════════
    // STEP 5: Build Players Array
    // ════════════════════════════════════════════════════════════
    const players: Player[] = [
        {
            name: 'Hero',
            seatIndex: 1,
            isHero: true,
            cards: heroCards.length >= 2 ? [heroCards[0], heroCards[1]] : null,
            isActive: true,
            stack: enriched?.effectiveStack || 100,
            position: hints?.position || enriched?.heroPosition || 'BTN'
        },
        {
            name: 'Villain',
            seatIndex: 2,
            isHero: false,
            cards: null,
            isActive: true,
            stack: enriched?.effectiveStack || 100,
            position: enriched?.villainPosition || 'BB'
        }
    ];

    // ════════════════════════════════════════════════════════════
    // STEP 6: Assemble Final Structure
    // ════════════════════════════════════════════════════════════
    return {
        players,
        board: boardCards,
        pot: enriched?.potSize || 6,
        street,
        sb: 0.5,
        bb: 1,
        dealerSeat: 1,
        actions: replayerActions
    };
}

/**
 * Validate replayer_data has minimum required fields
 */
export function validateReplayerData(data: ReplayerData): { valid: boolean; error?: string } {
    if (!data.players || data.players.length < 2) {
        return { valid: false, error: 'Need at least 2 players' };
    }

    const hero = data.players.find(p => p.isHero);
    if (!hero) {
        return { valid: false, error: 'No hero player found' };
    }

    if (!hero.position) {
        return { valid: false, error: 'Hero position required' };
    }

    return { valid: true };
}
