
import os
import psycopg2
from psycopg2.extras import RealDictCursor

# Load Env
env_path = '.env'
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith('#') and '=' in line:
                k, v = line.split('=', 1)
                os.environ[k.strip()] = v.strip()

db_url = os.getenv('DATABASE_URL') or os.getenv('SUPABASE_DB_URL')
conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor)
cur = conn.cursor()

# Get specific hand
print("Fetching hand 8e767161-09d6-436b-b748-312ea7d50aec...")
cur.execute("SELECT id, raw_text, replayer_data FROM hands WHERE id = '8e767161-09d6-436b-b748-312ea7d50aec'")
row = cur.fetchone()

if row:
    print(f"Hand ID: {row['id']}")
    data = row['replayer_data']
    players = data.get('players', [])
    print(f"Total Players: {len(players)}")
    for p in players:
        print(f"  Name: '{p['name']}' | Seat: {p.get('seatIndex')} | Stack: {p.get('stack')}")
        
    print("\nRaw Header (First 300 chars):")
    print(row['raw_text'][:300])
else:
    print("No hands found.")
conn.close()
