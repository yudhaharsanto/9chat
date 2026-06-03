"use client";

import { createContext, useContext, useState, useCallback, useEffect } from "react";
import type { Project, Conversation, Message, Agent, Skill, KnowledgeSource, UserMemory } from "@/lib/types";
import { useAuth } from "./auth-provider";
import { createClient } from "@/lib/supabase/client";

interface ChatContextType {
  // Projects
  projects: Project[];
  activeProject: Project | null;
  loadProjects: () => Promise<void>;
  createProject: (name: string, icon?: string, password?: string) => Promise<string>;
  deleteProject: (id: string) => Promise<void>;
  renameProject: (id: string, name: string) => Promise<void>;
  setActiveProject: (project: Project | null) => void;
  verifyProjectPassword: (projectId: string, password: string) => Promise<boolean>;
  // Conversations
  conversations: Conversation[];
  activeConversation: Conversation | null;
  messages: Message[];
  isLoadingMessages: boolean;
  loadConversations: (projectId?: string) => Promise<void>;
  createConversation: (model: string, projectId?: string, agentId?: string) => Promise<string>;
  selectConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  updateConversationModel: (id: string, model: string) => Promise<void>;
  togglePinConversation: (id: string, pinned: boolean) => Promise<void>;
  addMessage: (msg: Omit<Message, "id" | "created_at">) => Promise<Message | null>;
  deleteMessage: (id: string) => Promise<void>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setActiveConversation: (conv: Conversation | null) => void;
  // Agents
  agents: Agent[];
  activeAgent: Agent | null;
  loadAgents: () => Promise<void>;
  setActiveAgent: (agent: Agent | null) => void;
  // Skills
  skills: Skill[];
  loadSkills: () => Promise<void>;
  // Knowledge
  knowledgeSources: KnowledgeSource[];
  loadKnowledge: () => Promise<void>;
  // Memory
  memories: UserMemory[];
  loadMemories: (conversationId?: string) => Promise<void>;
  addMemory: (content: string, category?: string, conversationId?: string) => Promise<void>;
  updateMemory: (id: string, content: string, category?: string) => Promise<void>;
  deleteMemory: (id: string) => Promise<void>;
  parseMemoryText: (raw: string) => string;
}

