import type { BranchOption } from "../types";

// ─── TODO: Replace this stub with a real watsonx/Granite call ─────────────────
//
// STEP 1 — Install the IBM watsonx AI SDK
//   npm install @ibm-cloud/watsonx-ai
//
// STEP 2 — Populate .env.local (copy from .env.local.example):
//   WATSONX_API_KEY=<your IAM API key>
//   WATSONX_PROJECT_ID=<your watsonx project id>
//
// STEP 3 — Replace the stub body with the real implementation:
//
//   import WatsonxAiMlVml_v1 from "@ibm-cloud/watsonx-ai";
//   import { IamAuthenticator } from "ibm-cloud-sdk-core";
//
//   const client = WatsonxAiMlVml_v1.newInstance({
//     authenticator: new IamAuthenticator({ apikey: process.env.WATSONX_API_KEY! }),
//     serviceUrl: "https://us-south.ml.cloud.ibm.com",
//   });
//
//   function buildPrompt(pathText: string): string {
//     return [
//       "You are a creative writing partner.",
//       "Given the story so far, propose exactly 3 ways the story could continue.",
//       "Respond with ONLY a valid JSON array — no prose, no markdown fences.",
//       "Each element must have exactly these keys:",
//       '  "text"  — 1-3 sentence continuation',
//       '  "tone"  — single descriptive word (e.g. Tense, Hopeful, Mysterious)',
//       '  "why"   — one sentence explaining why this direction is interesting',
//       "",
//       "Story so far:",
//       pathText,
//     ].join("\n");
//   }
//
//   export async function generateBranches(pathText: string): Promise<BranchOption[]> {
//     const response = await client.generateText({
//       modelId: "ibm/granite-13b-instruct-v2",
//       projectId: process.env.WATSONX_PROJECT_ID!,
//       input: buildPrompt(pathText),
//       parameters: { max_new_tokens: 600, temperature: 0.85 },
//     });
//     const raw = response.result.results[0].generated_text.trim();
//     const parsed = JSON.parse(raw) as Array<{ text: string; tone: string; why: string }>;
//     return parsed.map((b) => ({ id: crypto.randomUUID(), ...b }));
//   }
//
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Given the story text accumulated along the current path, returns exactly
 * 3 branch options the story could take next.
 *
 * Currently returns hardcoded mock data so the UI can be developed and tested
 * independently of any AI credentials.
 */
export async function generateBranches(pathText: string): Promise<BranchOption[]> {
  // Suppress unused-variable warning while the parameter is not yet used.
  void pathText;

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
