// components/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home, NotebookPen, Table2, BookOpenCheck, BarChart3, Settings, LogOut,
} from 'lucide-react';

const links = [
  { href: '/', label: 'Home', Icon: Home },
  { href: '/history', label: 'My Hands', Icon: NotebookPen },
  { href: '/ranges', label: 'Ranges', Icon: Table2 },
  { href: '/study', label: 'Study', Icon: BookOpenCheck },
  { href: '/analytics', label: 'Analytics', Icon: BarChart3 },
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
          fixed md:sticky top-0 left-0 h-screen w-64 flex-col border-r border-[#262626] bg-[#18181b] z-50
          transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0 flex' : '-translate-x-full md:translate-x-0'}
          md:flex
        `}
      >
        {/* Logo - hidden on mobile (already in MobileHeader) */}
        <div className="hidden md:block px-5 pt-6 pb-4">
          <Link href="/" className="block text-xl font-semibold tracking-tight text-[#f3f4f6]">Only Poker</Link>
          <p className="mt-1 text-xs text-[#a3a3a3]">v0.1 · preview</p>
        </div>

        {/* Mobile spacer to account for MobileHeader height */}
        <div className="md:hidden h-14" />

        <nav className="flex-1 px-3 space-y-1">
          {links.map(({ href, label, Icon }) => {
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={onClose} // Close sidebar on mobile after click
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm
                  ${active ? 'text-[#f3f4f6]' : 'text-[#a3a3a3] hover:bg-[#27272a] hover:text-[#f3f4f6]'}`}
                style={active ? { background: 'radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%)' } : {}}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>

        <div className="px-3 pb-6 mt-auto space-y-1">
          <Link
            href="/settings"
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-[#a3a3a3] hover:bg-[#27272a] hover:text-[#f3f4f6]"
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
          <form action="/auth/signout" method="post">
            <button className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-[#a3a3a3] hover:bg-red-900/20 hover:text-red-400">
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
