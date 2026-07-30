# fAIrytalee — Implementation Notes

## What was built

**fAIrytalee** is a Next.js full-stack app where a user writes a story opening, receives four AI-generated branch options (each with text, tone, and a "Why:" rationale), clicks one to commit it as a tree node, and can branch again from any existing node. The whole story lives as a visual, pannable/zoomable tree rendered with React Flow.

---

## Architecture

- **Frontend:** Next.js 14 App Router, TypeScript, Tailwind CSS, `@xyflow/react` v12
- **State:** Single `useReducer` in `app/page.tsx` — no external state library
- **AI:** Server-only API routes — credentials never sent to the browser
- **AI provider priority:** watsonx/IBM Granite → Groq → built-in stub data
- **Image provider priority:** Hugging Face (if token set) → Pollinations.ai (server-side) → Picsum placeholder
- **No auth, no persistence** across page refresh

---

## Key implementation decisions

### watsonx integration
All four AI functions (`generateBranches`, `summariseStory`, `generateWeavedNode`, `titliseStory`) use the IBM watsonx SDK's `textChat` API — **not** `generateText`. Granite-3-instruct models require structured `system`/`user` chat turns to follow JSON-output instructions. Generation parameters are top-level camelCase fields (`maxTokens`, `topP`, `repetitionPenalty`) directly on the `TextChatParams` object, not nested under a `parameters` key.

### Image generation
Images are fetched **server-side** via `/api/generate-image` — this avoids browser CORS/timeout issues with Pollinations and means the HF token is never exposed to the client. The route tries providers in order and returns a base64 `data:image/jpeg;base64,…` URL.

### React Flow v12 pointer events
`elementsSelectable={false}` sets `pointer-events: none` on RF node wrappers. Interactive elements inside nodes need `style={{ pointerEvents: "all" }}` on the card div and `className="nopan"` on every button so RF's drag handler passes events through.

### Branch panel
The `＋ New directions` button is the only way to trigger AI generation from an existing node. Clicking the node body just selects it and highlights the path — no auto-fetch.

### Wrap-up / endings
A `WRAP_UP_SYSTEM` prompt returns 4 options (3 penultimate, 1 conclusive with `isEnding: true`). Ending nodes show a `✦ The End` badge, golden ring, no branching buttons, and auto-open the PathDrawer on commit.

### Character Universe
Up to 6 character threads, each with a palette colour, backstory, and optional relationship to another thread. Thread nodes live alongside the main tree in the same React Flow canvas. A `weave` action generates a main-tree node that incorporates the character's arc.

---

## File map

```
app/
  page.tsx                        Main reducer + all handlers + page render
  layout.tsx                      Root HTML, page title ("fAIrytalee")
  globals.css                     Tailwind + all keyframe animations
  api/
    generate-branches/route.ts
    generate-thread-branches/route.ts
    summarise-story/route.ts
    weave-thread/route.ts
    titlise-story/route.ts
    generate-image/route.ts       HF → Pollinations → Picsum provider chain

components/
  StoryTree.tsx
  StoryNodeCard.tsx
  ThreadNodeCard.tsx
  NodeMenu.tsx
  BranchPanel.tsx
  PathDrawer.tsx
  BackgroundScene.tsx
  CreateThreadModal.tsx
  AppearancesPanel.tsx
  CharacterUniverseView.tsx
  UniverseGraph.tsx
  UniverseAppearancesDrawer.tsx
  CharacterUniverseNode.tsx

lib/
  types.ts
  treeUtils.ts
  threadPalette.ts
  appearanceUtils.ts
  ai/
    generateBranches.ts
    summariseStory.ts
    generateWeavedNode.ts
    titliseStory.ts
    generateImage.ts
```
