
import os
import re
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

def extract_position_from_raw(raw_text):
    """
    Extract hero's position from raw hand history using blind posts and seat positions.
    """
    # Extract hero name from "Dealt to [NAME]"
    hero_match = re.search(r'Dealt to ([^\s\[]+)', raw_text)
    if not hero_match:
        return None
    hero_name = hero_match.group(1)
    
    # MOST RELIABLE: Check if hero posted blinds
    if re.search(rf'{hero_name} posts the small blind', raw_text):
        return 'SB'
    if re.search(rf'{hero_name} posts the big blind', raw_text):
        return 'BB'
    
    # Extract button seat from "Seat #X is the button"
    button_match = re.search(r'Seat #(\d+) is the button', raw_text)
    if not button_match:
        return 'BTN'  # Default
    
    button_seat = int(button_match.group(1))
    
    # Extract hero's seat from "Seat X: HeroName"
    hero_seat_match = re.search(rf'Seat (\d+): {hero_name}', raw_text)
    if not hero_seat_match:
        return 'BTN'
    
    hero_seat = int(hero_seat_match.group(1))
    
    # If hero is on the button
    if hero_seat == button_seat:
        return 'BTN'
    
    # Count seats to determine table size
    seat_numbers = re.findall(r'Seat (\d+):', raw_text)
    all_seats = sorted([int(s) for s in seat_numbers])
    num_players = len(all_seats)
    
    # Calculate position relative to button
    # For 6-max: BTN, SB, BB, UTG, HJ, CO
    try:
        hero_idx = all_seats.index(hero_seat)
        btn_idx = all_seats.index(button_seat)
    except ValueError:
        return 'BTN'
    
    # Seats clockwise from button
    seats_from_btn = (hero_idx - btn_idx) % num_players
    
    if seats_from_btn == 0:
        return 'BTN'
    elif num_players == 6:
        # 6-max positions
        if seats_from_btn == 5:  # 1 before button (clockwise)
            return 'CO'
        elif seats_from_btn == 4:
            return 'HJ'
        elif seats_from_btn == 3:
            return 'UTG'
        # seats_from_btn 1, 2 are SB, BB (handled above)
    elif num_players >= 9:
        # 9-max
        position_map = {8: 'CO', 7: 'HJ', 6: 'LJ', 5: 'MP', 4: 'UTG+1', 3: 'UTG'}
        return position_map.get(seats_from_btn, 'UTG')
    
    return 'BTN'  # Safe fallback

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
        
        # FIXED: Extract position correctly from raw text
        position = extract_position_from_raw(raw)
        
        # Extract cards
        hero = next((p for p in data.get("players", []) if p.get("isHero")), None)
        cards = None
        if hero and hero.get("cards"):
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
