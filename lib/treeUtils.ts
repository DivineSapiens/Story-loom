import type { StoryNode } from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Horizontal gap in pixels between sibling node centres at the same depth.
 * Cards are 224px wide; 300px centre-to-centre gives 76px of breathing room.
 */
export const H_GAP = 300;

/**
 * Vertical gap in pixels between depth levels, measured top-edge to top-edge.
 *
 * Cards are declared at height=240px in StoryTree (updated to match).
 * V_GAP = card_height + desired_clear_gap = 240 + 64 = 304 → rounded to 310.
 * This guarantees the top edge of a child is always 64px below the bottom
 * edge of its tallest possible parent, regardless of text length.
 */
export const V_GAP = 310;

// ─── getPath ──────────────────────────────────────────────────────────────────

/**
 * Returns the ordered list of nodes from root down to (and including) the
 * node with the given id.  Returns [] if nodeId is not found.
 */
export function getPath(nodes: StoryNode[], nodeId: string): StoryNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const path: StoryNode[] = [];
  let current = byId.get(nodeId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return path;
}

// ─── pathToText ───────────────────────────────────────────────────────────────

/**
 * Stitches the text of each node in the path into a single clean story block,
 * separated by a blank line between paragraphs.
 */
export function pathToText(path: StoryNode[]): string {
  return path.map((n) => n.text).join("\n\n");
}

// ─── computeLayout ────────────────────────────────────────────────────────────

/**
 * Derives a stable { x, y } position for every node in the tree.
 *
 * Algorithm:
 *   1. Walk nodes in order of increasing depth (BFS ordering is implicit
 *      because nodes are always appended after their parent).
 *   2. For each node, look up its parent's already-computed x to use as the
 *      center anchor.
 *   3. Count the total number of siblings (children of the same parent),
 *      then place each sibling symmetrically around that anchor using:
 *
 *        x = parentX + (siblingIndex - (siblingCount - 1) / 2) * H_GAP
 *
 *      This means adding a new sibling automatically re-centers the whole
 *      group — no node ever overlaps a peer.
 *   4. y = depth * V_GAP  (simple, stable).
 *
 * Returns a Record<nodeId, {x, y}> that is pure: same input → same output.
 */
export function computeLayout(
  nodes: StoryNode[]
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};

  // Group children by parentId for fast sibling-count lookup.
  const childrenByParent = new Map<string | null, StoryNode[]>();
  for (const node of nodes) {
    const siblings = childrenByParent.get(node.parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentId, siblings);
  }

  // Root node(s) are centred at x = 0.
  const rootNodes = childrenByParent.get(null) ?? [];
  for (const root of rootNodes) {
    positions[root.id] = { x: 0, y: 0 };
  }

  // Process remaining nodes in stable insertion order.
  // Because every node is appended after its parent, iterating nodes[] in
  // order guarantees the parent position is already resolved when we reach a child.
  for (const node of nodes) {
    if (node.parentId === null) continue; // already handled above

    const parentPos = positions[node.parentId];
    if (!parentPos) continue; // safety: should never happen in valid state

    const siblings = childrenByParent.get(node.parentId) ?? [];
    // Sort siblings by their siblingIndex to assign positions deterministically.
    const sorted = [...siblings].sort((a, b) => a.siblingIndex - b.siblingIndex);
    const siblingCount = sorted.length;
    const myIndex = sorted.findIndex((s) => s.id === node.id);

    const x = parentPos.x + (myIndex - (siblingCount - 1) / 2) * H_GAP;
    const y = node.depth * V_GAP;

    positions[node.id] = { x, y };
  }

  return positions;
}

// ─── Thread layout constants ──────────────────────────────────────────────────

/**
 * X-coordinate where the first thread lane starts.
 * Positioned well to the right of the widest expected main tree.
 * The main tree root sits at x=0; with H_GAP=280 and 4 siblings, the main
 * tree spans roughly ±420 px. 900 gives comfortable breathing room.
 */
export const THREAD_LANE_ORIGIN_X = 900;

/** Horizontal width reserved per thread lane. */
export const THREAD_LANE_WIDTH = 400;

/** Horizontal gap between sibling node centres within a thread. */
export const THREAD_H_GAP = 280;

/**
 * Vertical gap between depth levels within a thread (top-edge to top-edge).
 * Thread cards are declared at height=220px; 220 + 60 = 280.
 */
export const THREAD_V_GAP = 280;

/**
 * Computes { x, y } positions for all nodes in a character thread.
 *
 * Algorithm:
 *   - The lane's horizontal centre is: THREAD_LANE_ORIGIN_X + paletteIndex * THREAD_LANE_WIDTH
 *   - The thread root is placed one THREAD_V_GAP below its origin node in the main tree.
 *   - Subsequent nodes use the same symmetric-sibling formula as computeLayout,
 *     but anchored to the lane centre rather than a parent's x.
 *   - y = originNodeY + (1 + depth) * THREAD_V_GAP
 *
 * @param thread        The CharacterThread to lay out.
 * @param mainPositions The positions map from computeLayout(mainNodes) — used to
 *                      find the y of the origin node so the thread roots
 *                      visually "hang" below it.
 * @returns A Record<nodeId, {x, y}> covering every node in thread.nodes.
 */
export function computeThreadLayout(
  thread: import("./types").CharacterThread,
  mainPositions: Record<string, { x: number; y: number }>
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {};
  if (thread.nodes.length === 0) return positions;

  const laneX   = THREAD_LANE_ORIGIN_X + thread.paletteIndex * THREAD_LANE_WIDTH;
  const originY = mainPositions[thread.originNodeId]?.y ?? 0;
  // Thread root sits one step below the origin node.
  const threadRootY = originY + THREAD_V_GAP;

  // Group thread nodes by parentId for sibling-count lookup.
  const childrenByParent = new Map<string | null, import("./types").StoryNode[]>();
  for (const node of thread.nodes) {
    const siblings = childrenByParent.get(node.parentId) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parentId, siblings);
  }

  // Position the thread root(s) at the lane centre.
  const threadRoots = childrenByParent.get(null) ?? [];
  for (const root of threadRoots) {
    positions[root.id] = { x: laneX, y: threadRootY };
  }

  // Position remaining thread nodes (insertion order guarantees parent-first).
  for (const node of thread.nodes) {
    if (node.parentId === null) continue;

    const parentPos = positions[node.parentId];
    if (!parentPos) continue;

    const siblings = childrenByParent.get(node.parentId) ?? [];
    const sorted   = [...siblings].sort((a, b) => a.siblingIndex - b.siblingIndex);
    const myIndex  = sorted.findIndex((s) => s.id === node.id);

    const x = laneX + (myIndex - (sorted.length - 1) / 2) * THREAD_H_GAP;
    const y = threadRootY + node.depth * THREAD_V_GAP;

    positions[node.id] = { x, y };
  }

  return positions;
}
