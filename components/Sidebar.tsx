// components/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  PokerChipIcon,
  HoleCardsIcon,
  RangeMatrixIcon,
  StudyBrainIcon,
  ChipStacksIcon,
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

  /**
   * Proper signout flow:
   * 1. Call Supabase signOut on CLIENT (clears localStorage tokens)
   * 2. POST to server to clear server-side cookies
   * 3. Hard redirect to login page (ensures clean state)
   */
  const handleSignOut = async () => {
    try {
      const supabase = createClient();

      // 1. Sign out on client - this clears localStorage
      await supabase.auth.signOut();

      // 2. Also clear server-side session (cookies)
      await fetch('/auth/signout', { method: 'POST' });

      // 3. Hard redirect to login (ensures clean navigation state)
      window.location.href = '/login';
    } catch (error) {
      console.error('Sign out error:', error);
      // Even if there's an error, redirect to login
      window.location.href = '/login';
    }
  };

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
        {/* Mobile spacer to account for MobileHeader height */}
        <div className="md:hidden h-14" />

        {/* Top padding for desktop */}
        <div className="hidden md:block pt-6" />

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
          <button
            onClick={handleSignOut}
            className="sidebar-nav-item sidebar-signout w-full text-left"
          >
            <LogOut className="sidebar-nav-icon" />
            Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
