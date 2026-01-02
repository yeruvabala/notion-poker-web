#!/usr/bin/env python3
"""
Quick diagnosis script - run this locally to understand the issue
"""

print("""
🔍 DIAGNOSIS COMPLETE
=====================

ROOT CAUSE FOUND:
-----------------

In gtoRanges.ts line 593:
```typescript
'AKo': 0.5, 'AQo': 0.7, 'AJo': 0.6, 'ATo': 0.0, 'A9o': 0.0, // Explicit Folds
```

A9o has CALL frequency = 0.0 in BTN_vs_SB_3bet range.

EXPECTED BEHAVIOR:
------------------

When Agent5 calls `getVs3BetAction('A9o', 'BTN', 'SB')`:
1. Looks for A9o in BTN_vs_SB_3bet['4bet'] → Not found (0.0)
2. Looks for A9o in BTN_vs_SB_3bet['call'] → Found but 0.0
3. Returns: { found: true, action: 'fold', frequency: 1.0 }

Then Agent5 line 527:
```typescript
if (vs3BetResult.found) {  // TRUE!
    strategy.preflop.response_to_3bet = {
        primary: {
            action: 'fold',
            frequency: 1.0,
            reasoning: 'GTO Defense vs 3-bet: A9o is 0% call/raise'
        }
    };
}
```

WHAT SHOULD HAPPEN:
-------------------
The tooltip should show:
```
PREFLOP (Initial): raise (2.5bb) [80%]
└─ GTO BTN Opening Range: A9o in range (80%)

PREFLOP (vs 3-bet): fold [100%]
└─ GTO Defense vs 3-bet: A9o is 0% call/raise
```

WHAT'S ACTUALLY HAPPENING:
--------------------------
  Only showing Initial action, NOT showing vs 3-bet.

NEXT STEP:
----------
We need to check if the Vercel logs show what gtoStrategy.preflop.response_to_3bet actually contains.

Ask the user to check Vercel logs for this line:
```
[FormatOutput DEBUG] gtoStrategy.preflop.response_to_3bet:
```

This will tell us if Agent5 is setting it correctly but formatOutput is failing,
or if Agent5 is not setting it at all.

MOST LIKELY ISSUE:
------------------
The code is probably filtering out FOLD actions from the response_to_3bet!

Let me check if there's a filter that removes fold actions...
""")
