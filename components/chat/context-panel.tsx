"use client";

import { useState, useMemo } from "react";
import { ChevronDown, FileText, Brain, BookOpen, MessageSquare, Search, Zap, Eye, EyeOff, Layers, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { getContextWindow, formatTokens } from "@/lib/context-window";
import type { Agent, KnowledgeSource, UserMemory } from "@/lib/types";

interface ContextPanelProps {
  systemPrompt?: string;
  skillPrompt?: string;
  modelPrompt?: string;
  knowledgeSources?: KnowledgeSource[];
  selectedKnowledge?: KnowledgeSource[];
  memories?: UserMemory[];
  webSearchResults?: string;
  modelName?: string;
  modelId?: string;
  userName?: string;
  messageCount?: number;
  className?: string;
}

interface ContextSectionProps {
  title: string;
  icon: React.ReactNode;
  content: string;
  defaultOpen?: boolean;
  badge?: string;
  tokenEstimate?: number;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function ContextSection({ title, icon, content, defaultOpen = false, badge, tokenEstimate }: ContextSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  
  if (!content?.trim()) return null;
  
  const tokens = tokenEstimate ?? estimateTokens(content);
  
  return (
    <div className="border-b border-border/40 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        {icon}
        <span className="flex-1 text-left">{title}</span>
        {badge && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            {badge}
          </span>
        )}
        <span className="text-[10px] text-muted-foreground/50 tabular-nums">~{tokens} tok</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="px-3 pb-3">
          <pre className="text-[11px] leading-relaxed text-muted-foreground/80 whitespace-pre-wrap break-words font-mono bg-muted/30 rounded-md p-2 max-h-[200px] overflow-y-auto">
            {content}
          </pre>
        </div>
      )}
    </div>
  );
}

