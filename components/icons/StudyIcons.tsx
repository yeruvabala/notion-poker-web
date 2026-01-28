'use client';

import React from 'react';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * PREMIUM STUDY ICONS - Elegant SVG Icons with Platinum Gradients
 * Designed for a luxury poker app aesthetic
 * ═══════════════════════════════════════════════════════════════════════════════
 */

interface IconProps {
    className?: string;
    size?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// AI COACH ICON - Elegant neural spark with depth
// ═══════════════════════════════════════════════════════════════════════════════
export const AICoachIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="aiGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e0e0e0" />
                <stop offset="50%" stopColor="#a0a0a0" />
                <stop offset="100%" stopColor="#c0c0c0" />
            </linearGradient>
            <linearGradient id="aiSparkle" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#b0b0b0" />
            </linearGradient>
        </defs>
        {/* Main star/sparkle - elegant AI symbol */}
        <path
            d="M12 2L13.5 9L20 10.5L13.5 12L12 19L10.5 12L4 10.5L10.5 9L12 2Z"
            fill="url(#aiGradient)"
            stroke="url(#aiSparkle)"
            strokeWidth="0.5"
        />
        {/* Neural dots */}
        <circle cx="6" cy="5" r="1.2" fill="url(#aiSparkle)" opacity="0.7" />
        <circle cx="18" cy="5" r="1.2" fill="url(#aiSparkle)" opacity="0.7" />
        <circle cx="6" cy="16" r="1" fill="url(#aiSparkle)" opacity="0.5" />
        <circle cx="18" cy="16" r="1" fill="url(#aiSparkle)" opacity="0.5" />
        {/* Connecting lines - neural network feel */}
        <path d="M6.5 5.5L10 9" stroke="url(#aiSparkle)" strokeWidth="0.5" opacity="0.4" />
        <path d="M17.5 5.5L14 9" stroke="url(#aiSparkle)" strokeWidth="0.5" opacity="0.4" />
        {/* Bottom sparkles */}
        <circle cx="12" cy="22" r="1" fill="url(#aiSparkle)" opacity="0.6" />
    </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// CROSSHAIRS ICON - For 3-Betting (Precision targeting)
// ═══════════════════════════════════════════════════════════════════════════════
export const CrosshairsIcon: React.FC<IconProps> = ({ className = '', size = 16 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="crossGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#d0d0d0" />
                <stop offset="100%" stopColor="#909090" />
            </linearGradient>
        </defs>
        {/* Outer ring */}
        <circle cx="12" cy="12" r="9" stroke="url(#crossGrad)" strokeWidth="1.5" fill="none" />
        {/* Inner core */}
        <circle cx="12" cy="12" r="3" fill="url(#crossGrad)" opacity="0.8" />
        {/* Crosshair lines */}
        <path d="M12 2V7M12 17V22M2 12H7M17 12H22" stroke="url(#crossGrad)" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// EXPLOSION ICON - For C-Betting (Aggressive action)
// ═══════════════════════════════════════════════════════════════════════════════
export const ExplosionIcon: React.FC<IconProps> = ({ className = '', size = 16 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="explodeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e0e0e0" />
                <stop offset="100%" stopColor="#a0a0a0" />
            </linearGradient>
        </defs>
        {/* Burst rays */}
        <path d="M12 3L13.5 8L12 6L10.5 8L12 3Z" fill="url(#explodeGrad)" />
        <path d="M12 21L13.5 16L12 18L10.5 16L12 21Z" fill="url(#explodeGrad)" />
        <path d="M3 12L8 13.5L6 12L8 10.5L3 12Z" fill="url(#explodeGrad)" />
        <path d="M21 12L16 13.5L18 12L16 10.5L21 12Z" fill="url(#explodeGrad)" />
        {/* Center starburst */}
        <circle cx="12" cy="12" r="4" fill="url(#explodeGrad)" />
        <circle cx="12" cy="12" r="2" fill="#1a1a1a" />
    </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// WAVE ICON - For River Play (Flowing water/cards)
// ═══════════════════════════════════════════════════════════════════════════════
export const WaveIcon: React.FC<IconProps> = ({ className = '', size = 16 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="waveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#d0d0d0" />
                <stop offset="100%" stopColor="#909090" />
            </linearGradient>
        </defs>
        {/* Three flowing waves */}
        <path
            d="M2 8C4 6 6 6 8 8C10 10 12 10 14 8C16 6 18 6 20 8C22 10 22 10 22 10"
            stroke="url(#waveGrad)"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
        />
        <path
            d="M2 13C4 11 6 11 8 13C10 15 12 15 14 13C16 11 18 11 20 13C22 15 22 15 22 15"
            stroke="url(#waveGrad)"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            opacity="0.7"
        />
        <path
            d="M2 18C4 16 6 16 8 18C10 20 12 20 14 18C16 16 18 16 20 18"
            stroke="url(#waveGrad)"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
            opacity="0.4"
        />
    </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// SHIELD ICON - For Defense (Protection)
// ═══════════════════════════════════════════════════════════════════════════════
export const ShieldIcon: React.FC<IconProps> = ({ className = '', size = 16 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="shieldGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#e0e0e0" />
                <stop offset="50%" stopColor="#b0b0b0" />
                <stop offset="100%" stopColor="#808080" />
            </linearGradient>
        </defs>
        {/* Shield body */}
        <path
            d="M12 3L4 6V11C4 16 8 20 12 21C16 20 20 16 20 11V6L12 3Z"
            fill="url(#shieldGrad)"
            stroke="#c0c0c0"
            strokeWidth="1"
        />
        {/* Inner highlight */}
        <path
            d="M12 5L6 7.5V11C6 14.5 9 18 12 19C15 18 18 14.5 18 11V7.5L12 5Z"
            fill="none"
            stroke="#ffffff"
            strokeWidth="0.5"
            opacity="0.5"
        />
        {/* Center spade */}
        <path
            d="M12 9C10.5 10.5 10 11.5 10 12.5C10 13.5 10.8 14 11.5 14C11.8 14 12 13.8 12 13.8C12 13.8 12.2 14 12.5 14C13.2 14 14 13.5 14 12.5C14 11.5 13.5 10.5 12 9Z"
            fill="#1a1a1a"
            opacity="0.6"
        />
    </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// BUTTON CHIP ICON - For BTN Play (Button position chip)
// ═══════════════════════════════════════════════════════════════════════════════
export const ButtonChipIcon: React.FC<IconProps> = ({ className = '', size = 16 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="btnGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e8e8e8" />
                <stop offset="30%" stopColor="#c0c0c0" />
                <stop offset="70%" stopColor="#a0a0a0" />
                <stop offset="100%" stopColor="#d0d0d0" />
            </linearGradient>
        </defs>
        {/* Dealer button */}
        <circle cx="12" cy="12" r="9" fill="url(#btnGrad)" stroke="#909090" strokeWidth="1" />
        <circle cx="12" cy="12" r="6" stroke="#707070" strokeWidth="0.5" fill="none" />
        {/* BTN text */}
        <text x="12" y="14" textAnchor="middle" fill="#1a1a1a" fontSize="5" fontWeight="bold" fontFamily="system-ui">BTN</text>
    </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// HAND CATCH ICON - For Bluff Catching
// ═══════════════════════════════════════════════════════════════════════════════
export const HandCatchIcon: React.FC<IconProps> = ({ className = '', size = 16 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="handGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#d0d0d0" />
                <stop offset="100%" stopColor="#909090" />
            </linearGradient>
        </defs>
        {/* Open hand catching - simplified elegant design */}
        <path
            d="M12 3L8 7V14L4 11V16L12 21L20 16V11L16 14V7L12 3Z"
            fill="url(#handGrad)"
            stroke="#a0a0a0"
            strokeWidth="0.5"
        />
        {/* Eye in center - watching/catching */}
        <ellipse cx="12" cy="12" rx="3" ry="2" stroke="#1a1a1a" strokeWidth="1" fill="none" opacity="0.6" />
        <circle cx="12" cy="12" r="1" fill="#1a1a1a" opacity="0.6" />
    </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// FILTER ICON - Premium sliders design
// ═══════════════════════════════════════════════════════════════════════════════
export const FilterIcon: React.FC<IconProps> = ({ className = '', size = 16 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="filterGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e0e0e0" />
                <stop offset="50%" stopColor="#a0a0a0" />
                <stop offset="100%" stopColor="#c0c0c0" />
            </linearGradient>
        </defs>
        {/* Three horizontal lines with slider dots */}
        <line x1="4" y1="6" x2="20" y2="6" stroke="url(#filterGrad)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="8" cy="6" r="2.5" fill="url(#filterGrad)" stroke="#808080" strokeWidth="0.5" />

        <line x1="4" y1="12" x2="20" y2="12" stroke="url(#filterGrad)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="16" cy="12" r="2.5" fill="url(#filterGrad)" stroke="#808080" strokeWidth="0.5" />

        <line x1="4" y1="18" x2="20" y2="18" stroke="url(#filterGrad)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="11" cy="18" r="2.5" fill="url(#filterGrad)" stroke="#808080" strokeWidth="0.5" />
    </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// TROPHY ICON - For Best Position (Success/Achievement)
// ═══════════════════════════════════════════════════════════════════════════════
export const TrophyIcon: React.FC<IconProps> = ({ className = '', size = 20 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="trophyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="30%" stopColor="#d0d0d0" />
                <stop offset="70%" stopColor="#a0a0a0" />
                <stop offset="100%" stopColor="#c0c0c0" />
            </linearGradient>
            <linearGradient id="trophyHandle" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#c0c0c0" />
                <stop offset="100%" stopColor="#909090" />
            </linearGradient>
        </defs>
        {/* Trophy cup */}
        <path
            d="M8 2H16V3C16 7 14 10 12 11C10 10 8 7 8 3V2Z"
            fill="url(#trophyGrad)"
            stroke="#909090"
            strokeWidth="0.5"
        />
        {/* Left handle */}
        <path
            d="M8 4H5C4 4 3 5 3 6C3 8 4 9 6 9H8"
            stroke="url(#trophyHandle)"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
        />
        {/* Right handle */}
        <path
            d="M16 4H19C20 4 21 5 21 6C21 8 20 9 18 9H16"
            stroke="url(#trophyHandle)"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
        />
        {/* Stem */}
        <rect x="11" y="11" width="2" height="4" fill="url(#trophyGrad)" />
        {/* Base */}
        <path
            d="M8 15H16V16C16 17 15 18 14 18H10C9 18 8 17 8 16V15Z"
            fill="url(#trophyGrad)"
            stroke="#909090"
            strokeWidth="0.3"
        />
        {/* Star highlight */}
        <path
            d="M12 5L12.5 6.5L14 7L12.5 7.5L12 9L11.5 7.5L10 7L11.5 6.5L12 5Z"
            fill="#ffffff"
            opacity="0.6"
        />
    </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// TARGET ICON - For Focus Area (Targeting weakness)
// ═══════════════════════════════════════════════════════════════════════════════
export const TargetIcon: React.FC<IconProps> = ({ className = '', size = 20 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="targetGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e0e0e0" />
                <stop offset="50%" stopColor="#a0a0a0" />
                <stop offset="100%" stopColor="#c0c0c0" />
            </linearGradient>
        </defs>
        {/* Outer ring */}
        <circle
            cx="12" cy="12" r="9"
            stroke="url(#targetGrad)"
            strokeWidth="1.5"
            fill="none"
        />
        {/* Middle ring */}
        <circle
            cx="12" cy="12" r="6"
            stroke="url(#targetGrad)"
            strokeWidth="1.2"
            fill="none"
            opacity="0.7"
        />
        {/* Inner ring */}
        <circle
            cx="12" cy="12" r="3"
            stroke="url(#targetGrad)"
            strokeWidth="1"
            fill="none"
            opacity="0.5"
        />
        {/* Bullseye center */}
        <circle cx="12" cy="12" r="1.5" fill="url(#targetGrad)" />
        {/* Crosshair marks */}
        <path
            d="M12 2V5M12 19V22M2 12H5M19 12H22"
            stroke="url(#targetGrad)"
            strokeWidth="1.5"
            strokeLinecap="round"
        />
    </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// LIGHTNING ICON - For Quick Saves (Fast action)
// ═══════════════════════════════════════════════════════════════════════════════
export const LightningIcon: React.FC<IconProps> = ({ className = '', size = 16 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="lightningGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="30%" stopColor="#d0d0d0" />
                <stop offset="70%" stopColor="#a0a0a0" />
                <stop offset="100%" stopColor="#c0c0c0" />
            </linearGradient>
        </defs>
        {/* Lightning bolt */}
        <path
            d="M13 2L4 14H11L10 22L19 10H12L13 2Z"
            fill="url(#lightningGrad)"
            stroke="#909090"
            strokeWidth="0.5"
            strokeLinejoin="round"
        />
        {/* Highlight streak */}
        <path
            d="M12 4L9 10H12L11.5 14"
            stroke="#ffffff"
            strokeWidth="0.8"
            strokeLinecap="round"
            opacity="0.4"
        />
    </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// STRATEGY INSIGHT ICON - Elegant lightbulb with glow
// ═══════════════════════════════════════════════════════════════════════════════
export const StrategyInsightIcon: React.FC<IconProps> = ({ className = '', size = 20 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="bulbGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="40%" stopColor="#e0e0e0" />
                <stop offset="100%" stopColor="#a0a0a0" />
            </linearGradient>
            <linearGradient id="bulbGlow" x1="50%" y1="0%" x2="50%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#c0c0c0" />
            </linearGradient>
        </defs>
        {/* Bulb body */}
        <path
            d="M12 2C8.5 2 6 4.5 6 8C6 10.5 7.5 12.5 9 14V16H15V14C16.5 12.5 18 10.5 18 8C18 4.5 15.5 2 12 2Z"
            fill="url(#bulbGrad)"
            stroke="#909090"
            strokeWidth="0.5"
        />
        {/* Bulb base */}
        <rect x="9" y="16" width="6" height="2" rx="0.5" fill="url(#bulbGlow)" stroke="#808080" strokeWidth="0.3" />
        <rect x="9" y="18" width="6" height="2" rx="0.5" fill="url(#bulbGlow)" stroke="#808080" strokeWidth="0.3" />
        <path d="M10 20L10 21C10 21.5 10.5 22 11 22H13C13.5 22 14 21.5 14 21L14 20" stroke="#909090" strokeWidth="0.5" />
        {/* Inner glow rays */}
        <circle cx="12" cy="8" r="2" fill="#ffffff" opacity="0.6" />
        <path d="M12 4V5M8 8H9M15 8H16M9.5 5.5L10.2 6.2M14.5 5.5L13.8 6.2" stroke="#ffffff" strokeWidth="0.8" strokeLinecap="round" opacity="0.5" />
    </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// KEY RULES ICON - Elegant checklist with checks
// ═══════════════════════════════════════════════════════════════════════════════
export const KeyRulesIcon: React.FC<IconProps> = ({ className = '', size = 20 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="rulesGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e0e0e0" />
                <stop offset="50%" stopColor="#a0a0a0" />
                <stop offset="100%" stopColor="#c0c0c0" />
            </linearGradient>
        </defs>
        {/* Document body */}
        <rect x="4" y="2" width="16" height="20" rx="2" fill="#1a1a1a" stroke="url(#rulesGrad)" strokeWidth="1.5" />
        {/* Checkmark 1 */}
        <path d="M7 8L9 10L13 6" stroke="url(#rulesGrad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Line 1 */}
        <line x1="15" y1="8" x2="18" y2="8" stroke="url(#rulesGrad)" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
        {/* Checkmark 2 */}
        <path d="M7 14L9 16L13 12" stroke="url(#rulesGrad)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        {/* Line 2 */}
        <line x1="15" y1="14" x2="18" y2="14" stroke="url(#rulesGrad)" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
        {/* Circle 3 (unchecked) */}
        <circle cx="9" cy="20" r="2" stroke="url(#rulesGrad)" strokeWidth="1" fill="none" opacity="0.5" />
    </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// PRACTICE DRILL ICON - Dumbbell/training weight
// ═══════════════════════════════════════════════════════════════════════════════
export const PracticeDrillIcon: React.FC<IconProps> = ({ className = '', size = 20 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="drillGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="30%" stopColor="#d0d0d0" />
                <stop offset="70%" stopColor="#a0a0a0" />
                <stop offset="100%" stopColor="#c0c0c0" />
            </linearGradient>
        </defs>
        {/* Left weight */}
        <rect x="2" y="8" width="4" height="8" rx="1" fill="url(#drillGrad)" stroke="#808080" strokeWidth="0.5" />
        <rect x="4" y="10" width="2" height="4" fill="url(#drillGrad)" stroke="#808080" strokeWidth="0.3" />
        {/* Bar */}
        <rect x="6" y="11" width="12" height="2" fill="url(#drillGrad)" stroke="#909090" strokeWidth="0.3" />
        {/* Right weight */}
        <rect x="18" y="8" width="4" height="8" rx="1" fill="url(#drillGrad)" stroke="#808080" strokeWidth="0.5" />
        <rect x="18" y="10" width="2" height="4" fill="url(#drillGrad)" stroke="#808080" strokeWidth="0.3" />
        {/* Highlight */}
        <line x1="3" y1="9" x2="3" y2="15" stroke="#ffffff" strokeWidth="0.5" opacity="0.4" />
        <line x1="21" y1="9" x2="21" y2="15" stroke="#ffffff" strokeWidth="0.5" opacity="0.4" />
    </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// SOURCES ICON - Open book with pages
// ═══════════════════════════════════════════════════════════════════════════════
export const SourcesIcon: React.FC<IconProps> = ({ className = '', size = 20 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="bookGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e0e0e0" />
                <stop offset="50%" stopColor="#a0a0a0" />
                <stop offset="100%" stopColor="#c0c0c0" />
            </linearGradient>
        </defs>
        {/* Left page */}
        <path
            d="M12 4C10 4 6 4.5 3 6V19C6 17.5 10 17 12 17"
            fill="#1a1a1a"
            stroke="url(#bookGrad)"
            strokeWidth="1.5"
            strokeLinecap="round"
        />
        {/* Right page */}
        <path
            d="M12 4C14 4 18 4.5 21 6V19C18 17.5 14 17 12 17"
            fill="#1a1a1a"
            stroke="url(#bookGrad)"
            strokeWidth="1.5"
            strokeLinecap="round"
        />
        {/* Center binding */}
        <line x1="12" y1="4" x2="12" y2="17" stroke="url(#bookGrad)" strokeWidth="1" />
        {/* Page lines - left */}
        <line x1="5" y1="9" x2="10" y2="8.5" stroke="url(#bookGrad)" strokeWidth="0.5" opacity="0.5" strokeLinecap="round" />
        <line x1="5" y1="12" x2="10" y2="11.5" stroke="url(#bookGrad)" strokeWidth="0.5" opacity="0.5" strokeLinecap="round" />
        {/* Page lines - right */}
        <line x1="14" y1="8.5" x2="19" y2="9" stroke="url(#bookGrad)" strokeWidth="0.5" opacity="0.5" strokeLinecap="round" />
        <line x1="14" y1="11.5" x2="19" y2="12" stroke="url(#bookGrad)" strokeWidth="0.5" opacity="0.5" strokeLinecap="round" />
    </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// EYE REVEAL ICON - Eye for showing/revealing answers
// ═══════════════════════════════════════════════════════════════════════════════
export const EyeRevealIcon: React.FC<IconProps> = ({ className = '', size = 18 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="eyeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="50%" stopColor="#d0d0d0" />
                <stop offset="100%" stopColor="#a0a0a0" />
            </linearGradient>
        </defs>
        {/* Eye outline */}
        <path
            d="M2 12C2 12 5 6 12 6C19 6 22 12 22 12C22 12 19 18 12 18C5 18 2 12 2 12Z"
            fill="none"
            stroke="url(#eyeGrad)"
            strokeWidth="1.5"
            strokeLinecap="round"
        />
        {/* Iris */}
        <circle cx="12" cy="12" r="4" fill="url(#eyeGrad)" />
        {/* Pupil */}
        <circle cx="12" cy="12" r="2" fill="#1a1a1a" />
        {/* Highlight */}
        <circle cx="10.5" cy="10.5" r="1" fill="#ffffff" opacity="0.8" />
    </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// NOTE ICON - Document with lines for study notes
// ═══════════════════════════════════════════════════════════════════════════════
export const NoteIcon: React.FC<IconProps> = ({ className = '', size = 16 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="noteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#a5b4fc" />
                <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
        </defs>
        {/* Document body */}
        <rect x="4" y="2" width="16" height="20" rx="2" fill="url(#noteGrad)" opacity="0.9" />
        {/* Lines */}
        <line x1="7" y1="7" x2="17" y2="7" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
        <line x1="7" y1="11" x2="17" y2="11" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <line x1="7" y1="15" x2="13" y2="15" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
    </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// HAND CONTEXT ICON - Playing card with spade
// ═══════════════════════════════════════════════════════════════════════════════
export const HandContextIcon: React.FC<IconProps> = ({ className = '', size = 16 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="cardGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#e0e0e0" />
                <stop offset="100%" stopColor="#a0a0a0" />
            </linearGradient>
        </defs>
        {/* Card body */}
        <rect x="4" y="2" width="16" height="20" rx="2" fill="#1a1a1a" stroke="url(#cardGrad)" strokeWidth="1.5" />
        {/* Spade symbol */}
        <path
            d="M12 6C10 8 8 10 8 12C8 14 10 15 11 15C11.5 15 12 14.5 12 14.5C12 14.5 12.5 15 13 15C14 15 16 14 16 12C16 10 14 8 12 6Z"
            fill="url(#cardGrad)"
        />
        <path d="M12 15L11 19H13L12 15Z" fill="url(#cardGrad)" />
    </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// CHART ICON - For data/stats sources
// ═══════════════════════════════════════════════════════════════════════════════
export const ChartIcon: React.FC<IconProps> = ({ className = '', size = 16 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="chartGrad" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
        </defs>
        {/* Bars */}
        <rect x="4" y="14" width="4" height="6" rx="1" fill="url(#chartGrad)" opacity="0.6" />
        <rect x="10" y="10" width="4" height="10" rx="1" fill="url(#chartGrad)" opacity="0.8" />
        <rect x="16" y="6" width="4" height="14" rx="1" fill="url(#chartGrad)" />
        {/* Base line */}
        <line x1="2" y1="20" x2="22" y2="20" stroke="#a0a0a0" strokeWidth="1" strokeLinecap="round" />
    </svg>
);
// ═══════════════════════════════════════════════════════════════════════════════
// CHECKMARK CIRCLE ICON - For success/no leaks states
// ═══════════════════════════════════════════════════════════════════════════════
export const CheckmarkCircleIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="checkGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" />
                <stop offset="100%" stopColor="#059669" />
            </linearGradient>
            <linearGradient id="checkGlow" x1="50%" y1="0%" x2="50%" y2="100%">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
        </defs>
        {/* Outer circle */}
        <circle cx="12" cy="12" r="10" fill="url(#checkGrad)" opacity="0.15" />
        <circle cx="12" cy="12" r="10" stroke="url(#checkGlow)" strokeWidth="1.5" fill="none" />
        {/* Checkmark */}
        <path
            d="M7 12.5L10.5 16L17 9"
            stroke="url(#checkGlow)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// STATS EMPTY ICON - For no data states (bars with question)  
// ═══════════════════════════════════════════════════════════════════════════════
export const StatsEmptyIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="statsEmptyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#d0d0d0" />
                <stop offset="100%" stopColor="#808080" />
            </linearGradient>
        </defs>
        {/* Empty bars */}
        <rect x="4" y="16" width="4" height="4" rx="1" fill="url(#statsEmptyGrad)" opacity="0.3" />
        <rect x="10" y="14" width="4" height="6" rx="1" fill="url(#statsEmptyGrad)" opacity="0.4" />
        <rect x="16" y="12" width="4" height="8" rx="1" fill="url(#statsEmptyGrad)" opacity="0.5" />
        {/* Base line */}
        <line x1="2" y1="20" x2="22" y2="20" stroke="url(#statsEmptyGrad)" strokeWidth="1" strokeLinecap="round" opacity="0.5" />
        {/* Plus sign indicating "add data" */}
        <circle cx="12" cy="7" r="4" fill="none" stroke="url(#statsEmptyGrad)" strokeWidth="1" opacity="0.6" />
        <path d="M12 5V9M10 7H14" stroke="url(#statsEmptyGrad)" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
    </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// Export all Study Icons
// ═══════════════════════════════════════════════════════════════════════════════
export const StudyIcons = {
    AICoach: AICoachIcon,
    Crosshairs: CrosshairsIcon,
    Explosion: ExplosionIcon,
    Wave: WaveIcon,
    Shield: ShieldIcon,
    ButtonChip: ButtonChipIcon,
    HandCatch: HandCatchIcon,
    Filter: FilterIcon,
    Trophy: TrophyIcon,
    Target: TargetIcon,
    Lightning: LightningIcon,
    StrategyInsight: StrategyInsightIcon,
    KeyRules: KeyRulesIcon,
    PracticeDrill: PracticeDrillIcon,
    Sources: SourcesIcon,
    EyeReveal: EyeRevealIcon,
    Note: NoteIcon,
    HandContext: HandContextIcon,
    Chart: ChartIcon,
    CheckmarkCircle: CheckmarkCircleIcon,
    StatsEmpty: StatsEmptyIcon,
};

export default StudyIcons;

