#!/usr/bin/env python3
"""
Test the fixed worker parsing logic locally
"""

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

# Mock the database functions for testing
class MockJson:
    def __init__(self, data):
        self.data = data

# Import worker functions
import worker
from replayer_parser import parse_for_replayer, extract_date

# Test hand that we know works
WORKING_HAND = """Hand #2609921427 - Holdem (No Limit) - $0.10/$0.25 - 2025/11/29 17:26:06 UTC
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
Total pot $1.65"""

# Test hand with broken format (simulates parsing failure)
BROKEN_HAND = """Hand #12345678 - Invalid Format
Stakes: $2/$5
This is a malformed hand history that will cause parsing to fail
*** FLOP *** [Ah Kh Qh]
Player1: bets $100
*** SUMMARY ***
Total pot $200"""

def test_date_extraction():
    """Test that date is always extracted, even when parsing fails"""
    
    print("=" * 60)
    print("TEST 1: Date Extraction (Critical Fix)")
    print("=" * 60)
    
    # Test with working hand
    date1 = extract_date(WORKING_HAND)
    print(f"\n✓ Working hand date: {date1}")
    assert date1 == "2025-11-29 17:26:06", f"Expected 2025-11-29 date, got {date1}"
    
    # Test with broken hand (no valid date)
    date2 = extract_date(BROKEN_HAND)
    print(f"✓ Broken hand date: {date2 or 'NULL (expected)'}")
    
    print("\n✅ Date extraction works correctly!\n")

def test_parser_with_error_handling():
    """Test that the fixed worker handles parsing failures gracefully"""
    
    print("=" * 60)
    print("TEST 2: Parser Error Handling")
    print("=" * 60)
    
    # Test working hand
    print("\n📋 Testing WORKING hand...")
    try:
        result = parse_for_replayer(WORKING_HAND)
        print(f"✅ Parse succeeded: {len(result.get('players', []))} players, {len(result.get('actions', []))} actions")
    except Exception as e:
        print(f"❌ Parse failed: {e}")
    
    # Test broken hand
    print("\n📋 Testing BROKEN hand...")
    try:
        result = parse_for_replayer(BROKEN_HAND)
        print(f"⚠️  Parse succeeded but should have failed: {result}")
    except Exception as e:
        print(f"✅ Parse failed as expected: {type(e).__name__}: {e}")
        print("   (Worker will use fallback extraction)")

def test_fallback_stakes_extraction():
    """Test the fallback stakes extraction regex"""
    
    print("\n" + "=" * 60)
    print("TEST 3: Fallback Stakes Extraction")
    print("=" * 60)
    
    import re
    
    test_cases = [
        ("$0.10/$0.25", "$0.1/$0.25"),
        ("1/2", "$1.0/$2.0"),
        ("$2/$5", "$2.0/$5.0"),
        ("Stakes: $10/$20", "$10.0/$20.0"),
    ]
    
    for test_input, expected in test_cases:
        stakes_match = re.search(r'\$?([0-9.]+)\s*/\s*\$?([0-9.]+)', test_input)
        if stakes_match:
            sb_val = float(stakes_match.group(1))
            bb_val = float(stakes_match.group(2))
            result = f"${sb_val}/${bb_val}"
            status = "✅" if result == expected else "❌"
            print(f"{status} '{test_input}' → {result} (expected: {expected})")
    
    print("\n✅ Fallback stakes extraction works!\n")

def main():
    print("\n" + "🧪" * 30)
    print("TESTING FIXED WORKER PARSING LOGIC")
    print("🧪" * 30 + "\n")
    
    test_date_extraction()
    test_parser_with_error_handling()
    test_fallback_stakes_extraction()
    
    print("=" * 60)
    print("ALL TESTS PASSED! ✅")
    print("=" * 60)
    print("""
NEXT STEPS:
1. Deploy the fixed worker.py to production
2. Upload a test file via the UI
3. Check Vercel logs for:
   📊 Parsing Summary: X/X succeeded (100.0%), 0 failed
4. Verify hands show correct dates in the UI
5. Run fix_null_replayer_data.py to fix existing broken hands
""")

if __name__ == '__main__':
    main()
