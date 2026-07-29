import type { BranchOption } from "../types";

// ─── Shared system prompt (used by ALL providers) ─────────────────────────────

const SYSTEM_INSTRUCTION = `You are a creative writing partner.
Given the story so far, propose exactly 4 different ways the story could continue.
Respond with ONLY a valid JSON array — no prose, no markdown, no code fences.
Each element must have exactly these three keys:
  "text"  — 1–3 sentence continuation of the story
  "tone"  — a single descriptive word (e.g. Tense, Hopeful, Mysterious, Melancholy, Revelatory, Humorous, Dark)
  "why"   — one sentence explaining why this direction is interesting

Example output format (do not copy these values):
[
  {"text":"...", "tone":"Tense",      "why":"..."},
  {"text":"...", "tone":"Hopeful",    "why":"..."},
  {"text":"...", "tone":"Mysterious", "why":"..."},
  {"text":"...", "tone":"Dark",       "why":"..."}
]`;

const WRAP_UP_ADDENDUM = `\n\nIMPORTANT: The writer wants to start wrapping up the story. Bias all 4 directions toward resolving or concluding the narrative within the next 1–3 exchanges — avoid opening major new threads or introducing new characters.`;

function buildPrompt(pathText: string, wrapUp = false): string {
  const instruction = wrapUp ? SYSTEM_INSTRUCTION + WRAP_UP_ADDENDUM : SYSTEM_INSTRUCTION;
  return `${instruction}\n\nStory so far:\n${pathText}`;
}

// ─── Shared response parser (used by ALL providers) ───────────────────────────

/**
 * Strips markdown code fences the model sometimes wraps JSON in, then parses
 * and validates the expected shape. Returns null on any failure.
 */
function parseResponse(raw: string): Array<{ text: string; tone: string; why: string }> | null {
  try {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

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

// ─── ACTIVE PROVIDER: Groq ───────────────────────────────────────────────────
// OpenAI-compatible endpoint — plain fetch, no extra SDK.
// Model: llama-3.3-70b-versatile  (generous free tier, fast, strong JSON output).
// To switch providers change the single marked line in generateBranches() below.

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL   = "llama-3.3-70b-versatile";

async function generateBranchesFromGroq(pathText: string, wrapUp = false): Promise<BranchOption[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.85,
      max_tokens: 900,
      // response_format forces the model to emit valid JSON — same as OpenAI.
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: wrapUp ? SYSTEM_INSTRUCTION + WRAP_UP_ADDENDUM : SYSTEM_INSTRUCTION },
        { role: "user",   content: `Story so far:\n${pathText}` },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Groq API error ${res.status}: ${errText}`);
  }

  const json = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!raw) throw new Error("Empty response from Groq");

  // json_object mode returns a single object, not an array — handle both shapes.
  // Some models wrap the array under a key; unwrap if needed.
  let toParse = raw;
  try {
    const probe = JSON.parse(raw);
    if (!Array.isArray(probe)) {
      // Find the first array value inside the object.
      const arrayValue = Object.values(probe).find(Array.isArray);
      if (arrayValue) toParse = JSON.stringify(arrayValue);
    }
  } catch { /* let parseResponse handle it */ }

  const parsed = parseResponse(toParse);
  if (!parsed) throw new Error(`Could not parse Groq response: ${raw.slice(0, 200)}`);

  return parsed.slice(0, 4).map((b) => ({ id: crypto.randomUUID(), ...b }));
}

// ─── INACTIVE PROVIDER: Google Gemini (429 limit:0 on free tier) ─────────────
// To re-enable: set GEMINI_API_KEY in .env.local and change the provider swap
// line in generateBranches() to call generateBranchesFromGemini.

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

async function generateBranchesFromGemini(pathText: string, wrapUp = false): Promise<BranchOption[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const body = {
    systemInstruction: {
      parts: [{ text: wrapUp ? SYSTEM_INSTRUCTION + WRAP_UP_ADDENDUM : SYSTEM_INSTRUCTION }],
    },
    contents: [
      {
        role: "user",
        parts: [{ text: `Story so far:\n${pathText}` }],
      },
    ],
    generationConfig: {
      temperature: 0.85,
      topP: 0.9,
      maxOutputTokens: 900,
      responseMimeType: "application/json",
    },
  };

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const json = await res.json() as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  if (!raw) throw new Error("Empty response from Gemini");

  const parsed = parseResponse(raw);
  if (!parsed) throw new Error(`Could not parse Gemini response: ${raw.slice(0, 200)}`);

  return parsed.slice(0, 4).map((b) => ({ id: crypto.randomUUID(), ...b }));
}

// ─── INACTIVE PROVIDER: watsonx / Granite — swap back in once IBM auth is resolved
// To re-enable: set WATSONX_API_KEY + WATSONX_PROJECT_ID in .env.local and change
// the provider swap line in generateBranches() to call generateBranchesFromWatsonx.

let _watsonxClient: import("@ibm-cloud/watsonx-ai").WatsonXAI | null = null;

function getWatsonxClient(): import("@ibm-cloud/watsonx-ai").WatsonXAI {
  if (_watsonxClient) return _watsonxClient;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { WatsonXAI } = require("@ibm-cloud/watsonx-ai") as typeof import("@ibm-cloud/watsonx-ai");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { IamAuthenticator } = require("ibm-cloud-sdk-core") as typeof import("ibm-cloud-sdk-core");
  const region = process.env.WATSONX_REGION ?? "us-south";
  _watsonxClient = WatsonXAI.newInstance({
    authenticator: new IamAuthenticator({ apikey: process.env.WATSONX_API_KEY! }),
    serviceUrl: `https://${region}.ml.cloud.ibm.com`,
    version: "2024-05-31",
  });
  return _watsonxClient;
}

