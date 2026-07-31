/** One AI-generated branch proposal, before it is committed to the tree. */
export interface BranchOption {
  id: string;
  text: string;
  /** Single-word tone label, e.g. "Tense", "Hopeful", "Mysterious". */
  tone: string;
  /** One-line rationale shown on the card, e.g. "Raises the stakes by…" */
  why: string;
  /**
   * When true, committing this option will mark the resulting node as the
   * final "The End" node — no further branching is allowed from it.
   * Only set when wrapUp mode generates a conclusion option.
   */
  isEnding?: boolean;
  /**
   * AI hint: approx how many more nodes until the story concludes.
   * Shown as a heads-up in the branch panel ("~2 nodes to conclusion").
   * Only present in wrapUp mode.
   */
  nodesRemaining?: number;
}

/** A committed node in the story tree (main tree or character thread). */
export interface StoryNode {
  id: string;
  text: string;
  tone: string;
  why: string;
  /** null only for the root node of a tree or the root of a thread. */
  parentId: string | null;
  /** 0 = root level; increments with each generation. */
  depth: number;
  /**
   * 0-based index among this node's siblings (children of the same parent).
   * Assigned at commit time as the count of existing siblings.
   * Used by computeLayout for symmetric spacing.
   */
  siblingIndex: number;
  /**
   * Whether this node was written by the AI or typed directly by the user.
   * - 'ai'   — an AI-suggested branch the user selected
   * - 'user' — free text the user typed via "Continue in your own words"
   */
  authorType: "ai" | "user";
  /**
   * Per-node image URL, populated lazily when "Read this path" is opened.
   * Undefined until the drawer triggers batch generation.
   */
  imageUrl?: string;
  /**
   * Browser load state for the panel illustration — managed by PathDrawer.
   * - 'idle'    — not yet requested
   * - 'loading' — fetch in flight
   * - 'ready'   — painted
   * - 'error'   — failed
   */
  imageStatus: "idle" | "loading" | "ready" | "error";
  /**
   * True when this node has been woven into the main story via "Weave into
   * main story →". Purely cosmetic — drives a "woven" badge in ThreadNodeCard.
   * Only meaningful on thread nodes.
   */
  woven?: boolean;
  /**
   * True when this is the final "The End" node of a completed story arc.
   * - No further AI branches are generated from an ending node.
   * - The PathDrawer opens automatically when an ending node is committed.
   * - The node is rendered with a distinct "THE END" badge in StoryNodeCard.
   * - Branching from ancestor nodes above it is still allowed.
   */
  isEnding?: boolean;
}

// ─── Character Thread ─────────────────────────────────────────────────────────

/**
 * A character's side-story thread branching from a main-tree node.
 * Thread nodes live exclusively inside this array — never in TreeState.nodes.
 */
export interface CharacterThread {
  id: string;
  /** Display name of the character (user-supplied). */
  characterName: string;
  /** Short backstory supplied at thread creation; included in every prompt. */
  backstory: string;
  /** ID of the main-tree node this thread branches from (its visual origin). */
  originNodeId: string;
  /**
   * Ordered list of committed nodes in this thread.
   * nodes[0] is the thread root (parentId: null within this thread).
   */
  nodes: StoryNode[];
  /** Which thread node is currently selected (drives the branch panel). */
  selectedNodeId: string | null;
  /** Pending branch options for this thread (mirrors TreeState.pendingOptions). */
  pendingOptions: BranchOption[] | null;
  /** True while a branch-generation call for this thread is in flight. */
  isLoading: boolean;
  /** Set when the last thread branch-generation call failed. */
  branchError: string | null;
  /**
   * 0-based index into THREAD_PALETTE. Assigned at creation from
   * Object.keys(characterThreads).length % MAX_THREADS.
   * Never changes after creation.
   */
  paletteIndex: number;
  /**
   * Optional relationship to another character thread.
   * When set, a labeled connector is drawn between the two threads' origin nodes.
   */
  relatedToThreadId?: string;
  /** Short label for the relationship, e.g. "sibling", "rival", "mentor". */
  relationshipLabel?: string;
}

