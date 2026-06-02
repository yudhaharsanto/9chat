"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Square, Loader2, ImageIcon, X, Pencil, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function extractImages(content: string): { text: string; images: string[] } {
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const images: string[] = [];
  const text = content.replace(imageRegex, (_match, _alt, url) => {
    images.push(url);
    return "";
  }).trim();
  return { text, images };
}

interface ChatInputProps {
  onSend: (content: string) => void;
  disabled?: boolean;
  isStreaming?: boolean;
  onStop?: () => void;
  agentName?: string;
  conversationId?: string;
  userId?: string;
  editingContent?: string | null;
  onEditSave?: (content: string) => void;
  onEditCancel?: () => void;
  onMemoryClick?: () => void;
  conversationTitle?: string | null;
}

export function ChatInput({
  onSend, disabled, isStreaming, onStop, agentName, conversationId, userId,
  editingContent, onEditSave, onEditCancel, onMemoryClick, conversationTitle,
}: ChatInputProps) {
  const [content, setContent] = useState("");
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditMode = editingContent != null;
  const editData = isEditMode ? extractImages(editingContent) : null;
  const editText = editData?.text || "";
  const editImages = editData?.images || [];

  // Populate textarea when entering edit mode
  useEffect(() => {
    if (isEditMode) {
      setContent(editText);
      setAttachedImage(null);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isEditMode, editingContent]);

  // Auto-resize textarea
  useEffect(() => {
    const t = textareaRef.current;
    if (t) {
      t.style.height = "auto";
      t.style.height = `${Math.min(t.scrollHeight, 200)}px`;
    }
  }, [content]);

  // Auto-focus on mount
  useEffect(() => {
    if (!isEditMode) textareaRef.current?.focus();
  }, []);

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith("image/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) uploadFile(file);
        return;
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith("image/")) uploadFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); };

  const uploadFile = async (file: File) => {
    if (file.size > 1 * 1024 * 1024) { toast.error("Image too large (max 1MB)"); return; }
    if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.type)) {
      toast.error("Invalid file type"); return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (conversationId) fd.append("conversationId", conversationId);
      if (userId) fd.append("userId", userId);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok && data.url) { setAttachedImage(data.url); toast.success("Uploaded"); }
      else toast.error(data.error || "Upload failed");
    } catch { toast.error("Upload failed"); }
    finally { setUploading(false); }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await uploadFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSend = () => {
    if (isEditMode) {
      // Save edit
      let msg = content.trim();
      if (editImages.length > 0) {
        const imageMarkdown = editImages.map((url) => `![image](${url})`).join("\n");
        msg = msg ? `${msg}\n\n${imageMarkdown}` : imageMarkdown;
      }
      if (msg) onEditSave?.(msg);
      return;
    }

    if ((!content.trim() && !attachedImage) || disabled) return;
    let msg = content.trim();
    if (attachedImage) {
      msg = msg ? `${msg}\n\n![image](${attachedImage})` : `![image](${attachedImage})`;
    }
    onSend(msg);
    setContent("");
    setAttachedImage(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
    if (e.key === "Escape" && isEditMode) onEditCancel?.();
  };

  const canSend = isEditMode ? !!content.trim() || editImages.length > 0 : (!!content.trim() || !!attachedImage) && !disabled;

  return (
    <div className="relative border-t border-border/40 bg-gradient-to-t from-background via-background to-background/0 pb-4 pt-6">
      <div className="mx-auto max-w-3xl px-4">

        {/* Edit mode banner */}
        {isEditMode && (
          <div className="mb-2 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
            <Pencil className="h-3 w-3" />
            <span className="flex-1">Editing message</span>
            {editImages.length > 0 && (
              <div className="flex items-center gap-1">
                {editImages.map((url, i) => (
                  <img key={i} src={url} alt="" className="h-6 w-6 rounded object-cover" />
                ))}
              </div>
            )}
            <Button variant="ghost" size="icon" className="h-5 w-5 rounded-md" onClick={onEditCancel}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}

        {/* Image preview (new upload) */}
        {!isEditMode && attachedImage && (
          <div className="mb-3 flex animate-in fade-in-0 slide-in-from-bottom-2 items-center gap-3 rounded-xl border border-border/60 bg-card/80 p-2.5 shadow-sm backdrop-blur-sm">
            <div className="relative h-14 w-14 overflow-hidden rounded-lg ring-1 ring-border/50">
              <img src={attachedImage} alt="Preview" className="h-full w-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium">Image attached</p>
              <p className="text-[10px] text-muted-foreground">Ready to send</p>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setAttachedImage(null)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Input container */}
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border bg-card/80 shadow-sm backdrop-blur-sm transition-all duration-200",
            isFocused
              ? "border-primary/30 shadow-md shadow-primary/5 ring-1 ring-primary/10"
              : "border-border/60"
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
        >
          <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleImageUpload} />

          <Textarea
            ref={textareaRef}
            placeholder={isEditMode ? "Edit message..." : agentName ? `Message ${agentName}...` : "Type a message..."}
            className="min-h-[48px] max-h-[200px] resize-none border-0 bg-transparent px-4 pt-3.5 pb-0 text-sm shadow-none focus-visible:ring-0"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={disabled}
            rows={1}
          />

          {/* Bottom bar */}
          <div className="flex items-center justify-between px-3 py-2.5">
            <div className="flex items-center gap-1">
              {!isEditMode && onMemoryClick && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl text-muted-foreground hover:text-primary"
                  onClick={onMemoryClick}
                  title={conversationTitle ? `Remember for "${conversationTitle}"` : "Add global memory"}
                >
                  <Brain className="h-4 w-4" />
                </Button>
              )}
              {!isEditMode && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl text-muted-foreground hover:text-foreground"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || disabled}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
                </Button>
              )}
            </div>

            <div className="flex items-center gap-2">
              {isEditMode ? (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-xl px-3 text-xs"
                    onClick={onEditCancel}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    className={cn(
                      "h-8 gap-1.5 rounded-xl px-3 text-xs font-medium",
                      canSend
                        ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90"
                        : "bg-muted text-muted-foreground"
                    )}
                    onClick={handleSend}
                    disabled={!canSend}
                  >
                    Save
                  </Button>
                </>
              ) : isStreaming ? (
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 gap-1.5 rounded-xl px-3 text-xs font-medium"
                  onClick={onStop}
                >
                  <Square className="h-3.5 w-3.5 fill-current" /> Stop
                </Button>
              ) : (
                <Button
                  size="sm"
                  className={cn(
                    "h-8 gap-1.5 rounded-xl px-3 text-xs font-medium transition-all duration-200",
                    canSend
                      ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20 hover:bg-primary/90"
                      : "bg-muted text-muted-foreground"
                  )}
                  onClick={handleSend}
                  disabled={!canSend}
                >
                  {disabled ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      Send <kbd className="hidden sm:inline-flex items-center rounded border border-primary-foreground/20 bg-primary-foreground/10 px-1 py-0.5 text-[9px] font-mono">↵</kbd>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Footer hint */}
        <p className="mt-2.5 text-center text-[10px] text-muted-foreground/60">
          {isEditMode ? "Esc to cancel · Enter to save" : `${agentName ? `${agentName} · ` : ""}Powered by 9router · Shift+Enter for new line`}
        </p>
      </div>
    </div>
  );
}
