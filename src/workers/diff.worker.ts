import { DiffPart } from '../types';
import { diff_match_patch } from 'diff-match-patch';

function computeDiff(text1: string, text2: string, editCost: number = 4, cleanupMode: 'efficiency' | 'semantic' = 'efficiency'): DiffPart[] {
  const dmp = new diff_match_patch();
  dmp.Diff_EditCost = editCost;

  const diffs = dmp.diff_main(text1, text2);
  switch (cleanupMode) {
    case 'efficiency':
      dmp.diff_cleanupEfficiency(diffs);
      break;
    case 'semantic':
      dmp.diff_cleanupSemantic(diffs);
      break;
  }

  return diffs.map(([type, value]) => {
    let diffType: 'equal' | 'insert' | 'delete' = 'equal';
    if (type === 1) diffType = 'insert';
    if (type === -1) diffType = 'delete';

    return {
      type: diffType,
      value: value
    };
  });
};

/**
 * Split diff parts by newlines when splitByLine is enabled.
 * Each part will be split at newline boundaries, preserving the newline character.
 */
function split_diff_parts(parts: DiffPart[], splitByLine: boolean): DiffPart[] {
  if (!splitByLine) return parts;

  const result: DiffPart[] = [];

  for (const part of parts) {
    const lines = part.value.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isLastLine = i === lines.length - 1;

      // Add the line content (if not empty or if it's the last line)
      if (line.length > 0 || !isLastLine) {
        result.push({
          type: part.type,
          value: line + (isLastLine ? '' : '\n')
        });
      }
    }
  }

  return result;
}

export interface DiffWorkerRequest {
  text1: string;
  text2: string;
  editCost: number;
  cleanupMode: 'semantic' | 'efficiency';
  splitByLine: boolean;
}

export interface DiffWorkerResponse {
  parts: ReturnType<typeof computeDiff>;
  timestamp: number;
}

// Listen for messages from the main thread
self.addEventListener('message', (e: MessageEvent<DiffWorkerRequest>) => {
  const { text1, text2, editCost, cleanupMode, splitByLine } = e.data;

  try {
    const parts = computeDiff(text1, text2, editCost, cleanupMode);
    const processedParts = split_diff_parts(parts, splitByLine);
    const response: DiffWorkerResponse = {
      parts: processedParts,
      timestamp: Date.now()
    };

    self.postMessage(response);
  } catch (error) {
    console.error('Diff worker error:', error);
    // Post empty result on error
    self.postMessage({
      parts: [],
      timestamp: Date.now()
    });
  }
});
