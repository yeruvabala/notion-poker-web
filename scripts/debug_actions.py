#!/usr/bin/env python3
"""
Debug script to check the actions stored in replayer_data
"""
import psycopg2
import json
import os
from dotenv import load_dotenv

# Load environment
load_dotenv('backend/.env')

DB_URL = os.getenv('DATABASE_URL')

def debug_actions():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    # Get one hand's replayer_data
    cur.execute("""
        SELECT 
            id,
            replayer_data
        FROM hands 
        ORDER BY created_at DESC 
        LIMIT 1
    """)
    
    row = cur.fetchone()
    if not row:
        print("No hands found")
        return
    
    hand_id, replayer_data = row
    
    if not replayer_data:
        print("No replayer_data")
        return
    
    data = json.loads(replayer_data) if isinstance(replayer_data, str) else replayer_data
    actions = data.get('actions', [])
    
    print(f"Hand ID: {hand_id}")
    print(f"\nActions ({len(actions)} total):")
    print("=" * 80)
    
    preflop_actions = [a for a in actions if a.get('street') == 'preflop']
    
    for i, action in enumerate(preflop_actions):
        player = action.get('player', 'unknown')
        action_type = action.get('action', 'unknown')
        amount = action.get('amount', 0)
        
        print(f"{i+1}. {player}: {action_type} ${amount}")
    
    # Count raises
    raises = [a for a in preflop_actions if 'raise' in str(a.get('action', '')).lower()]
    print(f"\nRaises found: {len(raises)}")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    debug_actions()
