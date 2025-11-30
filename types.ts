export interface Snippet {
  id: string;
  title: string;
  content: string;
  createdAt: number;
}

export type DiffType = 'equal' | 'insert' | 'delete';

export interface DiffPart {
  type: DiffType;
  value: string;
}

export interface DiffResult {
  parts: DiffPart[];
  addedCount: number;
  removedCount: number;
}