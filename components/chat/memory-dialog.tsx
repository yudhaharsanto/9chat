"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Brain, X } from "lucide-react";

/** Memory content is plain text. Parse legacy JSON if present. */
function parseMemoryText(raw: string): string {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.texts)) return parsed.texts.join("\n");
    if (parsed && typeof parsed.text === "string") return parsed.text;
  } catch { /* plain text — good */ }
  return raw;
}

interface MemoryDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (content: string, category: string) => Promise<void>;
  initialContent?: string;
  initialCategory?: string;
  conversationTitle?: string | null;
  mode?: "add" | "edit";
}

export function MemoryDialog({
  open, onClose, onSave, initialContent = "", initialCategory = "general", conversationTitle, mode = "add",
}: MemoryDialogProps) {
  const [content, setContent] = useState("");
  const [category, setCategory] = useState(initialCategory);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      // Parse JSON content to get plain text for editing
      setContent(parseMemoryText(initialContent));
      setCategory(initialCategory);
    }
  }, [open, initialContent, initialCategory]);

  if (!open) return null;

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await onSave(content.trim(), category);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-[420px] rounded-xl border border-border/60 bg-background shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/40 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Brain className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold">{mode === "edit" ? "Edit Memory" : "Add Memory"}</h2>
              {conversationTitle ? (
                <p className="text-[10px] text-primary/70">Room: {conversationTitle}</p>
              ) : (
                <p className="text-[10px] text-muted-foreground">Global memory — applies to all chats</p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="space-y-4 p-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">What should I remember?</label>
            <textarea
              className="w-full rounded-lg border border-input bg-transparent px-3 py-2.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 min-h-[100px] resize-y"
              placeholder={
                conversationTitle
                  ? `e.g. "This project uses Supabase + Vercel"`
                  : `e.g. "I prefer short, concise answers"`
              }
              value={content}
              onChange={(e) => setContent(e.target.value)}
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Category</label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { value: "general", label: "General", icon: "📌" },
                { value: "preference", label: "Preference", icon: "⚙️" },
                { value: "project", label: "Project", icon: "📂" },
                { value: "personal", label: "Personal", icon: "👤" },
                { value: "technical", label: "Technical", icon: "💻" },
              ].map((cat) => (
                <button
                  key={cat.value}
                  onClick={() => setCategory(cat.value)}
                  className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                    category === cat.value
                      ? "bg-primary/10 text-primary ring-1 ring-primary/20"
                      : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  <span>{cat.icon}</span>
                  {cat.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t border-border/40 px-5 py-3.5">
          <Button variant="ghost" size="sm" className="rounded-lg" onClick={onClose}>Cancel</Button>
          <Button
            size="sm"
            className="rounded-lg bg-primary text-primary-foreground"
            onClick={handleSave}
            disabled={!content.trim() || saving}
          >
            {saving ? "Saving..." : mode === "edit" ? "Save Changes" : "Add Memory"}
          </Button>
        </div>
      </div>
    </div>
  );
}
