#!/usr/bin/env python3
"""
Test both hands through the pipeline to see where detection fails
"""

hand1_a9o = """Hand #2609921427 - Holdem (No Limit) - $0.10/$0.25 - 2025/11/29 17:26:06 UTC
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

hand2_ajo = """Hand #2609912076 - Holdem (No Limit) - $0.10/$0.25 - 2025/11/29 17:09:31 UTC
Belle Rive 6-max Seat #4 is the button
Seat 1: namesarehard ($39.05)
Seat 2: Hellliga ($25.00)
Seat 3: huggins ($40.35)
Seat 4: KannyThOP ($56.13)
Seat 5: Arepitarica ($25.11)
Seat 6: Axel14 ($25.00)
Arepitarica posts the small blind $0.10
Axel14 posts the big blind $0.25
*** HOLE CARDS ***
Dealt to KannyThOP [As Jh]
namesarehard folds
Hellliga folds
huggins folds
KannyThOP raises $0.70 to $0.70
Arepitarica raises $2.90 to $3.00
Axel14 folds
KannyThOP calls $2.30
*** FLOP *** [Tc 5s Js]
Main pot $5.94 | Rake $0.31
Arepitarica bets $2.56
KannyThOP calls $2.56
*** TURN *** [Tc 5s Js] [Ah]
Main pot $10.81 | Rake $0.56
Arepitarica checks
KannyThOP bets $7.40
Arepitarica folds
Uncalled bet ($7.40) returned to KannyThOP
KannyThOP does not show
*** SUMMARY ***
Total pot $10.81 | Rake $0.38 | JP Fee $0.18
Board [Tc 5s Js Ah]
Seat 1: namesarehard folded on the Pre-Flop and did not bet
Seat 2: Hellliga folded on the Pre-Flop and did not bet
Seat 3: huggins folded on the Pre-Flop and did not bet
Seat 4: KannyThOP did not show and won $10.81
Seat 5: Arepitarica (small blind) folded on the Turn
Seat 6: Axel14 (big blind) folded on the Pre-Flop"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

from replayer_parser import parse_for_replayer

def test_hand(name, raw_text, expected_hand):
    print(f"\n{'='*60}")
    print(f"Testing: {name}")
    print(f"{'='*60}")
    
    data = parse_for_replayer(raw_text)
    
    # Find hero
    hero = next((p for p in data.get('players', []) if p.get('isHero')), None)
    if hero:
        cards = hero.get('cards', [])
        position = hero.get('position')
        print(f"✓ Hero cards: {' '.join(cards) if cards else 'NONE'}")
        print(f"✓ Hero position: {position}")
    
    # Check actions
    actions = data.get('actions', [])
    print(f"\n📋 Actions detected:")
    
    hero_open = None
    sb_3bet = None
    
    for i, action in enumerate(actions):
        player = action.get('player')
        act = action.get('action')
        amount = action.get('amount')
        street = action.get('street')
        
        # Detect hero opening raise
        if hero and player == hero['name'] and act in ['raiseTo', 'raise'] and street == 'preflop':
            hero_open = action
            print(f"  {i+1}. ✓ HERO OPENS: {act} to ${amount}")
        # Detect SB 3-bet
        elif player != (hero['name'] if hero else None) and act in ['raiseTo', 'raise'] and street == 'preflop':
            if hero_open:  # Only count as 3-bet if hero already opened
                sb_3bet = action
                print(f"  {i+1}. ✓ VILLAIN 3-BETS: {player} {act} to ${amount}")
        else:
            print(f"  {i+1}. {player}: {act} {f'${amount}' if amount else ''}")
    
    # Check if hand went to flop
    went_to_flop = any(a['street'] in ['flop', 'turn', 'river'] for a in actions)
    
    print(f"\n🎯 Detection Summary:")
    print(f"  Hero opened: {'YES ✓' if hero_open else 'NO ✗'}")
    print(f"  SB 3-bet: {'YES ✓' if sb_3bet else 'NO ✗'}")
    print(f"  Went to flop: {'YES' if went_to_flop else 'NO (folded preflop)'}")
    
    print(f"\n📊 Expected Pipeline Behavior:")
    if hero_open and sb_3bet:
        print(f"  ✓ Should detect: BTN vs SB 3-bet scenario")
        print(f"  ✓ Should show: Initial action + vs 3-bet response")
    elif hero_open and not sb_3bet:
        print(f"  ⚠️  Should detect: RFI only")
        print(f"  ✗ Problem: 3-bet not detected!")
    
    return {
        'hero_opened': bool(hero_open),
        'sb_3bet': bool(sb_3bet),
        'went_to_flop': went_to_flop
    }

if __name__ == '__main__':
    print("\n" + "🧪" * 30)
    print("TESTING 3-BET DETECTION")
    print("🧪" * 30)
    
    result1 = test_hand("Hand 1 (A9o - Folded Preflop)", hand1_a9o, "A9o")
    result2 = test_hand("Hand 2 (AJo - Went to Flop)", hand2_ajo, "AJo")
    
    print(f"\n{'='*60}")
    print("COMPARISON")
    print(f"{'='*60}")
    print(f"A9o (folded PF): Hero opened={result1['hero_opened']}, 3-bet detected={result1['sb_3bet']}")
    print(f"AJo (to flop):   Hero opened={result2['hero_opened']}, 3-bet detected={result2['sb_3bet']}")
    
    if result1['sb_3bet'] and result2['sb_3bet']:
        print(f"\n✅ BOTH HANDS DETECT 3-BET CORRECTLY")
        print(f"   → Issue is in frontend pipeline detection, not parser")
    elif not result1['sb_3bet'] and result2['sb_3bet']:
        print(f"\n❌ INCONSISTENT: Only AJo detects 3-bet")
        print(f"   → Parser logic issue with preflop-ending hands")
    else:
        print(f"\n❌ NEITHER HAND DETECTS 3-BET")
        print(f"   → Parser totally broken")
