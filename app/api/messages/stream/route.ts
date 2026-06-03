import { NextRequest } from "next/server";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// ── Active generations (shared with chat route via global) ──
interface GenerationState {
  content: string;
  status: "generating" | "done" | "failed";
  callbacks: Set<(chunk: string, status: string) => void>;
}

// Access the same global map as the chat route
const activeGenerations = (globalThis as unknown as { __activeGenerations?: Map<string, GenerationState> }).__activeGenerations;

export async function GET(req: NextRequest) {
  const messageId = req.nextUrl.searchParams.get("id");
  if (!messageId) {
    return new Response("Missing id", { status: 400 });
  }

  // Try to get from in-memory first (live generation)
  const gen = activeGenerations?.get(messageId);

  if (gen) {
    // Stream from in-memory generation
    const stream = new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder();
        let closed = false;

        const send = (chunk: string, status: string) => {
          if (closed) return;
          try {
            if (chunk) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: chunk, status })}\n\n`));
            if (status === "done" || status === "failed") {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: "", status, done: true })}\n\n`));
              closed = true;
              controller.close();
            }
          } catch { closed = true; }
        };

        // Send current content immediately
        if (gen.content) send(gen.content, gen.status);
        if (gen.status === "done" || gen.status === "failed") return;

        gen.callbacks.add(send);

        // Cleanup on close
        req.signal.addEventListener("abort", () => {
          gen.callbacks.delete(send);
          closed = true;
          try { controller.close(); } catch {}
        });
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }

  // Not in memory — poll DB
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let lastLen = 0;
      let closed = false;

      const sendDone = (status: string) => {
        if (closed) return;
        closed = true;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: "", status, done: true })}\n\n`));
          controller.close();
        } catch {}
      };

      // Poll DB for content
      while (!closed) {
        try {
          const res = await fetch(`${supabaseUrl}/rest/v1/messages?id=eq.${messageId}&select=content,status`, {
            headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
          });
          const data = await res.json();
          const msg = data?.[0];

          if (!msg) { sendDone("failed"); break; }

          const newContent = (msg.content || "").slice(lastLen);
          if (newContent) {
            lastLen = msg.content.length;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: newContent, status: msg.status })}\n\n`));
          }

          if (msg.status === "done" || msg.status === "failed") {
            sendDone(msg.status);
            break;
          }
        } catch {
          sendDone("failed");
          break;
        }

        // Wait 500ms before next poll
        await new Promise((r) => setTimeout(r, 500));
      }

      req.signal.addEventListener("abort", () => {
        closed = true;
        try { controller.close(); } catch {}
      });
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
