"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useChatContext } from "@/components/providers/chat-provider";
import {
  FolderPlus, Trash2, Pencil, Check, X, Lock, Hash,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Project } from "@/lib/types";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

const FOLDER_ICONS = ["📁", "💼", "🚀", "🎨", "💻", "📚", "🎯", "🔬", "🏠", "🎮"];

interface ProjectListProps {
  onSelectProject: (project: Project | null) => void;
  activeProjectId: string | null;
}

export function ProjectList({ onSelectProject, activeProjectId }: ProjectListProps) {
  const { projects, createProject, deleteProject, renameProject, verifyProjectPassword } = useChatContext();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [pendingProject, setPendingProject] = useState<Project | null>(null);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("📁");
  const [newPassword, setNewPassword] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createProject(newName.trim(), newIcon, newPassword || undefined);
    setCreateDialogOpen(false);
    setNewName(""); setNewIcon("📁"); setNewPassword("");
    toast.success("Folder created");
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    await deleteProject(id);
    toast.success("Folder deleted");
  };

  const handleProjectClick = async (project: Project) => {
    if (project.password_hash) {
      setPendingProject(project);
      setPasswordDialogOpen(true);
      setPasswordInput("");
      setPasswordError(false);
    } else {
      onSelectProject(project);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingProject) return;
    const valid = await verifyProjectPassword(pendingProject.id, passwordInput);
    if (valid) {
      setPasswordDialogOpen(false);
      onSelectProject(pendingProject);
      setPendingProject(null);
    } else {
      setPasswordError(true);
      toast.error("Incorrect password");
    }
  };

  return (
    <>
      <div className="space-y-0.5 px-1">
        {/* All Chats */}
        <button
          onClick={() => onSelectProject(null)}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
            activeProjectId === null
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          <Hash className="h-3.5 w-3.5" />
          <span>All Chats</span>
        </button>

        {/* Projects */}
        {projects.map((project) => (
          <div key={project.id} className="group">
            <button
              onClick={() => handleProjectClick(project)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors",
                activeProjectId === project.id
                  ? "bg-accent text-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              {project.password_hash ? (
                <Lock className="h-3 w-3 text-amber-500" />
              ) : (
                <span className="text-xs">{project.icon}</span>
              )}
              {editingId === project.id ? (
                <div className="flex flex-1 items-center gap-1">
                  <Input
                    className="h-5 flex-1 text-xs"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { renameProject(project.id, editName); setEditingId(null); }
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    autoFocus
                  />
                  <Button variant="ghost" size="icon" className="h-4 w-4" onClick={(e) => { e.stopPropagation(); setEditingId(null); }}>
                    <X className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-4 w-4" onClick={(e) => { e.stopPropagation(); renameProject(project.id, editName); setEditingId(null); }}>
                    <Check className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="flex-1 truncate text-left">{project.name}</span>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-4 w-4 text-muted-foreground" onClick={(e) => { e.stopPropagation(); setEditingId(project.id); setEditName(project.name); }}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-4 w-4 text-destructive" onClick={(e) => handleDelete(project.id, e)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </>
              )}
            </button>
          </div>
        ))}

        {/* New Folder */}
        <button
          onClick={() => setCreateDialogOpen(true)}
          className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50 hover:text-foreground"
        >
          <FolderPlus className="h-3.5 w-3.5" />
          <span>New Folder</span>
        </button>
      </div>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-xl">
          <DialogHeader>
            <DialogTitle>New Folder</DialogTitle>
            <DialogDescription>Create a folder to organize your chats</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="e.g. Work, Personal..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label>Icon</Label>
              <div className="flex flex-wrap gap-1.5">
                {FOLDER_ICONS.map((icon) => (
                  <button
                    key={icon}
                    onClick={() => setNewIcon(icon)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-lg text-sm transition-colors",
                      newIcon === icon
                        ? "bg-primary/10 ring-2 ring-primary"
                        : "hover:bg-muted"
                    )}
                  >
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Password (optional)</Label>
              <Input
                type="password"
                placeholder="Leave empty for no password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <Button onClick={handleCreate} className="w-full">Create Folder</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent className="sm:max-w-[360px] rounded-xl">
          <DialogHeader>
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10">
              <Lock className="h-6 w-6 text-amber-600" />
            </div>
            <DialogTitle className="text-center">Locked Folder</DialogTitle>
            <DialogDescription className="text-center">
              Enter password to access this folder
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handlePasswordSubmit} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Password</Label>
              <Input
                type="password"
                placeholder="Enter folder password"
                value={passwordInput}
                onChange={(e) => { setPasswordInput(e.target.value); setPasswordError(false); }}
                className={cn(passwordError && "ring-2 ring-destructive")}
                autoFocus
              />
              {passwordError && <p className="text-xs text-destructive">Incorrect password</p>}
            </div>
            <Button type="submit" className="w-full">Unlock</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
