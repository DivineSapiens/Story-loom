import type { BranchOption } from "../types";

// ─── Shared system prompts ────────────────────────────────────────────────────

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

/** Returns the system prompt, optionally prefixed with a genre constraint. */
function buildSystemPrompt(base: string, genre: string): string {
  if (!genre.trim()) return base;
  return `Genre/tone of this story: ${genre}\nAll 4 directions must stay within this genre.\n\n${base}`;
}

const WRAP_UP_SYSTEM = `You are a creative writing partner helping to conclude a story.
The writer has asked to wrap up the story. Propose exactly 4 directions:
  - 3 directions that are penultimate steps (each ~1–2 exchanges from the end)
  - 1 direction that IS the final, conclusive ending of the story

Respond with ONLY a valid JSON array — no prose, no markdown, no code fences.
Each element must have exactly these keys:
  "text"           — 1–3 sentence continuation
  "tone"           — a single descriptive word (e.g. Hopeful, Bittersweet, Triumphant, Melancholy, Peaceful, Dark)
  "why"            — one sentence explaining why this direction works as a conclusion
  "nodesRemaining" — integer: 1 or 2 for penultimate options, 0 for the ending option
  "isEnding"       — boolean: true ONLY on the single conclusive ending option, omit on all others

The ending option ("isEnding": true) must feel like a genuine, satisfying conclusion —
it should resolve the main tension and give a sense of finality. Write it in 2–3 sentences.
The story's final line should feel like the last line of a novel.

Example output (do not copy these values):
[
  {"text":"...", "tone":"Hopeful",     "why":"...", "nodesRemaining": 2},
  {"text":"...", "tone":"Bittersweet", "why":"...", "nodesRemaining": 1},
  {"text":"...", "tone":"Melancholy",  "why":"...", "nodesRemaining": 2},
  {"text":"...", "tone":"Triumphant",  "why":"...", "nodesRemaining": 0, "isEnding": true}
]`;

// ─── Shared response parser ───────────────────────────────────────────────────

type ParsedBranch = {
  text: string;
  tone: string;
  why: string;
  isEnding?: boolean;
  nodesRemaining?: number;
};

/**
 * Strips markdown fences, handles both raw-array and json_object-wrapped shapes,
 * validates required fields. Returns null on any failure.
 */
function parseResponse(raw: string): ParsedBranch[] | null {
  try {
    const cleaned = raw
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    let parsed = JSON.parse(cleaned);

    // json_object mode wraps the array under a key — unwrap it.
    if (!Array.isArray(parsed)) {
      const arrayValue = Object.values(parsed as object).find(Array.isArray);
      if (arrayValue) parsed = arrayValue;
      else return null;
    }

    if ((parsed as unknown[]).length === 0) return null;

    for (const item of parsed as unknown[]) {
      if (
        typeof item !== "object" || item === null ||
        typeof (item as Record<string, unknown>).text !== "string" ||
        typeof (item as Record<string, unknown>).tone !== "string" ||
        typeof (item as Record<string, unknown>).why  !== "string"
      ) return null;
    }

    return parsed as ParsedBranch[];
  } catch {
    return null;
  }
}

/** Maps a parsed branch array to the public BranchOption shape. */
function toBranchOptions(parsed: ParsedBranch[]): BranchOption[] {
  return parsed.slice(0, 4).map((b) => ({
    id: crypto.randomUUID(),
    text: b.text,
    tone: b.tone,
    why:  b.why,
    ...(b.isEnding            ? { isEnding: true }                      : {}),
    ...(b.nodesRemaining != null ? { nodesRemaining: b.nodesRemaining } : {}),
  }));
}

// ─── PROVIDER: watsonx / IBM Granite ─────────────────────────────────────────
// Uses textChat (chat-completion API) so Granite-3-instruct models receive
// properly structured system + user turns. The old generateText endpoint treats
// everything as raw completion text and ignores instruction formatting.

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

async function generateBranchesFromWatsonx(
  pathText: string,
  wrapUp = false,
  genre  = ""
): Promise<BranchOption[]> {
  const client    = getWatsonxClient();
  const modelId   = process.env.WATSONX_MODEL_ID ?? "ibm/granite-3-8b-instruct";
  const projectId = process.env.WATSONX_PROJECT_ID!;

  const systemPrompt = buildSystemPrompt(wrapUp ? WRAP_UP_SYSTEM : SYSTEM_INSTRUCTION, genre);

  const response = await client.textChat({
    modelId,
    projectId,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user",   content: `Story so far:\n${pathText}` },
    ],
    maxTokens:        1100,
    temperature:      0.85,
    topP:             0.9,
    repetitionPenalty: 1.05,
  });

  const raw = (
    response.result.choices?.[0]?.message?.content ?? ""
  ).trim();

  if (!raw) throw new Error("Empty response from watsonx (branches)");

  const parsed = parseResponse(raw);
  if (!parsed) throw new Error(`Could not parse watsonx branches response: ${raw.slice(0, 200)}`);
  return toBranchOptions(parsed);
}

