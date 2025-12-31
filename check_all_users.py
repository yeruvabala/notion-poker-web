import sys
import os
sys.path.append(os.getcwd())

from backend.coach_worker import get_pg_conn, load_env_file

load_env_file("backend/.env")
conn = get_pg_conn()

# Check all users
with conn.cursor() as cur:
    cur.execute("SELECT user_id, COUNT(*) as count FROM public.hands GROUP BY user_id")
    print("=== HANDS BY USER ===")
    for row in cur.fetchall():
        print(f"User {row['user_id']}: {row['count']} hands")
    
    # Check analyzed hands
    cur.execute("""
        SELECT user_id, COUNT(*) as total, 
               SUM(CASE WHEN gto_strategy IS NOT NULL THEN 1 ELSE 0 END) as analyzed
        FROM public.hands 
        GROUP BY user_id
    """)
    print("\n=== ANALYSIS STATUS BY USER ===")
    for row in cur.fetchall():
        print(f"User {row['user_id']}: {row['analyzed']}/{row['total']} analyzed")
