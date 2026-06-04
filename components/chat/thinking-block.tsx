"use client";

import { useState, useEffect } from "react";
import { ChevronDown, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThinkingBlockProps {
  content: string;
  isStreaming?: boolean;
}

export function ThinkingBlock({ content, isStreaming }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  
  // Auto-expand when streaming starts, collapse when done
  useEffect(() => {
    if (isStreaming) {
      setExpanded(true);
      if (!startTime) setStartTime(Date.now());
    } else if (startTime) {
      setDuration(Date.now() - startTime);
    }
  }, [isStreaming, startTime]);
  
  if (!content && !isStreaming) return null;
  
  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  return (
    <div className="mb-2">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group"
      >
        <Brain className={cn("h-3.5 w-3.5", isStreaming && "animate-pulse text-primary")} />
        <span className="font-medium">
          {isStreaming ? "Thinking..." : "Thinking process"}
        </span>
        {duration && !isStreaming && (
          <span className="text-[10px] text-muted-foreground/60">
            ({formatDuration(duration)})
          </span>
        )}
        <ChevronDown
          className={cn(
            "h-3 w-3 transition-transform",
            expanded && "rotate-180"
          )}
        />
      </button>
      
      {expanded && (
        <div className="mt-2 ml-5.5 pl-3 border-l-2 border-primary/20">
          <div className="text-xs text-muted-foreground/80 leading-relaxed whitespace-pre-wrap break-words font-mono">
            {content || (isStreaming ? (
              <span className="flex gap-1">
                <span className="h-1 w-1 animate-bounce rounded-full bg-primary/60 [animation-delay:0ms]" />
                <span className="h-1 w-1 animate-bounce rounded-full bg-primary/60 [animation-delay:150ms]" />
                <span className="h-1 w-1 animate-bounce rounded-full bg-primary/60 [animation-delay:300ms]" />
              </span>
            ) : null)}
            {isStreaming && content && (
              <span className="inline-block h-3 w-0.5 animate-pulse rounded-full bg-primary ml-0.5" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
