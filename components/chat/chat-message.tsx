"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Copy, Check, User, Sparkles, RotateCcw, Pencil } from "lucide-react";
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";

// Extract markdown images and render them separately
function renderUserContent(content: string) {
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = imageRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const text = content.slice(lastIndex, match.index).trim();
      if (text) parts.push(<p key={`t-${lastIndex}`} className="whitespace-pre-wrap break-words">{text}</p>);
    }
    parts.push(
      <div key={`img-${match.index}`} className="my-1.5 overflow-hidden rounded-lg">
        <img src={match[2]} alt={match[1] || "image"} className="max-h-[400px] max-w-full rounded-lg object-contain" loading="lazy" />
      </div>
    );
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const text = content.slice(lastIndex).trim();
    if (text) parts.push(<p key="t-end" className="whitespace-pre-wrap break-words">{text}</p>);
  }

  if (parts.length === 0) {
    return <p className="whitespace-pre-wrap break-words">{content}</p>;
  }

  return <>{parts}</>;
}

interface ChatMessageProps {
  role: "user" | "assistant";
  content?: string;
  isStreaming?: boolean;
  onRetry?: () => void;
  onEdit?: () => void;
}

export function ChatMessage({ role, content, isStreaming, onRetry, onEdit }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const isUser = role === "user";

  return (
    <div className={cn("group/msg relative animate-in fade-in-0 slide-in-from-bottom-1 duration-300", isUser ? "flex justify-end" : "flex gap-4")}>
      {/* Assistant avatar */}
      {!isUser && (
        <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/10">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
        </div>
      )}

      {/* Message bubble */}
      <div className={cn("relative max-w-[75%]", isUser && "order-1")}>
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-[0.9rem] leading-relaxed",
            isUser
              ? "bg-muted text-foreground rounded-br-md"
              : "bg-card border border-border/60 rounded-bl-md shadow-sm"
          )}
        >
          {isUser ? (
            content ? renderUserContent(content) : null
          ) : (
            <div className="prose-chat break-words">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight]}
                components={{
                  p({ children }) { return <p className="mb-3 last:mb-0">{children}</p>; },
                  ul({ children }) { return <ul className="mb-3 ml-1 list-disc space-y-1 pl-4 last:mb-0">{children}</ul>; },
                  ol({ children }) { return <ol className="mb-3 ml-1 list-decimal space-y-1 pl-4 last:mb-0">{children}</ol>; },
                  li({ children }) { return <li className="text-[0.875rem] leading-relaxed">{children}</li>; },
                  h1({ children }) { return <h1 className="mb-2 mt-4 text-xl font-bold first:mt-0">{children}</h1>; },
                  h2({ children }) { return <h2 className="mb-2 mt-3 text-lg font-semibold first:mt-0">{children}</h2>; },
                  h3({ children }) { return <h3 className="mb-1.5 mt-2.5 text-base font-semibold first:mt-0">{children}</h3>; },
                  strong({ children }) { return <strong className="font-semibold text-foreground">{children}</strong>; },
                  a({ href, children }) { return <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary">{children}</a>; },
                  blockquote({ children }) { return <blockquote className="my-3 border-l-2 border-primary/40 pl-4 text-muted-foreground italic">{children}</blockquote>; },
                  hr() { return <hr className="my-4 border-border/60" />; },
                  code({ className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || "");
                    const isInline = !match && !className;
                    if (isInline) {
                      return <code className="rounded-md bg-muted/80 px-1.5 py-0.5 text-[0.82em] font-mono font-medium" {...props}>{children}</code>;
                    }
                    return (
                      <div className="group/code relative my-3 overflow-hidden rounded-xl border border-border/60 bg-muted/30">
                        {match && (
                          <div className="flex items-center justify-between border-b border-border/40 bg-muted/50 px-4 py-2">
                            <span className="select-none text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/70">{match[1]}</span>
                            <Button variant="ghost" size="sm" className="h-6 gap-1 rounded-md px-2 text-[10px] opacity-0 transition-opacity group-hover/code:opacity-100" onClick={() => navigator.clipboard.writeText(String(children))}>
                              <Copy className="h-3 w-3" /> Copy
                            </Button>
                          </div>
                        )}
                        <pre className={cn("overflow-x-auto p-4 text-[0.82em] leading-relaxed", className)}>
                          <code {...props}>{children}</code>
                        </pre>
                      </div>
                    );
                  },
                  table({ children }) { return <div className="my-3 overflow-x-auto rounded-lg border border-border/60"><table className="w-full text-sm">{children}</table></div>; },
                  thead({ children }) { return <thead className="border-b border-border/60 bg-muted/30">{children}</thead>; },
                  th({ children }) { return <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</th>; },
                  td({ children }) { return <td className="border-b border-border/30 px-4 py-2.5 text-sm last:border-0">{children}</td>; },
                }}
              >
                {content || ""}
              </ReactMarkdown>
              {isStreaming && (
                <span className="inline-block h-4 w-0.5 animate-pulse rounded-full bg-primary" />
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        {!isStreaming && content && (
          <div className={cn(
            "mt-1 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/msg:opacity-100",
            isUser ? "justify-end" : "justify-start"
          )}>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
              onClick={() => { navigator.clipboard.writeText(content!); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            {isUser && onEdit && !content.match(/!\[.*\]\(.*\)/) && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                onClick={onEdit}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {isUser && onRetry && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                onClick={onRetry}
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="order-2 mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-muted to-muted/50 ring-1 ring-border/50">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
