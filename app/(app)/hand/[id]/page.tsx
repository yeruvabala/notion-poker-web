// app/(app)/hand/[id]/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import HandReplayer from '@/components/HandReplayer';
import "@/styles/onlypoker-theme.css";

// Interface for page params
interface PageProps {
    params: {
        id: string;
    };
}

export default function HandPage({ params }: PageProps) {
    const { id } = params;

    return (
        <main style={{
            minHeight: '100vh',
            background: '#1c1c1c',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
        }}>
            <div style={{ width: '100%', maxWidth: '1200px', display: 'flex', flexDirection: 'column' }}>
                {/* Back Button */}
                <div style={{ marginBottom: '20px', alignSelf: 'flex-start' }}>
                    <Link
                        href="/history"
                        className="btn-platinum-premium"
                        style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '8px 16px',
                            textDecoration: 'none',
                            fontSize: '14px',
                            color: '#1a1a1a',
                            fontWeight: 600
                        }}
                    >
                        ← Back to My Hands
                    </Link>
                </div>

                {/* The Replayer - Centered */}
                <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}>
                    <HandReplayer handId={id} />
                </div>
            </div>
        </main>
    );
}