export function ContextPanel({
  systemPrompt,
  skillPrompt,
  modelPrompt,
  knowledgeSources = [],
  selectedKnowledge = [],
  memories = [],
  webSearchResults,
  modelName,
  modelId,
  userName,
  messageCount = 0,
  className,
}: ContextPanelProps) {
  const [showFullPrompt, setShowFullPrompt] = useState(false);
  
  const hasContent = systemPrompt || skillPrompt || modelPrompt || knowledgeSources.length > 0 || memories.length > 0 || webSearchResults;
  
  // Calculate total tokens
  const totalTokens = useMemo(() => {
    let total = 0;
    if (systemPrompt) total += estimateTokens(systemPrompt);
    if (skillPrompt) total += estimateTokens(skillPrompt);
    if (modelPrompt) total += estimateTokens(modelPrompt);
    knowledgeSources.forEach((k) => total += estimateTokens(k.content));
    memories.forEach((m) => total += estimateTokens(m.content));
    if (webSearchResults) total += estimateTokens(webSearchResults);
    return total;
  }, [systemPrompt, skillPrompt, modelPrompt, knowledgeSources, memories, webSearchResults]);
  
  // Build full system prompt preview
  const fullSystemPrompt = useMemo(() => {
    const parts: string[] = [];
    if (systemPrompt) parts.push(systemPrompt);
    if (skillPrompt) parts.push(skillPrompt);
    if (modelPrompt) parts.push(modelPrompt);
    if (knowledgeSources.length > 0) {
      parts.push("\n--- Relevant Knowledge ---");
      knowledgeSources.forEach((k) => parts.push(`[${k.name}]\n${k.content}`));
      parts.push("--- End Knowledge ---\n");
    }
    if (memories.length > 0) {
      parts.push("\n--- User Memory ---");
      parts.push("The following are facts about this user. Use them to personalize your responses:");
      memories.forEach((m) => parts.push(`- ${m.content}`));
      parts.push("--- End User Memory ---\n");
    }
    if (webSearchResults) {
      parts.push("\n--- Web Search Results ---");
      parts.push(webSearchResults);
      parts.push("--- End Web Search Results ---\n");
    }
    return parts.join("\n\n");
  }, [systemPrompt, skillPrompt, modelPrompt, knowledgeSources, memories, webSearchResults]);
  
  if (!hasContent) {
    return (
      <div className={cn("text-center py-8 text-xs text-muted-foreground", className)}>
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No context configured</p>
        <p className="mt-1 text-[10px]">Add a system prompt, knowledge sources, or memories</p>
      </div>
    );
  }

  // Separate auto-matched vs manually selected knowledge
  const autoKnowledge = knowledgeSources.filter((k) => !selectedKnowledge.some((sk) => sk.id === k.id));
  
  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* Header stats */}
      <div className="px-3 py-2 border-b border-border/40 bg-muted/20 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-muted-foreground/60">Context Window</span>
          <div className="flex items-center gap-1.5">
            {/* Bar */}
            <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  totalTokens / (modelId ? getContextWindow(modelId) : 128000) > 0.8 ? "bg-red-500" :
                  totalTokens / (modelId ? getContextWindow(modelId) : 128000) > 0.5 ? "bg-yellow-500" : "bg-emerald-500"
                )}
                style={{ width: `${Math.min(100, (totalTokens / (modelId ? getContextWindow(modelId) : 128000)) * 100)}%` }}
              />
            </div>
            <span className={cn(
              "text-xs font-semibold tabular-nums",
              totalTokens / (modelId ? getContextWindow(modelId) : 128000) > 0.8 ? "text-red-500" :
              totalTokens / (modelId ? getContextWindow(modelId) : 128000) > 0.5 ? "text-yellow-500" : "text-emerald-500"
            )}>
              {formatTokens(totalTokens)} / {modelId ? formatTokens(getContextWindow(modelId)) : "128k"}
            </span>
          </div>
        </div>
        <div className="flex gap-2 text-[10px] text-muted-foreground/50">
          {modelName && <span>Model: <span className="text-foreground/70">{modelName}</span></span>}
          {userName && <span>User: <span className="text-foreground/70">{userName}</span></span>}
        </div>
        <div className="flex gap-2 text-[10px] text-muted-foreground/50">
          <span>{messageCount} messages</span>
          <span>•</span>
          <span>{knowledgeSources.length} knowledge</span>
          <span>•</span>
          <span>{memories.length} memories</span>
        </div>
      </div>
      
      {/* Context sections */}
      <div className="flex-1 overflow-y-auto divide-y divide-border/40">
        {systemPrompt && (
          <ContextSection
            title="System Prompt"
            icon={<MessageSquare className="h-3.5 w-3.5" />}
            content={systemPrompt}
            defaultOpen={true}
            badge="Agent"
          />
        )}
        {skillPrompt && (
          <ContextSection
            title="Skill Prompt"
            icon={<Zap className="h-3.5 w-3.5" />}
            content={skillPrompt}
            badge="Active"
          />
        )}
        {modelPrompt && (
          <ContextSection
            title="Model Identity"
            icon={<Layers className="h-3.5 w-3.5" />}
            content={modelPrompt}
          />
        )}
        {selectedKnowledge.length > 0 && (
          <ContextSection
            title={`Selected Knowledge (${selectedKnowledge.length})`}
            icon={<BookOpen className="h-3.5 w-3.5" />}
            content={selectedKnowledge.map((k) => `## ${k.name}\n${k.content}`).join("\n\n---\n\n")}
            badge="Manual"
          />
        )}
        {autoKnowledge.length > 0 && (
          <ContextSection
            title={`Auto-matched Knowledge (${autoKnowledge.length})`}
            icon={<BookOpen className="h-3.5 w-3.5 opacity-60" />}
            content={autoKnowledge.map((k) => `## ${k.name}\n${k.content}`).join("\n\n---\n\n")}
          />
        )}
        {memories.length > 0 && (
          <ContextSection
            title={`User Memories (${memories.length})`}
            icon={<Brain className="h-3.5 w-3.5" />}
            content={memories.map((m) => `[${m.category}] ${m.content}`).join("\n\n")}
          />
        )}
        {webSearchResults && (
          <ContextSection
            title="Web Search Results"
            icon={<Search className="h-3.5 w-3.5" />}
            content={webSearchResults}
            badge="Live"
          />
        )}
      </div>
      
      {/* Full prompt toggle */}
      <div className="border-t border-border/40">
        <button
          onClick={() => setShowFullPrompt((v) => !v)}
          className="flex w-full items-center gap-2 px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          {showFullPrompt ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          <span>{showFullPrompt ? "Hide" : "View"} Full System Prompt</span>
        </button>
        {showFullPrompt && (
          <div className="px-3 pb-3">
            <pre className="text-[10px] leading-relaxed text-muted-foreground/70 whitespace-pre-wrap break-words font-mono bg-muted/30 rounded-md p-2 max-h-[300px] overflow-y-auto">
              {fullSystemPrompt || "(empty)"}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
