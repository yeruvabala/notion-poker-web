-- Migration: Add enhanced poker coaching data columns
-- Phase 12-14.5: Hero Classification, SPR Analysis, Mistake Analysis

-- Add hero classification from Agent 1 (Phase 12)
ALTER TABLE hands 
ADD COLUMN IF NOT EXISTS hero_classification JSONB;

-- Add SPR analysis from Agent 4 (Phase 13/13.5)
ALTER TABLE hands 
ADD COLUMN IF NOT EXISTS spr_analysis JSONB;

-- Add mistake analysis from Agent 6 (Phase 14/14.5)
ALTER TABLE hands 
ADD COLUMN IF NOT EXISTS mistake_analysis JSONB;

-- Add comments for documentation
COMMENT ON COLUMN hands.hero_classification IS 'Hero hand classification: bucket2D, tier, percentile, description (Phase 12)';
COMMENT ON COLUMN hands.spr_analysis IS 'SPR analysis: zones, commitment thresholds, strategic context (Phase 13/13.5)';
COMMENT ON COLUMN hands.mistake_analysis IS 'Mistake analysis: play quality counts, leak categories, worst leak (Phase 14/14.5)';

-- Create index for querying by leak categories (for analytics)
CREATE INDEX IF NOT EXISTS idx_hands_mistake_analysis_leaks 
ON hands USING GIN ((mistake_analysis->'leak_categories'));

-- Optional: Add index for hero tier (for filtering strong/weak hands)
CREATE INDEX IF NOT EXISTS idx_hands_hero_tier 
ON hands ((hero_classification->>'tier'));
