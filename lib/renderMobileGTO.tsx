import React from 'react';

/**
 * Premium GTO Content Renderer
 * Parses GTO strategy text and renders it with premium styling:
 * - Highlights percentages in gold
 * - Colors Hero (blue) and Villain (red)  
 * - Premium badges for Optimal/Acceptable/Mistakes
 * - Decision breakdown chips with colored indicators
 * - Section dividers and styled headers
 */
export function renderMobileGTO(text: string | null | undefined): React.ReactNode {
    if (!text) return null;

    const lines = text.split(/\r?\n/).filter(l => l.trim().length);

    // Highlight percentages and numbers
    const highlightNumbers = (text: string): React.ReactNode => {
        // Split by percentages like 60.6%, [100%], 11bb
        const parts = text.split(/(\d+\.?\d*%|\[\d+%\]|\d+bb)/g);
        return parts.map((part, idx) => {
            if (/^\d+\.?\d*%$/.test(part) || /^\[\d+%\]$/.test(part)) {
                return <span key={idx} className="gto-highlight-pct">{part}</span>;
            }
            if (/^\d+bb$/.test(part)) {
                return <span key={idx} className="gto-highlight-bb">{part}</span>;
            }
            return part;
        });
    };

    // Colorize Hero (blue) and Villain (red) + highlight numbers
    const formatText = (text: string): React.ReactNode => {
        const parts = text.split(/(Hero|Villain)/gi);
        return parts.map((part, idx) => {
            const lower = part.toLowerCase();
            if (lower === 'hero') {
                return <span key={idx} className="gto-hero-text">{part}</span>;
            }
            if (lower === 'villain') {
                return <span key={idx} className="gto-villain-text">{part}</span>;
            }
            // Apply number highlighting to non-hero/villain parts
            return <React.Fragment key={idx}>{highlightNumbers(part)}</React.Fragment>;
        });
    };

    // Parse a line and return formatted JSX
    const parseLine = (line: string, key: number, prevLine?: string): React.ReactNode => {
        const trimmed = line.trim();

        // Check for section headers: **PREFLOP (3-bet):** or **EQUITY:**
        // Capture the header text and remove trailing colon from header itself
        const headerMatch = trimmed.match(/^\*\*([^*:]+):?\*\*:?\s*(.*)/);
        if (headerMatch) {
            let header = headerMatch[1].trim();
            const rest = headerMatch[2]?.replace(/^:/, '').trim(); // Remove leading colon if present

            // Determine header type for coloring
            const isStreet = /^(PREFLOP|FLOP|TURN|RIVER)/i.test(header);
            const isMetric = /^(EQUITY|POT ODDS)/i.test(header);
            const isSituation = /^SITUATION/i.test(header);
            const isPlayClass = /^(PLAY CLASSIFICATION|Decision Breakdown|Overall)/i.test(header);

            // Add divider before major sections (streets, situation)
            const needsDivider = isStreet && key > 0;

            return (
                <React.Fragment key={key}>
                    {needsDivider && <div className="gto-section-divider" />}
                    <div className={`gto-mobile-line ${isStreet ? 'street-line' : ''} ${isMetric ? 'metric-line' : ''}`}>
                        <span className={`gto-mobile-header ${isStreet ? 'street' : ''} ${isMetric ? 'metric' : ''} ${isSituation ? 'situation' : ''} ${isPlayClass ? 'play-class' : ''}`}>
                            {header}
                        </span>
                        {rest && <span className="gto-mobile-value"> {formatText(rest)}</span>}
                    </div>
                </React.Fragment>
            );
        }

        // Check for colored dots/emoji lines (🟢 Optimal: 1) - render as premium badges
        if (trimmed.match(/^[🟢🟡🔴●○]/)) {
            // Parse the badge content to create premium styling
            const isOptimal = trimmed.includes('Optimal');
            const isAcceptable = trimmed.includes('Acceptable');
            const isMistake = trimmed.includes('Mistake');

            // Extract the number if present
            const numMatch = trimmed.match(/:\s*(\d+)/);
            const count = numMatch ? numMatch[1] : '0';

            let badgeClass = 'gto-badge';
            let label = '';

            if (isOptimal) {
                badgeClass += ' optimal';
                label = 'Optimal';
            } else if (isAcceptable) {
                badgeClass += ' acceptable';
                label = 'Acceptable';
            } else if (isMistake) {
                badgeClass += ' mistake';
                label = 'Mistakes';
            }

            if (label) {
                return (
                    <div key={key} className={badgeClass}>
                        <span className="gto-badge-indicator" />
                        <span className="gto-badge-label">{label}</span>
                        <span className="gto-badge-count">{count}</span>
                    </div>
                );
            }

            // Check for decision breakdown lines (colored circle + STREET (action): action -> result)
            // Using broad character class to match various circle/emoji representations
            const decisionMatch = trimmed.match(/^.{1,2}\s*(PREFLOP|FLOP|TURN|RIVER)\s*\([^)]+\):\s*(.+?)\s*(?:→|->)\s*(\w+)/i);
            if (decisionMatch) {
                const street = decisionMatch[1].toUpperCase();
                const action = decisionMatch[2];
                const result = decisionMatch[3].toLowerCase();

                let chipClass = 'gto-decision-chip';
                if (result === 'optimal') chipClass += ' optimal';
                else if (result === 'acceptable') chipClass += ' acceptable';
                else if (result === 'mistake') chipClass += ' mistake';

                return (
                    <div key={key} className={chipClass}>
                        <span className="gto-decision-indicator" />
                        <span className="gto-decision-street">{street}</span>
                        <span className="gto-decision-action">{action}</span>
                        <span className="gto-decision-arrow">→</span>
                        <span className="gto-decision-result">{result}</span>
                    </div>
                );
            }

            // Fallback for other emoji lines
            return (
                <div key={key} className="gto-mobile-badge-line">
                    {formatText(trimmed)}
                </div>
            );
        }

        // Check for sub-bullets: └─ or ├─ 
        if (trimmed.startsWith('└') || trimmed.startsWith('├') || trimmed.startsWith('—')) {
            return (
                <div key={key} className="gto-mobile-sub">
                    {formatText(trimmed)}
                </div>
            );
        }

        // Regular line
        return (
            <div key={key} className="gto-mobile-line">
                {formatText(trimmed)}
            </div>
        );
    };

    return (
        <div className="gto-mobile-content">
            {lines.map((line, i) => parseLine(line, i, lines[i - 1]))}
        </div>
    );
}
