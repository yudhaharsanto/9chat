"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModelMultiSelectProps {
  options: { id: string; label: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}

export function ModelMultiSelect({ options, selected, onChange, placeholder = "Select models...", disabled }: ModelMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()) || o.id.toLowerCase().includes(search.toLowerCase()))
    : options;

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  };

  const remove = (id: string) => {
    onChange(selected.filter((s) => s !== id));
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className="w-full min-h-[36px] h-auto justify-between rounded-lg bg-background px-3 py-1.5 text-xs font-normal"
        >
          <div className="flex flex-wrap gap-1 flex-1 text-left">
            {selected.length === 0 && <span className="text-muted-foreground">{placeholder}</span>}
            {selected.length > 0 && selected.length <= 3 && selected.map((id) => {
              const opt = options.find((o) => o.id === id);
              return (
                <Badge key={id} variant="secondary" className="text-[10px] gap-0.5 px-1.5 py-0">
                  {opt?.label || id}
                  <button className="ml-0.5 hover:text-destructive" onClick={(e) => { e.stopPropagation(); remove(id); }}>
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              );
            })}
            {selected.length > 3 && (
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{selected.length} selected</Badge>
            )}
          </div>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-40 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0 rounded-xl" align="start">
        <div className="p-2 border-b">
          <input
            type="text"
            placeholder="Search models..."
            className="w-full h-7 rounded-md border bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="max-h-[250px] overflow-y-auto p-1">
          {filtered.length === 0 && (
            <p className="py-4 text-center text-xs text-muted-foreground">No models found</p>
          )}
          {filtered.map((opt) => {
            const isSelected = selected.includes(opt.id);
            return (
              <button
                key={opt.id}
                onClick={() => toggle(opt.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-accent",
                  isSelected && "bg-accent/50"
                )}
              >
                <div className={cn("flex h-4 w-4 items-center justify-center rounded border", isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30")}>
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
                <span className="truncate font-medium">{opt.label}</span>
              </button>
            );
          })}
        </div>
        {selected.length > 0 && (
          <div className="border-t p-2 flex justify-between items-center">
            <span className="text-[10px] text-muted-foreground">{selected.length} selected</span>
            <Button variant="ghost" size="sm" className="h-6 text-[10px] text-destructive" onClick={() => onChange([])}>Clear all</Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
