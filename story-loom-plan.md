# fAIrytalee — Implementation Notes

## What was built

**fAIrytalee** is a Next.js full-stack app where a user writes a story opening, selects an optional genre, receives four AI-generated branch options (each with text, tone tag, and a "Why:" rationale), clicks one to commit it as a tree node, and can branch again from any existing node. The whole story lives as a visual, pannable/zoomable tree rendered with React Flow.

---

## Architecture

- **Frontend:** Next.js 14 App Router, TypeScript, Tailwind CSS, `@xyflow/react` v12
- **State:** Single `useReducer` in `app/page.tsx` — no external state library
- **AI:** Server-only API routes — credentials never sent to the browser
- **AI provider priority:** watsonx/IBM Granite (`ibm/granite-3-8b-instruct`) → Groq (`llama-3.3-70b-versatile`) → built-in stub data
- **Image provider priority:** Hugging Face (if token set) → Pollinations.ai (server-side) → Picsum placeholder
- **No auth, no persistence** across page refresh

---

## Key implementation decisions

### watsonx integration
All AI functions use the IBM watsonx SDK's `textChat` API — **not** `generateText`. Granite-3-instruct models require structured `system`/`user` chat turns to follow JSON-output instructions. Generation parameters are **top-level camelCase** on the `TextChatParams` object (`maxTokens`, `topP`, `repetitionPenalty`) — **not** nested under a `parameters` key. Response content is at `response.result.choices?.[0]?.message?.content`.

### Genre system
Genre flows as a string through the entire pipeline:

1. **`state.genre`** — global genre stored in the reducer. Set by the landing screen chip picker, the per-node genre picker, and the in-panel genre filter row.
2. **`buildSystemPrompt(base, genre)`** in `generateBranches.ts` — prepends `Genre/tone: <genre>\nAll 4 directions must stay within this genre.` before every system prompt. Empty genre = no constraint.
3. **Per-node genre picker** in `StoryNodeCard` — a tag-icon dropdown showing preset genres. Selecting a genre immediately calls `onGenerateBranches(id, genre)` which opens the BranchPanel with genre-scoped suggestions and shows a coloured genre badge on the node.
4. **BranchPanel genre filter row** — chip row below the "Choose a direction" heading. Changing genre dispatches `SET_GENRE` + immediately re-fetches all four directions from the currently-selected node via `fetchBranches(selId, ns, newGenre)`.

### Image generation
Images are fetched **server-side** via `/api/generate-image` — HF token never exposed to client. Route tries HF → Pollinations (`model=flux`, **no `enhance=true`**) → Picsum. Returns a base64 `data:image/jpeg;base64,…` URL.

### React Flow v12 pointer events
`elementsSelectable={false}` sets `pointer-events: none` on RF node wrappers. Interactive elements inside nodes need `style={{ pointerEvents: "all" }}` on the card div and `className="nopan"` on every button so RF's drag handler passes events through.

### PathDrawer — centered modal
The PathDrawer is a **centered modal** (not a right slide-in drawer). It is only mounted when open (`{isOpen && ...}`) — this is critical: if rendered when closed it would sit over the canvas with `pointer-events-auto` and swallow all clicks/keystrokes on the landing page.

Two tabs:
- **Story Text** — flowing prose, one `<p>` per node, drop cap on first paragraph, AI title/tagline at top, `∗ ∗ ∗` ornament at bottom. TTS and Copy controls in the toolbar.
- **Comic Strip** — AI-illustrated panels (Pollinations), Download PNG button only.

### BranchPanel "Skip, let AI pick"
`pickBestOption()` scores the current options array client-side against 16 momentum keywords in the `why` rationale (stakes, tension, reveals, conflict, etc.) and commits the highest-scoring non-ending option — no extra API call needed.

### NodeMenu AI rewrite
Calls `/api/rewrite-node` with `nodeText`, `textBefore` (ancestor text), and `textAfter` (children text). The API returns `{ text }` (not `{ rewrittenText }`). The proposal is shown in an editable textarea; Accept calls `onEdit(trimmed)`.

### Branch panel
The `＋ New directions` button is the primary way to generate branches. Clicking the node body selects the node but does not auto-fetch. Selecting a genre from the node's genre picker *does* auto-fetch (because the user intent is to see genre-specific directions).

