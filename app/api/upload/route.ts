import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/db";

async function uploadToImgbb(apiKey: string, file: File): Promise<{ url: string; id: string; display_url: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const base64 = buffer.toString("base64");

  const form = new FormData();
  form.append("key", apiKey);
  form.append("image", base64);
  form.append("name", `${Date.now()}-${file.name}`);

  const res = await fetch("https://api.imgbb.com/1/upload", { method: "POST", body: form });
  const data = await res.json();

  if (!res.ok || !data.data?.url) {
    throw new Error(data.error?.message || "ImgBB upload failed");
  }

  const imageUrl = data.data.display_url || data.data.url;
  // Replace i.ibb.co with i.ibb.co.com to bypass Indonesian DNS block
  const httpsUrl = imageUrl.replace(/^http:\/\//, "https://").replace("i.ibb.co", "i.ibb.co.com");

  return { url: httpsUrl, id: data.data.id, display_url: data.data.display_url };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const conversationId = formData.get("conversationId") as string | null;
    const userId = formData.get("userId") as string | null;

    if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

    if (file.size > 1 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 1MB)" }, { status: 400 });
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Allowed: JPEG, PNG, GIF, WebP" }, { status: 400 });
    }

    // Get ImgBB API key from DB
    const db = getDB();
    const settingsResult = await db.getSetting("imgbb_api_key");
    const imgbbKey = settingsResult.data as string | undefined;

    if (!imgbbKey) {
      return NextResponse.json({
        error: "ImgBB API key not configured. Add it in Admin → Connection.",
      }, { status: 400 });
    }

    const result = await uploadToImgbb(imgbbKey, file);

    // Save image record to DB
    if (conversationId && userId) {
      try {
        await db.createUploadedImage({
          conversation_id: conversationId,
          user_id: userId,
          image_url: result.url,
          imgbb_id: result.id,
          filename: file.name,
          file_size: file.size,
          mime_type: file.type,
        });
      } catch (err) {
        console.error("Failed to save image record:", err);
      }
    }

    return NextResponse.json({ url: result.url, id: result.id, display_url: result.display_url });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
