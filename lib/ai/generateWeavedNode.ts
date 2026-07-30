/**
 * Generates a single main-tree continuation node that weaves a character thread
 * into the main narrative.
 *
 * Returns { text, tone, why } — the caller adds id and parentId before committing.
 * Provider priority: watsonx/Granite → Groq → stub
 */

const SYSTEM = `You are a creative writing partner helping to weave a character's 
side story back into the main narrative. You will receive context from a main story 
and a character's parallel arc. Write exactly ONE continuation paragraph for the 
MAIN story that naturally incorporates this character and their arc.

The paragraph must:
- Feel like an organic continuation of the main story, not a sudden gear-shift
- Acknowledge the character's presence or the consequences of their arc
- Match the established tone of the main story
- Be 2–4 sentences long

Respond with ONLY a JSON object (no array, no prose, no markdown):
{"text":"...","tone":"...","why":"..."}
where "tone" is a single descriptive word and "why" is one sentence explaining 
why this weave direction is interesting.`;

interface WeavedNodeResult {
  text: string;
  tone: string;
  why: string;
}

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

function parseWeaved(raw: string): WeavedNodeResult | null {
  try {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    if (
      typeof parsed.text === "string" &&
      typeof parsed.tone === "string" &&
      typeof parsed.why  === "string"
    ) return { text: parsed.text, tone: parsed.tone, why: parsed.why };
  } catch { /* fall through */ }
  return null;
}

export async function generateWeavedNode(params: {
  canonSummary: string;
  mainPathText: string;
  characterName: string;
  backstory: string;
  threadPathText: string;
  threadNodeText: string;
}): Promise<WeavedNodeResult> {
  const {
    canonSummary, mainPathText, characterName,
    backstory, threadPathText, threadNodeText,
  } = params;

  const stub: WeavedNodeResult = {
    text: `${characterName} appeared at the threshold, their presence shifting ` +
          `the weight of the moment in ways no one had anticipated.`,
    tone: "Revelatory",
    why:  `Brings ${characterName}'s parallel arc into direct contact with the main story.`,
  };

  const hasWatsonx =
    process.env.WATSONX_API_KEY &&
    process.env.WATSONX_API_KEY !== "your-watsonx-api-key-here" &&
    process.env.WATSONX_PROJECT_ID &&
    process.env.WATSONX_PROJECT_ID !== "your-watsonx-project-id-here";

  const hasGroq =
    process.env.GROQ_API_KEY &&
    process.env.GROQ_API_KEY !== "your-groq-api-key-here";

  if (!hasWatsonx && !hasGroq) return stub;

  const userMessage = [
    canonSummary    ? `ESTABLISHED STORY FACTS:\n${canonSummary}` : null,
    `MAIN STORY SO FAR:\n${mainPathText}`,
    `CHARACTER BEING WOVEN IN: ${characterName}`,
    backstory       ? `Their background: ${backstory}` : null,
    threadPathText  ? `Their side story so far:\n${threadPathText}` : null,
    `The specific moment to weave in:\n${threadNodeText}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  // ── watsonx / Granite ────────────────────────────────────────────────────────
  if (hasWatsonx) {
    const response = await getClient().textChat({
      modelId:   process.env.WATSONX_MODEL_ID ?? "ibm/granite-3-8b-instruct",
      projectId: process.env.WATSONX_PROJECT_ID!,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user",   content: userMessage },
      ],
      maxTokens:   400,
      temperature: 0.80,
      topP:        0.9,
    });
    const raw = (response.result.choices?.[0]?.message?.content ?? "").trim();
    if (!raw) throw new Error("Empty weave response from watsonx");
    const result = parseWeaved(raw);
    if (result) return result;
    throw new Error(`Could not parse watsonx weave response: ${raw.slice(0, 200)}`);
  }

  // ── Groq fallback ────────────────────────────────────────────────────────────
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.80,
      max_tokens: 400,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user",   content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Groq weave error ${res.status}: ${errText}`);
  }

  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw  = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!raw) throw new Error("Empty weave response from Groq");

  const result = parseWeaved(raw);
  if (result) return result;
  throw new Error(`Could not parse Groq weave response: ${raw.slice(0, 200)}`);
}
