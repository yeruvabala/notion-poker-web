# LLM Fallback Integration Instructions

## 📄 FILE TO EDIT

**You need to edit ONE file:**

```
app/api/coach/utils/ParserFallbacks.ts
```

**Location**: `/Users/ash/Desktop/onlypoker/notion-poker-web/app/api/coach/utils/ParserFallbacks.ts`

---

## 🔧 4 Simple Edits to Make

### Edit 1: Add Import at Top (Line ~12)

**Add this line** after the existing type definitions at the top of the file:

```typescript
import { parseWithLLM, isLLMParsingEnabled } from './llmParser';
```

**Where**: Right after `export type Position = ...` (around line 12)

---

### Edit 2: Add Confidence Function (Before Line 492)

**Add this entire function** just BEFORE the `enrichHandContext` function starts (around line 482-490):

```typescript
/**
 * Calculate overall parsing confidence based on detected fields
 * Scale: 0-100
 */
function calculateParsingConfidence(context: EnrichedHandContext): number {
  let score = 0;
  
  // Critical fields (20 points each)
  if (context.heroPosition) {
    const isDefaulted = context.assumptions.some(a => 
      a.field === 'heroPosition' && a.source === 'defaulted'
    );
    score += isDefaulted ? 5 : 20;
  }
  
  if (context.heroCards) {
    const isDefaulted = context.assumptions.some(a => 
      a.field === 'heroCards' && a.source === 'defaulted'
    );
    score += isDefaulted ? 5 : 20;
  }
  
  if (context.effectiveStack && context.effectiveStack !== 100) {
    score += 20;
  }
  
  // Important fields (10 points each)
  if (context.villainPosition) score += 10;
  if (context.scenario) score += 10;
  if (context.potSize && context.potSize !== 6) score += 10;
  
  // Bonus: No defaulted critical fields
  const hasDefaultedCritical = context.assumptions.some(a => 
    a.source === 'defaulted' && ['heroPosition', 'heroCards'].includes(a.field)
  );
  if (!hasDefaultedCritical && (context.heroPosition || context.heroCards)) {
    score += 10;
  }
  
  return Math.min(score, 100);
}
```

---

### Edit 3: Change Function Signature (Line ~492)

**Find this line** (around line 492):
```typescript
export function enrichHandContext(context: HandContext): EnrichedHandContext {
```

**Change it to**:
```typescript
export async function enrichHandContext(context: HandContext): Promise<EnrichedHandContext> {
```

**What changed**: Added `async` and changed return type from `EnrichedHandContext` to `Promise<EnrichedHandContext>`

---

### Edit 4: Add LLM Fallback Logic (Before Line 592)

**Find the line** `return enriched;` at the end of the `enrichHandContext` function (around line 592)

**Add this code** JUST BEFORE that return statement:

```typescript
  // Step 3: Calculate parsing confidence
  const parsingConfidence = calculateParsingConfidence(enriched);
  
  // Step 4: LLM Fallback Trigger
  const needsLLMFallback = 
    parsingConfidence < 50 || 
    !enriched.heroPosition || 
    !enriched.heroCards;

  let isAiFallback = false;

  if (needsLLMFallback && context.rawText && isLLMParsingEnabled()) {
    console.log('[Parser] Low confidence (' + parsingConfidence + '%), trying LLM fallback...');
    
    const llmResult = await parseWithLLM(context.rawText);
    
    if (llmResult) {
      isAiFallback = true;
      
      // Merge: Only fill null/undefined fields
      if (!enriched.heroPosition && llmResult.heroPosition) {
        enriched.heroPosition = llmResult.heroPosition as Position;
        enriched.assumptions.push({
          field: 'heroPosition',
          value: llmResult.heroPosition,
          source: 'AI_Inferred',
          confidence: 65,
          reasoning: 'Regex failed, AI detected pattern from context'
        });
      }
      
      if (!enriched.heroCards && llmResult.heroCards) {
        enriched.heroCards = llmResult.heroCards;
        enriched.assumptions.push({
          field: 'heroCards',
          value: llmResult.heroCards,
          source: 'AI_Inferred',
          confidence: 65,
          reasoning: 'Regex failed, AI detected cards from story'
        });
      }
      
      if (!enriched.villainPosition && llmResult.villainPosition) {
        enriched.villainPosition = llmResult.villainPosition as Position;
        enriched.assumptions.push({
          field: 'villainPosition',
          value: llmResult.villainPosition,
          source: 'AI_Inferred',
          confidence: 65,
          reasoning: 'AI detected opponent position'
        });
      }
      
      if (!enriched.effectiveStack && llmResult.effectiveStack) {
        enriched.effectiveStack = llmResult.effectiveStack;
        enriched.assumptions.push({
          field: 'effectiveStack',
          value: llmResult.effectiveStack,
          source: 'AI_Inferred',
          confidence: 60,
          reasoning: 'AI detected stack size'
        });
      }
      
      if (!enriched.scenario && llmResult.scenario) {
        enriched.scenario = llmResult.scenario as 'opening' | 'facing_action' | 'postflop';
        enriched.assumptions.push({
          field: 'scenario',
          value: llmResult.scenario,
          source: 'AI_Inferred',
          confidence: 70,
          reasoning: 'AI detected hand scenario type'
        });
      }
    }
  }

  // Step 5: Add tracking fields
  enriched.isAiFallback = isAiFallback;
  enriched.parsingConfidence = parsingConfidence;

  return enriched;
```

---

## ✅ After Making These Edits

1. **Save the file**
2. **Let me know** - I'll continue with Phase 2 (Database & API)

## 🎯 Summary

- **File**: `app/api/coach/utils/ParserFallbacks.ts`
- **4 edits**: Import, Function, Signature, Logic
- **Total lines added**: ~140 lines
- **Time**: ~5 minutes

That's it! 🚀
