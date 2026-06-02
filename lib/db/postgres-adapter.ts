// PostgreSQL adapter — uses 'pg' pool for direct PostgreSQL connections

import { Pool } from "pg";
import type { DBAdapter, DBResult, DBListResult } from "./adapter";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL environment variable is required for PostgreSQL mode");
    pool = new Pool({ connectionString: url, max: 10, idleTimeoutMillis: 30000 });
  }
  return pool;
}

export class PostgresAdapter implements DBAdapter {
  async test(): Promise<boolean> {
    try {
      const client = await getPool().connect();
      await client.query("SELECT 1");
      client.release();
      return true;
    } catch {
      return false;
    }
  }

  // ── App Settings ──
  async getSetting(key: string): Promise<DBResult<unknown>> {
    try {
      const { rows } = await getPool().query("SELECT value FROM app_settings WHERE key = $1", [key]);
      if (rows.length === 0) return { data: null, error: null };
      return { data: rows[0].value, error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  async setSetting(key: string, value: unknown): Promise<DBResult<boolean>> {
    try {
      await getPool().query(
        "INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
        [key, JSON.stringify(value)]
      );
      return { data: true, error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  // ── Users ──
  async getUserByUsername(username: string): Promise<DBResult<Record<string, unknown>>> {
    try {
      const { rows } = await getPool().query("SELECT * FROM users WHERE username = $1", [username]);
      if (rows.length === 0) return { data: null, error: "Not found" };
      return { data: rows[0], error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  async createUser(user: Record<string, unknown>): Promise<DBResult<Record<string, unknown>>> {
    try {
      const keys = Object.keys(user);
      const vals = Object.values(user);
      const placeholders = keys.map((_, i) => `$${i + 1}`);
      const { rows } = await getPool().query(
        `INSERT INTO users (${keys.join(",")}) VALUES (${placeholders.join(",")}) RETURNING *`,
        vals
      );
      return { data: rows[0], error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  async updateUser(id: string, updates: Record<string, unknown>): Promise<DBResult<boolean>> {
    try {
      const keys = Object.keys(updates);
      const vals = Object.values(updates);
      const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
      await getPool().query(`UPDATE users SET ${setClauses.join(",")} WHERE id = $${keys.length + 1}`, [...vals, id]);
      return { data: true, error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  async deleteUser(id: string): Promise<DBResult<boolean>> {
    try {
      await getPool().query("DELETE FROM users WHERE id = $1", [id]);
      return { data: true, error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  async listUsers(): Promise<DBListResult<Record<string, unknown>>> {
    try {
      const { rows } = await getPool().query("SELECT * FROM users ORDER BY created_at");
      return { data: rows, error: null };
    } catch (e) { return { data: [], error: (e as Error).message }; }
  }

  // ── Projects ──
  async listProjects(userId: string): Promise<DBListResult<Record<string, unknown>>> {
    try {
      const { rows } = await getPool().query("SELECT * FROM projects WHERE user_id = $1 ORDER BY updated_at DESC", [userId]);
      return { data: rows, error: null };
    } catch (e) { return { data: [], error: (e as Error).message }; }
  }

  async createProject(project: Record<string, unknown>): Promise<DBResult<Record<string, unknown>>> {
    try {
      const keys = Object.keys(project);
      const vals = Object.values(project);
      const placeholders = keys.map((_, i) => `$${i + 1}`);
      const { rows } = await getPool().query(
        `INSERT INTO projects (${keys.join(",")}) VALUES (${placeholders.join(",")}) RETURNING *`,
        vals
      );
      return { data: rows[0], error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  async updateProject(id: string, updates: Record<string, unknown>): Promise<DBResult<boolean>> {
    try {
      const keys = Object.keys(updates);
      const vals = Object.values(updates);
      const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
      await getPool().query(`UPDATE projects SET ${setClauses.join(",")} WHERE id = $${keys.length + 1}`, [...vals, id]);
      return { data: true, error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  async deleteProject(id: string): Promise<DBResult<boolean>> {
    try {
      await getPool().query("DELETE FROM projects WHERE id = $1", [id]);
      return { data: true, error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  // ── Agents ──
  async listAgents(userId: string): Promise<DBListResult<Record<string, unknown>>> {
    try {
      const { rows } = await getPool().query("SELECT * FROM agents WHERE user_id = $1 OR is_public = true ORDER BY name", [userId]);
      return { data: rows, error: null };
    } catch (e) { return { data: [], error: (e as Error).message }; }
  }

  async createAgent(agent: Record<string, unknown>): Promise<DBResult<Record<string, unknown>>> {
    try {
      const keys = Object.keys(agent);
      const vals = Object.values(agent);
      const placeholders = keys.map((_, i) => `$${i + 1}`);
      const { rows } = await getPool().query(
        `INSERT INTO agents (${keys.join(",")}) VALUES (${placeholders.join(",")}) RETURNING *`,
        vals
      );
      return { data: rows[0], error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  async updateAgent(id: string, updates: Record<string, unknown>): Promise<DBResult<boolean>> {
    try {
      const keys = Object.keys(updates);
      const vals = Object.values(updates);
      const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
      await getPool().query(`UPDATE agents SET ${setClauses.join(",")} WHERE id = $${keys.length + 1}`, [...vals, id]);
      return { data: true, error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  async deleteAgent(id: string): Promise<DBResult<boolean>> {
    try {
      await getPool().query("DELETE FROM agents WHERE id = $1", [id]);
      return { data: true, error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  async getAgent(id: string): Promise<DBResult<Record<string, unknown>>> {
    try {
      const { rows } = await getPool().query("SELECT * FROM agents WHERE id = $1", [id]);
      if (rows.length === 0) return { data: null, error: "Not found" };
      return { data: rows[0], error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  // ── Conversations ──
  async listConversations(userId: string, projectId?: string | null): Promise<DBListResult<Record<string, unknown>>> {
    try {
      let query: string;
      let params: unknown[];
      if (projectId) {
        query = "SELECT * FROM conversations WHERE user_id = $1 AND project_id = $2 ORDER BY updated_at DESC";
        params = [userId, projectId];
      } else if (projectId === null) {
        query = "SELECT * FROM conversations WHERE user_id = $1 AND project_id IS NULL ORDER BY updated_at DESC";
        params = [userId];
      } else {
        query = "SELECT * FROM conversations WHERE user_id = $1 ORDER BY updated_at DESC";
        params = [userId];
      }
      const { rows } = await getPool().query(query, params);
      return { data: rows, error: null };
    } catch (e) { return { data: [], error: (e as Error).message }; }
  }

  async getConversation(id: string): Promise<DBResult<Record<string, unknown>>> {
    try {
      const { rows } = await getPool().query("SELECT * FROM conversations WHERE id = $1", [id]);
      if (rows.length === 0) return { data: null, error: "Not found" };
      return { data: rows[0], error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  async createConversation(conv: Record<string, unknown>): Promise<DBResult<Record<string, unknown>>> {
    try {
      const keys = Object.keys(conv);
      const vals = Object.values(conv);
      const placeholders = keys.map((_, i) => `$${i + 1}`);
      const { rows } = await getPool().query(
        `INSERT INTO conversations (${keys.join(",")}) VALUES (${placeholders.join(",")}) RETURNING *`,
        vals
      );
      return { data: rows[0], error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  async updateConversation(id: string, updates: Record<string, unknown>): Promise<DBResult<boolean>> {
    try {
      const keys = Object.keys(updates);
      const vals = Object.values(updates);
      const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
      await getPool().query(`UPDATE conversations SET ${setClauses.join(",")} WHERE id = $${keys.length + 1}`, [...vals, id]);
      return { data: true, error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  async deleteConversation(id: string): Promise<DBResult<boolean>> {
    try {
      await getPool().query("DELETE FROM conversations WHERE id = $1", [id]);
      return { data: true, error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  // ── Messages ──
  async listMessages(conversationId: string): Promise<DBListResult<Record<string, unknown>>> {
    try {
      const { rows } = await getPool().query("SELECT * FROM messages WHERE conversation_id = $1 ORDER BY created_at", [conversationId]);
      return { data: rows, error: null };
    } catch (e) { return { data: [], error: (e as Error).message }; }
  }

  async createMessage(msg: Record<string, unknown>): Promise<DBResult<Record<string, unknown>>> {
    try {
      const keys = Object.keys(msg);
      const vals = Object.values(msg);
      const placeholders = keys.map((_, i) => `$${i + 1}`);
      const { rows } = await getPool().query(
        `INSERT INTO messages (${keys.join(",")}) VALUES (${placeholders.join(",")}) RETURNING *`,
        vals
      );
      return { data: rows[0], error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  async deleteMessage(id: string): Promise<DBResult<boolean>> {
    try {
      await getPool().query("DELETE FROM messages WHERE id = $1", [id]);
      return { data: true, error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  // ── Skills ──
  async listSkills(): Promise<DBListResult<Record<string, unknown>>> {
    try {
      const { rows } = await getPool().query("SELECT * FROM skills ORDER BY category, name");
      return { data: rows, error: null };
    } catch (e) { return { data: [], error: (e as Error).message }; }
  }

  async createSkill(skill: Record<string, unknown>): Promise<DBResult<Record<string, unknown>>> {
    try {
      const keys = Object.keys(skill);
      const vals = Object.values(skill);
      const placeholders = keys.map((_, i) => `$${i + 1}`);
      const { rows } = await getPool().query(
        `INSERT INTO skills (${keys.join(",")}) VALUES (${placeholders.join(",")}) RETURNING *`,
        vals
      );
      return { data: rows[0], error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  async updateSkill(id: string, updates: Record<string, unknown>): Promise<DBResult<boolean>> {
    try {
      const keys = Object.keys(updates);
      const vals = Object.values(updates);
      const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
      await getPool().query(`UPDATE skills SET ${setClauses.join(",")} WHERE id = $${keys.length + 1}`, [...vals, id]);
      return { data: true, error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  async deleteSkill(id: string): Promise<DBResult<boolean>> {
    try {
      await getPool().query("DELETE FROM skills WHERE id = $1", [id]);
      return { data: true, error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  // ── Knowledge Sources ──
  async listKnowledgeSources(userId: string): Promise<DBListResult<Record<string, unknown>>> {
    try {
      const { rows } = await getPool().query("SELECT * FROM knowledge_sources WHERE user_id = $1 OR user_id IS NULL ORDER BY name", [userId]);
      return { data: rows, error: null };
    } catch (e) { return { data: [], error: (e as Error).message }; }
  }

  async createKnowledgeSource(ks: Record<string, unknown>): Promise<DBResult<Record<string, unknown>>> {
    try {
      const keys = Object.keys(ks);
      const vals = Object.values(ks);
      const placeholders = keys.map((_, i) => `$${i + 1}`);
      const { rows } = await getPool().query(
        `INSERT INTO knowledge_sources (${keys.join(",")}) VALUES (${placeholders.join(",")}) RETURNING *`,
        vals
      );
      return { data: rows[0], error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  async updateKnowledgeSource(id: string, updates: Record<string, unknown>): Promise<DBResult<boolean>> {
    try {
      const keys = Object.keys(updates);
      const vals = Object.values(updates);
      const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
      await getPool().query(`UPDATE knowledge_sources SET ${setClauses.join(",")} WHERE id = $${keys.length + 1}`, [...vals, id]);
      return { data: true, error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  async deleteKnowledgeSource(id: string): Promise<DBResult<boolean>> {
    try {
      await getPool().query("DELETE FROM knowledge_sources WHERE id = $1", [id]);
      return { data: true, error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  // ── User Memory ──
  async listMemories(userId: string, conversationId?: string): Promise<DBListResult<Record<string, unknown>>> {
    try {
      let query: string;
      let params: unknown[];
      if (conversationId) {
        query = "SELECT * FROM user_memory WHERE user_id = $1 AND (conversation_id IS NULL OR conversation_id = $2) ORDER BY created_at DESC";
        params = [userId, conversationId];
      } else {
        query = "SELECT * FROM user_memory WHERE user_id = $1 AND conversation_id IS NULL ORDER BY created_at DESC";
        params = [userId];
      }
      const { rows } = await getPool().query(query, params);
      return { data: rows, error: null };
    } catch (e) { return { data: [], error: (e as Error).message }; }
  }

  async createMemory(memory: Record<string, unknown>): Promise<DBResult<Record<string, unknown>>> {
    try {
      const keys = Object.keys(memory);
      const vals = Object.values(memory);
      const placeholders = keys.map((_, i) => `$${i + 1}`);
      const { rows } = await getPool().query(
        `INSERT INTO user_memory (${keys.join(",")}) VALUES (${placeholders.join(",")}) RETURNING *`,
        vals
      );
      return { data: rows[0], error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  async updateMemory(id: string, updates: Record<string, unknown>): Promise<DBResult<boolean>> {
    try {
      const keys = Object.keys(updates);
      const vals = Object.values(updates);
      const setClauses = keys.map((k, i) => `${k} = $${i + 1}`);
      await getPool().query(`UPDATE user_memory SET ${setClauses.join(",")} WHERE id = $${keys.length + 1}`, [...vals, id]);
      return { data: true, error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  async deleteMemory(id: string): Promise<DBResult<boolean>> {
    try {
      await getPool().query("DELETE FROM user_memory WHERE id = $1", [id]);
      return { data: true, error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  // ── Uploaded Images ──
  async createUploadedImage(img: Record<string, unknown>): Promise<DBResult<Record<string, unknown>>> {
    try {
      const keys = Object.keys(img);
      const vals = Object.values(img);
      const placeholders = keys.map((_, i) => `$${i + 1}`);
      const { rows } = await getPool().query(
        `INSERT INTO uploaded_images (${keys.join(",")}) VALUES (${placeholders.join(",")}) RETURNING *`,
        vals
      );
      return { data: rows[0], error: null };
    } catch (e) { return { data: null, error: (e as Error).message }; }
  }

  async listUploadedImages(conversationId: string): Promise<DBListResult<Record<string, unknown>>> {
    try {
      const { rows } = await getPool().query("SELECT * FROM uploaded_images WHERE conversation_id = $1 ORDER BY created_at", [conversationId]);
      return { data: rows, error: null };
    } catch (e) { return { data: [], error: (e as Error).message }; }
  }

  // ── Generic ──
  async query(sql: string, params?: unknown[]): Promise<DBListResult<Record<string, unknown>>> {
    try {
      const { rows } = await getPool().query(sql, params || []);
      return { data: rows, error: null };
    } catch (e) { return { data: [], error: (e as Error).message }; }
  }
}
