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
            {/* Pull Indicator */}
            <div
                className={`pull-refresh-indicator ${isRefreshing ? 'refreshing' : ''}`}
                style={{
                    transform: `translateY(${pullDistance - 60}px) scale(${indicatorScale}) rotate(${rotation}deg)`,
                    opacity: indicatorOpacity,
                }}
            >
                <div className="refresh-icon">
                    {isRefreshing ? (
                        <div className="refresh-spinner" />
                    ) : (
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                            <defs>
                                <linearGradient id="refreshGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#e0e0e0" />
                                    <stop offset="50%" stopColor="#ffffff" />
                                    <stop offset="100%" stopColor="#a0a0a0" />
                                </linearGradient>
                            </defs>
                            <path
                                d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"
                                fill="url(#refreshGradient)"
                            />
                        </svg>
                    )}
                </div>
                <span className="refresh-text">
                    {pullDistance >= threshold ? 'Release to reset' : 'Pull to reset'}
                </span>
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
