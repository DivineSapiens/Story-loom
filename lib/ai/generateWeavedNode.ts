/**
 * Generates a single main-tree continuation node that weaves a character thread
 * into the main narrative.
 *
 * Returns { text, tone, why } — the caller adds id and parentId before committing.
 *
 * The prompt is structured to:
 *   1. Ground the model in the main story's established facts (canonSummary).
 *   2. Show the main story's current path text (for immediate narrative context).
 *   3. Present the character's arc (backstory + full thread text).
 *   4. Identify the specific thread node being woven in.
 *   5. Ask for ONE organic main-story continuation paragraph.
 */

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL   = "llama-3.3-70b-versatile";

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

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === "your-groq-api-key-here") {
    // Stub for demo mode.
    return {
      text: `${characterName} appeared at the threshold, their presence shifting ` +
            `the weight of the moment in ways no one had anticipated.`,
      tone: "Revelatory",
      why: `Brings ${characterName}'s parallel arc into direct contact with the main story.`,
    };
  }

  const userMessage = [
    canonSummary
      ? `ESTABLISHED STORY FACTS:\n${canonSummary}`
      : null,
    `MAIN STORY SO FAR:\n${mainPathText}`,
    `CHARACTER BEING WOVEN IN: ${characterName}`,
    backstory ? `Their background: ${backstory}` : null,
    threadPathText ? `Their side story so far:\n${threadPathText}` : null,
    `The specific moment to weave in:\n${threadNodeText}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
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

  const json = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!raw) throw new Error("Empty weave response from Groq");

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Could not parse weave response: ${raw.slice(0, 200)}`);
  }

  if (
    typeof parsed !== "object" || parsed === null ||
    typeof (parsed as Record<string, unknown>).text !== "string" ||
    typeof (parsed as Record<string, unknown>).tone !== "string" ||
    typeof (parsed as Record<string, unknown>).why  !== "string"
  ) {
    throw new Error(`Unexpected weave response shape: ${raw.slice(0, 200)}`);
  }

  return parsed as WeavedNodeResult;
}
