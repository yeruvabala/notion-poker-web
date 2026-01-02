#!/usr/bin/env python3
"""
Force immediate re-analysis of hands with new code.
This script atomically resets and re-analyzes to avoid race conditions.
"""
import sys
import os
sys.path.append(os.getcwd())

import psycopg2
from backend.coach_worker import get_pg_conn, coach_new_hands, load_env_file, call_coach_api
from backend.coach_worker import annotate_raw_text_with_positions, extract_parsed_data, update_hand_with_coach

print("🔧 Force Analyze Script - Will reset and immediately re-analyze")
print("=" * 70)

# Load environment
load_env_file("backend/.env")

# Get connection
conn = psycopg2.connect(os.getenv('DATABASE_URL'))
conn.autocommit = False  # Use transactions

try:
    cur = conn.cursor()
    
    # Step 1: Reset 3 most recent hands
    print("\n📋 Step 1: Resetting 3 most recent hands...")
    cur.execute("""
        UPDATE hands 
        SET gto_strategy = NULL,
            hero_classification = NULL
        WHERE id IN (
            SELECT id FROM hands 
            ORDER BY created_at DESC 
            LIMIT 3
        )
        RETURNING id, raw_text, replayer_data
    """)
    
    hands_to_analyze = cur.fetchall()
    print(f"   ✅ Reset {len(hands_to_analyze)} hands")
    
    conn.commit()
    
    # Step 2: Immediately re-analyze them
    print("\n🧠 Step 2: Re-analyzing with new code...")
    
    for row in hands_to_analyze:
        hand_id, raw_text, replayer_data = row
        print(f"\n   Analyzing hand {str(hand_id)[:8]}...")
        
        replayer_dict = replayer_data if isinstance(replayer_data, dict) else {}
        annotated_raw_text = annotate_raw_text_with_positions(raw_text, replayer_dict)
        
        # Call API
        response = call_coach_api(hand_id, annotated_raw_text, None, replayer_dict)
        
        if response:
            gto = response.get('gto_strategy', '')
            
            # Check if it has "vs 3-bet"
            if 'vs 3-bet' in gto.lower() or 'vs 3bet' in gto.lower():
                print(f"   ✅ SUCCESS! Contains 'vs 3-bet' text!")
                print(f"   First 300 chars: {gto[:300]}")
            else:
                print(f"   ❌ MISSING 'vs 3-bet' text")
                print(f"   First 300 chars: {gto[:300]}")
            
            # Update database
            update_hand_with_coach(
                conn, hand_id,
                response.get('gto_strategy'),
                response.get('exploit_deviation'),
                response.get('learning_tag', []),
                response.get('exploit_signals'),
                response.get('hero_position'),
                response.get('hero_classification'),
                response.get('spr_analysis'),
                response.get('mistake_analysis')
            )
        else:
            print(f"   ❌ API call failed")
    
    conn.commit()
    print("\n✅ All hands re-analyzed and saved!")
    
except Exception as e:
    print(f"\n❌ Error: {e}")
    conn.rollback()
finally:
    conn.close()

print("\n" + "=" * 70)
print("Done! Check your localhost and refresh the page.")
