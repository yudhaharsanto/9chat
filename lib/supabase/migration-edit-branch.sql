-- Migration: Add edit_group_id and branch_index to messages table
-- Run this in Supabase SQL Editor if you already have an existing database

ALTER TABLE messages ADD COLUMN IF NOT EXISTS edit_group_id TEXT DEFAULT NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS branch_index INT DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_messages_edit_group ON messages(edit_group_id, branch_index);
