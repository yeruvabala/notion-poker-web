-- Migration: Session Mode
-- Adds note_sessions table and session-related columns to hands table
-- Created: 2026-01-07

-- ============================================================================
-- 1. CREATE note_sessions TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS note_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    is_active BOOLEAN DEFAULT true
);

-- Index for fetching user's sessions
CREATE INDEX IF NOT EXISTS idx_note_sessions_user_id ON note_sessions(user_id);

-- Index for finding active sessions quickly
CREATE INDEX IF NOT EXISTS idx_note_sessions_active ON note_sessions(user_id, is_active) WHERE is_active = true;

-- ============================================================================
-- 2. ADD COLUMNS TO hands TABLE
-- ============================================================================

-- Source: track how the hand was added
-- Values: 'upload' (file upload), 'manual' (homepage analyzer), 'quick_save' (one-off save)
ALTER TABLE hands ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'upload';

-- Session ID: link hands to a session (nullable for quick saves and uploads)
ALTER TABLE hands ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES note_sessions(id) ON DELETE SET NULL;

-- Favorited flag: let users star important hands
ALTER TABLE hands ADD COLUMN IF NOT EXISTS is_favorited BOOLEAN DEFAULT false;

-- Index for filtering by session
CREATE INDEX IF NOT EXISTS idx_hands_session_id ON hands(session_id) WHERE session_id IS NOT NULL;

-- Index for fetching favorited hands
CREATE INDEX IF NOT EXISTS idx_hands_favorited ON hands(user_id, is_favorited) WHERE is_favorited = true;

-- Index for filtering by source
CREATE INDEX IF NOT EXISTS idx_hands_source ON hands(user_id, source);

-- ============================================================================
-- 3. ROW LEVEL SECURITY FOR note_sessions
-- ============================================================================

-- Enable RLS
ALTER TABLE note_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own sessions
CREATE POLICY "Users can view own sessions" 
    ON note_sessions FOR SELECT 
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own sessions
CREATE POLICY "Users can insert own sessions" 
    ON note_sessions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own sessions
CREATE POLICY "Users can update own sessions" 
    ON note_sessions FOR UPDATE 
    USING (auth.uid() = user_id);

-- Policy: Users can delete their own sessions
CREATE POLICY "Users can delete own sessions" 
    ON note_sessions FOR DELETE 
    USING (auth.uid() = user_id);

-- ============================================================================
-- 4. AUTO-UPDATE updated_at TRIGGER
-- ============================================================================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_note_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function on updates
DROP TRIGGER IF EXISTS trigger_note_sessions_updated_at ON note_sessions;
CREATE TRIGGER trigger_note_sessions_updated_at
    BEFORE UPDATE ON note_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_note_sessions_updated_at();

-- ============================================================================
-- 5. COMMENTS
-- ============================================================================

COMMENT ON TABLE note_sessions IS 'Stores poker study sessions for grouping saved hands';
COMMENT ON COLUMN note_sessions.name IS 'User-defined session name (e.g., "Sunday Grind", "Tournament Practice")';
COMMENT ON COLUMN note_sessions.is_active IS 'Whether session is currently active for saving hands';
COMMENT ON COLUMN hands.source IS 'How the hand was added: upload, manual, quick_save';
COMMENT ON COLUMN hands.session_id IS 'Optional link to a study session';
COMMENT ON COLUMN hands.is_favorited IS 'User-starred hands for quick access';
