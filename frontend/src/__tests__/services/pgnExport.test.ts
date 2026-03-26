import { describe, it, expect } from 'vitest';
import { exportAnnotatedPgn } from '../../services/pgnExport';
import { createEmptyTree, ROOT_ID, type GameTree, type GameNode } from '../../types/gameTree';

function addNode(tree: GameTree, parentId: string, props: Partial<GameNode> & { id: string; san: string; uci: string; fen: string; color: 'w' | 'b' }): GameTree {
  const node: GameNode = {
    parentId,
    children: [],
    isCapture: false,
    isCheck: false,
    ...props,
  };
  const nodes = new Map(tree.nodes);
  nodes.set(node.id, node);
  const parent = nodes.get(parentId)!;
  nodes.set(parentId, { ...parent, children: [...parent.children, node.id] });
  return { ...tree, nodes };
}

describe('exportAnnotatedPgn', () => {
  it('generates valid PGN for empty tree', () => {
    const tree = createEmptyTree();
    const pgn = exportAnnotatedPgn(tree);
    expect(pgn).toContain('[Event "Phalanx Analysis"]');
    expect(pgn).toContain('*');
  });

  it('includes moves in PGN', () => {
    let tree = createEmptyTree();
    tree = addNode(tree, ROOT_ID, { id: 'n1', san: 'e4', uci: 'e2e4', fen: 'f1', color: 'w' });
    tree = addNode(tree, 'n1', { id: 'n2', san: 'e5', uci: 'e7e5', fen: 'f2', color: 'b' });

    const pgn = exportAnnotatedPgn(tree);
    expect(pgn).toContain('1. e4');
    expect(pgn).toContain('e5');
  });

  it('includes custom headers', () => {
    const tree = createEmptyTree();
    const pgn = exportAnnotatedPgn(tree, { White: 'Magnus', Black: 'Hikaru' });
    expect(pgn).toContain('[White "Magnus"]');
    expect(pgn).toContain('[Black "Hikaru"]');
  });

  it('includes classification comments', () => {
    let tree = createEmptyTree();
    tree = addNode(tree, ROOT_ID, {
      id: 'n1', san: 'e4', uci: 'e2e4', fen: 'f1', color: 'w',
      classification: 'best',
    });

    const pgn = exportAnnotatedPgn(tree);
    expect(pgn).toContain('{best}');
  });

  it('includes NAG annotations', () => {
    let tree = createEmptyTree();
    tree = addNode(tree, ROOT_ID, {
      id: 'n1', san: 'e4', uci: 'e2e4', fen: 'f1', color: 'w',
      nags: [1], // !
    });

    const pgn = exportAnnotatedPgn(tree);
    expect(pgn).toContain('e4!');
  });

  it('includes text comments', () => {
    let tree = createEmptyTree();
    tree = addNode(tree, ROOT_ID, {
      id: 'n1', san: 'e4', uci: 'e2e4', fen: 'f1', color: 'w',
      comment: 'Strong opening move',
    });

    const pgn = exportAnnotatedPgn(tree);
    expect(pgn).toContain('Strong opening move');
  });

  it('includes variations in parentheses', () => {
    let tree = createEmptyTree();
    tree = addNode(tree, ROOT_ID, { id: 'n1', san: 'e4', uci: 'e2e4', fen: 'f1', color: 'w' });
    tree = addNode(tree, ROOT_ID, { id: 'n2', san: 'd4', uci: 'd2d4', fen: 'f2', color: 'w' }); // variation

    const pgn = exportAnnotatedPgn(tree);
    expect(pgn).toContain('(');
    expect(pgn).toContain('d4');
  });

  it('handles black move numbering', () => {
    let tree = createEmptyTree();
    tree = addNode(tree, ROOT_ID, { id: 'n1', san: 'e4', uci: 'e2e4', fen: 'f1', color: 'w' });
    tree = addNode(tree, 'n1', { id: 'n2', san: 'e5', uci: 'e7e5', fen: 'f2', color: 'b' });
    tree = addNode(tree, 'n2', { id: 'n3', san: 'Nf3', uci: 'g1f3', fen: 'f3', color: 'w' });

    const pgn = exportAnnotatedPgn(tree);
    expect(pgn).toContain('1. e4');
    expect(pgn).toContain('2. Nf3');
  });
});