async function generateBranchesFromWatsonx(pathText: string, wrapUp = false): Promise<BranchOption[]> {
  const client = getWatsonxClient();
  const response = await client.generateText({
    modelId: process.env.WATSONX_MODEL_ID ?? "ibm/granite-3-8b-instruct",
    projectId: process.env.WATSONX_PROJECT_ID!,
    input: buildPrompt(pathText, wrapUp),
    parameters: {
      max_new_tokens: 900,
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
  return parsed.slice(0, 4).map((b) => ({ id: crypto.randomUUID(), ...b }));
}

// ─── Stub (used when no live credentials are configured) ──────────────────────

function generateBranchesStub(_pathText: string): BranchOption[] {
  return [
    {
      id: crypto.randomUUID(),
      text: "A sharp crack of thunder split the silence, and the lantern in Mara's hand guttered out. In the sudden dark, something cold pressed against her wrist — fingers, unmistakably fingers — though she was certain she was alone.",
      tone: "Tense",
      why: "Raises immediate physical stakes and introduces an unknown threat without revealing too much.",
    },
    {
      id: crypto.randomUUID(),
      text: "The old cartographer spread his map across the table, and Mara realised with a jolt that the village marked at its centre — the one she had been searching for her whole life — was the very village she was standing in.",
      tone: "Revelatory",
      why: "Reframes everything the reader knows so far and gives Mara (and the reader) a reason to press forward.",
    },
    {
      id: crypto.randomUUID(),
      text: "\"You look exactly like her,\" the innkeeper said softly, setting down a cup of tea. He did not elaborate, and his eyes were already somewhere far away, somewhere that looked a great deal like grief.",
      tone: "Melancholy",
      why: "Introduces a mysterious connection to another character and opens an emotional thread to pull on.",
    },
    {
      id: crypto.randomUUID(),
      text: "She stepped outside to find the village deserted — every door ajar, every hearth cold, as though its people had simply stopped mid-sentence and walked away into the dark.",
      tone: "Mysterious",
      why: "Raises an unsettling environmental mystery that invites exploration without resolving the existing thread.",
    },
  ];
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns exactly 4 branch options for the current story path.
 *
 * ACTIVE PROVIDER: Groq (llama-3.3-70b-versatile)
 *
 * Credential logic:
 *   - No GROQ_API_KEY set → stub data (app still works for demo purposes).
 *   - GROQ_API_KEY set    → real Groq call; errors propagate to the UI.
 *
 * ── PROVIDER SWAP LINE ── change the function called at the return below:
 *   Groq    (active):   generateBranchesFromGroq
 *   Gemini  (inactive): generateBranchesFromGemini   needs GEMINI_API_KEY
 *   watsonx (inactive): generateBranchesFromWatsonx  needs WATSONX_API_KEY + PROJECT_ID
 */
export async function generateBranches(pathText: string, wrapUp = false): Promise<BranchOption[]> {
  const hasGroqKey =
    process.env.GROQ_API_KEY &&
    process.env.GROQ_API_KEY !== "your-groq-api-key-here";

  if (!hasGroqKey) {
    console.warn("[generateBranches] No GROQ_API_KEY — using stub data.");
    return generateBranchesStub(pathText);
  }

  return generateBranchesFromGroq(pathText, wrapUp); // ← PROVIDER SWAP LINE
}

// ─── PUBLIC: generateThreadBranches ──────────────────────────────────────────
// Appended at end of file — uses the same Groq helper and parseResponse above.

/**
 * Generates 4 branch options for a character's side-story thread.
 *
 * Prompt context (in order):
 *   1. Established main-story facts (canonSummary) — keeps thread consistent.
 *   2. Character's name and backstory.
 *   3. The thread's own node history (threadPathText).
 *
 * Same {text, tone, why} output shape as generateBranches.
 * Same Groq provider; same json_object unwrap logic.
 */
export async function generateThreadBranches(params: {
  canonSummary: string;
  characterName: string;
  backstory: string;
  threadPathText: string;
  wrapUp?: boolean;
}): Promise<BranchOption[]> {
  const { canonSummary, characterName, backstory, threadPathText, wrapUp = false } = params;

  const hasGroqKey =
    process.env.GROQ_API_KEY &&
    process.env.GROQ_API_KEY !== "your-groq-api-key-here";

  if (!hasGroqKey) {
    console.warn("[generateThreadBranches] No GROQ_API_KEY — using stub data.");
    return [
      {
        id: crypto.randomUUID(),
        text: `${characterName} paused at the crossroads, weighing two paths — each carrying its own kind of cost.`,
        tone: "Tense",
        why: "Forces the character to make a meaningful choice that reveals their values.",
      },
      {
        id: crypto.randomUUID(),
        text: `An unexpected ally found ${characterName} in the shadows, offering help without explaining why.`,
        tone: "Mysterious",
        why: "Introduces tension between gratitude and suspicion.",
      },
      {
        id: crypto.randomUUID(),
        text: `${characterName} discovered a letter — old, water-stained — that answered one question and asked three more.`,
        tone: "Revelatory",
        why: "Reframes what the character thought they knew about their situation.",
      },
      {
        id: crypto.randomUUID(),
        text: `For the first time in a long while, ${characterName} allowed themselves to rest, and the world did not end because of it.`,
        tone: "Hopeful",
        why: "Provides emotional counterweight and character development through stillness.",
      },
    ];
  }

  const threadSystem = `You are a creative writing partner helping to develop a character's ` +
    `side story that exists within a larger narrative world.\n` +
    `Propose exactly 4 different ways this character's story could continue.\n` +
    `The character's story must remain consistent with the established main-story facts.\n` +
    `Respond with ONLY a valid JSON array — no prose, no markdown, no code fences.\n` +
    `Each element must have exactly these three keys:\n` +
    `  "text"  — 1–3 sentence continuation\n` +
    `  "tone"  — a single descriptive word\n` +
    `  "why"   — one sentence explaining why this direction is interesting` +
    (wrapUp
      ? `\n\nIMPORTANT: Bias all 4 directions toward resolving this character's arc ` +
        `within the next 1–3 exchanges.`
      : "");

  const userMessage = [
    canonSummary
      ? `ESTABLISHED MAIN STORY FACTS:\n${canonSummary}`
      : null,
    `CHARACTER: ${characterName}`,
    backstory ? `Their background: ${backstory}` : null,
    threadPathText
      ? `Their story so far:\n${threadPathText}`
      : `This character's story is just beginning.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.85,
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: threadSystem },
        { role: "user",   content: userMessage },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Groq thread-branches error ${res.status}: ${errText}`);
  }

  const json = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!raw) throw new Error("Empty response from Groq (thread branches)");

  // Same json_object → array unwrap logic as generateBranchesFromGroq.
  let toParse = raw;
  try {
    const probe = JSON.parse(raw);
    if (!Array.isArray(probe)) {
      const arrayValue = Object.values(probe).find(Array.isArray);
      if (arrayValue) toParse = JSON.stringify(arrayValue);
    }
  } catch { /* let parseResponse handle it */ }

  const parsed = parseResponse(toParse);
  if (!parsed) throw new Error(`Could not parse thread-branch response: ${raw.slice(0, 200)}`);

  return parsed.slice(0, 4).map((b) => ({ id: crypto.randomUUID(), ...b }));
}
