import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const MEMORY_EXTRACTION_PROMPT = `You are a memory extraction system. Analyze the conversation and extract facts worth remembering about the user.

Rules:
- Extract ONLY clear, specific facts (preferences, personal info, project details, technical choices, habits)
- Do NOT extract vague statements, questions, or temporary context
- Each memory should be a single, concise sentence
- Categorize each: "preference", "personal", "project", "technical", "general"
- Return a JSON array. If nothing worth remembering, return empty array []

Example output:
[
  {"content": "Prefers dark mode UI", "category": "preference"},
  {"content": "Uses Laravel 11 with PHP 8.3 for backend", "category": "technical"},
  {"content": "Working on an e-commerce project called TokoKu", "category": "project"}
]

Return ONLY the JSON array, no explanation.`;

// ── Types ──
interface ExtractedMemory {
  content: string;
  category: string;
}

interface MemoryRow {
  id: string;
  content: string;
  category: string;
  conversation_id: string | null;
}

// ── Content helpers ──

interface MemoryContent {
  text: string;
  source: string;
  updatedAt: string;
}

function parseContent(raw: string): MemoryContent {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.text === "string") return parsed as MemoryContent;
  } catch { /* legacy plain text */ }
  return { text: raw, source: "legacy", updatedAt: "" };
}

function serializeContent(text: string, source: "auto" | "manual" = "auto"): string {
  return JSON.stringify({ text, source, updatedAt: new Date().toISOString() });
}

function isSimilar(a: string, b: string): boolean {
  const wordsA = a.toLowerCase().split(/\s+/).filter(Boolean);
  const wordsB = b.toLowerCase().split(/\s+/).filter(Boolean);
  if (wordsA.length === 0 || wordsB.length === 0) return false;
  const overlap = wordsA.filter((w) => wordsB.includes(w)).length;
  return overlap / Math.min(wordsA.length, wordsB.length) > 0.6;
}

// ── Rule-based extraction (fallback) ──

