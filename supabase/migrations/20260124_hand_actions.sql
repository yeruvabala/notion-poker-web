-- Migration: Add hand_actions column to hands table
-- Purpose: Store structured action data for replay/display in history
-- Date: 2026-01-24

-- Add hand_actions JSONB column to store structured action data
-- Structure: { villain_position, effective_stack, table_format, preflop: [], flop: [], turn: [], river: [] }
ALTER TABLE hands 
ADD COLUMN IF NOT EXISTS hand_actions JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN hands.hand_actions IS 'Structured hand action data: villain_position, effective_stack, table_format, and street action arrays (preflop/flop/turn/river) for replay and display';

-- Create index for efficient querying of hands with actions
CREATE INDEX IF NOT EXISTS idx_hands_has_actions 
ON hands ((hand_actions IS NOT NULL));
