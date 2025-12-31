/**
 * Enhanced GTO Strategy Tooltip Component
 * 
 * Shows Phase 12-14.5 enhancements:
 * - Hero hand classification
 * - SPR context and commitment levels
 * - Leak categories
 * - GTO recommendations
 */

import React from 'react';
import { Bot } from 'lucide-react';

interface EnhancedGTOTooltipProps {
    gtoStrategy: string | null;
    heroClassification?: {
        bucket2D: string;
        tier: string;
        percentile: string;
        description: string;
    } | null;
    spr?: {
        flop_spr?: number;
        turn_spr?: number;
        river_spr?: number;
        spr_zone: string;
        commitment_thresholds: {
            min_hand_strength: string;
            can_fold_tptk: boolean;
            can_fold_overpair: boolean;
            shove_zone: boolean;
        };
    } | null;
    mistakes?: {
        summary: {
            optimal_count: number;
            acceptable_count: number;
            mistake_count: number;
        };
        worst_leak?: string;
        leak_categories?: Array<{
            category: string;
            count: number;
        }>;
    } | null;
}

export function EnhancedGTOTooltip({
    gtoStrategy,
    heroClassification,
    spr,
    mistakes
}: EnhancedGTOTooltipProps) {
    const hasEnhancedData = heroClassification || spr || mistakes;

    return (
        <div className="group relative">
            <Bot
                className="w-5 h-5 text-[#737373] transition-all duration-300 hover:text-[#e2e8f0] hover:drop-shadow-[0_0_8px_rgba(255,255,255,0.5)] cursor-help"
            />
            <div className="absolute right-full top-1/2 -translate-y-1/2 mr-3 w-[32rem] p-5 platinum-container-frame shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[9999] max-h-[80vh] overflow-y-auto">

                {/* Hero Classification (Phase 12) */}
                {heroClassification && (
                    <>
                        <div className="mb-4 border-b border-[#444] pb-3">
                            <span className="font-bold uppercase tracking-wider text-[10px] text-[#94a3b8]">🎯 HERO HAND</span>
                            <div className="mt-2 text-xs space-y-1">
                                <div>
                                    <span className="text-[#64748b]">Classification:</span>{' '}
                                    <span className="text-[#e2e8f0] font-semibold">{heroClassification.bucket2D}</span>
                                </div>
                                <div>
                                    <span className="text-[#64748b]">Tier:</span>{' '}
                                    <span className={`font-bold ${heroClassification.tier === 'MONSTER' ? 'text-[#10b981]' :
                                            heroClassification.tier === 'STRONG' ? 'text-[#3b82f6]' :
                                                heroClassification.tier === 'MARGINAL' ? 'text-[#f59e0b]' :
                                                    'text-[#ef4444]'
                                        }`}>{heroClassification.tier}</span>
                                </div>
                                <div>
                                    <span className="text-[#64748b]">Range:</span>{' '}
                                    <span className="text-[#e2e8f0]">{heroClassification.percentile}</span>
                                </div>
                                <div className="text-[#94a3b8] italic">{heroClassification.description}</div>
                            </div>
                        </div>
                    </>
                )}

                {/* SPR Analysis (Phase 13/13.5) */}
                {spr && (
                    <>
                        <div className="mb-4 border-b border-[#444] pb-3">
                            <span className="font-bold uppercase tracking-wider text-[10px] text-[#94a3b8]">💰 SPR ANALYSIS</span>
                            <div className="mt-2 text-xs space-y-1">
                                <div className="flex gap-3">
                                    {spr.flop_spr && (
                                        <div>
                                            <span className="text-[#64748b]">Flop:</span>{' '}
                                            <span className="text-[#e2e8f0] font-mono">{spr.flop_spr.toFixed(1)}</span>
                                        </div>
                                    )}
                                    {spr.turn_spr && (
                                        <div>
                                            <span className="text-[#64748b]">Turn:</span>{' '}
                                            <span className="text-[#e2e8f0] font-mono">{spr.turn_spr.toFixed(1)}</span>
                                        </div>
                                    )}
                                    {spr.river_spr && (
                                        <div>
                                            <span className="text-[#64748b]">River:</span>{' '}
                                            <span className="text-[#e2e8f0] font-mono">{spr.river_spr.toFixed(1)}</span>
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <span className="text-[#64748b]">Zone:</span>{' '}
                                    <span className={`font-bold ${spr.spr_zone === 'POT_COMMITTED' ? 'text-[#ef4444]' :
                                            spr.spr_zone === 'COMMITTED' ? 'text-[#f59e0b]' :
                                                'text-[#10b981]'
                                        }`}>{spr.spr_zone.replace('_', ' ')}</span>
                                </div>
                                <div className="text-[#94a3b8] text-[11px] mt-2 space-y-0.5">
                                    <div>• Need {spr.commitment_thresholds.min_hand_strength} to commit</div>
                                    <div>• Fold TPTK: {spr.commitment_thresholds.can_fold_tptk ? '✅ YES' : '❌ NO'}</div>
                                    <div>• Fold overpair: {spr.commitment_thresholds.can_fold_overpair ? '✅ YES' : '❌ NO'}</div>
                                    {spr.commitment_thresholds.shove_zone && (
                                        <div className="text-[#ef4444] font-semibold">⚠️ SHOVE ZONE (SPR {"<"} 3)</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Mistake Analysis (Phase 14/14.5) */}
                {mistakes && (
                    <>
                        <div className="mb-4 border-b border-[#444] pb-3">
                            <span className="font-bold uppercase tracking-wider text-[10px] text-[#94a3b8]">📊 PLAY QUALITY</span>
                            <div className="mt-2 text-xs space-y-1">
                                <div className="flex gap-3">
                                    <div>
                                        <span className="text-[#10b981]">✓ Optimal:</span>{' '}
                                        <span className="text-[#e2e8f0] font-bold">{mistakes.summary.optimal_count}</span>
                                    </div>
                                    <div>
                                        <span className="text-[#f59e0b]">~ Acceptable:</span>{' '}
                                        <span className="text-[#e2e8f0] font-bold">{mistakes.summary.acceptable_count}</span>
                                    </div>
                                    <div>
                                        <span className="text-[#ef4444]">✗ Mistakes:</span>{' '}
                                        <span className="text-[#e2e8f0] font-bold">{mistakes.summary.mistake_count}</span>
                                    </div>
                                </div>

                                {mistakes.worst_leak && (
                                    <div className="mt-2 pt-2 border-t border-[#333]">
                                        <div className="text-[#ef4444] font-semibold text-[11px]">
                                            🚨 Primary Leak: {mistakes.worst_leak}
                                        </div>
                                    </div>
                                )}

                                {mistakes.leak_categories && mistakes.leak_categories.length > 0 && (
                                    <div className="mt-2 pt-2 border-t border-[#333]">
                                        <div className="text-[#64748b] text-[10px] mb-1">Leak Breakdown:</div>
                                        {mistakes.leak_categories.slice(0, 3).map((leak, idx) => (
                                            <div key={idx} className="text-[11px] text-[#94a3b8]">
                                                • {leak.category.replace(/_/g, ' ')}: {leak.count}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}

                {/* GTO Strategy */}
                <div className="mb-3 border-b border-[#444] pb-2">
                    <span className="font-bold uppercase tracking-wider text-[11px] platinum-text-gradient">
                        {hasEnhancedData ? '🎯 GTO STRATEGY' : 'GTO STRATEGY'}
                    </span>
                </div>
                <div className="text-xs leading-relaxed whitespace-pre-wrap platinum-text-gradient font-medium">
                    {gtoStrategy ? (
                        renderMarkdown(gtoStrategy)
                    ) : (
                        <span className="text-[#64748b]">No strategy available</span>
                    )}
                </div>
            </div>
        </div>
    );
}

// Helper to render markdown
function renderMarkdown(text: string) {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={i} className="text-white font-bold">{part.slice(2, -2)}</strong>;
        }
        return <span key={i}>{part}</span>;
    });
}
