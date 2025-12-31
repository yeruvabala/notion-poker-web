
import os
import sys
import uuid
import datetime

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from coach_worker import get_pg_conn, load_env_file

def prepare_test_user(user_id):
    load_env_file()
    conn = get_pg_conn()
    with conn.cursor() as cur:
        # 1. Clean up existing hands for this user
        print(f"Cleaning existing data for user {user_id}...")
        cur.execute("DELETE FROM hands WHERE user_id = %s", (user_id,))
        cur.execute("DELETE FROM hands_silver WHERE user_id = %s", (user_id,))
        cur.execute("DELETE FROM study_chunks WHERE user_id = %s", (user_id,))
        
        # 2. Simulate S3 upload by inserting into hand_files
        # We'll point to a dummy S3 path, but since we can't actually upload to S3 from here easily 
        # without credentials, we might need a different trick. 
        # Wait, the user said "i inserted a new file". 
        # If the user ALREADY inserted the file into S3/upload UI, there should be a row in hand_files?
        
        # Let's check hand_files first
        cur.execute("SELECT count(*) FROM hand_files WHERE user_id = %s AND status = 'new'", (user_id,))
        count = cur.fetchone()['count']
        
        if count > 0:
            print(f"Found {count} pending files in hand_files table. Ready to run.")
        else:
            print("No pending file found in hand_files. Did you upload it via the UI?")
            # We can't simulate S3 file existence easily without real keys.
            
    conn.commit()
    conn.close()

if __name__ == "__main__":
    prepare_test_user("740a2347-089c-4f8a-b276-39421e9dba66")
