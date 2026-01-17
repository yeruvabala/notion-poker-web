'use client';

import { useState } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES AND CONSTANTS (Same as HomeClient)
// ═══════════════════════════════════════════════════════════════════════════════

const TABLE_FORMATS = {
    'HU': { label: 'Heads-Up', positions: ['BTN', 'BB'] },
    '6max': { label: '6-Max', positions: ['BTN', 'CO', 'HJ', 'UTG', 'SB', 'BB'] },
    '9max': { label: '9-Max', positions: ['BTN', 'CO', 'HJ', 'MP', 'UTG+2', 'UTG+1', 'UTG', 'SB', 'BB'] }
} as const;

const ACTION_TYPES = [
    { value: 'RFI', label: 'RFI (Opening)' },
    { value: 'facing_open', label: 'Facing Open' },
    { value: 'vs_3bet', label: 'Facing 3-Bet' },
    { value: 'vs_4bet', label: 'Facing 4-Bet' },
    { value: 'general', label: 'Auto-Detect' }
] as const;

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];
const SUITS = [
    { value: '♠', label: '♠', isRed: false },
    { value: '♥', label: '♥', isRed: true },
    { value: '♦', label: '♦', isRed: true },
    { value: '♣', label: '♣', isRed: false }
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

// ═══════════════════════════════════════════════════════════════════════════════
// PROPS INTERFACE
// ═══════════════════════════════════════════════════════════════════════════════

interface MobileHandBuilderProps {
    // Basic state
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

    // Hero Cards
    heroCard1: string;
    setHeroCard1: (v: string) => void;
    heroCard2: string;
    setHeroCard2: (v: string) => void;

    // Board Cards
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

    // Preflop Actions
    preflopActions: PreflopAction[];
    setPreflopActions: (actions: PreflopAction[]) => void;

    // Postflop Actions
    flopActions: PostflopAction[];
    setFlopActions: (actions: PostflopAction[]) => void;
    turnActions: PostflopAction[];
    setTurnActions: (actions: PostflopAction[]) => void;
    riverActions: PostflopAction[];
    setRiverActions: (actions: PostflopAction[]) => void;

    // Analyze
    onAnalyze: () => void;
    isLoading: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function MobileHandBuilder({
    tableFormat, setTableFormat,
    heroPosition, setHeroPosition,
    villainPosition, setVillainPosition,
    actionType, setActionType,
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

    // Local state for adding actions
    const [addingPreflop, setAddingPreflop] = useState(false);
    const [addingFlop, setAddingFlop] = useState(false);
    const [addingTurn, setAddingTurn] = useState(false);
    const [addingRiver, setAddingRiver] = useState(false);

    const positions = TABLE_FORMATS[tableFormat as keyof typeof TABLE_FORMATS]?.positions || TABLE_FORMATS['6max'].positions;

    // Helper to parse card into rank and suit
    const parseCard = (card: string) => {
        if (!card || card.length < 2) return { rank: '', suit: '' };
        return { rank: card.slice(0, -1), suit: card.slice(-1) };
    };

    // Card selector component
    const CardSelector = ({
        card,
        setCard,
        label
    }: {
        card: string;
        setCard: (v: string) => void;
        label: string;
    }) => {
        const parsed = parseCard(card);

        const handleRankChange = (rank: string) => {
            if (!rank) { setCard(''); return; }
            setCard(rank + (parsed.suit || '♠'));
        };

        const handleSuitChange = (suit: string) => {
            if (!suit || !parsed.rank) return;
            setCard(parsed.rank + suit);
        };

        const isRed = parsed.suit === '♥' || parsed.suit === '♦';

        return (
            <div className="mobile-card-box">
                <select
                    value={parsed.rank}
                    onChange={(e) => handleRankChange(e.target.value)}
                    className="mobile-rank-select"
                >
                    <option value="">?</option>
                    {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
                <select
                    value={parsed.suit}
                    onChange={(e) => handleSuitChange(e.target.value)}
                    className={`mobile-suit-select ${isRed ? 'red' : ''}`}
                >
                    <option value="">?</option>
                    {SUITS.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                    ))}
                </select>
            </div>
        );
    };

    // Calculate pot from actions
    const calculatePot = (): number => {
        let pot = 1.5; // SB + BB
        preflopActions.forEach(a => { if (a.amount) pot += a.amount; });
        flopActions.forEach(a => { if (a.amount) pot += a.amount; });
        turnActions.forEach(a => { if (a.amount) pot += a.amount; });
        riverActions.forEach(a => { if (a.amount) pot += a.amount; });
        return pot;
    };

    // Preflop action buttons
    const preflopActionOptions = [
        { value: 'limp', label: 'Limp' },
        { value: 'raise', label: 'Raise' },
        { value: 'call', label: 'Call' },
        { value: '3bet', label: '3-Bet' },
        { value: '4bet', label: '4-Bet' },
        { value: 'fold', label: 'Fold' }
    ];

    // Postflop action buttons
    const postflopActionOptions = [
        { value: 'check', label: 'Check' },
        { value: 'bet', label: 'Bet' },
        { value: 'call', label: 'Call' },
        { value: 'raise', label: 'Raise' },
        { value: 'fold', label: 'Fold' }
    ];

    // Add action helper
    const addPreflopAction = (player: 'H' | 'V', action: string, amount?: number) => {
        setPreflopActions([...preflopActions, { player, action: action as any, amount }]);
        setAddingPreflop(false);
    };

    const addPostflopAction = (
        street: 'flop' | 'turn' | 'river',
        player: 'H' | 'V',
        action: string,
        amount?: number
    ) => {
        const newAction = { player, action: action as any, amount };
        if (street === 'flop') {
            setFlopActions([...flopActions, newAction]);
            setAddingFlop(false);
        } else if (street === 'turn') {
            setTurnActions([...turnActions, newAction]);
            setAddingTurn(false);
        } else {
            setRiverActions([...riverActions, newAction]);
            setAddingRiver(false);
        }
    };

    // Action chips display
    const ActionChip = ({ action, onRemove }: { action: PreflopAction | PostflopAction; onRemove: () => void }) => (
        <div className={`mobile-action-chip ${action.player === 'H' ? 'hero' : 'villain'}`}>
            <span>{action.player === 'H' ? '🎯' : '👤'}</span>
            <span>{action.action}{action.amount ? ` ${action.amount}bb` : ''}</span>
            <button onClick={onRemove} className="mobile-chip-remove">×</button>
        </div>
    );

    return (
        <div className="mobile-hand-builder">
            {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 1: BASIC SETUP
          ═══════════════════════════════════════════════════════════════════════ */}
            <section className="mobile-section">
                <div className="mobile-section-header">
                    <span className="mobile-section-icon">⚙️</span>
                    <span className="mobile-section-title">Setup</span>
                </div>

                {/* Table Format */}
                <div className="mobile-row">
                    <label className="mobile-label">Table</label>
                    <select
                        className="mobile-select-inline"
                        value={tableFormat}
                        onChange={(e) => setTableFormat(e.target.value)}
                    >
                        {Object.entries(TABLE_FORMATS).map(([key, val]) => (
                            <option key={key} value={key}>{val.label}</option>
                        ))}
                    </select>
                </div>

                {/* Stack */}
                <div className="mobile-row">
                    <label className="mobile-label">Stack (bb)</label>
                    <input
                        type="number"
                        className="mobile-input-inline"
                        placeholder="100"
                        value={effectiveStack}
                        onChange={(e) => setEffectiveStack(e.target.value)}
                    />
                </div>

                {/* Hero Position */}
                <div className="mobile-row">
                    <label className="mobile-label">Hero</label>
                    <select
                        className="mobile-select-inline"
                        value={heroPosition}
                        onChange={(e) => setHeroPosition(e.target.value)}
                    >
                        <option value="">Auto</option>
                        {positions.map((pos) => (
                            <option key={pos} value={pos}>{pos}</option>
                        ))}
                    </select>
                </div>

                {/* Villain Position */}
                <div className="mobile-row">
                    <label className="mobile-label">Villain</label>
                    <select
                        className="mobile-select-inline"
                        value={villainPosition}
                        onChange={(e) => setVillainPosition(e.target.value)}
                    >
                        <option value="">Auto</option>
                        {positions.map((pos) => (
                            <option key={pos} value={pos}>{pos}</option>
                        ))}
                    </select>
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 2: HERO HAND
          ═══════════════════════════════════════════════════════════════════════ */}
            <section className="mobile-section">
                <div className="mobile-section-header">
                    <span className="mobile-section-icon">🎴</span>
                    <span className="mobile-section-title">Hero Hand</span>
                </div>

                <div className="mobile-cards-row">
                    <CardSelector card={heroCard1} setCard={setHeroCard1} label="Card 1" />
                    <CardSelector card={heroCard2} setCard={setHeroCard2} label="Card 2" />
                </div>
            </section>

            {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 3: PREFLOP ACTIONS
          ═══════════════════════════════════════════════════════════════════════ */}
            <section className="mobile-section">
                <div className="mobile-section-header">
                    <span className="mobile-section-icon">🃏</span>
                    <span className="mobile-section-title">Preflop</span>
                    <span className="mobile-pot-badge">{calculatePot().toFixed(1)}bb</span>
                </div>

                {/* Existing actions */}
                <div className="mobile-action-chips">
                    {preflopActions.map((action, i) => (
                        <ActionChip
                            key={i}
                            action={action}
                            onRemove={() => setPreflopActions(preflopActions.filter((_, idx) => idx !== i))}
                        />
                    ))}
                </div>

                {/* Add action buttons */}
                {!addingPreflop ? (
                    <div className="mobile-add-action-row">
                        <button
                            className="mobile-add-btn hero"
                            onClick={() => setAddingPreflop(true)}
                        >
                            + Hero Action
                        </button>
                        <button
                            className="mobile-add-btn villain"
                            onClick={() => setAddingPreflop(true)}
                        >
                            + Villain Action
                        </button>
                    </div>
                ) : (
                    <div className="mobile-action-picker">
                        <div className="mobile-action-picker-row">
                            {preflopActionOptions.map((opt) => (
                                <button
                                    key={opt.value}
                                    className="mobile-action-option"
                                    onClick={() => addPreflopAction('H', opt.value, opt.value === 'raise' ? 3 : undefined)}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <button
                            className="mobile-cancel-btn"
                            onClick={() => setAddingPreflop(false)}
                        >
                            Cancel
                        </button>
                    </div>
                )}
            </section>

            {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 4: BOARD - FLOP
          ═══════════════════════════════════════════════════════════════════════ */}
            <section className="mobile-section">
                <div className="mobile-section-header">
                    <span className="mobile-section-icon">🎲</span>
                    <span className="mobile-section-title">Flop</span>
                </div>

                <div className="mobile-cards-row three">
                    <CardSelector card={flop1} setCard={setFlop1} label="Flop 1" />
                    <CardSelector card={flop2} setCard={setFlop2} label="Flop 2" />
                    <CardSelector card={flop3} setCard={setFlop3} label="Flop 3" />
                </div>

                {/* Flop Actions */}
                {(flop1 && flop2 && flop3) && (
                    <>
                        <div className="mobile-action-chips">
                            {flopActions.map((action, i) => (
                                <ActionChip
                                    key={i}
                                    action={action}
                                    onRemove={() => setFlopActions(flopActions.filter((_, idx) => idx !== i))}
                                />
                            ))}
                        </div>

                        {!addingFlop ? (
                            <div className="mobile-add-action-row">
                                <button className="mobile-add-btn hero" onClick={() => setAddingFlop(true)}>
                                    + Hero
                                </button>
                                <button className="mobile-add-btn villain" onClick={() => setAddingFlop(true)}>
                                    + Villain
                                </button>
                            </div>
                        ) : (
                            <div className="mobile-action-picker">
                                <div className="mobile-action-picker-row">
                                    {postflopActionOptions.map((opt) => (
                                        <button
                                            key={opt.value}
                                            className="mobile-action-option"
                                            onClick={() => addPostflopAction('flop', 'H', opt.value)}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                <button className="mobile-cancel-btn" onClick={() => setAddingFlop(false)}>
                                    Cancel
                                </button>
                            </div>
                        )}
                    </>
                )}
            </section>

            {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 5: BOARD - TURN
          ═══════════════════════════════════════════════════════════════════════ */}
            <section className="mobile-section">
                <div className="mobile-section-header">
                    <span className="mobile-section-icon">🎯</span>
                    <span className="mobile-section-title">Turn</span>
                </div>

                <div className="mobile-cards-row single">
                    <CardSelector card={turn} setCard={setTurn} label="Turn" />
                </div>

                {/* Turn Actions */}
                {turn && (
                    <>
                        <div className="mobile-action-chips">
                            {turnActions.map((action, i) => (
                                <ActionChip
                                    key={i}
                                    action={action}
                                    onRemove={() => setTurnActions(turnActions.filter((_, idx) => idx !== i))}
                                />
                            ))}
                        </div>

                        {!addingTurn ? (
                            <div className="mobile-add-action-row">
                                <button className="mobile-add-btn hero" onClick={() => setAddingTurn(true)}>
                                    + Hero
                                </button>
                                <button className="mobile-add-btn villain" onClick={() => setAddingTurn(true)}>
                                    + Villain
                                </button>
                            </div>
                        ) : (
                            <div className="mobile-action-picker">
                                <div className="mobile-action-picker-row">
                                    {postflopActionOptions.map((opt) => (
                                        <button
                                            key={opt.value}
                                            className="mobile-action-option"
                                            onClick={() => addPostflopAction('turn', 'H', opt.value)}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                <button className="mobile-cancel-btn" onClick={() => setAddingTurn(false)}>
                                    Cancel
                                </button>
                            </div>
                        )}
                    </>
                )}
            </section>

            {/* ═══════════════════════════════════════════════════════════════════════
          SECTION 6: BOARD - RIVER
          ═══════════════════════════════════════════════════════════════════════ */}
            <section className="mobile-section">
                <div className="mobile-section-header">
                    <span className="mobile-section-icon">🌊</span>
                    <span className="mobile-section-title">River</span>
                </div>

                <div className="mobile-cards-row single">
                    <CardSelector card={river} setCard={setRiver} label="River" />
                </div>

                {/* River Actions */}
                {river && (
                    <>
                        <div className="mobile-action-chips">
                            {riverActions.map((action, i) => (
                                <ActionChip
                                    key={i}
                                    action={action}
                                    onRemove={() => setRiverActions(riverActions.filter((_, idx) => idx !== i))}
                                />
                            ))}
                        </div>

                        {!addingRiver ? (
                            <div className="mobile-add-action-row">
                                <button className="mobile-add-btn hero" onClick={() => setAddingRiver(true)}>
                                    + Hero
                                </button>
                                <button className="mobile-add-btn villain" onClick={() => setAddingRiver(true)}>
                                    + Villain
                                </button>
                            </div>
                        ) : (
                            <div className="mobile-action-picker">
                                <div className="mobile-action-picker-row">
                                    {postflopActionOptions.map((opt) => (
                                        <button
                                            key={opt.value}
                                            className="mobile-action-option"
                                            onClick={() => addPostflopAction('river', 'H', opt.value)}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                                <button className="mobile-cancel-btn" onClick={() => setAddingRiver(false)}>
                                    Cancel
                                </button>
                            </div>
                        )}
                    </>
                )}
            </section>

            {/* ═══════════════════════════════════════════════════════════════════════
          ANALYZE BUTTON
          ═══════════════════════════════════════════════════════════════════════ */}
            <button
                className="mobile-analyze-btn"
                onClick={onAnalyze}
                disabled={isLoading || (!heroCard1 || !heroCard2)}
            >
                {isLoading ? '✨ Analyzing...' : '✨ Analyze Hand'}
            </button>
        </div>
    );
}
