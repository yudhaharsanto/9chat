import { NextRequest, NextResponse } from "next/server";

// Vision-capable model patterns (supports kc/anthropic/claude format)
const VISION_PATTERNS = [
  "gpt-4o",
  "gpt-4-vision",
  "gpt-4.1",
  "o3",
  "o4-mini",
  "claude-3",
  "claude-4",
  "claude-sonnet",
  "claude-opus",
  "gemini-pro-vision",
  "gemini-1.5",
  "gemini-2",
  "gemini-2.5",
  "llava",
  "qwen-vl",
  "qwen2-vl",
  "mimo-v2-omni",
  "mimo-v2.5-pro",
];

function checkVisionSupport(modelId: string): boolean {
  const lower = modelId.toLowerCase();
  return VISION_PATTERNS.some((pattern) => lower.includes(pattern));
}

export async function GET(req: NextRequest) {
  const routerUrl = req.headers.get("x-router-url");
  const routerKey = req.headers.get("x-router-key");

  if (!routerUrl || !routerKey) {
    return NextResponse.json(
      { error: "Missing x-router-url or x-router-key header" },
      { status: 400 }
    );
  }

  try {
    const res = await fetch(`${routerUrl}/v1/models`, {
      headers: {
        Authorization: `Bearer ${routerKey}`,
      },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `9router returned ${res.status}: ${text}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Inject supports_vision flag
    if (data.data) {
      data.data = data.data.map((model: { id: string; [key: string]: unknown }) => ({
        ...model,
        supports_vision: checkVisionSupport(model.id),
      }));
    }

    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json(
      { error: `Connection failed: ${e instanceof Error ? e.message : "Unknown"}` },
      { status: 500 }
    );
  }
}
