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

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex h-screen w-64 flex-col border-r bg-white sticky top-0">
      <div className="px-5 pt-6 pb-4">
        <Link href="/" className="block text-xl font-semibold tracking-tight">Only Poker</Link>
        <p className="mt-1 text-xs text-slate-500">v0.1 · preview</p>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {links.map(({ href, label, Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2 text-sm
                ${active ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-100'}`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 pb-6 mt-auto space-y-1">
        <Link href="/settings" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">
          <Settings className="h-4 w-4" />
          Settings
        </Link>
        <form action="/auth/signout" method="post">
          <button className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-700 hover:bg-red-50 hover:text-red-700">
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
