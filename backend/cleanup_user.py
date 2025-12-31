#!/usr/bin/env python3
"""
Cleanup script to delete all data for a specific user.
Use this to test the full pipeline flow.
"""

import os
import sys
import psycopg2

# Load .env file manually
env_path = os.path.join(os.path.dirname(__file__), '.env')
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ.setdefault(k.strip(), v.strip())

DB_URL = os.getenv("DATABASE_URL")
if not DB_URL:
    print("ERROR: DATABASE_URL not set in .env")
    sys.exit(1)

USER_ID = "740a2347-089c-4f8a-b276-39421e9dba66"

def cleanup_user_data():
    print(f"Cleaning up data for user: {USER_ID}")
    
    conn = psycopg2.connect(DB_URL)
    cur = conn.cursor()
    
    try:
        # 1. Delete study chunks
        cur.execute("DELETE FROM public.study_chunks WHERE user_id = %s", (USER_ID,))
        print(f"  Deleted {cur.rowcount} study_chunks")
        
        # 2. Delete hands_silver
        cur.execute("DELETE FROM public.hands_silver WHERE user_id = %s", (USER_ID,))
        print(f"  Deleted {cur.rowcount} hands_silver rows")
        
        # 3. Delete hands
        cur.execute("DELETE FROM public.hands WHERE user_id = %s", (USER_ID,))
        print(f"  Deleted {cur.rowcount} hands")
        
        # 4. Reset hand_files (delete or set status to 'new')
        cur.execute("DELETE FROM public.hand_files WHERE user_id = %s", (USER_ID,))
        print(f"  Deleted {cur.rowcount} hand_files")
        
        conn.commit()
        print("\n✅ Cleanup complete! Ready for re-upload test.")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    cleanup_user_data()
