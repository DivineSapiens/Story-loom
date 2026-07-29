/**
 * Generates a 2–3 sentence plain-text summary of the story's established facts.
 *
 * Called fire-and-forget after every main-tree commit (including root set).
 * Stored in TreeState.canonSummary.
 * Used as context in character-thread prompts and weave prompts.
 *
 * Design decisions:
 *   - Plain text response (NOT json_object) — no unwrapping needed.
 *   - Low temperature (0.3) for factual, consistent summaries.
 *   - Small token budget (200) — this must be fast, it never blocks the user.
 *   - Silent failure is acceptable: the weave prompt degrades gracefully.
 */

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL   = "llama-3.3-70b-versatile";

const SYSTEM = `You are a story archivist.
Given the story so far, write a concise 2–3 sentence summary of the established facts:
key characters introduced, main events that have occurred, and the overall tone.
Write in present tense. Plain prose only — no bullet points, no JSON, no markdown.`;

export async function summariseStory(pathText: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === "your-groq-api-key-here") {
    // No key — return a best-effort stub so threads still work in demo mode.
    return `The story follows characters navigating an unfolding situation. ` +
           `Key events and relationships are developing. ` +
           `The tone shifts as circumstances evolve.`;
  }

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
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

  const json = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const summary = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!summary) throw new Error("Empty summary response from Groq");
  return summary;
}
