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
}

/**
 * AppErrorBoundary - Catches React errors and displays helpful debug info
 * 
 * This is especially useful for debugging why the app doesn't load on mobile.
 * When an error occurs:
 * 1. Hides the splash screen (so user can see the error)
 * 2. Displays the error message and stack trace
 * 3. Provides a reload button
 */
export default class AppErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: '' };
    }

    static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        // Log to console for debugging
        console.error('[AppErrorBoundary] React error caught:', error);
        console.error('[AppErrorBoundary] Component stack:', errorInfo.componentStack);

        // Hide splash screen so user can see the error
        if (Capacitor.isNativePlatform()) {
            SplashScreen.hide({ fadeOutDuration: 0 }).catch(() => { });
        }

        // Store error info for display
        this.setState({
            errorInfo: errorInfo.componentStack || 'No component stack available'
        });
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: '#1c1c1c',
                    color: '#ef4444',
                    padding: '20px',
                    paddingTop: 'max(60px, env(safe-area-inset-top))',
                    overflowY: 'auto',
                    fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
                    zIndex: 999999,
                }}>
                    <h1 style={{ fontSize: '24px', marginBottom: '16px', color: '#ef4444' }}>
                        ⚠️ App Error
                    </h1>

                    <p style={{ color: '#9ca3af', marginBottom: '16px' }}>
                        Something went wrong while loading the app. Here's the debug info:
                    </p>

                    <div style={{
                        background: '#2a2a2a',
                        borderRadius: '8px',
                        padding: '16px',
                        marginBottom: '16px',
                    }}>
                        <h2 style={{ fontSize: '14px', color: '#f59e0b', marginBottom: '8px' }}>
                            Error Message:
                        </h2>
                        <pre style={{
                            fontSize: '12px',
                            color: '#ef4444',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            margin: 0,
                        }}>
                            {this.state.error?.message || 'Unknown error'}
                        </pre>
                    </div>

                    <div style={{
                        background: '#2a2a2a',
                        borderRadius: '8px',
                        padding: '16px',
                        marginBottom: '16px',
                    }}>
                        <h2 style={{ fontSize: '14px', color: '#f59e0b', marginBottom: '8px' }}>
                            Stack Trace:
                        </h2>
                        <pre style={{
                            fontSize: '10px',
                            color: '#9ca3af',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            margin: 0,
                            maxHeight: '200px',
                            overflowY: 'auto',
                        }}>
                            {this.state.error?.stack || 'No stack trace available'}
                        </pre>
                    </div>

                    <div style={{
                        background: '#2a2a2a',
                        borderRadius: '8px',
                        padding: '16px',
                        marginBottom: '24px',
                    }}>
                        <h2 style={{ fontSize: '14px', color: '#f59e0b', marginBottom: '8px' }}>
                            Component Stack:
                        </h2>
                        <pre style={{
                            fontSize: '10px',
                            color: '#9ca3af',
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            margin: 0,
                            maxHeight: '150px',
                            overflowY: 'auto',
                        }}>
                            {this.state.errorInfo}
                        </pre>
                    </div>

                    <button
                        onClick={this.handleReload}
                        style={{
                            width: '100%',
                            padding: '16px',
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            fontSize: '16px',
                            fontWeight: '600',
                            cursor: 'pointer',
                        }}
                    >
                        Reload App
                    </button>

                    <p style={{
                        marginTop: '16px',
                        fontSize: '12px',
                        color: '#6b7280',
                        textAlign: 'center',
                    }}>
                        Platform: {Capacitor.getPlatform()} |
                        Native: {Capacitor.isNativePlatform() ? 'Yes' : 'No'}
                    </p>
                </div>
            );
        }

        return this.props.children;
    }
}
