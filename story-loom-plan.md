# Story Loom — Implementation Plan

## Top-Level Overview

Build **Story Loom** — a Next.js full-stack app where a user writes a story opening, receives 3 AI-generated branch options (each with text, tone, and why), clicks one to commit it as a tree node, and can branch again from any existing node. The whole story lives as a visual, pannable/zoomable tree rendered with React Flow.

**Approach:**
- Single Next.js project (TypeScript + Tailwind CSS) — frontend pages/components + one API route.
- AI call stubbed with hardcoded mock JSON behind a single `generateBranches(pathText)` function — swap-ready for watsonx/Granite later.
- React Flow (`@xyflow/react`) drives the canvas: nodes, edges, pan, zoom. We supply positions via a simple fixed-gap top-down layout.
- No auth, no persistence across sessions — all state lives in React (`useState`/`useReducer`).

---

## Sub-Tasks

---

### Sub-Task 1 — Project Scaffold

**Intent**  
Create the Next.js project with all required dependencies so every subsequent sub-task has a runnable baseline to build on.

**Expected Outcomes**
- `package.json` declares all dependencies: `next`, `react`, `react-dom`, `@xyflow/react`, `tailwindcss`, `postcss`, `autoprefixer`, and their dev-type counterparts.
- `tailwind.config.ts` and `postcss.config.js` are configured with the `app/` and `components/` content globs.
- `app/layout.tsx` provides the root HTML shell with the Tailwind base styles.
- `app/globals.css` includes the Tailwind directives.
- `app/page.tsx` renders a placeholder (`<h1>Story Loom</h1>`) — enough to confirm `npm run dev` works.
- A `.env.local.example` file lists `WATSONX_API_KEY` and `WATSONX_PROJECT_ID` as placeholders (never populated with real values in the repo).

**Todo List**
1. Create `package.json` with the dependency list above and scripts `dev`, `build`, `start`, `lint`.
2. Create `tsconfig.json` for Next.js TypeScript defaults.
3. Create `tailwind.config.ts` with content paths covering `app/**` and `components/**`.
4. Create `postcss.config.js`.
5. Create `app/layout.tsx` — root layout, imports `globals.css`.
6. Create `app/globals.css` — Tailwind directives (`@tailwind base/components/utilities`).
7. Create `app/page.tsx` — placeholder heading.
8. Create `.env.local.example` with the two watsonx key placeholders.
9. Create `next.config.js` (minimal, empty config object).

**Relevant Context**
- No existing code — pure greenfield.
- Next.js App Router convention (`app/` directory).

**Status:** [ ] pending

---

### Sub-Task 2 — Data Model & State

**Intent**  
Define the core TypeScript types and the React state shape that every other component will read from. Getting this right early prevents type churn in later sub-tasks.

**Expected Outcomes**
- `lib/types.ts` exports:
  - `BranchOption { id, text, tone, why }` — one AI-generated proposal.
  - `StoryNode { id, text, tone, why, parentId: string | null, depth: number, siblingIndex: number }` — a committed node in the tree.
  - `TreeState { nodes: StoryNode[], pendingOptions: BranchOption[] | null, selectedNodeId: string | null, activePathIds: string[], isLoading: boolean, drawerOpen: boolean, openingCollapsed: boolean }` — the complete app state. `drawerOpen` drives the "Read this path" side-drawer; `openingCollapsed` tracks whether the opening input accordion is collapsed.
- `lib/treeUtils.ts` exports pure utility functions:
  - `getPath(nodes, nodeId): StoryNode[]` — returns the root-to-node ordered list.
  - `pathToText(path: StoryNode[]): string` — concatenates node texts into a clean story block.
  - `computeLayout(nodes: StoryNode[]): Record<string, {x, y}>` — assigns React Flow `{x, y}` positions using a fixed horizontal gap (e.g. 220 px) between siblings and a fixed vertical gap (e.g. 160 px) per depth level. Uses a BFS/DFS over the node array. **Critically, it groups all siblings under each parent by their `parentId`, counts them, and distributes their x-positions symmetrically around the parent's x so that adding a new sibling re-centers the whole group — nodes never overlap regardless of how many `＋ New directions` cycles have been run from the same parent.**
- All types are pure; no React imports here.

**Todo List**
1. Create `lib/types.ts` with the three exported interfaces above.
2. Create `lib/treeUtils.ts` with `getPath`, `pathToText`, and `computeLayout`.
3. Write each utility as a plain function operating on the `StoryNode[]` array with no side effects.

