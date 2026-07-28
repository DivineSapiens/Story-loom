/** One AI-generated branch proposal, before it is committed to the tree. */
export interface BranchOption {
  id: string;
  text: string;
  /** Single-word tone label, e.g. "Tense", "Hopeful", "Mysterious". */
  tone: string;
  /** One-line rationale shown on the card, e.g. "Raises the stakes by…" */
  why: string;
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
}

/** Complete application state, managed by useReducer in app/page.tsx. */
export interface TreeState {
  nodes: StoryNode[];
  /** Null when the branch panel is idle (no pending options to display). */
  pendingOptions: BranchOption[] | null;
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
}
