'use client';

import { usePathname, useRouter } from 'next/navigation';

interface NavItem {
    icon: string;
    label: string;
    path: string;
}

const NAV_ITEMS: NavItem[] = [
    { icon: '🏠', label: 'Home', path: '/' },
    { icon: '🃏', label: 'Hands', path: '/history' },
    { icon: '⚙️', label: 'Settings', path: '/settings' },
];

/**
 * MobileBottomNav - Fixed bottom navigation bar
 * 
 * Features:
 * - Fixed at bottom with safe area padding
 * - 4 tabs: Home, Hands, Stats, Settings
 * - Active state highlighting
 * - Glassmorphism background
 */
export default function MobileBottomNav() {
    const router = useRouter();
    const pathname = usePathname();

    return (
        <nav className="mobile-bottom-nav">
            {NAV_ITEMS.map((item) => {
                const isActive = pathname === item.path ||
                    (item.path === '/' && pathname === '/') ||
                    (item.path !== '/' && pathname?.startsWith(item.path));

                return (
                    <button
                        key={item.path}
                        className={`mobile-nav-item ${isActive ? 'active' : ''}`}
                        onClick={() => router.push(item.path)}
                    >
                        <span className="mobile-nav-icon">{item.icon}</span>
                        <span className="mobile-nav-label">{item.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}
