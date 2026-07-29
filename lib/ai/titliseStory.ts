/**
 * Generates a short title (3–6 words) and a one-line tagline for a story path.
 *
 * Called once per "Read this path" open, cached by path key in the drawer.
 * Returns { title, tagline } as JSON.
 *
 * Design decisions:
 *   - json_object mode → unwrap the first string values found.
 *   - Low-ish temperature (0.7) for vivid but consistent results.
 *   - 80 token budget — title + tagline is tiny.
 *   - Silent / stub fallback when no API key is present.
 */

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL   = "llama-3.3-70b-versatile";

const SYSTEM = `You are a literary editor.
Given a short story, produce a title and tagline.
Respond with ONLY valid JSON — no prose, no markdown, no code fences.
Return exactly this shape:
{ "title": "3–6 word title", "tagline": "One evocative sentence (max 12 words)." }`;

export interface StoryTitle {
  title: string;
  tagline: string;
}

export async function titliseStory(pathText: string): Promise<StoryTitle> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === "your-groq-api-key-here") {
    return { title: "An Untitled Story", tagline: "Every path has a name — add your API key to find it." };
  }

  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
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

  const json = await res.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const raw = json.choices?.[0]?.message?.content?.trim() ?? "";
  if (!raw) throw new Error("Empty titlise response from Groq");

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const title   = typeof parsed.title   === "string" ? parsed.title.trim()   : "";
    const tagline = typeof parsed.tagline === "string" ? parsed.tagline.trim() : "";
    if (title && tagline) return { title, tagline };
  } catch { /* fall through */ }

  throw new Error(`Could not parse titlise response: ${raw.slice(0, 200)}`);
}
