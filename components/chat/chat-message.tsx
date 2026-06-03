"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Copy, Check, User, Sparkles, RotateCcw, Pencil, ChevronDown } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import "highlight.js/styles/atom-one-dark.css";

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
  createdAt?: string;
  status?: "generating" | "done" | "failed";
}

function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function ChatMessage({ role, content, isStreaming, onRetry, onEdit, createdAt, status }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isUser = role === "user";
  const isLong = (content || "").length > 2000 || (content || "").split("\n").length > 40;

  return (
    <div>
      <div className={cn("group/msg relative animate-in fade-in-0 slide-in-from-bottom-1 duration-300", isUser ? "flex items-start justify-end gap-1.5" : "flex gap-3")}>
        {/* Assistant avatar */}
        {!isUser && (
          <div className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/5 ring-1 ring-primary/10">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
        )}

        {/* Message bubble */}
        <div className={cn("relative", isUser ? "max-w-[85%] order-1" : "max-w-[90%]")}>
          <div
            className={cn(
              "rounded-2xl px-3.5 py-2.5 text-[0.875rem] leading-relaxed relative",
              isUser
                ? "bg-muted text-foreground rounded-br-md"
                : "bg-card border border-border/60 rounded-bl-md shadow-sm",
              isUser && isLong && !expanded && "max-h-[420px] overflow-hidden"
            )}
          >
            {isUser && isLong && !expanded && (
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-20 rounded-b-2xl bg-gradient-to-t from-muted via-muted/80 to-transparent" />
            )}
            {isUser ? (
              content ? renderUserContent(content) : null
            ) : (
              <div className="prose-chat break-words">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, remarkMath]}
                  rehypePlugins={[rehypeHighlight, rehypeKatex]}
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
                              <Button variant="ghost" size="sm" className="h-6 gap-1 rounded-md px-2 text-[10px] opacity-0 transition-opacity group-hover/code:opacity-100" onClick={(e) => {
                                const wrapper = (e.currentTarget as HTMLElement).parentElement?.parentElement;
                                const text = wrapper?.querySelector("pre")?.textContent || "";
                                navigator.clipboard.writeText(text);
                                toast.success("Copied!", { duration: 1500 });
                              }}>
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

          {/* Show all toggle for long user messages only */}
          {isUser && isLong && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex w-full items-center justify-center gap-1 py-1 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {expanded ? "Show less" : "Show all"}
              <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
            </button>
          )}

          <div className="flex items-center gap-2 align-center">
            {createdAt && (
              <span className="ml-1 text-[10px] text-muted-foreground/40">{formatTimestamp(createdAt)}</span>
            )}
            {status === "failed" && (
              <span className="ml-1 flex items-center gap-1 text-[10px] text-red-500">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                Failed
              </span>
            )}
            {/* Actions */}
            {!isStreaming && content && (
              <div className={cn(
                "mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover/msg:opacity-100",
                isUser ? "justify-end" : "justify-start"
              )}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                  onClick={() => { navigator.clipboard.writeText(content!); setCopied(true); toast.success("Copied!", { duration: 1500 }); setTimeout(() => setCopied(false), 2000); }}
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
                {!isUser && onRetry && (
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
        </div>

        {/* User avatar */}
        {isUser && (
          <div className="order-2 mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-muted to-muted/50 ring-1 ring-border/50">
            <User className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
