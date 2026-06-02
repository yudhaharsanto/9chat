import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { messages, model, conversationId, systemPrompt } = await req.json();

  const routerUrl =
    req.headers.get("x-router-url") || process.env.NINE_ROUTER_URL || "http://localhost:18787";
  const routerKey =
    req.headers.get("x-router-key") || process.env.NINE_ROUTER_API_KEY || "";

  const apiMessages = [];
  if (systemPrompt) {
    apiMessages.push({ role: "system", content: systemPrompt });
  }
  apiMessages.push(...messages);

  try {
    const response = await fetch(`${routerUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${routerKey}`,
      },
      body: JSON.stringify({
        messages: apiMessages,
        model,
        stream: true,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return new Response(
        JSON.stringify({ error: `9router error ${response.status}: ${text}` }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    // Stream the response body through a TransformStream to handle
    // both Node.js Readable and web ReadStream bodies
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } catch (err) {
          controller.error(err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        ...(conversationId
          ? { "X-Conversation-Id": conversationId }
          : {}),
      },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        error: `Connection failed: ${e instanceof Error ? e.message : "Unknown"}`,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
