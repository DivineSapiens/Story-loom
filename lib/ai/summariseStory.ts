/**
 * Generates a 2–3 sentence plain-text summary of the story's established facts.
 *
 * Called fire-and-forget after every main-tree commit (including root set).
 * Stored in TreeState.canonSummary. Used as context in character-thread and weave prompts.
 *
 * Provider priority: watsonx/Granite → Groq → stub
 */

const SYSTEM = `You are a story archivist.
Given the story so far, write a concise 2–3 sentence summary of the established facts:
key characters introduced, main events that have occurred, and the overall tone.
Write in present tense. Plain prose only — no bullet points, no JSON, no markdown.`;

const STUB = `The story follows characters navigating an unfolding situation. ` +
             `Key events and relationships are developing. ` +
             `The tone shifts as circumstances evolve.`;

// ─── watsonx helper (shared singleton from generateBranches is not importable
//     here, so we lazily instantiate a second reference — the SDK caches the
//     underlying HTTP client internally, so there is no connection penalty). ───

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

export async function summariseStory(pathText: string): Promise<string> {
  const hasWatsonx =
    process.env.WATSONX_API_KEY &&
    process.env.WATSONX_API_KEY !== "your-watsonx-api-key-here" &&
    process.env.WATSONX_PROJECT_ID &&
    process.env.WATSONX_PROJECT_ID !== "your-watsonx-project-id-here";

  const hasGroq =
    process.env.GROQ_API_KEY &&
    process.env.GROQ_API_KEY !== "your-groq-api-key-here";

  // ── Stub fallback ────────────────────────────────────────────────────────────
  if (!hasWatsonx && !hasGroq) return STUB;

  // ── watsonx / Granite ────────────────────────────────────────────────────────
  if (hasWatsonx) {
    const response = await getClient().textChat({
      modelId:   process.env.WATSONX_MODEL_ID ?? "ibm/granite-3-8b-instruct",
      projectId: process.env.WATSONX_PROJECT_ID!,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user",   content: `Story so far:\n${pathText}` },
      ],
      maxTokens:   200,
      temperature: 0.3,
      topP:        0.9,
    });
    const summary = (response.result.choices?.[0]?.message?.content ?? "").trim();
    if (!summary) throw new Error("Empty summary response from watsonx");
    return summary;
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
      temperature: 0.3,
      max_tokens: 200,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user",   content: `Story so far:\n${pathText}` },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Groq summarise error ${res.status}: ${errText}`);
  }

  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const summary = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!summary) throw new Error("Empty summary response from Groq");
  return summary;
}
