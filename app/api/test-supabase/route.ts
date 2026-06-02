import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: NextRequest) {
  const { url, key } = await req.json();

  if (!url || !key) {
    return NextResponse.json(
      { error: "Missing Supabase URL or anon key" },
      { status: 400 }
    );
  }

  try {
    const supabase = createClient(url, key);

    // Test by querying the conversations table
    const { error } = await supabase
      .from("conversations")
      .select("id")
      .limit(1);

    if (error) {
      // Table might not exist yet — check if it's a "relation does not exist" error
      if (error.message.includes("does not exist") || error.code === "42P01") {
        return NextResponse.json({
          success: true,
          warning:
            "Connected, but tables not found. Run the schema SQL in Supabase SQL Editor first.",
        });
      }
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      {
        error: `Connection failed: ${e instanceof Error ? e.message : "Unknown"}`,
      },
      { status: 500 }
    );
  }
}
