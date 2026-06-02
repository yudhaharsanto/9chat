// Database adapter interface — abstracts Supabase and PostgreSQL

export interface DBResult<T> {
  data: T | null;
  error: string | null;
}

export interface DBListResult<T> {
  data: T[];
  error: string | null;
}

export interface DBAdapter {
  // Health check
  test(): Promise<boolean>;

  // ── App Settings ──
  getSetting(key: string): Promise<DBResult<unknown>>;
  setSetting(key: string, value: unknown): Promise<DBResult<boolean>>;

  // ── Users ──
  getUserByUsername(username: string): Promise<DBResult<Record<string, unknown>>>;
  createUser(user: Record<string, unknown>): Promise<DBResult<Record<string, unknown>>>;
  updateUser(id: string, updates: Record<string, unknown>): Promise<DBResult<boolean>>;
  deleteUser(id: string): Promise<DBResult<boolean>>;
  listUsers(): Promise<DBListResult<Record<string, unknown>>>;

  // ── Projects ──
  listProjects(userId: string): Promise<DBListResult<Record<string, unknown>>>;
  createProject(project: Record<string, unknown>): Promise<DBResult<Record<string, unknown>>>;
  updateProject(id: string, updates: Record<string, unknown>): Promise<DBResult<boolean>>;
  deleteProject(id: string): Promise<DBResult<boolean>>;

  // ── Agents ──
  listAgents(userId: string): Promise<DBListResult<Record<string, unknown>>>;
  createAgent(agent: Record<string, unknown>): Promise<DBResult<Record<string, unknown>>>;
  updateAgent(id: string, updates: Record<string, unknown>): Promise<DBResult<boolean>>;
  deleteAgent(id: string): Promise<DBResult<boolean>>;
  getAgent(id: string): Promise<DBResult<Record<string, unknown>>>;

  // ── Conversations ──
  listConversations(userId: string, projectId?: string | null): Promise<DBListResult<Record<string, unknown>>>;
  getConversation(id: string): Promise<DBResult<Record<string, unknown>>>;
  createConversation(conv: Record<string, unknown>): Promise<DBResult<Record<string, unknown>>>;
  updateConversation(id: string, updates: Record<string, unknown>): Promise<DBResult<boolean>>;
  deleteConversation(id: string): Promise<DBResult<boolean>>;

  // ── Messages ──
  listMessages(conversationId: string): Promise<DBListResult<Record<string, unknown>>>;
  createMessage(msg: Record<string, unknown>): Promise<DBResult<Record<string, unknown>>>;
  deleteMessage(id: string): Promise<DBResult<boolean>>;

  // ── Skills ──
  listSkills(): Promise<DBListResult<Record<string, unknown>>>;
  createSkill(skill: Record<string, unknown>): Promise<DBResult<Record<string, unknown>>>;
  updateSkill(id: string, updates: Record<string, unknown>): Promise<DBResult<boolean>>;
  deleteSkill(id: string): Promise<DBResult<boolean>>;

  // ── Knowledge Sources ──
  listKnowledgeSources(userId: string): Promise<DBListResult<Record<string, unknown>>>;
  createKnowledgeSource(ks: Record<string, unknown>): Promise<DBResult<Record<string, unknown>>>;
  updateKnowledgeSource(id: string, updates: Record<string, unknown>): Promise<DBResult<boolean>>;
  deleteKnowledgeSource(id: string): Promise<DBResult<boolean>>;

  // ── User Memory ──
  listMemories(userId: string, conversationId?: string): Promise<DBListResult<Record<string, unknown>>>;
  createMemory(memory: Record<string, unknown>): Promise<DBResult<Record<string, unknown>>>;
  updateMemory(id: string, updates: Record<string, unknown>): Promise<DBResult<boolean>>;
  deleteMemory(id: string): Promise<DBResult<boolean>>;

  // ── Uploaded Images ──
  createUploadedImage(img: Record<string, unknown>): Promise<DBResult<Record<string, unknown>>>;
  listUploadedImages(conversationId: string): Promise<DBListResult<Record<string, unknown>>>;

  // ── Generic (for flexible queries) ──
  query(sql: string, params?: unknown[]): Promise<DBListResult<Record<string, unknown>>>;
}
