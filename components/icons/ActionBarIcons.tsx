'use client';

import React from 'react';

/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ACTION BAR ICONS - Premium SVG Icons for Home Page Action Buttons
 * Save + Analyze buttons with elegant gradients
 * ═══════════════════════════════════════════════════════════════════════════════
 */

interface IconProps {
    className?: string;
    size?: number;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SAVE ICON - Elegant floppy disk / folder with card suit accent
// Premium 3D metallic effect
// ═══════════════════════════════════════════════════════════════════════════════
export const SaveIcon: React.FC<IconProps> = ({ className = '', size = 18 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="saveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#c0c0c0" />
                <stop offset="50%" stopColor="#909090" />
                <stop offset="100%" stopColor="#b0b0b0" />
            </linearGradient>
            <linearGradient id="saveHighlight" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="100%" stopColor="#a0a0a0" />
            </linearGradient>
        </defs>
        {/* Floppy disk body */}
        <path
            d="M5 3C4 3 3 4 3 5V19C3 20 4 21 5 21H19C20 21 21 20 21 19V7L17 3H5Z"
            fill="url(#saveGrad)"
            stroke="#707070"
            strokeWidth="0.5"
        />
        {/* Label area on disk */}
        <rect x="6" y="3" width="10" height="7" rx="1" fill="url(#saveHighlight)" opacity="0.9" />
        {/* Label lines */}
        <line x1="7" y1="5" x2="15" y2="5" stroke="#606060" strokeWidth="0.5" />
        <line x1="7" y1="7" x2="12" y2="7" stroke="#606060" strokeWidth="0.5" />
        {/* Metal shutter */}
        <rect x="8" y="13" width="8" height="6" rx="1" fill="#505050" />
        <rect x="12" y="13" width="3" height="6" rx="0.5" fill="#707070" />
        {/* Corner fold */}
        <path d="M17 3V7H21" fill="none" stroke="#808080" strokeWidth="0.5" />
    </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYZE ICON - Elegant AI brain sparkle / magic wand
// Premium glowing effect with neural network feel
// ═══════════════════════════════════════════════════════════════════════════════
export const AnalyzeIcon: React.FC<IconProps> = ({ className = '', size = 18 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="analyzeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="50%" stopColor="#c0c0c0" />
                <stop offset="100%" stopColor="#e0e0e0" />
            </linearGradient>
            <linearGradient id="wandGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#b0b0b0" />
                <stop offset="100%" stopColor="#707070" />
            </linearGradient>
        </defs>
        {/* Magic wand body */}
        <rect
            x="3" y="14"
            width="14" height="3"
            rx="1.5"
            transform="rotate(-45 3 14)"
            fill="url(#wandGrad)"
            stroke="#606060"
            strokeWidth="0.3"
        />
        {/* Wand tip glow */}
        <circle cx="16" cy="8" r="2" fill="url(#analyzeGrad)" opacity="0.9" />
        {/* Main sparkle - 4-point star */}
        <path
            d="M16 3L17 7L21 8L17 9L16 13L15 9L11 8L15 7L16 3Z"
            fill="url(#analyzeGrad)"
            stroke="#a0a0a0"
            strokeWidth="0.3"
        />
        {/* Secondary sparkles */}
        <circle cx="20" cy="4" r="1" fill="#c0c0c0" opacity="0.8" />
        <circle cx="13" cy="5" r="0.8" fill="#c0c0c0" opacity="0.6" />
        <circle cx="19" cy="11" r="0.8" fill="#c0c0c0" opacity="0.6" />
        {/* Dust particles from wand */}
        <circle cx="8" cy="14" r="0.5" fill="#a0a0a0" opacity="0.5" />
        <circle cx="10" cy="12" r="0.4" fill="#a0a0a0" opacity="0.4" />
        <circle cx="6" cy="16" r="0.4" fill="#a0a0a0" opacity="0.4" />
    </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// ALTERNATE ANALYZE ICON - Pure sparkle/AI burst (no wand)
// For a cleaner, more modern look
// ═══════════════════════════════════════════════════════════════════════════════
export const SparkleIcon: React.FC<IconProps> = ({ className = '', size = 18 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="sparkleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="40%" stopColor="#e0e0e0" />
                <stop offset="100%" stopColor="#c0c0c0" />
            </linearGradient>
        </defs>
        {/* Main large sparkle */}
        <path
            d="M12 2L13.5 9L20 10.5L13.5 12L12 19L10.5 12L4 10.5L10.5 9L12 2Z"
            fill="url(#sparkleGrad)"
            stroke="#a0a0a0"
            strokeWidth="0.3"
        />
        {/* Secondary sparkles */}
        <path
            d="M19 15L19.8 17.5L22 18L19.8 18.5L19 21L18.2 18.5L16 18L18.2 17.5L19 15Z"
            fill="url(#sparkleGrad)"
            opacity="0.8"
        />
        <path
            d="M5 14L5.6 16L7.5 16.5L5.6 17L5 19L4.4 17L2.5 16.5L4.4 16L5 14Z"
            fill="url(#sparkleGrad)"
            opacity="0.7"
        />
        {/* Dots for extra magic */}
        <circle cx="7" cy="6" r="1" fill="#c0c0c0" opacity="0.6" />
        <circle cx="17" cy="5" r="0.8" fill="#c0c0c0" opacity="0.5" />
    </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// FOLDER SAVE ICON - Premium folder with plus/checkmark
// Alternative save icon with modern folder design
// ═══════════════════════════════════════════════════════════════════════════════
export const FolderSaveIcon: React.FC<IconProps> = ({ className = '', size = 18 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="folderGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#c0c0c0" />
                <stop offset="50%" stopColor="#a0a0a0" />
                <stop offset="100%" stopColor="#808080" />
            </linearGradient>
            <linearGradient id="folderFront" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#b0b0b0" />
                <stop offset="100%" stopColor="#707070" />
            </linearGradient>
        </defs>
        {/* Folder back */}
        <path
            d="M3 6C3 5 3.5 4 4.5 4H9L11 6H19.5C20.5 6 21 7 21 8V18C21 19 20.5 20 19.5 20H4.5C3.5 20 3 19 3 18V6Z"
            fill="url(#folderGrad)"
            stroke="#606060"
            strokeWidth="0.3"
        />
        {/* Folder front panel */}
        <rect x="3" y="9" width="18" height="11" rx="1" fill="url(#folderFront)" />
        {/* Plus/Add icon in center */}
        <path d="M12 12V16M10 14H14" stroke="#d0d0d0" strokeWidth="1.5" strokeLinecap="round" />
        {/* Tab highlight */}
        <path d="M9 4L11 6H9" fill="#d0d0d0" opacity="0.3" />
    </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// UPLOAD ICON - Premium arrow-up with document
// Clean import/upload design
// ═══════════════════════════════════════════════════════════════════════════════
export const UploadIcon: React.FC<IconProps> = ({ className = '', size = 18 }) => (
    <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
    >
        <defs>
            <linearGradient id="uploadGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="50%" stopColor="#c0c0c0" />
                <stop offset="100%" stopColor="#a0a0a0" />
            </linearGradient>
            <linearGradient id="uploadArrow" x1="0%" y1="100%" x2="0%" y2="0%">
                <stop offset="0%" stopColor="#909090" />
                <stop offset="100%" stopColor="#ffffff" />
            </linearGradient>
        </defs>
        {/* Document base */}
        <path
            d="M6 2C5 2 4 3 4 4V20C4 21 5 22 6 22H18C19 22 20 21 20 20V8L14 2H6Z"
            fill="url(#uploadGrad)"
            stroke="#707070"
            strokeWidth="0.4"
        />
        {/* Document corner fold */}
        <path d="M14 2V8H20" fill="none" stroke="#808080" strokeWidth="0.4" />
        <path d="M14 2L20 8L14 8Z" fill="#d0d0d0" opacity="0.5" />
        {/* Upload arrow */}
        <path
            d="M12 18V11M12 11L9 14M12 11L15 14"
            stroke="url(#uploadArrow)"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        {/* Arrow glow effect */}
        <circle cx="12" cy="11" r="1" fill="#ffffff" opacity="0.6" />
    </svg>
);

// ═══════════════════════════════════════════════════════════════════════════════
// Export all Action Bar Icons
// ═══════════════════════════════════════════════════════════════════════════════
export const ActionBarIcons = {
    Save: SaveIcon,
    Analyze: AnalyzeIcon,
    Sparkle: SparkleIcon,
    FolderSave: FolderSaveIcon,
    Upload: UploadIcon,
};

export default ActionBarIcons;
