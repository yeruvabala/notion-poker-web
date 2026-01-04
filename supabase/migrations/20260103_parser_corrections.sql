-- Parser Corrections Table
-- Purpose: Data flywheel for continuous improvement
-- Captures: Original text, parser output, user corrections
-- Used to: Identify patterns of regex failures, improve detection

-- ============================================================================
-- TABLE: parser_corrections
-- ============================================================================

CREATE TABLE IF NOT EXISTS parser_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Input: Original user text
    raw_input_text TEXT NOT NULL,
    
    -- What parser detected (before correction)
    parser_output_json JSONB NOT NULL,
    
    -- What user corrected it to (ground truth)
    user_corrected_json JSONB NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Analytics fields
    correction_type TEXT,           -- comma-separated: 'position', 'cards', 'stack'
    was_ai_fallback BOOLEAN DEFAULT FALSE,
    parsing_confidence INTEGER,     -- 0-100 score from parser
    
    -- Session context (for debugging)
    session_id TEXT,
    user_agent TEXT
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Query corrections by date (for dashboards)
CREATE INDEX IF NOT EXISTS idx_corrections_created 
ON parser_corrections(created_at DESC);

-- Query by correction type (for pattern analysis)
CREATE INDEX IF NOT EXISTS idx_corrections_type 
ON parser_corrections(correction_type);

-- Query AI fallback failures specifically
CREATE INDEX IF NOT EXISTS idx_corrections_ai_fallback 
ON parser_corrections(was_ai_fallback) 
WHERE was_ai_fallback = TRUE;

-- Query by confidence (find low-confidence scenarios)
CREATE INDEX IF NOT EXISTS idx_corrections_confidence 
ON parser_corrections(parsing_confidence);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE parser_corrections ENABLE ROW LEVEL SECURITY;

-- Anyone can insert corrections (even anonymous)
CREATE POLICY "Anyone can insert corrections"
ON parser_corrections FOR INSERT
WITH CHECK (TRUE);

-- Only authenticated users can view their own corrections
CREATE POLICY "Users can view own corrections"
ON parser_corrections FOR SELECT
USING (auth.uid() = user_id);

-- Admins can view all corrections (for analysis)
-- Note: Create an admin role or use service role key for dashboard
CREATE POLICY "Service role can view all"
ON parser_corrections FOR SELECT
USING (auth.role() = 'service_role');

-- ============================================================================
-- HELPER VIEWS (for analysis)
-- ============================================================================

-- Most common correction types
CREATE OR REPLACE VIEW correction_stats AS
SELECT 
    correction_type,
    COUNT(*) as count,
    ROUND(AVG(parsing_confidence), 1) as avg_confidence,
    COUNT(*) FILTER (WHERE was_ai_fallback) as ai_fallback_count
FROM parser_corrections
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY correction_type
ORDER BY count DESC;

-- Recent corrections (for quick debugging)
CREATE OR REPLACE VIEW recent_corrections AS
SELECT 
    id,
    LEFT(raw_input_text, 50) as input_preview,
    parser_output_json->>'heroPosition' as parsed_position,
    user_corrected_json->>'heroPosition' as correct_position,
    parser_output_json->>'heroCards' as parsed_cards,
    user_corrected_json->>'heroCards' as correct_cards,
    correction_type,
    was_ai_fallback,
    parsing_confidence,
    created_at
FROM parser_corrections
ORDER BY created_at DESC
LIMIT 50;
