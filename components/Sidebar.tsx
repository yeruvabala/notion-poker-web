// components/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import {
  PokerChipIcon,
  HoleCardsIcon,
  RangeMatrixIcon,
  StudyBrainIcon,
  ChipStacksIcon,
  SettingsGearIcon,
} from './icons/PokerIcons';

const links = [
  { href: '/', label: 'Home', Icon: PokerChipIcon },
  { href: '/history', label: 'My Hands', Icon: HoleCardsIcon },
  { href: '/ranges', label: 'Ranges', Icon: RangeMatrixIcon },
  { href: '/study', label: 'Study', Icon: StudyBrainIcon },
  { href: '/analytics', label: 'Analytics', Icon: ChipStacksIcon },
];

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
  const pathname = usePathname();

  return (
    <>
      {/* Mobile Overlay Backdrop */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Sidebar - Desktop: always visible, Mobile: slide-in overlay */}
      <aside
        className={`
          sidebar-premium
          fixed md:sticky top-0 left-0 h-screen w-64 flex-col z-50
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0 flex' : '-translate-x-full md:translate-x-0'}
          md:flex
        `}
      >
        {/* Logo - hidden on mobile (already in MobileHeader) */}
        <div className="sidebar-brand hidden md:block px-5 pt-6 pb-4">
          <Link href="/" className="sidebar-brand-title block">Only Poker</Link>
          <div className="sidebar-version-badge mt-2">
            <span>v0.1</span>
            <span>·</span>
            <span>preview</span>
          </div>
          {/* Suit decoration - poker theming */}
          <div className="sidebar-suit-decoration">
            <span>♠</span><span>♥</span><span>♦</span><span>♣</span>
          </div>
        </div>

        {/* Mobile spacer to account for MobileHeader height */}
        <div className="md:hidden h-14" />

        {/* Divider */}
        <div className="sidebar-divider mx-4 hidden md:block" />

        <nav className="flex-1 px-3 space-y-1 mt-2">
          {links.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose}
                className={`sidebar-nav-item ${active ? 'active' : ''}`}
              >
                <Icon className="sidebar-nav-icon" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom divider */}
        <div className="sidebar-divider mx-4" />

        <div className="px-3 pb-6 mt-2 space-y-1">
          <Link
            href="/settings"
            onClick={onClose}
            className="sidebar-nav-item"
          >
            <SettingsGearIcon className="sidebar-nav-icon" />
            Settings
          </Link>
          <form action="/auth/signout" method="post">
            <button className="sidebar-nav-item sidebar-signout w-full text-left">
              <LogOut className="sidebar-nav-icon" />
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
