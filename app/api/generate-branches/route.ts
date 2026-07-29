import { NextRequest, NextResponse } from "next/server";
import { generateBranches } from "@/lib/ai/generateBranches";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const pathText =
    body !== null &&
    typeof body === "object" &&
    "pathText" in body &&
    typeof (body as Record<string, unknown>).pathText === "string"
      ? ((body as Record<string, unknown>).pathText as string).trim()
      : "";

  if (!pathText) {
    return NextResponse.json(
      { error: "pathText is required and must be a non-empty string." },
      { status: 400 }
    );
  }

  try {
    const branches = await generateBranches(pathText);
    return NextResponse.json({ branches });
  } catch (err) {
    // Extract the most useful message from whatever the SDK threw.
    const detail =
      err instanceof Error
        ? err.message
        : typeof err === "string"
          ? err
          : "Unknown error from watsonx";

    console.error("[/api/generate-branches] watsonx error:", detail);
    return NextResponse.json({ error: "watsonx call failed", detail }, { status: 500 });
  }
}