// ─── PROVIDER: Groq ───────────────────────────────────────────────────────────

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL   = "llama-3.3-70b-versatile";

async function generateBranchesFromGroq(
  pathText: string,
  wrapUp = false,
  genre  = ""
): Promise<BranchOption[]> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set");

  const systemPrompt = buildSystemPrompt(wrapUp ? WRAP_UP_SYSTEM : SYSTEM_INSTRUCTION, genre);

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.85,
      max_tokens: 1100,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: `Story so far:\n${pathText}` },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Groq API error ${res.status}: ${errText}`);
  }

  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw  = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!raw) throw new Error("Empty response from Groq");

  const parsed = parseResponse(raw);
  if (!parsed) throw new Error(`Could not parse Groq response: ${raw.slice(0, 200)}`);
  return toBranchOptions(parsed);
}

// ─── PROVIDER: Google Gemini (inactive — 429 on free tier) ───────────────────

const GEMINI_MODEL    = "gemini-2.0-flash";
const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

async function generateBranchesFromGemini(
  pathText: string,
  wrapUp = false
): Promise<BranchOption[]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const url = `${GEMINI_API_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: wrapUp ? WRAP_UP_SYSTEM : SYSTEM_INSTRUCTION }],
      },
      contents: [{ role: "user", parts: [{ text: `Story so far:\n${pathText}` }] }],
      generationConfig: {
        temperature: 0.85, topP: 0.9, maxOutputTokens: 1100,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const json = await res.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
  if (!raw) throw new Error("Empty response from Gemini");

  const parsed = parseResponse(raw);
  if (!parsed) throw new Error(`Could not parse Gemini response: ${raw.slice(0, 200)}`);
  return toBranchOptions(parsed);
}

// ─── Stub (no credentials configured) ────────────────────────────────────────

function generateBranchesStub(): BranchOption[] {
  return [
    {
      id: crypto.randomUUID(),
      text: "A sharp crack of thunder split the silence, and the lantern in Mara's hand guttered out. In the sudden dark, something cold pressed against her wrist — fingers, unmistakably fingers — though she was certain she was alone.",
      tone: "Tense",
      why:  "Raises immediate physical stakes and introduces an unknown threat without revealing too much.",
    },
    {
      id: crypto.randomUUID(),
      text: "The old cartographer spread his map across the table, and Mara realised with a jolt that the village marked at its centre — the one she had been searching for her whole life — was the very village she was standing in.",
      tone: "Revelatory",
      why:  "Reframes everything the reader knows so far and gives Mara (and the reader) a reason to press forward.",
    },
    {
      id: crypto.randomUUID(),
      text: "\"You look exactly like her,\" the innkeeper said softly, setting down a cup of tea. He did not elaborate, and his eyes were already somewhere far away, somewhere that looked a great deal like grief.",
      tone: "Melancholy",
      why:  "Introduces a mysterious connection to another character and opens an emotional thread to pull on.",
    },
    {
      id: crypto.randomUUID(),
      text: "She stepped outside to find the village deserted — every door ajar, every hearth cold, as though its people had simply stopped mid-sentence and walked away into the dark.",
      tone: "Mysterious",
      why:  "Raises an unsettling environmental mystery that invites exploration without resolving the existing thread.",
    },
  ];
}

// ─── Public API: generateBranches ────────────────────────────────────────────
/**
 * Returns exactly 4 branch options for the current story path.
 *
 * Provider priority (first one with valid credentials wins):
 *   1. watsonx / IBM Granite  — WATSONX_API_KEY + WATSONX_PROJECT_ID
 *   2. Groq (llama-3.3)       — GROQ_API_KEY
 *   3. Stub data              — no credentials at all (demo mode)
 */
export async function generateBranches(
  pathText: string,
  wrapUp = false,
  genre  = ""
): Promise<BranchOption[]> {
  const hasWatsonx =
    process.env.WATSONX_API_KEY &&
    process.env.WATSONX_API_KEY !== "your-watsonx-api-key-here" &&
    process.env.WATSONX_PROJECT_ID &&
    process.env.WATSONX_PROJECT_ID !== "your-watsonx-project-id-here";

  if (hasWatsonx) {
    return generateBranchesFromWatsonx(pathText, wrapUp, genre);
  }

  const hasGroq =
    process.env.GROQ_API_KEY &&
    process.env.GROQ_API_KEY !== "your-groq-api-key-here";

  if (hasGroq) {
    return generateBranchesFromGroq(pathText, wrapUp, genre);
  }

  console.warn("[generateBranches] No AI credentials — using stub data.");
  return generateBranchesStub();
}

