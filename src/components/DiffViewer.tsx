import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { computeDiff } from '../services/diffService';
import { DiffPart, Snippet } from '../types';
import { ClipboardIcon } from './Icons';
import type { DiffWorkerRequest, DiffWorkerResponse } from '../workers/diff.worker';

interface DiffViewerProps {
  leftSnippet: Snippet | null;
  rightSnippet: Snippet | null;
  onUpdateSnippet: (id: string, content: string) => void;
  editCost: number;
  cleanupMode: 'semantic' | 'efficiency';
  onSnippetDrop: (side: 'left' | 'right', snippetId: string) => void;
  isEditMode: boolean;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({ leftSnippet, rightSnippet, onUpdateSnippet, editCost, cleanupMode, onSnippetDrop, isEditMode }) => {
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const [isCtrlPressed, setIsCtrlPressed] = React.useState(false);
  const [dragOverSide, setDragOverSide] = React.useState<'left' | 'right' | null>(null);

  // Edit mode state
  const [editableLeft, setEditableLeft] = useState('');
  const [editableRight, setEditableRight] = useState('');
  const [workerDiff, setWorkerDiff] = useState<DiffPart[]>([]);
  const workerRef = useRef<Worker | null>(null);
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastWorkerTimestamp = useRef<number>(0);

  // Advanced debounce state
  const lastRequestTime = useRef<number>(0);
  const lastResponseTime = useRef<number>(0);
  const pendingRequest = useRef<DiffWorkerRequest | null>(null);
  const cachedRequest = useRef<DiffWorkerRequest | null>(null);
  const postResponseTimer = useRef<NodeJS.Timeout | null>(null);
  const timeoutTimer = useRef<NodeJS.Timeout | null>(null);

  // Initialize editable content when snippets change
  useEffect(() => {
    if (leftSnippet) setEditableLeft(leftSnippet.content);
    if (rightSnippet) setEditableRight(rightSnippet.content);
  }, [leftSnippet?.id, leftSnippet?.content, rightSnippet?.id, rightSnippet?.content]);

  // Initialize web worker
  useEffect(() => {
    if (isEditMode) {
      workerRef.current = new Worker(new URL('../workers/diff.worker.ts', import.meta.url), { type: 'module' });

      workerRef.current.onmessage = (e: MessageEvent<DiffWorkerResponse>) => {
        const { parts, timestamp } = e.data;
        // Only update if this is a newer result
        if (timestamp >= lastWorkerTimestamp.current) {
          lastWorkerTimestamp.current = timestamp;
          setWorkerDiff(parts);
        }

        // Mark response received
        lastResponseTime.current = Date.now();
        pendingRequest.current = null;

        // Clear timeout timer
        if (timeoutTimer.current) {
          clearTimeout(timeoutTimer.current);
          timeoutTimer.current = null;
        }

        // If there's a cached request, schedule it for 100ms later
        if (cachedRequest.current) {
          const requestToSend = cachedRequest.current;
          cachedRequest.current = null;

          postResponseTimer.current = setTimeout(() => {
            sendWorkerRequest(requestToSend);
          }, 100);
        }
      };

      return () => {
        workerRef.current?.terminate();
        workerRef.current = null;
        if (postResponseTimer.current) clearTimeout(postResponseTimer.current);
        if (timeoutTimer.current) clearTimeout(timeoutTimer.current);
      };
    }
  }, [isEditMode]);

  // Helper function to send worker request
  const sendWorkerRequest = useCallback((request: DiffWorkerRequest) => {
    if (!workerRef.current) return;

    pendingRequest.current = request;
    lastRequestTime.current = Date.now();
    workerRef.current.postMessage(request);

    // Set timeout timer for 3 seconds
    if (timeoutTimer.current) clearTimeout(timeoutTimer.current);
    timeoutTimer.current = setTimeout(() => {
      // Timeout reached, if there's a cached request, send it
      if (cachedRequest.current) {
        const requestToSend = cachedRequest.current;
        cachedRequest.current = null;
        pendingRequest.current = null;
        sendWorkerRequest(requestToSend);
      }
    }, 3000);
  }, []);

  // Trigger worker diff computation with advanced debounce
  useEffect(() => {
    if (!isEditMode || !workerRef.current) return;

    const request: DiffWorkerRequest = {
      text1: editableLeft,
      text2: editableRight,
      editCost,
      cleanupMode
    };

    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime.current;
    const timeSinceLastResponse = now - lastResponseTime.current;

    // Clear any pending post-response timer
    if (postResponseTimer.current) {
      clearTimeout(postResponseTimer.current);
      postResponseTimer.current = null;
    }

    // Check if we should send immediately
    const shouldSendImmediately =
      !pendingRequest.current && // No pending request
      (timeSinceLastResponse >= 100 || lastResponseTime.current === 0); // 100ms since last response or no response yet

    const shouldTimeoutAndSend =
      pendingRequest.current && // There is a pending request
      timeSinceLastRequest >= 3000; // 3 seconds since last request

    if (shouldSendImmediately) {
      sendWorkerRequest(request);
    } else if (shouldTimeoutAndSend) {
      // Timeout reached, send new request
      cachedRequest.current = null;
      sendWorkerRequest(request);
    } else {
      // Cache the request for later
      cachedRequest.current = request;
    }
  }, [editableLeft, editableRight, editCost, cleanupMode, isEditMode]);

  // Use worker diff in edit mode, regular diff otherwise
  const diff = useMemo(() => {
    if (isEditMode) return workerDiff;
    if (!leftSnippet || !rightSnippet) return [];
    return computeDiff(leftSnippet.content, rightSnippet.content, editCost, cleanupMode);
  }, [isEditMode, workerDiff, leftSnippet, rightSnippet, editCost, cleanupMode]);

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
        if (isEditMode) {
          // Update editable state in edit mode
          if (leftSnippet?.id === id) setEditableLeft(text);
          if (rightSnippet?.id === id) setEditableRight(text);
        }
        onUpdateSnippet(id, text);
      }
    } catch (err) {
      console.error('Failed to read clipboard:', err);
      alert('Could not access clipboard. Please ensure you have granted permission.');
    }
  };

  // Handle textarea changes with debounced snippet update
  const handleTextareaChange = useCallback((side: 'left' | 'right', value: string) => {
    if (side === 'left') {
      setEditableLeft(value);
      if (leftSnippet.id === rightSnippet.id) setEditableRight(value);
      if (leftSnippet) {
        // Debounce snippet update
        if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
        updateTimerRef.current = setTimeout(() => {
          onUpdateSnippet(leftSnippet.id, value);
        }, 500);
      }
    } else {
      setEditableRight(value);
      if (leftSnippet.id === rightSnippet.id) setEditableLeft(value);
      if (rightSnippet) {
        // Debounce snippet update
        if (updateTimerRef.current) clearTimeout(updateTimerRef.current);
        updateTimerRef.current = setTimeout(() => {
          onUpdateSnippet(rightSnippet.id, value);
        }, 500);
      }
    }
  }, [leftSnippet, rightSnippet, onUpdateSnippet]);

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

  const getHighlightClass = (index: number, relative = true) => {
    const pairIndex = getPairIndex(index);
    const isHovered = hoveredIndex === index || (pairIndex !== null && hoveredIndex === pairIndex);
    let style = "";

    if (isCtrlPressed && isHovered) {
      style += "cursor-pointer ";
    }
    if (isHovered) {
      style += 'ring-4 ring-yellow-400/50 z-20 ';
      if (relative) style += " relative";
    }
    return style;
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
          <div className="flex-1 overflow-auto custom-scrollbar bg-white dark:bg-gray-950 transition-colors duration-200 relative">
            <div className="relative min-h-full p-4 font-mono text-sm leading-6">
              {/* Edit Mode Textarea Overlay */}
              {isEditMode && (
                <textarea
                  value={editableLeft}
                  onChange={(e) => handleTextareaChange('left', e.target.value)}
                  className="absolute inset-0 w-full h-full p-4 font-mono text-sm leading-6 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 z-10 bg-transparent"
                  spellCheck={false}
                />
              )}
              <div className={"whitespace-pre-wrap break-words " + (isEditMode ? "select-none " : "")} >
                {diff.map((part, index) => {
                  // For 'insert', check if it's paired with a previous delete
                  if (part.type === 'insert') {
                    // If paired, DO NOT show placeholder
                    if (diff[index - 1]?.type === 'delete') return null;

                    return (
                      <span
                        key={index}
                        className={`absolute -translate-x-1  inline-block bg-red-500/70 dark:bg-red-500/70 w-1 h-6 align-middle mx-[1px] rounded-[1px] ${getHighlightClass(index, false)}`}
                        title="Missing content (Right Click to add)"
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        onClick={() => handleDiffClick(index, part, 'left')}
                      >

                      </span>
                    );
                  }

                  const baseClass = part.type === 'delete' ?
                    ("bg-red-100 dark:bg-red-900/40 rounded-[2px] border-b-2 border-red-200 dark:border-red-800 "
                      + (isEditMode ? "text-gray-500/0 " : "text-red-800 dark:text-red-200 "))
                    : (isEditMode ? "text-gray-500/0 " : "text-gray-600 dark:text-gray-400");

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
          <div className="flex-1 overflow-auto bg-white dark:bg-gray-950 custom-scrollbar transition-colors duration-200 relative">
            <div className="relative min-h-full p-4 font-mono text-sm leading-6">
              {/* Edit Mode Textarea Overlay */}
              {isEditMode && (
                <textarea
                  value={editableRight}
                  onChange={(e) => handleTextareaChange('right', e.target.value)}
                  className="absolute inset-0 w-full h-full p-4 font-mono text-sm leading-6 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 z-10 bg-transparent"
                  spellCheck={false}
                />
              )}
              <div className={"whitespace-pre-wrap break-words " + (isEditMode ? "select-none " : "")} >
                {diff.map((part, index) => {
                  // For 'delete', check if it's paired with a next insert
                  if (part.type === 'delete') {
                    // If paired, DO NOT show placeholder
                    if (diff[index + 1]?.type === 'insert') return null;

                    return (
                      <span
                        key={index}
                        className={`absolute -translate-x-1 inline-block bg-green-500/70 dark:bg-green-500/70 w-1 h-6 align-middle mx-[1px] rounded-[1px] ${getHighlightClass(index, false)} `}
                        title="Missing content (Right Click to add)"
                        onMouseEnter={() => setHoveredIndex(index)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        onClick={() => handleDiffClick(index, part, 'right')}
                      >

                      </span>
                    );
                  }

                  const baseClass = part.type === 'insert' ?
                    ("bg-green-100 dark:bg-green-900/40 rounded-[2px] border-b-2 border-green-200 dark:border-green-800 "
                      + (isEditMode ? "text-gray-500/0" : "text-green-800 dark:text-green-200"))
                    : (isEditMode ? "text-gray-500/0" : "text-gray-600 dark:text-gray-400");

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
    </div>
  );
};