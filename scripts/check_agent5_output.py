#!/usr/bin/env python3
"""
Check what Agent 5 actually returned
"""
import psycopg2
import json
import os
from dotenv import load_dotenv

load_dotenv('backend/.env')
DB_URL = os.getenv('DATABASE_URL')

def check_strategy_json():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    # Get raw replayer_data to check what agent5 actually returned
    cur.execute("""
        SELECT 
            raw_text
        FROM hands 
        ORDER BY created_at DESC 
        LIMIT 1
    """)
    
    row = cur.fetchone()
    raw_text = row[0] if row else None
    
    if not raw_text:
        print("No raw_text")
        cur.close()
        conn.close()
        return
    
    # The raw_text might contain the API response
    # But actually we need to call the API endpoint ourselves
    # Let me write a simpler test instead
    
    print("Raw text (first 500 chars):")
    print(raw_text[:500])
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    check_strategy_json()
