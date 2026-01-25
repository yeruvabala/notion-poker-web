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
};

export default StudyIcons;
