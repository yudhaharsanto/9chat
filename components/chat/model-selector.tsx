"use client";

import { useState, useEffect } from "react";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronsUpDown, Eye, Loader2, Cpu, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSettings } from "@/components/providers/settings-provider";
import { useAuth } from "@/components/providers/auth-provider";
import type { ModelInfo } from "@/lib/types";

interface ModelSelectorProps {
  selectedModel: string;
  onSelectModel: (model: string) => void;
}

export function ModelSelector({ selectedModel, onSelectModel }: ModelSelectorProps) {
  const { settings, enabledModels, modelsFilterActive, modelAliases, modelImageSupport } = useSettings();
  const { currentUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [allModels, setAllModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchModels = async () => {
      if (!settings.routerUrl || !settings.routerApiKey) return;
      setLoading(true);
      try {
        const res = await fetch("/api/models", {
          headers: { "x-router-url": settings.routerUrl, "x-router-key": settings.routerApiKey },
        });
        const data = await res.json();
        if (res.ok && data.data) setAllModels(data.data);
        else setError(data.error || "Failed to load");
      } catch {
        setError("Connection failed");
      } finally {
        setLoading(false);
      }
    };
    fetchModels();
  }, [settings.routerUrl, settings.routerApiKey]);

  const getDisplayName = (modelId: string): string => {
    if (modelAliases[modelId]) return modelAliases[modelId];
    const parts = modelId.split("/");
    return parts[parts.length - 1] || modelId;
  };

  // Filter: admin enabled → user allowed
  const adminFiltered = modelsFilterActive
    ? allModels.filter((m) => enabledModels.includes(m.id))
    : allModels;
  const userAllowed = currentUser?.allowed_models;
  const models = (userAllowed && userAllowed.length > 0
    ? adminFiltered.filter((m) => userAllowed.includes(m.id))
    : adminFiltered
  ).sort((a, b) => getDisplayName(a.id).localeCompare(getDisplayName(b.id)));

  const filtered = search
    ? models.filter((m) => m.id.toLowerCase().includes(search.toLowerCase()) || getDisplayName(m.id).toLowerCase().includes(search.toLowerCase()))
    : models;

  const selected = models.find((m) => m.id === selectedModel);
  const defaultModel = currentUser?.default_model;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="inline-flex h-8 items-center gap-2 rounded-full border border-border/60 bg-card/50 px-3 text-xs font-medium backdrop-blur-sm transition-all hover:bg-card hover:shadow-sm cursor-pointer">
          <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="max-w-[200px] truncate">
            {loading ? "Loading..." : selected ? getDisplayName(selected.id) : error ? "Error" : "Select model"}
          </span>
          {selected && (modelImageSupport[selected.id] ?? false) && <Eye className="h-3 w-3 text-muted-foreground" />}
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" />
      </PopoverTrigger>
      <PopoverContent className="w-[380px] p-0 rounded-xl" align="center">
        <Command>
          <CommandInput placeholder="Search models..." onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-6">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading...</span>
                </div>
              ) : error ? (
                <div className="py-6 text-center text-sm text-destructive">{error}</div>
              ) : (
                "No models found."
              )}
            </CommandEmpty>
            <CommandGroup>
              {filtered.map((model) => {
                const isDefault = defaultModel === model.id;
                return (
                  <CommandItem
                    key={model.id}
                    value={model.id}
                    onSelect={(v) => { onSelectModel(v); setOpen(false); }}
                    className="flex items-center justify-between rounded-lg"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Check className={cn("h-4 w-4 flex-shrink-0", selectedModel === model.id ? "opacity-100" : "opacity-0")} />
                      <span className="truncate text-sm font-medium">{getDisplayName(model.id)}</span>
                      {isDefault && (
                        <Badge variant="secondary" className="rounded-full text-[9px] px-1.5 py-0 gap-0.5">
                          <Star className="h-2.5 w-2.5 fill-current" /> Default
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {(modelImageSupport[model.id] ?? false) && (
                        <Badge variant="secondary" className="rounded-sm text-[10px] px-1.5 py-0">
                          <Eye className="h-2.5 w-2.5" />
                        </Badge>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
