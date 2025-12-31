import sys
import os
sys.path.append(os.getcwd())

from backend.coach_worker import get_pg_conn, load_env_file

load_env_file("backend/.env")
conn = get_pg_conn()

user_id = "740a2347-089c-4f8a-b276-39421e9dba66"

with conn.cursor() as cur:
    # Count total hands
    cur.execute("SELECT COUNT(*) FROM public.hands WHERE user_id = %s", (user_id,))
    total = cur.fetchone()['count']
    
    # Count analyzed hands
    cur.execute("SELECT COUNT(*) FROM public.hands WHERE user_id = %s AND gto_strategy IS NOT NULL", (user_id,))
    analyzed = cur.fetchone()['count']
    
    # Count pending hands
    cur.execute("SELECT COUNT(*) FROM public.hands WHERE user_id = %s AND gto_strategy IS NULL", (user_id,))
    pending = cur.fetchone()['count']
    
    print(f"=== HAND ANALYSIS STATUS ===")
    print(f"Total hands: {total}")
    print(f"Analyzed: {analyzed}")
    print(f"Pending: {pending}")
    
    if pending > 0:
        print(f"\n⚠️  {pending} hands still need analysis!")
        print("Run: python3 backend/coach_worker.py")
    else:
        print("\n✅ All hands analyzed!")
        
    # Show sample of analyzed hands
    if analyzed > 0:
        cur.execute("""
            SELECT id, position, cards, 
                   LENGTH(gto_strategy) as strategy_length,
                   LENGTH(exploit_deviation) as deviation_length
            FROM public.hands 
            WHERE user_id = %s AND gto_strategy IS NOT NULL 
            LIMIT 3
        """, (user_id,))
        
        print("\n=== SAMPLE ANALYZED HANDS ===")
        for row in cur.fetchall():
            print(f"Hand: {row['position']} {row['cards']} - GTO: {row['strategy_length']} chars, Deviation: {row['deviation_length']} chars")
