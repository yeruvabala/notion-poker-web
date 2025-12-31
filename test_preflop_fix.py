import sys
import os
sys.path.append(os.getcwd())

from backend.coach_worker import get_pg_conn, coach_new_hands, load_env_file

load_env_file("backend/.env")
conn = get_pg_conn()

hand_id = "2609897134"

# Reset and re-analyze
with conn.cursor() as cur:
    cur.execute("""
        UPDATE public.hands 
        SET gto_strategy = NULL, exploit_deviation = NULL
        WHERE raw_text LIKE %s
    """, (f"%{hand_id}%",))

print(f"Re-analyzing Hand #{hand_id}...")
coach_new_hands(conn, batch_size=1)

# Check if preflop now appears in decision breakdown
with conn.cursor() as cur:
    cur.execute("SELECT exploit_deviation FROM public.hands WHERE raw_text LIKE %s", (f"%{hand_id}%",))
    row = cur.fetchone()
    if row and row['exploit_deviation']:
        exploit = row['exploit_deviation']
        has_preflop = 'PREFLOP' in exploit.upper()
        
        if has_preflop:
            print("\n✅ SUCCESS: PREFLOP found in Decision Breakdown!")
            print("\n=== DECISION BREAKDOWN ===")
            print(exploit)
        else:
            print("\n❌ FAILED: PREFLOP still missing")
            print("\n=== DECISION BREAKDOWN ===")
            print(exploit)
