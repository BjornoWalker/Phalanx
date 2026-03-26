import { useState, useCallback, useMemo } from 'react';
import { Chess } from 'chess.js';
import {
  type GameTree,
  type GameNode,
  ROOT_ID,
  createEmptyTree,
  getCurrentFen,
  getMainline,
  buildPathToNode,
  getFensAlongPath,
  flattenTreeForDisplay,
  type DisplayItem,
} from '../types/gameTree';

export { STARTING_FEN } from '../types/gameTree';

export interface MoveRecord {
  san: string;
  uci: string;
  fen: string;
  color: 'w' | 'b';
  isCapture: boolean;
  isCheck: boolean;
}

export interface UseChessGameReturn {
  // Core state
  position: string;
  turn: 'w' | 'b';
  isGameOver: boolean;
  gameOverReason: string | null;
  boardOrientation: 'white' | 'black';

  // Navigation
  makeMove: (from: string, to: string, promotion?: string) => MoveRecord | null;
  goBack: () => void;
  goForward: () => void;
  goToMove: (index: number) => void;
  goToNode: (nodeId: string) => void;
  goToStart: () => void;
  goToEnd: () => void;
  reset: () => void;
  flipBoard: () => void;

  // Backward-compatible linear views (derived from mainline)
  history: MoveRecord[];
  fenHistory: string[];
  currentIndex: number;
  isAtStart: boolean;
  isAtEnd: boolean;

  // Tree-specific
  tree: GameTree;
  currentNodeId: string;
  displayItems: DisplayItem[];
  hasVariations: boolean;
  promoteVariation: (nodeId: string) => void;
  deleteVariation: (nodeId: string) => void;
  setNodeClassification: (nodeId: string, classification: string | null) => void;
  setNodeComment: (nodeId: string, comment: string) => void;
  setNodeNag: (nodeId: string, nag: number | null) => void;

  // Loaders
  loadPgn: (pgn: string) => boolean;
  loadMoves: (moves: MoveRecord[]) => void;
  loadFen: (fen: string) => boolean;
}

let nodeIdCounter = 0;
function nextNodeId(): string {
  return `n${++nodeIdCounter}`;
}

