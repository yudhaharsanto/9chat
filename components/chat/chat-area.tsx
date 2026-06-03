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
import { toast } from "sonner";

export function ChatArea() {
  const {
    activeConversation, messages, isLoadingMessages,
    createConversation, selectConversation, addMessage, deleteMessage, setMessages, renameConversation, updateConversationModel,
    activeProject, activeAgent, knowledgeSources, skills, memories, addMemory,
  } = useChatContext();
  const { modelAliases, modelImageSupport, settings } = useSettings();
  const { currentUser } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [selectedModel, setSelectedModel] = useState(currentUser?.default_model || activeAgent?.model || "");
  const [webSearch, setWebSearch] = useState(false);
  const activeConversationIdRef = useRef<string | undefined>(undefined);

  // Build model name system prompt — respects user's AI name memory
  // Parse memory content — handles both JSON {text, source, updatedAt} and legacy plain text
  const parseMemoryText = (raw: string): string => {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.text === "string") return parsed.text;
    } catch { /* legacy plain text */ }
    return raw;
  };

  const buildModelPrompt = (modelId: string, mems: typeof memories): string => {
    const displayName = getDisplayName(modelId);
    const aiNameMemory = mems.find((m) => {
      const text = parseMemoryText(m.content);
      return /(?:namamu|kamu.*(?:bernama|dipanggil|nama)|your name.*is|call you)\s+[A-Z]/i.test(text);
    });
    if (aiNameMemory) {
      const text = parseMemoryText(aiNameMemory.content);
      const nameMatch = text.match(/(?:namamu|dipanggil|bernama|nama.*(?:adalah|ialah)|your name.*is|call you|berikan.*nama)\s+([A-Z][a-z]{1,30})/i);
      const aiName = nameMatch?.[1];
      if (aiName) {
        return `Your name is "${aiName}". You are called "${aiName}" by this user. Always refer to yourself as "${aiName}". You are running on the "${displayName}" model, but never mention the model name unless explicitly asked. Do not mention internal model IDs or technical identifiers.`;
      }
    }
    return `Your model name is "${displayName}". When asked what model or AI you are, respond with this name. Do not mention internal model IDs or technical identifiers.`;
  };

  // Auto-memory extraction (fire-and-forget)
  const extractMemories = (userMessage: string, aiResponse: string, convId: string) => {
    if (!currentUser?.id || !selectedModel || !settings.routerUrl) return;
    fetch("/api/auto-memory", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-router-url": settings.routerUrl, "x-router-key": settings.routerApiKey },
      body: JSON.stringify({
        userMessage,
        aiResponse,
        userId: currentUser.id,
        conversationId: convId,
        model: selectedModel,
      }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.saved > 0) toast.success(`✨ ${d.saved} memory saved`, { duration: 2000 });
      })
      .catch(() => {});
  };

  // Web search helper
  const performWebSearch = async (query: string): Promise<string> => {
    try {
      const res = await fetch("/api/web-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      if (!res.ok) return "";
      const { results } = await res.json();
      if (!results?.length) return "";
      return results.map((r: { title: string; url: string; snippet: string }, i: number) =>
        `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.snippet}`
      ).join("\n\n");
    } catch {
      return "";
    }
  };
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null);
  const [selectedKnowledge, setSelectedKnowledge] = useState<KnowledgeSource[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editBranches, setEditBranches] = useState<Record<string, number>>({});
  const [showMemoryDialog, setShowMemoryDialog] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const streamingMsgIdRef = useRef<string | null>(null);

  // Update model when conversation, agent, or user changes
  useEffect(() => {
    activeConversationIdRef.current = activeConversation?.id;
    if (activeConversation?.model) setSelectedModel(activeConversation.model);
    else if (activeAgent?.model) setSelectedModel(activeAgent.model);
    else if (currentUser?.default_model) setSelectedModel(currentUser.default_model);
    else setSelectedModel("");
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

  // ── SSE stream helper ──
  const connectToStream = (messageId: string, initialContent: string, userMsg?: string) => {
    // Close existing connection
    if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
    streamingMsgIdRef.current = messageId;

    // Capture the conversation ID at connect time (avoid stale closure)
    const streamConvId = activeConversationIdRef.current;

    setIsStreaming(true);
    setStreamingContent(initialContent);
    let full = initialContent;

    const es = new EventSource(`/api/messages/stream?id=${messageId}`);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.content) {
          full += data.content;
          setStreamingContent(full);
        }
        if (data.done) {
          es.close();
          eventSourceRef.current = null;
          streamingMsgIdRef.current = null;
          // Only update if still in the same conversation
          if (activeConversationIdRef.current === streamConvId) {
            setMessages((prev) => prev.map((m) =>
              m.id === messageId ? { ...m, content: full, status: data.status as Message["status"] } : m
            ));
            setIsStreaming(false);
            setStreamingContent("");
            if (data.status === "done") extractMemories(userMsg || "", full, streamConvId || "");
          }
          // Always persist to DB
          fetch("/api/messages/update", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: messageId, content: full, status: data.status }),
          }).catch(() => {});
        }
      } catch {}
    };

    es.onerror = () => {
      es.close();
      eventSourceRef.current = null;
      // Only retry if still in the same conversation
      if (activeConversationIdRef.current !== streamConvId) return;
      setTimeout(() => {
        if (streamingMsgIdRef.current === messageId) {
          connectToStream(messageId, full, userMsg);
        }
      }, 2000);
    };
  };

  // Close SSE stream when conversation changes
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      streamingMsgIdRef.current = null;
      setIsStreaming(false);
      setStreamingContent("");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversation?.id]);

  // Resume in-progress generation on conversation load
  useEffect(() => {
    if (!messages.length || !activeConversation?.id) return;
    const lastMsg = messages[messages.length - 1];
    if (
      lastMsg.role === "assistant" &&
      lastMsg.status === "generating" &&
      lastMsg.conversation_id === activeConversation.id &&
      streamingMsgIdRef.current !== lastMsg.id
    ) {
      // Find the user message that triggered this generation
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      connectToStream(lastMsg.id, lastMsg.content, lastUser?.content);
    }
  }, [messages, activeConversation?.id]);

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
    };
  }, []);

  const getDisplayName = (modelId: string): string => {
    if (modelAliases[modelId]) return modelAliases[modelId];
    const parts = modelId.split("/");
    return parts[parts.length - 1] || modelId;
  };

  const supportsImage = modelImageSupport[selectedModel] ?? false;

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
    const systemParts: string[] = [];
    if (activeAgent?.system_prompt) systemParts.push(activeAgent.system_prompt);
    if (selectedSkill?.prompt_template) systemParts.push(selectedSkill.prompt_template);
    systemParts.push(buildModelPrompt(selectedModel, memories));

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
      memories.forEach((m) => systemParts.push(`- ${parseMemoryText(m.content)}`));
      systemParts.push("--- End User Memory ---\n");
    }

    // Web search grounding
    if (webSearch) {
      const cleanQuery = content.replace(/!\[[^\]]*\]\([^)]+\)/g, "").trim();
      if (cleanQuery) {
        const searchResults = await performWebSearch(cleanQuery);
        if (searchResults) {
          systemParts.push("\n--- Web Search Results ---");
          systemParts.push("The following are web search results for the user's query. Use them to provide accurate, up-to-date information. Cite sources when relevant.");
          systemParts.push(searchResults);
          systemParts.push("--- End Web Search Results ---\n");
        }
      }
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
        headers: { "Content-Type": "application/json", "x-router-url": settings.routerUrl, "x-router-key": settings.routerApiKey },
        body: JSON.stringify({ model: selectedModel, messages: apiMessages, userId: currentUser?.id, conversationId: convId }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          const errData = await res.json();
          if (errData.code === "TOKEN_LIMIT_EXCEEDED") {
            toast.error(`Token limit reached (${errData.used.toLocaleString()} / ${errData.limit.toLocaleString()}). Contact admin.`);
            setIsStreaming(false);
            setStreamingContent("");
            return;
          }
        }
        throw new Error("Failed");
      }
      const { messageId } = await res.json();
      if (!messageId) throw new Error("No message ID returned");

      if (activeConversationIdRef.current !== convId) return;

      setIsStreaming(true);
      setStreamingContent("");

      const placeholder: Message = {
        id: messageId,
        conversation_id: convId,
        role: "assistant",
        content: "",
        tokens_used: null,
        created_at: new Date().toISOString(),
        edit_group_id: editGroupId,
        branch_index: newBranchIndex,
        status: "generating",
      };
      setMessages((prev) => [...prev, placeholder]);
      connectToStream(messageId, "", content.trim());
    } catch (err) {
      if (err instanceof Error) {
        toast.error(err.message);
      }
    }
  };

  const handleBranchChange = (editGroupId: string, branch: number) => {
    setEditBranches((prev) => ({ ...prev, [editGroupId]: branch }));
  };

  // ── Regenerate last assistant response ──
  const handleRegenerate = async () => {
    if (!activeConversation?.id || isStreaming) return;
    const convId = activeConversation.id;

    // Find last assistant message
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastAssistant || !lastUser) return;

    // Delete last assistant message
    await deleteMessage(lastAssistant.id);

    // Re-send last user message content
    const systemParts: string[] = [];
    if (activeAgent?.system_prompt) systemParts.push(activeAgent.system_prompt);
    if (selectedSkill?.prompt_template) systemParts.push(selectedSkill.prompt_template);
    systemParts.push(buildModelPrompt(selectedModel, memories));

    const knowledgeToInject: KnowledgeSource[] = [...selectedKnowledge];
    if (knowledgeSources.length > 0) {
      const relevant = knowledgeSources.filter((k) =>
        !selectedKnowledge.some((sk) => sk.id === k.id) && (
          lastUser.content.toLowerCase().includes(k.name.toLowerCase()) ||
          k.content.toLowerCase().slice(0, 200).split(/\s+/).some((w) => lastUser.content.toLowerCase().includes(w.toLowerCase()))
        )
      ).slice(0, 3);
      knowledgeToInject.push(...relevant);
    }
    if (knowledgeToInject.length > 0) {
      systemParts.push("\n--- Relevant Knowledge ---");
      knowledgeToInject.forEach((k) => systemParts.push(`[${k.name}]\n${k.content}`));
      systemParts.push("--- End Knowledge ---\n");
    }
    if (memories.length > 0) {
      systemParts.push("\n--- User Memory ---");
      systemParts.push("The following are facts about this user. Use them to personalize your responses:");
      memories.forEach((m) => systemParts.push(`- ${parseMemoryText(m.content)}`));
      systemParts.push("--- End User Memory ---\n");
    }

    // Web search grounding
    if (webSearch) {
      const cleanQuery = lastUser.content.replace(/!\[[^\]]*\]\([^)]+\)/g, "").trim();
      if (cleanQuery) {
        const searchResults = await performWebSearch(cleanQuery);
        if (searchResults) {
          systemParts.push("\n--- Web Search Results ---");
          systemParts.push("The following are web search results for the user's query. Use them to provide accurate, up-to-date information. Cite sources when relevant.");
          systemParts.push(searchResults);
          systemParts.push("--- End Web Search Results ---\n");
        }
      }
    }

    const contextMessages = messages.filter((m) => m.id !== lastAssistant.id);
    const apiMessages = [
      ...(systemParts.length > 0 ? [{ role: "system" as const, content: systemParts.join("\n\n") }] : []),
      ...contextMessages.map((m) => ({ role: m.role as "user" | "assistant", content: m.content })),
    ];

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-router-url": settings.routerUrl, "x-router-key": settings.routerApiKey },
        body: JSON.stringify({ model: selectedModel, messages: apiMessages, userId: currentUser?.id, conversationId: convId }),
      });
      if (!res.ok) {
        if (res.status === 429) {
          const errData = await res.json();
          if (errData.code === "TOKEN_LIMIT_EXCEEDED") {
            toast.error(`Token limit reached (${errData.used.toLocaleString()} / ${errData.limit.toLocaleString()}). Contact admin.`);
            setIsStreaming(false);
            setStreamingContent("");
            return;
          }
        }
        throw new Error("Failed");
      }
      const { messageId } = await res.json();
      if (!messageId) throw new Error("No message ID returned");

      if (activeConversationIdRef.current !== convId) return;

      setIsStreaming(true);
      setStreamingContent("");

      const placeholder: Message = {
        id: messageId,
        conversation_id: convId,
        role: "assistant",
        content: "",
        tokens_used: null,
        created_at: new Date().toISOString(),
        edit_group_id: lastUser.edit_group_id || lastUser.id,
        branch_index: lastUser.branch_index ?? 0,
        status: "generating",
      };
      setMessages((prev) => [...prev, placeholder]);
      connectToStream(messageId, "", lastUser.content);
    } catch (err) {
      if (err instanceof Error) {
        toast.error(err.message);
      }
    }
  };

  const handleSend = async (content: string) => {
    if (!selectedModel) {
      toast.error("Pilih model dulu sebelum chat");
      return;
    }
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

    // For new conversations, deduplicate: addMessage appends to local state
    // but the user message is already there from selectConversation's DB load
    // Just reload messages from DB to get clean state
    if (isNewConv) {
      const supabase = (await import("@/lib/supabase/client")).createClient();
      const { data: freshMsgs } = await supabase.from("messages").select("*").eq("conversation_id", convId).order("created_at", { ascending: true });
      if (freshMsgs) setMessages(freshMsgs);
    }

    const systemParts: string[] = [];
    if (activeAgent?.system_prompt) systemParts.push(activeAgent.system_prompt);
    if (selectedSkill?.prompt_template) systemParts.push(selectedSkill.prompt_template);

    // Inject model identity so AI uses alias when asked
    systemParts.push(buildModelPrompt(selectedModel, memories));

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
      memories.forEach((m) => systemParts.push(`- ${parseMemoryText(m.content)}`));
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
        headers: { "Content-Type": "application/json", "x-router-url": settings.routerUrl, "x-router-key": settings.routerApiKey },
        body: JSON.stringify({ model: selectedModel, messages: apiMessages, userId: currentUser?.id, conversationId: convId }),
      });

      if (!res.ok) {
        if (res.status === 429) {
          const errData = await res.json();
          if (errData.code === "TOKEN_LIMIT_EXCEEDED") {
            toast.error(`Token limit reached (${errData.used.toLocaleString()} / ${errData.limit.toLocaleString()}). Contact admin.`);
            setIsStreaming(false);
            setStreamingContent("");
            return;
          }
        }
        throw new Error("Failed");
      }

      const { messageId } = await res.json();
      if (!messageId) throw new Error("No message ID returned");

      // Guard: user switched rooms while waiting for POST
      if (activeConversationIdRef.current !== convId) return;

      // Set streaming state only after guard passes
      setIsStreaming(true);
      setStreamingContent("");

      // Add placeholder message to local state
      const placeholder: Message = {
        id: messageId,
        conversation_id: convId,
        role: "assistant",
        content: "",
        tokens_used: null,
        created_at: new Date().toISOString(),
        status: "generating",
      };
      setMessages((prev) => [...prev, placeholder]);

      // Connect to SSE stream for real-time content
      connectToStream(messageId, "", content);
    } catch (err) {
      if (err instanceof Error) {
        toast.error(err.message);
      }
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
              {!activeAgent && !currentUser?.default_model && (
                <div className="mt-3">
                  <p className="text-xs text-amber-500 font-medium">Pilih model dulu untuk mulai chat</p>
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
        <ChatInput onSend={handleSend} disabled={!selectedModel} isStreaming={false} agentName={activeAgent?.name} conversationId={undefined} userId={currentUser?.id} supportsImage={supportsImage} webSearch={webSearch} onToggleWebSearch={() => setWebSearch((v) => !v)} />
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
        <div className="w-full space-y-1 px-4 py-6">
          {(() => {
            // Build display list with branch awareness
            const display: React.ReactNode[] = [];
            let lastUserEditGroup: string | null = null;
            let lastUserGroupTotal = 0;

            // Pre-compute: find the last visible assistant message ID (accounting for branch filtering)
            let lastVisibleAssistantId: string | null = null;
            {
              let _lueg: string | null = null;
              let _lugt = 0;
              for (const msg of messages) {
                if (msg.role === "user") {
                  const egId = msg.edit_group_id || msg.id;
                  _lueg = egId;
                  _lugt = messages.filter((m) => m.role === "user" && (m.edit_group_id === egId || m.id === egId)).length;
                  const cb = editBranches[egId] ?? 0;
                  if ((msg.branch_index ?? 0) !== cb) continue;
                } else if (msg.role === "assistant") {
                  const bi = msg.branch_index ?? 0;
                  const cb = _lueg ? (editBranches[_lueg] ?? 0) : 0;
                  if (_lueg && _lugt > 1 && bi !== cb) continue;
                  lastVisibleAssistantId = msg.id;
                }
              }
            }

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
                      createdAt={msg.created_at}
                    />
                    <MessageBranchSelector
                      currentBranch={currentBranch}
                      totalBranches={totalBranches}
                      onBranchChange={(b) => handleBranchChange(editGroupId, b)}
                    />
                  </div>
                );
              } else if (msg.role === "assistant") {
                // Skip generating messages — streaming bubble handles them
                if (msg.status === "generating") continue;
                const branchIndex = msg.branch_index ?? 0;
                const currentBranch = lastUserEditGroup ? (editBranches[lastUserEditGroup] ?? 0) : 0;

                // Skip non-current branch assistant messages
                if (lastUserEditGroup && lastUserGroupTotal > 1 && branchIndex !== currentBranch) continue;
                const isLastAssistant = !isStreaming && msg.id === lastVisibleAssistantId;
                display.push(
                  <ChatMessage key={msg.id} role="assistant" content={msg.content} onRetry={isLastAssistant ? handleRegenerate : undefined} createdAt={msg.created_at} />
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
        disabled={!selectedModel}
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
        supportsImage={supportsImage}
        webSearch={webSearch}
        onToggleWebSearch={() => setWebSearch((v) => !v)}
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
