-- Track which habit questions the user actually answered (vs skipped) on a check-in.
-- Used by the wellness score to avoid penalizing habits the user never answered.
-- NULL means "legacy" (created before this column existed) → consumers fall back to
-- counting all enabled habits, preserving old behavior.
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS answered_questions text[];
