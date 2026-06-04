import { NextRequest } from "next/server";

const GENERATION_TIMEOUT_MS = 60 * 1000; // 60 seconds timeout for generation

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

// ── Supabase REST helpers ──
async function supabaseQuery(table: string, query: string) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Prefer: "return=representation" },
  });
  if (!res.ok) return null;
  return res.json();
}

async function supabaseUpdate(table: string, query: string, body: Record<string, unknown>) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  return res.ok;
}

async function supabaseInsert(table: string, body: Record<string, unknown>) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": "application/json", Prefer: "return=representation" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
  return res.json();
}

// ── Active generations (in-memory, shared via globalThis) ──
interface GenerationState {
  content: string;
  thinking: string;
  status: "generating" | "done" | "failed";
  callbacks: Set<(chunk: string, status: string, thinking?: string) => void>;
  controller: AbortController;
}

if (!(globalThis as unknown as { __activeGenerations?: Map<string, GenerationState> }).__activeGenerations) {
  (globalThis as unknown as { __activeGenerations: Map<string, GenerationState> }).__activeGenerations = new Map();
}
const activeGenerations = (globalThis as unknown as { __activeGenerations: Map<string, GenerationState> }).__activeGenerations;

function emit(gen: GenerationState, chunk: string, thinking?: string) {
  for (const cb of gen.callbacks) {
    try { cb(chunk, gen.status, thinking); } catch {}
  }
}

async function flushToDb(messageId: string, content: string, status: string) {
  await supabaseUpdate("messages", `id=eq.${messageId}`, { content, status });
}

async function runGeneration(
  messageId: string,
  apiMessages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>,
  model: string,
  routerUrl: string,
  routerKey: string,
  userId?: string,
  conversationId?: string,
) {
  const controller = new AbortController();
  const gen: GenerationState = { content: "", thinking: "", status: "generating", callbacks: new Set(), controller };
  activeGenerations.set(messageId, gen);

  let lastFlushLen = 0;
  const startTime = Date.now();
  let firstTokenTime: number | null = null;

  // Auto-timeout: abort if generation takes too long
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, GENERATION_TIMEOUT_MS);

  try {
    const response = await fetch(`${routerUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${routerKey}` },
      body: JSON.stringify({ messages: apiMessages, model, stream: true }),
      signal: controller.signal,
    });

    if (!response.ok) {
      gen.status = "failed";
      await flushToDb(messageId, gen.content, "failed");
      emit(gen, "");
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      gen.status = "failed";
      await flushToDb(messageId, gen.content, "failed");
      return;
    }

    let buffer = "";
    let outputTokens = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += new TextDecoder().decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ") || line.includes("[DONE]")) continue;
        try {
          const parsed = JSON.parse(line.slice(6));
          const delta = parsed.choices?.[0]?.delta;
          
          // Handle thinking/reasoning content
          // Different providers use different fields:
          // - DeepSeek: reasoning_content
          // - Claude: thinking (in content blocks)
          // - OpenAI: reasoning
          const thinkingDelta = delta?.reasoning_content || delta?.reasoning || delta?.thinking;
          if (thinkingDelta) {
            gen.thinking += thinkingDelta;
            emit(gen, "", thinkingDelta);
          }
          
          // Handle regular content
          const contentDelta = delta?.content;
          if (contentDelta) {
            if (!firstTokenTime) firstTokenTime = Date.now();
            gen.content += contentDelta;
            outputTokens += Math.ceil(contentDelta.length / 4);
            emit(gen, contentDelta);

            // Flush to DB every ~500 chars
            if (gen.content.length - lastFlushLen > 500) {
              lastFlushLen = gen.content.length;
              await flushToDb(messageId, gen.content, "generating");
            }
          }
        } catch {}
      }
    }

    // Final flush
    gen.status = "done";
    const responseTimeMs = Date.now() - startTime;
    await flushToDb(messageId, gen.content, "done");
    // Save thinking content and response time
    const updateBody: Record<string, unknown> = { response_time_ms: responseTimeMs };
    if (gen.thinking) updateBody.thinking = gen.thinking;
    await supabaseUpdate("messages", `id=eq.${messageId}`, updateBody);

    // Token tracking (fire-and-forget)
    if (userId && supabaseUrl && outputTokens > 0) {
      const inputTokens = Math.ceil(apiMessages.map((m) => typeof m.content === "string" ? m.content : "").join(" ").length / 4);
      supabaseQuery("users", `id=eq.${userId}&select=token_input_used,token_output_used`)
        .then((users) => {
          const u = users?.[0];
          if (u) {
            supabaseUpdate("users", `id=eq.${userId}`, {
              token_input_used: (u.token_input_used || 0) + inputTokens,
              token_output_used: (u.token_output_used || 0) + outputTokens,
              updated_at: new Date().toISOString(),
            });
          }
        }).catch(() => {});
      supabaseInsert("token_usage_log", {
        user_id: userId, model, conversation_id: conversationId || null,
        input_tokens: Math.ceil(apiMessages.map((m) => typeof m.content === "string" ? m.content : "").join(" ").length / 4),
        output_tokens: outputTokens,
      }).catch(() => {});
    }
  } catch (err) {
    const isAbort = err instanceof DOMException && err.name === "AbortError";
    gen.status = "failed";
    const failContent = gen.content || (isAbort ? "[Generation timed out]" : "[Generation failed]");
    await flushToDb(messageId, failContent, "failed");
  } finally {
    clearTimeout(timeoutId);
    emit(gen, "");
    activeGenerations.delete(messageId);
  }
}

