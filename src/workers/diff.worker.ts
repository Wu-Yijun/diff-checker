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

export interface DiffWorkerRequest {
  text1: string;
  text2: string;
  editCost: number;
  cleanupMode: 'semantic' | 'efficiency';
}

export interface DiffWorkerResponse {
  parts: ReturnType<typeof computeDiff>;
  timestamp: number;
}

// Listen for messages from the main thread
self.addEventListener('message', (e: MessageEvent<DiffWorkerRequest>) => {
  const { text1, text2, editCost, cleanupMode } = e.data;

  try {
    const parts = computeDiff(text1, text2, editCost, cleanupMode);
    const response: DiffWorkerResponse = {
      parts,
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
