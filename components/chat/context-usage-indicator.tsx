"use client";

import { useMemo } from "react";
import { getContextWindow, formatTokens, calculateContextUsage } from "@/lib/context-window";
import { cn } from "@/lib/utils";
import type { Message, KnowledgeSource, UserMemory } from "@/lib/types";

interface ContextUsageIndicatorProps {
  modelId: string;
  messages: Message[];
  systemPrompt?: string;
  knowledgeSources?: KnowledgeSource[];
  memories?: UserMemory[];
  webSearchResults?: string;
  className?: string;
}

export function ContextUsageIndicator({
  modelId,
  messages,
  systemPrompt,
  knowledgeSources = [],
  memories = [],
  webSearchResults,
  className,
}: ContextUsageIndicatorProps) {
  const contextWindow = getContextWindow(modelId);
  
  const usedTokens = useMemo(() => {
    return calculateContextUsage(
      messages,
      systemPrompt,
      knowledgeSources.map((k) => `[${k.name}]\n${k.content}`),
      memories.map((m) => m.content),
      webSearchResults,
    );
  }, [messages, systemPrompt, knowledgeSources, memories, webSearchResults]);
  
  const percent = Math.min(100, (usedTokens / contextWindow) * 100);
  
  // Color: green < 50%, yellow 50-80%, red > 80%
  const color = percent > 80 ? "text-red-500" : percent > 50 ? "text-yellow-500" : "text-emerald-500";
  const barColor = percent > 80 ? "bg-red-500" : percent > 50 ? "bg-yellow-500" : "bg-emerald-500";
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Bar */}
      <div className="h-1.5 w-16 rounded-full bg-muted/80 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barColor)}
          style={{ width: `${percent}%` }}
        />
      </div>
      {/* Text */}
      <span className={cn("text-[10px] font-medium tabular-nums", color)}>
        {formatTokens(usedTokens)} / {formatTokens(contextWindow)}
      </span>
    </div>
  );
}
