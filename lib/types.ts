// ── Core Entities ──

export interface User {
  id: string;
  username: string;
  display_name: string;
  avatar: string;
  role: "admin" | "user";
  is_active: boolean;
  default_model: string | null;
  allowed_models: string[] | null;
  token_input_used: number;
  token_output_used: number;
  token_limit: number | null;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  icon: string;
  system_prompt: string;
  model: string;
  temperature: number;
  max_tokens: number;
  user_id: string | null;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface Skill {
  id: string;
  name: string;
  description: string;
  icon: string;
  prompt_template: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeSource {
  id: string;
  name: string;
  description: string;
  content: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  icon: string;
  password_hash: string | null;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  project_id: string | null;
  user_id: string | null;
  agent_id: string | null;
  title: string;
  model: string;
  system_prompt: string | null;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: string | null;
  tokens_used: number | null;
  response_time_ms?: number | null;
  created_at: string;
  edit_group_id?: string | null;
  branch_index?: number | null;
  status?: "generating" | "done" | "failed";
}

// ── Junction ──
export interface AgentSkill {
  agent_id: string;
  skill_id: string;
}

export interface AgentKnowledge {
  agent_id: string;
  knowledge_id: string;
}

// ── User Memory ──
export interface UserMemory {
  id: string;
  user_id: string;
  conversation_id: string | null;
  content: string;
  category: "preference" | "project" | "personal" | "technical" | "general";
  created_at: string;
  updated_at: string;
}

// ── API ──
export interface ModelInfo {
  id: string;
  object: string;
  created: number;
  owned_by: string;
  supports_vision?: boolean;
}

export interface ModelsResponse {
  object: string;
  data: ModelInfo[];
}

// ── Settings ──

export interface Settings {
  routerUrl: string;
  routerApiKey: string;
  imgbbApiKey?: string;
  enabledModels?: string[];
}
