import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// ── Active generations (shared with chat route via globalThis) ──
interface GenerationState {
  content: string;
  status: "generating" | "done" | "failed";
  callbacks: Set<(chunk: string, status: string) => void>;
  controller: AbortController;
}

function getActiveGenerations() {
  return (globalThis as unknown as { __activeGenerations?: Map<string, GenerationState> }).__activeGenerations;
}

export async function POST(req: NextRequest) {
  const { messageId } = await req.json();

  if (!messageId) {
    return NextResponse.json({ error: "Missing messageId" }, { status: 400 });
  }

  const activeGenerations = getActiveGenerations();
  if (!activeGenerations) {
    return NextResponse.json({ cancelled: false, reason: "No active generations" });
  }

  const gen = activeGenerations.get(messageId);
  if (!gen) {
    return NextResponse.json({ cancelled: false, reason: "Generation not found (may have already completed)" });
  }

  // Abort the generation
  gen.controller.abort();

  return NextResponse.json({ cancelled: true });
}
