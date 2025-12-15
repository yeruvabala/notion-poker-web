// components/HandReplayer.tsx
'use client';

import React, { useState, useEffect } from 'react';
import "@/styles/onlypoker-theme.css";
import "@/app/globals.css";

// ============ INTERFACES ============

export interface Player {
    name: string;
    seatIndex: number;
    isHero: boolean;
    cards: string[] | null;
    isActive: boolean;
    stack?: number; // Stack size in BB
}

// Action from the parsed hand history
export interface Action {
    player: string;
    action: 'posts_sb' | 'posts_bb' | 'fold' | 'folds' | 'check' | 'checks' | 'call' | 'calls' | 'bet' | 'bets' | 'raise' | 'raiseTo' | 'all-in';
    amount?: number | null;
    street: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
}

export interface HandHistory {
    players: Player[];
    board: string[];
    pot: number;
    street: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
    sb?: number;
    bb?: number;
    dealerSeat?: number; // Seat index of the dealer
    actions?: Action[]; // Chronological list of actions
}

// ============ MOCK DATA (fallback) ============

const MOCK_HAND: HandHistory = {
    players: [
        { name: 'Hero', seatIndex: 0, isHero: true, cards: ['A♠', 'K♥'], isActive: true, stack: 100 },
        { name: 'Villain', seatIndex: 1, isHero: false, cards: ['Q♣', 'J♦'], isActive: true, stack: 87.5 },
        { name: 'Player_3', seatIndex: 2, isHero: false, cards: null, isActive: false, stack: 52.3 },
        { name: 'Player_4', seatIndex: 3, isHero: false, cards: null, isActive: false, stack: 100 },
        { name: 'Player_5', seatIndex: 4, isHero: false, cards: null, isActive: false, stack: 45.8 },
        { name: 'Player_6', seatIndex: 5, isHero: false, cards: null, isActive: false, stack: 100 },
    ],
    board: ['T♠', '9♥', '8♦', '2♣', '5♠'],
    pot: 125,
    street: 'showdown',
    sb: 0.5,
    bb: 1,
    dealerSeat: 5, // Player_6 is the dealer
};

// ============ DYNAMIC SEAT POSITIONING (Equal spacing for 2-9 players) ============

/**
 * Calculate seat positions dynamically based on player count.
 * Uses ellipse math to distribute players evenly around the table.
 * Hero always at bottom center (starts at angle 90deg / bottom).
 */
function getSeatPosition(seatIndex: number, heroSeatIndex: number, totalPlayers: number) {
    // Adjust index so hero is always at position 0 (bottom center)
    const adjustedIndex = (seatIndex - heroSeatIndex + totalPlayers) % totalPlayers;

    // Ellipse parameters (percentages of container)
    const centerX = 50;
    const centerY = 43; // Above center to account for table perspective
    const radiusX = 42; // Horizontal radius
    const radiusY = 42; // Vertical radius - reduced to bring top player down closer to table

    // Calculate angle for this seat
    // Start from bottom (90deg) and go clockwise
    // Evenly distribute all players around the ellipse
    const startAngle = Math.PI / 2; // 90 degrees (bottom)
    const angleStep = (2 * Math.PI) / totalPlayers;
    const angle = startAngle + (adjustedIndex * angleStep);

    // Calculate position on ellipse
    const x = centerX + radiusX * Math.cos(angle);
    const y = centerY + radiusY * Math.sin(angle);

    return { x, y };
}

// ============ SUB-COMPONENTS ============

function CardBack() {
    return (
        <div className="replayer-card-back">
            <div className="replayer-card-pattern" />
        </div>
    );
}

// SVG Suit Icons - Guaranteed color rendering
function SuitIcon({ suit, size = 20 }: { suit: string; size?: number }) {
    const isRed = suit === '♥' || suit === '♦';
    const fillColor = isRed ? '#e53935' : '#1a1a1a';

    // Heart
    if (suit === '♥') {
        return (
            <svg width={size} height={size} viewBox="0 0 24 24" fill={fillColor}>
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
            </svg>
        );
    }

    // Diamond
    if (suit === '♦') {
        return (
            <svg width={size} height={size} viewBox="0 0 24 24" fill={fillColor}>
                <path d="M12 2L2 12l10 10 10-10L12 2z" />
            </svg>
        );
    }

    // Spade
    if (suit === '♠') {
        return (
            <svg width={size} height={size} viewBox="0 0 24 24" fill={fillColor}>
                <path d="M12 2C9 7 4 9 4 14c0 2.5 2.5 4.5 5 4.5.5 0 1-.1 1.5-.2C10 19.5 9 21 9 22h6c0-1-1-2.5-1.5-3.7.5.1 1 .2 1.5.2 2.5 0 5-2 5-4.5 0-5-5-7-8-12z" />
            </svg>
        );
    }

    // Club
    if (suit === '♣') {
        return (
            <svg width={size} height={size} viewBox="0 0 24 24" fill={fillColor}>
                <path d="M12 2c-2 0-4 2-4 4 0 1 .5 2 1 3-2 0-4 2-4 4s2 4 4 4c1 0 2-.5 3-1v6h-2v2h6v-2h-2v-6c1 .5 2 1 3 1 2 0 4-2 4-4s-2-4-4-4c.5-1 1-2 1-3 0-2-2-4-4-4z" />
            </svg>
        );
    }

    return null;
}