export function useChessGame(): UseChessGameReturn {
  const [tree, setTree] = useState<GameTree>(() => createEmptyTree());
  const [boardOrientation, setBoardOrientation] = useState<'white' | 'black'>('white');

  // --- Derived state ---

  const currentNodeId = tree.currentPath[tree.currentPath.length - 1];
  const position = getCurrentFen(tree);
  const turn = position.split(' ')[1] as 'w' | 'b';

  // Game over detection
  const { isGameOver, gameOverReason } = useMemo(() => {
    try {
      const g = new Chess(position);
      const over = g.isGameOver();
      if (!over) return { isGameOver: false, gameOverReason: null };
      if (g.isCheckmate()) {
        const winner = turn === 'w' ? 'Black' : 'White';
        return { isGameOver: true, gameOverReason: `Checkmate — ${winner} wins` };
      }
      if (g.isStalemate()) return { isGameOver: true, gameOverReason: 'Draw by stalemate' };
      if (g.isThreefoldRepetition()) return { isGameOver: true, gameOverReason: 'Draw by repetition' };
      if (g.isInsufficientMaterial()) return { isGameOver: true, gameOverReason: 'Draw — insufficient material' };
      if (g.isDraw()) return { isGameOver: true, gameOverReason: 'Draw' };
      return { isGameOver: true, gameOverReason: 'Game over' };
    } catch {
      return { isGameOver: false, gameOverReason: null };
    }
  }, [position, turn]);

  // Backward-compat: mainline as MoveRecord[] + currentIndex
  const mainlineNodes = useMemo(() => getMainline(tree), [tree]);

  const history: MoveRecord[] = useMemo(
    () => mainlineNodes.map((n) => ({
      san: n.san,
      uci: n.uci,
      fen: n.fen,
      color: n.color as 'w' | 'b',
      isCapture: n.isCapture,
      isCheck: n.isCheck,
    })),
    [mainlineNodes]
  );

  const fenHistory: string[] = useMemo(
    () => getFensAlongPath(tree, tree.currentPath),
    [tree]
  );

  // currentIndex relative to mainline (-1 = at root)
  const currentIndex = useMemo(() => {
    if (currentNodeId === ROOT_ID) return -1;
    const idx = mainlineNodes.findIndex((n) => n.id === currentNodeId);
    // If on a variation, return the index of the last mainline node in our path
    if (idx === -1) {
      for (let i = tree.currentPath.length - 1; i >= 0; i--) {
        const mainIdx = mainlineNodes.findIndex((n) => n.id === tree.currentPath[i]);
        if (mainIdx >= 0) return mainIdx;
      }
      return -1;
    }
    return idx;
  }, [currentNodeId, mainlineNodes, tree.currentPath]);

  const currentNode = tree.nodes.get(currentNodeId)!;
  const isAtStart = currentNodeId === ROOT_ID;
  const isAtEnd = currentNode.children.length === 0;

  const hasVariations = useMemo(() => {
    for (const node of tree.nodes.values()) {
      if (node.children.length > 1) return true;
    }
    return false;
  }, [tree]);

  const displayItems = useMemo(
    () => flattenTreeForDisplay(tree, currentNodeId),
    [tree, currentNodeId]
  );

  // --- Mutations ---

  const makeMove = useCallback((from: string, to: string, promotion?: string): MoveRecord | null => {
    const game = new Chess(position);
    let move;
    try {
      move = game.move({ from, to, promotion: promotion || 'q' });
    } catch {
      return null;
    }
    if (!move) return null;

    const uci = move.from + move.to + (move.promotion || '');
    const fen = game.fen();

    setTree((prev) => {
      const nodes = new Map(prev.nodes);
      const parentNode = nodes.get(currentNodeId)!;

      // Check if this move already exists as a child
      for (const childId of parentNode.children) {
        const child = nodes.get(childId)!;
        if (child.uci === uci) {
          // Navigate to existing child
          return {
            ...prev,
            nodes,
            currentPath: [...prev.currentPath, childId],
          };
        }
      }

      // Create new node
      const newId = nextNodeId();
      const newNode: GameNode = {
        id: newId,
        san: move.san,
        uci,
        fen,
        color: move.color,
        parentId: currentNodeId,
        children: [],
        isCapture: !!move.captured,
        isCheck: game.isCheck(),
      };
      nodes.set(newId, newNode);

      // Add as child of current node
      const updatedParent = { ...parentNode, children: [...parentNode.children, newId] };
      nodes.set(currentNodeId, updatedParent);

      return {
        ...prev,
        nodes,
        currentPath: [...prev.currentPath, newId],
      };
    });

    return {
      san: move.san,
      uci,
      fen,
      color: move.color,
      isCapture: !!move.captured,
      isCheck: game.isCheck(),
    };
  }, [position, currentNodeId]);

  const goBack = useCallback(() => {
    setTree((prev) => {
      if (prev.currentPath.length <= 1) return prev; // already at root
      return { ...prev, currentPath: prev.currentPath.slice(0, -1) };
    });
  }, []);

  const goForward = useCallback(() => {
    setTree((prev) => {
      const node = prev.nodes.get(prev.currentPath[prev.currentPath.length - 1])!;
      if (node.children.length === 0) return prev;
      // Follow first child (mainline of current branch)
      return { ...prev, currentPath: [...prev.currentPath, node.children[0]] };
    });
  }, []);

  const goToNode = useCallback((nodeId: string) => {
    setTree((prev) => {
      if (!prev.nodes.has(nodeId)) return prev;
      const path = buildPathToNode(prev, nodeId);
      return { ...prev, currentPath: path };
    });
  }, []);

  // Backward-compat: goToMove by mainline index
  const goToMove = useCallback((index: number) => {
    if (index === -1) {
      setTree((prev) => ({ ...prev, currentPath: [prev.rootId] }));
      return;
    }
    const mainline = getMainline(tree);
    if (index >= 0 && index < mainline.length) {
      goToNode(mainline[index].id);
    }
  }, [tree, goToNode]);

  const goToStart = useCallback(() => {
    setTree((prev) => ({ ...prev, currentPath: [prev.rootId] }));
  }, []);

  const goToEnd = useCallback(() => {
    setTree((prev) => {
      // Follow mainline from current position to the end
      const path = [...prev.currentPath];
      let nodeId = path[path.length - 1];
      while (true) {
        const node = prev.nodes.get(nodeId)!;
        if (node.children.length === 0) break;
        nodeId = node.children[0];
        path.push(nodeId);
      }
      return { ...prev, currentPath: path };
    });
  }, []);

  const reset = useCallback(() => {
    nodeIdCounter = 0;
    setTree(createEmptyTree());
  }, []);

  const flipBoard = useCallback(() => {
    setBoardOrientation((prev) => (prev === 'white' ? 'black' : 'white'));
  }, []);

  const promoteVariation = useCallback((nodeId: string) => {
    setTree((prev) => {
      const node = prev.nodes.get(nodeId);
      if (!node || !node.parentId) return prev;

      const nodes = new Map(prev.nodes);
      const parent = nodes.get(node.parentId)!;
      const childIdx = parent.children.indexOf(nodeId);
      if (childIdx <= 0) return prev; // already mainline or not found

      // Move to front of children array
      const newChildren = [nodeId, ...parent.children.filter((id) => id !== nodeId)];
      nodes.set(node.parentId, { ...parent, children: newChildren });
      return { ...prev, nodes };
    });
  }, []);

  const deleteVariation = useCallback((nodeId: string) => {
    setTree((prev) => {
      const node = prev.nodes.get(nodeId);
      if (!node || !node.parentId) return prev;

      const nodes = new Map(prev.nodes);

      // Remove from parent's children
      const parent = nodes.get(node.parentId)!;
      nodes.set(node.parentId, {
        ...parent,
        children: parent.children.filter((id) => id !== nodeId),
      });

      // Delete the subtree
      function removeSubtree(id: string) {
        const n = nodes.get(id);
        if (!n) return;
        for (const childId of n.children) removeSubtree(childId);
        nodes.delete(id);
      }
      removeSubtree(nodeId);

      // If current path goes through the deleted node, navigate to parent
      let currentPath = prev.currentPath;
      if (currentPath.includes(nodeId)) {
        const idx = currentPath.indexOf(nodeId);
        currentPath = currentPath.slice(0, idx);
      }

      return { ...prev, nodes, currentPath };
    });
  }, []);

  const setNodeClassification = useCallback((nodeId: string, classification: string | null) => {
    setTree((prev) => {
      const node = prev.nodes.get(nodeId);
      if (!node) return prev;
      const nodes = new Map(prev.nodes);
      nodes.set(nodeId, { ...node, classification });
      return { ...prev, nodes };
    });
  }, []);

  const setNodeComment = useCallback((nodeId: string, comment: string) => {
    setTree((prev) => {
      const node = prev.nodes.get(nodeId);
      if (!node) return prev;
      const nodes = new Map(prev.nodes);
      nodes.set(nodeId, { ...node, comment: comment || undefined });
      return { ...prev, nodes };
    });
  }, []);

  const setNodeNag = useCallback((nodeId: string, nag: number | null) => {
    setTree((prev) => {
      const node = prev.nodes.get(nodeId);
      if (!node) return prev;
      const nodes = new Map(prev.nodes);
      if (nag === null) {
        nodes.set(nodeId, { ...node, nags: undefined });
      } else {
        // Toggle: if already has this NAG, remove it; otherwise set it
        const current = node.nags || [];
        const has = current.includes(nag);
        nodes.set(nodeId, { ...node, nags: has ? current.filter((n) => n !== nag) : [nag] });
      }
      return { ...prev, nodes };
    });
  }, []);

  const loadPgn = useCallback((pgn: string): boolean => {
    const game = new Chess();
    try {
      game.loadPgn(pgn);
    } catch {
      return false;
    }

    const moves = game.history({ verbose: true });
    nodeIdCounter = 0;
    const newTree = createEmptyTree();
    const nodes = newTree.nodes;
    const path = [ROOT_ID];

    let parentId = ROOT_ID;
    const replay = new Chess();
    for (const move of moves) {
      replay.move(move.san);
      const id = nextNodeId();
      const newNode: GameNode = {
        id,
        san: move.san,
        uci: move.from + move.to + (move.promotion || ''),
        fen: replay.fen(),
        color: move.color,
        parentId,
        children: [],
        isCapture: !!move.captured,
        isCheck: replay.isCheck(),
      };
      nodes.set(id, newNode);
      const parent = nodes.get(parentId)!;
      nodes.set(parentId, { ...parent, children: [...parent.children, id] });
      path.push(id);
      parentId = id;
    }

    // Navigate to end
    setTree({ ...newTree, nodes, currentPath: path });
    return true;
  }, []);

  const loadMoves = useCallback((moves: MoveRecord[]) => {
    nodeIdCounter = 0;
    const newTree = createEmptyTree();
    const nodes = newTree.nodes;

    let parentId = ROOT_ID;
    for (const move of moves) {
      const id = nextNodeId();
      const newNode: GameNode = {
        id,
        san: move.san,
        uci: move.uci,
        fen: move.fen,
        color: move.color,
        parentId,
        children: [],
        isCapture: move.isCapture,
        isCheck: move.isCheck,
      };
      nodes.set(id, newNode);
      const parent = nodes.get(parentId)!;
      nodes.set(parentId, { ...parent, children: [...parent.children, id] });
      parentId = id;
    }

    // Navigate to start (for review mode)
    setTree({ ...newTree, nodes, currentPath: [ROOT_ID] });
  }, []);

  const loadFen = useCallback((fen: string): boolean => {
    try {
      new Chess(fen); // validate
    } catch {
      return false;
    }
    nodeIdCounter = 0;
    setTree(createEmptyTree(fen));
    return true;
  }, []);

  return {
    position,
    turn,
    isGameOver,
    gameOverReason,
    boardOrientation,

    makeMove,
    goBack,
    goForward,
    goToMove,
    goToNode,
    goToStart,
    goToEnd,
    reset,
    flipBoard,

    history,
    fenHistory,
    currentIndex,
    isAtStart,
    isAtEnd,

    tree,
    currentNodeId,
    displayItems,
    hasVariations,
    promoteVariation,
    deleteVariation,
    setNodeClassification,
    setNodeComment,
    setNodeNag,

    loadPgn,
    loadMoves,
    loadFen,
  };
}
