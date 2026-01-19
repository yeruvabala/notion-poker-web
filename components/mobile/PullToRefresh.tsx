'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

interface PullToRefreshProps {
    children: React.ReactNode;
    onRefresh: () => void;
    threshold?: number; // Pull distance to trigger refresh (default: 80px)
    disabled?: boolean;
}

/**
 * PullToRefresh - Instagram-style pull-to-refresh with Card Cascade animation
 * 
 * Features:
 * - Holographic refresh indicator with platinum shimmer
 * - Touch gesture detection with momentum
 * - Haptic feedback on iOS
 * - Card cascade exit animation coordination
 */
export default function PullToRefresh({
    children,
    onRefresh,
    threshold = 80,
    disabled = false
}: PullToRefreshProps) {
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [showCascade, setShowCascade] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const startY = useRef(0);
    const currentY = useRef(0);
    const isPulling = useRef(false);

    // Check if at top of scroll
    const isAtTop = useCallback(() => {
        if (!containerRef.current) return false;
        return containerRef.current.scrollTop <= 0;
    }, []);

    // Haptic feedback for iOS
    const triggerHaptic = useCallback(async () => {
        if (Capacitor.isNativePlatform()) {
            try {
                await Haptics.impact({ style: ImpactStyle.Medium });
            } catch (e) {
                // Haptics not available
            }
        }
    }, []);

    // Strong haptic for refresh trigger
    const triggerStrongHaptic = useCallback(async () => {
        if (Capacitor.isNativePlatform()) {
            try {
                await Haptics.impact({ style: ImpactStyle.Heavy });
            } catch (e) {
                // Haptics not available
            }
        }
    }, []);

    const handleTouchStart = useCallback((e: React.TouchEvent) => {
        if (disabled || isRefreshing) return;
        if (!isAtTop()) return;

        startY.current = e.touches[0].clientY;
        isPulling.current = true;
    }, [disabled, isRefreshing, isAtTop]);

    const handleTouchMove = useCallback((e: React.TouchEvent) => {
        if (!isPulling.current || disabled || isRefreshing) return;
        if (!isAtTop()) {
            isPulling.current = false;
            setPullDistance(0);
            return;
        }

        currentY.current = e.touches[0].clientY;
        const delta = currentY.current - startY.current;

        if (delta > 0) {
            // Resistance factor - pull gets harder as you go
            const resistance = 0.4;
            const distance = delta * resistance;
            setPullDistance(Math.min(distance, threshold * 1.5));

            // Light haptic when crossing threshold
            if (distance >= threshold && pullDistance < threshold) {
                triggerHaptic();
            }
        }
    }, [disabled, isRefreshing, isAtTop, threshold, pullDistance, triggerHaptic]);

    const handleTouchEnd = useCallback(() => {
        if (!isPulling.current) return;
        isPulling.current = false;

        if (pullDistance >= threshold && !isRefreshing) {
            // FIRE! 🎴✨
            setIsRefreshing(true);
            setShowCascade(true);
            triggerStrongHaptic();

            // Run cascade animation, then reset
            setTimeout(() => {
                onRefresh();
                setShowCascade(false);

                // Small delay for flash effect
                setTimeout(() => {
                    setIsRefreshing(false);
                    setPullDistance(0);
                }, 200);
            }, 600); // Animation duration
        } else {
            // Snap back
            setPullDistance(0);
        }
    }, [pullDistance, threshold, isRefreshing, onRefresh, triggerStrongHaptic]);

    // Calculate indicator opacity and scale
    const progress = Math.min(pullDistance / threshold, 1);
    const indicatorOpacity = progress;
    const indicatorScale = 0.5 + (progress * 0.5);
    const rotation = progress * 180;

    return (
        <div
            ref={containerRef}
            className="pull-to-refresh-container"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            style={{
                position: 'relative',
                overflow: 'auto',
                height: '100%',
                WebkitOverflowScrolling: 'touch',
            }}
        >
            {/* Poker Chip Pull Indicator - Holographic spinning chip */}
            <div
                className={`pull-refresh-indicator ${isRefreshing ? 'refreshing' : ''} ${pullDistance >= threshold ? 'ready' : ''}`}
                style={{
                    transform: `translateY(${pullDistance - 50}px)`,
                    opacity: indicatorOpacity,
                }}
            >
                <div
                    className="poker-chip-container"
                    style={{
                        transform: `scale(${indicatorScale}) rotateY(${rotation * 2}deg)`,
                    }}
                >
                    {/* Outer ring with holographic edge */}
                    <div className="chip-outer-ring">
                        {/* The chip face */}
                        <div className="chip-face">
                            {/* Center emblem - spade symbol */}
                            <div className="chip-emblem">♠</div>
                            {/* Edge notches for that authentic chip look */}
                            <div className="chip-notch notch-1" />
                            <div className="chip-notch notch-2" />
                            <div className="chip-notch notch-3" />
                            <div className="chip-notch notch-4" />
                            <div className="chip-notch notch-5" />
                            <div className="chip-notch notch-6" />
                            <div className="chip-notch notch-7" />
                            <div className="chip-notch notch-8" />
                        </div>
                    </div>

                    {/* Holographic shine streak */}
                    <div className="chip-shine" />
                </div>
            </div>

            {/* Card Cascade Overlay - Shows during refresh */}
            {showCascade && (
                <div className="card-cascade-overlay">
                    {/* Scattered cards animation */}
                    <div className="cascade-card cascade-card-1">🂡</div>
                    <div className="cascade-card cascade-card-2">🂮</div>
                    <div className="cascade-card cascade-card-3">🃂</div>
                    <div className="cascade-card cascade-card-4">🃇</div>
                    <div className="cascade-card cascade-card-5">🂢</div>

                    {/* Particle dust trails */}
                    <div className="particle-trail particle-1" />
                    <div className="particle-trail particle-2" />
                    <div className="particle-trail particle-3" />

                    {/* Center vortex */}
                    <div className="vortex-center" />

                    {/* Reset flash */}
                    <div className="reset-flash" />
                </div>
            )}

            {/* Content with pull transform */}
            <div
                className={`pull-content ${showCascade ? 'cascading' : ''}`}
                style={{
                    transform: isRefreshing ? 'none' : `translateY(${pullDistance * 0.3}px)`,
                    transition: isPulling.current ? 'none' : 'transform 0.3s ease-out',
                }}
            >
                {children}
            </div>
        </div>
    );
}
