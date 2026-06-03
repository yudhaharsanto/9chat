-- ============================================
-- 9Chat Full Schema v5 (Clean Reset)
-- Copy-paste seluruh file ini ke Supabase SQL Editor
-- ============================================

-- =====================
-- 1. APP SETTINGS (key-value config store)
-- =====================
CREATE TABLE app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Default settings
-- admin_password = SHA-256 of "admin"
INSERT INTO app_settings (key, value) VALUES
  ('admin_password', '"8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918"'::jsonb),
  ('9router_url', '""'::jsonb),
  ('9router_api_key', '""'::jsonb),
  ('google_drive_credentials', '""'::jsonb),
  ('google_drive_folder_id', '""'::jsonb),
  ('enabled_models', '[]'::jsonb),
  ('model_aliases', '{}'::jsonb),
  ('chat_password', 'null'::jsonb);

-- =====================
-- 2. USERS
-- =====================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar TEXT DEFAULT '👤',
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  is_active BOOLEAN DEFAULT true,
  default_model TEXT DEFAULT NULL,
  allowed_models JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Default admin (username: admin, password: admin)
INSERT INTO users (username, password_hash, display_name, role) VALUES
  ('admin', '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918', 'Admin', 'admin');

-- =====================
-- 3. PROJECTS (folders)
-- =====================
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📁',
  password_hash TEXT DEFAULT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- 4. AGENTS (AI personalities)
-- =====================
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '🤖',
  system_prompt TEXT NOT NULL DEFAULT '',
  model TEXT DEFAULT 'gpt-4o',
  temperature NUMERIC(3,2) DEFAULT 0.7,
  max_tokens INT DEFAULT 4096,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  is_public BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- 5. CONVERSATIONS
-- =====================
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'New Chat',
  model TEXT NOT NULL DEFAULT 'gpt-4o',
  system_prompt TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- 6. MESSAGES
-- =====================
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  tokens_used INT DEFAULT NULL,
  edit_group_id TEXT DEFAULT NULL,
  branch_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- 7. SKILLS (prompt templates)
-- =====================
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '⚡',
  prompt_template TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Default skills
