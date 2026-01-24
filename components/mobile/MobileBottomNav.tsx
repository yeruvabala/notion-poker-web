'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import {
    PokerChipIcon,
    HoleCardsIcon,
    RangeMatrixIcon,
    StudyBrainIcon,
    ChipStacksIcon
} from '@/components/icons/PokerIcons';

// ═══════════════════════════════════════════════════════════════════════════════
// PREMIUM 5-TAB NAVIGATION - Instagram-style with custom poker icons
// ═══════════════════════════════════════════════════════════════════════════════

interface NavItem {
    Icon: React.FC<{ className?: string; size?: number }>;
    label: string;
    path: string;
}

const NAV_ITEMS: NavItem[] = [
    { Icon: PokerChipIcon, label: 'Home', path: '/' },
    { Icon: HoleCardsIcon, label: 'Hands', path: '/history' },
    { Icon: RangeMatrixIcon, label: 'Ranges', path: '/ranges' },
    { Icon: StudyBrainIcon, label: 'Study', path: '/study' },
    { Icon: ChipStacksIcon, label: 'Stats', path: '/analytics' },
];

/**
 * MobileBottomNav - Premium 5-tab Instagram-style navigation
 * 
 * Features:
 * - 5 tabs: Home, Hands, Ranges, Study, Stats
 * - Custom poker-themed SVG icons
 * - Active state with glow effect
 * - Haptic feedback on tap
 * - Tight Instagram-style positioning
 */
export default function MobileBottomNav() {
    const router = useRouter();
    const pathname = usePathname();

    const handleNavPress = (path: string) => {
        // Haptic feedback
        if (Capacitor.isNativePlatform()) {
            Haptics.impact({ style: ImpactStyle.Light }).catch(() => { });
        }
        router.push(path);
    };

    return (
        <nav className="mobile-bottom-nav">
            {NAV_ITEMS.map(({ Icon, label, path }) => {
                const isActive = pathname === path ||
                    (path === '/' && pathname === '/') ||
                    (path !== '/' && pathname?.startsWith(path));

                return (
                    <button
                        key={path}
                        className={`mobile-nav-item ${isActive ? 'active' : ''}`}
                        onClick={() => handleNavPress(path)}
                        aria-label={label}
                    >
                        <div className="mobile-nav-icon-wrapper">
                            <Icon size={24} className="mobile-nav-svg" />
                            {isActive && <div className="nav-glow" />}
                        </div>
                        <span className="mobile-nav-label">{label}</span>
                    </button>
                );
            })}
        </nav>
    );
}
