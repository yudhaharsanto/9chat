"use client";

import { useState, useEffect } from "react";
import { useSettings } from "@/components/providers/settings-provider";
import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Shield, Eye, Lock, Unlock, Loader2, CheckCircle2, XCircle,
  Server, Cpu, ArrowLeft, Search, Settings, Key,
  Users, Bot, Zap, BookOpen, Plus, Trash2, Pencil, Save, HardDrive,
} from "lucide-react";
import type { ModelInfo, User as UserType, Agent, Skill, KnowledgeSource } from "@/lib/types";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ModelMultiSelect } from "@/components/ui/model-multi-select";

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export default function AdminPage() {
  const s = useSettings();
  const { currentUser } = useAuth();

  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(false);
  const [loggingIn, setLoggingIn] = useState(false);
  const [form, setForm] = useState(s.settings);
  const [showApiKey, setShowApiKey] = useState(false);
  const [allModels, setAllModels] = useState<ModelInfo[]>([]);
  const [modelSearch, setModelSearch] = useState("");
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, boolean | null>>({});
  const [saving, setSaving] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [users, setUsers] = useState<UserType[]>([]);
  const [newUser, setNewUser] = useState({ username: "", password: "", display_name: "", avatar: "👤" });

  const [agents, setAgents] = useState<Agent[]>([]);
  const [editAgent, setEditAgent] = useState<Partial<Agent> | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [editSkill, setEditSkill] = useState<Partial<Skill> | null>(null);
  const [knowledge, setKnowledge] = useState<KnowledgeSource[]>([]);
  const [editKnowledge, setEditKnowledge] = useState<Partial<KnowledgeSource> | null>(null);

  useEffect(() => { setForm(s.settings); }, [s.settings]);
  useEffect(() => {
    if (s.isAdmin) {
      loadUsers(); loadAgentsList(); loadSkillsList(); loadKnowledgeList(); loadSavedModels();
    }
  }, [s.isAdmin]);

  const loadSavedModels = async () => {
    try {
      const { data } = await createClient().from("app_settings").select("value").eq("key", "available_models").single();
      if (data?.value && Array.isArray(data.value)) setAllModels(data.value);
    } catch {}
  };

  const loadUsers = async () => { const { data } = await createClient().from("users").select("*").order("created_at"); if (data) setUsers(data); };
  const loadAgentsList = async () => { const { data } = await createClient().from("agents").select("*").order("name"); if (data) setAgents(data); };
  const loadSkillsList = async () => { const { data } = await createClient().from("skills").select("*").order("category, name"); if (data) setSkills(data); };
  const loadKnowledgeList = async () => { const { data } = await createClient().from("knowledge_sources").select("*").order("name"); if (data) setKnowledge(data); };

  const handleSaveAll = async () => {
    setSaving(true);
    s.updateSettings({ routerUrl: form.routerUrl, routerApiKey: form.routerApiKey, imgbbApiKey: form.imgbbApiKey });
    const supabase = createClient();
    await supabase.from("app_settings").upsert([
      { key: "9router_url", value: form.routerUrl },
      { key: "9router_api_key", value: form.routerApiKey },
      { key: "imgbb_api_key", value: form.imgbbApiKey || "" },
    ], { onConflict: "key" });
    await s.loadFromSupabase();
    toast.success("Saved!"); setSaving(false);
  };

  const handleTest9router = async () => {
    setTesting("9router");
    try {
      const res = await fetch("/api/models", { headers: { "x-router-url": form.routerUrl, "x-router-key": form.routerApiKey } });
      const data = await res.json();
      if (res.ok && data.data) {
        setTestResults((p) => ({ ...p, "9router": true }));
        setAllModels(data.data);
        toast.success(`${data.data.length} models`);
        const supabase = createClient();
        await supabase.from("app_settings").upsert({ key: "available_models", value: data.data }, { onConflict: "key" });
      }
      else { setTestResults((p) => ({ ...p, "9router": false })); toast.error(data.error); }
    } catch { setTestResults((p) => ({ ...p, "9router": false })); }
    finally { setTesting(null); }
  };

  const toggleModel = (id: string) => s.setEnabledModels(s.enabledModels.includes(id) ? s.enabledModels.filter((m) => m !== id) : [...s.enabledModels, id]);
  const getDisplayName = (modelId: string): string => {
    if (s.modelAliases[modelId]) return s.modelAliases[modelId];
    const parts = modelId.split("/");
    return parts[parts.length - 1] || modelId;
  };
  const filteredModels = modelSearch ? allModels.filter((m) => m.id.toLowerCase().includes(modelSearch.toLowerCase()) || getDisplayName(m.id).toLowerCase().includes(modelSearch.toLowerCase())) : allModels;
  const enabledModelsOnly = allModels.filter((m) => !s.modelsFilterActive || s.enabledModels.includes(m.id));

  const handleCreateUser = async () => {
    if (!newUser.username || !newUser.password || !newUser.display_name) { toast.error("Fill all fields"); return; }
    const { password: _pw, ...userData } = newUser;
    const { error } = await createClient().from("users").insert({ ...userData, password_hash: await sha256(newUser.password) });
    if (error) { toast.error(error.message); return; }
    toast.success("User created!"); setNewUser({ username: "", password: "", display_name: "", avatar: "👤" }); loadUsers();
  };

  const handleSaveAgent = async () => {
    if (!editAgent?.name) return;
    const supabase = createClient();
    if (editAgent.id) await supabase.from("agents").update(editAgent).eq("id", editAgent.id);
    else await supabase.from("agents").insert({ ...editAgent, user_id: currentUser?.id });
    toast.success("Saved!"); setEditAgent(null); loadAgentsList();
  };

  const handleSaveSkill = async () => {
    if (!editSkill?.name || !editSkill?.prompt_template) return;
    const supabase = createClient();
    if (editSkill.id) await supabase.from("skills").update(editSkill).eq("id", editSkill.id);
    else await supabase.from("skills").insert(editSkill);
    toast.success("Saved!"); setEditSkill(null); loadSkillsList();
  };

  const handleSaveKnowledge = async () => {
    if (!editKnowledge?.name || !editKnowledge?.content) return;
    const supabase = createClient();
    if (editKnowledge.id) await supabase.from("knowledge_sources").update(editKnowledge).eq("id", editKnowledge.id);
    else await supabase.from("knowledge_sources").insert({ ...editKnowledge, user_id: currentUser?.id });
    toast.success("Saved!"); setEditKnowledge(null); loadKnowledgeList();
  };

  if (!s.isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10"><Shield className="h-8 w-8 text-primary" /></div>
            <h1 className="text-2xl font-semibold">Admin Panel</h1><p className="text-sm text-muted-foreground">Manage 9Chat</p>
          </div>
          <form onSubmit={async (e) => {
            e.preventDefault();
            setLoggingIn(true); setLoginError(false);
            if (!(await s.adminLogin(password))) { setLoginError(true); toast.error("Wrong password"); }
            setLoggingIn(false); setPassword("");
          }} className="space-y-3">
            <div className="space-y-2">
              <Label>Admin Password</Label>
              <Input type="password" placeholder="Password" value={password} onChange={(e) => { setPassword(e.target.value); setLoginError(false); }} className={loginError ? "ring-2 ring-destructive" : ""} autoFocus />
              {loginError && <p className="text-xs text-destructive">Incorrect</p>}
              <p className="text-[10px] text-muted-foreground">Default: admin</p>
            </div>
            <Button type="submit" className="w-full" disabled={loggingIn}>{loggingIn ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Unlock className="h-4 w-4 mr-2" />}Sign In</Button>
          </form>
          <div className="text-center"><Link href="/" className="text-xs text-muted-foreground hover:text-foreground">← Back</Link></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-3 md:px-4">
          <div className="flex items-center gap-2 md:gap-3">
            <Link href="/"><Button variant="ghost" size="icon" className="h-8 w-8"><ArrowLeft className="h-4 w-4" /></Button></Link>
            <Settings className="h-5 w-5 text-primary" /><h1 className="text-base md:text-lg font-semibold">Admin</h1>
          </div>
          <Button variant="outline" size="sm" onClick={s.adminLogout}><Lock className="h-3.5 w-3.5 mr-1.5" />Lock</Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 md:px-4 py-4 md:py-6 w-full">
        <Tabs defaultValue="connection" className="space-y-6">
          <TabsList className="h-10 flex-wrap">
            <TabsTrigger value="connection" className="gap-1.5 text-xs"><Server className="h-3.5 w-3.5" />Connection</TabsTrigger>
            <TabsTrigger value="models" className="gap-1.5 text-xs"><Cpu className="h-3.5 w-3.5" />Models</TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" />Users</TabsTrigger>
            <TabsTrigger value="agents" className="gap-1.5 text-xs"><Bot className="h-3.5 w-3.5" />Agents</TabsTrigger>
            <TabsTrigger value="skills" className="gap-1.5 text-xs"><Zap className="h-3.5 w-3.5" />Skills</TabsTrigger>
            <TabsTrigger value="knowledge" className="gap-1.5 text-xs"><BookOpen className="h-3.5 w-3.5" />Knowledge</TabsTrigger>
            <TabsTrigger value="security" className="gap-1.5 text-xs"><Key className="h-3.5 w-3.5" />Security</TabsTrigger>
          </TabsList>

          <TabsContent value="connection" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10"><Server className="h-4 w-4 text-primary" /></div><div><h3 className="text-sm font-semibold">9router</h3><p className="text-xs text-muted-foreground">AI Gateway</p></div></div>
                <div className="space-y-3">
                  <div className="space-y-1.5"><Label className="text-xs">URL</Label><Input value={form.routerUrl} onChange={(e) => setForm((f) => ({ ...f, routerUrl: e.target.value }))} className="h-9 text-sm" /></div>
                  <div className="space-y-1.5"><Label className="text-xs">API Key</Label><div className="relative"><Input type={showApiKey ? "text" : "password"} value={form.routerApiKey} onChange={(e) => setForm((f) => ({ ...f, routerApiKey: e.target.value }))} className="h-9 text-sm pr-9" /><Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6" onClick={() => setShowApiKey(!showApiKey)}><Eye className="h-3.5 w-3.5" /></Button></div></div>
                  <Button onClick={handleTest9router} disabled={testing === "9router"} variant="outline" size="sm" className="w-full">
                    {testing === "9router" ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : testResults["9router"] === true ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mr-1.5" /> : testResults["9router"] === false ? <XCircle className="h-3.5 w-3.5 text-destructive mr-1.5" /> : null}Test
                  </Button>
                </div>
              </div>
              {/* Database — auto-detected from env */}
              <div className="rounded-xl border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-green-500/10"><CheckCircle2 className="h-4 w-4 text-green-600" /></div>
                  <div>
                    <h3 className="text-sm font-semibold">Database</h3>
                    <p className="text-xs text-green-600">
                      {process.env.NEXT_PUBLIC_DATABASE_URL ? "PostgreSQL (standalone)" : "Supabase"} via .env.local
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-green-500/20 bg-green-500/5 px-3 py-2">
                  <p className="text-[10px] text-muted-foreground">
                    {process.env.NEXT_PUBLIC_DATABASE_URL
                      ? "Using standalone PostgreSQL via DATABASE_URL."
                      : "Using Supabase via NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY."
                    } Switch by changing environment variables.
                  </p>
                </div>
              </div>
            </div>

            {/* ImgBB */}
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10"><HardDrive className="h-4 w-4 text-blue-600" /></div>
                <div>
                  <h3 className="text-sm font-semibold">Image Upload</h3>
                  <p className="text-xs text-muted-foreground">ImgBB — free, simple, no OAuth</p>
                </div>
                {form.imgbbApiKey ? (
                  <Badge variant="secondary" className="ml-auto gap-1 text-green-600"><CheckCircle2 className="h-3 w-3" /> ImgBB</Badge>
                ) : (
                  <Badge variant="outline" className="ml-auto text-muted-foreground">Not set</Badge>
                )}
              </div>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">ImgBB API Key <span className="text-muted-foreground">(recommended, free)</span></Label>
                  <Input
                    type="password"
                    placeholder="Get from imgbb.com/api"
                    value={form.imgbbApiKey || ""}
                    onChange={(e) => setForm((f) => ({ ...f, imgbbApiKey: e.target.value }))}
                    className="h-9 text-sm"
                  />
                  <p className="mt-1 text-[10px] text-muted-foreground">imgbb.com → API → Get API key (free, 32MB/image)</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end"><Button onClick={handleSaveAll} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Save All</Button></div>
          </TabsContent>

          <TabsContent value="models" className="space-y-4">
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <div className="flex items-center justify-between"><div><h3 className="text-sm font-semibold">Models</h3><p className="text-xs text-muted-foreground">Toggle visibility + set aliases</p></div><Badge variant="secondary" className="text-xs">{s.modelsFilterActive ? `${s.enabledModels.length}/${allModels.length}` : `All ${allModels.length}`}</Badge></div>
              <div className="flex items-center gap-2">
                <div className="relative flex-1"><Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" /><Input placeholder="Search..." value={modelSearch} onChange={(e) => setModelSearch(e.target.value)} className="h-8 pl-8 text-xs" /></div>
                <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => s.setEnabledModels(allModels.map((m) => m.id))}>All</Button>
                <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => s.setEnabledModels([])}>None</Button>
                {!allModels.length && <Button variant="outline" size="sm" className="text-xs h-8" onClick={handleTest9router}>Load</Button>}
              </div>
              {allModels.length > 0 ? (
                <div className="max-h-[500px] space-y-1 overflow-y-auto pr-1">
                  {filteredModels.map((m) => {
                    const on = !s.modelsFilterActive || s.enabledModels.includes(m.id);
                    return (
                      <div key={m.id} className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${on ? "" : "opacity-40"}`}>
                        <Switch checked={on} onCheckedChange={() => toggleModel(m.id)} />
                        <div className="flex-1 min-w-0">
                          <Input className="h-6 text-xs border-0 bg-transparent p-0 focus-visible:ring-0 font-medium" value={s.modelAliases[m.id] || ""} placeholder={getDisplayName(m.id)} onChange={(e) => s.setModelAliases({ ...s.modelAliases, [m.id]: e.target.value })} />
                          <p className="text-[10px] text-muted-foreground truncate">{m.id}</p>
                        </div>
                        {m.supports_vision && <Badge variant="secondary" className="text-[10px]"><Eye className="h-2.5 w-2.5" /></Badge>}
                      </div>
                    );
                  })}
                </div>
              ) : <div className="py-12 text-center"><Cpu className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" /><p className="text-sm text-muted-foreground">Load models first</p></div>}
            </div>
            <div className="flex justify-end"><Button onClick={handleSaveAll}>Save</Button></div>
          </TabsContent>

          <TabsContent value="users" className="space-y-4">
            <div className="rounded-xl border bg-card p-5 space-y-4">
              <h3 className="text-sm font-semibold">Create User</h3>
              <div className="grid gap-3 sm:grid-cols-4">
                <Input placeholder="Username" value={newUser.username} onChange={(e) => setNewUser((u) => ({ ...u, username: e.target.value }))} className="h-9 text-sm" />
                <Input type="password" placeholder="Password" value={newUser.password} onChange={(e) => setNewUser((u) => ({ ...u, password: e.target.value }))} className="h-9 text-sm" />
                <Input placeholder="Display Name" value={newUser.display_name} onChange={(e) => setNewUser((u) => ({ ...u, display_name: e.target.value }))} className="h-9 text-sm" />
                <Button onClick={handleCreateUser} className="gap-1.5"><Plus className="h-4 w-4" />Create</Button>
              </div>
            </div>
            <div className="rounded-xl border bg-card p-5 space-y-3">
              <h3 className="text-sm font-semibold">Users</h3>
              {users.map((u) => (
                <div key={u.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{u.avatar}</span>
                      <div>
                        <p className="text-sm font-medium">{u.display_name} {u.role === "admin" && <Badge variant="secondary" className="text-[10px] ml-1">admin</Badge>}</p>
                        <p className="text-[10px] text-muted-foreground">@{u.username}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={u.is_active} onCheckedChange={(v) => createClient().from("users").update({ is_active: v }).eq("id", u.id).then(loadUsers)} />
                      {u.role !== "admin" && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => createClient().from("users").delete().eq("id", u.id).then(() => { toast.success("Deleted"); loadUsers(); })}><Trash2 className="h-3.5 w-3.5" /></Button>}
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Default Model</Label>
                      <Select value={u.default_model || "__none__"} onValueChange={async (v) => {
                        if (!v) return;
                        await createClient().from("users").update({ default_model: v === "__none__" ? null : v }).eq("id", u.id);
                        toast.success("Default model updated"); loadUsers();
                      }}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="No default">{u.default_model ? getDisplayName(u.default_model) : "No default"}</SelectValue></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No default</SelectItem>
                          {enabledModelsOnly.map((m) => <SelectItem key={m.id} value={m.id}>{getDisplayName(m.id)}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Allowed Models <span className="text-muted-foreground/50">(empty = all)</span></Label>
                      <ModelMultiSelect
                        options={enabledModelsOnly.map((m) => ({ id: m.id, label: getDisplayName(m.id) }))}
                        selected={u.allowed_models || []}
                        onChange={async (models) => {
                          await createClient().from("users").update({ allowed_models: models.length ? models : null }).eq("id", u.id);
                          toast.success("Allowed models updated"); loadUsers();
                        }}
                        placeholder="All enabled models"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="agents" className="space-y-4">
            <div className="flex justify-between items-center"><h3 className="text-sm font-semibold">AI Agents</h3><Button size="sm" onClick={() => setEditAgent({ name: "", description: "", icon: "🤖", system_prompt: "", model: "gpt-4o", temperature: 0.7, max_tokens: 4096, is_public: true })}><Plus className="h-4 w-4 mr-1" />New</Button></div>
            {editAgent && <div className="rounded-xl border bg-card p-5 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label className="text-xs">Name</Label><Input value={editAgent.name || ""} onChange={(e) => setEditAgent((a) => ({ ...a, name: e.target.value }))} className="h-9 text-sm" /></div>
                <div className="space-y-1.5"><Label className="text-xs">Icon</Label><Input value={editAgent.icon || ""} onChange={(e) => setEditAgent((a) => ({ ...a, icon: e.target.value }))} className="h-9 text-sm" /></div>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Description</Label><Input value={editAgent.description || ""} onChange={(e) => setEditAgent((a) => ({ ...a, description: e.target.value }))} className="h-9 text-sm" /></div>
              <div className="space-y-1.5"><Label className="text-xs">System Prompt</Label><textarea className="w-full rounded-lg border bg-background p-3 text-xs font-mono h-28 resize-none" value={editAgent.system_prompt || ""} onChange={(e) => setEditAgent((a) => ({ ...a, system_prompt: e.target.value }))} /></div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label className="text-xs">Model</Label>
                  <Select value={editAgent.model || ""} onValueChange={(v) => { if (!v) return; setEditAgent((a) => ({ ...a, model: v })); }}>
                    <SelectTrigger className="w-full h-9"><SelectValue placeholder="Select model...">{editAgent.model ? getDisplayName(editAgent.model) : "Select model..."}</SelectValue></SelectTrigger>
                    <SelectContent>
                      {enabledModelsOnly.map((m) => <SelectItem key={m.id} value={m.id}>{getDisplayName(m.id)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {editAgent.model && <p className="text-[10px] text-muted-foreground">{editAgent.model}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Temperature <span className="text-muted-foreground">({editAgent.temperature || 0.7})</span></Label>
                  <input type="range" min="0" max="2" step="0.1" value={editAgent.temperature || 0.7} onChange={(e) => setEditAgent((a) => ({ ...a, temperature: parseFloat(e.target.value) }))} className="w-full accent-primary" />
                  <p className="text-[10px] text-muted-foreground">0 = factual · 0.7 = balanced · 1.5 = creative</p>
                </div>
                <div className="flex items-end gap-2"><Switch checked={editAgent.is_public || false} onCheckedChange={(v) => setEditAgent((a) => ({ ...a, is_public: v }))} /><Label className="text-xs">Public</Label></div>
              </div>
              <div className="flex gap-2"><Button onClick={handleSaveAgent} size="sm"><Save className="h-3.5 w-3.5 mr-1" />Save</Button><Button variant="outline" size="sm" onClick={() => setEditAgent(null)}>Cancel</Button></div>
            </div>}
            <div className="space-y-2">{agents.map((a) => <div key={a.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div className="flex items-center gap-3"><span className="text-lg">{a.icon}</span><div><p className="text-sm font-medium">{a.name}</p><p className="text-[10px] text-muted-foreground">{a.description}</p></div></div>
              <div className="flex items-center gap-2">{a.is_public && <Badge variant="secondary" className="text-[10px]">Public</Badge>}<Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditAgent(a)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => createClient().from("agents").delete().eq("id", a.id).then(() => { toast.success("Deleted"); loadAgentsList(); })}><Trash2 className="h-3.5 w-3.5" /></Button></div>
            </div>)}</div>
          </TabsContent>

          <TabsContent value="skills" className="space-y-4">
            <div className="flex justify-between items-center"><h3 className="text-sm font-semibold">Skills</h3><Button size="sm" onClick={() => setEditSkill({ name: "", description: "", icon: "⚡", prompt_template: "", category: "general" })}><Plus className="h-4 w-4 mr-1" />New</Button></div>
            {editSkill && <div className="rounded-xl border bg-card p-5 space-y-3">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5"><Label className="text-xs">Name</Label><Input value={editSkill.name || ""} onChange={(e) => setEditSkill((s) => ({ ...s, name: e.target.value }))} className="h-9 text-sm" /></div>
                <div className="space-y-1.5"><Label className="text-xs">Icon</Label><Input value={editSkill.icon || ""} onChange={(e) => setEditSkill((s) => ({ ...s, icon: e.target.value }))} className="h-9 text-sm" /></div>
                <div className="space-y-1.5"><Label className="text-xs">Category</Label><Input value={editSkill.category || ""} onChange={(e) => setEditSkill((s) => ({ ...s, category: e.target.value }))} className="h-9 text-sm" /></div>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Description</Label><Input value={editSkill.description || ""} onChange={(e) => setEditSkill((s) => ({ ...s, description: e.target.value }))} className="h-9 text-sm" /></div>
              <div className="space-y-1.5"><Label className="text-xs">Prompt Template</Label><textarea className="w-full rounded-lg border bg-background p-3 text-xs font-mono h-28 resize-none" value={editSkill.prompt_template || ""} onChange={(e) => setEditSkill((s) => ({ ...s, prompt_template: e.target.value }))} /></div>
              <div className="flex gap-2"><Button onClick={handleSaveSkill} size="sm"><Save className="h-3.5 w-3.5 mr-1" />Save</Button><Button variant="outline" size="sm" onClick={() => setEditSkill(null)}>Cancel</Button></div>
            </div>}
            <div className="space-y-2">{skills.map((sk) => <div key={sk.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div className="flex items-center gap-3"><span>{sk.icon}</span><div><p className="text-sm font-medium">{sk.name}</p><p className="text-[10px] text-muted-foreground">{sk.description}</p></div><Badge variant="outline" className="text-[10px]">{sk.category}</Badge></div>
              <div className="flex items-center gap-2"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditSkill(sk)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => createClient().from("skills").delete().eq("id", sk.id).then(() => { toast.success("Deleted"); loadSkillsList(); })}><Trash2 className="h-3.5 w-3.5" /></Button></div>
            </div>)}</div>
          </TabsContent>

          <TabsContent value="knowledge" className="space-y-4">
            <div className="flex justify-between items-center"><h3 className="text-sm font-semibold">Knowledge Sources</h3><Button size="sm" onClick={() => setEditKnowledge({ name: "", description: "", content: "" })}><Plus className="h-4 w-4 mr-1" />New</Button></div>
            {editKnowledge && <div className="rounded-xl border bg-card p-5 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5"><Label className="text-xs">Name</Label><Input value={editKnowledge.name || ""} onChange={(e) => setEditKnowledge((k) => ({ ...k, name: e.target.value }))} className="h-9 text-sm" /></div>
                <div className="space-y-1.5"><Label className="text-xs">Description</Label><Input value={editKnowledge.description || ""} onChange={(e) => setEditKnowledge((k) => ({ ...k, description: e.target.value }))} className="h-9 text-sm" /></div>
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Content</Label><textarea className="w-full rounded-lg border bg-background p-3 text-xs font-mono h-40 resize-none" value={editKnowledge.content || ""} onChange={(e) => setEditKnowledge((k) => ({ ...k, content: e.target.value }))} placeholder="Paste knowledge content..." /></div>
              <div className="flex gap-2"><Button onClick={handleSaveKnowledge} size="sm"><Save className="h-3.5 w-3.5 mr-1" />Save</Button><Button variant="outline" size="sm" onClick={() => setEditKnowledge(null)}>Cancel</Button></div>
            </div>}
            <div className="space-y-2">{knowledge.map((k) => <div key={k.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
              <div><p className="text-sm font-medium">{k.name}</p><p className="text-[10px] text-muted-foreground">{k.description} · {k.content.length} chars</p></div>
              <div className="flex items-center gap-2"><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditKnowledge(k)}><Pencil className="h-3.5 w-3.5" /></Button><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => createClient().from("knowledge_sources").delete().eq("id", k.id).then(() => { toast.success("Deleted"); loadKnowledgeList(); })}><Trash2 className="h-3.5 w-3.5" /></Button></div>
            </div>)}</div>
          </TabsContent>

          <TabsContent value="security" className="space-y-4">
            <div className="rounded-xl border bg-card p-5 space-y-4 max-w-md">
              <div className="flex items-center gap-2"><Key className="h-5 w-5 text-amber-600" /><h3 className="text-sm font-semibold">Admin Password</h3></div>
              <div className="space-y-3">
                <Input type="password" placeholder="New password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="h-9 text-sm" />
                <Input type="password" placeholder="Confirm" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className="h-9 text-sm" />
                <Button size="sm" onClick={async () => { if (newPassword !== confirmPw) { toast.error("Mismatch"); return; } if (await s.changeAdminPassword(newPassword)) { toast.success("Changed!"); setNewPassword(""); setConfirmPw(""); } }}>Update</Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}