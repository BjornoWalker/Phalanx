/**
 * Game tree data structure for supporting variations.
 *
 * Uses a flat Map<string, GameNode> for efficient React state updates.
 * The tree is navigated via `currentPath` — an array of node IDs from
 * root to the current position.
 *
 * The root node is a sentinel representing the starting position
 * (no move was played to reach it).
 */

export interface GameNode {
  id: string;
  san: string;           // "" for root node
  uci: string;           // "" for root node
  fen: string;           // position AFTER this move (or starting FEN for root)
  color: 'w' | 'b' | ''; // '' for root
  parentId: string | null;
  children: string[];    // ordered child node IDs (first = mainline)
  isCapture: boolean;
  isCheck: boolean;
  classification?: string | null;
  comment?: string;
  nags?: number[];       // NAG annotation codes (1=!, 2=?, 3=!!, 4=??, 5=!?, 6=?!)
}

export interface GameTree {
  nodes: Map<string, GameNode>;
  rootId: string;
  currentPath: string[]; // [rootId, nodeId1, nodeId2, ...] — path to current position
}

export const ROOT_ID = 'root';
export const STARTING_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function createEmptyTree(startingFen: string = STARTING_FEN): GameTree {
  const root: GameNode = {
    id: ROOT_ID,
    san: '',
    uci: '',
    fen: startingFen,
    color: '',
    parentId: null,
    children: [],
    isCapture: false,
    isCheck: false,
  };
  const nodes = new Map<string, GameNode>();
  nodes.set(ROOT_ID, root);
  return { nodes, rootId: ROOT_ID, currentPath: [ROOT_ID] };
}

/** Get the node at the end of the current path */
export function getCurrentNode(tree: GameTree): GameNode {
  const id = tree.currentPath[tree.currentPath.length - 1];
  return tree.nodes.get(id)!;
}

/** Get the FEN of the current position */
export function getCurrentFen(tree: GameTree): string {
  return getCurrentNode(tree).fen;
}

/** Walk the mainline from root (following first child at each node) */
export function getMainline(tree: GameTree): GameNode[] {
  const result: GameNode[] = [];
  let nodeId = tree.rootId;
  while (true) {
    const node = tree.nodes.get(nodeId);
    if (!node) break;
    if (node.id !== tree.rootId) result.push(node);
    if (node.children.length === 0) break;
    nodeId = node.children[0]; // first child = mainline
  }
  return result;
}

/** Build the path from root to a given node */
export function buildPathToNode(tree: GameTree, targetId: string): string[] {
  const path: string[] = [];
  let id: string | null = targetId;
  while (id !== null) {
    path.unshift(id);
    const node = tree.nodes.get(id);
    id = node?.parentId ?? null;
  }
  return path;
}

/** Collect all FENs along a path */
export function getFensAlongPath(tree: GameTree, path: string[]): string[] {
  return path.map((id) => tree.nodes.get(id)!.fen);
}

/** Display item for rendering the move tree in MoveHistory */
export interface DisplayItem {
  type: 'move' | 'variation-start' | 'variation-end';
  nodeId: string;
  san: string;
  moveNumber: number;
  isBlack: boolean;
  depth: number;          // 0 = mainline, 1+ = nested variation
  classification?: string | null;
  isCurrentMove: boolean;
}

/**
 * Flatten the tree into a list of DisplayItems for rendering.
 * Mainline is at depth 0. Variations are nested with increasing depth.
 */
export function flattenTreeForDisplay(
  tree: GameTree,
  currentNodeId: string,
): DisplayItem[] {
  const items: DisplayItem[] = [];
  const rootNode = tree.nodes.get(tree.rootId)!;

  function walk(nodeId: string, depth: number, plyOffset: number) {
    const node = tree.nodes.get(nodeId);
    if (!node || node.id === tree.rootId) return;

    const ply = plyOffset;
    const moveNumber = Math.floor(ply / 2) + 1;
    const isBlack = node.color === 'b';

    items.push({
      type: 'move',
      nodeId: node.id,
      san: node.san,
      moveNumber,
      isBlack,
      depth,
      classification: node.classification,
      isCurrentMove: node.id === currentNodeId,
    });

    // First child is the continuation of this line
    if (node.children.length > 0) {
      // Render alternative children (variations) first
      for (let i = 1; i < node.children.length; i++) {
        items.push({
          type: 'variation-start',
          nodeId: node.children[i],
          san: '',
          moveNumber: 0,
          isBlack: false,
          depth: depth + 1,
          isCurrentMove: false,
        });
        walkLine(node.children[i], depth + 1, ply + 1);
        items.push({
          type: 'variation-end',
          nodeId: node.children[i],
          san: '',
          moveNumber: 0,
          isBlack: false,
          depth: depth + 1,
          isCurrentMove: false,
        });
      }
      // Continue mainline
      walk(node.children[0], depth, ply + 1);
    }
  }

  function walkLine(startNodeId: string, depth: number, plyOffset: number) {
    let nodeId: string | null = startNodeId;
    let ply = plyOffset;
    while (nodeId) {
      const node = tree.nodes.get(nodeId);
      if (!node) break;

      const moveNumber = Math.floor(ply / 2) + 1;
      const isBlack = node.color === 'b';

      items.push({
        type: 'move',
        nodeId: node.id,
        san: node.san,
        moveNumber,
        isBlack,
        depth,
        classification: node.classification,
        isCurrentMove: node.id === currentNodeId,
      });

      // Render sub-variations
      if (node.children.length > 1) {
        for (let i = 1; i < node.children.length; i++) {
          items.push({
            type: 'variation-start',
            nodeId: node.children[i],
            san: '',
            moveNumber: 0,
            isBlack: false,
            depth: depth + 1,
            isCurrentMove: false,
          });
          walkLine(node.children[i], depth + 1, ply + 1);
          items.push({
            type: 'variation-end',
            nodeId: node.children[i],
            san: '',
            moveNumber: 0,
            isBlack: false,
            depth: depth + 1,
            isCurrentMove: false,
          });
        }
      }

      // Continue to first child (mainline of this variation)
      if (node.children.length > 0) {
        nodeId = node.children[0];
        ply++;
      } else {
        break;
      }
    }
  }

  // Start from root's children
  if (rootNode.children.length > 0) {
    walk(rootNode.children[0], 0, 0);

    // Root-level variations (alternative first moves)
    for (let i = 1; i < rootNode.children.length; i++) {
      items.push({
        type: 'variation-start',
        nodeId: rootNode.children[i],
        san: '',
        moveNumber: 0,
        isBlack: false,
        depth: 1,
        isCurrentMove: false,
      });
      walkLine(rootNode.children[i], 1, 0);
      items.push({
        type: 'variation-end',
        nodeId: rootNode.children[i],
        san: '',
        moveNumber: 0,
        isBlack: false,
        depth: 1,
        isCurrentMove: false,
      });
    }
  }

  return items;
}
