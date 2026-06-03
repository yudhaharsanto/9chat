import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

// GET: Fetch token usage summary for a user or all users
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const userId = req.nextUrl.searchParams.get("userId");

  if (userId) {
    // Get user's total + per-model breakdown
    const { data: user } = await supabase
      .from("users")
      .select("id, username, display_name, token_input_used, token_output_used, token_limit")
      .eq("id", userId)
      .single();

    const { data: logs } = await supabase
      .from("token_usage_log")
      .select("model, input_tokens, output_tokens, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);

    // Aggregate by model
    const byModel: Record<string, { input: number; output: number; count: number }> = {};
    if (logs) {
      for (const log of logs) {
        if (!byModel[log.model]) byModel[log.model] = { input: 0, output: 0, count: 0 };
        byModel[log.model].input += log.input_tokens || 0;
        byModel[log.model].output += log.output_tokens || 0;
        byModel[log.model].count += 1;
      }
    }

    return NextResponse.json({ user, byModel, recentLogs: logs?.slice(0, 20) || [] });
  }

  // All users summary
  const { data: users } = await supabase
    .from("users")
    .select("id, username, display_name, avatar, token_input_used, token_output_used, token_limit")
    .order("username");

  return NextResponse.json({ users: users || [] });
}

// PATCH: Update token limit for a user
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { userId, tokenLimit, resetUsage } = await req.json();

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (tokenLimit !== undefined) updates.token_limit = tokenLimit;
  if (resetUsage) {
    updates.token_input_used = 0;
    updates.token_output_used = 0;
  }

  const { error } = await supabase.from("users").update(updates).eq("id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
