-- ============================================
-- 9Chat — Full Database Schema (Consolidated)
-- Run in Supabase SQL Editor
-- Safe to re-run (uses IF NOT EXISTS)
-- ============================================

-- ── Users ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT DEFAULT '',
  avatar TEXT DEFAULT '',
  role TEXT DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active BOOLEAN DEFAULT TRUE,
  password_hash TEXT NOT NULL,
  default_model TEXT,
  allowed_models JSONB,
  token_input_used BIGINT DEFAULT 0,
  token_output_used BIGINT DEFAULT 0,
  token_limit BIGINT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Projects ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📁',
  password_hash TEXT,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Agents ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '🤖',
  system_prompt TEXT DEFAULT '',
  model TEXT NOT NULL,
  temperature REAL DEFAULT 0.7,
  max_tokens INT DEFAULT 4096,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Skills ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS skills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '⚡',
  prompt_template TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Knowledge Sources ──────────────────────────────
CREATE TABLE IF NOT EXISTS knowledge_sources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  content TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Conversations ──────────────────────────────────
CREATE TABLE IF NOT EXISTS conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  title TEXT DEFAULT 'New Chat',
  model TEXT NOT NULL,
  system_prompt TEXT,
  pinned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Messages ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT DEFAULT '',
  thinking TEXT,
  tokens_used INT,
  response_time_ms INT,
  status TEXT DEFAULT 'done' CHECK (status IN ('generating', 'done', 'failed')),
  edit_group_id UUID,
  branch_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── User Memory ────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general' CHECK (category IN ('preference', 'project', 'personal', 'technical', 'general')),
  source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'auto')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Token Usage Log ────────────────────────────────
CREATE TABLE IF NOT EXISTS token_usage_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  model TEXT NOT NULL,
  conversation_id UUID,
  input_tokens INT DEFAULT 0,
  output_tokens INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ── App Settings ───────────────────────────────────
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ── Junction Tables ────────────────────────────────
CREATE TABLE IF NOT EXISTS agent_skills (
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, skill_id)
);

CREATE TABLE IF NOT EXISTS agent_knowledge (
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  knowledge_id UUID REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, knowledge_id)
);

-- ── Indexes ────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status) WHERE status = 'generating';
CREATE INDEX IF NOT EXISTS idx_messages_thinking ON messages(thinking) WHERE thinking IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_edit_group ON messages(edit_group_id) WHERE edit_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_user ON conversations(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_project ON conversations(project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_pinned ON conversations(user_id, pinned) WHERE pinned = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_memory_user ON user_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_conversation ON user_memory(conversation_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_log_user ON token_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_log_created ON token_usage_log(created_at);

-- Unique constraint: one memory per (user, category, conversation)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_memory_unique_scope
  ON user_memory(user_id, category, COALESCE(conversation_id::text, '__global__'));

-- ── Row Level Security ─────────────────────────────
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage_log ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all' AND tablename = 'messages') THEN
    CREATE POLICY "Allow all" ON messages FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all' AND tablename = 'conversations') THEN
    CREATE POLICY "Allow all" ON conversations FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all' AND tablename = 'user_memory') THEN
    CREATE POLICY "Allow all" ON user_memory FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all' AND tablename = 'token_usage_log') THEN
    CREATE POLICY "Allow all" ON token_usage_log FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
