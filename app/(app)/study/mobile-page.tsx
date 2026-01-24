'use client';

import React, { useMemo, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { createClient } from '@/lib/supabase/client';
import MobilePageHeader from '@/components/mobile/MobilePageHeader';
import MobileBottomNav from '@/components/mobile/MobileBottomNav';

// ═══════════════════════════════════════════════════════════════════════════════
// MOBILE STUDY PAGE - Premium AI Coach Experience
// ═══════════════════════════════════════════════════════════════════════════════

type StudyDrill = {
    id?: string;
    question: string;
    answer?: string;
    explanation?: string;
};

type StudyChunk = {
    id: string;
    source_type?: string | null;
    title?: string | null;
    content: string;
    tags?: string[] | null;
};

type CoachAnswer = {
    summary?: string | null;
    rules?: string[] | null;
    drills?: StudyDrill[] | null;
};

const QUICK_TOPICS = [
    { emoji: '🎯', label: '3-Betting', query: 'How should I construct my 3-betting range?' },
    { emoji: '💥', label: 'C-Betting', query: 'When should I continuation bet and when should I check?' },
    { emoji: '🌊', label: 'River Play', query: 'How do I make better river decisions with marginal hands?' },
    { emoji: '🛡️', label: 'Defense', query: 'How should I defend my small blind vs button opens?' },
    { emoji: '🎰', label: 'BTN Play', query: 'What are the key strategies for playing from the button?' },
    { emoji: '🃏', label: 'Bluff Catching', query: 'When should I call down as a bluff catcher?' },
];

const FILTER_CONFIGS = {
    position: ['Any', 'UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'],
    street: ['Any', 'Preflop', 'Flop', 'Turn', 'River'],
};

export default function MobileStudyPage() {
    const supabase = useMemo(() => createClient(), []);

    const [question, setQuestion] = useState('');
    const [position, setPosition] = useState('Any');
    const [street, setStreet] = useState('Any');
    const [showFilters, setShowFilters] = useState(false);

    const [coach, setCoach] = useState<CoachAnswer | null>(null);
    const [chunks, setChunks] = useState<StudyChunk[]>([]);
    const [activeDrillIndex, setActiveDrillIndex] = useState(0);
    const [showDrillAnswer, setShowDrillAnswer] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Haptic feedback
    const haptic = (style: ImpactStyle = ImpactStyle.Light) => {
        if (Capacitor.isNativePlatform()) {
            Haptics.impact({ style }).catch(() => { });
        }
    };

    // Ask Coach handler
    async function handleAskCoach() {
        if (!question.trim()) {
            setError('Type a question first');
            return;
        }

        haptic(ImpactStyle.Medium);
        setLoading(true);
        setError(null);
        setCoach(null);
        setChunks([]);

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Please sign in first');

            const res = await fetch('/api/study/answer', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    q: question.trim(),
                    range: '10k',
                    position: position === 'Any' ? null : position,
                    street: street === 'Any' ? null : street.toLowerCase(),
                }),
            });

            if (!res.ok) throw new Error('Failed to get response');

            const data = await res.json();
            setCoach(data.coach || {});
            setChunks(data.chunks || []);
            setActiveDrillIndex(0);
            setShowDrillAnswer(false);
            haptic(ImpactStyle.Heavy);
        } catch (err: any) {
            setError(err?.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    }

    const drills = (coach?.drills || []) as StudyDrill[];
    const activeDrill = drills[activeDrillIndex] || null;

    const nextDrill = () => {
        haptic();
        setShowDrillAnswer(false);
        setActiveDrillIndex((i) => (i + 1) % drills.length);
    };

    const selectTopic = (query: string) => {
        haptic();
        setQuestion(query);
    };

    return (
        <div className="mobile-study-page">
            <MobilePageHeader title="STUDY" />

            {/* AI Coach Input Section */}
            <div className="study-coach-section">
                {/* Premium Input Card */}
                <div className="study-input-card">
                    <div className="study-input-header">
                        <span className="coach-avatar">🤖</span>
                        <span className="coach-label">AI Coach</span>
                        <span className="coach-status">
                            <span className="status-dot" />
                            Ready
                        </span>
                    </div>

                    <textarea
                        className="study-textarea"
                        placeholder="Ask about spots, leaks, or strategy..."
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        rows={2}
                    />

                    {/* Quick Topics */}
                    <div className="study-quick-topics">
                        {QUICK_TOPICS.map((topic) => (
                            <button
                                key={topic.label}
                                className="quick-topic-chip"
                                onClick={() => selectTopic(topic.query)}
                            >
                                <span className="chip-emoji">{topic.emoji}</span>
                                <span>{topic.label}</span>
                            </button>
                        ))}
                    </div>

                    {/* Filter Toggle */}
                    <button
                        className="filter-toggle"
                        onClick={() => { haptic(); setShowFilters(!showFilters); }}
                    >
                        <span>🔧</span>
                        <span>Filters</span>
                        <span className="filter-arrow">{showFilters ? '▲' : '▼'}</span>
                    </button>

                    {/* Collapsible Filters */}
                    {showFilters && (
                        <div className="study-filters">
                            <div className="filter-group">
                                <span className="filter-label">Position</span>
                                <div className="filter-chips">
                                    {FILTER_CONFIGS.position.map((pos) => (
                                        <button
                                            key={pos}
                                            className={`filter-chip ${position === pos ? 'active' : ''}`}
                                            onClick={() => { haptic(); setPosition(pos); }}
                                        >
                                            {pos}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="filter-group">
                                <span className="filter-label">Street</span>
                                <div className="filter-chips">
                                    {FILTER_CONFIGS.street.map((st) => (
                                        <button
                                            key={st}
                                            className={`filter-chip ${street === st ? 'active' : ''}`}
                                            onClick={() => { haptic(); setStreet(st); }}
                                        >
                                            {st}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Ask Button */}
                    <button
                        className={`study-ask-btn ${loading ? 'loading' : ''}`}
                        onClick={handleAskCoach}
                        disabled={loading}
                    >
                        <span className="ask-btn-content">
                            {loading ? (
                                <>
                                    <span className="thinking-dots">
                                        <span>●</span><span>●</span><span>●</span>
                                    </span>
                                    <span>Thinking...</span>
                                </>
                            ) : (
                                <>
                                    <span className="ask-icon">✨</span>
                                    <span>Ask Coach</span>
                                </>
                            )}
                        </span>
                    </button>

                    {error && <div className="study-error">{error}</div>}
                </div>
            </div>

            {/* Results Section */}
            {coach && (
                <div className="study-results">
                    {/* Strategy Snapshot */}
                    {coach.summary && (
                        <div className="study-card strategy-card">
                            <div className="card-header">
                                <span className="card-icon">💡</span>
                                <span className="card-title">Strategy Insight</span>
                            </div>
                            <p className="strategy-text">{coach.summary}</p>
                        </div>
                    )}

                    {/* Key Rules */}
                    {coach.rules && coach.rules.length > 0 && (
                        <div className="study-card rules-card">
                            <div className="card-header">
                                <span className="card-icon">📋</span>
                                <span className="card-title">Key Rules</span>
                            </div>
                            <ul className="rules-list">
                                {coach.rules.map((rule, i) => (
                                    <li key={i} className="rule-item">
                                        <span className="rule-bullet" />
                                        <span>{rule}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Drill Engine */}
                    {drills.length > 0 && (
                        <div className="study-card drill-card">
                            <div className="card-header">
                                <span className="card-icon">🎯</span>
                                <span className="card-title">Practice Drill</span>
                                <span className="drill-counter">{activeDrillIndex + 1}/{drills.length}</span>
                            </div>

                            <div className="drill-content">
                                <p className="drill-question">{activeDrill?.question}</p>

                                {!showDrillAnswer ? (
                                    <button
                                        className="reveal-btn"
                                        onClick={() => { haptic(); setShowDrillAnswer(true); }}
                                    >
                                        <span>👁️</span>
                                        <span>Reveal Answer</span>
                                    </button>
                                ) : (
                                    <div className="drill-answer">
                                        <div className="answer-label">Answer</div>
                                        <p>{activeDrill?.answer}</p>
                                        {activeDrill?.explanation && (
                                            <div className="drill-explanation">
                                                <div className="explanation-label">Why?</div>
                                                <p>{activeDrill.explanation}</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {drills.length > 1 && (
                                    <button className="next-drill-btn" onClick={nextDrill}>
                                        <span>Next Drill</span>
                                        <span>→</span>
                                    </button>
                                )}
                            </div>

                            {/* Drill Progress Bar */}
                            <div className="drill-progress">
                                {drills.map((_, i) => (
                                    <div
                                        key={i}
                                        className={`progress-dot ${i === activeDrillIndex ? 'active' : ''} ${i < activeDrillIndex ? 'completed' : ''}`}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Source Context */}
                    {chunks.length > 0 && (
                        <div className="study-card sources-card">
                            <div className="card-header">
                                <span className="card-icon">📚</span>
                                <span className="card-title">Sources Used</span>
                                <span className="sources-count">{chunks.length}</span>
                            </div>
                            <div className="sources-list">
                                {chunks.slice(0, 3).map((chunk, i) => (
                                    <details key={chunk.id || i} className="source-item">
                                        <summary className="source-summary">
                                            <span className="source-icon">
                                                {chunk.source_type === 'hand' ? '♠️' :
                                                    chunk.source_type === 'note' ? '📝' : '📊'}
                                            </span>
                                            <span className="source-title">
                                                {chunk.title || (chunk.source_type === 'hand' ? 'Hand context' : 'Study note')}
                                            </span>
                                        </summary>
                                        <div className="source-content">{chunk.content}</div>
                                    </details>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Empty State */}
            {!coach && !loading && (
                <div className="study-empty-state">
                    <div className="empty-icon">🎓</div>
                    <div className="empty-title">Ask the AI Coach</div>
                    <div className="empty-subtitle">
                        Get personalized strategy advice, identify leaks, and practice with custom drills
                    </div>
                </div>
            )}

            <MobileBottomNav />
        </div>
    );
}
