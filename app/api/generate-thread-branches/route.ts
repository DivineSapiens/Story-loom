import { NextRequest, NextResponse } from "next/server";
import { generateThreadBranches } from "@/lib/ai/generateBranches";

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

  const characterName =
    typeof obj.characterName === "string" ? obj.characterName.trim() : "";

  const backstory =
    typeof obj.backstory === "string" ? obj.backstory.trim() : "";

  const threadPathText =
    typeof obj.threadPathText === "string" ? obj.threadPathText.trim() : "";

  const wrapUp = obj.wrapUp === true;

  if (!characterName) {
    return NextResponse.json(
      { error: "characterName is required." },
      { status: 400 }
    );
  }

  try {
    const branches = await generateThreadBranches({
      canonSummary,
      characterName,
      backstory,
      threadPathText,
      wrapUp,
    });
    return NextResponse.json({ branches });
  } catch (err) {
    const detail =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : "Unknown error from AI provider";

    console.error("[/api/generate-thread-branches] error:", detail);
    return NextResponse.json({ error: "Thread branch generation failed", detail }, { status: 500 });
  }
}
