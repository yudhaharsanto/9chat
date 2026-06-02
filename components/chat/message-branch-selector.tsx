"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface MessageBranchSelectorProps {
  currentBranch: number;
  totalBranches: number;
  onBranchChange: (branch: number) => void;
}

export function MessageBranchSelector({ currentBranch, totalBranches, onBranchChange }: MessageBranchSelectorProps) {
  if (totalBranches <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card/80 px-2 py-1 shadow-sm backdrop-blur-sm">
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30"
          onClick={() => onBranchChange(currentBranch - 1)}
          disabled={currentBranch <= 0}
        >
          <ChevronLeft className="h-3 w-3" />
        </Button>
        <span className="min-w-[40px] text-center text-[10px] font-medium text-muted-foreground">
          {currentBranch + 1} / {totalBranches}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 rounded-full text-muted-foreground hover:text-foreground disabled:opacity-30"
          onClick={() => onBranchChange(currentBranch + 1)}
          disabled={currentBranch >= totalBranches - 1}
        >
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
