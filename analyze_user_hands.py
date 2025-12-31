import sys
import os
sys.path.append(os.getcwd())

from backend.coach_worker import get_pg_conn, coach_new_hands, load_env_file

load_env_file("backend/.env")
conn = get_pg_conn()

# Force analysis for specific user by temporarily marking other users' hands as complete
user_id = "740a2347-089c-4f8a-b276-39421e9dba66"

with conn.cursor() as cur:
    # Temporarily mark other users' hands with a flag so coach_worker focuses on our user
    cur.execute("""
        UPDATE public.hands 
        SET gto_strategy = 'TEMP_SKIP'
        WHERE user_id != %s AND gto_strategy IS NULL
    """, (user_id,))
    temp_marked = cur.rowcount
    print(f"Temporarily marked {temp_marked} other users' hands")

# Now run coaching for our user's hands
total_coached = 0
while True:
    count = coach_new_hands(conn, batch_size=10)
    total_coached += count
    print(f'Coached {count} hands (Total: {total_coached})')
    if count == 0:
        break

# Restore other users' hands
with conn.cursor() as cur:
    cur.execute("""
        UPDATE public.hands 
        SET gto_strategy = NULL
        WHERE gto_strategy = 'TEMP_SKIP'
    """)
    restored = cur.rowcount
    print(f"Restored {restored} other users' hands")

print(f'✅ All done! Coached {total_coached} hands for user {user_id}')
conn.close()
