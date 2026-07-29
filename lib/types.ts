/** One AI-generated branch proposal, before it is committed to the tree. */
export interface BranchOption {
  id: string;
  text: string;
  /** Single-word tone label, e.g. "Tense", "Hopeful", "Mysterious". */
  tone: string;
  /** One-line rationale shown on the card, e.g. "Raises the stakes by…" */
  why: string;
  /**
   * 512×512 preview image URL prefetched immediately after AI branch response.
   * Optional — may be absent if prefetch hasn't completed yet.
   */
  previewImageUrl?: string;
}

/** A committed node in the story tree. */
export interface StoryNode {
  id: string;
  text: string;
  tone: string;
  why: string;
  /** null only for the root node. */
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
   * 768×768 committed-node image URL, computed from node id + text + styleDescription.
   * Undefined for root nodes.
   */
  imageUrl?: string;
  /**
   * Browser load state for the committed illustration.
   * - 'idle'    — no image requested (root node)
   * - 'loading' — <img> rendered, awaiting onLoad/onError
   * - 'ready'   — image painted successfully
   * - 'error'   — all auto-retries exhausted; static placeholder shown
   */
  imageStatus: "idle" | "loading" | "ready" | "error";
  /**
   * Auto-retry budget remaining. Starts at 3 for committed nodes.
   * Decremented on each onError; status becomes 'error' when 0.
   */
  imageRetries: number;
}

/**
 * Snapshot of the tree data saved before a reset — used by the previousTree undo slot.
 */
export interface TreeSnapshot {
  nodes: StoryNode[];
  selectedNodeId: string | null;
  activePathIds: string[];
  styleDescription: string;
}

/** Complete application state, managed by useReducer in app/page.tsx. */
export interface TreeState {
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
   * The text the user typed into the opening box at that moment is held in
   * pendingOpeningText so it can be committed if the user confirms.
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
   * Single-slot undo buffer. Populated when the user confirms a tree reset so
   * they can restore the previous tree via a dismissible banner.
   * null = nothing to restore.
   */
  previousTree: TreeSnapshot | null;
}
