"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BookOpen, Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { KnowledgeSource } from "@/lib/types";

interface KnowledgeSelectorProps {
  knowledgeSources: KnowledgeSource[];
  selectedKnowledge: KnowledgeSource[];
  onToggleKnowledge: (k: KnowledgeSource) => void;
}

export function KnowledgeSelector({ knowledgeSources, selectedKnowledge, onToggleKnowledge }: KnowledgeSelectorProps) {
  const [open, setOpen] = useState(false);

  if (selectedKnowledge.length > 0) {
    return (
      <div className="flex items-center gap-1.5">
        {selectedKnowledge.map((k) => (
          <div key={k.id} className="flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2 py-0.5 text-[10px]">
            <BookOpen className="h-2.5 w-2.5 text-blue-600 dark:text-blue-400" />
            <span className="font-medium text-blue-700 dark:text-blue-400 max-w-[80px] truncate">{k.name}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-3.5 w-3.5 rounded-full ml-0 text-blue-600 hover:text-blue-800 hover:bg-blue-500/20"
              onClick={() => onToggleKnowledge(k)}
            >
              <X className="h-2.5 w-2.5" />
            </Button>
          </div>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger>
            <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full text-muted-foreground hover:text-foreground">
              <BookOpen className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[280px] p-0 rounded-xl" align="center">
            <KnowledgeList knowledgeSources={knowledgeSources} selectedIds={selectedKnowledge.map((k) => k.id)} onToggle={(k) => { onToggleKnowledge(k); }} />
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger>
        <Button
          variant="ghost"
          role="combobox"
          aria-expanded={open}
          className="h-8 gap-1.5 rounded-full border border-border/60 bg-card/50 px-2.5 text-xs font-medium text-muted-foreground backdrop-blur-sm transition-all hover:bg-card hover:shadow-sm hover:text-foreground"
        >
          <BookOpen className="h-3.5 w-3.5" />
          <span>Knowledge</span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0 rounded-xl" align="center">
        <KnowledgeList knowledgeSources={knowledgeSources} selectedIds={[]} onToggle={(k) => { onToggleKnowledge(k); setOpen(false); }} />
      </PopoverContent>
    </Popover>
  );
}

function KnowledgeList({ knowledgeSources, selectedIds, onToggle }: { knowledgeSources: KnowledgeSource[]; selectedIds: string[]; onToggle: (k: KnowledgeSource) => void }) {
  if (knowledgeSources.length === 0) {
    return (
      <div className="py-6 text-center">
        <BookOpen className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">No knowledge sources</p>
        <p className="text-[10px] text-muted-foreground/60 mt-1">Add in Admin → Knowledge</p>
      </div>
    );
  }

  return (
    <Command>
      <CommandInput placeholder="Search knowledge..." />
      <CommandList>
        <CommandEmpty>No knowledge found.</CommandEmpty>
        <CommandGroup>
          {knowledgeSources.map((k) => {
            const isSelected = selectedIds.includes(k.id);
            return (
              <CommandItem
                key={k.id}
                value={k.name}
                onSelect={() => onToggle(k)}
                className="flex items-center gap-2 rounded-lg"
              >
                <div className={cn("flex h-4 w-4 items-center justify-center rounded border", isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/30")}>
                  {isSelected && <Check className="h-3 w-3" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium">{k.name}</span>
                  <p className="text-[10px] text-muted-foreground truncate">{k.description || `${k.content.length} chars`}</p>
                </div>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}