INSERT INTO skills (name, description, icon, prompt_template, category) VALUES
  ('Code Review', 'Review code for bugs, security issues, and best practices', '🔍',
   'You are a senior code reviewer. Review the following code for:
- Bugs and potential issues
- Security vulnerabilities
- Performance concerns
- Best practices and code style

Provide specific, actionable feedback.', 'coding'),
  ('Translator', 'Translate text between languages', '🌐',
   'You are an expert translator. Translate the user''s text accurately while preserving:
- Original meaning and nuance
- Tone and style
- Cultural context

If no target language is specified, translate to English.', 'language'),
  ('Summarizer', 'Summarize long text into key points', '📝',
   'You are an expert summarizer. Create clear, concise summaries that:
- Capture the main points
- Preserve important details
- Use bullet points for clarity
- Maintain the original tone', 'productivity'),
  ('Code Generator', 'Generate code from descriptions', '💻',
   'You are an expert programmer. Write clean, well-documented code that:
- Follows best practices
- Includes error handling
- Has clear comments
- Is production-ready

Ask for clarification if the requirements are unclear.', 'coding'),
  ('Creative Writer', 'Write creative content', '✍️',
   'You are a creative writer with a vivid imagination. Write engaging, original content that:
- Captivates the reader
- Uses vivid descriptions
- Has a compelling narrative
- Matches the requested tone and style', 'creative');

-- =====================
-- 8. KNOWLEDGE SOURCES
-- =====================
CREATE TABLE knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  content TEXT NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Default knowledge sources
INSERT INTO knowledge_sources (name, description, content) VALUES
  ('Web', 'Pengetahuan inti seputar pengembangan web modern.', '## Topik Utama
- **Frontend**: HTML5, CSS3, JavaScript (ES6+), React, Vue
- **Backend**: Node.js, Django, Laravel, REST/GraphQL API
- **Database**: PostgreSQL, MongoDB, Redis
- **Performance**: Lighthouse, CDN, Caching
- **Security**: HTTPS, OAuth 2.0, JWT, anti-XSS/CSRF

## Tag
`#web` `#frontend` `#backend` `#api` `#security`'),
  ('Akademik', 'Pengetahuan untuk riset dan penulisan ilmiah.', '## Topik Utama
- **Metodologi**: Kualitatif, Kuantitatif, Mixed Method
- **Struktur Paper**: Abstrak → Pendahuluan → Metode → Hasil → Kesimpulan
- **Sitasi**: APA, IEEE, MLA
- **Sumber Terpercaya**: Scopus, IEEE Xplore, Google Scholar, DOAJ

## Rumus Dasar
Mean:
$\bar{x} = \frac{1}{n}\sum_{i=1}^{n} x_i$

Standar Deviasi:
$\sigma = \sqrt{\frac{1}{n}\sum_{i=1}^{n}(x_i - \bar{x})^2}$

## Tag
`#academic` `#research` `#citation` `#methodology`'),
  ('Developer', 'Pengetahuan untuk pengembangan software.', '## Topik Utama
- **Bahasa**: Python, JavaScript, TypeScript, Go, Rust, Kotlin
- **Version Control**:
```bash
git add .
git commit -m "pesan"
git push origin main
```
- **Prinsip**: DRY, KISS, SOLID, Clean Code
- **DevOps**: Docker, Kubernetes, CI/CD (GitHub Actions)
- **Cloud**: AWS, GCP, Azure

## Best Practices
- ✅ Tulis unit & integration test
- ✅ Code review sebelum merge
- ✅ Semantic versioning (`MAJOR.MINOR.PATCH`)

## Tag
`#developer` `#git` `#devops` `#cleancode`');

-- =====================
-- 9. JUNCTION TABLES
-- =====================
CREATE TABLE agent_skills (
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  skill_id UUID REFERENCES skills(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, skill_id)
);

CREATE TABLE agent_knowledge (
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  knowledge_id UUID REFERENCES knowledge_sources(id) ON DELETE CASCADE,
  PRIMARY KEY (agent_id, knowledge_id)
);

-- =====================
-- 10. USER MEMORY (cross-conversation memory)
-- =====================
CREATE TABLE user_memory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE DEFAULT NULL,
  content TEXT NOT NULL,
  category TEXT DEFAULT 'general' CHECK (category IN ('preference', 'project', 'personal', 'technical', 'general')),
  source TEXT DEFAULT 'manual' CHECK (source IN ('auto', 'manual', 'legacy')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- 11. UPLOADED IMAGES
-- =====================
CREATE TABLE uploaded_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  imgbb_id TEXT DEFAULT NULL,
  filename TEXT DEFAULT '',
  file_size INT DEFAULT 0,
  mime_type TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =====================
-- 11. INDEXES
-- =====================
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_edit_group ON messages(edit_group_id, branch_index);
CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC);
CREATE INDEX idx_conversations_project ON conversations(project_id);
CREATE INDEX idx_conversations_user ON conversations(user_id);
CREATE INDEX idx_conversations_agent ON conversations(agent_id);
CREATE INDEX idx_projects_updated ON projects(updated_at DESC);
CREATE INDEX idx_projects_user ON projects(user_id);
CREATE INDEX idx_agents_user ON agents(user_id);
CREATE INDEX idx_agents_public ON agents(is_public) WHERE is_public = true;
CREATE INDEX idx_knowledge_user ON knowledge_sources(user_id);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_uploaded_images_conversation ON uploaded_images(conversation_id);
CREATE INDEX idx_uploaded_images_user ON uploaded_images(user_id);
CREATE INDEX idx_user_memory_user ON user_memory(user_id);
CREATE INDEX idx_user_memory_category ON user_memory(category);
CREATE INDEX idx_user_memory_conversation ON user_memory(conversation_id);

-- Unique constraint: one memory per (user, category, conversation)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_memory_unique_scope
  ON user_memory(user_id, category, COALESCE(conversation_id::text, '__global__'));

-- =====================
-- 11. ROW LEVEL SECURITY
-- =====================
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON app_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON agents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON conversations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON skills FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON knowledge_sources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON agent_skills FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON agent_knowledge FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON uploaded_images FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON user_memory FOR ALL USING (true) WITH CHECK (true);

-- =====================
-- 12. TRIGGERS (auto-update updated_at)
-- =====================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER trg_app_settings BEFORE UPDATE ON app_settings FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_projects BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_agents BEFORE UPDATE ON agents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_conversations BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_skills BEFORE UPDATE ON skills FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_knowledge BEFORE UPDATE ON knowledge_sources FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_user_memory BEFORE UPDATE ON user_memory FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- DONE! Tables created:
--   app_settings   - key-value config (admin pw, 9router, models, dll)
--   users          - user accounts (admin/user, default_model)
--   projects       - chat folders
--   agents         - AI agents (system prompt, model, temperature)
--   conversations  - chat sessions (user_id, agent_id)
--   messages       - chat messages
--   skills         - prompt templates
--   knowledge_sources - knowledge base per user
--   agent_skills   - junction: agent ↔ skill
--   agent_knowledge - junction: agent ↔ knowledge
--   user_memory    - cross-conversation user memory
--   uploaded_images - image uploads linked to conversations
-- ============================================
