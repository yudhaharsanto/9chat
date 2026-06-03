import { NextRequest } from "next/server";

export const runtime = "nodejs";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

export async function POST(req: NextRequest) {
  const { id, content, status } = await req.json();

  if (!id) {
    return Response.json({ error: "Missing id" }, { status: 400 });
  }

  const body: Record<string, unknown> = {};
  if (content !== undefined) body.content = content;
  if (status !== undefined) body.status = status;

  const res = await fetch(`${supabaseUrl}/rest/v1/messages?id=eq.${id}`, {
    method: "PATCH",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    return Response.json({ error: "Update failed" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