// ─── Public API: generateThreadBranches ──────────────────────────────────────
/**
 * Generates 4 branch options for a character's side-story thread.
 * Same provider priority as generateBranches.
 */
export async function generateThreadBranches(params: {
  canonSummary: string;
  characterName: string;
  backstory: string;
  threadPathText: string;
  wrapUp?: boolean;
}): Promise<BranchOption[]> {
  const { canonSummary, characterName, backstory, threadPathText, wrapUp = false } = params;

  const threadSystem =
    `You are a creative writing partner helping to develop a character's ` +
    `side story that exists within a larger narrative world.\n` +
    `Propose exactly 4 different ways this character's story could continue.\n` +
    `The character's story must remain consistent with the established main-story facts.\n` +
    `Respond with ONLY a valid JSON array — no prose, no markdown, no code fences.\n` +
    `Each element must have exactly these three keys:\n` +
    `  "text"  — 1–3 sentence continuation\n` +
    `  "tone"  — a single descriptive word\n` +
    `  "why"   — one sentence explaining why this direction is interesting` +
    (wrapUp
      ? `\n\nIMPORTANT: Bias all 4 directions toward resolving this character's arc within the next 1–3 exchanges.`
      : "");

  const userMessage = [
    canonSummary   ? `ESTABLISHED MAIN STORY FACTS:\n${canonSummary}` : null,
    `CHARACTER: ${characterName}`,
    backstory      ? `Their background: ${backstory}` : null,
    threadPathText
      ? `Their story so far:\n${threadPathText}`
      : `This character's story is just beginning.`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const hasWatsonx =
    process.env.WATSONX_API_KEY &&
    process.env.WATSONX_API_KEY !== "your-watsonx-api-key-here" &&
    process.env.WATSONX_PROJECT_ID &&
    process.env.WATSONX_PROJECT_ID !== "your-watsonx-project-id-here";

  const hasGroq =
    process.env.GROQ_API_KEY &&
    process.env.GROQ_API_KEY !== "your-groq-api-key-here";

  // ── No credentials stub ──────────────────────────────────────────────────────
  if (!hasWatsonx && !hasGroq) {
    console.warn("[generateThreadBranches] No AI credentials — using stub data.");
    return [
      { id: crypto.randomUUID(), text: `${characterName} paused at the crossroads, weighing two paths — each carrying its own kind of cost.`, tone: "Tense",      why: "Forces the character to make a meaningful choice that reveals their values." },
      { id: crypto.randomUUID(), text: `An unexpected ally found ${characterName} in the shadows, offering help without explaining why.`,       tone: "Mysterious", why: "Introduces tension between gratitude and suspicion." },
      { id: crypto.randomUUID(), text: `${characterName} discovered a letter — old, water-stained — that answered one question and asked three more.`, tone: "Revelatory", why: "Reframes what the character thought they knew about their situation." },
      { id: crypto.randomUUID(), text: `For the first time in a long while, ${characterName} allowed themselves to rest, and the world did not end because of it.`, tone: "Hopeful", why: "Provides emotional counterweight and character development through stillness." },
    ];
  }

  // ── watsonx / Granite ────────────────────────────────────────────────────────
  if (hasWatsonx) {
    const client    = getWatsonxClient();
    const modelId   = process.env.WATSONX_MODEL_ID ?? "ibm/granite-3-8b-instruct";
    const projectId = process.env.WATSONX_PROJECT_ID!;

    const response = await client.textChat({
      modelId,
      projectId,
      messages: [
        { role: "system", content: threadSystem },
        { role: "user",   content: userMessage  },
      ],
      maxTokens:        900,
      temperature:      0.85,
      topP:             0.9,
      repetitionPenalty: 1.05,
    });

    const raw = (response.result.choices?.[0]?.message?.content ?? "").trim();
    if (!raw) throw new Error("Empty response from watsonx (thread branches)");

    const parsed = parseResponse(raw);
    if (!parsed) throw new Error(`Could not parse watsonx thread-branch response: ${raw.slice(0, 200)}`);
    return toBranchOptions(parsed);
  }

  // ── Groq fallback ────────────────────────────────────────────────────────────
  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.85,
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: threadSystem },
        { role: "user",   content: userMessage  },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Groq thread-branches error ${res.status}: ${errText}`);
  }

  const json = await res.json() as { choices?: Array<{ message?: { content?: string } }> };
  const raw  = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!raw) throw new Error("Empty response from Groq (thread branches)");

  const parsed = parseResponse(raw);
  if (!parsed) throw new Error(`Could not parse thread-branch response: ${raw.slice(0, 200)}`);
  return toBranchOptions(parsed);
}