**Relevant Context**
- `computeLayout` must produce stable positions — given the same node list, same positions — so React Flow doesn't re-animate on every render.
- Sibling x-positions are computed as: `parentX + (siblingIndex - (siblingCount - 1) / 2) * H_GAP`, where `siblingIndex` is the node's 0-based index among its siblings sorted by `siblingIndex`. This formula re-centers all siblings when a new one is added.
- `activePathIds` will drive the highlighted edge/node styling in React Flow.

**Status:** [ ] pending

---

### Sub-Task 3 — API Route: `/api/generate-branches`

**Intent**  
Create the server-side endpoint that accepts the current story path text and returns exactly 3 branch options as JSON. The AI call is stubbed; the endpoint contract (request/response shape) is real.

**Expected Outcomes**
- `app/api/generate-branches/route.ts` handles `POST` requests.
- Request body: `{ pathText: string }`.
- Response: `{ branches: BranchOption[] }` — always exactly 3 items.
- `lib/ai/generateBranches.ts` contains the isolated `generateBranches(pathText: string): Promise<BranchOption[]>` function — currently returns hardcoded mock data (3 objects with distinct `text`, `tone`, `why` values that are clearly different from each other so the UI is testable).
- The route imports from `lib/ai/generateBranches.ts` and does nothing else AI-related — it only validates input, calls the function, and returns the JSON response.
- A comment block at the top of `generateBranches.ts` marks where the real watsonx call will go, and lists the environment variables it will read (`WATSONX_API_KEY`, `WATSONX_PROJECT_ID`).

**Todo List**
1. Create `lib/ai/generateBranches.ts` with the stub implementation and comment block.
2. Create `app/api/generate-branches/route.ts` that POST-handles the request, calls `generateBranches`, and returns JSON.
3. Return a `400` if `pathText` is missing or empty.

**Relevant Context**
- `BranchOption` is defined in `lib/types.ts` (Sub-Task 2).
- Keep this file server-only (never imported by client components) so the future API key stays safe.

**Status:** [ ] pending

---

### Sub-Task 4 — Tree Canvas Component

**Intent**
Build the main visual tree using React Flow. It renders committed `StoryNode` items as custom nodes, draws parent→child edges, highlights the active path, and calls back when a node is clicked or when the user requests new branches.

**Expected Outcomes**
- `components/StoryTree.tsx` is a React client component (`"use client"`).
- Props: `{ nodes: StoryNode[], activePathIds: string[], onNodeClick: (nodeId: string) => void, onGenerateBranches: (nodeId: string) => void }`.
- Uses `computeLayout` from `lib/treeUtils.ts` to derive `{x, y}` for each node before passing to React Flow.
- Custom node type `StoryNodeCard` (defined in same file or `components/StoryNodeCard.tsx`):
  - Displays `node.tone` as a small pill badge at top.
  - Displays `node.text` as the main body.
  - When the node is on the active path, renders with a highlighted border (e.g. `ring-2 ring-amber-400`).
  - **Single click** on the node body: fires `onNodeClick(node.id)` — selects the node, updates the active path, and if the node **already has children** in the tree, shows those existing children as the branch options panel (no API call). If the node has **no children**, shows the branch panel empty/idle.
  - A small **"＋ New directions"** button rendered inside the card (always visible): fires `onGenerateBranches(node.id)` — always triggers a fresh API call regardless of existing children, allowing deliberate re-generation from that node.
- Edges: plain bezier edges; edges on the active path use a distinct stroke color (e.g. amber).
- React Flow `fitView` is called on initial render; the canvas pans to newly added nodes using React Flow's `setCenter`/`fitView` after generation.
- Pan and zoom are enabled (React Flow defaults).

