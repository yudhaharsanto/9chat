"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Zap, Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Skill } from "@/lib/types";

interface SkillSelectorProps {
  skills: Skill[];
  selectedSkill: Skill | null;
  onSelectSkill: (skill: Skill | null) => void;
}

export function SkillSelector({ skills, selectedSkill, onSelectSkill }: SkillSelectorProps) {
  const [open, setOpen] = useState(false);

  const grouped = skills.reduce<Record<string, Skill[]>>((acc, s) => {
    const cat = s.category || "general";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(s);
    return acc;
  }, {});

  if (selectedSkill) {
    return (
      <div className="flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs">
        <span>{selectedSkill.icon}</span>
        <span className="font-medium text-amber-700 dark:text-amber-400">{selectedSkill.name}</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-4 w-4 rounded-full ml-0.5 text-amber-600 hover:text-amber-800 hover:bg-amber-500/20"
          onClick={() => onSelectSkill(null)}
        >
          <X className="h-3 w-3" />
        </Button>
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
          <Zap className="h-3.5 w-3.5" />
          <span>Skill</span>
          <ChevronsUpDown className="h-3 w-3 shrink-0 opacity-40" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0 rounded-xl" align="center">
        <Command>
          <CommandInput placeholder="Search skills..." />
          <CommandList>
            <CommandEmpty>No skills found.</CommandEmpty>
            {Object.entries(grouped).map(([category, catSkills]) => (
              <CommandGroup key={category} heading={category}>
                {catSkills.map((skill) => (
                  <CommandItem
                    key={skill.id}
                    value={skill.name}
                    onSelect={() => { onSelectSkill(skill); setOpen(false); }}
                    className="flex items-center gap-2 rounded-lg"
                  >
                    <span>{skill.icon}</span>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{skill.name}</span>
                      <p className="text-[10px] text-muted-foreground truncate">{skill.description}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
