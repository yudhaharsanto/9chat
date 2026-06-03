import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

// Extract real URL from DuckDuckGo redirect
function extractUrl(href: string): string {
  try {
    const uddg = href.match(/uddg=([^&]+)/)?.[1];
    if (uddg) return decodeURIComponent(uddg);
    if (href.startsWith("//")) return `https:${href}`;
    return href;
  } catch {
    return href;
  }
}

// Strip HTML tags
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#x27;/g, "'").trim();
}

async function searchWeb(query: string, count: number = 5): Promise<{ title: string; url: string; snippet: string }[]> {
  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
    });
    const html = await res.text();

    const results: { title: string; url: string; snippet: string }[] = [];

    // Split by result blocks
    const blocks = html.split(/class="result\s/);
    for (let i = 1; i < blocks.length && results.length < count; i++) {
      const block = blocks[i];

      // Extract title and URL from result__a
      const titleMatch = block.match(/class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/);
      if (!titleMatch) continue;
      const url = extractUrl(titleMatch[1]);
      const title = stripHtml(titleMatch[2]);

      // Skip ads (duckduckgo.com/y.js links)
      if (url.includes("duckduckgo.com/y.js")) continue;

      // Extract snippet from result__snippet
      const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/);
      const snippet = snippetMatch ? stripHtml(snippetMatch[1]) : "";

      if (title && url) {
        results.push({ title, url, snippet });
      }
    }
    return results;
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  const { query } = await req.json();
  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "Missing query" }, { status: 400 });
  }

  const results = await searchWeb(query, 5);
  return NextResponse.json({ results });
}
