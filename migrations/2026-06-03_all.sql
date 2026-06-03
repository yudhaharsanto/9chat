-- ============================================
-- 9Chat — Complete Migrations (2026-06-03)
-- Run in Supabase SQL Editor, top to bottom
-- ============================================

-- ── 1. Token Tracking ──────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_input_used BIGINT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_output_used BIGINT DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_limit BIGINT DEFAULT NULL;

CREATE TABLE IF NOT EXISTS token_usage_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  conversation_id UUID,
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_token_usage_log_user ON token_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_log_created ON token_usage_log(created_at);

ALTER TABLE token_usage_log ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all' AND tablename = 'token_usage_log') THEN
    CREATE POLICY "Allow all" ON token_usage_log FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ── 2. Pinned Conversations ────────────────────────
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT FALSE;

-- ── 3. user_memory conversation_id scoping ─────────
ALTER TABLE user_memory ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE DEFAULT NULL;
CREATE INDEX IF NOT EXISTS idx_user_memory_conversation ON user_memory(conversation_id);

-- ── 4. Background Generation: message status ───────
ALTER TABLE messages ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'done';
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status) WHERE status = 'generating';

-- ── 5. Memory Refactor: JSON content + upsert ──────
-- Convert existing plain text content to JSON format
UPDATE user_memory
SET content = json_build_object(
  'text', content,
  'source', 'manual',
  'updatedAt', COALESCE(updated_at::text, created_at::text, now()::text)
)::text
WHERE content NOT LIKE '{"text":%';

-- Unique constraint: one memory per (user, category, conversation)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_memory_unique_scope
  ON user_memory(user_id, category, COALESCE(conversation_id::text, '__global__'));
