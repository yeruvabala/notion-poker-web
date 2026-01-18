'use client';

import { useState } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// PREMIUM MOBILE HAND BUILDER - World-class UI
// ═══════════════════════════════════════════════════════════════════════════════

const TABLE_FORMATS = {
    'HU': { label: 'HU', positions: ['BTN', 'BB'] },
    '6max': { label: '6-Max', positions: ['BTN', 'CO', 'HJ', 'UTG', 'SB', 'BB'] },
    '9max': { label: '9-Max', positions: ['BTN', 'CO', 'HJ', 'MP', 'UTG+2', 'UTG+1', 'UTG', 'SB', 'BB'] }
} as const;

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const SUITS = [
    { value: '♠', color: '#ffffff', isRed: false },  // White/platinum - spades
    { value: '♥', color: '#ef4444', isRed: true },   // Red - hearts
    { value: '♦', color: '#ef4444', isRed: true },   // Red - diamonds
    { value: '♣', color: '#ffffff', isRed: false }   // White/platinum - clubs
];

interface PreflopAction {
    player: 'H' | 'V';
    action: 'raise' | 'call' | 'fold' | '3bet' | '4bet' | 'limp';
    amount?: number;
}

interface PostflopAction {
    player: 'H' | 'V';
    action: 'check' | 'bet' | 'call' | 'raise' | 'fold';
    amount?: number;
}

// ═════════════════════════════════════════════════════════════════════════
// ACTION CHIP - Premium compact design with icons (TOP-LEVEL)
// ═════════════════════════════════════════════════════════════════════════
const getActionIcon = (action: string): string => {
    switch (action) {
        case 'raise': case '3bet': case '4bet': return '↑';
        case 'fold': return '✕';
        case 'call': return '→';
        case 'check': return '✓';
        case 'limp': return '•';
        case 'bet': return '◆';
        default: return '';
    }
};

const ActionChip = ({
    action,
    onRemove,
    showArrow = false,
    isLast = false
}: {
    action: PreflopAction | PostflopAction;
    onRemove: () => void;
    showArrow?: boolean;
    isLast?: boolean;
}) => {
    const icon = getActionIcon(action.action);
    const isHero = action.player === 'H';

    return (
        <>
            <div
                className={`action-chip-v2 ${isHero ? 'hero' : 'villain'} ${isLast ? 'last' : ''}`}
                onClick={onRemove}
            >
                <span className="chip-player-v2">{action.player}</span>
                {action.amount && <span className="chip-amount-v2">{action.amount}</span>}
                <span className="chip-icon-v2">{icon}</span>
            </div>
            {showArrow && <span className="action-flow-arrow">›</span>}
        </>
    );
};

