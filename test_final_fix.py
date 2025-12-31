import sys
import os
sys.path.append(os.getcwd())

from backend.coach_worker import get_pg_conn, coach_new_hands, load_env_file

load_env_file("backend/.env")
conn = get_pg_conn()

hand_id = "2609894175"

# Reset
with conn.cursor() as cur:
    cur.execute("UPDATE public.hands SET gto_strategy = NULL WHERE raw_text LIKE %s", (f"%{hand_id}%",))

print("Re-analyzing with stronger position anti-hallucination...")
coach_new_hands(conn, batch_size=1)

# Check
with conn.cursor() as cur:
    cur.execute("SELECT gto_strategy FROM public.hands WHERE raw_text LIKE %s", (f"%{hand_id}%",))
    row = cur.fetchone()
    if row:
        lines = row['gto_strategy'].split('\n')
        print("\n=== PREFLOP REASONING ===")
        for i, line in enumerate(lines):
            if 'PREFLOP' in line.upper():
                for j in range(i, min(i+4, len(lines))):
                    print(lines[j])
                break
        
        # Check for position errors
        strategy = row['gto_strategy'].lower()
        if 'positional disadvantage' in strategy or 'out of position' in strategy:
            print("\n❌ Still has position hallucination")
        else:
            print("\n✅ No position hallucination detected!")
