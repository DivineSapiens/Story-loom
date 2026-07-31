# fAIrytalee

An AI-powered collaborative story branching experience built with IBM Granite / watsonx. Write an opening, pick a genre, receive four AI-generated directions (each with a tone badge and a **Why:** rationale), click one — and branch again from **any** node in the tree, not just the latest.

## Quick start

```bash
npm install
npx next dev
```

Open [http://localhost:3000](http://localhost:3000).

The app works immediately in demo mode with built-in stub data. Add credentials to enable real AI generation — see **Credentials** below.

---

## How to use

### Landing screen
1. **Pick a genre** (optional) — chip row: Fantasy · Sci-Fi · Mystery · Romance · Horror · Thriller · Historical · Adventure. Or type a custom genre in the text box.
2. **Write your opening** (1–3 sentences) and press **Begin story** (or `Ctrl/⌘ + Enter`). The button label shows the active genre (e.g. `Begin story · Horror`).

### Story canvas
3. Four branch cards appear at the bottom (**Choose a direction** panel) — each shows a continuation, a tone badge, and a **Why:** rationale.
4. **Three ways to interact with any node on the canvas:**
   - **Click the node body** — selects the node and highlights its path.
   - **Click `Set genre for next directions…`** — opens the per-node genre picker. Choosing a genre immediately fires a new AI call and opens the panel with genre-scoped directions. The active genre is shown as a coloured badge on the node.
   - **Click `＋ New directions`** — generates a fresh set of AI branches from that node (uses the per-node genre if set, otherwise the global genre).
   - **Click `✦ Character`** (depth ≥ 1) — opens the Create Character modal.
5. **Choose a direction panel** includes its own **Genre filter** chip row — switching genre instantly re-fetches all four directions in the new style without touching any node.
6. **Read this path** (top-right) opens a centered modal with two tabs:
   - **Story Text** — flowing prose (all nodes joined as one readable story, with drop cap and title/tagline). Listen with TTS, Copy to clipboard.
   - **Comic Strip** — AI-illustrated panels. Download as PNG comic.
7. **Logo click** — when a tree exists, clicking `fAIrytalee` prompts to start a new story (the previous tree is archived and can be restored).
8. **Wrap up story** toggle in the branch panel — AI proposes convergent directions including one `✦ The End` conclusive option.
9. **✦ Universe** tab — visual graph of all character threads and their relationships.

### Node ⋯ menu
Click the three-dot icon on any node for:
- **Edit text** — manually rewrite the node's text.
- **AI rewrite** — sends the node text + surrounding context to IBM Granite, proposes a rewrite that flows better between predecessor and successor nodes. Accept or discard.
- **Insert below** — inserts a new node between this node and its children.
- **Delete branch** — removes this node and all descendants.

---

## Credentials

All credentials live in `.env.local` — never committed, never sent to the browser.

```bash
cp .env.local.example .env.local
```

### watsonx / IBM Granite (story generation — primary)

```env
WATSONX_API_KEY=<IBM Cloud IAM API key>
WATSONX_PROJECT_ID=<watsonx.ai project ID>
WATSONX_REGION=us-south
WATSONX_MODEL_ID=ibm/granite-3-8b-instruct
```

**Getting the keys:**
1. **API key** — [cloud.ibm.com/iam/apikeys](https://cloud.ibm.com/iam/apikeys) → Create IBM Cloud API key (must be an IAM key — 44-char alphanumeric, **not** a `ApiKey-…` service-credentials key).
2. **Project ID** — [dataplatform.cloud.ibm.com/projects](https://dataplatform.cloud.ibm.com/projects) → your project → Manage → General.
3. Ensure **Watson Machine Learning** is associated with the project (Manage → Services & integrations).

### Groq (text fallback — optional)

```env
GROQ_API_KEY=gsk_…
```

Used automatically when `WATSONX_API_KEY` is absent. Get a free key at [console.groq.com/keys](https://console.groq.com/keys). Model: `llama-3.3-70b-versatile`.

### Hugging Face (image generation — optional)

```env
HUGGINGFACE_TOKEN=hf_…
```

Get a free token at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens).

Without this token, images fall back to **Pollinations.ai** (server-side, no key required). If Pollinations is also unreachable, panels display as text-only.

---

## Genre system

Genre flows through the whole app:

| Where | What happens |
|---|---|
| **Landing screen** | Preset chip or free-text input → stored in `state.genre`. Button label shows active genre. |
| **Story node** | Per-node genre picker (tag-icon button). Choosing a genre fires `onGenerateBranches(id, genre)` which opens the panel with genre-scoped directions. Active genre shown as a coloured badge (colour varies by genre). |
| **Choose a direction panel** | Genre filter chip row — changing genre dispatches `SET_GENRE` + immediately re-fetches all four directions from the selected node. Active genre shown as amber pill in the header. |
| **AI prompt** | `buildSystemPrompt(base, genre)` prepends `Genre/tone: <genre>\nAll 4 directions must stay within this genre.` to every system prompt. |

---

## Project structure

```
app/
  page.tsx                        Main page — useReducer state machine, all UI
  layout.tsx                      Root HTML shell, page title
  globals.css                     Tailwind + React Flow base styles + all keyframes
  api/
    generate-branches/route.ts    POST — returns 4 branch options (text, tone, why) — accepts genre param
    generate-thread-branches/     POST — branches for a character side-story
    rewrite-node/route.ts         POST — AI rewrite with context before/after
    summarise-story/              POST — 2-3 sentence canon summary (used in prompts)
    weave-thread/                 POST — weaves a character arc into the main story
    titlise-story/                POST — generates title + tagline for a path
    generate-image/               POST — server-side image fetch (HF → Pollinations)

components/
  StoryTree.tsx                   React Flow canvas — main tree + character threads
  StoryNodeCard.tsx               Main tree node: tone badge, genre badge, genre picker, Why tooltip
  ThreadNodeCard.tsx              Character thread node: palette border, weave button
  NodeMenu.tsx                    ⋯ menu: edit, AI rewrite, insert, prune
  BranchPanel.tsx                 4-card panel with genre filter chips (2×2 grid), refresh, wrap-up
  PathDrawer.tsx                  Centered modal: Story Text tab (prose) + Comic Strip tab (PNG)
  BackgroundScene.tsx             Animated birds + bunnies on the landing screen
  CreateThreadModal.tsx           New character thread modal
  AppearancesPanel.tsx            Shows where a character appears in the main story
  CharacterUniverseView.tsx       Character Universe tab
  UniverseGraph.tsx               React Flow graph of threads + relationships

lib/
  types.ts                        All TypeScript interfaces (StoryNode, TreeState, …)
  treeUtils.ts                    getPath, pathToText, computeLayout
  threadPalette.ts                6-colour palette + MAX_THREADS
  appearanceUtils.ts              findAppearances, splitHighlights
  ai/
    generateBranches.ts           watsonx textChat → Groq → stub; accepts genre param
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
| Story AI (primary) | [IBM watsonx AI SDK](https://github.com/IBM/ibm-generative-ai-node-sdk) — `ibm/granite-3-8b-instruct` via `textChat` |
| Story AI (fallback) | [Groq](https://groq.com) — `llama-3.3-70b-versatile` |
| Image generation | [Pollinations.ai](https://pollinations.ai) FLUX — server-side, no key required |
| Image generation (opt.) | [Hugging Face](https://huggingface.co) Inference API |
| Narration | Web Speech API — browser-native TTS |
| Comic export | HTML5 Canvas — client-side PNG composite |
