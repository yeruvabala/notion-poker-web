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

    // Action Pill Component
    const ActionPill = ({
        action,
        onRemove
    }: {
        action: PreflopAction | PostflopAction;
        onRemove: () => void;
    }) => (
        <div className={`action-pill ${action.player === 'H' ? 'hero' : 'villain'}`}>
            <span className="action-icon">{action.player === 'H' ? '🎯' : '👤'}</span>
            <span className="action-text">
                {action.action.toUpperCase()}
                {action.amount ? ` ${action.amount}bb` : ''}
            </span>
            <button className="action-remove" onClick={onRemove}>×</button>
        </div>
    );

    // Quick Action Buttons
    const ActionButtons = ({
        street,
        actions,
        addAction
    }: {
        street: 'preflop' | 'flop' | 'turn' | 'river';
        actions: string[];
        addAction: (player: 'H' | 'V', action: string) => void;
    }) => (
        <div className="action-buttons-row">
            <div className="action-group hero-actions">
                {actions.map(act => (
                    <button key={`h-${act}`} className="quick-action hero" onClick={() => addAction('H', act)}>
                        {act}
                    </button>
                ))}
            </div>
            <div className="action-divider">vs</div>
            <div className="action-group villain-actions">
                {actions.map(act => (
                    <button key={`v-${act}`} className="quick-action villain" onClick={() => addAction('V', act)}>
                        {act}
                    </button>
                ))}
            </div>
        </div>
    );

    const preflopActionOptions = ['Raise', 'Call', '3bet', '4bet', 'Fold'];
    const postflopActionOptions = ['Check', 'Bet', 'Call', 'Raise', 'Fold'];

    const addPreflopAction = (player: 'H' | 'V', action: string) => {
        const amount = action.toLowerCase().includes('raise') || action.toLowerCase().includes('bet') ? 3 : undefined;
        setPreflopActions([...preflopActions, { player, action: action.toLowerCase() as any, amount }]);
    };

    const addPostflopAction = (street: 'flop' | 'turn' | 'river', player: 'H' | 'V', action: string) => {
        const amount = action.toLowerCase().includes('bet') || action.toLowerCase().includes('raise') ? 5 : undefined;
        const newAction = { player, action: action.toLowerCase() as any, amount };
        if (street === 'flop') setFlopActions([...flopActions, newAction]);
        else if (street === 'turn') setTurnActions([...turnActions, newAction]);
        else setRiverActions([...riverActions, newAction]);
    };

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
          HERO HAND - The Star of the Show
          ═══════════════════════════════════════════════════════════════════════ */}
            <div className="hero-section">
                <div className="hero-cards">
                    <CardDisplay card={heroCard1} cardKey="hero1" />
                    <CardDisplay card={heroCard2} cardKey="hero2" />
                </div>

                {/* Matchup Indicator */}
                <div className="matchup-row">
                    <span className="matchup-vs">vs</span>
                    <select
                        className="villain-select"
                        value={villainPosition}
                        onChange={(e) => setVillainPosition(e.target.value)}
                    >
                        <option value="">Villain</option>
                        {positions.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════════════════
          PREFLOP ACTIONS - Interactive Timeline
          ═══════════════════════════════════════════════════════════════════════ */}
            <div className="street-section preflop">
                <div className="street-header">
                    <span className="street-name">Preflop</span>
                    <span className="pot-badge">{calculatePot().toFixed(1)}bb</span>
                </div>

                {/* Action Pills */}
                {preflopActions.length > 0 && (
                    <div className="action-timeline">
                        {preflopActions.map((action, i) => (
                            <ActionPill
                                key={i}
                                action={action}
                                onRemove={() => setPreflopActions(preflopActions.filter((_, idx) => idx !== i))}
                            />
                        ))}
                    </div>
                )}

                {/* Quick Add */}
                <ActionButtons
                    street="preflop"
                    actions={preflopActionOptions}
                    addAction={addPreflopAction}
                />
            </div>

            {/* ═══════════════════════════════════════════════════════════════════════
          FLOP - Community Cards
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
                    <>
                        {flopActions.length > 0 && (
                            <div className="action-timeline">
                                {flopActions.map((action, i) => (
                                    <ActionPill
                                        key={i}
                                        action={action}
                                        onRemove={() => setFlopActions(flopActions.filter((_, idx) => idx !== i))}
                                    />
                                ))}
                            </div>
                        )}
                        <ActionButtons
                            street="flop"
                            actions={postflopActionOptions}
                            addAction={(p, a) => addPostflopAction('flop', p, a)}
                        />
                    </>
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
                    <>
                        {turnActions.length > 0 && (
                            <div className="action-timeline">
                                {turnActions.map((action, i) => (
                                    <ActionPill
                                        key={i}
                                        action={action}
                                        onRemove={() => setTurnActions(turnActions.filter((_, idx) => idx !== i))}
                                    />
                                ))}
                            </div>
                        )}
                        <ActionButtons
                            street="turn"
                            actions={postflopActionOptions}
                            addAction={(p, a) => addPostflopAction('turn', p, a)}
                        />
                    </>
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
                    <>
                        {riverActions.length > 0 && (
                            <div className="action-timeline">
                                {riverActions.map((action, i) => (
                                    <ActionPill
                                        key={i}
                                        action={action}
                                        onRemove={() => setRiverActions(riverActions.filter((_, idx) => idx !== i))}
                                    />
                                ))}
                            </div>
                        )}
                        <ActionButtons
                            street="river"
                            actions={postflopActionOptions}
                            addAction={(p, a) => addPostflopAction('river', p, a)}
                        />
                    </>
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
