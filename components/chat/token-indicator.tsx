"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Zap } from "lucide-react";
import { cn } from "@/lib/utils";

interface TokenIndicatorProps {
  userId: string;
}

interface TokenData {
  token_input_used: number;
  token_output_used: number;
  token_limit: number | null;
}

export function TokenIndicator({ userId }: TokenIndicatorProps) {
  const [data, setData] = useState<TokenData | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/token-usage?userId=${userId}`);
        const json = await res.json();
        if (json.user) setData(json.user);
      } catch {}
    };
    load();

    // Refresh every 30s
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [userId]);

  if (!data || data.token_limit == null) return null;

  const total = (data.token_input_used || 0) + (data.token_output_used || 0);
  const percent = Math.min(100, (total / data.token_limit) * 100);
  const isWarning = percent > 70;
  const isCritical = percent > 90;

  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge
          variant="outline"
          className={cn(
            "h-6 gap-1 text-[10px] font-mono cursor-default",
            isCritical && "border-destructive/50 text-destructive",
            isWarning && !isCritical && "border-amber-500/50 text-amber-600"
          )}
        >
          <Zap className={cn("h-2.5 w-2.5", isCritical ? "text-destructive" : isWarning ? "text-amber-500" : "text-muted-foreground")} />
          {percent.toFixed(0)}%
        </Badge>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="text-xs">
        <p>{total.toLocaleString()} / {data.token_limit.toLocaleString()} tokens</p>
        <p className="text-muted-foreground">Input: {(data.token_input_used || 0).toLocaleString()} · Output: {(data.token_output_used || 0).toLocaleString()}</p>
      </TooltipContent>
    </Tooltip>
  );
}
