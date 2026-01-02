#!/usr/bin/env python3
"""
Debug script to check what's in the database for recent hands
"""
import psycopg2
import json
import os
from dotenv import load_dotenv

# Load environment
load_dotenv('backend/.env')

DB_URL = os.getenv('DATABASE_URL')

def check_recent_hands():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    # First, get the column names
    cur.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = 'hands'
        ORDER BY ordinal_position
    """)
    
    print("Available columns in 'hands' table:")
    columns = [row[0] for row in cur.fetchall()]
    print(", ".join(columns))
    print("\n" + "=" * 80)
    
    # Get the most recent 3 hands
    cur.execute("""
        SELECT 
            id,
            cards,
            position,
            gto_strategy,
            hero_classification
        FROM hands 
        ORDER BY created_at DESC 
        LIMIT 3
    """)
    
    print("RECENT HANDS IN DATABASE")
    print("=" * 80)
    
    for row in cur.fetchall():
        hand_id, cards, position, gto_strategy, hero_class = row
        
        print(f"\n📋 Hand ID: {hand_id}")
        print(f"   Position: {position}")
        print(f"   Hand: {cards}")
        print(f"   Classification: {hero_class}")
        
        if gto_strategy:
            # Parse and show first 800 chars
            print(f"\n   GTO Strategy (first 800 chars):")
            print(f"   {gto_strategy[:800]}")
            
            # Try to detect if it has "vs 3-bet" in it
            if "vs 3-bet" in gto_strategy.lower() or "vs 3bet" in gto_strategy.lower():
                print("\n   ✅ CONTAINS 'vs 3-bet' text!")
            else:
                print("\n   ❌ MISSING 'vs 3-bet' text")
        else:
            print("   ⚠️  No GTO strategy found")
        
        print("-" * 80)
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    check_recent_hands()
