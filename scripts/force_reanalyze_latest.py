
import os
import sys

# Ensure backend modules are importable
sys.path.append(os.path.join(os.getcwd()))

from backend.coach_worker import get_pg_conn, coach_new_hands, load_env_file


def apply_migration(conn):
    print("📦 Applying migration: add_enhanced_coaching_columns.sql")
    migration_path = "supabase/migrations/add_enhanced_coaching_columns.sql"
    if not os.path.exists(migration_path):
        print(f"❌ Migration file not found: {migration_path}")
        return

    with open(migration_path, "r") as f:
        sql = f.read()

    with conn.cursor() as cur:
        cur.execute(sql)
    conn.commit()
    print("✅ Migration applied successfully.")

def force_reanalyze():
    print("🚀 Forcing re-analysis of recent hands...")
    load_env_file("backend/.env")
    conn = get_pg_conn()
    
    # 0. Apply migration first
    apply_migration(conn)
    
    # 1. Reset analysis for last 10 hands
    with conn.cursor() as cur:
        # Check if column exists now
        cur.execute("SELECT to_regclass('public.hands');")
        
        cur.execute("""
            UPDATE public.hands 
            SET gto_strategy = NULL,
                hero_classification = NULL
            WHERE id IN (
                SELECT id FROM public.hands 
                ORDER BY created_at DESC 
                LIMIT 10
            )
        """)
        count = cur.rowcount
        print(f"🔄 Reset analysis for {count} most recent hands.")
    
    # 2. Run coach worker
    print("🧠 Running Coach Worker...")
    coached = coach_new_hands(conn, batch_size=10)
    print(f"✅ Re-analyzed {coached} hands.")
    
    conn.close()

if __name__ == "__main__":
    force_reanalyze()
