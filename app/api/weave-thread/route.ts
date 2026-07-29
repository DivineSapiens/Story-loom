import { NextRequest, NextResponse } from "next/server";
import { generateWeavedNode } from "@/lib/ai/generateWeavedNode";

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

  const canonSummary =
    typeof obj.canonSummary === "string" ? obj.canonSummary : "";

  const mainPathText =
    typeof obj.mainPathText === "string" ? obj.mainPathText.trim() : "";

  const characterName =
    typeof obj.characterName === "string" ? obj.characterName.trim() : "";

  const backstory =
    typeof obj.backstory === "string" ? obj.backstory.trim() : "";

  const threadPathText =
    typeof obj.threadPathText === "string" ? obj.threadPathText.trim() : "";

  const threadNodeText =
    typeof obj.threadNodeText === "string" ? obj.threadNodeText.trim() : "";

  if (!mainPathText) {
    return NextResponse.json(
      { error: "mainPathText is required." },
      { status: 400 }
    );
  }
  if (!characterName) {
    return NextResponse.json(
      { error: "characterName is required." },
      { status: 400 }
    );
  }
  if (!threadNodeText) {
    return NextResponse.json(
      { error: "threadNodeText is required." },
      { status: 400 }
    );
  }

  try {
    const node = await generateWeavedNode({
      canonSummary,
      mainPathText,
      characterName,
      backstory,
      threadPathText,
      threadNodeText,
    });
    return NextResponse.json({ node });
  } catch (err) {
    const detail =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : "Unknown error from AI provider";

    console.error("[/api/weave-thread] error:", detail);
    return NextResponse.json({ error: "Weave generation failed", detail }, { status: 500 });
  }
}
