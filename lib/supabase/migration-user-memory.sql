-- Migration: Add user_memory table + conversation_id scoping
-- Run this in Supabase SQL Editor if you already have an existing database

CREATE TABLE IF NOT EXISTS user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE DEFAULT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general' CHECK (category IN ('preference', 'project', 'personal', 'technical', 'general')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add conversation_id if table already exists
ALTER TABLE user_memory ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_user_memory_user ON user_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_category ON user_memory(category);
CREATE INDEX IF NOT EXISTS idx_user_memory_conversation ON user_memory(conversation_id);

ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all' AND tablename = 'user_memory') THEN
    CREATE POLICY "Allow all" ON user_memory FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_user_memory') THEN
    CREATE TRIGGER trg_user_memory BEFORE UPDATE ON user_memory FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;