// ── Cancel a running generation ──
function cancelGeneration(messageId: string): boolean {
  const gen = activeGenerations.get(messageId);
  if (gen) {
    gen.controller.abort();
    return true;
  }
  return false;
}

// ── Thinking models detection ──
function isThinkingModel(model: string): boolean {
  const thinkingPatterns = [
    "-thinking", "-think", "-reasoning", "-r1", "-o1", "-o3",
    "qwq", "deepseek-r", "reasoning",
  ];
  const lower = model.toLowerCase();
  return thinkingPatterns.some((p) => lower.includes(p));
}

// ── Convert message images ──
function convertMessage(msg: { role: string; content: string }) {
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const images: string[] = [];
  const text = msg.content.replace(imageRegex, (_m: string, _a: string, url: string) => { images.push(url); return ""; }).trim();
  if (images.length === 0) return { role: msg.role, content: text };
  const content: Array<{ type: string; text?: string; image_url?: { url: string } }> = [];
  if (text) content.push({ type: "text", text });
  for (const url of images) content.push({ type: "image_url", image_url: { url } });
  return { role: msg.role, content };
}

// ── POST: Start generation ──
export async function POST(req: NextRequest) {
  const { messages, model, conversationId, systemPrompt, userId } = await req.json();

  const routerUrl = req.headers.get("x-router-url") || process.env.NINE_ROUTER_URL || "http://localhost:18787";
  const routerKey = req.headers.get("x-router-key") || process.env.NINE_ROUTER_API_KEY || "";

  // Token limit check
  if (userId && supabaseUrl) {
    try {
      const users = await supabaseQuery("users", `id=eq.${userId}&select=token_input_used,token_output_used,token_limit`);
      const user = users?.[0];
      if (user?.token_limit != null) {
        const totalUsed = (user.token_input_used || 0) + (user.token_output_used || 0);
        if (totalUsed >= user.token_limit) {
          return Response.json({ error: "Token limit reached", code: "TOKEN_LIMIT_EXCEEDED", used: totalUsed, limit: user.token_limit }, { status: 429 });
        }
      }
    } catch {}
  }

  // Build API messages
  const apiMessages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }> = [];
  if (systemPrompt) apiMessages.push({ role: "system", content: systemPrompt });
  for (const msg of messages) apiMessages.push(convertMessage(msg));

  // Create placeholder message in DB
  const inserted = await supabaseInsert("messages", {
    conversation_id: conversationId,
    role: "assistant",
    content: "",
    status: "generating",
  });

  if (!inserted?.[0]?.id) {
    // Fallback: inline streaming (no background generation)
    return new Response(JSON.stringify({ error: "Failed to create message" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }

  const messageId = inserted[0].id;

  // Start background generation (fire-and-forget)
  runGeneration(messageId, apiMessages, model, routerUrl, routerKey, userId, conversationId);

  // Return immediately with message ID
  return Response.json({ messageId, status: "generating" });
}
