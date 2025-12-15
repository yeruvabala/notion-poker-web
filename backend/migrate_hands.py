
import os
import psycopg2
from psycopg2.extras import RealDictCursor, Json
from replayer_parser import parse_for_replayer, extract_date

# Load Env
env_path = 'backend/.env'
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

def get_position_label(seat_idx):
    labels = ["BTN", "SB", "BB", "UTG", "UTG+1", "UTG+2", "LJ", "HJ", "CO"]
    if 0 <= seat_idx < len(labels):
        return labels[seat_idx]
    return f"Seat {seat_idx}"

for h in hands:
    hand_id = h['id']
    raw = h['raw_text']
    if not raw:
        continue
        
    try:
        data = parse_for_replayer(raw)
        date_str = extract_date(raw)

        # Extract fields
        sb = data.get("sb")
        bb = data.get("bb")
        stakes = f"${sb}/${bb}" if sb and bb else None
        
        hero = next((p for p in data.get("players", []) if p.get("isHero")), None)
        position = None
        cards = None
        
        if hero:
            position = get_position_label(hero.get("seatIndex", -1))
            if hero.get("cards"):
                cards = " ".join(hero["cards"])

        # Update full row
        cur.execute("""
            UPDATE hands 
            SET replayer_data = %s,
                date = %s,
                stakes = %s,
                position = %s,
                cards = %s
            WHERE id = %s
        """, (Json(data), date_str, stakes, position, cards, hand_id))
        
        count += 1
        if count % 10 == 0:
            print(f"Processed {count}...")
    except Exception as e:
        print(f"Error parsing hand {hand_id}: {e}")
        errors += 1

print(f"Migration Complete. Updated {count} hands. Errors: {errors}.")
conn.close()
