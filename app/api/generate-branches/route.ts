import { NextRequest, NextResponse } from "next/server";
import { generateBranches } from "@/lib/ai/generateBranches";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const obj = body !== null && typeof body === "object" ? (body as Record<string, unknown>) : {};

  const pathText =
    typeof obj.pathText === "string" ? obj.pathText.trim() : "";

  if (!pathText) {
    return NextResponse.json(
      { error: "pathText is required and must be a non-empty string." },
      { status: 400 }
    );
  }

  const wrapUp = obj.wrapUp === true;
  const genre  = typeof obj.genre === "string" ? obj.genre.trim() : "";

  try {
    const branches = await generateBranches(pathText, wrapUp, genre);
    return NextResponse.json({ branches });
  } catch (err) {
    const detail =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : "Unknown error from AI provider";

    console.error("[/api/generate-branches] error:", detail);
    return NextResponse.json({ error: "AI call failed", detail }, { status: 500 });
  }
}
