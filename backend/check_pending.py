
import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from coach_worker import get_pg_conn, load_env_file

def check_pending():
    load_env_file()
    conn = get_pg_conn()
    with conn.cursor() as cur:
        cur.execute("""
            SELECT count(*) 
            FROM hands 
            WHERE user_id = '740a2347-089c-4f8a-b276-39421e9dba66' 
              AND gto_strategy IS NULL
        """)
        count = cur.fetchone()['count']
        print(f"Pending hands: {count}")
            
    conn.close()

if __name__ == "__main__":
    check_pending()