function extractMemoriesBasic(userMessage: string): ExtractedMemory[] {
  const results: ExtractedMemory[] = [];

  const prefPatterns = [
    /(?:i (?:prefer|like|love|enjoy|hate|dislike))\s+(.{10,80})/i,
    /(?:saya (?:lebih suka|suka|senang|benci))\s+(.{10,80})/i,
    /(?:aku (?:lebih suka|suka|senang|benci))\s+(.{10,80})/i,
    /(?:lebih suka|paling suka)\s+(.{5,80})/i,
  ];
  for (const p of prefPatterns) {
    const m = userMessage.match(p);
    if (m) results.push({ content: m[0].trim(), category: "preference" });
  }

  const techPatterns = [
    /(?:i (?:use|work with|build with|develop in))\s+([A-Z][a-zA-Z0-9.#+ ]{2,40})/i,
    /(?:my (?:stack|tech|framework|language) (?:is|includes?))\s+([A-Z][a-zA-Z0-9.#+ ]{2,40})/i,
    /(?:saya (?:pakai|gunakan|menggunakan))\s+([A-Z][a-zA-Z0-9.#+ ]{2,40})/i,
    /(?:aku (?:pakai|gunakan|menggunakan))\s+([A-Z][a-zA-Z0-9.#+ ]{2,40})/i,
    /(?:pakai|gunakan|menggunakan)\s+([A-Z][a-zA-Z0-9.#+]{2,30})/i,
  ];
  for (const p of techPatterns) {
    const m = userMessage.match(p);
    if (m) results.push({ content: m[0].trim(), category: "technical" });
  }

  const namePatterns = [
    /(?:my name is|i'm|i am|call me|nama saya|namaku)\s+([A-Z][a-z]{1,30})/i,
    /(?:kamu.*(?:berikan|kasih|panggil|namai).*nama)\s+([A-Z][a-z]{1,30})/i,
    /(?:namamu|kamu.*(?:bernama|namanya))\s+([A-Z][a-z]{1,30})/i,
    /(?:panggil.*kamu|kamu.*panggil)\s+([A-Z][a-z]{1,30})/i,
    /kamu\s+([A-Z][a-z]{2,20})\s+(?:ya|aja|saja)/i,
  ];
  for (const p of namePatterns) {
    const m = userMessage.match(p);
    if (m) results.push({ content: m[0].trim(), category: "personal" });
  }

  const projPatterns = [
    /(?:i'm (?:building|working on|developing|creating))\s+(.{10,80})/i,
    /(?:saya (?:sedang )?(?:membuat|mengerjakan|membangun))\s+(.{10,80})/i,
    /(?:aku (?:sedang )?(?:membuat|mengerjakan|membangun))\s+(.{10,80})/i,
    /(?:my project|project saya|project ku)\s+(?:is |adalah )?(.{10,80})/i,
    /(?:lagi (?:bikin|buatin|kerja))\s+(.{10,80})/i,
  ];
  for (const p of projPatterns) {
    const m = userMessage.match(p);
    if (m) results.push({ content: m[0].trim(), category: "project" });
  }

  return results.slice(0, 3);
}

// ── AI extraction ──

async function extractMemoriesAI(
  userMessage: string,
  aiResponse: string,
  model: string,
  routerUrl: string,
  routerKey: string,
): Promise<ExtractedMemory[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${routerUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${routerKey}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: MEMORY_EXTRACTION_PROMPT },
          { role: "user", content: `---\nUser: ${userMessage.slice(0, 1000)}\n\nAssistant: ${aiResponse.slice(0, 1000)}\n---` },
        ],
        temperature: 0.1,
        max_tokens: 300,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!response.ok) return [];
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";
    const jsonMatch = content.match(/\[[\s\S]*?\]/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item) =>
          typeof item === "object" &&
          typeof item.content === "string" &&
          item.content.length > 5 &&
          item.content.length < 500 &&
          ["general", "preference", "personal", "project", "technical"].includes(item.category),
      )
      .slice(0, 3);
  } catch {
    return [];
  }
}

// ── POST handler ──

export async function POST(req: NextRequest) {
  let userMessage: string, aiResponse: string, userId: string, conversationId: string, model: string;
  try {
    const body = await req.json();
    userMessage = body.userMessage;
    aiResponse = body.aiResponse;
    userId = body.userId;
    conversationId = body.conversationId;
    model = body.model;
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!userId || !userMessage || !aiResponse) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const routerUrl = req.headers.get("x-router-url") || process.env.NINE_ROUTER_URL || "http://localhost:18787";
  const routerKey = req.headers.get("x-router-key") || process.env.NINE_ROUTER_API_KEY || "";

  // Extract memories
  let extracted = await extractMemoriesAI(userMessage, aiResponse, model, routerUrl, routerKey);
  let method = "ai";
  if (extracted.length === 0) {
    extracted = extractMemoriesBasic(userMessage);
    method = "rules";
  }
  if (extracted.length === 0) {
    return NextResponse.json({ saved: 0, method: "none" });
  }

  const supabase = await createClient();

  // Fetch existing memories for this user
  const { data: existing } = await supabase
    .from("user_memory")
    .select("id, content, category, conversation_id")
    .eq("user_id", userId);

  const existingRows: MemoryRow[] = existing || [];
  let saved = 0;

  for (const mem of extracted) {
    const convId = conversationId || null;

    // Find existing memory in same category + same scope (global vs room)
    const match = existingRows.find((r) => {
      if (r.category !== mem.category) return false;
      if (r.conversation_id !== convId) return false;
      const parsed = parseContent(r.content);
      return isSimilar(parsed.text, mem.content);
    });

    if (match) {
      // Update existing memory with new content
      const { error } = await supabase
        .from("user_memory")
        .update({
          content: serializeContent(mem.content, "auto"),
          updated_at: new Date().toISOString(),
        })
        .eq("id", match.id);

      if (!error) {
        saved++;
        // Update local cache so subsequent iterations see the new content
        match.content = serializeContent(mem.content, "auto");
      } else {
      }
    } else {
      // Find exact category+scope match (same category, same convId, not similar)
      const existingExact = existingRows.find(
        (r) => r.category === mem.category && r.conversation_id === convId,
      );

      if (existingExact) {
        // Same category+scope exists but different content → update it
        const { error } = await supabase
          .from("user_memory")
          .update({
            content: serializeContent(mem.content, "auto"),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingExact.id);

        if (!error) {
          saved++;
          existingExact.content = serializeContent(mem.content, "auto");
        } else {
        }
      } else {
        // New memory — insert
        const row: Record<string, unknown> = {
          user_id: userId,
          content: serializeContent(mem.content, "auto"),
          category: mem.category,
        };
        if (convId) row.conversation_id = convId;

        const { data: inserted, error } = await supabase
          .from("user_memory")
          .insert(row)
          .select("id, content, category, conversation_id")
          .single();

        if (!error && inserted) {
          saved++;
          existingRows.push(inserted as MemoryRow);
        } else {
        }
      }
    }
  }

  return NextResponse.json({ saved, method });
}
