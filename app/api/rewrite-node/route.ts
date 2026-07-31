import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/rewrite-node
 *
 * Rewrites a single story node so it flows naturally between the text that
 * comes before it (context_before) and the text that comes after it
 * (context_after). If context_after is absent the node is a leaf.
 *
 * Body:
 *   { nodeText: string; contextBefore: string; contextAfter?: string; genre?: string }
 *
 * Response:
 *   { text: string }  — the rewritten node text (1–3 sentences)
 */

const SYSTEM = `You are a creative writing editor.
You will be given a passage from a story, along with the text that comes
immediately before it and (optionally) the text that comes immediately after it.
Your task is to rewrite the passage so it:
  - Flows naturally from the preceding text
  - Connects naturally into the following text (if provided)
  - Preserves the same narrative point and story beat — do not invent new plot
  - Matches the genre/tone of the surrounding story
  - Is 1–3 sentences long

Reply with ONLY the rewritten passage — no explanation, no quotes, no labels.`;

// ─── watsonx client ───────────────────────────────────────────────────────────

let _client: import("@ibm-cloud/watsonx-ai").WatsonXAI | null = null;

function getClient(): import("@ibm-cloud/watsonx-ai").WatsonXAI {
  if (_client) return _client;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { WatsonXAI } = require("@ibm-cloud/watsonx-ai") as typeof import("@ibm-cloud/watsonx-ai");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { IamAuthenticator } = require("ibm-cloud-sdk-core") as typeof import("ibm-cloud-sdk-core");
  _client = WatsonXAI.newInstance({
    authenticator: new IamAuthenticator({ apikey: process.env.WATSONX_API_KEY! }),
    serviceUrl: `https://${process.env.WATSONX_REGION ?? "us-south"}.ml.cloud.ibm.com`,
    version: "2024-05-31",
  });
  return _client;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    nodeText?: string;
    contextBefore?: string;
    contextAfter?: string;
    genre?: string;
  };

  const { nodeText = "", contextBefore = "", contextAfter = "", genre = "" } = body;

  if (!nodeText.trim()) {
    return NextResponse.json({ error: "nodeText is required" }, { status: 400 });
  }

  const userMessage = [
    genre ? `Genre/tone: ${genre}` : null,
    contextBefore ? `TEXT BEFORE:\n${contextBefore}` : null,
    `PASSAGE TO REWRITE:\n${nodeText}`,
    contextAfter  ? `TEXT AFTER:\n${contextAfter}`   : null,
  ].filter(Boolean).join("\n\n");

  const hasWatsonx =
    process.env.WATSONX_API_KEY &&
    process.env.WATSONX_API_KEY !== "your-watsonx-api-key-here" &&
    process.env.WATSONX_PROJECT_ID &&
    process.env.WATSONX_PROJECT_ID !== "your-watsonx-project-id-here";

  const hasGroq =
    process.env.GROQ_API_KEY &&
    process.env.GROQ_API_KEY !== "your-groq-api-key-here";

  try {
    // ── watsonx ──────────────────────────────────────────────────────────────────
    if (hasWatsonx) {
      const res = await getClient().textChat({
        modelId:   process.env.WATSONX_MODEL_ID ?? "ibm/granite-3-8b-instruct",
        projectId: process.env.WATSONX_PROJECT_ID!,
        messages: [
          { role: "system", content: SYSTEM },
          { role: "user",   content: userMessage },
        ],
        maxTokens: 300, temperature: 0.75, topP: 0.9,
      });
      const text = (res.result.choices?.[0]?.message?.content ?? "").trim();
      if (text) return NextResponse.json({ text });
    }

    // ── Groq ─────────────────────────────────────────────────────────────────────
    if (hasGroq) {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${process.env.GROQ_API_KEY}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          temperature: 0.75, max_tokens: 300,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user",   content: userMessage },
          ],
        }),
      });
      const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
      const text = json.choices?.[0]?.message?.content?.trim() ?? "";
      if (text) return NextResponse.json({ text });
    }

    // ── Stub ─────────────────────────────────────────────────────────────────────
    return NextResponse.json({ text: nodeText }); // return original unchanged
  } catch (err) {
    console.error("[/api/rewrite-node]", err);
    return NextResponse.json({ error: "AI call failed", detail: String(err) }, { status: 500 });
  }
}