**Todo List**
1. Create `components/StoryNodeCard.tsx` — the custom node component used by React Flow. Accepts React Flow's `NodeProps` plus the `StoryNode` data payload. Include the node-body click handler and the "＋ New directions" button.
2. Create `components/StoryTree.tsx` — wires `computeLayout`, builds the `nodes` and `edges` arrays React Flow expects, marks active-path nodes/edges, registers the custom node type, and attaches both `onNodeClick` and `onGenerateBranches` callbacks (passed into each node's `data` payload so the custom node can call them).
3. Ensure the React Flow wrapper has a fixed height (e.g. `h-[calc(100vh-120px)]`) so it fills the viewport.

**Relevant Context**
- React Flow requires a parent with explicit `width` and `height`.
- Active path edges are identified by checking if both `source` and `target` of an edge are in `activePathIds`.
- `@xyflow/react` (v12+) API — use `ReactFlow`, `Background`, `Controls`, `MiniMap` imports from that package.

**Status:** [ ] pending

---

### Sub-Task 5 — Branch Options Panel

**Intent**  
When the user clicks a node (or submits the opening), show the 3 AI-generated branch cards below/beside the canvas. Each card shows the continuation text, tone badge, and "Why:" rationale. Clicking a card commits it.

**Expected Outcomes**
- `components/BranchPanel.tsx` is a React client component.
- Props: `{ options: BranchOption[] | null, isLoading: boolean, onSelect: (option: BranchOption) => void }`.
- When `isLoading` is true: renders a 3-card skeleton/spinner layout (3 pulse-animated placeholder cards).
- When `options` is null and not loading: renders nothing (empty fragment).
- When `options` is populated: renders 3 cards in a horizontal row.
- Each card:
  - Tone badge (pill, single word) at top-right.
  - Continuation text (main body, 1-3 sentences).
  - A visually distinct "Why:" line at the bottom in muted text.
  - Hover effect and cursor pointer.
  - On click: calls `onSelect(option)` and the panel closes (parent resets `pendingOptions` to null).

**Todo List**
1. Create `components/BranchPanel.tsx` with the three display states (loading, empty, populated).
2. Style with Tailwind — cards should be visually distinct from the tree nodes (e.g. white cards with shadow on a dark panel background).

**Relevant Context**
- `BranchOption` from `lib/types.ts`.
- The panel sits below the tree canvas in the page layout; it does not overlap the canvas.

**Status:** [ ] pending

---

### Sub-Task 6 — Main Page: Wiring State & Flow Together

**Intent**
Assemble all components in `app/page.tsx`, manage the full `TreeState` with `useReducer`, and implement every user interaction: submit opening → generate branches → select branch → grow tree, plus the three new behaviours from the design decisions.

**Expected Outcomes**
- `app/page.tsx` is a client component (`"use client"`).
- State managed with `useReducer` using `TreeState` as the shape (includes `drawerOpen` and `openingCollapsed`).
- **Submit opening:** user types into a `<textarea>` and clicks "Begin Story". Creates the root `StoryNode` (depth 0, no parent), collapses the opening input (`openingCollapsed: true`), immediately calls `/api/generate-branches`, sets `isLoading`, populates `pendingOptions` on success.
- **Opening input accordion:** a small "✏ Edit opening" toggle in the top bar re-expands the textarea (`openingCollapsed: false`) so the user can see/copy the original text. Re-submitting replaces the root node and resets the entire tree.
- **Click existing node (body click):** sets `selectedNodeId` → updates `activePathIds`. If the clicked node **already has children** in `nodes`, derives `BranchOption`-shaped previews from those children and populates `pendingOptions` directly (no API call, no loading state). If the node has no children, clears `pendingOptions` (panel goes idle).
- **"＋ New directions" button on a node:** always triggers `fetchBranches` for that node's path — produces fresh AI suggestions regardless of existing children; dispatches `SET_LOADING` then `SET_OPTIONS`.
- **Select branch (commit node):** a `BranchOption` is chosen from `BranchPanel` → new `StoryNode` created with `siblingIndex = (count of existing children of that parent)` → appended to `nodes` → `activePathIds` updated → `pendingOptions` cleared (panel goes idle; no auto-fetch after commit — user must click "＋ New directions" or click the node to branch again). Because `computeLayout` re-spaces all siblings symmetrically, the canvas automatically re-distributes existing children when the new sibling appears.
- **"Read this path" side-drawer:** a button in the top bar (`drawerOpen: true`) slides in a right-side drawer containing the stitched story text from `pathToText(activePath)`. The drawer has a close button (`drawerOpen: false`) and a "Copy to clipboard" button. It does not block or overlay the tree canvas (use a fixed right panel that pushes or overlays depending on viewport).
- **Re-submit opening confirmation:** when the user clicks "Begin Story" via "✏ Edit opening" and `nodes.length > 0`, the reducer must NOT immediately reset. Instead it dispatches a `CONFIRM_RESET` action that sets a `pendingReset: true` flag in state. The page renders a simple inline confirmation banner: "This will clear your current story tree — continue?" with "Yes, start over" and "Cancel" buttons. "Yes, start over" dispatches `COMMIT_RESET` (wipes nodes, options, activePathIds, resets openingCollapsed to false). "Cancel" dispatches `CANCEL_RESET` (clears `pendingReset`, keeps everything). No browser `confirm()` dialog — keep it in-React.
- Layout: top bar with "Story Loom" title + "✏ Edit opening" toggle + "Read this path" button; main area = `StoryTree` (fills remaining height); bottom panel = `BranchPanel` (fixed height strip, hidden when options are null and not loading).

**Todo List**
1. Define the `useReducer` reducer with actions: `SET_ROOT`, `ADD_NODE`, `SELECT_NODE`, `SET_OPTIONS`, `SET_LOADING`, `SHOW_EXISTING_CHILDREN`, `TOGGLE_DRAWER`, `TOGGLE_OPENING`, `CONFIRM_RESET`, `COMMIT_RESET`, `CANCEL_RESET`. Add `pendingReset: boolean` to `TreeState`.
2. Implement `fetchBranches(nodeId)` async helper — computes `pathText` from current state, POSTs to `/api/generate-branches`, dispatches `SET_OPTIONS`.
3. Implement `showExistingChildren(nodeId)` — reads children from `nodes`, maps them to `BranchOption` shape, dispatches `SHOW_EXISTING_CHILDREN` (no fetch).
4. Render the opening textarea accordion (visible when `!openingCollapsed` OR `nodes.length === 0`); show "✏ Edit opening" toggle in top bar once root exists.
5. Wire `StoryTree` `onNodeClick` → `SELECT_NODE` + either `showExistingChildren` (if children exist) or clear panel.
6. Wire `StoryTree` `onGenerateBranches` → `fetchBranches`.
7. Wire `BranchPanel` `onSelect` → `ADD_NODE` only (no auto-fetch).
8. Create `components/PathDrawer.tsx` — a fixed right-side panel, hidden when `drawerOpen: false`, showing `pathToText` result with a "Copy" button and close "✕" button.
9. Wire "Read this path" top-bar button → `TOGGLE_DRAWER`.

**Relevant Context**
- `getPath`, `pathToText` from `lib/treeUtils.ts`.
- `StoryNode` IDs: use `crypto.randomUUID()`.
- The root node has `parentId: null`, `tone: "Opening"`, `why: ""`.
- When mapping existing children back to `BranchOption` shape for `SHOW_EXISTING_CHILDREN`, use the child's `id`, `text`, `tone`, `why` directly — they already have those fields.
- `SHOW_EXISTING_CHILDREN` must NOT trigger a loading state; it just swaps `pendingOptions` with the derived list.
- `siblingIndex` on a new node = number of existing children of the same parent at commit time (0-based). `computeLayout` uses this for the symmetric spacing formula.
- `pendingReset: boolean` is added to `TreeState`; starts `false`. The confirmation banner is only shown when `pendingReset === true`.

**Status:** [ ] pending

---

### Sub-Task 7 — Polish & Integration Check

**Intent**
Apply final visual polish, verify the full end-to-end flow works in `npm run dev`, and ensure the watsonx swap point is clearly documented.

**Expected Outcomes**
- App title/logo in top bar is styled (e.g. gradient text or simple bold serif).
- Empty state (before opening is submitted) shows a centered hero prompt: "Where does your story begin?"
- Loading state during branch generation shows the 3-card skeleton strip.
- "Read this path" side-drawer slides in smoothly (CSS transition), has a close "✕" button and a "Copy to clipboard" button.
- Opening input accordion collapses/expands with a smooth height transition.
- The `generateBranches.ts` file has a clear `// TODO: replace stub with watsonx call` comment with a code-comment showing the expected watsonx request shape.
- `README.md` documents: how to run (`npm install && npm run dev`), how to wire watsonx (set `.env.local` keys, replace the stub), the three interaction modes (click node body / click "＋ New directions" / select branch), and a brief description of the project.
- No TypeScript errors on `npm run build`.

**Todo List**
1. Polish the top bar, empty state, opening accordion, and side-drawer styling.
2. Add the watsonx replacement comment block to `generateBranches.ts`.
3. Write `README.md` including the three interaction modes.
4. Verify all imports and types are consistent across all files.

**Relevant Context**
- All prior sub-tasks must be complete before this one.
- The build check is the acceptance gate.

**Status:** [x] done

---

## File Map (Final)

```
/
├── app/
│   ├── layout.tsx
│   ├── globals.css
│   ├── page.tsx                        ← Sub-Task 6
│   └── api/
│       └── generate-branches/
│           └── route.ts               ← Sub-Task 3
├── components/
│   ├── StoryTree.tsx                   ← Sub-Task 4
│   ├── StoryNodeCard.tsx               ← Sub-Task 4
│   ├── BranchPanel.tsx                 ← Sub-Task 5
│   └── PathDrawer.tsx                  ← Sub-Task 6
├── lib/
│   ├── types.ts                        ← Sub-Task 2
│   ├── treeUtils.ts                    ← Sub-Task 2
│   └── ai/
│       └── generateBranches.ts         ← Sub-Task 3
├── .env.local.example
├── next.config.js
├── package.json
├── tailwind.config.ts
├── postcss.config.js
├── tsconfig.json
└── README.md
```
