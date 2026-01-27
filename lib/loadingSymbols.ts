/**
 * Shared loading overlay symbol positions
 * 17 different ORGANIC scatter patterns - no geometric shapes
 */

// Symbol type
interface SymbolPos {
  symbol: string;
  left: number;  // percentage
  top: number;   // percentage
  size: number;  // px
  isRed: boolean;
}

// 17 unique organic scatter patterns (no lines, X, circles, diamonds)
export const SCATTER_PATTERNS: SymbolPos[][] = [
  // Pattern 0
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
  // Pattern 1
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
  // Pattern 2
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
  // Pattern 3
  [
    { symbol: '♠', left: 5, top: 22, size: 22, isRed: false },
    { symbol: '♥', left: 42, top: 15, size: 20, isRed: true },
    { symbol: '♦', left: 78, top: 28, size: 22, isRed: true },
    { symbol: '♣', left: 22, top: 48, size: 22, isRed: false },
    { symbol: 'A', left: 62, top: 42, size: 18, isRed: false },
    { symbol: 'K', left: 88, top: 55, size: 16, isRed: false },
    { symbol: 'Q', left: 35, top: 72, size: 16, isRed: false },
    { symbol: 'J', left: 8, top: 85, size: 18, isRed: false },
    { symbol: '10', left: 72, top: 68, size: 16, isRed: false },
    { symbol: '9', left: 48, top: 32, size: 18, isRed: false },
    { symbol: '8', left: 15, top: 62, size: 16, isRed: false },
    { symbol: '7', left: 85, top: 82, size: 16, isRed: false },
    { symbol: '6', left: 55, top: 88, size: 16, isRed: false },
    { symbol: '5', left: 28, top: 8, size: 16, isRed: false },
    { symbol: '4', left: 92, top: 12, size: 14, isRed: false },
    { symbol: '3', left: 68, top: 5, size: 14, isRed: false },
    { symbol: '2', left: 45, top: 58, size: 16, isRed: false },
  ],
  // Pattern 4
  [
    { symbol: '♠', left: 92, top: 8, size: 24, isRed: false },
    { symbol: '♥', left: 12, top: 25, size: 22, isRed: true },
    { symbol: '♦', left: 55, top: 45, size: 20, isRed: true },
    { symbol: '♣', left: 78, top: 62, size: 22, isRed: false },
    { symbol: 'A', left: 25, top: 72, size: 18, isRed: false },
    { symbol: 'K', left: 45, top: 12, size: 16, isRed: false },
    { symbol: 'Q', left: 68, top: 28, size: 16, isRed: false },
    { symbol: 'J', left: 8, top: 55, size: 18, isRed: false },
    { symbol: '10', left: 88, top: 38, size: 16, isRed: false },
    { symbol: '9', left: 35, top: 85, size: 16, isRed: false },
    { symbol: '8', left: 62, top: 75, size: 16, isRed: false },
    { symbol: '7', left: 18, top: 8, size: 16, isRed: false },
    { symbol: '6', left: 72, top: 88, size: 14, isRed: false },
    { symbol: '5', left: 5, top: 42, size: 16, isRed: false },
    { symbol: '4', left: 48, top: 65, size: 14, isRed: false },
    { symbol: '3', left: 82, top: 18, size: 14, isRed: false },
    { symbol: '2', left: 38, top: 35, size: 16, isRed: false },
  ],
  // Pattern 5
  [
    { symbol: '♠', left: 35, top: 5, size: 22, isRed: false },
    { symbol: '♥', left: 75, top: 22, size: 20, isRed: true },
    { symbol: '♦', left: 8, top: 48, size: 22, isRed: true },
    { symbol: '♣', left: 52, top: 72, size: 22, isRed: false },
    { symbol: 'A', left: 88, top: 85, size: 18, isRed: false },
    { symbol: 'K', left: 22, top: 18, size: 16, isRed: false },
    { symbol: 'Q', left: 62, top: 38, size: 16, isRed: false },
    { symbol: 'J', left: 42, top: 28, size: 18, isRed: false },
    { symbol: '10', left: 15, top: 75, size: 16, isRed: false },
    { symbol: '9', left: 78, top: 55, size: 16, isRed: false },
    { symbol: '8', left: 28, top: 62, size: 16, isRed: false },
    { symbol: '7', left: 68, top: 8, size: 16, isRed: false },
    { symbol: '6', left: 5, top: 88, size: 14, isRed: false },
    { symbol: '5', left: 92, top: 42, size: 16, isRed: false },
    { symbol: '4', left: 48, top: 52, size: 14, isRed: false },
    { symbol: '3', left: 85, top: 68, size: 14, isRed: false },
    { symbol: '2', left: 58, top: 15, size: 16, isRed: false },
  ],
  // Pattern 6
  [
    { symbol: '♠', left: 18, top: 12, size: 24, isRed: false },
    { symbol: '♥', left: 58, top: 28, size: 22, isRed: true },
    { symbol: '♦', left: 82, top: 45, size: 20, isRed: true },
    { symbol: '♣', left: 28, top: 68, size: 22, isRed: false },
    { symbol: 'A', left: 72, top: 82, size: 18, isRed: false },
    { symbol: 'K', left: 5, top: 35, size: 16, isRed: false },
    { symbol: 'Q', left: 45, top: 55, size: 16, isRed: false },
    { symbol: 'J', left: 88, top: 18, size: 18, isRed: false },
    { symbol: '10', left: 12, top: 58, size: 16, isRed: false },
    { symbol: '9', left: 65, top: 62, size: 16, isRed: false },
    { symbol: '8', left: 35, top: 8, size: 16, isRed: false },
    { symbol: '7', left: 92, top: 72, size: 16, isRed: false },
    { symbol: '6', left: 52, top: 85, size: 14, isRed: false },
    { symbol: '5', left: 8, top: 82, size: 16, isRed: false },
    { symbol: '4', left: 78, top: 5, size: 14, isRed: false },
    { symbol: '3', left: 42, top: 42, size: 14, isRed: false },
    { symbol: '2', left: 22, top: 88, size: 16, isRed: false },
  ],
  // Pattern 7
  [
    { symbol: '♠', left: 65, top: 8, size: 22, isRed: false },
    { symbol: '♥', left: 8, top: 32, size: 20, isRed: true },
    { symbol: '♦', left: 45, top: 52, size: 22, isRed: true },
    { symbol: '♣', left: 85, top: 38, size: 22, isRed: false },
    { symbol: 'A', left: 22, top: 75, size: 18, isRed: false },
    { symbol: 'K', left: 72, top: 65, size: 16, isRed: false },
    { symbol: 'Q', left: 38, top: 18, size: 16, isRed: false },
    { symbol: 'J', left: 88, top: 85, size: 18, isRed: false },
    { symbol: '10', left: 55, top: 28, size: 16, isRed: false },
    { symbol: '9', left: 15, top: 58, size: 16, isRed: false },
    { symbol: '8', left: 78, top: 22, size: 16, isRed: false },
    { symbol: '7', left: 32, top: 85, size: 16, isRed: false },
    { symbol: '6', left: 62, top: 78, size: 14, isRed: false },
    { symbol: '5', left: 5, top: 12, size: 16, isRed: false },
    { symbol: '4', left: 92, top: 55, size: 14, isRed: false },
    { symbol: '3', left: 48, top: 68, size: 14, isRed: false },
    { symbol: '2', left: 25, top: 42, size: 16, isRed: false },
  ],
  // Pattern 8
  [
    { symbol: '♠', left: 42, top: 12, size: 24, isRed: false },
    { symbol: '♥', left: 82, top: 35, size: 22, isRed: true },
    { symbol: '♦', left: 18, top: 55, size: 20, isRed: true },
    { symbol: '♣', left: 65, top: 78, size: 22, isRed: false },
    { symbol: 'A', left: 8, top: 22, size: 18, isRed: false },
    { symbol: 'K', left: 55, top: 45, size: 16, isRed: false },
    { symbol: 'Q', left: 28, top: 85, size: 16, isRed: false },
    { symbol: 'J', left: 92, top: 65, size: 18, isRed: false },
    { symbol: '10', left: 75, top: 12, size: 16, isRed: false },
    { symbol: '9', left: 12, top: 72, size: 16, isRed: false },
    { symbol: '8', left: 48, top: 32, size: 16, isRed: false },
    { symbol: '7', left: 85, top: 88, size: 16, isRed: false },
    { symbol: '6', left: 35, top: 62, size: 14, isRed: false },
    { symbol: '5', left: 72, top: 52, size: 16, isRed: false },
    { symbol: '4', left: 5, top: 42, size: 14, isRed: false },
    { symbol: '3', left: 58, top: 8, size: 14, isRed: false },
    { symbol: '2', left: 22, top: 28, size: 16, isRed: false },
  ],
  // Pattern 9
  [
    { symbol: '♠', left: 88, top: 18, size: 22, isRed: false },
    { symbol: '♥', left: 25, top: 38, size: 20, isRed: true },
    { symbol: '♦', left: 62, top: 55, size: 22, isRed: true },
    { symbol: '♣', left: 8, top: 75, size: 22, isRed: false },
    { symbol: 'A', left: 45, top: 82, size: 18, isRed: false },
    { symbol: 'K', left: 78, top: 48, size: 16, isRed: false },
    { symbol: 'Q', left: 15, top: 12, size: 16, isRed: false },
    { symbol: 'J', left: 52, top: 25, size: 18, isRed: false },
    { symbol: '10', left: 35, top: 65, size: 16, isRed: false },
    { symbol: '9', left: 85, top: 72, size: 16, isRed: false },
    { symbol: '8', left: 68, top: 8, size: 16, isRed: false },
    { symbol: '7', left: 5, top: 52, size: 16, isRed: false },
    { symbol: '6', left: 92, top: 88, size: 14, isRed: false },
    { symbol: '5', left: 42, top: 45, size: 16, isRed: false },
    { symbol: '4', left: 72, top: 32, size: 14, isRed: false },
    { symbol: '3', left: 28, top: 88, size: 14, isRed: false },
    { symbol: '2', left: 58, top: 68, size: 16, isRed: false },
  ],
  // Pattern 10
  [
    { symbol: '♠', left: 15, top: 8, size: 24, isRed: false },
    { symbol: '♥', left: 72, top: 25, size: 22, isRed: true },
    { symbol: '♦', left: 38, top: 48, size: 20, isRed: true },
    { symbol: '♣', left: 85, top: 68, size: 22, isRed: false },
    { symbol: 'A', left: 25, top: 78, size: 18, isRed: false },
    { symbol: 'K', left: 58, top: 12, size: 16, isRed: false },
    { symbol: 'Q', left: 8, top: 45, size: 16, isRed: false },
    { symbol: 'J', left: 92, top: 35, size: 18, isRed: false },
    { symbol: '10', left: 48, top: 65, size: 16, isRed: false },
    { symbol: '9', left: 18, top: 28, size: 16, isRed: false },
    { symbol: '8', left: 78, top: 85, size: 16, isRed: false },
    { symbol: '7', left: 42, top: 22, size: 16, isRed: false },
    { symbol: '6', left: 65, top: 52, size: 14, isRed: false },
    { symbol: '5', left: 5, top: 88, size: 16, isRed: false },
    { symbol: '4', left: 88, top: 8, size: 14, isRed: false },
    { symbol: '3', left: 32, top: 72, size: 14, isRed: false },
    { symbol: '2', left: 55, top: 38, size: 16, isRed: false },
  ],
  // Pattern 11
  [
    { symbol: '♠', left: 52, top: 5, size: 22, isRed: false },
    { symbol: '♥', left: 12, top: 28, size: 20, isRed: true },
    { symbol: '♦', left: 78, top: 42, size: 22, isRed: true },
    { symbol: '♣', left: 35, top: 65, size: 22, isRed: false },
    { symbol: 'A', left: 88, top: 82, size: 18, isRed: false },
    { symbol: 'K', left: 22, top: 52, size: 16, isRed: false },
    { symbol: 'Q', left: 65, top: 18, size: 16, isRed: false },
    { symbol: 'J', left: 5, top: 72, size: 18, isRed: false },
    { symbol: '10', left: 45, top: 35, size: 16, isRed: false },
    { symbol: '9', left: 92, top: 58, size: 16, isRed: false },
    { symbol: '8', left: 28, top: 88, size: 16, isRed: false },
    { symbol: '7', left: 72, top: 68, size: 16, isRed: false },
    { symbol: '6', left: 58, top: 85, size: 14, isRed: false },
    { symbol: '5', left: 8, top: 12, size: 16, isRed: false },
    { symbol: '4', left: 82, top: 25, size: 14, isRed: false },
    { symbol: '3', left: 42, top: 48, size: 14, isRed: false },
    { symbol: '2', left: 15, top: 85, size: 16, isRed: false },
  ],
  // Pattern 12
  [
    { symbol: '♠', left: 85, top: 12, size: 24, isRed: false },
    { symbol: '♥', left: 35, top: 32, size: 22, isRed: true },
    { symbol: '♦', left: 68, top: 55, size: 20, isRed: true },
    { symbol: '♣', left: 12, top: 75, size: 22, isRed: false },
    { symbol: 'A', left: 55, top: 18, size: 18, isRed: false },
    { symbol: 'K', left: 8, top: 42, size: 16, isRed: false },
    { symbol: 'Q', left: 78, top: 78, size: 16, isRed: false },
    { symbol: 'J', left: 45, top: 62, size: 18, isRed: false },
    { symbol: '10', left: 92, top: 45, size: 16, isRed: false },
    { symbol: '9', left: 22, top: 58, size: 16, isRed: false },
    { symbol: '8', left: 62, top: 8, size: 16, isRed: false },
    { symbol: '7', left: 28, top: 85, size: 16, isRed: false },
    { symbol: '6', left: 75, top: 35, size: 14, isRed: false },
    { symbol: '5', left: 5, top: 18, size: 16, isRed: false },
    { symbol: '4', left: 88, top: 88, size: 14, isRed: false },
    { symbol: '3', left: 52, top: 42, size: 14, isRed: false },
    { symbol: '2', left: 38, top: 72, size: 16, isRed: false },
  ],
  // Pattern 13
  [
    { symbol: '♠', left: 28, top: 18, size: 22, isRed: false },
    { symbol: '♥', left: 75, top: 38, size: 20, isRed: true },
    { symbol: '♦', left: 48, top: 62, size: 22, isRed: true },
    { symbol: '♣', left: 8, top: 82, size: 22, isRed: false },
    { symbol: 'A', left: 92, top: 22, size: 18, isRed: false },
    { symbol: 'K', left: 38, top: 45, size: 16, isRed: false },
    { symbol: 'Q', left: 62, top: 8, size: 16, isRed: false },
    { symbol: 'J', left: 18, top: 55, size: 18, isRed: false },
    { symbol: '10', left: 85, top: 72, size: 16, isRed: false },
    { symbol: '9', left: 55, top: 32, size: 16, isRed: false },
    { symbol: '8', left: 5, top: 35, size: 16, isRed: false },
    { symbol: '7', left: 72, top: 85, size: 16, isRed: false },
    { symbol: '6', left: 42, top: 78, size: 14, isRed: false },
    { symbol: '5', left: 15, top: 8, size: 16, isRed: false },
    { symbol: '4', left: 88, top: 52, size: 14, isRed: false },
    { symbol: '3', left: 32, top: 28, size: 14, isRed: false },
    { symbol: '2', left: 68, top: 58, size: 16, isRed: false },
  ],
  // Pattern 14
  [
    { symbol: '♠', left: 62, top: 8, size: 24, isRed: false },
    { symbol: '♥', left: 15, top: 35, size: 22, isRed: true },
    { symbol: '♦', left: 88, top: 52, size: 20, isRed: true },
    { symbol: '♣', left: 42, top: 75, size: 22, isRed: false },
    { symbol: 'A', left: 5, top: 62, size: 18, isRed: false },
    { symbol: 'K', left: 72, top: 28, size: 16, isRed: false },
    { symbol: 'Q', left: 28, top: 82, size: 16, isRed: false },
    { symbol: 'J', left: 78, top: 68, size: 18, isRed: false },
    { symbol: '10', left: 52, top: 22, size: 16, isRed: false },
    { symbol: '9', left: 8, top: 88, size: 16, isRed: false },
    { symbol: '8', left: 35, top: 48, size: 16, isRed: false },
    { symbol: '7', left: 92, top: 15, size: 16, isRed: false },
    { symbol: '6', left: 22, top: 12, size: 14, isRed: false },
    { symbol: '5', left: 65, top: 42, size: 16, isRed: false },
    { symbol: '4', left: 85, top: 85, size: 14, isRed: false },
    { symbol: '3', left: 48, top: 55, size: 14, isRed: false },
    { symbol: '2', left: 12, top: 48, size: 16, isRed: false },
  ],
  // Pattern 15
  [
    { symbol: '♠', left: 38, top: 12, size: 22, isRed: false },
    { symbol: '♥', left: 82, top: 28, size: 20, isRed: true },
    { symbol: '♦', left: 22, top: 52, size: 22, isRed: true },
    { symbol: '♣', left: 68, top: 68, size: 22, isRed: false },
    { symbol: 'A', left: 8, top: 85, size: 18, isRed: false },
    { symbol: 'K', left: 55, top: 38, size: 16, isRed: false },
    { symbol: 'Q', left: 92, top: 55, size: 16, isRed: false },
    { symbol: 'J', left: 45, top: 78, size: 18, isRed: false },
    { symbol: '10', left: 75, top: 8, size: 16, isRed: false },
    { symbol: '9', left: 12, top: 32, size: 16, isRed: false },
    { symbol: '8', left: 62, top: 22, size: 16, isRed: false },
    { symbol: '7', left: 28, top: 72, size: 16, isRed: false },
    { symbol: '6', left: 85, top: 82, size: 14, isRed: false },
    { symbol: '5', left: 5, top: 58, size: 16, isRed: false },
    { symbol: '4', left: 52, top: 5, size: 14, isRed: false },
    { symbol: '3', left: 78, top: 45, size: 14, isRed: false },
    { symbol: '2', left: 35, top: 88, size: 16, isRed: false },
  ],
  // Pattern 16
  [
    { symbol: '♠', left: 5, top: 5, size: 22, isRed: false },
    { symbol: '♥', left: 92, top: 18, size: 20, isRed: true },
    { symbol: '♦', left: 45, top: 35, size: 22, isRed: true },
    { symbol: '♣', left: 78, top: 58, size: 22, isRed: false },
    { symbol: 'A', left: 18, top: 72, size: 18, isRed: false },
    { symbol: 'K', left: 68, top: 12, size: 16, isRed: false },
    { symbol: 'Q', left: 32, top: 55, size: 16, isRed: false },
    { symbol: 'J', left: 88, top: 78, size: 18, isRed: false },
    { symbol: '10', left: 55, top: 82, size: 16, isRed: false },
    { symbol: '9', left: 12, top: 42, size: 16, isRed: false },
    { symbol: '8', left: 75, top: 35, size: 16, isRed: false },
    { symbol: '7', left: 42, top: 8, size: 16, isRed: false },
    { symbol: '6', left: 85, top: 88, size: 14, isRed: false },
    { symbol: '5', left: 8, top: 88, size: 16, isRed: false },
    { symbol: '4', left: 62, top: 48, size: 14, isRed: false },
    { symbol: '3', left: 28, top: 25, size: 14, isRed: false },
    { symbol: '2', left: 52, top: 65, size: 16, isRed: false },
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
      opacity: 0;
      animation: symbolFadeIn 1s ease-out forwards;
    }
    @keyframes symbolFadeIn {
      0% { opacity: 0; transform: scale(0.8); }
      100% { opacity: 0.25; transform: scale(1); }
    }
  `;

  symbols.forEach((s, i) => {
    // Stagger the fade-in for each symbol (50ms apart)
    const delay = i * 0.05;
    css += `
    .instant-symbol-${i} {
      left: ${s.left}%;
      top: ${s.top}%;
      font-size: ${s.size}px;
      color: ${s.isRed ? '#5a3535' : '#3a3a3a'};
      animation-delay: ${delay}s;
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