function Card({ value }: { value: string }) {
    const rank = value.slice(0, -1);
    const suit = value.slice(-1);
    const isRed = suit === '♥' || suit === '♦';

    // Match rank color to suit color
    const rankColor = isRed ? '#e53935' : '#2a2a2a';

    return (
        <div className="replayer-card">
            {/* SVG for rank text - guaranteed visibility */}
            <svg width="24" height="22" viewBox="0 0 24 22" style={{ position: 'relative', zIndex: 2 }}>
                <text
                    x="12"
                    y="17"
                    textAnchor="middle"
                    fill={rankColor}
                    fontSize="18"
                    fontWeight="900"
                    fontFamily="Arial, sans-serif"
                >
                    {rank}
                </text>
            </svg>
            <SuitIcon suit={suit} size={22} />
        </div>
    );
}

// Compact Player Seat - Just cards + stack (with counter-rotation for 3D pop-up)
function PlayerSeat({
    player,
    position,
    tablePosition,
    computedStack,
    currentBet,
    isFolded,
    isChecking
}: {
    player: Player;
    position: { x: number; y: number };
    tablePosition?: string | null;
    computedStack?: number;
    currentBet?: number;
    isFolded?: boolean;
    isChecking?: boolean;
}) {
    const displayStack = computedStack ?? player.stack ?? 100;
    const isActive = isFolded !== undefined ? !isFolded : player.isActive;

    return (
        <div
            className={`replayer-seat ${isActive ? 'active' : 'folded'} ${player.isHero ? 'hero' : ''} ${isChecking ? 'checking' : ''}`}
            style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
                /* Counter-rotate to stand up straight (matches 25deg scene tilt) */
                transform: 'translate(-50%, -50%) rotateX(-25deg)',
                transformStyle: 'preserve-3d',
                pointerEvents: 'auto',
            }}
        >
            {/* Position Badge (BTN, SB, BB, etc.) */}
            {tablePosition && (
                <div className={`replayer-position-badge replayer-position-${tablePosition.toLowerCase()}`}>
                    {tablePosition}
                </div>
            )}

            {/* Cards - Always show Hero's cards, show other players' cards if active */}
            <div className="replayer-cards">
                {player.cards && (player.isHero || isActive) ? (
                    player.cards.map((card, i) => <Card key={i} value={card} />)
                ) : (
                    <>
                        <CardBack />
                        <CardBack />
                    </>
                )}
            </div>

            {/* Hero Label */}
            {player.isHero && (
                <div className="replayer-hero-badge">HERO</div>
            )}

            {/* Stack Size */}
            <div className="replayer-stack">
                {displayStack === Infinity ? '???' : `${displayStack.toFixed(1)} BB`}
            </div>
        </div>
    );
}

// Bet Chip - Displays on table felt in front of player (amounts already in BB)
function BetChip({
    amount,
    position
}: {
    amount: number;
    position: { x: number; y: number };
}) {
    if (amount <= 0) return null;

    // Amount is already in BB from computeGameState - just display it
    return (
        <div
            className="replayer-bet-chip"
            style={{
                left: `${position.x}%`,
                top: `${position.y}%`,
                transform: 'translate(-50%, -50%)',
            }}
        >
            {amount.toFixed(2)}
        </div>
    );
}

// Stakes Display (above board)
function StakesDisplay({ sb, bb }: { sb: number; bb: number }) {
    return (
        <div className="replayer-stakes">
            ${sb}/${bb}
        </div>
    );
}

// Community board - shows face-down cards during preflop, then reveals progressively
function CommunityBoard({ cards, currentStreet }: { cards: string[]; currentStreet?: string }) {
    // During preflop, show 5 face-down card backs
    if (!currentStreet || currentStreet === 'preflop') {
        return (
            <div className="replayer-board">
                {[0, 1, 2, 3, 4].map((i) => (
                    <CardBack key={i} />
                ))}
            </div>
        );
    }

    // After preflop, show visible cards plus remaining face-down cards
    const visibleCount = cards.length;
    const hiddenCount = 5 - visibleCount;

    return (
        <div className="replayer-board">
            {cards.map((card, i) => (
                <Card key={i} value={card} />
            ))}
            {/* Show remaining face-down cards */}
            {Array.from({ length: hiddenCount }).map((_, i) => (
                <CardBack key={`hidden-${i}`} />
            ))}
        </div>
    );
}

function PotDisplay({ amount }: { amount: number }) {
    return (
        <div className="replayer-pot">
            <span className="replayer-pot-label">POT</span>
            <span className="replayer-pot-amount">{amount.toFixed(2)} BB</span>
        </div>
    );
}

// Dealer Button
function DealerButton({ position }: { position: { x: number; y: number } }) {
    // Offset the button slightly toward the center from the player
    const offsetX = position.x > 50 ? -8 : position.x < 50 ? 8 : 0;
    const offsetY = position.y > 50 ? -15 : position.y < 50 ? 15 : -10;

    return (
        <div
            className="replayer-dealer-btn"
            style={{
                left: `${position.x + offsetX}%`,
                top: `${position.y + offsetY}%`
            }}
        >
            D
        </div>
    );
}

// ============ MAIN COMPONENT ============

