/**
 * Generates a short title (3–6 words) and a one-line tagline for a story path.
 *
 * Called once per "Read this path" open, cached by path key in the drawer.
 * Provider priority: watsonx/Granite → Groq → stub
 */

const SYSTEM = `You are a literary editor.
Given a short story, produce a title and tagline.
Respond with ONLY valid JSON — no prose, no markdown, no code fences.
Return exactly this shape:
{ "title": "3–6 word title", "tagline": "One evocative sentence (max 12 words)." }`;

export interface StoryTitle {
  title: string;
  tagline: string;
}

const STUB: StoryTitle = {
  title:   "An Untitled Story",
  tagline: "Every path has a name — add your API key to find it.",
};

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

function parseTitle(raw: string): StoryTitle | null {
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const title   = typeof parsed.title   === "string" ? parsed.title.trim()   : "";
    const tagline = typeof parsed.tagline === "string" ? parsed.tagline.trim() : "";
    if (title && tagline) return { title, tagline };
  } catch { /* fall through */ }
  return null;
}

export async function titliseStory(pathText: string): Promise<StoryTitle> {
  const hasWatsonx =
    process.env.WATSONX_API_KEY &&
    process.env.WATSONX_API_KEY !== "your-watsonx-api-key-here" &&
    process.env.WATSONX_PROJECT_ID &&
    process.env.WATSONX_PROJECT_ID !== "your-watsonx-project-id-here";

  const hasGroq =
    process.env.GROQ_API_KEY &&
    process.env.GROQ_API_KEY !== "your-groq-api-key-here";

  if (!hasWatsonx && !hasGroq) return STUB;

  // ── watsonx / Granite ────────────────────────────────────────────────────────
  if (hasWatsonx) {
    const response = await getClient().textChat({
      modelId:   process.env.WATSONX_MODEL_ID ?? "ibm/granite-3-8b-instruct",
      projectId: process.env.WATSONX_PROJECT_ID!,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user",   content: `Story:\n${pathText}` },
      ],
      maxTokens:   80,
      temperature: 0.7,
      topP:        0.9,
    });
    const raw = (response.result.choices?.[0]?.message?.content ?? "").trim();
    if (!raw) throw new Error("Empty titlise response from watsonx");
    const result = parseTitle(raw);
    if (result) return result;
    throw new Error(`Could not parse watsonx titlise response: ${raw.slice(0, 200)}`);
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
      temperature: 0.7,
      max_tokens: 80,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user",   content: `Story:\n${pathText}` },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Groq titlise error ${res.status}: ${errText}`);
  }

  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw  = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!raw) throw new Error("Empty titlise response from Groq");

  const result = parseTitle(raw);
  if (result) return result;
  throw new Error(`Could not parse Groq titlise response: ${raw.slice(0, 200)}`);
}
