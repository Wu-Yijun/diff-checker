import { computeDiff } from '../services/diffService';

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
