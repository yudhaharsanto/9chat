"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useChatContext } from "@/components/providers/chat-provider";
import { useSettings } from "@/components/providers/settings-provider";
import { useAuth } from "@/components/providers/auth-provider";
import {
  Plus, MessageSquare, Trash2, Pencil, Check, X, Search, Sparkles, Settings, Bot, LogOut, Save,
  Brain, ChevronRight, User as UserIcon, FolderOpen, Zap, Globe, Pin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ProjectList } from "@/components/sidebar/project-list";
import { MemoryDialog } from "@/components/chat/memory-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface ConversationSidebarProps {
  collapsed: boolean;
}

export function ConversationSidebar({ collapsed }: ConversationSidebarProps) {
  const {
    conversations, activeConversation, activeProject, agents, activeAgent,
    selectConversation, createConversation, deleteConversation,
    renameConversation, setActiveProject, setActiveAgent,
    togglePinConversation,
    memories, addMemory, updateMemory, deleteMemory, loadMemories, parseMemoryText,
  } = useChatContext();
  const { currentUser, logout } = useAuth();
  const { modelAliases, enabledModels, modelsFilterActive } = useSettings();
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [showCreateAgent, setShowCreateAgent] = useState(false);
  const [newAgent, setNewAgent] = useState({ name: "", description: "", icon: "🤖", system_prompt: "", model: "gpt-4o", temperature: 0.7 });
  const [availableModels, setAvailableModels] = useState<{ id: string; name: string }[]>([]);
  const [modelSearch, setModelSearch] = useState("");
  const [showMemory, setShowMemory] = useState(false);
  const [memoryDialogOpen, setMemoryDialogOpen] = useState(false);
  const [memoryDialogMode, setMemoryDialogMode] = useState<"add" | "edit">("add");
  const [editingMemory, setEditingMemory] = useState<{ id: string; content: string; category: string } | null>(null);

  const filtered = searchQuery
    ? conversations.filter((c) => c.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : conversations;

  const handleNewChat = async () => {
    const id = await createConversation(activeAgent?.model || "gpt-4o", activeProject?.id, activeAgent?.id);
    if (id) {
      await selectConversation(id);
      // Scroll new conversation into view in sidebar
      setTimeout(() => {
        const el = document.querySelector(`[data-conv-id="${id}"]`);
        el?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 100);
    }
    toast.success("New chat created");
  };

  const loadModelsForAgent = async () => {
    try {
      const { data } = await createClient().from("app_settings").select("value").eq("key", "available_models").single();
      if (data?.value && Array.isArray(data.value)) setAvailableModels(data.value);
    } catch {}
    setShowCreateAgent(true);
  };

  const handleCreateAgent = async () => {
    if (!newAgent.name) { toast.error("Name required"); return; }
    const { error } = await createClient().from("agents").insert({
      ...newAgent,
      max_tokens: 4096,
      is_public: false,
      user_id: currentUser?.id,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Agent created!");
    setShowCreateAgent(false);
    setNewAgent({ name: "", description: "", icon: "🤖", system_prompt: "", model: "gpt-4o", temperature: 0.7 });
    // Reload agents
    const { data } = await createClient().from("agents").select("*").order("name");
    if (data) window.location.reload();
  };

  const getDisplayName = (modelId: string): string => {
    if (modelAliases[modelId]) return modelAliases[modelId];
    const parts = modelId.split("/");
    return parts[parts.length - 1] || modelId;
  };

  const activeModels = (() => {
    let list = modelsFilterActive && enabledModels.length > 0
      ? availableModels.filter((m) => enabledModels.includes(m.id))
      : availableModels;
    const userAllowed = currentUser?.allowed_models;
    if (userAllowed && userAllowed.length > 0) {
      list = list.filter((m) => userAllowed.includes(m.id));
    }
    return list;
  })();

  const filteredAgentModels = modelSearch
    ? activeModels.filter((m) => m.id.toLowerCase().includes(modelSearch.toLowerCase()) || getDisplayName(m.id).toLowerCase().includes(modelSearch.toLowerCase()))
    : activeModels;

  if (collapsed) return null;

  return (
    <div className="flex h-full w-[260px] flex-col bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="flex items-center gap-2.5 p-4 pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-semibold">9Chat</h1>
          <p className="text-[10px] text-muted-foreground truncate">
            {currentUser?.display_name || "User"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {currentUser?.role === "admin" && (
            <Link href="/admin">
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" title="Admin">
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </Link>
          )}
          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={logout} title="Sign out">
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* New Chat */}
      <div className="px-3 pb-2">
        <Button onClick={handleNewChat} className="w-full gap-2 rounded-lg" size="sm">
          <Plus className="h-4 w-4" />
          New Chat
        </Button>
      </div>

      {/* Agents */}
      <div className="px-2 pb-1">
        <div className="flex items-center justify-between px-2.5 py-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Agents</p>
          <Button variant="ghost" size="icon" className="h-5 w-5 text-muted-foreground hover:text-foreground" onClick={loadModelsForAgent} title="Create Agent">
            <Plus className="h-3 w-3" />
          </Button>
        </div>
          <div className="space-y-0.5 px-1">
            <button
              onClick={() => setActiveAgent(null)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                !activeAgent ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-accent/50"
              )}
            >
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Default Chat</span>
            </button>
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => setActiveAgent(agent)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                  activeAgent?.id === agent.id ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-accent/50"
                )}
              >
                <span>{agent.icon}</span>
                <span className="truncate">{agent.name}</span>
              </button>
            ))}
          </div>
        </div>

      {/* Projects */}
      <div className="px-2">
        <div className="px-2.5 py-1.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Folders</p>
        </div>
        <ProjectList onSelectProject={setActiveProject} activeProjectId={activeProject?.id ?? null} />
      </div>

      {/* Memory */}
      <div className="px-2">
        <div className="flex items-center justify-between px-2.5 py-1.5">
          <button
            onClick={() => setShowMemory(!showMemory)}
            className="flex items-center gap-1.5 group"
          >
            <Brain className="h-3 w-3 text-muted-foreground" />
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Memory</p>
            {memories.length > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-[9px] font-medium text-muted-foreground">
                {memories.length}
              </span>
            )}
            <ChevronRight className={cn("h-3 w-3 text-muted-foreground transition-transform", showMemory && "rotate-90")} />
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 text-muted-foreground hover:text-primary"
            onClick={() => {
              setEditingMemory(null);
              setMemoryDialogMode("add");
              setMemoryDialogOpen(true);
            }}
            title="Add memory"
          >
            <Plus className="h-3 w-3" />
          </Button>
        </div>

        {showMemory && (
          <div className="mt-1 space-y-0.5 max-h-[220px] overflow-y-auto">
            {memories.length === 0 && (
              <p className="px-2.5 py-4 text-center text-[10px] text-muted-foreground">
                No memories yet. Add facts about yourself so AI can personalize responses.
              </p>
            )}
            {(() => {
              const globalMems = memories.filter((m) => !m.conversation_id);
              const roomMems = memories.filter((m) => m.conversation_id);
              return (
                <>
                  {globalMems.length > 0 && (
                    <>
                      <div className="px-2.5 pt-1">
                        <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">Global</p>
                      </div>
                      {globalMems.map((mem) => (
                        <div key={mem.id} className="group/mem rounded-lg px-2.5 py-1.5 hover:bg-accent/50 transition-colors">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs leading-relaxed break-words">{parseMemoryText(mem.content)}</p>
                              <span className="inline-block mt-0.5 rounded bg-muted/50 px-1 py-0.5 text-[9px] text-muted-foreground">{mem.category}</span>
                            </div>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover/mem:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => {
                                setEditingMemory({ id: mem.id, content: mem.content, category: mem.category });
                                setMemoryDialogMode("edit");
                                setMemoryDialogOpen(true);
                              }}><Pencil className="h-2.5 w-2.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={async () => {
                                await deleteMemory(mem.id);
                                toast.success("Memory deleted");
                              }}><Trash2 className="h-2.5 w-2.5" /></Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                  {roomMems.length > 0 && (
                    <>
                      <div className="px-2.5 pt-1">
                        <p className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">This Room</p>
                      </div>
                      {roomMems.map((mem) => (
                        <div key={mem.id} className="group/mem rounded-lg px-2.5 py-1.5 hover:bg-accent/50 transition-colors">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs leading-relaxed break-words">{parseMemoryText(mem.content)}</p>
                              <span className="inline-block mt-0.5 rounded bg-primary/10 px-1 py-0.5 text-[9px] text-primary/80">room</span>
                            </div>
                            <div className="flex items-center gap-0.5 opacity-0 group-hover/mem:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => {
                                setEditingMemory({ id: mem.id, content: mem.content, category: mem.category });
                                setMemoryDialogMode("edit");
                                setMemoryDialogOpen(true);
                              }}><Pencil className="h-2.5 w-2.5" /></Button>
                              <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={async () => {
                                await deleteMemory(mem.id);
                                toast.success("Memory deleted");
                              }}><Trash2 className="h-2.5 w-2.5" /></Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Memory Dialog (sidebar) */}
      <MemoryDialog
        open={memoryDialogOpen}
        onClose={() => { setMemoryDialogOpen(false); setEditingMemory(null); }}
        onSave={async (content, category) => {
          if (memoryDialogMode === "edit" && editingMemory) {
            await updateMemory(editingMemory.id, content, category);
            toast.success("Memory updated");
          } else {
            await addMemory(content, category, activeConversation?.id);
            toast.success(activeConversation ? "Room memory added" : "Global memory added");
          }
        }}
        initialContent={editingMemory?.content || ""}
        initialCategory={editingMemory?.category || "general"}
        conversationTitle={memoryDialogMode === "add" ? activeConversation?.title || null : null}
        mode={memoryDialogMode}
      />

      <div className="mx-3 my-2 h-px bg-border" />

      {/* Search */}
      <div className="px-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search..." className="h-8 pl-8 text-xs" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {/* Conversations */}
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-0.5">
          {filtered.map((conv) => (
            <div
              key={conv.id}
              data-conv-id={conv.id}
              onClick={() => selectConversation(conv.id)}
              className={cn(
                "group flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm transition-colors",
                activeConversation?.id === conv.id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-accent/50",
                conv.pinned && "bg-primary/5"
              )}
            >
              {conv.pinned && <Pin className="h-3 w-3 flex-shrink-0 text-primary fill-primary" />}
              <MessageSquare className="h-3.5 w-3.5 flex-shrink-0 opacity-50" />
              {editingId === conv.id ? (
                <div className="flex flex-1 items-center gap-1">
                  <Input className="h-6 flex-1 text-xs" value={editTitle} onChange={(e) => setEditTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { renameConversation(conv.id, editTitle); setEditingId(null); } if (e.key === "Escape") setEditingId(null); }}
                    onClick={(e) => e.stopPropagation()} autoFocus />
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); setEditingId(null); }}><X className="h-3 w-3" /></Button>
                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); renameConversation(conv.id, editTitle); setEditingId(null); }}><Check className="h-3 w-3" /></Button>
                </div>
              ) : (
                <>
                  <span className="flex-1 truncate text-xs">{conv.title}</span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className={cn("h-5 w-5", conv.pinned && "text-primary")} onClick={(e) => { e.stopPropagation(); togglePinConversation(conv.id, !conv.pinned); }} title={conv.pinned ? "Unpin" : "Pin"}><Pin className={cn("h-3 w-3", conv.pinned && "fill-primary")} /></Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); setEditingId(conv.id); setEditTitle(conv.title); }}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                </>
              )}
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/20" />
              <p className="text-xs text-muted-foreground">{searchQuery ? "No results" : "No conversations"}</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Footer */}
      <div className="border-t p-3 flex items-center justify-between">
        <a href="https://github.com/yudhaharsanto" target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Powered by yudhaharsanto</a>
        <span className="text-[10px] text-muted-foreground">{currentUser?.avatar} {currentUser?.display_name}</span>
      </div>

      {/* Create Agent Dialog */}
      {showCreateAgent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-[560px] max-h-[85vh] overflow-y-auto rounded-2xl border bg-background p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <Bot className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Create Agent</h3>
                <p className="text-xs text-muted-foreground">Custom AI personality for your chats</p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-[1fr_80px] gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Name</Label>
                  <Input value={newAgent.name} onChange={(e) => setNewAgent((a) => ({ ...a, name: e.target.value }))} className="h-10 text-sm" placeholder="e.g. Code Helper" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">Icon</Label>
                  <Input value={newAgent.icon} onChange={(e) => setNewAgent((a) => ({ ...a, icon: e.target.value }))} className="h-10 text-sm text-center" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Description</Label>
                <Input value={newAgent.description} onChange={(e) => setNewAgent((a) => ({ ...a, description: e.target.value }))} className="h-10 text-sm" placeholder="What does this agent do?" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">System Prompt</Label>
                <textarea className="w-full rounded-lg border bg-background p-3 text-sm font-mono h-36 resize-none" value={newAgent.system_prompt} onChange={(e) => setNewAgent((a) => ({ ...a, system_prompt: e.target.value }))} placeholder="You are a helpful assistant that..." />
                <p className="text-[10px] text-muted-foreground">Defines the agent's personality and behavior</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Model</Label>
                {availableModels.length > 0 ? (
                  <>
                    <Select value={newAgent.model} onValueChange={(v) => { if (v) setNewAgent((a) => ({ ...a, model: v })); }}>
                      <SelectTrigger className="w-full h-10 text-sm"><SelectValue placeholder="Select model">{newAgent.model ? getDisplayName(newAgent.model) : "Select model"}</SelectValue></SelectTrigger>
                      <SelectContent>
                        {activeModels.length > 0 ? activeModels.map((m) => <SelectItem key={m.id} value={m.id}>{getDisplayName(m.id)}</SelectItem>) : filteredAgentModels.map((m) => <SelectItem key={m.id} value={m.id}>{getDisplayName(m.id)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <p className="mt-1 text-[10px] text-muted-foreground">{activeModels.length > 0 ? `${activeModels.length} models enabled by admin` : `${availableModels.length} total models`}</p>
                  </>
                ) : (
                  <Input value={newAgent.model} onChange={(e) => setNewAgent((a) => ({ ...a, model: e.target.value }))} className="h-10 text-sm" />
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Temperature <span className="text-muted-foreground font-normal">({newAgent.temperature})</span></Label>
                <input type="range" min="0" max="2" step="0.1" value={newAgent.temperature} onChange={(e) => setNewAgent((a) => ({ ...a, temperature: parseFloat(e.target.value) }))} className="w-full accent-primary mt-2" />
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>0 — Factual</span>
                  <span>0.7 — Balanced</span>
                  <span>1.5 — Creative</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
              <Button variant="outline" onClick={() => setShowCreateAgent(false)}>Cancel</Button>
              <Button onClick={handleCreateAgent} className="gap-1.5"><Save className="h-4 w-4" />Create Agent</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
