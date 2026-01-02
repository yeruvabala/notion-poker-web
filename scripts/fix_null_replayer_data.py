#!/usr/bin/env python3
"""
Fix hands that have raw_text but NULL replayer_data
"""

import os
import sys
from dotenv import load_dotenv
load_dotenv('backend/.env')

import psycopg2
from psycopg2.extras import RealDictCursor, Json

# Add backend to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
from replayer_parser import parse_for_replayer

# Database connection
def get_db():
    return psycopg2.connect(
        dbname=os.getenv('PG_DATABASE'),
        user=os.getenv('PG_USER'),
        password=os.getenv('PG_PASSWORD'),
        host=os.getenv('PG_HOST'),
        port=os.getenv('PG_PORT')
    )

def main():
    conn = get_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # Find hands with raw_text but NULL replayer_data
    cur.execute("""
        SELECT id, raw_text, hero_hand, hero_position
        FROM hands
        WHERE raw_text IS NOT NULL
          AND replayer_data IS NULL
        ORDER BY created_at DESC
        LIMIT 100
    """)
    
    hands = cur.fetchall()
    print(f"Found {len(hands)} hands with NULL replayer_data\n")
    
    if not hands:
        print("✅ All hands have replayer_data!")
        return
    
    fixed = 0
    errors = 0
    
    for hand in hands:
        hand_id = hand['id']
        raw_text = hand['raw_text']
        
        try:
            # Parse the hand
            replayer_data = parse_for_replayer(raw_text)
            
            # Extract metadata
            hero = next((p for p in replayer_data.get('players', []) if p.get('isHero')), None)
            sb = replayer_data.get('sb')
            bb = replayer_data.get('bb')
            stakes = f"${sb}/${bb}" if sb and bb else None
            position = hero.get('position') if hero else None
            cards = ' '.join(hero['cards']) if hero and hero.get('cards') else None
            board_arr = replayer_data.get('board', [])
            board = ' '.join(board_arr) if board_arr else None
            
            # Update the database
            cur.execute("""
                UPDATE hands
                SET replayer_data = %s,
                    hero_position = COALESCE(hero_position, %s),
                    hero_hand = COALESCE(hero_hand, %s),
                    stakes = COALESCE(stakes, %s),
                    board = COALESCE(board, %s)
                WHERE id = %s
            """, (Json(replayer_data), position, cards, stakes, board, hand_id))
            
            print(f"✅ Fixed hand {hand_id[:8]}... ({position or 'UNKNOWN'} / {cards or 'UNKNOWN'})")
            fixed += 1
            
        except Exception as e:
            print(f"❌ Failed to parse hand {hand_id[:8]}...: {e}")
            errors += 1
    
    conn.commit()
    cur.close()
    conn.close()
    
    print(f"\n{'='*60}")
    print(f"SUMMARY:")
    print(f"  Fixed: {fixed}")
    print(f"  Errors: {errors}")
    print(f"{'='*60}")

if __name__ == '__main__':
    main()
