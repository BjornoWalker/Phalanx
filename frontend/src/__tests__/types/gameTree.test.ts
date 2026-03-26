import { describe, it, expect } from 'vitest';
import {
  createEmptyTree,
  getCurrentFen,
  getMainline,
  buildPathToNode,
  getFensAlongPath,
  flattenTreeForDisplay,
  ROOT_ID,
  STARTING_FEN,
  type GameNode,
  type GameTree,
} from '../../types/gameTree';

function addMove(tree: GameTree, parentId: string, san: string, uci: string, fen: string, color: 'w' | 'b'): { tree: GameTree; nodeId: string } {
  const id = `node_${Math.random().toString(36).slice(2, 8)}`;
  const node: GameNode = {
    id, san, uci, fen, color,
    parentId,
    children: [],
    isCapture: false,
    isCheck: false,
  };
  const nodes = new Map(tree.nodes);
  nodes.set(id, node);
  const parent = nodes.get(parentId)!;
  nodes.set(parentId, { ...parent, children: [...parent.children, id] });
  return { tree: { ...tree, nodes, currentPath: [...tree.currentPath, id] }, nodeId: id };
}

describe('createEmptyTree', () => {
  it('creates a tree with root node', () => {
    const tree = createEmptyTree();
    expect(tree.nodes.size).toBe(1);
    expect(tree.rootId).toBe(ROOT_ID);
    expect(tree.currentPath).toEqual([ROOT_ID]);
  });

  it('uses custom starting FEN', () => {
    const customFen = '4k3/8/8/8/8/8/8/R3K3 w - - 0 1';
    const tree = createEmptyTree(customFen);
    expect(tree.nodes.get(ROOT_ID)!.fen).toBe(customFen);
  });
});

describe('getCurrentFen', () => {
  it('returns starting FEN for empty tree', () => {
    const tree = createEmptyTree();
    expect(getCurrentFen(tree)).toBe(STARTING_FEN);
  });

  it('returns correct FEN after adding a move', () => {
    let tree = createEmptyTree();
    const fen = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    ({ tree } = addMove(tree, ROOT_ID, 'e4', 'e2e4', fen, 'w'));
    expect(getCurrentFen(tree)).toBe(fen);
  });
});

describe('getMainline', () => {
  it('returns empty for tree with no moves', () => {
    const tree = createEmptyTree();
    expect(getMainline(tree)).toEqual([]);
  });

  it('follows first child at each node', () => {
    let tree = createEmptyTree();
    let nodeId: string;
    ({ tree, nodeId } = addMove(tree, ROOT_ID, 'e4', 'e2e4', 'fen1', 'w'));
    ({ tree } = addMove(tree, nodeId, 'e5', 'e7e5', 'fen2', 'b'));

    const mainline = getMainline(tree);
    expect(mainline.length).toBe(2);
    expect(mainline[0].san).toBe('e4');
    expect(mainline[1].san).toBe('e5');
  });

  it('ignores variations (non-first children)', () => {
    let tree = createEmptyTree();
    ({ tree } = addMove(tree, ROOT_ID, 'e4', 'e2e4', 'fen1', 'w'));
    // Add a variation from root (d4 instead of e4)
    ({ tree } = addMove(tree, ROOT_ID, 'd4', 'd2d4', 'fen_var', 'w'));

    const mainline = getMainline(tree);
    expect(mainline.length).toBe(1);
    expect(mainline[0].san).toBe('e4'); // first child = mainline
  });
});

describe('buildPathToNode', () => {
  it('builds path from root to target', () => {
    let tree = createEmptyTree();
    let id1: string, id2: string;
    ({ tree, nodeId: id1 } = addMove(tree, ROOT_ID, 'e4', 'e2e4', 'fen1', 'w'));
    ({ tree, nodeId: id2 } = addMove(tree, id1, 'e5', 'e7e5', 'fen2', 'b'));

    const path = buildPathToNode(tree, id2);
    expect(path).toEqual([ROOT_ID, id1, id2]);
  });

  it('returns just root for root node', () => {
    const tree = createEmptyTree();
    expect(buildPathToNode(tree, ROOT_ID)).toEqual([ROOT_ID]);
  });
});

describe('getFensAlongPath', () => {
  it('returns FENs for each node in path', () => {
    let tree = createEmptyTree();
    ({ tree } = addMove(tree, ROOT_ID, 'e4', 'e2e4', 'fen_after_e4', 'w'));

    const fens = getFensAlongPath(tree, tree.currentPath);
    expect(fens.length).toBe(2);
    expect(fens[0]).toBe(STARTING_FEN);
    expect(fens[1]).toBe('fen_after_e4');
  });
});

describe('flattenTreeForDisplay', () => {
  it('returns empty for tree with no moves', () => {
    const tree = createEmptyTree();
    const items = flattenTreeForDisplay(tree, ROOT_ID);
    expect(items).toEqual([]);
  });

  it('flattens mainline moves', () => {
    let tree = createEmptyTree();
    let id1: string;
    ({ tree, nodeId: id1 } = addMove(tree, ROOT_ID, 'e4', 'e2e4', 'fen1', 'w'));
    ({ tree } = addMove(tree, id1, 'e5', 'e7e5', 'fen2', 'b'));

    const items = flattenTreeForDisplay(tree, ROOT_ID);
    const moves = items.filter((i) => i.type === 'move');
    expect(moves.length).toBe(2);
    expect(moves[0].san).toBe('e4');
    expect(moves[0].depth).toBe(0); // mainline
    expect(moves[1].san).toBe('e5');
  });

  it('marks current move correctly', () => {
    let tree = createEmptyTree();
    let id1: string;
    ({ tree, nodeId: id1 } = addMove(tree, ROOT_ID, 'e4', 'e2e4', 'fen1', 'w'));

    const items = flattenTreeForDisplay(tree, id1);
    const e4 = items.find((i) => i.san === 'e4');
    expect(e4?.isCurrentMove).toBe(true);
  });

  it('includes variations with depth > 0', () => {
    let tree = createEmptyTree();
    ({ tree } = addMove(tree, ROOT_ID, 'e4', 'e2e4', 'fen1', 'w'));
    // Add variation from root
    ({ tree } = addMove(tree, ROOT_ID, 'd4', 'd2d4', 'fen_var', 'w'));

    const items = flattenTreeForDisplay(tree, ROOT_ID);
    const varMoves = items.filter((i) => i.type === 'move' && i.depth > 0);
    expect(varMoves.length).toBeGreaterThan(0);
    expect(varMoves[0].san).toBe('d4');
  });
});
