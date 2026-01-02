#!/usr/bin/env python3
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('backend/.env')
DB_URL = os.getenv('DATABASE_URL')

def check_null_hands():
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    # Check how many hands have NULL gto_strategy
    cur.execute("""
        SELECT COUNT(*) 
        FROM hands 
        WHERE gto_strategy IS NULL AND raw_text IS NOT NULL
    """)
    
    count = cur.fetchone()[0]
    print(f"Hands with NULL gto_strategy AND raw_text: {count}")
    
    # Show the most recent 3 hands' gto_strategy status
    cur.execute("""
        SELECT 
            id,
            cards,
            CASE WHEN gto_strategy IS NULL THEN 'NULL' ELSE 'HAS VALUE' END as gto_status,
            CASE WHEN raw_text IS NULL THEN 'NULL' ELSE 'HAS VALUE' END as raw_status
        FROM hands 
        ORDER BY created_at DESC 
        LIMIT 3
    """)
    
    print("\nMost recent 3 hands:")
    for row in cur.fetchall():
        print(f"  {row[0][:8]}... | {row[1]} | GTO: {row[2]} | Raw: {row[3]}")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    check_null_hands()
