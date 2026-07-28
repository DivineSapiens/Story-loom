# Story Loom

An AI-powered collaborative story branching tool. Write an opening, receive three AI-generated directions the story could take (each with a rationale), pick one — and branch again from any node in the tree, not just the latest.

## Quick start

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How to use

1. **Write your opening** in the text box and press **Begin story** (or ⌘ Enter).
2. Three branch cards appear at the bottom — each shows a continuation, a tone badge, and a **Why:** rationale.
3. **Click a card** to commit it as a new node. The root-to-node path highlights in amber.
4. **Three interaction modes from any node on the canvas:**
   - **Click the node body** — if it already has children, those children reappear as the branch panel (no API call). If it has no children, it just selects the node and updates the active path.
   - **Click "＋ New directions"** inside a node — always generates a fresh set of AI branch options for that node, regardless of existing children.
   - **Click a branch card** — commits the chosen option as a new child node.
5. **Read this path** (top-right button) slides open a drawer with the full story from root to the selected node. Use **Copy** to grab the text.
6. **✏ Edit opening** (top-right, after the tree starts) re-expands the opening textarea. Re-submitting will show a confirmation banner before clearing the tree.

## Wiring watsonx / Granite AI

The branch generation is currently stubbed with hardcoded mock data in [`lib/ai/generateBranches.ts`](lib/ai/generateBranches.ts). To wire the real model:

1. Install the IBM watsonx AI SDK:
   ```bash
   npm install @ibm-cloud/watsonx-ai
   ```

2. Copy `.env.local.example` to `.env.local` and fill in your credentials:
   ```
   WATSONX_API_KEY=<your IAM API key>
   WATSONX_PROJECT_ID=<your watsonx project id>
   ```

3. Open `lib/ai/generateBranches.ts` and follow the **STEP 1 / 2 / 3** comments at the top — the full replacement implementation is included there as a code comment, ready to uncomment.

The API key is only ever read server-side (inside the Next.js API route `/api/generate-branches`) — it is never sent to the browser.

## Project structure

```
app/
  page.tsx                  Main page — useReducer state machine, all UI assembly
  layout.tsx                Root HTML shell
  globals.css               Tailwind + React Flow base styles
  api/generate-branches/
    route.ts                POST endpoint — validates input, calls generateBranches()

components/
  StoryTree.tsx             React Flow canvas wrapper
  StoryNodeCard.tsx         Custom node — tone badge, text, Why, ＋ New directions
  BranchPanel.tsx           3-card options strip at the bottom (loading skeletons included)
  PathDrawer.tsx            Right-side drawer — story path text + Copy button

lib/
  types.ts                  TypeScript interfaces: BranchOption, StoryNode, TreeState
  treeUtils.ts              Pure utilities: getPath, pathToText, computeLayout
  ai/
    generateBranches.ts     Stubbed AI function — swap point for watsonx
```

## Tech stack

- [Next.js 14](https://nextjs.org) (App Router, TypeScript)
- [React Flow (@xyflow/react)](https://reactflow.dev) — canvas, pan/zoom, edges
- [Tailwind CSS](https://tailwindcss.com)
- IBM watsonx / Granite (stubbed — see above to wire)
