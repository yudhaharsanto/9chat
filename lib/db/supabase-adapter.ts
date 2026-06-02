// Supabase adapter — wraps Supabase client into DBAdapter interface

import { createClient } from "@/lib/supabase/client";
import type { DBAdapter, DBResult, DBListResult } from "./adapter";

export class SupabaseAdapter implements DBAdapter {
  async test(): Promise<boolean> {
    try {
      const supabase = createClient();
      const { error } = await supabase.from("app_settings").select("key").limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  // ── App Settings ──
  async getSetting(key: string): Promise<DBResult<unknown>> {
    const supabase = createClient();
    const { data, error } = await supabase.from("app_settings").select("value").eq("key", key).single();
    if (error) return { data: null, error: error.message };
    return { data: data?.value ?? null, error: null };
  }

  async setSetting(key: string, value: unknown): Promise<DBResult<boolean>> {
    const supabase = createClient();
    const { error } = await supabase.from("app_settings").upsert({ key, value });
    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  }

  // ── Users ──
  async getUserByUsername(username: string): Promise<DBResult<Record<string, unknown>>> {
    const supabase = createClient();
    const { data, error } = await supabase.from("users").select("*").eq("username", username).single();
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  }

  async createUser(user: Record<string, unknown>): Promise<DBResult<Record<string, unknown>>> {
    const supabase = createClient();
    const { data, error } = await supabase.from("users").insert(user).select("*").single();
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  }

  async updateUser(id: string, updates: Record<string, unknown>): Promise<DBResult<boolean>> {
    const supabase = createClient();
    const { error } = await supabase.from("users").update(updates).eq("id", id);
    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  }

  async deleteUser(id: string): Promise<DBResult<boolean>> {
    const supabase = createClient();
    const { error } = await supabase.from("users").delete().eq("id", id);
    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  }

  async listUsers(): Promise<DBListResult<Record<string, unknown>>> {
    const supabase = createClient();
    const { data, error } = await supabase.from("users").select("*").order("created_at");
    if (error) return { data: [], error: error.message };
    return { data: data || [], error: null };
  }

  // ── Projects ──
  async listProjects(userId: string): Promise<DBListResult<Record<string, unknown>>> {
    const supabase = createClient();
    const { data, error } = await supabase.from("projects").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
    if (error) return { data: [], error: error.message };
    return { data: data || [], error: null };
  }

  async createProject(project: Record<string, unknown>): Promise<DBResult<Record<string, unknown>>> {
    const supabase = createClient();
    const { data, error } = await supabase.from("projects").insert(project).select("*").single();
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  }

  async updateProject(id: string, updates: Record<string, unknown>): Promise<DBResult<boolean>> {
    const supabase = createClient();
    const { error } = await supabase.from("projects").update(updates).eq("id", id);
    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  }

  async deleteProject(id: string): Promise<DBResult<boolean>> {
    const supabase = createClient();
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  }

  // ── Agents ──
  async listAgents(userId: string): Promise<DBListResult<Record<string, unknown>>> {
    const supabase = createClient();
    const { data, error } = await supabase.from("agents").select("*").or(`user_id.eq.${userId},is_public.eq.true`).order("name");
    if (error) return { data: [], error: error.message };
    return { data: data || [], error: null };
  }

  async createAgent(agent: Record<string, unknown>): Promise<DBResult<Record<string, unknown>>> {
    const supabase = createClient();
    const { data, error } = await supabase.from("agents").insert(agent).select("*").single();
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  }

  async updateAgent(id: string, updates: Record<string, unknown>): Promise<DBResult<boolean>> {
    const supabase = createClient();
    const { error } = await supabase.from("agents").update(updates).eq("id", id);
    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  }

  async deleteAgent(id: string): Promise<DBResult<boolean>> {
    const supabase = createClient();
    const { error } = await supabase.from("agents").delete().eq("id", id);
    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  }

  async getAgent(id: string): Promise<DBResult<Record<string, unknown>>> {
    const supabase = createClient();
    const { data, error } = await supabase.from("agents").select("*").eq("id", id).single();
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  }

  // ── Conversations ──
  async listConversations(userId: string, projectId?: string | null): Promise<DBListResult<Record<string, unknown>>> {
    const supabase = createClient();
    let query = supabase.from("conversations").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
    if (projectId) query = query.eq("project_id", projectId);
    else if (projectId === null) query = query.is("project_id", null);
    const { data, error } = await query;
    if (error) return { data: [], error: error.message };
    return { data: data || [], error: null };
  }

  async getConversation(id: string): Promise<DBResult<Record<string, unknown>>> {
    const supabase = createClient();
    const { data, error } = await supabase.from("conversations").select("*").eq("id", id).single();
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  }

  async createConversation(conv: Record<string, unknown>): Promise<DBResult<Record<string, unknown>>> {
    const supabase = createClient();
    const { data, error } = await supabase.from("conversations").insert(conv).select("*").single();
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  }

  async updateConversation(id: string, updates: Record<string, unknown>): Promise<DBResult<boolean>> {
    const supabase = createClient();
    const { error } = await supabase.from("conversations").update(updates).eq("id", id);
    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  }

  async deleteConversation(id: string): Promise<DBResult<boolean>> {
    const supabase = createClient();
    const { error } = await supabase.from("conversations").delete().eq("id", id);
    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  }

  // ── Messages ──
  async listMessages(conversationId: string): Promise<DBListResult<Record<string, unknown>>> {
    const supabase = createClient();
    const { data, error } = await supabase.from("messages").select("*").eq("conversation_id", conversationId).order("created_at");
    if (error) return { data: [], error: error.message };
    return { data: data || [], error: null };
  }

  async createMessage(msg: Record<string, unknown>): Promise<DBResult<Record<string, unknown>>> {
    const supabase = createClient();
    const { data, error } = await supabase.from("messages").insert(msg).select("*").single();
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  }

  async deleteMessage(id: string): Promise<DBResult<boolean>> {
    const supabase = createClient();
    const { error } = await supabase.from("messages").delete().eq("id", id);
    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  }

  // ── Skills ──
  async listSkills(): Promise<DBListResult<Record<string, unknown>>> {
    const supabase = createClient();
    const { data, error } = await supabase.from("skills").select("*").order("category, name");
    if (error) return { data: [], error: error.message };
    return { data: data || [], error: null };
  }

  async createSkill(skill: Record<string, unknown>): Promise<DBResult<Record<string, unknown>>> {
    const supabase = createClient();
    const { data, error } = await supabase.from("skills").insert(skill).select("*").single();
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  }

  async updateSkill(id: string, updates: Record<string, unknown>): Promise<DBResult<boolean>> {
    const supabase = createClient();
    const { error } = await supabase.from("skills").update(updates).eq("id", id);
    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  }

  async deleteSkill(id: string): Promise<DBResult<boolean>> {
    const supabase = createClient();
    const { error } = await supabase.from("skills").delete().eq("id", id);
    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  }

  // ── Knowledge Sources ──
  async listKnowledgeSources(userId: string): Promise<DBListResult<Record<string, unknown>>> {
    const supabase = createClient();
    const { data, error } = await supabase.from("knowledge_sources").select("*").or(`user_id.eq.${userId},user_id.is.null`).order("name");
    if (error) return { data: [], error: error.message };
    return { data: data || [], error: null };
  }

  async createKnowledgeSource(ks: Record<string, unknown>): Promise<DBResult<Record<string, unknown>>> {
    const supabase = createClient();
    const { data, error } = await supabase.from("knowledge_sources").insert(ks).select("*").single();
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  }

  async updateKnowledgeSource(id: string, updates: Record<string, unknown>): Promise<DBResult<boolean>> {
    const supabase = createClient();
    const { error } = await supabase.from("knowledge_sources").update(updates).eq("id", id);
    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  }

  async deleteKnowledgeSource(id: string): Promise<DBResult<boolean>> {
    const supabase = createClient();
    const { error } = await supabase.from("knowledge_sources").delete().eq("id", id);
    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  }

  // ── User Memory ──
  async listMemories(userId: string, conversationId?: string): Promise<DBListResult<Record<string, unknown>>> {
    const supabase = createClient();
    let query = supabase.from("user_memory").select("*").eq("user_id", userId);
    if (conversationId) {
      query = query.or(`conversation_id.is.null,conversation_id.eq.${conversationId}`);
    } else {
      query = query.is("conversation_id", null);
    }
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) return { data: [], error: error.message };
    return { data: data || [], error: null };
  }

  async createMemory(memory: Record<string, unknown>): Promise<DBResult<Record<string, unknown>>> {
    const supabase = createClient();
    const { data, error } = await supabase.from("user_memory").insert(memory).select("*").single();
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  }

  async updateMemory(id: string, updates: Record<string, unknown>): Promise<DBResult<boolean>> {
    const supabase = createClient();
    const { error } = await supabase.from("user_memory").update(updates).eq("id", id);
    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  }

  async deleteMemory(id: string): Promise<DBResult<boolean>> {
    const supabase = createClient();
    const { error } = await supabase.from("user_memory").delete().eq("id", id);
    if (error) return { data: null, error: error.message };
    return { data: true, error: null };
  }

  // ── Uploaded Images ──
  async createUploadedImage(img: Record<string, unknown>): Promise<DBResult<Record<string, unknown>>> {
    const supabase = createClient();
    const { data, error } = await supabase.from("uploaded_images").insert(img).select("*").single();
    if (error) return { data: null, error: error.message };
    return { data, error: null };
  }

  async listUploadedImages(conversationId: string): Promise<DBListResult<Record<string, unknown>>> {
    const supabase = createClient();
    const { data, error } = await supabase.from("uploaded_images").select("*").eq("conversation_id", conversationId).order("created_at");
    if (error) return { data: [], error: error.message };
    return { data: data || [], error: null };
  }

  // ── Generic ──
  async query(sql: string, _params?: unknown[]): Promise<DBListResult<Record<string, unknown>>> {
    // Supabase doesn't support raw SQL easily from client, return empty
    console.warn("SupabaseAdapter.query() not supported for raw SQL:", sql);
    return { data: [], error: "Raw SQL not supported in Supabase client mode" };
  }
}