// ─── Snapshot ─────────────────────────────────────────────────────────────────

/**
 * Snapshot of the tree data saved before a reset — used by the previousTree undo slot.
 */
export interface TreeSnapshot {
  nodes: StoryNode[];
  selectedNodeId: string | null;
  activePathIds: string[];
  styleDescription: string;
}

// ─── TreeState ────────────────────────────────────────────────────────────────

/** Complete application state, managed by useReducer in app/page.tsx. */
export interface TreeState {
  // ── Main tree ────────────────────────────────────────────────────────────
  nodes: StoryNode[];
  /** Null when the branch panel is idle (no pending options to display). */
  pendingOptions: BranchOption[] | null;
  /**
   * Set when the last branch-generation API call failed.
   * Shown as a visible error state in the branch panel.
   * Cleared whenever a new generation starts (SET_LOADING) or succeeds (SET_OPTIONS).
   */
  branchError: string | null;
  /** The currently selected/focused node id. */
  selectedNodeId: string | null;
  /** Ordered list of node ids from root to the selected node. Drives path highlighting. */
  activePathIds: string[];
  isLoading: boolean;
  /** Controls whether the "Read this path" side-drawer is open. */
  drawerOpen: boolean;
  /** Controls whether the opening textarea accordion is collapsed. */
  openingCollapsed: boolean;
  /**
   * Set to true after CONFIRM_RESET is dispatched.
   * While true, the confirmation banner is shown; no reset has happened yet.
   */
  pendingReset: boolean;
  /** Temporarily holds the new opening text while waiting for reset confirmation. */
  pendingOpeningText: string;
  /**
   * User-supplied visual style description for image generation.
   * Empty string → the default style is used in buildImageUrl.
   */
  styleDescription: string;
  /**
   * Genre/tone the user selected on the landing screen (or per-node override).
   * Passed into every branch-generation prompt so the AI stays consistent.
   * Empty string = no genre constraint (AI chooses freely).
   */
  genre: string;
  /**
   * Single-slot undo buffer. Populated when the user confirms a tree reset so
   * they can restore the previous tree via a dismissible banner.
   * null = nothing to restore.
   */
  previousTree: TreeSnapshot | null;
  /**
   * When true, the AI prompt instructs the model to bias toward concluding/
   * resolving the narrative rather than opening new threads.
   */
  wrapUpRequested: boolean;

  // ── Canon summary ────────────────────────────────────────────────────────
  /**
   * AI-generated 2–3 sentence summary of established story facts.
   * Starts as "". Updated (fire-and-forget) after every main-tree commit
   * and after the root node is set.
   * Included in character-thread prompts and weave prompts.
   */
  canonSummary: string;
  /**
   * True while a summariseStory call is in flight.
   * Used to show a subtle pulsing indicator and to gracefully handle
   * a weave request before the first summary arrives.
   */
  canonSummaryPending: boolean;

  // ── Character threads ────────────────────────────────────────────────────
  /**
   * Map of all character threads, keyed by thread.id.
   * Thread nodes live exclusively here — never in TreeState.nodes.
   */
  characterThreads: Record<string, CharacterThread>;

  /**
   * The "active context" for the BranchPanel.
   * - { kind: "main" }              → panel is branching from main tree
   * - { kind: "thread"; threadId }  → panel is branching from a character thread
   * null when panel is idle.
   */
  branchContext: { kind: "main" } | { kind: "thread"; threadId: string } | null;

  /**
   * ID of the most-recently-committed MAIN-tree node.
   * Used as the parentId when a woven node is committed.
   * Never set to a thread-node id.
   * null before the first main commit.
   */
  lastMainNodeId: string | null;

  /**
   * True while a weave-thread API call is in flight.
   * Drives the loading state of the "Weave into main story →" button.
   */
  weaveLoading: boolean;
}
