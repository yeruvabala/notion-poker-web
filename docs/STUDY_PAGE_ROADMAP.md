# Study Page Improvements - Next Release Roadmap

**Target Release:** v1.x (2-3 weeks from Jan 29, 2026)  
**Status:** Planned  
**Last Updated:** 2026-01-29

---

## Current Release (v1.0 - Apple Review)

The current version going to Apple Review includes:
- ✅ Ranges page with 6-color simplified palette (Raise/Call/Fold)
- ✅ 3bet+ scenario support
- ✅ SSR fix for ranges page
- ✅ Splash screen → animation flow working
- ✅ All core functionality stable

---

## Next Release Improvements (Study Page v2)

### Phase 1: Core Fixes (1-2 days)

| Task | Description | Priority |
|------|-------------|----------|
| SSR Fix | Fix Capacitor.isNativePlatform() in study page | 🔴 HIGH |
| Streaming | Stream GPT response (typing effect) | 🔴 HIGH |
| Loading Skeleton | Premium animated loading state | 🟡 MEDIUM |
| Street Fix | Fix street column in study_ingest.py | 🟡 MEDIUM |

### Phase 2: Knowledge Base (3-5 days)

| Task | Description | Priority |
|------|-------------|----------|
| GTO Chunks | Pre-populate with RFI/3bet strategy text | 🔴 HIGH |
| Manual Notes | Let users add custom study notes | 🟡 MEDIUM |
| Source Indicators | Show if chunk is from hand/note/GTO | 🟡 MEDIUM |

### Phase 3: Enhanced RAG (1-2 weeks)

| Task | Description | Priority |
|------|-------------|----------|
| Server-side Filters | Move filters to SQL WHERE clause | 🟡 MEDIUM |
| Reranking | Cross-encoder relevance scoring | 🟡 MEDIUM |
| Conversation Memory | Track chat history for follow-ups | 🟡 MEDIUM |

### Phase 4: Engagement (2-3 weeks)

| Task | Description | Priority |
|------|-------------|----------|
| Interactive Drills | Quiz with multiple choice | 🟢 LOW |
| Drill Tracking | Store completed drills per user | 🟢 LOW |
| Progress Dashboard | Show weak spots improving | 🟢 LOW |

---

## Architecture Overview

```
User Question → Embed (text-embedding-3-small) 
    → Vector Search (study_chunks) 
    → Filter (stakes/position/street) 
    → GPT-4.1-mini 
    → Summary + Rules + Drills
```

### Data Sources
- `hands_silver` → `study_ingest.py` → `study_chunks`
- Future: GTO content, manual notes

---

## Key Technical Decisions

1. **Keep GPT-4.1-mini** - Cost effective, improve prompts instead
2. **Add streaming** - Better UX, perceived faster
3. **Expand knowledge base** - GTO chunks for better advice
4. **Fix SSR issues** - Same pattern as ranges page fix

---

## Files to Modify

### Phase 1
- `app/(app)/study/page.tsx` - SSR fix
- `app/(app)/study/mobile-page.tsx` - SSR fix, streaming
- `app/api/study/answer/route.ts` - Streaming response

### Phase 2
- `backend/study_ingest.py` - Add GTO content source
- Database: Add `study_notes` table
- New API: `/api/study/notes` CRUD

### Phase 3
- `app/api/study/answer/route.ts` - SQL filters, reranking
- Database: Add conversation sessions table
