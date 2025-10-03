'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  NotebookPen,
  Table2,
  BookOpenCheck,
  BarChart3,
  Settings,
  LogOut,
} from 'lucide-react';
import SignOutButton from '@/components/SignOutButton';

function Item({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}) {
  const pathname = usePathname();
  const active = pathname === href;

  return (
    <Link
      href={href}
      className={[
        'flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors',
        active
          ? 'bg-slate-900 text-white'
          : 'text-slate-700 hover:bg-slate-100',
      ].join(' ')}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Link>
  );
}

export default function Sidebar() {
  return (
    <aside className="hidden md:flex h-screen w-64 flex-col border-r bg-white sticky top-0">
      <div className="px-5 pt-6 pb-4">
        <Link href="/" className="block text-xl font-semibold tracking-tight">
          Only Poker
        </Link>
        <p className="mt-1 text-xs text-slate-500">v0.1 · preview</p>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        <Item href="/" icon={Home} label="Home" />
        <Item href="/history" icon={NotebookPen} label="My Hands" />
        <Item href="/ranges" icon={Table2} label="Ranges" />
        <Item href="/study" icon={BookOpenCheck} label="Study" />
        <Item href="/analytics" icon={BarChart3} label="Analytics" />
      </nav>

      <div className="px-3 pb-6 mt-auto space-y-1">
        <Item href="/settings" icon={Settings} label="Settings" />
        {/* Sign out */}
        <SignOutButton className="w-full">
          <LogOut className="h-4 w-4" />
          <span>Sign out</span>
        </SignOutButton>
      </div>
    </aside>
  );
}
