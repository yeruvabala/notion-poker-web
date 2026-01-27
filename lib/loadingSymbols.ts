/**
 * Shared loading overlay symbol positions
 * 17 different scatter patterns - server picks one randomly per load
 */

// Symbol type
interface SymbolPos {
  symbol: string;
  left: number;  // percentage
  top: number;   // percentage
  size: number;  // px
  isRed: boolean;
}

// The 17 symbols (4 suits + 13 ranks)
const SYMBOLS = ['♠', '♥', '♦', '♣', 'A', 'K', 'Q', 'J', '10', '9', '8', '7', '6', '5', '4', '3', '2'];

// 17 different scatter patterns
// Each pattern has different positions for the 17 symbols
export const SCATTER_PATTERNS: SymbolPos[][] = [
  // Pattern 0 - Original diagonal scatter
  [
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
  ],
  // Pattern 1 - Edge focus
  [
    { symbol: '♠', left: 5, top: 10, size: 24, isRed: false },
    { symbol: '♥', left: 90, top: 8, size: 20, isRed: true },
    { symbol: '♦', left: 3, top: 45, size: 22, isRed: true },
    { symbol: '♣', left: 92, top: 50, size: 24, isRed: false },
    { symbol: 'A', left: 8, top: 80, size: 20, isRed: false },
    { symbol: 'K', left: 88, top: 85, size: 18, isRed: false },
    { symbol: 'Q', left: 25, top: 5, size: 16, isRed: false },
    { symbol: 'J', left: 70, top: 3, size: 20, isRed: false },
    { symbol: '10', left: 15, top: 25, size: 16, isRed: false },
    { symbol: '9', left: 85, top: 30, size: 18, isRed: false },
    { symbol: '8', left: 5, top: 60, size: 18, isRed: false },
    { symbol: '7', left: 90, top: 65, size: 16, isRed: false },
    { symbol: '6', left: 20, top: 90, size: 16, isRed: false },
    { symbol: '5', left: 75, top: 88, size: 18, isRed: false },
    { symbol: '4', left: 45, top: 8, size: 16, isRed: false },
    { symbol: '3', left: 50, top: 85, size: 16, isRed: false },
    { symbol: '2', left: 35, top: 50, size: 18, isRed: false },
  ],
  // Pattern 2 - Clustered top-left
  [
    { symbol: '♠', left: 5, top: 8, size: 24, isRed: false },
    { symbol: '♥', left: 15, top: 12, size: 20, isRed: true },
    { symbol: '♦', left: 8, top: 22, size: 22, isRed: true },
    { symbol: '♣', left: 22, top: 5, size: 22, isRed: false },
    { symbol: 'A', left: 28, top: 18, size: 18, isRed: false },
    { symbol: 'K', left: 12, top: 32, size: 16, isRed: false },
    { symbol: 'Q', left: 35, top: 10, size: 16, isRed: false },
    { symbol: 'J', left: 45, top: 25, size: 18, isRed: false },
    { symbol: '10', left: 58, top: 15, size: 16, isRed: false },
    { symbol: '9', left: 70, top: 35, size: 18, isRed: false },
    { symbol: '8', left: 82, top: 22, size: 18, isRed: false },
    { symbol: '7', left: 55, top: 48, size: 16, isRed: false },
    { symbol: '6', left: 40, top: 55, size: 16, isRed: false },
    { symbol: '5', left: 75, top: 58, size: 18, isRed: false },
    { symbol: '4', left: 85, top: 72, size: 16, isRed: false },
    { symbol: '3', left: 25, top: 70, size: 16, isRed: false },
    { symbol: '2', left: 60, top: 75, size: 18, isRed: false },
  ],
  // Pattern 3 - Clustered bottom-right
  [
    { symbol: '♠', left: 88, top: 82, size: 24, isRed: false },
    { symbol: '♥', left: 78, top: 75, size: 20, isRed: true },
    { symbol: '♦', left: 85, top: 65, size: 22, isRed: true },
    { symbol: '♣', left: 70, top: 85, size: 22, isRed: false },
    { symbol: 'A', left: 65, top: 70, size: 18, isRed: false },
    { symbol: 'K', left: 80, top: 55, size: 16, isRed: false },
    { symbol: 'Q', left: 55, top: 80, size: 16, isRed: false },
    { symbol: 'J', left: 45, top: 65, size: 18, isRed: false },
    { symbol: '10', left: 35, top: 75, size: 16, isRed: false },
    { symbol: '9', left: 25, top: 55, size: 18, isRed: false },
    { symbol: '8', left: 15, top: 68, size: 18, isRed: false },
    { symbol: '7', left: 40, top: 42, size: 16, isRed: false },
    { symbol: '6', left: 55, top: 35, size: 16, isRed: false },
    { symbol: '5', left: 20, top: 32, size: 18, isRed: false },
    { symbol: '4', left: 10, top: 18, size: 16, isRed: false },
    { symbol: '3', left: 70, top: 20, size: 16, isRed: false },
    { symbol: '2', left: 35, top: 15, size: 18, isRed: false },
  ],
  // Pattern 4 - X shape
  [
    { symbol: '♠', left: 10, top: 10, size: 24, isRed: false },
    { symbol: '♥', left: 88, top: 12, size: 22, isRed: true },
    { symbol: '♦', left: 12, top: 85, size: 22, isRed: true },
    { symbol: '♣', left: 85, top: 82, size: 24, isRed: false },
    { symbol: 'A', left: 25, top: 22, size: 18, isRed: false },
    { symbol: 'K', left: 72, top: 25, size: 16, isRed: false },
    { symbol: 'Q', left: 28, top: 70, size: 16, isRed: false },
    { symbol: 'J', left: 70, top: 72, size: 18, isRed: false },
    { symbol: '10', left: 40, top: 35, size: 16, isRed: false },
    { symbol: '9', left: 58, top: 38, size: 18, isRed: false },
    { symbol: '8', left: 45, top: 48, size: 20, isRed: false },
    { symbol: '7', left: 52, top: 52, size: 18, isRed: false },
    { symbol: '6', left: 38, top: 60, size: 16, isRed: false },
    { symbol: '5', left: 60, top: 62, size: 16, isRed: false },
    { symbol: '4', left: 48, top: 42, size: 16, isRed: false },
    { symbol: '3', left: 52, top: 58, size: 14, isRed: false },
    { symbol: '2', left: 50, top: 50, size: 18, isRed: false },
  ],
  // Pattern 5 - Vertical lines
  [
    { symbol: '♠', left: 15, top: 10, size: 22, isRed: false },
    { symbol: '♥', left: 15, top: 30, size: 20, isRed: true },
    { symbol: '♦', left: 15, top: 55, size: 22, isRed: true },
    { symbol: '♣', left: 15, top: 78, size: 20, isRed: false },
    { symbol: 'A', left: 45, top: 8, size: 18, isRed: false },
    { symbol: 'K', left: 45, top: 28, size: 16, isRed: false },
    { symbol: 'Q', left: 45, top: 48, size: 18, isRed: false },
    { symbol: 'J', left: 45, top: 68, size: 16, isRed: false },
    { symbol: '10', left: 45, top: 85, size: 16, isRed: false },
    { symbol: '9', left: 78, top: 12, size: 18, isRed: false },
    { symbol: '8', left: 78, top: 32, size: 16, isRed: false },
    { symbol: '7', left: 78, top: 52, size: 18, isRed: false },
    { symbol: '6', left: 78, top: 72, size: 16, isRed: false },
    { symbol: '5', left: 78, top: 88, size: 16, isRed: false },
    { symbol: '4', left: 30, top: 42, size: 14, isRed: false },
    { symbol: '3', left: 62, top: 38, size: 14, isRed: false },
    { symbol: '2', left: 92, top: 45, size: 16, isRed: false },
  ],
  // Pattern 6 - Horizontal lines
  [
    { symbol: '♠', left: 8, top: 18, size: 22, isRed: false },
    { symbol: '♥', left: 28, top: 18, size: 20, isRed: true },
    { symbol: '♦', left: 48, top: 18, size: 20, isRed: true },
    { symbol: '♣', left: 68, top: 18, size: 22, isRed: false },
    { symbol: 'A', left: 88, top: 18, size: 18, isRed: false },
    { symbol: 'K', left: 10, top: 50, size: 16, isRed: false },
    { symbol: 'Q', left: 30, top: 50, size: 18, isRed: false },
    { symbol: 'J', left: 50, top: 50, size: 16, isRed: false },
    { symbol: '10', left: 70, top: 50, size: 16, isRed: false },
    { symbol: '9', left: 88, top: 50, size: 18, isRed: false },
    { symbol: '8', left: 12, top: 80, size: 16, isRed: false },
    { symbol: '7', left: 32, top: 80, size: 18, isRed: false },
    { symbol: '6', left: 52, top: 80, size: 16, isRed: false },
    { symbol: '5', left: 72, top: 80, size: 16, isRed: false },
    { symbol: '4', left: 90, top: 80, size: 16, isRed: false },
    { symbol: '3', left: 40, top: 35, size: 14, isRed: false },
    { symbol: '2', left: 60, top: 65, size: 16, isRed: false },
  ],
  // Pattern 7 - Circle-ish
  [
    { symbol: '♠', left: 48, top: 5, size: 24, isRed: false },
    { symbol: '♥', left: 70, top: 12, size: 20, isRed: true },
    { symbol: '♦', left: 85, top: 30, size: 22, isRed: true },
    { symbol: '♣', left: 90, top: 52, size: 22, isRed: false },
    { symbol: 'A', left: 82, top: 72, size: 18, isRed: false },
    { symbol: 'K', left: 65, top: 85, size: 16, isRed: false },
    { symbol: 'Q', left: 45, top: 90, size: 18, isRed: false },
    { symbol: 'J', left: 25, top: 82, size: 16, isRed: false },
    { symbol: '10', left: 10, top: 68, size: 16, isRed: false },
    { symbol: '9', left: 5, top: 48, size: 18, isRed: false },
    { symbol: '8', left: 12, top: 28, size: 16, isRed: false },
    { symbol: '7', left: 28, top: 12, size: 16, isRed: false },
    { symbol: '6', left: 35, top: 40, size: 16, isRed: false },
    { symbol: '5', left: 55, top: 35, size: 16, isRed: false },
    { symbol: '4', left: 60, top: 58, size: 16, isRed: false },
    { symbol: '3', left: 42, top: 62, size: 14, isRed: false },
    { symbol: '2', left: 50, top: 48, size: 18, isRed: false },
  ],
  // Pattern 8 - Spiral
  [
    { symbol: '♠', left: 48, top: 45, size: 26, isRed: false },
    { symbol: '♥', left: 55, top: 38, size: 22, isRed: true },
    { symbol: '♦', left: 62, top: 48, size: 22, isRed: true },
    { symbol: '♣', left: 52, top: 58, size: 22, isRed: false },
    { symbol: 'A', left: 38, top: 52, size: 18, isRed: false },
    { symbol: 'K', left: 42, top: 35, size: 16, isRed: false },
    { symbol: 'Q', left: 68, top: 35, size: 16, isRed: false },
    { symbol: 'J', left: 72, top: 55, size: 16, isRed: false },
    { symbol: '10', left: 58, top: 72, size: 16, isRed: false },
    { symbol: '9', left: 32, top: 68, size: 16, isRed: false },
    { symbol: '8', left: 22, top: 42, size: 16, isRed: false },
    { symbol: '7', left: 35, top: 18, size: 16, isRed: false },
    { symbol: '6', left: 75, top: 22, size: 16, isRed: false },
    { symbol: '5', left: 85, top: 55, size: 16, isRed: false },
    { symbol: '4', left: 70, top: 82, size: 16, isRed: false },
    { symbol: '3', left: 25, top: 85, size: 14, isRed: false },
    { symbol: '2', left: 8, top: 25, size: 16, isRed: false },
  ],
  // Pattern 9 - Random spread 1
  [
    { symbol: '♠', left: 72, top: 18, size: 22, isRed: false },
    { symbol: '♥', left: 18, top: 42, size: 20, isRed: true },
    { symbol: '♦', left: 85, top: 65, size: 22, isRed: true },
    { symbol: '♣', left: 35, top: 78, size: 22, isRed: false },
    { symbol: 'A', left: 58, top: 35, size: 18, isRed: false },
    { symbol: 'K', left: 8, top: 12, size: 16, isRed: false },
    { symbol: 'Q', left: 92, top: 28, size: 16, isRed: false },
    { symbol: 'J', left: 45, top: 8, size: 18, isRed: false },
    { symbol: '10', left: 25, top: 58, size: 16, isRed: false },
    { symbol: '9', left: 68, top: 52, size: 18, isRed: false },
    { symbol: '8', left: 12, top: 82, size: 16, isRed: false },
    { symbol: '7', left: 55, top: 68, size: 16, isRed: false },
    { symbol: '6', left: 78, top: 85, size: 16, isRed: false },
    { symbol: '5', left: 40, top: 25, size: 16, isRed: false },
    { symbol: '4', left: 5, top: 55, size: 14, isRed: false },
    { symbol: '3', left: 88, top: 45, size: 14, isRed: false },
    { symbol: '2', left: 62, top: 88, size: 16, isRed: false },
  ],
  // Pattern 10 - Random spread 2
  [
    { symbol: '♠', left: 28, top: 8, size: 24, isRed: false },
    { symbol: '♥', left: 65, top: 32, size: 22, isRed: true },
    { symbol: '♦', left: 15, top: 68, size: 20, isRed: true },
    { symbol: '♣', left: 82, top: 75, size: 22, isRed: false },
    { symbol: 'A', left: 48, top: 55, size: 18, isRed: false },
    { symbol: 'K', left: 88, top: 12, size: 16, isRed: false },
    { symbol: 'Q', left: 5, top: 35, size: 16, isRed: false },
    { symbol: 'J', left: 72, top: 8, size: 16, isRed: false },
    { symbol: '10', left: 38, top: 42, size: 16, isRed: false },
    { symbol: '9', left: 55, top: 78, size: 16, isRed: false },
    { symbol: '8', left: 22, top: 25, size: 16, isRed: false },
    { symbol: '7', left: 78, top: 48, size: 16, isRed: false },
    { symbol: '6', left: 42, top: 85, size: 14, isRed: false },
    { symbol: '5', left: 8, top: 88, size: 16, isRed: false },
    { symbol: '4', left: 92, top: 58, size: 14, isRed: false },
    { symbol: '3', left: 58, top: 18, size: 14, isRed: false },
    { symbol: '2', left: 32, top: 62, size: 16, isRed: false },
  ],
  // Pattern 11 - Top heavy
  [
    { symbol: '♠', left: 12, top: 8, size: 24, isRed: false },
    { symbol: '♥', left: 32, top: 12, size: 22, isRed: true },
    { symbol: '♦', left: 52, top: 5, size: 22, isRed: true },
    { symbol: '♣', left: 72, top: 10, size: 24, isRed: false },
    { symbol: 'A', left: 88, top: 15, size: 20, isRed: false },
    { symbol: 'K', left: 5, top: 25, size: 18, isRed: false },
    { symbol: 'Q', left: 25, top: 28, size: 16, isRed: false },
    { symbol: 'J', left: 45, top: 22, size: 18, isRed: false },
    { symbol: '10', left: 65, top: 25, size: 16, isRed: false },
    { symbol: '9', left: 82, top: 32, size: 16, isRed: false },
    { symbol: '8', left: 18, top: 45, size: 16, isRed: false },
    { symbol: '7', left: 55, top: 42, size: 14, isRed: false },
    { symbol: '6', left: 38, top: 58, size: 14, isRed: false },
    { symbol: '5', left: 75, top: 55, size: 14, isRed: false },
    { symbol: '4', left: 22, top: 72, size: 14, isRed: false },
    { symbol: '3', left: 62, top: 75, size: 14, isRed: false },
    { symbol: '2', left: 45, top: 85, size: 14, isRed: false },
  ],
  // Pattern 12 - Bottom heavy
  [
    { symbol: '♠', left: 12, top: 85, size: 24, isRed: false },
    { symbol: '♥', left: 32, top: 82, size: 22, isRed: true },
    { symbol: '♦', left: 52, top: 88, size: 22, isRed: true },
    { symbol: '♣', left: 72, top: 82, size: 24, isRed: false },
    { symbol: 'A', left: 88, top: 78, size: 20, isRed: false },
    { symbol: 'K', left: 5, top: 68, size: 18, isRed: false },
    { symbol: 'Q', left: 25, top: 65, size: 16, isRed: false },
    { symbol: 'J', left: 45, top: 70, size: 18, isRed: false },
    { symbol: '10', left: 65, top: 68, size: 16, isRed: false },
    { symbol: '9', left: 82, top: 62, size: 16, isRed: false },
    { symbol: '8', left: 18, top: 48, size: 16, isRed: false },
    { symbol: '7', left: 55, top: 52, size: 14, isRed: false },
    { symbol: '6', left: 38, top: 35, size: 14, isRed: false },
    { symbol: '5', left: 75, top: 38, size: 14, isRed: false },
    { symbol: '4', left: 22, top: 22, size: 14, isRed: false },
    { symbol: '3', left: 62, top: 18, size: 14, isRed: false },
    { symbol: '2', left: 45, top: 8, size: 14, isRed: false },
  ],
  // Pattern 13 - Left heavy
  [
    { symbol: '♠', left: 8, top: 12, size: 24, isRed: false },
    { symbol: '♥', left: 5, top: 32, size: 22, isRed: true },
    { symbol: '♦', left: 10, top: 52, size: 22, isRed: true },
    { symbol: '♣', left: 8, top: 72, size: 24, isRed: false },
    { symbol: 'A', left: 15, top: 88, size: 20, isRed: false },
    { symbol: 'K', left: 22, top: 8, size: 18, isRed: false },
    { symbol: 'Q', left: 25, top: 28, size: 16, isRed: false },
    { symbol: 'J', left: 20, top: 48, size: 18, isRed: false },
    { symbol: '10', left: 28, top: 68, size: 16, isRed: false },
    { symbol: '9', left: 35, top: 85, size: 16, isRed: false },
    { symbol: '8', left: 42, top: 18, size: 16, isRed: false },
    { symbol: '7', left: 48, top: 42, size: 14, isRed: false },
    { symbol: '6', left: 58, top: 62, size: 14, isRed: false },
    { symbol: '5', left: 68, top: 25, size: 14, isRed: false },
    { symbol: '4', left: 78, top: 55, size: 14, isRed: false },
    { symbol: '3', left: 85, top: 78, size: 14, isRed: false },
    { symbol: '2', left: 72, top: 45, size: 14, isRed: false },
  ],
  // Pattern 14 - Right heavy
  [
    { symbol: '♠', left: 88, top: 12, size: 24, isRed: false },
    { symbol: '♥', left: 92, top: 32, size: 22, isRed: true },
    { symbol: '♦', left: 85, top: 52, size: 22, isRed: true },
    { symbol: '♣', left: 88, top: 72, size: 24, isRed: false },
    { symbol: 'A', left: 82, top: 88, size: 20, isRed: false },
    { symbol: 'K', left: 75, top: 8, size: 18, isRed: false },
    { symbol: 'Q', left: 72, top: 28, size: 16, isRed: false },
    { symbol: 'J', left: 78, top: 48, size: 18, isRed: false },
    { symbol: '10', left: 68, top: 68, size: 16, isRed: false },
    { symbol: '9', left: 62, top: 85, size: 16, isRed: false },
    { symbol: '8', left: 55, top: 18, size: 16, isRed: false },
    { symbol: '7', left: 48, top: 42, size: 14, isRed: false },
    { symbol: '6', left: 38, top: 62, size: 14, isRed: false },
    { symbol: '5', left: 28, top: 25, size: 14, isRed: false },
    { symbol: '4', left: 18, top: 55, size: 14, isRed: false },
    { symbol: '3', left: 12, top: 78, size: 14, isRed: false },
    { symbol: '2', left: 25, top: 45, size: 14, isRed: false },
  ],
  // Pattern 15 - Diamond center
  [
    { symbol: '♠', left: 48, top: 8, size: 24, isRed: false },
    { symbol: '♥', left: 65, top: 22, size: 22, isRed: true },
    { symbol: '♦', left: 78, top: 42, size: 22, isRed: true },
    { symbol: '♣', left: 82, top: 62, size: 22, isRed: false },
    { symbol: 'A', left: 68, top: 78, size: 18, isRed: false },
    { symbol: 'K', left: 48, top: 88, size: 16, isRed: false },
    { symbol: 'Q', left: 28, top: 78, size: 16, isRed: false },
    { symbol: 'J', left: 15, top: 62, size: 18, isRed: false },
    { symbol: '10', left: 12, top: 42, size: 16, isRed: false },
    { symbol: '9', left: 25, top: 22, size: 16, isRed: false },
    { symbol: '8', left: 48, top: 28, size: 18, isRed: false },
    { symbol: '7', left: 62, top: 45, size: 16, isRed: false },
    { symbol: '6', left: 55, top: 62, size: 14, isRed: false },
    { symbol: '5', left: 38, top: 65, size: 14, isRed: false },
    { symbol: '4', left: 32, top: 45, size: 14, isRed: false },
    { symbol: '3', left: 45, top: 48, size: 16, isRed: false },
    { symbol: '2', left: 52, top: 42, size: 14, isRed: false },
  ],
  // Pattern 16 - Scattered wide
  [
    { symbol: '♠', left: 5, top: 5, size: 22, isRed: false },
    { symbol: '♥', left: 92, top: 8, size: 20, isRed: true },
    { symbol: '♦', left: 48, top: 25, size: 22, isRed: true },
    { symbol: '♣', left: 25, top: 45, size: 22, isRed: false },
    { symbol: 'A', left: 72, top: 42, size: 18, isRed: false },
    { symbol: 'K', left: 8, top: 65, size: 16, isRed: false },
    { symbol: 'Q', left: 88, top: 68, size: 16, isRed: false },
    { symbol: 'J', left: 45, top: 58, size: 18, isRed: false },
    { symbol: '10', left: 65, top: 75, size: 16, isRed: false },
    { symbol: '9', left: 18, top: 85, size: 16, isRed: false },
    { symbol: '8', left: 78, top: 88, size: 16, isRed: false },
    { symbol: '7', left: 35, top: 12, size: 14, isRed: false },
    { symbol: '6', left: 68, top: 18, size: 14, isRed: false },
    { symbol: '5', left: 12, top: 32, size: 14, isRed: false },
    { symbol: '4', left: 85, top: 35, size: 14, isRed: false },
    { symbol: '3', left: 52, top: 82, size: 14, isRed: false },
    { symbol: '2', left: 38, top: 72, size: 16, isRed: false },
  ],
];

// Get symbols for a specific pattern
export function getPatternSymbols(patternIndex: number): SymbolPos[] {
  const idx = Math.abs(patternIndex) % SCATTER_PATTERNS.length;
  return SCATTER_PATTERNS[idx];
}

// Generate CSS for dark HTML overlay
export function generateDarkOverlayCss(patternIndex: number): string {
  const symbols = getPatternSymbols(patternIndex);
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

  symbols.forEach((s, i) => {
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
export function generateDarkOverlayHtml(patternIndex: number): string {
  const symbols = getPatternSymbols(patternIndex);
  return symbols.map((s, i) =>
    `<span class="instant-symbol instant-symbol-${i}">${s.symbol}</span>`
  ).join('');
}
