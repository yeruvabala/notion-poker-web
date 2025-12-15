#!/usr/bin/env python3
"""Quick script to check parsed replayer data for hero cards."""

import os
import json
import psycopg2
from psycopg2.extras import RealDictCursor

# Load env
env_path = os.path.join(os.path.dirname(__file__), ".env")
if os.path.exists(env_path):
    with open(env_path) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                if k not in os.environ:
                    os.environ[k.strip()] = v.strip()

db_url = os.getenv("DATABASE_URL") or os.getenv("SUPABASE_DB_URL")
conn = psycopg2.connect(db_url, cursor_factory=RealDictCursor)

with conn.cursor() as cur:
    cur.execute("""
        SELECT id, replayer_data, raw_text 
        FROM hands 
        WHERE replayer_data IS NOT NULL 
          AND replayer_data != '{}'::jsonb
        LIMIT 1
    """)
    row = cur.fetchone()

if row:
    print("=== Hand ID:", row["id"])
    print("\n=== Replayer Data (players):")
    rd = row["replayer_data"]
    if isinstance(rd, str):
        rd = json.loads(rd)
    for p in rd.get("players", []):
        print(f"  {p.get('name')}: seat={p.get('seatIndex')}, isHero={p.get('isHero')}, cards={p.get('cards')}, stack={p.get('stack')}")
    
    print("\n=== Board:", rd.get("board"))
    print("=== Pot:", rd.get("pot"))
    print("=== Dealer Seat:", rd.get("dealerSeat"))
    
    # Check raw text for hero cards
    raw = row["raw_text"] or ""
    print("\n=== Searching raw_text for 'Dealt to Hero'...")
    import re
    hero_match = re.search(r"Dealt\s+to\s+Hero\s*\[\s*([2-9TJQKA][cdhs])\s+([2-9TJQKA][cdhs])\s*\]", raw, re.IGNORECASE)
    if hero_match:
        print(f"  Found: [{hero_match.group(1)} {hero_match.group(2)}]")
    else:
        # Try to find any "Dealt to" line
        dealt_lines = [l for l in raw.split("\n") if "Dealt to" in l]
        print(f"  'Dealt to Hero' not found. Found {len(dealt_lines)} 'Dealt to' lines:")
        for l in dealt_lines[:5]:
            print(f"    {l.strip()}")
else:
    print("No hands with replayer_data found")

conn.close()
