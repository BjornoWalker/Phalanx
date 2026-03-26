import Dexie, { type Table } from 'dexie';

export interface CachedAnalysis {
  key: string;            // `${fenKey}|${depth}|${multipv}`
  evaluation: number;
  evaluationCp: number;
  isMate: boolean;
  mateIn: number | null;
  bestMove: string;
  bestMoveSan: string;
  topLines: string[][];
  classification: string | null;
  cpLoss: number | null;
  depth: number;
  timestamp: number;
}

class AnalysisCacheDB extends Dexie {
  analyses!: Table<CachedAnalysis, string>;

  constructor() {
    super('ChessAnalysisCache');
    this.version(1).stores({
      analyses: 'key, timestamp',
    });
  }
}

const db = new AnalysisCacheDB();

function fenToKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

function buildKey(fen: string, depth: number, multipv: number): string {
  return `${fenToKey(fen)}|${depth}|${multipv}`;
}

export async function getCachedAnalysis(
  fen: string,
  depth: number,
  multipv: number,
): Promise<CachedAnalysis | undefined> {
  const key = buildKey(fen, depth, multipv);
  const result = await db.analyses.get(key);
  if (result) return result;

  // Also check if we have a deeper analysis cached for the same position
  // A depth-20 result satisfies a depth-15 request
  const fenKey = fenToKey(fen);
  const deeper = await db.analyses
    .where('key')
    .startsWith(`${fenKey}|`)
    .filter((entry) => {
      const parts = entry.key.split('|');
      const cachedDepth = parseInt(parts[1]);
      const cachedMpv = parseInt(parts[2]);
      return cachedDepth >= depth && cachedMpv >= multipv;
    })
    .first();

  return deeper;
}

export async function setCachedAnalysis(
  fen: string,
  depth: number,
  multipv: number,
  data: Omit<CachedAnalysis, 'key' | 'timestamp'>,
): Promise<void> {
  const key = buildKey(fen, depth, multipv);
  await db.analyses.put({
    ...data,
    key,
    timestamp: Date.now(),
  });
}

export async function clearOldEntries(maxAgeDays: number = 30): Promise<number> {
  const cutoff = Date.now() - maxAgeDays * 24 * 60 * 60 * 1000;
  return db.analyses.where('timestamp').below(cutoff).delete();
}

export async function clearAllCache(): Promise<void> {
  await db.analyses.clear();
}

export async function getCacheStats(): Promise<{ count: number; oldestDays: number }> {
  const count = await db.analyses.count();
  if (count === 0) return { count: 0, oldestDays: 0 };

  const oldest = await db.analyses.orderBy('timestamp').first();
  const oldestDays = oldest
    ? Math.floor((Date.now() - oldest.timestamp) / (24 * 60 * 60 * 1000))
    : 0;

  return { count, oldestDays };
}