### Wrap-up / endings
A `WRAP_UP_SYSTEM` prompt returns 4 options (3 penultimate, 1 conclusive with `isEnding: true`). Ending nodes show `✦ The End`, golden ring, no branching buttons, auto-open PathDrawer on commit.

### Character Universe
Up to 6 character threads, each with a palette colour, backstory, and optional relationship. Thread nodes live alongside the main tree in the same React Flow canvas. A `weave` action generates a main-tree node incorporating the character's arc.

---

## State shape (key fields in `TreeState`)

| Field | Type | Purpose |
|---|---|---|
| `nodes` | `StoryNode[]` | All main-tree nodes |
| `pendingOptions` | `BranchOption[] \| null` | Options waiting in the panel |
| `selectedNodeId` | `string \| null` | Currently-selected node |
| `activePathIds` | `string[]` | Highlighted root→node path |
| `genre` | `string` | Global genre constraint (empty = any) |
| `wrapUpRequested` | `boolean` | Whether AI should converge toward ending |
| `characterThreads` | `Record<string, CharacterThread>` | All side-story threads |
| `canonSummary` | `string` | Running 2-3 sentence summary (used in thread prompts) |

---

## File map

```
app/
  page.tsx                        Main reducer + all handlers + page render
  layout.tsx                      Root HTML, page title ("fAIrytalee")
  globals.css                     Tailwind + all keyframe animations
  api/
    generate-branches/route.ts    accepts { pathText, wrapUp, genre }
    generate-thread-branches/route.ts
    rewrite-node/route.ts         accepts { nodeText, contextBefore, contextAfter, genre }
    summarise-story/route.ts
    weave-thread/route.ts
    titlise-story/route.ts
    generate-image/route.ts       HF → Pollinations (enhance=false) → Picsum chain

components/
  StoryTree.tsx                   RF canvas; computes textBefore/textAfter per node for AI rewrite
  StoryNodeCard.tsx               Genre badge, per-node genre picker, Why tooltip, action buttons
  ThreadNodeCard.tsx
  NodeMenu.tsx                    Edit / AI rewrite / Insert / Prune
  BranchPanel.tsx                 Genre filter row + 2×2 cards + Skip/AI-pick + wrap-up
  PathDrawer.tsx                  Centered modal: Story Text tab + Comic Strip tab
  BackgroundScene.tsx
  CreateThreadModal.tsx
  AppearancesPanel.tsx
  CharacterUniverseView.tsx
  UniverseGraph.tsx
  UniverseAppearancesDrawer.tsx
  CharacterUniverseNode.tsx

lib/
  types.ts                        StoryNode, TreeState (genre: string), BranchOption, …
  treeUtils.ts
  threadPalette.ts
  appearanceUtils.ts
  ai/
    generateBranches.ts           buildSystemPrompt(base, genre); all providers accept genre param
    summariseStory.ts
    generateWeavedNode.ts
    titliseStory.ts
    generateImage.ts              buildImagePrompt(node); hashId(id)
```

---

## Known gotchas

| Issue | Fix |
|---|---|
| watsonx IAM key format | Must be a 44-char IBM Cloud IAM key. Keys starting with `ApiKey-` are WML Service Credentials and cause `BXNIM0415E`. |
| `parameters:{}` nesting | `TextChatParams` fields are **top-level** (`maxTokens`, `topP`, `repetitionPenalty`) — not nested under `parameters`. |
| Pollinations `enhance=true` | Completely overrides the prompt. Always omit or set to `false`. |
| PathDrawer always-rendered | If the modal is in the DOM when closed with `pointer-events-auto` on the inner panel, it silently swallows all landing-page interactions. Solution: gate with `{isOpen && ...}`. |
| RF v12 pointer events | `elementsSelectable={false}` sets `pointer-events: none` on node wrappers. Use `style={{ pointerEvents: "all" }}` + `className="nopan"` on interactive elements. |
| Tailwind class conflict | Two conflicting utilities in the same string (e.g. `pointer-events-auto pointer-events-none`) — latter wins but only if Tailwind generated both. Prefer conditional rendering over conflicting utilities. |
