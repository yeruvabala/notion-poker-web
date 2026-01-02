
import os

FILE_PATH = "app/api/coach/agents/agent5_gtoStrategy.ts"

NEW_FUNCTION_BODY = r"""
function tryGeneratePreflopFromRanges(input: Agent5Input): GTOStrategy | null {
    const heroHand = input.heroHand || '';
    const heroPosition = input.positions?.hero || '';


    // Detect if this is an RFI -> vs 3-bet scenario
    const preflopActions = input.actions.filter(a => a.street === 'preflop');
    const heroFirstAction = preflopActions.find(a => a.player === 'hero');
    const heroOpened = heroFirstAction && (heroFirstAction.action === 'raise' || heroFirstAction.action === 'bet');
    
    // Check if we faced a 3-bet (villain raised after us)
    // Heuristic: villainContext is 'facing_action' AND we opened
    const isVs3Bet = input.villainContext?.type === 'facing_action' && heroOpened;

    if (isVs3Bet) {
        // 1. Get Opening Action (Initial)
        // We act as if villainContext is 'opening' to get the RFI logic
        const openResult = getPreflopAction(heroHand, heroPosition, { type: 'opening', villain: null });
        
        // 2. Get Vs 3-Bet Action (Response)
        // transform input.villainContext to match { type, villain }
        const vs3BetContext = input.villainContext ? {
            type: input.villainContext.type,
            villain: input.villainContext.villainName || null
        } : undefined;

        const vs3BetResult = getPreflopAction(heroHand, heroPosition, vs3BetContext);

        if (!openResult.found && !vs3BetResult.found) return null;

        // Build the composite strategy - ensure initial_action is present with fallback
        const strategy: GTOStrategy = { 
            preflop: {
                initial_action: {
                    primary: { action: 'fold', frequency: 1.0, reasoning: 'Fallback initialization' }
                }
            } 
        };

        // Initial Action (Open)
        if (openResult.found) {
            const normalizedHand = normalizeHand(heroHand);
            // Map 3bet/4bet to 'raise' for ActionType compatibility
            const openActionName = (openResult.action.action === 'raise' || openResult.action.action === '3bet' || openResult.action.action === '4bet') ? 'raise' : openResult.action.action;

            strategy.preflop.initial_action = {
                primary: {
                    action: openActionName as any,
                    sizing: openResult.action.sizing,
                    frequency: openResult.action.frequency,
                    reasoning: `GTO ${heroPosition} Opening Range: ${normalizedHand} in range (${(openResult.action.frequency*100).toFixed(0)}%)`
                }
            };
        }

        // Response to 3-bet
        if (vs3BetResult.found) {
            const normalizedHand = normalizeHand(heroHand);
            const vs3BetActionName = (vs3BetResult.action.action === 'raise' || vs3BetResult.action.action === '3bet' || vs3BetResult.action.action === '4bet') ? 'raise' : vs3BetResult.action.action;

            strategy.preflop.response_to_3bet = {
                primary: {
                    action: vs3BetActionName as any,
                    sizing: vs3BetResult.action.sizing,
                    frequency: vs3BetResult.action.frequency,
                    reasoning: `GTO Defense vs 3-bet: ${normalizedHand} is ${(vs3BetResult.action.frequency*100).toFixed(0)}% call/raise`
                }
            };
        }

        return strategy;
    }

    // Standard Single-Action Logic (Opening or Limping or Cold Call)
    const villainContextForRanges = input.villainContext
        ? {
            type: input.villainContext.type,
            villain: input.villainContext.villainName || null
        }
        : undefined;

    const rangeResult = getPreflopAction(heroHand, heroPosition, villainContextForRanges);

    // If not found in ranges, return null to let LLM handle it
    if (!rangeResult.found) {
        return null;
    }

    const preflopAction = rangeResult.action;

    // Build the GTO strategy from range lookup
    const normalizedHand = normalizeHand(heroHand);
    const actionName = preflopAction.action === 'raise' || preflopAction.action === '3bet' || preflopAction.action === '4bet'
        ? 'raise'
        : preflopAction.action;

    const reasoning = preflopAction.action === 'fold'
        ? `GTO ${heroPosition} range: ${normalizedHand} is NOT in opening range - fold`
        : `GTO ${heroPosition} range: ${normalizedHand} is in range at ${(preflopAction.frequency * 100).toFixed(0)}% frequency`;

    return {
        preflop: {
            initial_action: {
                primary: {
                    action: actionName as any,
                    sizing: preflopAction.sizing,
                    frequency: preflopAction.frequency,
                    reasoning: reasoning
                }
            }
        }
    };
}
"""

def patch_file():
    with open(FILE_PATH, 'r') as f:
        content = f.read()

    # Find start of function
    start_marker = "function tryGeneratePreflopFromRanges(input: Agent5Input): GTOStrategy | null {"
    start_idx = content.find(start_marker)
    
    if start_idx == -1:
        print("❌ Could not find function start")
        return

    # Find end of function (naive brace counting)
    brace_count = 0
    end_idx = -1
    
    # Start scanning from start_idx
    for i in range(start_idx, len(content)):
        char = content[i]
        if char == '{':
            brace_count += 1
        elif char == '}':
            brace_count -= 1
            
            if brace_count == 0:
                end_idx = i + 1
                break
    
    if end_idx == -1:
        print("❌ Could not find function end")
        return

    print(f"✅ Found function from {start_idx} to {end_idx}")
    
    # Replace content
    new_content = content[:start_idx] + NEW_FUNCTION_BODY.strip() + content[end_idx:]
    
    with open(FILE_PATH, 'w') as f:
        f.write(new_content)
    
    print("✅ Successfully patched agent5_gtoStrategy.ts")

if __name__ == "__main__":
    patch_file()
