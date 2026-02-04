'use client';

import React, { Component, ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { SplashScreen } from '@capacitor/splash-screen';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
    errorInfo: string;
    retryCount: number;
    isRetrying: boolean;
}

const MAX_RETRIES = 2;
const RETRY_DELAY = 500; // ms

/**
 * AppErrorBoundary - Catches React errors with auto-retry
 * 
 * Features:
 * 1. Auto-retries up to 2 times before showing error (handles cold start issues)
 * 2. Clean user-friendly error UI (no technical details)
 * 3. Reload button for manual retry
 */
export default class AppErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: '',
            retryCount: 0,
            isRetrying: false,
        };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('[AppErrorBoundary] Error:', error.message);

        // Check if we should auto-retry
        if (this.state.retryCount < MAX_RETRIES) {
            console.log(`[AppErrorBoundary] Auto-retry ${this.state.retryCount + 1}/${MAX_RETRIES}...`);

            this.setState({
                isRetrying: true,
                retryCount: this.state.retryCount + 1,
            });

            // Delay then reload
            setTimeout(() => {
                window.location.reload();
            }, RETRY_DELAY);

            return;
        }

        // Max retries reached, show error to user
        console.error('[AppErrorBoundary] Max retries reached, showing error');

        // Hide splash screen so user can see the error
        if (Capacitor.isNativePlatform()) {
            SplashScreen.hide({ fadeOutDuration: 0 }).catch(() => { });
        }

        this.setState({
            errorInfo: errorInfo.componentStack || '',
            isRetrying: false,
        });
    }

    handleReload = () => {
        // Reset retry count and reload
        this.setState({ retryCount: 0 });
        window.location.reload();
    };

    render() {
        // Show loading state while retrying
        if (this.state.isRetrying) {
            return (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: '#0a0a0a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                }}>
                    <div style={{ textAlign: 'center', color: '#9ca3af' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            border: '3px solid #333',
                            borderTopColor: '#3b82f6',
                            borderRadius: '50%',
                            margin: '0 auto 16px',
                            animation: 'spin 1s linear infinite',
                        }} />
                        <p>Loading...</p>
                        <style>{`
                            @keyframes spin {
                                to { transform: rotate(360deg); }
                            }
                        `}</style>
                    </div>
                </div>
            );
        }

        // Show clean error page (no technical details)
        if (this.state.hasError) {
            return (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: '#0a0a0a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                    padding: '20px',
                }}>
                    <div style={{ textAlign: 'center', maxWidth: '300px' }}>
                        <div style={{ fontSize: '48px', marginBottom: '16px' }}>♠️</div>
                        <h1 style={{
                            fontSize: '20px',
                            color: '#f3f4f6',
                            marginBottom: '12px',
                            fontWeight: 600,
                        }}>
                            Connection Issue
                        </h1>
                        <p style={{
                            color: '#9ca3af',
                            marginBottom: '24px',
                            fontSize: '14px',
                            lineHeight: 1.5,
                        }}>
                            Unable to load the app. Please check your connection and try again.
                        </p>
                        <button
                            onClick={this.handleReload}
                            style={{
                                width: '100%',
                                padding: '14px 24px',
                                background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                                color: 'white',
                                border: 'none',
                                borderRadius: '12px',
                                fontSize: '16px',
                                fontWeight: '600',
                                cursor: 'pointer',
                            }}
                        >
                            Reload App
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

