"use client";

import { useRef, useEffect, useState } from "react";
import { useChatContext } from "@/components/providers/chat-provider";
import { useSettings } from "@/components/providers/settings-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { ChatMessage } from "@/components/chat/chat-message";
import { ChatInput } from "@/components/chat/chat-input";
import { MemoryDialog } from "@/components/chat/memory-dialog";
import { ModelSelector } from "@/components/chat/model-selector";
import { SkillSelector } from "@/components/chat/skill-selector";
import { KnowledgeSelector } from "@/components/chat/knowledge-selector";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap, Shield, BookOpen, ArrowRight, MessageSquare, Bot, ChevronDown } from "lucide-react";
import type { Skill, KnowledgeSource, Message } from "@/lib/types";
import { MessageBranchSelector } from "@/components/chat/message-branch-selector";

export function ChatArea() {
  const {
    activeConversation, messages, isLoadingMessages,
    createConversation, selectConversation, addMessage, deleteMessage, setMessages, renameConversation, updateConversationModel,
    activeProject, activeAgent, knowledgeSources, skills, memories, addMemory,
  } = useChatContext();
  const { modelAliases } = useSettings();
  const { currentUser } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedModel, setSelectedModel] = useState(currentUser?.default_model || activeAgent?.model || "gpt-4o");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [selectedKnowledge, setSelectedKnowledge] = useState<KnowledgeSource[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editBranches, setEditBranches] = useState<Record<string, number>>({});
  const [showMemoryDialog, setShowMemoryDialog] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Update model when conversation, agent, or user changes
  useEffect(() => {
    if (activeConversation?.model) setSelectedModel(activeConversation.model);
    else if (activeAgent?.model) setSelectedModel(activeAgent.model);
    else if (currentUser?.default_model) setSelectedModel(currentUser.default_model);
  }, [activeConversation?.id, activeConversation?.model, activeAgent, currentUser?.default_model]);

  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]") || scrollRef.current.querySelector("[data-slot='scroll-area-viewport']");
      if (el) el.scrollTop = el.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Re-scroll after images load
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const images = container.querySelectorAll("img");
    if (images.length === 0) return;
    const scrollBottom = () => {
      const el = container.querySelector("[data-radix-scroll-area-viewport]") || container.querySelector("[data-slot='scroll-area-viewport']");
      if (el) el.scrollTop = el.scrollHeight;
    };
    images.forEach((img) => {
      if (!img.complete) img.addEventListener("load", scrollBottom, { once: true });
    });
    return () => images.forEach((img) => img.removeEventListener("load", scrollBottom));
  }, [messages, streamingContent]);

  const getDisplayName = (modelId: string): string => {
    if (modelAliases[modelId]) return modelAliases[modelId];
    const parts = modelId.split("/");
    return parts[parts.length - 1] || modelId;
  };

  // Edit message: populate edit state
  const handleEditMessage = (msgId: string, content: string) => {
    setEditingMessageId(msgId);
    setEditContent(content);
  };

  // Save edit: create new branch
  const handleSaveEdit = async (originalUserMsg: Message, content: string) => {
    if (!activeConversation?.id || !content.trim()) return;
    const convId = activeConversation.id;

    // Count existing branches in this edit group
    const editGroupId = originalUserMsg.edit_group_id || originalUserMsg.id;
    const branchCount = messages.filter(
      (m) => (m.edit_group_id === editGroupId || m.id === editGroupId) && m.role === "user"
    ).length;
    const newBranchIndex = branchCount;

    // Delete current assistant reply (if any) — first assistant message after this user message
    const currentBranch = editBranches[editGroupId] ?? 0;
    const assistantReply = messages.find(
      (m) => m.role === "assistant" &&
      (m.branch_index === currentBranch || m.branch_index == null) &&
      m.created_at > originalUserMsg.created_at
    );
    if (assistantReply) {
      await deleteMessage(assistantReply.id);
    }

    // Add edited user message
    const editedUserMsg = await addMessage({
      conversation_id: convId,
      role: "user" as const,
      content: content.trim(),
      tokens_used: null,
      edit_group_id: editGroupId,
      branch_index: newBranchIndex,
    });

    setEditingMessageId(null);
    setEditContent("");

    // Set branch to new edit
    setEditBranches((prev) => ({ ...prev, [editGroupId]: newBranchIndex }));

    // Auto-rename if first message
    if (activeConversation?.title === "New Chat") {
      const clean = content.replace(/!\[[^\]]*\]\([^)]+\)/g, "").trim();
      const label = clean || "Image";
      await renameConversation(convId, label.slice(0, 50) + (label.length > 50 ? "..." : ""));
    }

    // Stream new response
    setIsStreaming(true);
    setStreamingContent("");
    abortRef.current = new AbortController();

    const systemParts: string[] = [];
    if (activeAgent?.system_prompt) systemParts.push(activeAgent.system_prompt);
    if (selectedSkill?.prompt_template) systemParts.push(selectedSkill.prompt_template);
    const modelDisplayName = getDisplayName(selectedModel);
    systemParts.push(`Your model name is "${modelDisplayName}". When asked what model or AI you are, respond with this name. Do not mention internal model IDs or technical identifiers.`);

    const knowledgeToInject: KnowledgeSource[] = [...selectedKnowledge];
    if (knowledgeSources.length > 0) {
      const relevant = knowledgeSources.filter((k) =>
        !selectedKnowledge.some((sk) => sk.id === k.id) && (
          content.toLowerCase().includes(k.name.toLowerCase()) ||
          k.content.toLowerCase().slice(0, 200).split(/\s+/).some((w) => content.toLowerCase().includes(w.toLowerCase()))
        )
      ).slice(0, 3);
      knowledgeToInject.push(...relevant);
    }
    if (knowledgeToInject.length > 0) {
      systemParts.push("\n--- Relevant Knowledge ---");
      knowledgeToInject.forEach((k) => systemParts.push(`[${k.name}]\n${k.content}`));
      systemParts.push("--- End Knowledge ---\n");
    }

    // Inject user memory
    if (memories.length > 0) {
      systemParts.push("\n--- User Memory ---");
      systemParts.push("The following are facts about this user. Use them to personalize your responses:");
      memories.forEach((m) => systemParts.push(`- ${m.content}`));
      systemParts.push("--- End User Memory ---\n");
    }

    const convMessages = messages.filter((m) => m.id !== originalUserMsg.id && m.id !== assistantReply?.id);
    const apiMessages = [
      ...(systemParts.length > 0 ? [{ role: "system" as const, content: systemParts.join("\n\n") }] : []),
      ...convMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content: content.trim() },
    ];

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel, messages: apiMessages }),
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error("Failed");
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let full = "";
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const delta = JSON.parse(data).choices?.[0]?.delta?.content;
                if (delta) { full += delta; setStreamingContent(full); }
              } catch {}
            }
          }
        }
      }
      if (full) await addMessage({
        conversation_id: convId,
        role: "assistant" as const,
        content: full,
        tokens_used: null,
        edit_group_id: editGroupId,
        branch_index: newBranchIndex,
      });
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        await addMessage({ conversation_id: convId, role: "assistant" as const, content: "Sorry, something went wrong. Please try again.", tokens_used: null });
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      abortRef.current = null;
    }
  };

  const handleBranchChange = (editGroupId: string, branch: number) => {
    setEditBranches((prev) => ({ ...prev, [editGroupId]: branch }));
  };

  const handleSend = async (content: string) => {
    let convId = activeConversation?.id;
    const isNewConv = !convId;
    if (!convId) {
      convId = await createConversation(selectedModel, activeProject?.id, activeAgent?.id);
      if (convId) await selectConversation(convId);
    }
    if (!convId) return;

    // Auto-rename from first message (before addMessage updates state)
    if (isNewConv || activeConversation?.title === "New Chat") {
      const clean = content.replace(/!\[[^\]]*\]\([^)]+\)/g, "").trim();
      const label = clean || "Image";
      const title = label.slice(0, 50) + (label.length > 50 ? "..." : "");
      await renameConversation(convId, title);
    }

    await addMessage({ conversation_id: convId, role: "user", content, tokens_used: null });

    // Track first message as edit group root
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === "user" && !last.edit_group_id) {
        return prev.map((m) => m.id === last.id ? { ...m, edit_group_id: last.id, branch_index: 0 } : m);
      }
      return prev;
    });

    setIsStreaming(true);
    setStreamingContent("");
    abortRef.current = new AbortController();

    const systemParts: string[] = [];
    if (activeAgent?.system_prompt) systemParts.push(activeAgent.system_prompt);
    if (selectedSkill?.prompt_template) systemParts.push(selectedSkill.prompt_template);

    // Inject model identity so AI uses alias when asked
    const modelDisplayName = getDisplayName(selectedModel);
    systemParts.push(`Your model name is "${modelDisplayName}". When asked what model or AI you are, respond with this name. Do not mention internal model IDs or technical identifiers.`);

    // Knowledge: manually selected (always injected) + auto-matched (relevance)
    const knowledgeToInject: KnowledgeSource[] = [...selectedKnowledge];
    if (knowledgeSources.length > 0) {
      const relevant = knowledgeSources.filter((k) =>
        !selectedKnowledge.some((sk) => sk.id === k.id) && (
          content.toLowerCase().includes(k.name.toLowerCase()) ||
          k.content.toLowerCase().slice(0, 200).split(/\s+/).some((w) => content.toLowerCase().includes(w.toLowerCase()))
        )
      ).slice(0, 3);
      knowledgeToInject.push(...relevant);
    }
    if (knowledgeToInject.length > 0) {
      systemParts.push("\n--- Relevant Knowledge ---");
      knowledgeToInject.forEach((k) => systemParts.push(`[${k.name}]\n${k.content}`));
      systemParts.push("--- End Knowledge ---\n");
    }

    // Inject user memory
    if (memories.length > 0) {
      systemParts.push("\n--- User Memory ---");
      systemParts.push("The following are facts about this user. Use them to personalize your responses:");
      memories.forEach((m) => systemParts.push(`- ${m.content}`));
      systemParts.push("--- End User Memory ---\n");
    }

    const apiMessages = [
      ...(systemParts.length > 0 ? [{ role: "system" as const, content: systemParts.join("\n\n") }] : []),
      ...messages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
      { role: "user" as const, content },
    ];

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: selectedModel, messages: apiMessages }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) throw new Error("Failed");
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let full = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;
              try {
                const delta = JSON.parse(data).choices?.[0]?.delta?.content;
                if (delta) { full += delta; setStreamingContent(full); }
              } catch {}
            }
          }
        }
      }

      if (full) await addMessage({ conversation_id: convId, role: "assistant", content: full, tokens_used: null });
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        await addMessage({ conversation_id: convId, role: "assistant", content: "Sorry, something went wrong. Please try again.", tokens_used: null });
      }
    } finally {
      setIsStreaming(false);
      setStreamingContent("");
      abortRef.current = null;
    }
  };

  // ── Empty State ──
  if (!activeConversation && messages.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-center gap-2 border-b border-border/40 bg-background/60 backdrop-blur-sm py-2.5">
          <ModelSelector selectedModel={selectedModel} onSelectModel={setSelectedModel} />
          <SkillSelector skills={skills} selectedSkill={selectedSkill} onSelectSkill={setSelectedSkill} />
          <KnowledgeSelector knowledgeSources={knowledgeSources} selectedKnowledge={selectedKnowledge} onToggleKnowledge={(k) => setSelectedKnowledge((prev) => prev.some((sk) => sk.id === k.id) ? prev.filter((sk) => sk.id !== k.id) : [...prev, k])} />
        </div>
        <div className="flex flex-1 flex-col items-center justify-center p-8">
          <div className="w-full max-w-lg animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
            {/* Logo */}
            <div className="mb-8 text-center">
              <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center">
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 animate-pulse" />
                <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/10 to-transparent ring-1 ring-primary/20">
                  {activeAgent ? (
                    <span className="text-2xl">{activeAgent.icon}</span>
                  ) : (
                    <Sparkles className="h-7 w-7 text-primary" />
                  )}
                </div>
              </div>
              <h2 className="text-2xl font-bold tracking-tight">
                {activeAgent ? activeAgent.name : "What can I help with?"}
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                {activeAgent ? activeAgent.description : "Ask anything, write code, brainstorm ideas"}
              </p>
              {activeAgent && (
                <div className="mt-3 flex items-center justify-center gap-2">
                  <Badge variant="secondary" className="rounded-full text-[10px] px-2.5 py-0.5">{getDisplayName(activeAgent.model)}</Badge>
                  <Badge variant="outline" className="rounded-full text-[10px] px-2.5 py-0.5">temp: {activeAgent.temperature}</Badge>
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="grid grid-cols-2 gap-2.5">
              {[
                { icon: "💡", label: "Brainstorm", desc: "Generate creative ideas", prompt: "Help me brainstorm ideas for " },
                { icon: "🧑‍💻", label: "Write Code", desc: "Build something awesome", prompt: "Write code for " },
                { icon: "📝", label: "Write Content", desc: "Articles, emails, docs", prompt: "Help me write " },
                { icon: "🔍", label: "Analyze", desc: "Explain or investigate", prompt: "Help me understand " },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => handleSend(item.prompt)}
                  className="group flex items-start gap-3 rounded-xl border border-border/60 bg-card/50 p-3.5 text-left transition-all duration-200 hover:border-primary/30 hover:bg-card hover:shadow-sm"
                >
                  <span className="mt-0.5 text-lg">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{item.label}</p>
                    <p className="text-[11px] text-muted-foreground">{item.desc}</p>
                  </div>
                  <ArrowRight className="mt-0.5 h-3.5 w-3.5 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100" />
                </button>
              ))}
            </div>

            {/* Capabilities */}
            <div className="mt-6 flex items-center justify-center gap-6 text-[10px] text-muted-foreground/60">
              {[
                { icon: Zap, label: "Streaming" },
                { icon: Shield, label: "Private" },
                { icon: BookOpen, label: `${knowledgeSources.length} knowledge` },
                { icon: MessageSquare, label: "Persistent" },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <item.icon className="h-3 w-3" />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        <ChatInput onSend={handleSend} disabled={false} isStreaming={false} agentName={activeAgent?.name} conversationId={undefined} userId={currentUser?.id} />
      </div>
    );
  }

  // ── Loading ──
  if (isLoadingMessages) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="relative h-10 w-10">
            <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
            <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-primary" />
          </div>
          <p className="text-xs text-muted-foreground">Loading conversation...</p>
        </div>
      </div>
    );
  }

  // ── Chat ──
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-center gap-2 border-b border-border/40 bg-background/60 backdrop-blur-sm py-2.5">
        <ModelSelector selectedModel={selectedModel} onSelectModel={(model) => {
          setSelectedModel(model);
          if (activeConversation?.id) updateConversationModel(activeConversation.id, model);
        }} />
        <SkillSelector skills={skills} selectedSkill={selectedSkill} onSelectSkill={setSelectedSkill} />
        <KnowledgeSelector knowledgeSources={knowledgeSources} selectedKnowledge={selectedKnowledge} onToggleKnowledge={(k) => setSelectedKnowledge((prev) => prev.some((sk) => sk.id === k.id) ? prev.filter((sk) => sk.id !== k.id) : [...prev, k])} />
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        <div className="mx-auto max-w-3xl space-y-1 px-4 py-6">
          {(() => {
            // Build display list with branch awareness
            const display: React.ReactNode[] = [];
            let lastUserEditGroup: string | null = null;
            let lastUserGroupTotal = 0;

            for (let i = 0; i < messages.length; i++) {
              const msg = messages[i];

              if (msg.role === "user") {
                const editGroupId = msg.edit_group_id || msg.id;
                const totalBranches = messages.filter(
                  (m) => m.role === "user" && (m.edit_group_id === editGroupId || m.id === editGroupId)
                ).length;
                const currentBranch = editBranches[editGroupId] ?? 0;
                const branchIndex = msg.branch_index ?? 0;

                lastUserEditGroup = editGroupId;
                lastUserGroupTotal = totalBranches;

                // Skip non-current branch user messages
                if (branchIndex !== currentBranch) continue;

                const isEditing = editingMessageId === msg.id;

                display.push(
                  <div key={msg.id} data-msg-id={msg.id}>
                    <ChatMessage
                      role="user"
                      content={msg.content}
                      onEdit={() => handleEditMessage(msg.id, msg.content)}
                    />
                    <MessageBranchSelector
                      currentBranch={currentBranch}
                      totalBranches={totalBranches}
                      onBranchChange={(b) => handleBranchChange(editGroupId, b)}
                    />
                  </div>
                );
              } else if (msg.role === "assistant") {
                const branchIndex = msg.branch_index ?? 0;
                const currentBranch = lastUserEditGroup ? (editBranches[lastUserEditGroup] ?? 0) : 0;

                // Skip non-current branch assistant messages
                if (lastUserEditGroup && lastUserGroupTotal > 1 && branchIndex !== currentBranch) continue;
                display.push(
                  <ChatMessage key={msg.id} role="assistant" content={msg.content} />
                );
              }
            }
            return display;
          })()}
          {isStreaming && streamingContent && (
            <ChatMessage role="assistant" content={streamingContent} isStreaming />
          )}
          {isStreaming && !streamingContent && (
            <div className="flex gap-4">
              <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/10">
                <Sparkles className="h-3.5 w-3.5 text-primary animate-pulse" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-border/60 bg-card px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-primary/60 [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        disabled={false}
        isStreaming={isStreaming}
        onStop={() => abortRef.current?.abort()}
        agentName={activeAgent?.name}
        conversationId={activeConversation?.id}
        userId={currentUser?.id}
        editingContent={editingMessageId ? editContent : null}
        onEditSave={(content) => {
          const msg = messages.find((m) => m.id === editingMessageId);
          if (msg) handleSaveEdit(msg, content);
        }}
        onEditCancel={() => { setEditingMessageId(null); setEditContent(""); }}
        onMemoryClick={() => setShowMemoryDialog(true)}
        conversationTitle={activeConversation?.title || null}
      />

      {/* Memory Dialog */}
      <MemoryDialog
        open={showMemoryDialog}
        onClose={() => setShowMemoryDialog(false)}
        onSave={async (content, category) => {
          await addMemory(content, category, activeConversation?.id);
        }}
        conversationTitle={activeConversation?.title || null}
      />
    </div>
  );
}
