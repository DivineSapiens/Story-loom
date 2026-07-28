import type { BranchOption } from "../types";

// ─── Shared system prompt ─────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = `You are a creative writing partner.
Given the story so far, propose exactly 3 different ways the story could continue.
Respond with ONLY a valid JSON array — no prose, no markdown, no code fences.
Each element must have exactly these three keys:
  "text"  — 1–3 sentence continuation of the story
  "tone"  — a single descriptive word (e.g. Tense, Hopeful, Mysterious, Melancholy, Revelatory, Humorous, Dark)
  "why"   — one sentence explaining why this direction is interesting

Example output format (do not copy these values):
[
  {"text":"...", "tone":"Tense",      "why":"..."},
  {"text":"...", "tone":"Hopeful",    "why":"..."},
  {"text":"...", "tone":"Mysterious", "why":"..."}
]`;

function buildPrompt(pathText: string): string {
  return `${SYSTEM_INSTRUCTION}\n\nStory so far:\n${pathText}`;
}

// ─── Watsonx client (lazy-initialised, singleton) ─────────────────────────────

let _client: import("@ibm-cloud/watsonx-ai").WatsonXAI | null = null;

function getClient(): import("@ibm-cloud/watsonx-ai").WatsonXAI {
  if (_client) return _client;

  // Dynamic require so this module stays importable in environments that lack
  // the SDK (the stub path still works when credentials aren't set).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { WatsonXAI } = require("@ibm-cloud/watsonx-ai") as typeof import("@ibm-cloud/watsonx-ai");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { IamAuthenticator } = require("ibm-cloud-sdk-core") as typeof import("ibm-cloud-sdk-core");

  const region = process.env.WATSONX_REGION ?? "us-south";

  _client = WatsonXAI.newInstance({
    authenticator: new IamAuthenticator({ apikey: process.env.WATSONX_API_KEY! }),
    serviceUrl: `https://${region}.ml.cloud.ibm.com`,
    version: "2024-05-31",
  });

  return _client;
}

// ─── Parse helpers ────────────────────────────────────────────────────────────

/**
 * Strips markdown code fences the model sometimes wraps JSON in, then parses.
 * Returns null on any failure so the caller can fall back to the stub.
 */
function parseResponse(raw: string): Array<{ text: string; tone: string; why: string }> | null {
  try {
    // Strip ```json … ``` or ``` … ``` wrappers if present.
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    // Validate each element has the required keys.
    for (const item of parsed) {
      if (
        typeof item !== "object" ||
        typeof item.text !== "string" ||
        typeof item.tone !== "string" ||
        typeof item.why !== "string"
      ) {
        return null;
      }
    }

    return parsed as Array<{ text: string; tone: string; why: string }>;
  } catch {
    return null;
  }
}

// ─── Real watsonx call ────────────────────────────────────────────────────────

async function generateBranchesFromWatsonx(pathText: string): Promise<BranchOption[]> {
  const client = getClient();

  const response = await client.generateText({
    modelId: process.env.WATSONX_MODEL_ID ?? "ibm/granite-3-8b-instruct",
    projectId: process.env.WATSONX_PROJECT_ID!,
    input: buildPrompt(pathText),
    parameters: {
      max_new_tokens: 700,
      temperature: 0.85,
      top_p: 0.9,
      repetition_penalty: 1.1,
      stop_sequences: ["\n\n\n"],
    },
  });

  const raw = response.result.results?.[0]?.generated_text?.trim() ?? "";
  if (!raw) throw new Error("Empty response from watsonx");

  const parsed = parseResponse(raw);
  if (!parsed) throw new Error(`Could not parse watsonx response: ${raw.slice(0, 200)}`);

  // Take exactly 3 (model might sometimes return more/fewer).
  return parsed.slice(0, 3).map((b) => ({ id: crypto.randomUUID(), ...b }));
}

// ─── Stub (used when no credentials are configured) ──────────────────────────

function generateBranchesStub(_pathText: string): BranchOption[] {
  return [
    {
      id: crypto.randomUUID(),
      text:
        "A sharp crack of thunder split the silence, and the lantern in Mara's hand guttered out. In the sudden dark, something cold pressed against her wrist — fingers, unmistakably fingers — though she was certain she was alone.",
      tone: "Tense",
      why: "Raises immediate physical stakes and introduces an unknown threat without revealing too much.",
    },
    {
      id: crypto.randomUUID(),
      text:
        "The old cartographer spread his map across the table, and Mara realised with a jolt that the village marked at its centre — the one she had been searching for her whole life — was the very village she was standing in.",
      tone: "Revelatory",
      why: "Reframes everything the reader knows so far and gives Mara (and the reader) a reason to press forward.",
    },
    {
      id: crypto.randomUUID(),
      text:
        "\"You look exactly like her,\" the innkeeper said softly, setting down a cup of tea. He did not elaborate, and his eyes were already somewhere far away, somewhere that looked a great deal like grief.",
      tone: "Melancholy",
      why: "Introduces a mysterious connection to another character and opens an emotional thread to pull on.",
    },
  ];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Given the story text accumulated along the current path, returns exactly
 * 3 branch options the story could take next.
 *
 * Uses watsonx/Granite when WATSONX_API_KEY and WATSONX_PROJECT_ID are set,
 * otherwise falls back to hardcoded stub data so the UI works without credentials.
 */
export async function generateBranches(pathText: string): Promise<BranchOption[]> {
  const hasCredentials =
    process.env.WATSONX_API_KEY &&
    process.env.WATSONX_API_KEY !== "your-watsonx-api-key-here" &&
    process.env.WATSONX_PROJECT_ID &&
    process.env.WATSONX_PROJECT_ID !== "your-watsonx-project-id-here";

  if (!hasCredentials) {
    // No credentials configured — use stub so the app runs without setup.
    console.warn("[generateBranches] No watsonx credentials found — using stub data.");
    return generateBranchesStub(pathText);
  }

  try {
    return await generateBranchesFromWatsonx(pathText);
  } catch (err) {
    // On any error, log and fall back to stub so the UI never breaks.
    console.error("[generateBranches] watsonx call failed, falling back to stub:", err);
    return generateBranchesStub(pathText);
  }
}
