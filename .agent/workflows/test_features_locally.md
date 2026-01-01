---
description: How to test feature logic locally without spending API tokens
---

# The "Anti Gravity" Testing Workflow 🚀

To save tokens and iterate faster, use these local scripts to verify logic before running the full AI pipeline.

## 1. Test Hand Classification
**Use when:** You change hand categorization logic (e.g. "What is A9o?").
**Cost:** $0 (Local CPU only)

```bash
npm run test:hand
```
*Runs `scripts/test_preflop_classification.ts`*
*Verifies 10+ hand types against expected Tiers (Monster, Strong, Marginal, Air).*

## 2. Test Full Pipeline (Mock)
**Use when:** You want to see if Tooltips will appear in the UI.
**Cost:** $0 (Local CPU, Mocked Inputs)

```bash
npm run test:pipeline
```
*Runs `scripts/test_preflop_tooltip_pipeline.ts`*
*Simulates the full multi-agent pipeline using mock data. Useful for debugging "Is the data being passed correctly?"*

## How to Add New Tests
1. **New Logic**: Edit `scripts/test_preflop_classification.ts`, add a new case to `TEST_HANDS`.
2. **New Scenario**: Duplicate `scripts/test_preflop_tooltip_pipeline.ts`, modify the `handInput` (e.g. change actions/cards), and run it with `npx tsx scripts/my_new_test.ts`.

---
**Pro Tip**: Always run `npm run test:hand` after modifying `PreflopClassifier.ts` to ensure no regressions!
