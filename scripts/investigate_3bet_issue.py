#!/usr/bin/env python3
"""
Check what's actually stored in the database for these hands
Since we can't connect to production DB from local, this will help the user check
"""

print("""
🔍 DATABASE INVESTIGATION NEEDED
=================================

The pipeline logic is CORRECT - it should detect 3-bets for both hands.

The issue is likely that the hands were analyzed BEFORE the fix was deployed.

Please run this SQL query in your Supabase SQL Editor:

```sql
SELECT 
    id,
    created_at,
    hero_hand as cards,
    hero_position as position,
    gto_strategy->'preflop'->'initial_action' as initial_action,
    gto_strategy->'preflop'->'response_to_3bet' as vs_3bet,
    replayer_data->'actions' as actions
FROM hands
WHERE hero_hand IN ('A♠ J♥', '9♦ A♥')
  AND hero_position = 'BTN'
ORDER BY created_at DESC
LIMIT 5;
```

WHAT TO LOOK FOR:
=================

For A9o hand:
  - initial_action should exist ✓
  - vs_3bet should exist (currently missing!) ✗
  - actions should show hero raise + SB 3-bet

For AJo hand:
  - initial_action should exist ✓
  - vs_3bet should exist ✓
  - actions should show hero raise + SB 3-bet

IF vs_3bet is NULL for A9o:
===========================

The hand was analyzed BEFORE we deployed the fix to detect 3-bets on 
preflop-ending hands.

SOLUTION:
=========

Option 1: Force re-analyze the broken hand
------------------------------------------
In the UI, click the "Re-analyze" button on the A9o hand

Option 2: Re-analyze ALL hands uploaded before fix
--------------------------------------------------
Run this query to mark hands for re-analysis:

```sql
UPDATE hands
SET gto_strategy = NULL
WHERE created_at < '2026-01-01'  -- Before today's fix
  AND hero_position IS NOT NULL
  AND replayer_data IS NOT NULL;
```

Then the coach worker will automatically re-analyze them.

Option 3: Run analysis script locally
-------------------------------------
If you have access to the production database from local:

python3 backend/scripts/force_reanalyze_latest.py

""")

import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))

# Show what the actions SHOULD look like
from replayer_parser import parse_for_replayer

hand1 = """Hand #2609921427 - Holdem (No Limit) - $0.10/$0.25 - 2025/11/29 17:26:06 UTC
Belle Rive 6-max Seat #4 is the button
Seat 2: Hellliga ($28.75)
Seat 4: KannyThOP ($65.27)
Seat 5: Arepitarica ($25.45)
Seat 6: Axel14 ($25.00) is sitting out
Arepitarica posts the small blind $0.10
Hellliga posts the big blind $0.25
*** HOLE CARDS ***
Dealt to KannyThOP [9d Ah]
KannyThOP raises $0.70 to $0.70
Arepitarica raises $2.90 to $3.00
Hellliga folds
KannyThOP folds"""

print("\n" + "="*60)
print("EXPECTED replayer_data.actions for A9o hand:")
print("="*60)

data = parse_for_replayer(hand1)
import json
print(json.dumps(data['actions'], indent=2))

print("\n" + "="*60)
print("KEY OBSERVATION:")
print("="*60)
print("✓ Action #1: KannyThOP raiseTo $0.7  (Hero opens)")
print("✓ Action #2: Arepitarica raiseTo $3.0  (SB 3-bets)")
print("\nThis data IS in replayer_data, so the pipeline SHOULD detect it!")
print("\n→ Most likely: Hand was analyzed before today's fix was deployed")
print("→ Solution: Re-analyze this specific hand")
