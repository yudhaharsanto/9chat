"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, ArrowDownToLine, ArrowUpFromLine, RotateCcw, Save, BarChart3, Clock } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/components/providers/settings-provider";
import type { User } from "@/lib/types";

interface TokenUsageDialogProps {
  open: boolean;
  onClose: () => void;
  user: User;
  onUpdated: () => void;
}

interface UsageData {
  user: {
    token_input_used: number;
    token_output_used: number;
    token_limit: number | null;
  };
  byModel: Record<string, { input: number; output: number; count: number }>;
  recentLogs: Array<{
    model: string;
    input_tokens: number;
    output_tokens: number;
    created_at: string;
  }>;
}

export function TokenUsageDialog({ open, onClose, user, onUpdated }: TokenUsageDialogProps) {
  const { modelAliases } = useSettings();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<UsageData | null>(null);
  const [limitInput, setLimitInput] = useState("");
  const [saving, setSaving] = useState(false);

  const getDisplayName = (modelId: string): string => {
    if (modelAliases[modelId]) return modelAliases[modelId];
    const parts = modelId.split("/");
    return parts[parts.length - 1] || modelId;
  };

  const formatNumber = (val: string): string => {
    const raw = val.replace(/[^0-9]/g, "");
    if (!raw) return "";
    return raw.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  };

  useEffect(() => {
    if (open) {
      setLoading(true);
      setLimitInput(user.token_limit ? formatNumber(String(user.token_limit)) : "");
      fetch(`/api/token-usage?userId=${user.id}`)
        .then((r) => r.json())
        .then((d) => { setData(d); setLoading(false); })
        .catch(() => setLoading(false));
    }
  }, [open, user.id, user.token_limit]);

  const handleSaveLimit = async () => {
    setSaving(true);
    const limit = limitInput.trim() === "" ? null : parseFloat(limitInput.replace(/\./g, ""));
    if (limitInput.trim() !== "" && (isNaN(limit as number) || (limit as number) < 0)) {
      toast.error("Invalid limit number");
      setSaving(false);
      return;
    }
    const res = await fetch("/api/token-usage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, tokenLimit: limit }),
    });
    if (res.ok) {
      toast.success("Token limit updated");
      onUpdated();
    } else toast.error("Failed to update");
    setSaving(false);
  };

  const handleResetUsage = async () => {
    setSaving(true);
    const res = await fetch("/api/token-usage", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: user.id, resetUsage: true }),
    });
    if (res.ok) {
      toast.success("Token usage reset");
      onUpdated();
      const refreshed = await fetch(`/api/token-usage?userId=${user.id}`).then((r) => r.json());
      setData(refreshed);
    } else toast.error("Failed to reset");
    setSaving(false);
  };

  const inputUsed = data?.user.token_input_used ?? user.token_input_used ?? 0;
  const outputUsed = data?.user.token_output_used ?? user.token_output_used ?? 0;
  const totalUsed = inputUsed + outputUsed;
  const limit = data?.user.token_limit ?? user.token_limit;
  const usagePercent = limit ? Math.min(100, (totalUsed / limit) * 100) : null;

  // Sorted model entries for the chart
  const modelEntries = data?.byModel
    ? Object.entries(data.byModel)
        .sort(([, a], [, b]) => (b.input + b.output) - (a.input + a.output))
    : [];
  const maxModelTokens = modelEntries.length > 0
    ? modelEntries[0][1].input + modelEntries[0][1].output
    : 0;

  // Color palette for models
  const modelColors = [
    "bg-blue-500", "bg-green-500", "bg-amber-500", "bg-purple-500",
    "bg-pink-500", "bg-cyan-500", "bg-orange-500", "bg-teal-500",
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Token Usage — {user.display_name}
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-5">
            {/* Summary Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border bg-card p-3 text-center">
                <ArrowDownToLine className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                <p className="text-lg font-bold">{inputUsed.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Input Tokens</p>
              </div>
              <div className="rounded-lg border bg-card p-3 text-center">
                <ArrowUpFromLine className="h-4 w-4 text-green-500 mx-auto mb-1" />
                <p className="text-lg font-bold">{outputUsed.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Output Tokens</p>
              </div>
              <div className="rounded-lg border bg-card p-3 text-center">
                <Zap className="h-4 w-4 text-amber-500 mx-auto mb-1" />
                <p className="text-lg font-bold">{totalUsed.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground">Total</p>
              </div>
            </div>

            {/* Limit Bar */}
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Token Limit</Label>
                {limit != null && (
                  <span className="text-xs text-muted-foreground">
                    {totalUsed.toLocaleString()} / {limit.toLocaleString()} ({usagePercent?.toFixed(1)}%)
                  </span>
                )}
              </div>
              {limit != null && (
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${usagePercent && usagePercent > 90 ? "bg-destructive" : usagePercent && usagePercent > 70 ? "bg-amber-500" : "bg-primary"}`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Contoh: 10.000"
                  value={limitInput}
                  onChange={(e) => setLimitInput(formatNumber(e.target.value))}
                  className="h-8 text-xs"
                />
                <Button size="sm" className="h-8 text-xs gap-1" onClick={handleSaveLimit} disabled={saving}>
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Save
                </Button>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1" onClick={handleResetUsage} disabled={saving}>
                  <RotateCcw className="h-3 w-3" />
                  Reset
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Kosongkan untuk unlimited. Titik sebagai pemisah ribuan. Set 0 untuk blokir.</p>
            </div>

            {/* Per-Model Breakdown */}
            {modelEntries.length > 0 && (
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-xs font-medium">Penggunaan per Model</Label>
                  <Badge variant="secondary" className="text-[9px] ml-auto">{modelEntries.length} model</Badge>
                </div>
                <div className="space-y-2.5">
                  {modelEntries.map(([model, stats], i) => {
                    const total = stats.input + stats.output;
                    const barWidth = maxModelTokens > 0 ? (total / maxModelTokens) * 100 : 0;
                    const color = modelColors[i % modelColors.length];
                    const displayName = getDisplayName(model);
                    return (
                      <div key={model} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`h-2.5 w-2.5 rounded-full ${color} flex-shrink-0`} />
                            <span className="font-medium truncate">{displayName}</span>
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-muted-foreground">{stats.count}x</Badge>
                          </div>
                          <div className="flex items-center gap-3 text-muted-foreground tabular-nums">
                            <span className="text-blue-500 text-[10px]">↓{stats.input.toLocaleString()}</span>
                            <span className="text-green-500 text-[10px]">↑{stats.output.toLocaleString()}</span>
                            <span className="font-medium text-foreground text-[10px]">{total.toLocaleString()}</span>
                          </div>
                        </div>
                        <div className="flex gap-1 h-1.5 rounded-full overflow-hidden bg-muted">
                          <div
                            className={`h-full rounded-full ${color} opacity-80`}
                            style={{ width: `${(stats.input / total) * barWidth}%` }}
                            title={`Input: ${stats.input.toLocaleString()}`}
                          />
                          <div
                            className={`h-full rounded-full ${color} opacity-50`}
                            style={{ width: `${(stats.output / total) * barWidth}%` }}
                            title={`Output: ${stats.output.toLocaleString()}`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex items-center gap-4 text-[9px] text-muted-foreground pt-1 border-t">
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-foreground/30 opacity-80" /> Input</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-2 rounded-full bg-foreground/30 opacity-40" /> Output</span>
                </div>
              </div>
            )}

            {/* Recent Logs */}
            {data?.recentLogs && data.recentLogs.length > 0 && (
              <div className="rounded-xl border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-xs font-medium">Riwayat Request Terakhir</Label>
                  <Badge variant="secondary" className="text-[9px] ml-auto">{data.recentLogs.length}</Badge>
                </div>
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {data.recentLogs.map((log, i) => {
                    const name = getDisplayName(log.model);
                    const total = log.input_tokens + log.output_tokens;
                    return (
                      <div key={i} className="flex items-center justify-between rounded-lg px-3 py-1.5 text-[10px] text-muted-foreground hover:bg-muted/50 transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-foreground truncate max-w-[140px]">{name}</span>
                          <span className="text-muted-foreground/60">{total.toLocaleString()} tok</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-blue-500">↓{log.input_tokens.toLocaleString()}</span>
                          <span className="text-green-500">↑{log.output_tokens.toLocaleString()}</span>
                          <span className="text-muted-foreground/60">{new Date(log.created_at).toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Empty state */}
            {!loading && modelEntries.length === 0 && (!data?.recentLogs || data.recentLogs.length === 0) && (
              <div className="text-center py-8 text-muted-foreground text-xs">
                Belum ada data penggunaan token
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
