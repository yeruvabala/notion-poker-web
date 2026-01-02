#!/usr/bin/env python3
import psycopg2
import os
from dotenv import load_dotenv

load_dotenv('backend/.env')
DB_URL = os.getenv('DATABASE_URL')

def manual_reset():
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False  # Explicit transaction
    
    cur = conn.cursor()
    
    print("Resetting gto_strategy for 3 most recent hands...")
    cur.execute("""
        UPDATE hands 
        SET gto_strategy = NULL,
            hero_classification = NULL
        WHERE id IN (
            SELECT id FROM hands 
            ORDER BY created_at DESC 
            LIMIT 3
        )
    """)
    
    count = cur.rowcount
    print(f"Rows affected: {count}")
    
    conn.commit()
    print("✅ Committed!")
    
    # Verify
    cur.execute("""
        SELECT COUNT(*) 
        FROM hands 
        WHERE gto_strategy IS NULL
    """)
    
    null_count = cur.fetchone()[0]
    print(f"Hands with NULL gto_strategy: {null_count}")
    
    cur.close()
    conn.close()

if __name__ == "__main__":
    manual_reset()
