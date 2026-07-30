# fAIrytalee

An AI-powered collaborative story branching experience. Write an opening, receive four AI-generated directions the story could take (each with a tone and a "Why:" rationale), pick one — and branch again from **any** node in the tree, not just the latest.

## Quick start

```bash
npm install
npx next dev
```

Open [http://localhost:3000](http://localhost:3000).

The app works immediately in demo mode with built-in stub data. Add credentials to enable real AI generation — see **Credentials** below.

---

## How to use

1. **Write your opening** in the text box, optionally pick a visual style chip, and press **Begin story** (or `Ctrl/⌘ + Enter`).
2. Four branch cards appear at the bottom — each shows a continuation, a tone badge, and a **Why:** rationale explaining the creative direction.
3. **Click a card** to commit it as a new node. The root-to-node path highlights in amber.
4. **Three ways to interact with any node on the canvas:**
   - **Click the node body** — selects the node and highlights its path. If the node already has children, those children appear as branch options (no API call).
   - **Click `＋ New directions`** — always generates a fresh set of AI branches for that node, regardless of existing children.
   - **Click `✦ Character`** (depth ≥ 1) — opens the Create Character modal to start a side-story thread from that point.
5. **Read this path** (top-right) slides open a drawer showing the full story as a comic strip, with AI-generated illustrations per panel. Use **Copy** to grab the plain text or **↓ Save** to download as a PNG comic.
6. **Logo click** — when a tree exists, clicking `fAIrytalee` in the top bar prompts to start a new story (the previous tree is archived and can be restored).
7. **Wrap up story** toggle in the branch panel — asks the AI to propose directions that converge toward an ending, including one `✦ The End` conclusive option.
8. **✦ Universe** tab — a visual graph of all character threads, their relationships, and where each character appears in the main story.

---

## Credentials

All credentials live in `.env.local` — never committed, never sent to the browser.

```bash
cp .env.local.example .env.local
```

### watsonx / IBM Granite (story generation)

```env
WATSONX_API_KEY=<IBM Cloud IAM API key>
WATSONX_PROJECT_ID=<watsonx.ai project ID>
WATSONX_REGION=us-south
WATSONX_MODEL_ID=ibm/granite-3-8b-instruct
```

**Getting the keys:**
1. **API key** — [cloud.ibm.com/iam/apikeys](https://cloud.ibm.com/iam/apikeys) → Create IBM Cloud API key (must be an IAM key — not a service credentials `ApiKey-…` key).
2. **Project ID** — [dataplatform.cloud.ibm.com/projects](https://dataplatform.cloud.ibm.com/projects) → your project → Manage → General.
3. Ensure **Watson Machine Learning** is associated with the project (Manage → Services & integrations).

Without `WATSONX_API_KEY`, the app falls back to Groq (`GROQ_API_KEY`) and then to built-in stub data.

### Hugging Face (image generation — optional)

```env
HUGGINGFACE_TOKEN=hf_…
```

Get a free token at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens) — scope: *Make calls to the serverless Inference API*.

Without this token, images fall back to **Pollinations.ai** (server-side fetch, no key required). If Pollinations is also unreachable, panels display as text-only.

### Groq (text fallback — optional)

```env
GROQ_API_KEY=gsk_…
```

Used automatically when `WATSONX_API_KEY` is absent. Get a free key at [console.groq.com/keys](https://console.groq.com/keys).

---

## Project structure

```
app/
  page.tsx                        Main page — useReducer state machine, all UI
  layout.tsx                      Root HTML shell, page title
  globals.css                     Tailwind + React Flow base styles + all keyframes
  api/
    generate-branches/route.ts    POST — returns 4 branch options (text, tone, why)
    generate-thread-branches/     POST — branches for a character side-story
    summarise-story/              POST — 2-3 sentence canon summary (used in prompts)
    weave-thread/                 POST — weaves a character arc into the main story
    titlise-story/                POST — generates title + tagline for a path
    generate-image/               POST — server-side image fetch (HF → Pollinations)

components/
  StoryTree.tsx                   React Flow canvas — main tree + character threads
  StoryNodeCard.tsx               Main tree node: tone badge, Why tooltip, actions
  ThreadNodeCard.tsx              Character thread node: palette border, weave button
  NodeMenu.tsx                    ⋯ overflow menu: edit, insert, prune
  BranchPanel.tsx                 4-card options panel (2×2 grid), refresh, wrap-up
  PathDrawer.tsx                  Right drawer: comic strip, TTS, PNG download
  BackgroundScene.tsx             Animated birds + bunnies on the landing screen
  CreateThreadModal.tsx           New character thread modal (name, backstory, relation)
  AppearancesPanel.tsx            Shows where a character appears in the main story
  CharacterUniverseView.tsx       Character Universe tab with inline thread editing
  UniverseGraph.tsx               React Flow graph of threads + relationship edges
  UniverseAppearancesDrawer.tsx   Appearances detail drawer within Universe tab
  CharacterUniverseNode.tsx       Universe tab node card

lib/
  types.ts                        All TypeScript interfaces (StoryNode, TreeState, …)
  treeUtils.ts                    getPath, pathToText, computeLayout, computeThreadLayout
  threadPalette.ts                6-colour palette + MAX_THREADS constant
  appearanceUtils.ts              findAppearances, splitHighlights helpers
  ai/
    generateBranches.ts           watsonx textChat → Groq → stub
    summariseStory.ts             watsonx textChat → Groq → stub
    generateWeavedNode.ts         watsonx textChat → Groq → stub
    titliseStory.ts               watsonx textChat → Groq → stub
    generateImage.ts              buildImagePrompt() + hashId() helpers
```

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 14](https://nextjs.org) — App Router, TypeScript |
| Canvas | [`@xyflow/react`](https://reactflow.dev) v12 — pan/zoom, nodes, edges |
| Styling | [Tailwind CSS](https://tailwindcss.com) |
| Story AI | [IBM watsonx AI SDK](https://github.com/IBM/ibm-generative-ai-node-sdk) — `ibm/granite-3-8b-instruct` |
| Story AI fallback | [Groq](https://groq.com) — `llama-3.3-70b-versatile` |
| Image generation | [Pollinations.ai](https://pollinations.ai) FLUX — server-side, no key required |
| Image generation (optional) | [Hugging Face](https://huggingface.co) Inference API — SD 2.1 |
| Narration | Web Speech API — browser-native TTS |
| Comic export | HTML5 Canvas — client-side PNG composite |