interface HandReplayerProps {
    hand?: HandHistory;
    handId?: string; // Optional: fetch from API if provided
}

export default function HandReplayer({ hand: providedHand, handId }: HandReplayerProps) {
    const [hand, setHand] = useState<HandHistory>(providedHand || MOCK_HAND);
    const [loading, setLoading] = useState(!!handId && !providedHand);
    const [error, setError] = useState<string | null>(null);

    // Playback state
    const [actionIndex, setActionIndex] = useState(-1); // -1 = initial state (before any action)
    const [isPlaying, setIsPlaying] = useState(false);

    // Fetch hand data from API if handId is provided
    useEffect(() => {
        if (!handId || providedHand) return;

        async function fetchHandData() {
            setLoading(true);
            setError(null);
            try {
                const response = await fetch(`/api/hands/${handId}/replayer`);
                const data = await response.json();

                if (data.success && data.replayerData) {
                    // Map API response to HandHistory interface
                    const replayerData = data.replayerData;
                    setHand({
                        players: replayerData.players || [],
                        board: replayerData.board || [],
                        pot: replayerData.pot || 0,
                        street: replayerData.street || 'preflop',
                        sb: replayerData.sb,
                        bb: replayerData.bb,
                        dealerSeat: replayerData.dealerSeat,
                        actions: replayerData.actions || [],
                    });
                    setActionIndex(-1); // Reset playback on new hand
                } else {
                    // Check if auth issue
                    const errorMsg = data.authStatus === 'not_logged_in'
                        ? 'Please log in to view hand data'
                        : (data.message || 'Failed to load hand data');
                    console.warn('HandReplayer API error:', data);
                    setError(errorMsg);
                    setHand(MOCK_HAND); // Fallback to mock
                }
            } catch (err) {
                console.error('Error fetching hand:', err);
                setError('Failed to fetch hand data');
                setHand(MOCK_HAND); // Fallback to mock
            } finally {
                setLoading(false);
            }
        }

        fetchHandData();
    }, [handId, providedHand]);

    // Auto-play timer
    useEffect(() => {
        if (!isPlaying || !hand.actions) return;

        const totalActions = hand.actions.length;
        if (actionIndex >= totalActions - 1) {
            setIsPlaying(false);
            return;
        }

        const timer = setTimeout(() => {
            setActionIndex(prev => Math.min(prev + 1, totalActions - 1));
        }, 2000); // 2 seconds between actions

        return () => clearTimeout(timer);
    }, [isPlaying, actionIndex, hand.actions]);

    // Compute current game state based on actionIndex
    const computeGameState = () => {
        if (!hand.actions || actionIndex < 0) {
            // Initial state - show starting stacks
            return {
                playerStacks: hand.players.reduce((acc, p) => {
                    // Use Infinity for unknown stacks logic
                    acc[p.name] = (p.stack !== undefined && p.stack !== null) ? p.stack : Infinity;
                    return acc;
                }, {} as Record<string, number>),
                playerBets: {} as Record<string, number>,
                pot: 0,
                currentStreet: 'preflop' as const,
                foldedPlayers: new Set<string>(),
                visibleBoard: [] as string[],
            };
        }

        // Process actions up to current index
        const playerStacks = hand.players.reduce((acc, p) => {
            acc[p.name] = (p.stack !== undefined && p.stack !== null) ? p.stack : Infinity;
            return acc;
        }, {} as Record<string, number>);

        const playerBets: Record<string, number> = {};
        let pot = 0;
        let currentStreet = 'preflop';

        // Initialize folded players from initial state (for implicit folds)
        // Initialize folded players:
        // Only mark players as folded if they are inactive AND have NO actions (implicit folds/skipped).
        // Players who act later (check/bet/fold) should start active.
        const playersWithActions = new Set(hand.actions.map(a => a.player));
        const foldedPlayers = new Set<string>();
        hand.players.forEach(p => {
            if (!p.isActive && !playersWithActions.has(p.name)) {
                foldedPlayers.add(p.name);
            }
        });

        for (let i = 0; i <= actionIndex; i++) {
            const action = hand.actions[i];
            // Convert action amount from dollars to BB
            const rawAmount = action.amount || 0;
            const amount = hand.bb && hand.bb > 0 ? rawAmount / hand.bb : rawAmount;

            // Track street changes
            if (action.street !== currentStreet) {
                // Street changed - add all bets to pot and reset
                Object.values(playerBets).forEach(bet => pot += bet);
                Object.keys(playerBets).forEach(k => playerBets[k] = 0);
                currentStreet = action.street;
            }

            // Process action
            switch (action.action) {
                case 'fold':
                case 'folds':  // Parser outputs 'folds' with 's'
                    foldedPlayers.add(action.player);
                    break;
                case 'posts_sb':
                case 'posts_bb':
                case 'call':
                case 'calls':
                case 'bet':
                case 'bets':
                case 'raise':
                case 'all-in':
                    if (amount > 0) {
                        playerStacks[action.player] = (playerStacks[action.player] || 0) - amount;
                        playerBets[action.player] = (playerBets[action.player] || 0) + amount;
                    }
                    break;
                case 'raiseTo':
                    if (amount > 0) {
                        const currentBet = playerBets[action.player] || 0;
                        // Calculate amount to ADD (delta)
                        // Verify amount is greater than current bet (it should be for a raise)
                        if (amount > currentBet) {
                            const delta = amount - currentBet;
                            playerStacks[action.player] = (playerStacks[action.player] || 0) - delta;
                            playerBets[action.player] = amount;
                        } else {
                            // If raise to amount is same or less (parsing weirdness?), fallback to ignoring or treating as correction?
                            // Just ensure we don't ADD stack. 
                            // For now, assume explicit raiseTo is accurate.
                            playerBets[action.player] = amount;
                        }
                    }
                    break;
            }
        }

        // Add current bets to running pot
        const currentPot = pot + Object.values(playerBets).reduce((a, b) => a + b, 0);

        // Determine visible board cards
        let visibleBoard: string[] = [];
        if (currentStreet === 'flop' && hand.board.length >= 3) {
            visibleBoard = hand.board.slice(0, 3);
        } else if (currentStreet === 'turn' && hand.board.length >= 4) {
            visibleBoard = hand.board.slice(0, 4);
        } else if ((currentStreet === 'river' || currentStreet === 'showdown') && hand.board.length >= 5) {
            visibleBoard = hand.board.slice(0, 5);
        }

        // Track last action for animation
        const lastAction = actionIndex >= 0 && hand.actions ? hand.actions[actionIndex] : null;

        return { playerStacks, playerBets, pot: currentPot, currentStreet, foldedPlayers, visibleBoard, lastAction };
    };

    const gameState = computeGameState();

    const heroSeat = hand.players.find(p => p.isHero)?.seatIndex ?? 0;
    const totalPlayers = hand.players.length;

    // Memoize the sorted player seat indices to create a dense logical index (0..N-1)
    const playerSeats = React.useMemo(() => {
        return [...hand.players].sort((a, b) => a.seatIndex - b.seatIndex).map(p => p.seatIndex);
    }, [hand.players]);

    // Loading state
    if (loading) {
        return (
            <div className="replayer-container">
                <div className="relative w-full min-h-[800px] flex flex-col justify-center items-center" style={{ backgroundColor: '#1a1a1a' }}>
                    <div className="text-white text-xl">Loading hand...</div>
                </div>
            </div>
        );
    }

    // Error state (still shows table with fallback data)
    if (error) {
        console.warn('HandReplayer error:', error);
    }

    return (
        <div className="replayer-container">
            {/* Error Banner - shows when API failed */}
            {error && (
                <div style={{
                    background: '#dc2626',
                    color: 'white',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    marginBottom: '16px',
                    textAlign: 'center',
                    fontWeight: 600,
                }}>
                    ⚠️ {error} (showing mock data)
                </div>
            )}
            {/* ===== 1. THE MAIN CONTAINER (Add Breathing Room) ===== */}
            <div
                className="relative w-full min-h-[800px] flex flex-col justify-center items-center overflow-visible"
                style={{ backgroundColor: '#1a1a1a' }}
            >

                {/* ===== 2. THE 3D SCENE WRAPPER (The Anchor) ===== */}
                <div
                    style={{
                        position: 'relative',
                        width: '900px',
                        height: '450px',
                        perspective: '1000px',
                        /* Completely transparent - no visual boundary */
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                    }}
                >
                    {/* ===== 3. THE TABLE LAYER (Layer 1) ===== */}
                    <div
                        className="absolute inset-0 z-0 rounded-[225px] overflow-hidden"
                        style={{
                            transformStyle: 'preserve-3d',
                            transform: 'rotateX(25deg)',
                            /* Soft diffuse shadow - premium floating effect */
                            boxShadow: `
                                0 20px 0 #a0a0a0,
                                0 40px 60px -12px rgba(0,0,0,0.5),
                                0 25px 40px -5px rgba(0,0,0,0.3)
                            `,
                        }}
                    >
                        {/* The Metallic Rail - Soft Brushed Aluminum */}
                        <div
                            className="w-full h-full p-10"
                            style={{
                                /* Complex metallic gradient - curved tube appearance */
                                background: `linear-gradient(
                                    to bottom,
                                    #f5f5f5 0%,
                                    #e0e0e0 15%,
                                    #c8c8c8 30%,
                                    #a8a8a8 50%,
                                    #909090 70%,
                                    #787878 85%,
                                    #606060 100%
                                )`,
                                /* Specular highlight - white inner ring on top edge */
                                borderTop: '2px solid rgba(255, 255, 255, 0.6)',
                                /* Soft inner shadow for depth */
                                boxShadow: `
                                    inset 0 2px 4px rgba(255, 255, 255, 0.3),
                                    inset 0 -2px 6px rgba(0, 0, 0, 0.15)
                                `,
                            }}
                        >
                            {/* The Recessed Felt */}
                            <div
                                className="w-full h-full rounded-[200px] flex flex-col items-center justify-center gap-2"
                                style={{
                                    background: 'radial-gradient(50% 50% at 50% 50%, #3a3a3a 0%, #252525 60%, #0a0a0a 100%)',
                                    boxShadow: 'inset 0 10px 30px rgba(0,0,0,1)',
                                    borderTop: '2px solid rgba(100, 100, 100, 0.4)',
                                }}
                            >
                                {hand.sb && hand.bb && <StakesDisplay sb={hand.sb} bb={hand.bb} />}
                                <CommunityBoard cards={gameState.visibleBoard} currentStreet={gameState.currentStreet} />
                                <PotDisplay amount={gameState.pot} />

                                {/* Bet Chips - positioned in front of each player */}
                                {hand.players.map((player) => {
                                    const bet = gameState.playerBets[player.name] || 0;
                                    if (bet <= 0) return null;

                                    // Calculate bet position using LOGICAL index to match player
                                    const playerIdx = playerSeats.indexOf(player.seatIndex);
                                    const heroIdx = playerSeats.indexOf(heroSeat);
                                    const safeHeroIdx = heroIdx !== -1 ? heroIdx : 0;

                                    const seatPos = getSeatPosition(playerIdx, safeHeroIdx, totalPlayers);

                                    // Move 25% of the way from seat toward center (50, 50) - keeps bets closer to player
                                    const betPos = {
                                        x: seatPos.x + (50 - seatPos.x) * 0.25,
                                        y: seatPos.y + (50 - seatPos.y) * 0.25,
                                    };

                                    return (
                                        <BetChip
                                            key={`bet-${player.seatIndex}`}
                                            amount={bet}
                                            position={betPos}
                                        />
                                    );
                                })}
                            </div >
                        </div >
                    </div >

                    {/* ===== 4. THE CARD LAYER (Layer 2 - LARGER THAN TABLE) ===== */}
                    < div
                        className="absolute z-50 pointer-events-none"
                        style={{
                            top: '-100px',
                            bottom: '-100px',
                            left: '-100px',
                            right: '-100px',
                            width: 'calc(100% + 200px)',
                            height: 'calc(100% + 200px)',
                            transformStyle: 'preserve-3d',
                            transform: 'rotateX(25deg)',
                            overflow: 'visible',
                        }
                        }
                    >
                        <div className="replayer-betting-line" style={{ pointerEvents: 'auto' }} />

                        {
                            hand.players.map((player) => {
                                // Calculate position using LOGICAL index (rank) to avoid sparse index modulo collisions
                                // We use the outer memoized 'playerSeats' array which contains sorted seat indices

                                const playerIdx = playerSeats.indexOf(player.seatIndex);
                                const hero = hand.players.find(p => p.isHero);
                                const heroIdx = playerSeats.indexOf(hero?.seatIndex ?? -1);

                                // Fallback if hero not found
                                const safeHeroIdx = heroIdx !== -1 ? heroIdx : 0;

                                // Determine visual position using LOGICAL indices 0..N-1
                                const pos = getSeatPosition(playerIdx, safeHeroIdx, playerSeats.length);

                                // Determine label (BTN, SB, BB, etc)
                                let tablePosition: string | null = null;
                                const dealerSeat = hand.dealerSeat;
                                if (dealerSeat !== undefined) {
                                    const dealerIdx = playerSeats.indexOf(dealerSeat);
                                    if (dealerIdx !== -1) {
                                        const relativeLabelIdx = (playerIdx - dealerIdx + playerSeats.length) % playerSeats.length;

                                        const positionLabels: { [key: number]: string[] } = {
                                            2: ['BTN', 'BB'],
                                            3: ['BTN', 'SB', 'BB'],
                                            4: ['BTN', 'SB', 'BB', 'UTG'],
                                            5: ['BTN', 'SB', 'BB', 'UTG', 'CO'],
                                            6: ['BTN', 'SB', 'BB', 'UTG', 'HJ', 'CO'],
                                            7: ['BTN', 'SB', 'BB', 'UTG', 'LJ', 'HJ', 'CO'],
                                            8: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'LJ', 'HJ', 'CO'],
                                            9: ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'LJ', 'HJ', 'CO'],
                                        };
                                        const labels = positionLabels[playerSeats.length] || positionLabels[6];
                                        const lb = labels[relativeLabelIdx];

                                        const alwaysShow = ['BTN', 'SB', 'BB'];
                                        const hasVisibleCards = player.cards && player.cards.length > 0;
                                        if (lb && (alwaysShow.includes(lb) || hasVisibleCards)) {
                                            tablePosition = lb;
                                        }
                                    }
                                }

                                // Check if this player just checked
                                const isChecking = gameState.lastAction?.player === player.name &&
                                    (gameState.lastAction?.action === 'check' || gameState.lastAction?.action === 'checks');

                                // Determine active state for internal logic usage if needed, 
                                // but PlayerSeat component handles visual activation via isFolded prop or card presence?
                                // PlayerSeat definition: isActive = isFolded !== undefined ? !isFolded : player.isActive;
                                // So we just pass isFolded.

                                return (
                                    <PlayerSeat
                                        key={player.name}
                                        player={player}
                                        position={pos}
                                        tablePosition={tablePosition}
                                        computedStack={gameState.playerStacks[player.name]}
                                        currentBet={gameState.playerBets[player.name]}
                                        isFolded={gameState.foldedPlayers.has(player.name)}
                                        isChecking={isChecking}
                                    />
                                );
                            })
                        }
                    </div >
                </div >

                {/* ===== 5. THE CONTROLS (Below table, right of center) ===== */}
                {/* ===== 5. THE CONTROLS (Below table, right of center) ===== */}
                <div className="mt-12 ml-96 z-[100] flex gap-3 items-center">
                    <button
                        className="replayer-btn"
                        title="Previous"
                        onClick={() => {
                            setIsPlaying(false);
                            setActionIndex(prev => Math.max(-1, prev - 1));
                        }}
                        disabled={actionIndex <= -1}
                    >
                        <span>⏮</span>
                    </button>
                    <button
                        className="replayer-btn replayer-btn-play"
                        title={isPlaying ? "Pause" : "Play"}
                        onClick={() => {
                            if (!isPlaying && actionIndex >= (hand.actions?.length || 0) - 1) {
                                // Reset to start if at end
                                setActionIndex(-1);
                            }
                            setIsPlaying(!isPlaying);
                        }}
                    >
                        <span>{isPlaying ? '⏸' : '▶'}</span>
                    </button>
                    <button
                        className="replayer-btn"
                        title="Next"
                        onClick={() => {
                            setIsPlaying(false);
                            setActionIndex(prev => Math.min((hand.actions?.length || 1) - 1, prev + 1));
                        }}
                        disabled={actionIndex >= (hand.actions?.length || 1) - 1}
                    >
                        <span>⏭</span>
                    </button>
                    {
                        hand.actions && (
                            <span className="text-gray-400 text-sm ml-2">
                                {actionIndex + 1}/{hand.actions.length}
                            </span>
                        )
                    }
                </div >
            </div >

            {/* ============ STYLES ============ */}
            < style jsx global > {`
        .replayer-container {
          width: 100%;
          max-width: 1000px;
          margin: 0 auto;
          padding: 16px;
          padding-bottom: 40px;
        }

        /* Control Buttons */
        .replayer-controls {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
          margin-top: 100px;
        }

        .replayer-btn {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 2px solid #5a5a5a;
          background: linear-gradient(180deg, #3a3a3a 0%, #2a2a2a 100%);
          color: #ccc;
          font-size: 14px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .replayer-btn:hover {
          border-color: #999;
          box-shadow: 0 0 12px rgba(200, 200, 200, 0.2);
        }

        .replayer-btn-play {
          width: 52px;
          height: 52px;
          font-size: 18px;
          background: linear-gradient(180deg, #ffffff 0%, #e0e0e0 20%, #bfbfbf 60%, #999999 100%);
          border: 2px solid #6a6a6a;
          color: #1a1a1a;
        }

        .replayer-btn-play:hover {
          border-color: #888;
          box-shadow: 0 0 15px rgba(255, 255, 255, 0.3);
        }

        /* Table Wrapper - For positioning player seats */
        .replayer-table-wrapper {
          position: relative;
          width: 100%;
          max-width: 900px;
          margin: 80px auto 0;
          /* Allow 3D transforms to extend outside */
          overflow: visible;
        }

        /* OUTER CONTAINER: The Metallic Rail */
        .replayer-rail {
          width: 100%;
          height: 100%;
          border-radius: 200px;
          padding: 20px;
          
          /* Brushed Steel Gradient - Diagonal shine */
          background: linear-gradient(135deg, 
            #cbd5e1 0%, 
            #64748b 50%, 
            #cbd5e1 100%
          );
          
          /* Heavy drop shadow to float off the floor */
          box-shadow: 
            0 30px 60px rgba(0, 0, 0, 0.8),
            0 -2px 3px rgba(255, 255, 255, 0.2);
        }

        /* INNER CONTAINER: The Felt Surface */
        .replayer-felt {
          width: 100%;
          height: 100%;
          border-radius: 180px;
          
          /* Deep Dark Radial Gradient */
          background: radial-gradient(ellipse at center, 
            #2a2a2a 0%, 
            #1a1a1a 40%, 
            #0f0f0f 70%, 
            #080808 100%
          );
          
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          
          /* INSET SHADOW - Makes felt look sunk into metal */
          box-shadow: inset 0 10px 20px rgba(0, 0, 0, 0.9);
          
          /* Sharp edge where felt meets metal */
          border: 1px solid rgba(0, 0, 0, 0.5);
        }

        /* Inner Betting Line - On the felt, just inside player positions */
        .replayer-betting-line {
          position: absolute;
          top: 28%;
          left: 22%;
          right: 22%;
          bottom: 28%;
          /* Racetrack shape matching felt area */
          border-radius: 120px;
          border: 1px solid rgba(100, 100, 100, 0.35);
          pointer-events: none;
          z-index: 2;
        }

        /* Dealer Button */
        .replayer-dealer-btn {
          position: absolute;
          transform: translate(-50%, -50%);
          width: 26px;
          height: 26px;
          border-radius: 50%;
          background: linear-gradient(180deg, #ffffff 0%, #d0d0d0 50%, #a0a0a0 100%);
          border: 2px solid #707070;
          color: #1a1a1a;
          font-size: 12px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 
            0 4px 12px rgba(0, 0, 0, 0.6),
            inset 0 1px 2px rgba(255, 255, 255, 0.8);
          z-index: 10;
        }

        /* Stakes Display - Platinum Gradient */
        .replayer-stakes {
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.5px;
          background: linear-gradient(to right, #6b7280 0%, #ffffff 40%, #ffffff 60%, #6b7280 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        /* Board - Dark Charcoal Theme */
        .replayer-board {
          display: flex;
          gap: 6px;
          padding: 10px 20px;
          background: rgba(0, 0, 0, 0.5);
          border-radius: 14px;
          border: 1px solid rgba(80, 80, 80, 0.3);
        }

        /* ===== PREMIUM CARDS - Elegant Platinum Theme ===== */
        .replayer-card {
          width: 50px;
          height: 70px;
          /* Elegant off-white with subtle warm undertone */
          background: linear-gradient(
            145deg, 
            #fafafa 0%, 
            #f5f5f0 50%,
            #eeeeea 100%
          );
          border-radius: 6px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0;
          /* Premium layered shadows for depth */
          box-shadow: 
            0 1px 0 rgba(255, 255, 255, 0.9),
            0 8px 16px rgba(0, 0, 0, 0.35),
            0 4px 6px rgba(0, 0, 0, 0.15),
            inset 0 1px 0 rgba(255, 255, 255, 1),
            inset 0 -1px 0 rgba(0, 0, 0, 0.03);
          /* Subtle border for definition */
          border: 1px solid rgba(180, 180, 180, 0.25);
          position: relative;
          /* Subtle shine overlay */
          overflow: hidden;
        }

        /* Subtle card shine effect - BEHIND text */
        .replayer-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 35%;
          background: linear-gradient(
            to bottom,
            rgba(255, 255, 255, 0.5) 0%,
            rgba(255, 255, 255, 0) 100%
          );
          border-radius: 5px 5px 0 0;
          pointer-events: none;
          z-index: 0;
        }

        .replayer-card .card-rank {
          font-size: 18px;
          font-weight: 900;
          line-height: 1;
          letter-spacing: -0.5px;
          position: relative;
          z-index: 1;
        }

        .replayer-card .card-suit {
          font-size: 28px;
          line-height: 1;
          margin-top: -2px;
          position: relative;
          z-index: 1;
        }

        /* Black suits - TRUE BLACK for maximum contrast */
        .replayer-card.suit-black { 
          color: #111111; 
        }
        
        /* Red suits - VIVID RED for clear visibility */
        .replayer-card.suit-red { 
          color: #e53935; 
        }

        /* ===== CARD BACK - Platinum Elegance ===== */
        .replayer-card-back {
          width: 44px;
          height: 62px;
          /* Dark platinum gradient */
          background: linear-gradient(
            135deg, 
            #404040 0%, 
            #2a2a2a 30%,
            #1f1f1f 70%,
            #2d2d2d 100%
          );
          border-radius: 5px;
          /* Elegant platinum border */
          border: 2px solid;
          border-image: linear-gradient(
            135deg,
            #888888 0%,
            #606060 50%,
            #888888 100%
          ) 1;
          border-radius: 5px;
          box-shadow: 
            0 6px 12px rgba(0, 0, 0, 0.4),
            0 3px 6px rgba(0, 0, 0, 0.2),
            inset 0 1px 0 rgba(100, 100, 100, 0.2);
          position: relative;
          overflow: hidden;
        }

        /* Card back pattern - Subtle diamond lattice */
        .replayer-card-pattern {
          position: absolute;
          width: 100%;
          height: 100%;
          background: 
            repeating-linear-gradient(
              45deg, 
              transparent, 
              transparent 4px, 
              rgba(100, 100, 100, 0.08) 4px, 
              rgba(100, 100, 100, 0.08) 5px
            ),
            repeating-linear-gradient(
              -45deg, 
              transparent, 
              transparent 4px, 
              rgba(100, 100, 100, 0.08) 4px, 
              rgba(100, 100, 100, 0.08) 5px
            );
        }

        /* Card back center emblem - Subtle platinum accent */
        .replayer-card-back::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid rgba(150, 150, 150, 0.3);
          background: radial-gradient(
            circle,
            rgba(100, 100, 100, 0.2) 0%,
            transparent 70%
          );
        }

        /* Pot */
        .replayer-pot {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          padding: 6px 16px;
          background: rgba(0, 0, 0, 0.5);
          border-radius: 10px;
          border: 1px solid rgba(100, 100, 100, 0.3);
        }

        .replayer-pot-label {
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 1px;
          color: #808080;
        }

        .replayer-pot-amount {
          font-size: 16px;
          font-weight: 800;
          background: linear-gradient(to right, #6b7280 0%, #ffffff 40%, #ffffff 60%, #6b7280 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        /* Player Seats - Floating Glass Pills (3D Pop-up) */
        .replayer-seat {
          position: absolute;
          /* transform is now applied inline with counter-rotation */
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          transition: all 0.3s ease;
          /* Highest z-index so cards appear on top of rail */
          z-index: 100;
        }

        .replayer-seat.folded {
          opacity: 0.35;
        }

        /* Active player NEON GLOW */
        .replayer-seat.active .replayer-cards {
          border-color: rgba(255, 255, 255, 0.6);
          box-shadow: 
            0 0 20px rgba(255, 255, 255, 0.5),
            0 0 40px rgba(255, 255, 255, 0.3),
            0 0 60px rgba(255, 255, 255, 0.15);
        }
        
        /* Checking animation - blink glow 3 times */
        .replayer-seat.checking .replayer-cards {
          animation: check-blink 0.5s ease-in-out 3;
        }
        
        @keyframes check-blink {
          0%, 100% {
            box-shadow: 
              0 0 20px rgba(255, 255, 255, 0.5),
              0 0 40px rgba(255, 255, 255, 0.3),
              0 0 60px rgba(255, 255, 255, 0.15);
          }
          50% {
            box-shadow: 
              0 0 5px rgba(255, 255, 255, 0.2),
              0 0 10px rgba(255, 255, 255, 0.1);
          }
        }

        /* Hero - BRIGHTER platinum glow (more intense than villains) */
        .replayer-seat.hero.active .replayer-cards {
          border-color: rgba(255, 255, 255, 1);
          box-shadow: 
            0 0 20px rgba(255, 255, 255, 0.9),
            0 0 40px rgba(255, 255, 255, 0.6),
            0 0 60px rgba(255, 255, 255, 0.3),
            0 0 80px rgba(200, 200, 200, 0.15);
        }

        /* Hero Badge - Platinum metallic to match theme */
        .replayer-hero-badge {
          font-size: 9px;
          font-weight: 800;
          color: #1a1a1a;
          background: linear-gradient(135deg, #e8e8e8, #ffffff, #b0b0b0);
          padding: 3px 10px;
          border-radius: 12px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          margin-top: 6px;
          box-shadow: 
            0 2px 6px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.8);
          border: 1px solid rgba(180, 180, 180, 0.5);
        }

        /* Position Badges (BTN, SB, BB) - Above cards */
        .replayer-position-badge {
          font-size: 10px;
          font-weight: 800;
          color: #1a1a1a;
          padding: 4px 10px;
          border-radius: 10px;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 6px;
          text-shadow: none;
        }

        /* BTN - Dealer Button (Platinum/Silver) */
        .replayer-position-btn {
          background: linear-gradient(135deg, #e8e8e8, #ffffff, #c0c0c0);
          box-shadow: 
            0 2px 6px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(150, 150, 150, 0.6);
        }

        /* SB - Small Blind (Darker platinum) */
        .replayer-position-sb {
          background: linear-gradient(135deg, #a0a0a0, #d0d0d0, #909090);
          box-shadow: 
            0 2px 6px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.6);
          border: 1px solid rgba(120, 120, 120, 0.6);
        }

        /* BB - Big Blind (Slightly darker) */
        .replayer-position-bb {
          background: linear-gradient(135deg, #909090, #c0c0c0, #808080);
          box-shadow: 
            0 2px 6px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.5);
          border: 1px solid rgba(100, 100, 100, 0.6);
        }

        /* All other positions (UTG, LJ, HJ, CO) - Same platinum theme */
        .replayer-position-utg,
        [class*="replayer-position-utg+"],
        .replayer-position-lj,
        .replayer-position-hj,
        .replayer-position-co {
          background: linear-gradient(135deg, #c0c0c0, #e0e0e0, #a8a8a8);
          color: #1a1a1a;
          box-shadow: 
            0 2px 6px rgba(0, 0, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.6);
          border: 1px solid rgba(130, 130, 130, 0.6);
        }

        /* Floating Glass Pill Pod */
        .replayer-cards {
          display: flex;
          gap: 4px;
          padding: 10px 12px;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 24px;
          border: 1px solid rgba(148, 163, 184, 0.35);
          transition: all 0.3s ease;
        }

        .replayer-cards .replayer-card,
        .replayer-cards .replayer-card-back {
          width: 42px;
          height: 58px;
          box-shadow: 
            0 10px 20px rgba(0, 0, 0, 0.7),
            0 6px 10px rgba(0, 0, 0, 0.5);
        }

        .replayer-cards .replayer-card .card-rank {
          font-size: 16px;
          font-weight: 900;
        }

        .replayer-cards .replayer-card .card-suit {
          font-size: 24px;
        }

        /* EXPLICIT COLOR OVERRIDES for cards in pill pod */
        .replayer-cards .replayer-card.suit-red {
          color: #ff0000 !important;
        }
        
        .replayer-cards .replayer-card.suit-black {
          color: #000000 !important;
        }

        /* Stack Size - Below pod - BRIGHT for visibility */
        .replayer-stack {
          font-size: 13px;
          font-weight: 700;
          color: #ffffff;
          text-shadow: 0 1px 3px rgba(0, 0, 0, 1), 0 0 8px rgba(0, 0, 0, 0.8);
          white-space: nowrap;
        }
        
        /* Current Bet - Chip style on table felt (Platinum theme) */
        .replayer-bet-chip {
          position: absolute;
          font-size: 11px;
          font-weight: 700;
          color: #1a1a1a;
          background: linear-gradient(145deg, #e8e8e8, #ffffff, #c0c0c0);
          padding: 4px 10px;
          border-radius: 12px;
          border: 2px solid rgba(150, 150, 150, 0.4);
          box-shadow: 
            0 2px 8px rgba(0, 0, 0, 0.4),
            inset 0 1px 0 rgba(255, 255, 255, 0.9);
          z-index: 20;
          white-space: nowrap;
        }

        /* Responsive */
        @media (max-width: 768px) {
          .replayer-table {
            aspect-ratio: 2 / 1;
          }

          .replayer-card {
            width: 32px;
            height: 44px;
            font-size: 14px;
          }

          .replayer-cards .replayer-card,
          .replayer-cards .replayer-card-back {
            width: 26px;
            height: 36px;
            font-size: 12px;
          }

          .replayer-stack {
            font-size: 9px;
          }
        }
      `}</style >
        </div >
    );
}
