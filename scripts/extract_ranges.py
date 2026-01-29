#!/usr/bin/env python3
"""
Script to extract color proportions from GTO Wizard matrix screenshots.
Analyzes each cell in the 13x13 poker hand matrix and outputs the 
percentage of red (3bet/raise), green (call), and blue (fold) in each cell.
"""

from PIL import Image
import json
import sys

# Hand labels for the matrix (row = first card, col = second card)
# Diagonal = pairs, above diagonal = suited, below diagonal = offsuit
RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2']

def get_hand_name(row: int, col: int) -> str:
    """Convert row/col to hand name like 'AKs', 'AKo', 'AA'"""
    r1 = RANKS[row]
    r2 = RANKS[col]
    if row == col:
        return f"{r1}{r2}"  # Pair
    elif row < col:
        return f"{r1}{r2}s"  # Suited (above diagonal)
    else:
        # Offsuit (below diagonal) - always put higher rank first
        return f"{r2}{r1}o"

def classify_pixel(r: int, g: int, b: int) -> str:
    """Classify a pixel as red (3bet/raise/jam), green (call), blue (fold), or other"""
    # Thresholds based on GTO Wizard colors
    # Bright Red: high R, low G, low B (for 3bet/raise)
    # Dark Red/Maroon: moderate R, very low G, very low B (for jam/5bet)
    # Green: low R, high G, low B  
    # Blue: low R, low G, high B
    # Grey/Black: R ≈ G ≈ B (not in range - ignore)
    
    # Check for grey/black first (not in range)
    max_val = max(r, g, b)
    min_val = min(r, g, b)
    # Dark grey/black: very low brightness
    if max_val < 80:
        return 'other'
    # Grey: low saturation (colors are similar)
    if max_val - min_val < 50 and max_val < 160:
        return 'other'
    
    # Check for dark red/maroon first (jam color) - R > G and R > B, with low G and B
    if r > 80 and r > g * 2 and r > b * 2 and g < 80 and b < 80:
        return 'red'
    
    # Check for bright red (3bet)
    if r > 150 and r > g * 1.5 and r > b * 1.5:
        return 'red'
    
    # Check for green (call)
    if g > 150 and g > r * 1.3 and g > b * 1.3:
        return 'green'
    
    # Check for blue (fold) - must be clearly blue, not grey
    if b > 120 and b > r * 1.5 and b > g * 1.2:
        return 'blue'
    
    return 'other'

def analyze_cell(img: Image.Image, x: int, y: int, cell_width: int, cell_height: int) -> dict:
    """Analyze a single cell by measuring color widths along X-axis (normalized to 100%)"""
    # Scan across the middle of the cell horizontally
    margin_x = int(cell_width * 0.05)  # Small margin to avoid borders
    mid_y = y + cell_height // 2  # Middle row of the cell
    
    # Sample a few rows around the middle for robustness
    sample_rows = [mid_y - 5, mid_y, mid_y + 5]
    
    color_at_x = {}  # x_position -> color
    
    for px in range(x + margin_x, x + cell_width - margin_x):
        votes = {'red': 0, 'green': 0, 'blue': 0, 'other': 0}
        for sample_y in sample_rows:
            try:
                pixel = img.getpixel((px, sample_y))
                r, g, b = pixel[:3]
                classification = classify_pixel(r, g, b)
                votes[classification] += 1
            except:
                pass
        # Use majority vote for this x position
        color_at_x[px] = max(votes, key=votes.get)
    
    # Count how many x positions have each color (ignoring 'other')
    red_count = sum(1 for c in color_at_x.values() if c == 'red')
    green_count = sum(1 for c in color_at_x.values() if c == 'green')
    blue_count = sum(1 for c in color_at_x.values() if c == 'blue')
    
    # Normalize to 100% based only on colored positions
    total = red_count + green_count + blue_count
    if total == 0:
        return {'red': 0, 'green': 0, 'blue': 100}  # Default to fold
    
    red_pct = red_count / total * 100
    green_pct = green_count / total * 100
    blue_pct = blue_count / total * 100
    
    # Round near-pure cells to 100%
    if red_pct > 92:
        return {'red': 100.0, 'green': 0.0, 'blue': 0.0}
    if green_pct > 92:
        return {'red': 0.0, 'green': 100.0, 'blue': 0.0}
    if blue_pct > 92:
        return {'red': 0.0, 'green': 0.0, 'blue': 100.0}
    
    # Round and ensure totals to 100%
    red_pct = round(red_pct, 1)
    green_pct = round(green_pct, 1)
    blue_pct = round(blue_pct, 1)
    
    total_pct = red_pct + green_pct + blue_pct
    if total_pct != 100.0:
        diff = 100.0 - total_pct
        if red_pct >= green_pct and red_pct >= blue_pct:
            red_pct = round(red_pct + diff, 1)
        elif green_pct >= red_pct and green_pct >= blue_pct:
            green_pct = round(green_pct + diff, 1)
        else:
            blue_pct = round(blue_pct + diff, 1)
    
    return {
        'red': red_pct,
        'green': green_pct,
        'blue': blue_pct
    }

