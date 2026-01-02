#!/usr/bin/env python3
"""Test parsing Belle Rive hand format"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from replayer_parser import parse_for_replayer
import json

hand_text = """Hand #2609921427 - Holdem (No Limit) - $0.10/$0.25 - 2025/11/29 17:26:06 UTC
Belle Rive 6-max Seat #4 is the button
Seat 2: Hellliga ($28.75)
Seat 4: KannyThOP ($65.27)
Seat 5: Arepitarica ($25.45)
Seat 6: Axel14 ($25.00) is sitting out
Arepitarica posts the small blind $0.10
Hellliga posts the big blind $0.25
*** HOLE CARDS ***
Dealt to KannyThOP [9d Ah]
KannyThOP raises $0.70 to $0.70
Arepitarica raises $2.90 to $3.00
Hellliga folds
KannyThOP folds
Uncalled bet ($2.30) returned to Arepitarica
Arepitarica does not show
*** SUMMARY ***
Total pot $1.65
Seat 2: Hellliga (big blind) folded on the Pre-Flop
Seat 4: KannyThOP (button) folded on the Pre-Flop
Seat 5: Arepitarica did not show and won $1.65"""

print("Testing Belle Rive hand parsing...\n")
print("Hand text:")
print("=" * 60)
print(hand_text)
print("=" * 60)

try:
    result = parse_for_replayer(hand_text)
    print("\n✅ PARSING SUCCEEDED!\n")
    print("Result:")
    print(json.dumps(result, indent=2))
    
    # Check key fields
    print("\n" + "=" * 60)
    print("KEY FIELDS CHECK:")
    print("=" * 60)
    print(f"Hero: {result.get('hero', 'MISSING')}")
    print(f"Stakes (sb/bb): ${result.get('sb', 'MISSING')}/${result.get('bb', 'MISSING')}")
    print(f"Players: {len(result.get('players', []))} found")
    print(f"Actions: {len(result.get('actions', []))} found")
    print(f"Board: {result.get('board', 'MISSING')}")
    
except Exception as e:
    print("\n❌ PARSING FAILED!\n")
    print(f"Error: {type(e).__name__}: {e}")
    import traceback
    traceback.print_exc()
