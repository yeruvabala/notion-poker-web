/**
 * Shared fixed positions for loading overlay symbols
 * Used by both dark HTML (layout.tsx) and React overlay (AppLoadingOverlay.tsx)
 * to create seamless transition
 */

// 17 symbols: 4 suits + 13 ranks
export const LOADING_SYMBOLS = [
    { symbol: '♠', left: 8, top: 15, size: 22, isRed: false },
    { symbol: '♥', left: 25, top: 8, size: 18, isRed: true },
    { symbol: '♦', left: 42, top: 22, size: 20, isRed: true },
    { symbol: '♣', left: 58, top: 12, size: 24, isRed: false },
    { symbol: 'A', left: 75, top: 18, size: 20, isRed: false },
    { symbol: 'K', left: 88, top: 25, size: 18, isRed: false },
    { symbol: 'Q', left: 12, top: 35, size: 16, isRed: false },
    { symbol: 'J', left: 32, top: 42, size: 22, isRed: false },
    { symbol: '10', left: 52, top: 38, size: 16, isRed: false },
    { symbol: '9', left: 72, top: 45, size: 18, isRed: false },
    { symbol: '8', left: 85, top: 52, size: 20, isRed: false },
    { symbol: '7', left: 18, top: 58, size: 18, isRed: false },
    { symbol: '6', left: 38, top: 65, size: 16, isRed: false },
    { symbol: '5', left: 62, top: 55, size: 20, isRed: false },
    { symbol: '4', left: 78, top: 68, size: 18, isRed: false },
    { symbol: '3', left: 5, top: 72, size: 16, isRed: false },
    { symbol: '2', left: 48, top: 78, size: 18, isRed: false },
];

// Generate CSS for dark HTML overlay (inline styles)
export function generateDarkOverlayCss(): string {
    let css = `
    html, body { background: #0a0a0f !important; }
    #__instant-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      z-index: 999998;
      background: #0a0a0f;
      overflow: hidden;
    }
    .instant-symbol {
      position: absolute;
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      opacity: 0.15;
    }
  `;

    // Add each symbol's position
    LOADING_SYMBOLS.forEach((s, i) => {
        css += `
    .instant-symbol-${i} {
      left: ${s.left}%;
      top: ${s.top}%;
      font-size: ${s.size}px;
      color: ${s.isRed ? '#4a2020' : '#2a2a2a'};
    }`;
    });

    return css;
}

// Generate HTML for dark overlay symbols
export function generateDarkOverlayHtml(): string {
    return LOADING_SYMBOLS.map((s, i) =>
        `<span class="instant-symbol instant-symbol-${i}">${s.symbol}</span>`
    ).join('');
}
