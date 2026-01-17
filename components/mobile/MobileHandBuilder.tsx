'use client';

import { useState } from 'react';

// Reuse types from HomeClient
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

interface MobileHandBuilderProps {
    // Pass down state and handlers from parent
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
    onAnalyze: () => void;
    isLoading: boolean;
}

export default function MobileHandBuilder({
    tableFormat,
    setTableFormat,
    heroPosition,
    setHeroPosition,
    villainPosition,
    setVillainPosition,
    actionType,
    setActionType,
    effectiveStack,
    setEffectiveStack,
    heroCard1,
    setHeroCard1,
    heroCard2,
    setHeroCard2,
    onAnalyze,
    isLoading
}: MobileHandBuilderProps) {

    // Helper to get available positions based on table format
    const positions = TABLE_FORMATS[tableFormat as keyof typeof TABLE_FORMATS]?.positions || TABLE_FORMATS['6max'].positions;

    // Helper to parse card into rank and suit
    const parseCard = (card: string) => {
        if (!card || card.length < 2) return { rank: '', suit: '' };
        return { rank: card.slice(0, -1), suit: card.slice(-1) };
    };

    const card1 = parseCard(heroCard1);
    const card2 = parseCard(heroCard2);

    // Helper to set card
    const setCard = (cardNum: 1 | 2, rank: string, suit: string) => {
        const setter = cardNum === 1 ? setHeroCard1 : setHeroCard2;
        if (rank && suit) {
            setter(rank + suit);
        } else if (rank) {
            setter(rank + '♠'); // Default to spade
        } else {
            setter('');
        }
    };

    return (
        <div className="mobile-card">
            {/* Header */}
            <div className="mobile-card-header">
                <span className="mobile-card-icon">✍️</span>
                <h2 className="mobile-card-title">Hand Builder</h2>
            </div>

            {/* Table Format */}
            <div className="mobile-input-group">
                <label className="mobile-input-label">Table Format</label>
                <select
                    className="mobile-select"
                    value={tableFormat}
                    onChange={(e) => setTableFormat(e.target.value)}
                >
                    {Object.entries(TABLE_FORMATS).map(([key, val]) => (
                        <option key={key} value={key}>{val.label}</option>
                    ))}
                </select>
            </div>

            {/* Hero Position */}
            <div className="mobile-input-group">
                <label className="mobile-input-label">Hero Position</label>
                <select
                    className="mobile-select"
                    value={heroPosition}
                    onChange={(e) => setHeroPosition(e.target.value)}
                >
                    <option value="">Auto-detect</option>
                    {positions.map((pos) => (
                        <option key={pos} value={pos}>{pos}</option>
                    ))}
                </select>
            </div>

            {/* Action Type */}
            <div className="mobile-input-group">
                <label className="mobile-input-label">Action Type</label>
                <select
                    className="mobile-select"
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value)}
                >
                    {ACTION_TYPES.map((at) => (
                        <option key={at.value} value={at.value}>{at.label}</option>
                    ))}
                </select>
            </div>

            {/* Effective Stack */}
            <div className="mobile-input-group">
                <label className="mobile-input-label">Effective Stack (bb)</label>
                <input
                    type="number"
                    className="mobile-input"
                    placeholder="100"
                    value={effectiveStack}
                    onChange={(e) => setEffectiveStack(e.target.value)}
                />
            </div>

            {/* Hero Hand */}
            <div className="mobile-input-group">
                <label className="mobile-input-label">Hero Hand</label>
                <div className="mobile-grid-2">
                    {/* Card 1 */}
                    <div className="mobile-card-selector">
                        <select
                            value={card1.rank}
                            onChange={(e) => setCard(1, e.target.value, card1.suit || '♠')}
                            style={{ width: '40px' }}
                        >
                            <option value="">?</option>
                            {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <select
                            value={card1.suit}
                            onChange={(e) => setCard(1, card1.rank, e.target.value)}
                            style={{
                                width: '40px',
                                color: card1.suit === '♥' || card1.suit === '♦' ? '#ef4444' : '#e5e7eb'
                            }}
                        >
                            <option value="">?</option>
                            {SUITS.map(s => (
                                <option key={s.value} value={s.value} style={{ color: s.isRed ? '#ef4444' : '#e5e7eb' }}>
                                    {s.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Card 2 */}
                    <div className="mobile-card-selector">
                        <select
                            value={card2.rank}
                            onChange={(e) => setCard(2, e.target.value, card2.suit || '♠')}
                            style={{ width: '40px' }}
                        >
                            <option value="">?</option>
                            {RANKS.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <select
                            value={card2.suit}
                            onChange={(e) => setCard(2, card2.rank, e.target.value)}
                            style={{
                                width: '40px',
                                color: card2.suit === '♥' || card2.suit === '♦' ? '#ef4444' : '#e5e7eb'
                            }}
                        >
                            <option value="">?</option>
                            {SUITS.map(s => (
                                <option key={s.value} value={s.value} style={{ color: s.isRed ? '#ef4444' : '#e5e7eb' }}>
                                    {s.label}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Villain Position (Optional) */}
            <div className="mobile-input-group">
                <label className="mobile-input-label">Villain Position (Optional)</label>
                <select
                    className="mobile-select"
                    value={villainPosition}
                    onChange={(e) => setVillainPosition(e.target.value)}
                >
                    <option value="">Auto-detect</option>
                    {positions.map((pos) => (
                        <option key={pos} value={pos}>{pos}</option>
                    ))}
                </select>
            </div>

            {/* Analyze Button */}
            <button
                className="mobile-button"
                onClick={onAnalyze}
                disabled={isLoading}
            >
                {isLoading ? '✨ Analyzing...' : '✨ Analyze Hand'}
            </button>
        </div>
    );
}