const ChatContext = createContext<ChatContextType>({
  projects: [], activeProject: null,
  loadProjects: async () => {}, createProject: async () => "", deleteProject: async () => {},
  renameProject: async () => {}, setActiveProject: () => {}, verifyProjectPassword: async () => false,
  conversations: [], activeConversation: null, messages: [], isLoadingMessages: false,
  loadConversations: async () => {}, createConversation: async () => "", selectConversation: async () => {},
  deleteConversation: async () => {}, renameConversation: async () => {}, updateConversationModel: async () => {}, togglePinConversation: async () => {},
  addMessage: async () => null, deleteMessage: async () => {}, setMessages: () => {}, setActiveConversation: () => {},  agents: [], activeAgent: null, loadAgents: async () => {}, setActiveAgent: () => {},
  skills: [], loadSkills: async () => {},
  knowledgeSources: [], loadKnowledge: async () => {},
  memories: [], loadMemories: async () => {}, addMemory: async () => {}, updateMemory: async () => {}, deleteMemory: async () => {}, parseMemoryText: (s) => s,
});

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { currentUser } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversation, setActiveConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeAgent, setActiveAgent] = useState<Agent | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [knowledgeSources, setKnowledgeSources] = useState<KnowledgeSource[]>([]);
  const [memories, setMemories] = useState<UserMemory[]>([]);

  const isReady = !!currentUser;
  const userId = currentUser?.id;

  // ── Projects ──
  const loadProjects = useCallback(async () => {
    if (!isReady || !userId) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("projects").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
    if (data) setProjects(data);
  }, [isReady, userId]);

  const createProject = useCallback(async (name: string, icon = "📁", password?: string): Promise<string> => {
    if (!isReady || !userId) return "";
    const supabase = createClient();
    const row: Record<string, unknown> = { name, icon, user_id: userId };
    if (password) row.password_hash = btoa(password);
    const { data } = await supabase.from("projects").insert(row).select("id").single();
    if (data) { await loadProjects(); return data.id; }
    return "";
  }, [isReady, userId, loadProjects]);

  const deleteProject = useCallback(async (id: string) => {
    if (!isReady) return;
    const supabase = createClient();
    await supabase.from("projects").delete().eq("id", id);
    if (activeProject?.id === id) { setActiveProject(null); setConversations([]); }
    await loadProjects();
  }, [isReady, activeProject, loadProjects]);

  const renameProject = useCallback(async (id: string, name: string) => {
    if (!isReady) return;
    const supabase = createClient();
    await supabase.from("projects").update({ name }).eq("id", id);
    await loadProjects();
    if (activeProject?.id === id) setActiveProject((p) => p ? { ...p, name } : null);
  }, [isReady, activeProject, loadProjects]);

  const verifyProjectPassword = useCallback(async (projectId: string, password: string): Promise<boolean> => {
    if (!isReady) return false;
    const supabase = createClient();
    const { data } = await supabase.from("projects").select("password_hash").eq("id", projectId).single();
    if (!data?.password_hash) return true;
    return btoa(password) === data.password_hash;
  }, [isReady]);

  // ── Conversations ──
  const loadConversations = useCallback(async (projectId?: string) => {
    if (!isReady || !userId) return;
    const supabase = createClient();
    let query = supabase.from("conversations").select("*").eq("user_id", userId).order("updated_at", { ascending: false });
    if (projectId) query = query.eq("project_id", projectId);
    else query = query.is("project_id", null);
    const { data } = await query;
    if (data) {
      const sorted = data.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
      setConversations(sorted);
    }
  }, [isReady, userId]);

  const createConversation = useCallback(async (model: string, projectId?: string, agentId?: string): Promise<string> => {
    if (!isReady || !userId) return "";
    const supabase = createClient();
    const row: Record<string, unknown> = { model, user_id: userId };
    if (projectId) row.project_id = projectId;
    if (agentId) row.agent_id = agentId;
    const { data } = await supabase.from("conversations").insert(row).select("id").single();
    if (data) { await loadConversations(projectId ?? activeProject?.id); return data.id; }
    return "";
  }, [isReady, userId, loadConversations, activeProject]);

  // ── Memory ──
  // Memory content is plain text. Multiple facts stored as newline-separated lines.
  const parseMemoryText = (raw: string): string => {
    // Legacy: try to parse old JSON format
    try {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.texts)) return parsed.texts.join("\n");
      if (parsed && typeof parsed.text === "string") return parsed.text;
    } catch { /* plain text — good */ }
    return raw;
  };


  const loadMemories = useCallback(async (conversationId?: string) => {
    if (!isReady || !userId) return;
    const supabase = createClient();
    let query = supabase.from("user_memory").select("*").eq("user_id", userId);
    if (conversationId) {
      query = query.or(`conversation_id.is.null,conversation_id.eq.${conversationId}`);
    } else {
      query = query.is("conversation_id", null);
    }
    const { data } = await query.order("updated_at", { ascending: false });
    if (data) setMemories(data);
  }, [isReady, userId]);

  const addMemory = useCallback(async (content: string, category = "general", conversationId?: string) => {
    if (!isReady || !userId) return;
    const supabase = createClient();
    const row: Record<string, unknown> = { user_id: userId, content, category, source: "manual" };
    if (conversationId) row.conversation_id = conversationId;
    const { data } = await supabase.from("user_memory").insert(row).select("*").single();
    if (data) setMemories((prev) => [data, ...prev]);
  }, [isReady, userId]);

  const updateMemory = useCallback(async (id: string, content: string, category?: string) => {
    if (!isReady) return;
    const supabase = createClient();
    const update: Record<string, unknown> = { content, updated_at: new Date().toISOString() };
    if (category) update.category = category;
    await supabase.from("user_memory").update(update).eq("id", id);
    setMemories((prev) => prev.map((m) => m.id === id ? { ...m, content, ...(category ? { category } : {}) } as UserMemory : m));
  }, [isReady]);

  const deleteMemory = useCallback(async (id: string) => {
    if (!isReady) return;
    const supabase = createClient();
    await supabase.from("user_memory").delete().eq("id", id);
    setMemories((prev) => prev.filter((m) => m.id !== id));
  }, [isReady]);

  const selectConversation = useCallback(async (id: string) => {
    if (!isReady) return;
    setIsLoadingMessages(true);
    localStorage.setItem("9chat_active_conv", id);
    const supabase = createClient();
    const [convRes, msgRes] = await Promise.all([
      supabase.from("conversations").select("*").eq("id", id).single(),
      supabase.from("messages").select("*").eq("conversation_id", id).order("created_at", { ascending: true }),
    ]);
    if (convRes.data) {
      setActiveConversation(convRes.data);
      // Load agent if conversation has one
      if (convRes.data.agent_id) {
        const { data: agent } = await supabase.from("agents").select("*").eq("id", convRes.data.agent_id).single();
        if (agent) setActiveAgent(agent);
      }
    }
    if (msgRes.data) setMessages(msgRes.data);
    setIsLoadingMessages(false);
    // Load memories for this conversation (global + conversation-specific)
    loadMemories(id);
  }, [isReady, loadMemories]);

  const deleteConversation = useCallback(async (id: string) => {
    if (!isReady) return;
    const supabase = createClient();
    await supabase.from("conversations").delete().eq("id", id);
    if (activeConversation?.id === id) { setActiveConversation(null); setMessages([]); localStorage.removeItem("9chat_active_conv"); }
    await loadConversations(activeProject?.id);
  }, [isReady, activeConversation, activeProject, loadConversations]);

  const renameConversation = useCallback(async (id: string, title: string) => {
    if (!isReady) return;
    const supabase = createClient();
    await supabase.from("conversations").update({ title }).eq("id", id);
    await loadConversations(activeProject?.id);
    if (activeConversation?.id === id) setActiveConversation((p) => p ? { ...p, title } : null);
  }, [isReady, activeConversation, activeProject, loadConversations]);

  const updateConversationModel = useCallback(async (id: string, model: string) => {
    if (!isReady) return;
    const supabase = createClient();
    await supabase.from("conversations").update({ model }).eq("id", id);
    setActiveConversation((p) => p && p.id === id ? { ...p, model } : p);
  }, [isReady]);

  const togglePinConversation = useCallback(async (id: string, pinned: boolean) => {
    if (!isReady) return;
    const supabase = createClient();
    await supabase.from("conversations").update({ pinned }).eq("id", id);
    setConversations((prev) => {
      const updated = prev.map((c) => c.id === id ? { ...c, pinned } : c);
      return updated.sort((a, b) => {
        if (a.pinned && !b.pinned) return -1;
        if (!a.pinned && b.pinned) return 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
    });
    setActiveConversation((p) => p && p.id === id ? { ...p, pinned } : p);
  }, [isReady]);

  const addMessage = useCallback(async (msg: Omit<Message, "id" | "created_at">): Promise<Message | null> => {
    if (!isReady) return null;
    const supabase = createClient();
    const { data } = await supabase.from("messages").insert(msg).select("*").single();
    if (data) {
      setMessages((prev) => [...prev, data]);
      await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", msg.conversation_id);
    }
    return data;
  }, [isReady]);

  const deleteMessage = useCallback(async (id: string) => {
    if (!isReady) return;
    const supabase = createClient();
    await supabase.from("messages").delete().eq("id", id);
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, [isReady]);

  // ── Agents ──
  const loadAgents = useCallback(async () => {
    if (!isReady || !userId) return;
    const supabase = createClient();
    const { data } = await supabase.from("agents").select("*").or(`user_id.eq.${userId},is_public.eq.true`).order("name");
    if (data) setAgents(data);
  }, [isReady, userId]);

  // ── Skills ──
  const loadSkills = useCallback(async () => {
    if (!isReady) return;
    const supabase = createClient();
    const { data } = await supabase.from("skills").select("*").order("category, name");
    if (data) setSkills(data);
  }, [isReady]);

  // ── Knowledge ──
  const loadKnowledge = useCallback(async () => {
    if (!isReady || !userId) return;
    const supabase = createClient();
    const { data } = await supabase.from("knowledge_sources").select("*").or(`user_id.eq.${userId},user_id.is.null`).order("name");
    if (data) setKnowledgeSources(data);
  }, [isReady, userId]);

  // Auto-load
  useEffect(() => {
    if (isReady) {
      loadProjects(); loadConversations(); loadAgents(); loadSkills(); loadKnowledge(); loadMemories();
    }
  }, [isReady, loadProjects, loadConversations, loadAgents, loadSkills, loadKnowledge, loadMemories]);

  // Restore last active conversation from localStorage
  useEffect(() => {
    if (conversations.length > 0 && !activeConversation) {
      const savedId = localStorage.getItem("9chat_active_conv");
      if (savedId) {
        const found = conversations.find((c) => c.id === savedId);
        if (found) selectConversation(savedId);
      }
    }
  }, [conversations, activeConversation, selectConversation]);

  useEffect(() => {
    if (isReady) {
      loadConversations(activeProject?.id);
      setActiveConversation(null); setMessages([]);
      loadMemories(); // Load global memories when switching project
    }
  }, [activeProject, isReady, loadConversations, loadMemories]);

  return (
    <ChatContext.Provider value={{
      projects, activeProject, loadProjects, createProject, deleteProject, renameProject, setActiveProject, verifyProjectPassword,
      conversations, activeConversation, messages, isLoadingMessages,
      loadConversations, createConversation, selectConversation, deleteConversation, renameConversation, updateConversationModel, togglePinConversation, addMessage, deleteMessage, setMessages, setActiveConversation,
      agents, activeAgent, loadAgents, setActiveAgent,
      skills, loadSkills,
      knowledgeSources, loadKnowledge,
      memories, loadMemories, addMemory, updateMemory, deleteMemory, parseMemoryText,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  return useContext(ChatContext);
}
