import { DiffPart } from '../types';
import { diff_match_patch } from 'diff-match-patch';

export const computeDiff = (text1: string, text2: string, editCost: number = 4, cleanupMode: 'efficiency' | 'semantic' = 'efficiency'): DiffPart[] => {
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