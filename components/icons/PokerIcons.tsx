'use client';

import React from 'react';

interface IconProps {
    className?: string;
    size?: number;
}

// Poker Chip Icon - for Home
export const PokerChipIcon: React.FC<IconProps> = ({ className = '', size = 18 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        {/* Outer ring */}
        <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
        {/* Inner ring */}
        <circle cx="12" cy="12" r="6" stroke="currentColor" strokeWidth="1.5" />
        {/* Edge notches - premium chip design */}
        <rect x="11" y="1" width="2" height="3" rx="0.5" fill="currentColor" />
        <rect x="11" y="20" width="2" height="3" rx="0.5" fill="currentColor" />
        <rect x="1" y="11" width="3" height="2" rx="0.5" fill="currentColor" />
        <rect x="20" y="11" width="3" height="2" rx="0.5" fill="currentColor" />
        {/* Diagonal notches */}
        <rect x="4.5" y="4.5" width="2" height="2.5" rx="0.5" fill="currentColor" transform="rotate(-45 5.5 5.75)" />
        <rect x="17.5" y="17.5" width="2" height="2.5" rx="0.5" fill="currentColor" transform="rotate(-45 18.5 18.75)" />
        <rect x="17.5" y="4.5" width="2" height="2.5" rx="0.5" fill="currentColor" transform="rotate(45 18.5 5.75)" />
        <rect x="4.5" y="17.5" width="2" height="2.5" rx="0.5" fill="currentColor" transform="rotate(45 5.5 18.75)" />
        {/* Center spade symbol */}
        <path
            d="M12 7.5c-2.5 2.5-3 4-3 5 0 1.5 1.3 2 2 2 0.5 0 0.8-0.2 1-0.5 0.2 0.3 0.5 0.5 1 0.5 0.7 0 2-0.5 2-2 0-1-0.5-2.5-3-5z"
            fill="currentColor"
        />
        <path d="M11.5 14v2.5h1V14" stroke="currentColor" strokeWidth="0.8" />
    </svg>
);

// Hole Cards Icon - for My Hands (two overlapping cards)
export const HoleCardsIcon: React.FC<IconProps> = ({ className = '', size = 18 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        {/* Back card */}
        <rect
            x="2"
            y="4"
            width="12"
            height="16"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
        />
        {/* Front card - offset */}
        <rect
            x="8"
            y="4"
            width="12"
            height="16"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
        />
        {/* Heart on front card */}
        <path
            d="M14 9c-0.8-1.2-2.2-1.2-2.5 0.5 0 0.8 0.5 1.5 2.5 3 2-1.5 2.5-2.2 2.5-3-0.3-1.7-1.7-1.7-2.5-0.5z"
            fill="currentColor"
        />
        {/* Spade on back card (partial) */}
        <path
            d="M6 9c-1.2 1.2-1.5 2-1.5 2.5 0 0.8 0.6 1 1 1 0.3 0 0.4-0.1 0.5-0.3 0.1 0.2 0.2 0.3 0.5 0.3 0.4 0 1-0.2 1-1 0-0.5-0.3-1.3-1.5-2.5z"
            fill="currentColor"
            opacity="0.6"
        />
    </svg>
);

// Range Matrix Icon - for Ranges (stylized 3x3 grid representing the 13x13 chart)
export const RangeMatrixIcon: React.FC<IconProps> = ({ className = '', size = 18 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        {/* Grid cells - varying opacity to show range distribution */}
        {/* Top row - pairs/premium */}
        <rect x="2" y="2" width="6" height="6" rx="1" fill="currentColor" opacity="1" />
        <rect x="9" y="2" width="6" height="6" rx="1" fill="currentColor" opacity="0.7" />
        <rect x="16" y="2" width="6" height="6" rx="1" fill="currentColor" opacity="0.4" />
        {/* Middle row */}
        <rect x="2" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.7" />
        <rect x="9" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.5" />
        <rect x="16" y="9" width="6" height="6" rx="1" fill="currentColor" opacity="0.25" />
        {/* Bottom row - weaker hands */}
        <rect x="2" y="16" width="6" height="6" rx="1" fill="currentColor" opacity="0.4" />
        <rect x="9" y="16" width="6" height="6" rx="1" fill="currentColor" opacity="0.25" />
        <rect x="16" y="16" width="6" height="6" rx="1" fill="currentColor" opacity="0.1" />
        {/* Outline */}
        <rect x="2" y="2" width="20" height="20" rx="2" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.3" />
    </svg>
);

// Study Brain Icon - for Study (brain with neural connections)
export const StudyBrainIcon: React.FC<IconProps> = ({ className = '', size = 18 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        {/* Brain outline */}
        <path
            d="M12 4C8 4 5 6 5 9c0 1.5 0.5 2.5 1.5 3.5C5.5 13.5 5 15 5 16.5c0 2 1.5 3.5 4 3.5h6c2.5 0 4-1.5 4-3.5 0-1.5-0.5-3-1.5-4 1-1 1.5-2 1.5-3.5 0-3-3-5-7-5z"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
        />
        {/* Brain fold line */}
        <path
            d="M12 4v16"
            stroke="currentColor"
            strokeWidth="1"
            strokeDasharray="2 2"
            opacity="0.5"
        />
        {/* Left hemisphere curves */}
        <path
            d="M7 8c1.5 0 2.5 0.5 3 1.5"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
        />
        <path
            d="M6.5 13c1 0 2 0.3 2.5 1"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
        />
        {/* Right hemisphere curves */}
        <path
            d="M17 8c-1.5 0-2.5 0.5-3 1.5"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
        />
        <path
            d="M17.5 13c-1 0-2 0.3-2.5 1"
            stroke="currentColor"
            strokeWidth="1"
            strokeLinecap="round"
        />
        {/* Spade accent in center */}
        <path
            d="M12 11c-1 1-1.2 1.6-1.2 2 0 0.6 0.5 0.8 0.8 0.8 0.2 0 0.3-0.1 0.4-0.2 0.1 0.1 0.2 0.2 0.4 0.2 0.3 0 0.8-0.2 0.8-0.8 0-0.4-0.2-1-1.2-2z"
            fill="currentColor"
        />
    </svg>
);

// Chip Stacks Icon - for Analytics (bar chart made of chip stacks)
export const ChipStacksIcon: React.FC<IconProps> = ({ className = '', size = 18 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        {/* Stack 1 - shortest */}
        <ellipse cx="5" cy="19" rx="3" ry="1" fill="currentColor" opacity="0.3" />
        <ellipse cx="5" cy="17" rx="3" ry="1" stroke="currentColor" strokeWidth="1" />
        <line x1="2" y1="17" x2="2" y2="19" stroke="currentColor" strokeWidth="1" />
        <line x1="8" y1="17" x2="8" y2="19" stroke="currentColor" strokeWidth="1" />

        {/* Stack 2 - medium */}
        <ellipse cx="12" cy="19" rx="3" ry="1" fill="currentColor" opacity="0.3" />
        <ellipse cx="12" cy="15" rx="3" ry="1" fill="currentColor" opacity="0.2" />
        <ellipse cx="12" cy="11" rx="3" ry="1" stroke="currentColor" strokeWidth="1" />
        <line x1="9" y1="11" x2="9" y2="19" stroke="currentColor" strokeWidth="1" />
        <line x1="15" y1="11" x2="15" y2="19" stroke="currentColor" strokeWidth="1" />

        {/* Stack 3 - tallest */}
        <ellipse cx="19" cy="19" rx="3" ry="1" fill="currentColor" opacity="0.3" />
        <ellipse cx="19" cy="15" rx="3" ry="1" fill="currentColor" opacity="0.25" />
        <ellipse cx="19" cy="11" rx="3" ry="1" fill="currentColor" opacity="0.2" />
        <ellipse cx="19" cy="7" rx="3" ry="1" fill="currentColor" opacity="0.15" />
        <ellipse cx="19" cy="5" rx="3" ry="1" stroke="currentColor" strokeWidth="1" />
        <line x1="16" y1="5" x2="16" y2="19" stroke="currentColor" strokeWidth="1" />
        <line x1="22" y1="5" x2="22" y2="19" stroke="currentColor" strokeWidth="1" />
    </svg>
);

// Settings Gear with Card Suit - for Settings
export const SettingsGearIcon: React.FC<IconProps> = ({ className = '', size = 18 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        {/* Gear teeth */}
        <path
            d="M12 2v2M12 20v2M2 12h2M20 12h2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
        />
        {/* Outer gear ring */}
        <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.5" fill="none" />
        {/* Inner circle */}
        <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" fill="none" />
        {/* Center diamond */}
        <path
            d="M12 9l2 3-2 3-2-3z"
            fill="currentColor"
            opacity="0.8"
        />
    </svg>
);

// Export all icons
export const PokerIcons = {
    PokerChip: PokerChipIcon,
    HoleCards: HoleCardsIcon,
    RangeMatrix: RangeMatrixIcon,
    StudyBrain: StudyBrainIcon,
    ChipStacks: ChipStacksIcon,
    SettingsGear: SettingsGearIcon,
};