def analyze_matrix(image_path: str, grid_x: int = 0, grid_y: int = 0, 
                   grid_width: int = None, grid_height: int = None) -> dict:
    """Analyze the full 13x13 matrix and return all hand proportions"""
    img = Image.open(image_path)
    
    if grid_width is None:
        grid_width = img.width
    if grid_height is None:
        grid_height = img.height
    
    cell_width = grid_width // 13
    cell_height = grid_height // 13
    
    results = {}
    
    for row in range(13):
        for col in range(13):
            hand = get_hand_name(row, col)
            x = grid_x + col * cell_width
            y = grid_y + row * cell_height
            
            proportions = analyze_cell(img, x, y, cell_width, cell_height)
            results[hand] = proportions
    
    return results

def format_for_typescript(results: dict) -> str:
    """Format results as TypeScript code"""
    lines = []
    
    # Group by action
    threebets = {}
    calls = {}
    
    for hand, props in results.items():
        if props['red'] >= 5:  # At least 5% 3bet frequency
            threebets[hand] = props['red'] / 100
        if props['green'] >= 5:  # At least 5% call frequency
            calls[hand] = props['green'] / 100
    
    lines.append("'3bet': {")
    for hand, freq in sorted(threebets.items(), key=lambda x: -x[1]):
        lines.append(f"    '{hand}': {freq:.2f},")
    lines.append("},")
    
    lines.append("'call': {")
    for hand, freq in sorted(calls.items(), key=lambda x: -x[1]):
        lines.append(f"    '{hand}': {freq:.2f},")
    lines.append("},")
    
    return "\n".join(lines)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python extract_ranges.py <image_path> [grid_x] [grid_y] [grid_width] [grid_height]")
        sys.exit(1)
    
    image_path = sys.argv[1]
    
    # Optional grid coordinates
    grid_x = int(sys.argv[2]) if len(sys.argv) > 2 else 0
    grid_y = int(sys.argv[3]) if len(sys.argv) > 3 else 0
    grid_width = int(sys.argv[4]) if len(sys.argv) > 4 else None
    grid_height = int(sys.argv[5]) if len(sys.argv) > 5 else None
    
    print(f"Analyzing {image_path}...")
    results = analyze_matrix(image_path, grid_x, grid_y, grid_width, grid_height)
    
    print("\n=== Raw Results ===")
    for hand, props in results.items():
        if props['red'] > 0 or props['green'] > 0:
            print(f"{hand}: 3bet={props['red']}%, call={props['green']}%, fold={props['blue']}%")
    
    print("\n=== TypeScript Format ===")
    print(format_for_typescript(results))
