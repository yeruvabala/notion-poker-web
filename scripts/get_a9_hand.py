#!/usr/bin/env python3
"""
Get the A9o hand's raw text to paste into test script
"""
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('backend/.env')
DB_URL = os.getenv('DATABASE_URL')

def get_a9_hand():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    cur.execute("""
        SELECT 
            raw_text
        FROM hands 
        WHERE cards = '9♦ A♥'
        ORDER BY created_at DESC 
        LIMIT 1
    """)
    
    row = cur.fetchone()
    if row and row[0]:
        # Save to a file
        with open('a9o_hand.txt', 'w') as f:
            f.write(row[0])
        print("✅ Saved A9o hand to a9o_hand.txt")
        print("\nFirst 500 chars:")
        print(row[0][:500])
    else:
        print("❌ No A9o hand found")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    get_a9_hand()
