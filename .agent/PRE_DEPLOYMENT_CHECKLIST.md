# Pre-Deployment Checklist

**Run these checks BEFORE pushing code to prevent build failures!**

## 🔍 Quick Checks (Required)

### 1. TypeScript Compilation
```bash
npm run build
```
- [ ] Build completes without errors
- [ ] No TypeScript errors
- [ ] No missing type definitions

**Common Issues:**
- Missing fields in type definitions (e.g., `villain` in `VillainContext`)
- Typos in property names
- Incorrect imports

---

### 2. Type Safety Check
```bash
npx tsc --noEmit
```
- [ ] No type errors reported
- [ ] All interfaces match actual data structures

**What to check:**
- If you added a new field to an object, did you update the type/interface?
- If you changed a field name, did you update all references?

---

### 3. Linting
```bash
npm run lint
```
- [ ] No linting errors
- [ ] No unused variables
- [ ] No missing dependencies in useEffect

---

## 🎯 Specific Checks (Based on Recent Issues)

### Agent Types (agentContracts.ts)
- [ ] If you modified `villainContext`, does the type definition match?
- [ ] If you added fields to agent inputs, are they in the interface?
- [ ] Check `Agent5Input`, `Agent1Input`, etc.

**Example:**
```typescript
// Pipeline sets this:
villainContext: { type: 'facing_action', villain: 'SB', villainName: 'Player' }

// Type MUST include ALL fields:
villainContext?: {
    type: 'opening' | 'sb_vs_bb' | 'facing_action';
    villain?: string;      // ✓ Don't forget this!
    villainName?: string;
}
```

---

### Range Lookups (gtoRanges.ts / agent5_gtoStrategy.ts)
- [ ] Are you using POSITION (e.g., 'SB') not player NAME?
- [ ] Does the range key exist in `gtoRanges.ts`?
- [ ] Format: `{HERO_POSITION}_vs_{VILLAIN_POSITION}_3bet`

**Wrong:** `BTN_vs_AREPITARICA_3bet` (player name)  
**Right:** `BTN_vs_SB_3bet` (position)

---

### Optional: Deep Type Check
If you modified core types or agent contracts:

```bash
# Check all files that use the changed type
npx tsc --listFilesOnly | grep -i "agent5"
```

---

## 🚀 Automated Pre-Push Script

Create `.git/hooks/pre-push` (make it executable):

```bash
#!/bin/bash
echo "🔍 Running pre-push checks..."

# Type check
echo "Checking TypeScript..."
npx tsc --noEmit
if [ $? -ne 0 ]; then
    echo "❌ TypeScript errors found!"
    exit 1
fi

# Lint check
echo "Linting code..."
npm run lint
if [ $? -ne 0 ]; then
    echo "❌ Linting errors found!"
    exit 1
fi

echo "✅ All checks passed!"
exit 0
```

**To enable:**
```bash
chmod +x .git/hooks/pre-push
```

---

## 📝 Manual Review Checklist

Before committing:

- [ ] Did I test locally with the /test_features_locally workflow?
- [ ] Did I update types if I changed data structures?
- [ ] Did I check field names match between setter and getter?
- [ ] Did I verify range keys exist for new positions?
- [ ] Did I add debug logging for new features?

---

## 🐛 Common Build Errors Reference

### "Property X does not exist on type Y"
**Cause:** Type definition missing a field  
**Fix:** Add the field to the interface in `agentContracts.ts`

### "Cannot find module" or import errors
**Cause:** Missing dependency or wrong import path  
**Fix:** Check import paths, run `npm install`

### Vercel build timeouts
**Cause:** Infinite loops or very slow operations  
**Fix:** Add timeouts, check for recursion

### Range lookup returns `found: false`
**Cause:** Using player name instead of position, OR range doesn't exist  
**Fix:** Use position field, verify key exists in `gtoRanges.ts`

---

## 💡 Improvement Ideas

Want to add:
- [ ] Pre-commit hooks (run on every commit)
- [ ] CI/CD checks (run on PR)
- [ ] Automated tests for type consistency
- [ ] Range validation tests
- [ ] Mock data generator for testing

Let me know what else you'd like to add!
