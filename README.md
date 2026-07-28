# Story Loom

An AI-powered collaborative story branching tool. Write an opening, receive three AI-generated directions the story could take (each with a rationale), pick one — and branch again from any node in the tree, not just the latest.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The app works immediately with built-in stub data. To use real AI, see **Connecting watsonx / Granite** below.

## How to use

1. **Write your opening** in the text box and press **Begin story** (or ⌘ Enter).
2. Three branch cards appear at the bottom — each shows a continuation, a tone badge, and a **Why:** rationale.
3. **Click a card** to commit it as a new node. The root-to-node path highlights in amber.
4. **Three interaction modes from any node on the canvas:**
   - **Click the node body** — if it already has children, those children reappear as the branch panel (no API call). If it has no children, it just selects the node and updates the active path.
   - **Click "＋ New directions"** inside a node — always generates a fresh set of AI branch options for that node, regardless of existing children.
   - **Click a branch card** — commits the chosen option as a new child node.
5. **Read this path** (top-right button) slides open a drawer with the full story from root to the selected node, displayed as a printed comic strip. Use **Copy** to grab the plain text.
6. **✏ Edit opening** (top-right, after the tree starts) re-expands the opening textarea. Re-submitting will show a confirmation banner before clearing the tree; the previous tree is archived and can be restored.
7. **← Back** (top-left, when a non-root node is selected) navigates up to the parent node.
8. **Visual style** — pick a chip (Watercolor storybook, Noir comic, Pop art, Cute cartoon, Manga) or type a custom style. Each node gets an illustrated panel in that style via Pollinations.ai.

## Connecting watsonx / Granite

The app auto-detects credentials at startup. Without them it uses safe stub data; with them it calls `ibm/granite-3-8b-instruct` (or the model you choose).

### 1 — Create `.env.local`

```bash
cp .env.local.example .env.local
```

Then fill in your real values:

```env
WATSONX_API_KEY=<your IBM Cloud IAM API key>
WATSONX_PROJECT_ID=<your watsonx.ai project id>

# Optional — defaults shown:
WATSONX_REGION=us-south          # eu-de | eu-gb | jp-tok | au-syd
WATSONX_MODEL_ID=ibm/granite-3-8b-instruct
```

### 2 — Restart the dev server

```bash
npm run dev
```

The server logs `[generateBranches] No watsonx credentials found — using stub data.` when the stub is active, so you can confirm the switch. The API key is only ever read server-side (inside `/api/generate-branches`) — it is never sent to the browser.

### Credential sources

The SDK supports three ways to supply credentials (in priority order):

| Method | How |
|--------|-----|
| `.env.local` | `WATSONX_API_KEY` + `WATSONX_PROJECT_ID` (recommended for local dev) |
| Environment variables | Same names, set at the OS/container level |
| `ibm-credentials.env` file | Standard IBM SDK credentials file in the project root |

## Project structure

```
app/
  page.tsx                  Main page — useReducer state machine, all UI assembly
  layout.tsx                Root HTML shell
  globals.css               Tailwind + React Flow base styles + all keyframe animations
  api/generate-branches/
    route.ts                POST endpoint — validates input, calls generateBranches()

components/
  StoryTree.tsx             React Flow canvas wrapper
  StoryNodeCard.tsx         Custom node — tone badge, text, Why, ＋ New directions, illustration
  BranchPanel.tsx           3-card options strip at the bottom (quill loading animation)
  PathDrawer.tsx            Right-side drawer — comic-strip story path + Copy button

lib/
  types.ts                  TypeScript interfaces: BranchOption, StoryNode, TreeState, TreeSnapshot
  treeUtils.ts              Pure utilities: getPath, pathToText, computeLayout
  ai/
    generateBranches.ts     Real watsonx/Granite call with stub fallback
    generateImage.ts        Pollinations.ai image URL builder (tone-aware, deterministic seed)
```

## Tech stack

- [Next.js 14](https://nextjs.org) (App Router, TypeScript)
- [React Flow (`@xyflow/react`)](https://reactflow.dev) — canvas, pan/zoom, edges
- [Tailwind CSS](https://tailwindcss.com)
- [IBM watsonx AI SDK (`@ibm-cloud/watsonx-ai`)](https://github.com/IBM/ibm-generative-ai-node-sdk) — `ibm/granite-3-8b-instruct` by default
- [Pollinations.ai](https://pollinations.ai) — free, no-key image generation for node illustrations
