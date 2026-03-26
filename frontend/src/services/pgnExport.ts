import type { GameTree, GameNode } from '../types/gameTree';

interface PgnHeaders {
  Event?: string;
  Site?: string;
  Date?: string;
  White?: string;
  Black?: string;
  Result?: string;
  [key: string]: string | undefined;
}

const NAG_MAP: Record<number, string> = {
  1: '!',
  2: '?',
  3: '!!',
  4: '??',
  5: '!?',
  6: '?!',
};

/**
 * Export a game tree as annotated PGN with engine evaluations,
 * classifications, comments, NAG annotations, and variations.
 */
export function exportAnnotatedPgn(
  tree: GameTree,
  headers?: PgnHeaders,
): string {
  const lines: string[] = [];

  // Headers
  const h = {
    Event: 'Local Chess Engine Analysis',
    Site: 'Local',
    Date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'),
    White: '?',
    Black: '?',
    Result: '*',
    ...headers,
  };
  for (const [key, value] of Object.entries(h)) {
    if (value) lines.push(`[${key} "${value}"]`);
  }
  lines.push('');

  // Walk tree and build move text
  const rootNode = tree.nodes.get(tree.rootId)!;
  const moveText = buildMoveText(tree, rootNode, 0, true);

  // Wrap at ~80 chars per line
  lines.push(wrapText(moveText.trim(), 80));
  lines.push(h.Result || '*');
  lines.push('');

  return lines.join('\n');
}

function buildMoveText(
  tree: GameTree,
  parentNode: GameNode,
  ply: number,
  forceNumber: boolean,
): string {
  let text = '';
  let currentPly = ply;
  let needsNumber = forceNumber;

  for (let i = 0; i < parentNode.children.length; i++) {
    const childId = parentNode.children[i];
    const node = tree.nodes.get(childId);
    if (!node) continue;

    if (i === 0) {
      // Mainline continuation
      text += formatMove(node, currentPly, needsNumber);
      text += formatAnnotations(node);

      // Render variations (siblings) after this move
      for (let v = 1; v < parentNode.children.length; v++) {
        const varNode = tree.nodes.get(parentNode.children[v]);
        if (!varNode) continue;
        text += ' (';
        text += formatMove(varNode, currentPly, true);
        text += formatAnnotations(varNode);
        // Continue the variation line
        if (varNode.children.length > 0) {
          text += buildMoveText(tree, varNode, currentPly + 1, false);
        }
        text += ') ';
      }

      // Continue mainline
      if (node.children.length > 0) {
        const nextNeedsNumber = parentNode.children.length > 1; // force number after variations
        text += buildMoveText(tree, node, currentPly + 1, nextNeedsNumber);
      }
    }
    // Only process first child here — variations handled inside
    break;
  }

  return text;
}

function formatMove(node: GameNode, ply: number, forceNumber: boolean): string {
  const moveNumber = Math.floor(ply / 2) + 1;
  const isBlack = node.color === 'b';

  let text = '';
  if (!isBlack) {
    text += `${moveNumber}. `;
  } else if (forceNumber) {
    text += `${moveNumber}... `;
  }

  text += node.san;

  // NAG annotations
  if (node.nags && node.nags.length > 0) {
    for (const nag of node.nags) {
      const symbol = NAG_MAP[nag];
      if (symbol) {
        text += symbol;
      } else {
        text += ` $${nag}`;
      }
    }
  }

  return text + ' ';
}

function formatAnnotations(node: GameNode): string {
  let text = '';
  const parts: string[] = [];

  // Engine evaluation
  if (node.classification) {
    parts.push(node.classification);
  }

  // Comment
  if (node.comment) {
    parts.push(node.comment);
  }

  if (parts.length > 0) {
    text += `{${parts.join(' — ')}} `;
  }

  return text;
}

function wrapText(text: string, maxWidth: number): string {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 > maxWidth && currentLine.length > 0) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine += (currentLine ? ' ' : '') + word;
    }
  }
  if (currentLine) lines.push(currentLine);
  return lines.join('\n');
}

/** Trigger a file download in the browser */
export function downloadPgn(content: string, filename: string = 'analysis.pgn'): void {
  const blob = new Blob([content], { type: 'application/x-chess-pgn' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
