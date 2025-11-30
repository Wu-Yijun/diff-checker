import React, { useMemo } from 'react';
import { computeDiff } from '../services/diffService';
import { DiffPart, Snippet } from '../types';
import { ClipboardIcon } from './Icons';

interface DiffViewerProps {
  leftSnippet: Snippet | null;
  rightSnippet: Snippet | null;
  onUpdateSnippet: (id: string, content: string) => void;
  editCost: number;
  cleanupMode: 'semantic' | 'efficiency';
  onSnippetDrop: (side: 'left' | 'right', snippetId: string) => void;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ leftSnippet, rightSnippet, onUpdateSnippet, editCost, cleanupMode, onSnippetDrop }) => {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const [isCtrlPressed, setIsCtrlPressed] = React.useState(false);
  const [dragOverSide, setDragOverSide] = React.useState<'left' | 'right' | null>(null);

  const diff = useMemo(() => {
    if (!leftSnippet || !rightSnippet) return [];
    return computeDiff(leftSnippet.content, rightSnippet.content, editCost, cleanupMode);
  }, [leftSnippet, rightSnippet, editCost, cleanupMode]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    diff.forEach(part => {
      if (part.type === 'insert') added += part.value.length;
      if (part.type === 'delete') removed += part.value.length;
    });
    return { added, removed };
  }, [diff]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control') setIsCtrlPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control') setIsCtrlPressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleDragOver = (e: React.DragEvent, side: 'left' | 'right') => {
    e.preventDefault();
    if (dragOverSide !== side) setDragOverSide(side);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverSide(null);
  };

  const handleDrop = (e: React.DragEvent, side: 'left' | 'right') => {
    e.preventDefault();
    setDragOverSide(null);
    const snippetId = e.dataTransfer.getData('snippetId');
    if (snippetId) {
      onSnippetDrop(side, snippetId);
    }
  };

  const handlePaste = async (id: string) => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        onUpdateSnippet(id, text);
      }
    } catch (err) {
      console.error('Failed to read clipboard:', err);
      alert('Could not access clipboard. Please ensure you have granted permission.');
    }
  };

  const getPairIndex = (index: number) => {
    const part = diff[index];
    if (part.type === 'delete' && diff[index + 1]?.type === 'insert') return index + 1;
    if (part.type === 'insert' && diff[index - 1]?.type === 'delete') return index - 1;
    return null;
  };

  const handleDiffClick = (index: number, part: DiffPart, side: 'left' | 'right') => {
    if (!isCtrlPressed) return;

    const pairIndex = getPairIndex(index);
    const pairPart = pairIndex !== null ? diff[pairIndex] : null;

    // Left Side Actions
    if (side === 'left') {
      if (part.type === 'delete' && leftSnippet) {
        // If paired with insert (modified region), replace delete content with insert content
        if (pairPart && pairPart.type === 'insert') {
          const newContent = diff
            .map((p, i) => {
              if (p.type === 'equal') return p.value;
              if (p.type === 'delete') {
                if (i === index) return pairPart.value; // Replace Delete with Insert
                return p.value;
              }
              return '';
            })
            .join('');
          onUpdateSnippet(leftSnippet.id, newContent);
        } else {
          // Standard delete removal
          const newContent = diff
            .filter((p, i) => {
              if (i === index) return false;
              return p.type === 'equal' || p.type === 'delete';
            })
            .map(p => p.value)
            .join('');
          onUpdateSnippet(leftSnippet.id, newContent);
        }
      } else if (part.type === 'insert' && leftSnippet) {
        // Add 'insert' part to Left (from placeholder)
        const newContent = diff
          .filter((p, i) => {
            if (i === index) return true;
            return p.type === 'equal' || p.type === 'delete';
          })
          .map(p => p.value)
          .join('');
        onUpdateSnippet(leftSnippet.id, newContent);
      }
    }

    // Right Side Actions
    if (side === 'right') {
      if (part.type === 'insert' && rightSnippet) {
        // If paired with delete (modified region), replace insert content with delete content
        if (pairPart && pairPart.type === 'delete') {
          // Reconstruct Right content.
          // Right = Equal + Insert.
          // We want New Right = Equal + Delete.
          const newContent = diff
            .map((p, i) => {
              if (p.type === 'equal') return p.value;
              if (p.type === 'insert') {
                if (i === index) return pairPart.value; // Replace Insert with Delete
                return p.value;
              }
              return '';
            })
            .join('');
          onUpdateSnippet(rightSnippet.id, newContent);
        } else {
          // Standard insert removal
          const newContent = diff
            .filter((p, i) => {
              if (i === index) return false;
              return p.type === 'equal' || p.type === 'insert';
            })
            .map(p => p.value)
            .join('');
          onUpdateSnippet(rightSnippet.id, newContent);
        }
      } else if (part.type === 'delete' && rightSnippet) {
        // Add 'delete' part to Right (from placeholder)
        const newContent = diff
          .filter((p, i) => {
            if (i === index) return true;
            return p.type === 'equal' || p.type === 'insert';
          })
          .map(p => p.value)
          .join('');
        onUpdateSnippet(rightSnippet.id, newContent);
      }
    }
  };

  if (!leftSnippet || !rightSnippet) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
        <div className="flex-1 flex">
          {/* Left Drop Zone (Empty State) */}
          <div
            className={`flex-1 flex flex-col items-center justify-center border-r border-gray-200 dark:border-gray-800 transition-all duration-200 ${dragOverSide === 'left' ? 'bg-blue-50 dark:bg-blue-900/20 ring-inset ring-2 ring-blue-500' : ''
              }`}
            onDragOver={(e) => handleDragOver(e, 'left')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'left')}
          >
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-gray-200 dark:bg-gray-900 rounded-full flex items-center justify-center mb-4 mx-auto border border-gray-300 dark:border-gray-800">
                <span className="text-2xl text-gray-400">L</span>
              </div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">Drag snippet here for Left</p>
            </div>
          </div>

          {/* Right Drop Zone (Empty State) */}
          <div
            className={`flex-1 flex flex-col items-center justify-center transition-all duration-200 ${dragOverSide === 'right' ? 'bg-blue-50 dark:bg-blue-900/20 ring-inset ring-2 ring-blue-500' : ''
              }`}
            onDragOver={(e) => handleDragOver(e, 'right')}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, 'right')}
          >
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-gray-200 dark:bg-gray-900 rounded-full flex items-center justify-center mb-4 mx-auto border border-gray-300 dark:border-gray-800">
                <span className="text-2xl text-gray-400">R</span>
              </div>
              <p className="text-gray-500 dark:text-gray-400 font-medium">Drag snippet here for Right</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const getHighlightClass = (index: number) => {
    const pairIndex = getPairIndex(index);
    const isHovered = hoveredIndex === index || (pairIndex !== null && hoveredIndex === pairIndex);

    if (isCtrlPressed && isHovered) {
      return 'ring-2 ring-yellow-400/50 z-10 relative cursor-pointer';
    }
    return '';
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      {/* Stats Bar */}
      <div className="h-12 border-b border-gray-200 dark:border-gray-800 flex items-center px-6 gap-6 bg-white/50 dark:bg-gray-900/50 backdrop-blur transition-colors duration-200">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500/80"></span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{stats.removed} chars removed</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500/80"></span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{stats.added} chars added</span>
        </div>

        {/* Snippet Indicators */}
        <div className="ml-auto flex items-center gap-3 text-sm bg-gray-100 dark:bg-gray-950 py-1.5 px-3 rounded-full border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 max-w-[150px]">
            <span className="w-2 h-2 rounded-full bg-gray-400"></span>
            <span className="truncate text-gray-600 dark:text-gray-300">{leftSnippet ? leftSnippet.title : 'None'}</span>
          </div>
          <span className="text-gray-400 dark:text-gray-600">vs</span>
          <div className="flex items-center gap-2 max-w-[150px]">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="truncate text-gray-600 dark:text-gray-300">{rightSnippet ? rightSnippet.title : 'None'}</span>
          </div>
        </div>
      </div>

      {/* Main Diff Area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Panel (Original) */}
        <div
          className={`flex-1 flex flex-col border-r border-gray-200 dark:border-gray-800 min-w-0 transition-all duration-200 relative ${dragOverSide === 'left' ? 'ring-inset ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : ''
            }`}
          onDragOver={(e) => handleDragOver(e, 'left')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'left')}
        >
          {dragOverSide === 'left' && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-500/10 backdrop-blur-[1px] pointer-events-none">
              <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg font-medium animate-in zoom-in-95 duration-150">
                Drop to load on Left
              </div>
            </div>
          )}
          <div className="h-10 bg-gray-100 dark:bg-gray-900 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800 select-none transition-colors duration-200">
            <div className="flex items-center overflow-hidden mr-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-500 flex-shrink-0">Original (Left)</span>
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 truncate">{leftSnippet.title}</span>
            </div>
            <button
              onClick={() => handlePaste(leftSnippet.id)}
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 rounded transition-colors"
              title="Paste from clipboard and replace content"
            >
              <ClipboardIcon className="w-3 h-3" />
              Paste
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 font-mono text-sm leading-6 custom-scrollbar bg-white dark:bg-gray-950 transition-colors duration-200">
            <div className="whitespace-pre-wrap break-words">
              {diff.map((part, index) => {
                // For 'insert', check if it's paired with a previous delete
                if (part.type === 'insert') {
                  // If paired, DO NOT show placeholder
                  if (diff[index - 1]?.type === 'delete') return null;

                  return (
                    <span
                      key={index}
                      className={`inline-block bg-green-100 dark:bg-green-900/40 w-2 h-4 align-middle mx-[1px] rounded-[1px] ${getHighlightClass(index)}`}
                      title="Missing content (Click to add)"
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      onClick={() => handleDiffClick(index, part, 'left')}
                    >
                      &nbsp;
                    </span>
                  );
                }

                const baseClass = part.type === 'delete'
                  ? "bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-200 rounded-[2px] border-b-2 border-red-200 dark:border-red-800"
                  : "text-gray-600 dark:text-gray-400";

                return (
                  <span
                    key={index}
                    className={`${baseClass} ${getHighlightClass(index)}`}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => handleDiffClick(index, part, 'left')}
                  >
                    {part.value}
                  </span>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Panel (Modified) */}
        <div
          className={`flex-1 flex flex-col min-w-0 transition-all duration-200 relative ${dragOverSide === 'right' ? 'ring-inset ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : ''
            }`}
          onDragOver={(e) => handleDragOver(e, 'right')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'right')}
        >
          {dragOverSide === 'right' && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-500/10 backdrop-blur-[1px] pointer-events-none">
              <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg font-medium animate-in zoom-in-95 duration-150">
                Drop to load on Right
              </div>
            </div>
          )}
          <div className="h-10 bg-gray-100 dark:bg-gray-900 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800 select-none transition-colors duration-200">
            <div className="flex items-center overflow-hidden mr-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-500 flex-shrink-0">Modified (Right)</span>
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 truncate">{rightSnippet.title}</span>
            </div>
            <button
              onClick={() => handlePaste(rightSnippet.id)}
              className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 rounded transition-colors"
              title="Paste from clipboard and replace content"
            >
              <ClipboardIcon className="w-3 h-3" />
              Paste
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 font-mono text-sm leading-6 custom-scrollbar bg-white dark:bg-gray-950 transition-colors duration-200">
            <div className="whitespace-pre-wrap break-words">
              {diff.map((part, index) => {
                // For 'delete', check if it's paired with a next insert
                if (part.type === 'delete') {
                  // If paired, DO NOT show placeholder
                  if (diff[index + 1]?.type === 'insert') return null;

                  return (
                    <span
                      key={index}
                      className={`inline-block bg-red-100 dark:bg-red-900/40 w-2 h-4 align-middle mx-[1px] rounded-[1px] ${getHighlightClass(index)}`}
                      title="Missing content (Click to add)"
                      onMouseEnter={() => setHoveredIndex(index)}
                      onMouseLeave={() => setHoveredIndex(null)}
                      onClick={() => handleDiffClick(index, part, 'right')}
                    >
                      &nbsp;
                    </span>
                  );
                }

                const baseClass = part.type === 'insert'
                  ? "bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-200 rounded-[2px] border-b-2 border-green-200 dark:border-green-800"
                  : "text-gray-600 dark:text-gray-400";

                return (
                  <span
                    key={index}
                    className={`${baseClass} ${getHighlightClass(index)}`}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    onClick={() => handleDiffClick(index, part, 'right')}
                  >
                    {part.value}
                  </span>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};