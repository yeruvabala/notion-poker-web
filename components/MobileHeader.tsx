// components/MobileHeader.tsx
'use client';

import { Menu, X } from 'lucide-react';

interface MobileHeaderProps {
    isOpen: boolean;
    onToggle: () => void;
}

export default function MobileHeader({ isOpen, onToggle }: MobileHeaderProps) {
    return (
        <header className="md:hidden fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-[#18181b] border-b border-[#262626]">
            {/* Logo */}
            <span className="text-lg font-semibold text-[#f3f4f6]">Only Poker</span>

            {/* Hamburger Button */}
            <button
                onClick={onToggle}
                className="p-2 rounded-lg hover:bg-[#27272a] text-[#a3a3a3] hover:text-[#f3f4f6] transition-colors"
                aria-label={isOpen ? 'Close menu' : 'Open menu'}
            >
                {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
        </header>
    );
}
