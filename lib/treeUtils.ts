import type { StoryNode } from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Horizontal gap in pixels between sibling nodes at the same depth. */
export const H_GAP = 280;

/** Vertical gap in pixels between depth levels. */
export const V_GAP = 170;

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