// ═════════════════════════════════════════════════════════════════════════
// INLINE ACTION BUILDER - Smart auto-alternating player flow (TOP-LEVEL)
// ═════════════════════════════════════════════════════════════════════════
const InlineActionBuilder = ({
    actions,
    setActions,
    street,
    heroPosition,
    villainPosition,
    tableFormat,
    pot
}: {
    actions: (PreflopAction | PostflopAction)[];
    setActions: (actions: any[]) => void;
    street: 'preflop' | 'flop' | 'turn' | 'river';
    heroPosition?: string;
    villainPosition?: string;
    tableFormat?: string;
    pot?: number;
}) => {
    const [isAdding, setIsAdding] = useState(false);
    const [pendingPlayer, setPendingPlayer] = useState<'H' | 'V' | null>(null);
    const [customAmount, setCustomAmount] = useState<string>('');
    const [postflopMode, setPostflopMode] = useState<'%' | 'bb'>('%'); // % of pot or bb

    const lastAction = actions[actions.length - 1];
    const secondLastAction = actions[actions.length - 2];

    // Check if there are limps but no raises (for BB check detection)
    const hasLimps = actions.some(a => a.action === 'limp');
    const hasRaises = actions.some(a => a.action === 'raise' || a.action === '3bet' || a.action === '4bet');

    // Determine if action sequence is complete
    // Preflop: call, fold, or BB check after limps ends action
    // Postflop: call, fold, or check-check ends action
    const isEnded = lastAction?.action === 'call' ||
        lastAction?.action === 'fold' ||
        (street === 'preflop' && lastAction?.action === 'check' && hasLimps && !hasRaises) ||
        (street !== 'preflop' && lastAction?.action === 'check' && secondLastAction?.action === 'check');

    // ═════════════════════════════════════════════════════════════════════════
    // POSITION-BASED FIRST ACTOR LOGIC
    // ═════════════════════════════════════════════════════════════════════════
    const getFirstActorPreflop = (): 'H' | 'V' => {
        // Preflop order: UTG → UTG+1 → MP → HJ → CO → BTN → SB → BB
        // The player in earlier position acts first
        const preflopOrder = ['UTG', 'UTG+1', 'UTG+2', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

        if (tableFormat === 'HU') {
            // HU: BTN/SB acts first preflop, BB acts second
            const heroPos = heroPosition || 'BTN';
            const villainPos = villainPosition || 'BB';
            // BTN (index 0) acts first in HU preflop
            const huOrder = ['BTN', 'SB', 'BB'];
            const heroIndex = huOrder.indexOf(heroPos) >= 0 ? huOrder.indexOf(heroPos) : 0;
            const villainIndex = huOrder.indexOf(villainPos) >= 0 ? huOrder.indexOf(villainPos) : 1;
            return heroIndex < villainIndex ? 'H' : 'V';
        }

        const heroPos = heroPosition || 'BTN';
        const villainPos = villainPosition || 'BB';
        const heroIndex = preflopOrder.indexOf(heroPos) >= 0 ? preflopOrder.indexOf(heroPos) : 6;
        const villainIndex = preflopOrder.indexOf(villainPos) >= 0 ? preflopOrder.indexOf(villainPos) : 8;
        return heroIndex < villainIndex ? 'H' : 'V';
    };

    const getFirstActorPostflop = (): 'H' | 'V' => {
        // Postflop order: SB → BB → UTG → ... → BTN (OOP acts first)
        const postflopOrder = ['SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'HJ', 'CO', 'BTN'];

        if (tableFormat === 'HU') {
            // HU: BB acts first postflop (BB is OOP)
            const heroPos = heroPosition || 'BTN';
            const villainPos = villainPosition || 'BB';
            const huOrder = ['BB', 'BTN', 'SB']; // BB acts first postflop
            const heroIndex = huOrder.indexOf(heroPos) >= 0 ? huOrder.indexOf(heroPos) : 1;
            const villainIndex = huOrder.indexOf(villainPos) >= 0 ? huOrder.indexOf(villainPos) : 0;
            return heroIndex < villainIndex ? 'H' : 'V';
        }

        const heroPos = heroPosition || 'BTN';
        const villainPos = villainPosition || 'BB';
        const heroIndex = postflopOrder.indexOf(heroPos) >= 0 ? postflopOrder.indexOf(heroPos) : 8;
        const villainIndex = postflopOrder.indexOf(villainPos) >= 0 ? postflopOrder.indexOf(villainPos) : 1;
        return heroIndex < villainIndex ? 'H' : 'V';
    };

    // Determine next player based on last action (for auto-alternation)
    const getNextPlayer = (): 'H' | 'V' => {
        if (actions.length === 0) {
            // First action - use position-based logic
            return street === 'preflop' ? getFirstActorPreflop() : getFirstActorPostflop();
        }
        return lastAction?.player === 'H' ? 'V' : 'H';
    };

    // ═════════════════════════════════════════════════════════════════════════
    // CONTEXT-AWARE ACTION OPTIONS
    // ═════════════════════════════════════════════════════════════════════════
    const getContextAwareOptions = (): { label: string; value: string; amount?: number }[] => {
        if (street === 'preflop') {
            const raises = actions.filter(a =>
                a.action === 'raise' || a.action === '3bet' || a.action === '4bet'
            );
            const limps = actions.filter(a => a.action === 'limp');
            const raiseCount = raises.length;
            const hasLimps = limps.length > 0;

            // Determine if pending player is BB
            const isBB = (pendingPlayer === 'H' && heroPosition === 'BB') ||
                (pendingPlayer === 'V' && villainPosition === 'BB');

            // No raises - different options based on BB or not
            if (raiseCount === 0) {
                // BB facing limps - can CHECK (closes action) or RAISE
                if (isBB && hasLimps) {
                    return [
                        { label: 'Check', value: 'check' }, // Closes action!
                        { label: 'Raise 3bb', value: 'raise_3', amount: 3 },
                        { label: 'Raise 4bb', value: 'raise_4', amount: 4 },
                        { label: 'Raise 5bb', value: 'raise_5', amount: 5 },
                        { label: 'Raise 6bb', value: 'raise_6', amount: 6 },
                    ];
                }
                // Non-BB or first action - standard open options
                return [
                    { label: 'Fold', value: 'fold' },
                    { label: 'Limp', value: 'limp', amount: 1 },
                    { label: 'Raise 2bb', value: 'raise_2', amount: 2 },
                    { label: 'Raise 2.5bb', value: 'raise_2.5', amount: 2.5 },
                    { label: 'Raise 3bb', value: 'raise_3', amount: 3 },
                    { label: 'Raise 4bb', value: 'raise_4', amount: 4 },
                ];
            }
            // After open (1 raise) - call or 3bet presets
            else if (raiseCount === 1) {
                const openAmount = raises[0]?.amount || 2.5;
                return [
                    { label: 'Fold', value: 'fold' },
                    { label: `Call ${openAmount}bb`, value: 'call', amount: openAmount },
                    { label: '3bet 7bb', value: '3bet_7', amount: 7 },
                    { label: '3bet 9bb', value: '3bet_9', amount: 9 },
                    { label: '3bet 10bb', value: '3bet_10', amount: 10 },
                    { label: '3bet 12bb', value: '3bet_12', amount: 12 },
                ];
            }
            // After 3bet (2 raises) - call or 4bet presets
            else if (raiseCount === 2) {
                const threeBetAmount = raises[1]?.amount || 9;
                return [
                    { label: 'Fold', value: 'fold' },
                    { label: `Call ${threeBetAmount}bb`, value: 'call', amount: threeBetAmount },
                    { label: '4bet 20bb', value: '4bet_20', amount: 20 },
                    { label: '4bet 22bb', value: '4bet_22', amount: 22 },
                    { label: '4bet 25bb', value: '4bet_25', amount: 25 },
                ];
            }
            // After 4bet - just call or fold
            else {
                const fourBetAmount = raises[2]?.amount || 22;
                return [
                    { label: 'Fold', value: 'fold' },
                    { label: `Call ${fourBetAmount}bb`, value: 'call', amount: fourBetAmount },
                ];
            }
        }

        // Postflop - pot-based bet sizing
        const bets = actions.filter(a => a.action === 'bet' || a.action === 'raise');
        const currentPot = pot || 10; // Default pot if not provided

        // No bet yet - show check, fold, and pot-based bet options
        if (bets.length === 0) {
            const bet33 = Math.round(currentPot * 0.33 * 10) / 10;
            const bet50 = Math.round(currentPot * 0.5 * 10) / 10;
            const bet75 = Math.round(currentPot * 0.75 * 10) / 10;
            const betPot = Math.round(currentPot * 10) / 10;
            return [
                { label: 'Check', value: 'check' },
                { label: 'Fold', value: 'fold' },
                { label: `Bet 33% (${bet33}bb)`, value: 'bet_33', amount: bet33 },
                { label: `Bet 50% (${bet50}bb)`, value: 'bet_50', amount: bet50 },
                { label: `Bet 75% (${bet75}bb)`, value: 'bet_75', amount: bet75 },
                { label: `Bet Pot (${betPot}bb)`, value: 'bet_100', amount: betPot },
            ];
        }
        // Facing a bet - show fold, call, and raise options
        else {
            const lastBet = bets[bets.length - 1];
            const facingAmount = lastBet?.amount || 5;
            const raise2x = Math.round(facingAmount * 2 * 10) / 10;
            const raise3x = Math.round(facingAmount * 3 * 10) / 10;
            const raise4x = Math.round(facingAmount * 4 * 10) / 10;
            return [
                { label: 'Fold', value: 'fold' },
                { label: `Call (${facingAmount}bb)`, value: 'call', amount: facingAmount },
                { label: `Raise 2x (${raise2x}bb)`, value: 'raise_2x', amount: raise2x },
                { label: `Raise 3x (${raise3x}bb)`, value: 'raise_3x', amount: raise3x },
                { label: `Raise 4x (${raise4x}bb)`, value: 'raise_4x', amount: raise4x },
            ];
        }
    };

    const handleAddAction = (optionValue: string, optionAmount?: number) => {
        let actionType = optionValue;
        let amount = optionAmount;

        // Parse action type from value
        // Preflop raises - but not 'custom' which uses passed amount
        if (optionValue === 'raise_custom') {
            actionType = 'raise';
            // amount is already passed from optionAmount
        } else if (optionValue.startsWith('raise_') && !optionValue.includes('x') && !optionValue.includes('custom')) {
            actionType = 'raise';
            amount = parseFloat(optionValue.replace('raise_', ''));
        } else if (optionValue.startsWith('3bet_')) {
            actionType = '3bet';
            amount = parseFloat(optionValue.replace('3bet_', ''));
        } else if (optionValue.startsWith('4bet_')) {
            actionType = '4bet';
            amount = parseFloat(optionValue.replace('4bet_', ''));
        } else if (optionValue === 'limp') {
            actionType = 'limp';
            amount = 1;
        }
        // Postflop bets (pot-based or custom)
        else if (optionValue === 'bet_custom' || optionValue.startsWith('bet_')) {
            actionType = 'bet';
            // amount is already passed from optionAmount
        }
        // Postflop raises (multiplier-based)
        else if (optionValue.startsWith('raise_') && optionValue.includes('x')) {
            actionType = 'raise';
            // amount is already passed from option
        }

        const player = pendingPlayer!;
        setActions([...actions, { player, action: actionType as any, amount }]);

        // Smart auto-advance
        if (actionType === 'call' || actionType === 'fold') {
            setIsAdding(false);
            setPendingPlayer(null);
        } else if (actionType === 'check') {
            setPendingPlayer(player === 'H' ? 'V' : 'H');
        } else {
            setPendingPlayer(player === 'H' ? 'V' : 'H');
        }
    };

    // Edit from a specific action - removes that action and all after, opens edit mode
    const editFromAction = (index: number) => {
        const actionToEdit = actions[index];
        // Remove this action and all subsequent ones
        setActions(actions.slice(0, index));
        // Open edit mode for this player
        setIsAdding(true);
        setPendingPlayer(actionToEdit.player);
        setCustomAmount('');
    };

    const startAdding = () => {
        setIsAdding(true);
        // Auto-set player based on position (no need to choose!)
        setPendingPlayer(getNextPlayer());
        setCustomAmount('');
    };

    const cancelAdding = () => {
        setIsAdding(false);
        setPendingPlayer(null);
        setCustomAmount('');
    };

    const contextOptions = getContextAwareOptions();

    // Handle custom amount submission
    const handleCustomAmount = () => {
        if (!customAmount || parseFloat(customAmount) <= 0) return;
        const amount = parseFloat(customAmount);

        if (street === 'preflop') {
            // Preflop custom = raise with that amount
            handleAddAction('raise_custom', amount);
        } else {
            // Postflop: depends on mode
            if (postflopMode === '%') {
                // Convert % to bb
                const bbAmount = Math.round((pot || 10) * (amount / 100) * 10) / 10;
                handleAddAction('bet_custom', bbAmount);
            } else {
                handleAddAction('bet_custom', amount);
            }
        }
        setCustomAmount('');
    };

    return (
        <div className="inline-action-builder-v2">
            {/* Action flow - horizontal scroll */}
            <div className="action-flow-container">
                {/* Existing actions as chips - click to edit from that point */}
                {actions.map((action, i) => (
                    <ActionChip
                        key={i}
                        action={action}
                        onRemove={() => editFromAction(i)}
                        showArrow={i < actions.length - 1}
                        isLast={i === actions.length - 1 && isEnded}
                    />
                ))}

                {/* Add action flow */}
                {!isEnded && (
                    <>
                        {!isAdding ? (
                            <button
                                className="add-action-btn"
                                onClick={startAdding}
                            >
                                {actions.length === 0 ? '?' : '+'}
                            </button>
                        ) : pendingPlayer && (
                            /* Player already determined - show context-aware action options */
                            <div className="action-selector">
                                <span className={`selected-player ${pendingPlayer === 'H' ? 'hero' : 'villain'}`}>
                                    {pendingPlayer}:
                                </span>

                                {/* Postflop: Toggle between % and bb mode */}
                                {street !== 'preflop' && (
                                    <button
                                        className="mode-toggle"
                                        onClick={() => setPostflopMode(postflopMode === '%' ? 'bb' : '%')}
                                    >
                                        {postflopMode === '%' ? '% pot' : 'bb'}
                                    </button>
                                )}

                                <div className="action-options">
                                    {contextOptions.map(opt => (
                                        <button
                                            key={opt.value}
                                            className="action-option"
                                            onClick={() => handleAddAction(opt.value, opt.amount)}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}

                                    {/* Custom amount input */}
                                    <div className="custom-amount-wrapper">
                                        <input
                                            type="number"
                                            className="custom-amount-input"
                                            placeholder={street === 'preflop' ? 'bb' : (postflopMode === '%' ? '%' : 'bb')}
                                            value={customAmount}
                                            onChange={(e) => setCustomAmount(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleCustomAmount()}
                                        />
                                        <button
                                            className="custom-amount-btn"
                                            onClick={handleCustomAmount}
                                        >
                                            ✓
                                        </button>
                                    </div>
                                </div>
                                <button className="cancel-btn" onClick={cancelAdding}>✕</button>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

interface MobileHandBuilderProps {
    tableFormat: string;
    setTableFormat: (v: string) => void;
    heroPosition: string;
    setHeroPosition: (v: string) => void;
    villainPosition: string;
    setVillainPosition: (v: string) => void;
    actionType: string;
    setActionType: (v: string) => void;
    effectiveStack: string;
    setEffectiveStack: (v: string) => void;
    heroCard1: string;
    setHeroCard1: (v: string) => void;
    heroCard2: string;
    setHeroCard2: (v: string) => void;
    flop1: string;
    setFlop1: (v: string) => void;
    flop2: string;
    setFlop2: (v: string) => void;
    flop3: string;
    setFlop3: (v: string) => void;
    turn: string;
    setTurn: (v: string) => void;
    river: string;
    setRiver: (v: string) => void;
    preflopActions: PreflopAction[];
    setPreflopActions: (actions: PreflopAction[]) => void;
    flopActions: PostflopAction[];
    setFlopActions: (actions: PostflopAction[]) => void;
    turnActions: PostflopAction[];
    setTurnActions: (actions: PostflopAction[]) => void;
    riverActions: PostflopAction[];
    setRiverActions: (actions: PostflopAction[]) => void;
    onAnalyze: () => void;
    isLoading: boolean;
}

export default function MobileHandBuilder({
    tableFormat, setTableFormat,
    heroPosition, setHeroPosition,
    villainPosition, setVillainPosition,
    effectiveStack, setEffectiveStack,
    heroCard1, setHeroCard1,
    heroCard2, setHeroCard2,
    flop1, setFlop1,
    flop2, setFlop2,
    flop3, setFlop3,
    turn, setTurn,
    river, setRiver,
    preflopActions, setPreflopActions,
    flopActions, setFlopActions,
    turnActions, setTurnActions,
    riverActions, setRiverActions,
    onAnalyze, isLoading
}: MobileHandBuilderProps) {

    const [showCardPicker, setShowCardPicker] = useState<string | null>(null);

    const positions = TABLE_FORMATS[tableFormat as keyof typeof TABLE_FORMATS]?.positions || TABLE_FORMATS['6max'].positions;

    // Parse card
    const parseCard = (card: string) => {
        if (!card || card.length < 2) return { rank: '', suit: '' };
        return { rank: card.slice(0, -1), suit: card.slice(-1) };
    };

    // Get suit color
    const getSuitColor = (suit: string) => {
        return suit === '♥' || suit === '♦' ? '#ef4444' : '#e5e7eb';
    };

    // Pot calculation
    const calculatePot = (): number => {
        let pot = 1.5;
        preflopActions.forEach(a => { if (a.amount) pot += a.amount; });
        flopActions.forEach(a => { if (a.amount) pot += a.amount; });
        turnActions.forEach(a => { if (a.amount) pot += a.amount; });
        riverActions.forEach(a => { if (a.amount) pot += a.amount; });
        return pot;
    };

    // Premium Card Display Component
    const CardDisplay = ({
        card,
        cardKey,
        size = 'normal'
    }: {
        card: string;
        cardKey: string;
        size?: 'normal' | 'small';
    }) => {
        const parsed = parseCard(card);
        const isSmall = size === 'small';

        return (
            <button
                className={`premium-card ${isSmall ? 'small' : ''} ${card ? 'filled' : 'empty'}`}
                onClick={() => setShowCardPicker(cardKey)}
            >
                {card ? (
                    <>
                        <span className="card-rank">{parsed.rank}</span>
                        <span className="card-suit" style={{ color: getSuitColor(parsed.suit) }}>{parsed.suit}</span>
                    </>
                ) : (
                    <span className="card-placeholder">?</span>
                )}
            </button>
        );
    };

    // Card Picker Modal
    const CardPicker = ({ cardKey, onSelect }: { cardKey: string; onSelect: (card: string) => void }) => (
        <div className="card-picker-overlay" onClick={() => setShowCardPicker(null)}>
            <div className="card-picker-modal" onClick={e => e.stopPropagation()}>
                <div className="picker-header">
                    <span>Select Card</span>
                    <button onClick={() => setShowCardPicker(null)}>✕</button>
                </div>
                <div className="picker-grid">
                    {RANKS.map(rank => (
                        <div key={rank} className="picker-row">
                            {SUITS.map(suit => (
                                <button
                                    key={`${rank}${suit.value}`}
                                    className="picker-card"
                                    onClick={() => {
                                        onSelect(`${rank}${suit.value}`);
                                        setShowCardPicker(null);
                                    }}
                                >
                                    <span>{rank}</span>
                                    <span style={{ color: suit.isRed ? '#ef4444' : '#ffffff' }}>{suit.value}</span>
                                </button>
                            ))}
                        </div>
                    ))}
                </div>
                <button className="picker-clear" onClick={() => { onSelect(''); setShowCardPicker(null); }}>
                    Clear
                </button>
            </div>
        </div>
    );


    // Handle card selection
    const handleCardSelect = (card: string) => {
        if (!showCardPicker) return;
        switch (showCardPicker) {
            case 'hero1': setHeroCard1(card); break;
            case 'hero2': setHeroCard2(card); break;
            case 'flop1': setFlop1(card); break;
            case 'flop2': setFlop2(card); break;
            case 'flop3': setFlop3(card); break;
            case 'turn': setTurn(card); break;
            case 'river': setRiver(card); break;
        }
    };

    return (
        <div className="premium-hand-builder">

            {/* ═══════════════════════════════════════════════════════════════════════
          SETUP BAR - Position, Stack, Format
          ═══════════════════════════════════════════════════════════════════════ */}
            <div className="setup-bar">
                <select
                    className="setup-select"
                    value={heroPosition}
                    onChange={(e) => setHeroPosition(e.target.value)}
                >
                    <option value="">Position</option>
                    {positions.map(p => <option key={p} value={p}>{p}</option>)}
                </select>

                <div className="setup-divider">•</div>

                <div className="stack-input-wrap">
                    <input
                        type="number"
                        className="stack-input"
                        placeholder="100"
                        value={effectiveStack}
                        onChange={(e) => setEffectiveStack(e.target.value)}
                    />
                    <span className="stack-label">bb</span>
                </div>

                <div className="setup-divider">•</div>

                <select
                    className="setup-select"
                    value={tableFormat}
                    onChange={(e) => setTableFormat(e.target.value)}
                >
                    {Object.entries(TABLE_FORMATS).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                    ))}
                </select>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════════
          HERO ROW - Cards + Villain grouped together
          ═══════════════════════════════════════════════════════════════════════ */}
            <div className="hero-row">
                <div className="hero-group">
                    <div className="hero-cards">
                        <CardDisplay card={heroCard1} cardKey="hero1" />
                        <CardDisplay card={heroCard2} cardKey="hero2" />
                    </div>

                    <span className="hero-vs">vs</span>

                    <select
                        className="villain-select-inline"
                        value={villainPosition}
                        onChange={(e) => setVillainPosition(e.target.value)}
                    >
                        <option value="">Villain</option>
                        {positions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════════
          PREFLOP - Inline Action Builder
          ═══════════════════════════════════════════════════════════════════════ */}
            <div className="street-section preflop">
                <div className="street-header">
                    <span className="street-name">Preflop</span>
                    <span className="pot-badge">{calculatePot().toFixed(1)}bb</span>
                </div>
                <InlineActionBuilder
                    actions={preflopActions}
                    setActions={setPreflopActions}
                    street="preflop"
                    heroPosition={heroPosition}
                    villainPosition={villainPosition}
                    tableFormat={tableFormat}
                />
            </div>

            {/* ═══════════════════════════════════════════════════════════════════════
          FLOP - Community Cards + Actions
          ═══════════════════════════════════════════════════════════════════════ */}
            <div className="street-section flop">
                <div className="street-header">
                    <span className="street-name">Flop</span>
                </div>

                <div className="community-cards flop-cards">
                    <CardDisplay card={flop1} cardKey="flop1" size="small" />
                    <CardDisplay card={flop2} cardKey="flop2" size="small" />
                    <CardDisplay card={flop3} cardKey="flop3" size="small" />
                </div>

                {(flop1 && flop2 && flop3) && (
                    <InlineActionBuilder
                        actions={flopActions}
                        setActions={setFlopActions}
                        street="flop"
                        heroPosition={heroPosition}
                        villainPosition={villainPosition}
                        tableFormat={tableFormat}
                        pot={calculatePot()}
                    />
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════════════
          TURN
          ═══════════════════════════════════════════════════════════════════════ */}
            <div className="street-section turn">
                <div className="street-header">
                    <span className="street-name">Turn</span>
                </div>

                <div className="community-cards">
                    <CardDisplay card={turn} cardKey="turn" size="small" />
                </div>

                {turn && (
                    <InlineActionBuilder
                        actions={turnActions}
                        setActions={setTurnActions}
                        street="turn"
                        heroPosition={heroPosition}
                        villainPosition={villainPosition}
                        tableFormat={tableFormat}
                        pot={calculatePot()}
                    />
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════════════
          RIVER
          ═══════════════════════════════════════════════════════════════════════ */}
            <div className="street-section river">
                <div className="street-header">
                    <span className="street-name">River</span>
                </div>

                <div className="community-cards">
                    <CardDisplay card={river} cardKey="river" size="small" />
                </div>

                {river && (
                    <InlineActionBuilder
                        actions={riverActions}
                        setActions={setRiverActions}
                        street="river"
                        heroPosition={heroPosition}
                        villainPosition={villainPosition}
                        tableFormat={tableFormat}
                        pot={calculatePot()}
                    />
                )}
            </div>

            {/* ═══════════════════════════════════════════════════════════════════════
          ANALYZE BUTTON - Premium
          ═══════════════════════════════════════════════════════════════════════ */}
            <button
                className="analyze-button-premium"
                onClick={onAnalyze}
                disabled={isLoading || (!heroCard1 || !heroCard2)}
            >
                <span className="analyze-icon">✨</span>
                <span className="analyze-text">{isLoading ? 'Analyzing...' : 'Analyze Hand'}</span>
            </button>

            {/* Card Picker Modal */}
            {showCardPicker && (
                <CardPicker cardKey={showCardPicker} onSelect={handleCardSelect} />
            )}
        </div>
    );
}
