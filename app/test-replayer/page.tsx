// app/test-replayer/page.tsx
'use client';

import { useState } from 'react';
import HandReplayer from '@/components/HandReplayer';
import "@/styles/onlypoker-theme.css";
import "@/app/globals.css";

// Hand from user 740a2347... with sequential folds
const SAMPLE_HAND_ID = '2837ceb6-2336-4330-8ef0-bedd5adde885';

export default function TestReplayerPage() {
    const [useRealData, setUseRealData] = useState(true);

    return (
        <main style={{
            minHeight: '100vh',
            background: '#1c1c1c',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
        }}>
            <h1 style={{
                fontSize: '28px',
                fontWeight: 800,
                marginBottom: '24px',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                background: 'linear-gradient(to right, #6b7280 0%, #ffffff 40%, #ffffff 60%, #6b7280 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                color: 'transparent',
            }}>
                Hand Replayer Test
            </h1>

            {/* Toggle between mock and real data */}
            <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
                <button
                    onClick={() => setUseRealData(false)}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        background: !useRealData ? '#4ade80' : '#374151',
                        color: !useRealData ? '#000' : '#fff',
                        fontWeight: 600,
                    }}
                >
                    Mock Data
                </button>
                <button
                    onClick={() => setUseRealData(true)}
                    style={{
                        padding: '8px 16px',
                        borderRadius: '8px',
                        border: 'none',
                        cursor: 'pointer',
                        background: useRealData ? '#4ade80' : '#374151',
                        color: useRealData ? '#000' : '#fff',
                        fontWeight: 600,
                    }}
                >
                    Real Data (API)
                </button>
            </div>

            {useRealData ? (
                <HandReplayer handId={SAMPLE_HAND_ID} />
            ) : (
                <HandReplayer />
            )}
        </main>
    );
}
