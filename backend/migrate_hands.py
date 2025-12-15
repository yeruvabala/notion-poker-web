
import os
import psycopg2
from psycopg2.extras import RealDictCursor, Json
from replayer_parser import parse_for_replayer

# Load Env
env_path = '.env'
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                if k not in os.environ:
                    os.environ[k.strip()] = v.strip()

db_url = os.getenv('DATABASE_URL') or os.getenv('SUPABASE_DB_URL')
if not db_url:
    print("No DB URL found.")
    exit(1)

conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor)
conn.autocommit = True
cur = conn.cursor()

print("Fetching all hands...")
cur.execute("SELECT id, raw_text FROM hands")
hands = cur.fetchall()
print(f"Found {len(hands)} hands. Starting re-parse...")

count = 0
errors = 0

for h in hands:
    hand_id = h['id']
    raw = h['raw_text']
    if not raw:
        continue
        
    try:
        data = parse_for_replayer(raw)
        # Update
        cur.execute("UPDATE hands SET replayer_data = %s WHERE id = %s", (Json(data), hand_id))
        count += 1
        if count % 10 == 0:
            print(f"Processed {count}...")
    except Exception as e:
        print(f"Error parsing hand {hand_id}: {e}")
        errors += 1

print(f"Migration Complete. Updated {count} hands. Errors: {errors}.")
conn.close()
