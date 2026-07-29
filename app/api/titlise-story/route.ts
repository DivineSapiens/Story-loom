import { NextRequest, NextResponse } from "next/server";
import { titliseStory } from "@/lib/ai/titliseStory";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const obj = body !== null && typeof body === "object"
    ? (body as Record<string, unknown>)
    : {};

  const pathText =
    typeof obj.pathText === "string" ? obj.pathText.trim() : "";

  if (!pathText) {
    return NextResponse.json(
      { error: "pathText is required and must be a non-empty string." },
      { status: 400 }
    );
  }

  try {
    const result = await titliseStory(pathText);
    return NextResponse.json(result);
  } catch (err) {
    const detail =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : "Unknown error from AI provider";

    console.error("[/api/titlise-story] error:", detail);
    return NextResponse.json({ error: "Titlise call failed", detail }, { status: 500 });
  }
}
