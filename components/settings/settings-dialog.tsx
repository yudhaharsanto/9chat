"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSettings } from "@/components/providers/settings-provider";
import { useChatContext } from "@/components/providers/chat-provider";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Server, Cpu, CheckCircle2, XCircle, Loader2, Eye, EyeOff, Settings } from "lucide-react";
import type { ModelInfo } from "@/lib/types";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { settings, updateSettings } = useSettings();
  const { loadConversations } = useChatContext();
  const [testing, setTesting] = useState(false);
  const [testOk, setTestOk] = useState<boolean | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [showApiKey, setShowApiKey] = useState(false);
  const [form, setForm] = useState({ routerUrl: settings.routerUrl, routerApiKey: settings.routerApiKey });

  const handleTest = async () => {
    setTesting(true);
    try {
      const res = await fetch("/api/models", { headers: { "x-router-url": form.routerUrl, "x-router-key": form.routerApiKey } });
      const data = await res.json();
      if (res.ok && data.data) { setTestOk(true); setModels(data.data); toast.success(`Connected! ${data.data.length} models`); }
      else { setTestOk(false); toast.error(data.error || "Failed"); }
    } catch { setTestOk(false); toast.error("Connection failed"); }
    finally { setTesting(false); }
  };

  const handleSave = () => {
    updateSettings(form);
    loadConversations();
    toast.success("Settings saved!");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] rounded-xl">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
            <Settings className="h-6 w-6 text-slate-600 dark:text-slate-400" />
          </div>
          <DialogTitle className="text-center">Settings</DialogTitle>
          <DialogDescription className="text-center">Configure 9router connection</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 px-3 py-2">
            <p className="text-xs text-green-700 dark:text-green-400">✓ Supabase connected via environment variables</p>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">9router URL</Label>
            <Input placeholder="http://103.58.111.187:20128" value={form.routerUrl} onChange={(e) => setForm((f) => ({ ...f, routerUrl: e.target.value }))} className="rounded-lg h-9 text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">API Key</Label>
            <div className="relative">
              <Input type={showApiKey ? "text" : "password"} placeholder="Your API key" value={form.routerApiKey} onChange={(e) => setForm((f) => ({ ...f, routerApiKey: e.target.value }))} className="rounded-lg h-9 text-sm pr-9" />
              <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6" onClick={() => setShowApiKey(!showApiKey)}>
                {showApiKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
          <Button onClick={handleTest} disabled={testing} variant="outline" className="rounded-lg h-9 text-xs w-full">
            {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : testOk === true ? <CheckCircle2 className="h-3.5 w-3.5 text-green-600 mr-1.5" /> : testOk === false ? <XCircle className="h-3.5 w-3.5 text-red-500 mr-1.5" /> : null}
            Test Connection
          </Button>

          {models.length > 0 && (
            <div className="max-h-[200px] space-y-1 overflow-y-auto rounded-lg border p-2">
              {models.map((m) => (
                <div key={m.id} className="flex items-center justify-between rounded px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-900">
                  <span className="font-mono text-xs truncate">{m.id}</span>
                  {m.supports_vision && <Badge variant="secondary" className="text-[10px]"><Eye className="h-2.5 w-2.5" /></Badge>}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-lg h-9 text-xs">Cancel</Button>
          <Button onClick={handleSave} className="rounded-lg h-9 text-xs">Save</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
