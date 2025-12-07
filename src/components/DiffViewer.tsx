import React, { useMemo, useEffect, useRef, useState, useCallback } from 'react';
import { DiffPart, Snippet } from '../types';
import { ClipboardIcon, CopyIcon, EditModeIcon, SplitByLineIcon } from './Icons';
import type { DiffWorkerRequest, DiffWorkerResponse } from '../workers/diff.worker';
import { useLanguage } from '../contexts/LanguageContext';

interface DiffViewerProps {
  leftSnippet: Snippet | null;
  rightSnippet: Snippet | null;
  onUpdateSnippet: (id: string, content: string) => void;
  editCost: number;
  cleanupMode: 'semantic' | 'efficiency';
  onSnippetDrop: (side: 'left' | 'right', snippetId: string) => void;
  isEditMode: boolean;
  splitByLine: boolean;
  onEditModeChange: (enabled: boolean) => void;
  onSplitByLineChange: (enabled: boolean) => void;
  selectedPanel: 'left' | 'right' | null;
  onPanelSelect: (panel: 'left' | 'right' | null) => void;
  onTextDrop: (content: string, side?: 'left' | 'right') => void;
}


export const DiffViewer: React.FC<DiffViewerProps> = ({
  leftSnippet,
  rightSnippet,
  onUpdateSnippet,
  editCost,
  cleanupMode,
  onSnippetDrop,
  isEditMode,
  splitByLine,
  onEditModeChange,
  onSplitByLineChange,
  selectedPanel,
  onPanelSelect,
  onTextDrop
}) => {
  const { t } = useLanguage();


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

  // Scroll container refs for synchronized scrolling
  const leftScrollRef = useRef<HTMLDivElement | null>(null);
  const rightScrollRef = useRef<HTMLDivElement | null>(null);

  // Refs to store scroll positions when splitByLine changes
  const savedLeftScroll = useRef<number>(0);
  const savedRightScroll = useRef<number>(0);
  const previousSplitByLine = useRef<boolean>(splitByLine);

  // Initialize editable content when snippets change
  useEffect(() => {
    if (leftSnippet) setEditableLeft(leftSnippet.content);
    else setEditableLeft(''); // Clear if null

    if (rightSnippet) setEditableRight(rightSnippet.content);
    else setEditableRight(''); // Clear if null
  }, [leftSnippet?.id, leftSnippet?.content, rightSnippet?.id, rightSnippet?.content]);

  // Initialize web worker
  useEffect(() => {
    workerRef.current = new Worker(new URL('../workers/diff.worker.ts', import.meta.url), { type: 'module' });
    workerRef.current.onmessage = (e: MessageEvent<DiffWorkerResponse>) => {
      const { parts, timestamp } = e.data;
      // Only update if this is a newer result
      if (timestamp >= lastWorkerTimestamp.current) {
        lastWorkerTimestamp.current = timestamp;
        setWorkerDiff(parts);

        // Restore scroll positions after diff update if splitByLine changed
        requestAnimationFrame(() => {
          if (leftScrollRef.current && savedLeftScroll.current > 0) {
            leftScrollRef.current.scrollTop = savedLeftScroll.current;
            savedLeftScroll.current = 0;
          }
          if (rightScrollRef.current && savedRightScroll.current > 0) {
            rightScrollRef.current.scrollTop = savedRightScroll.current;
            savedRightScroll.current = 0;
          }
        });
      }

      // Mark response received
      lastResponseTime.current = Date.now();

      // Clear timeout timer
      if (timeoutTimer.current) {
        clearTimeout(timeoutTimer.current);
        timeoutTimer.current = null;
      }

      if (cachedRequest.current === pendingRequest.current) {
        cachedRequest.current = null;
        pendingRequest.current = null;
        return;
      }

      if (postResponseTimer.current) clearTimeout(postResponseTimer.current);
      postResponseTimer.current = setTimeout(() => {
        sendWorkerRequest();
      }, 100);

    };

    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      console.log("Clear postResponseTimer");
      if (postResponseTimer.current) clearTimeout(postResponseTimer.current);
      if (timeoutTimer.current) clearTimeout(timeoutTimer.current);
      cachedRequest.current = null;
      pendingRequest.current = null;
    };
  }, []);

  // Helper function to send worker request, if there's a cached request, send it
  const sendWorkerRequest = useCallback(() => {
    if (!workerRef.current) return;

    if (!cachedRequest.current) return;
    pendingRequest.current = cachedRequest.current;
    lastRequestTime.current = Date.now();

    workerRef.current.postMessage(cachedRequest.current);

    if (postResponseTimer.current) { clearTimeout(postResponseTimer.current); postResponseTimer.current = null }
    // Set timeout timer for 3 seconds
    if (timeoutTimer.current) clearTimeout(timeoutTimer.current);
    timeoutTimer.current = setTimeout(() => {
      // Timeout reached, if there's a cached request, send it
      sendWorkerRequest();
    }, 3000);
  }, []);

  // Trigger worker diff computation with advanced debounce
  useEffect(() => {
    if (!workerRef.current) return;
    // if (!isEditMode || !workerRef.current) return;

    // Save scroll positions if only splitByLine is changing
    if (previousSplitByLine.current !== splitByLine) {
      if (leftScrollRef.current) {
        savedLeftScroll.current = leftScrollRef.current.scrollTop;
      }
      if (rightScrollRef.current) {
        savedRightScroll.current = rightScrollRef.current.scrollTop;
      }
      previousSplitByLine.current = splitByLine;
    }

    const request: DiffWorkerRequest = {
      text1: editableLeft,
      text2: editableRight,
      editCost,
      cleanupMode,
      splitByLine
    };

    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime.current;
    const timeSinceLastResponse = now - lastResponseTime.current;

    cachedRequest.current = request;
    if (timeSinceLastRequest > 3000) {
      sendWorkerRequest();
      return;
    }
    if (timeSinceLastResponse < 100) {
      if (postResponseTimer.current === null && !pendingRequest.current) {
        postResponseTimer.current = setTimeout(() => {
          sendWorkerRequest();
        }, 100 - timeSinceLastResponse);
      }
      return;
    }
    if (!pendingRequest.current) {
      sendWorkerRequest();
      return;
    }
    return;

  }, [editableLeft, editableRight, editCost, cleanupMode, isEditMode, splitByLine]);

  const stats = useMemo(() => {
    let added = 0;
    let removed = 0;
    workerDiff.forEach(part => {
      if (part.type === 'insert') added += part.value.length;
      if (part.type === 'delete') removed += part.value.length;
    });
    return { added, removed };
  }, [workerDiff]);

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

    // Check for Text Drop first
    if (e.dataTransfer.types.includes('text/plain')) {
      const text = e.dataTransfer.getData('text/plain');
      if (text) {
        onTextDrop(text, side);
        return;
      }
    }

    const snippetId = e.dataTransfer.getData('snippetId');
    if (snippetId) {
      onSnippetDrop(side, snippetId);
    }
  };

  // Sanitize text by removing invalid characters like \r
  const sanitizeText = (text: string): string => {
    // Remove \r (carriage return) and other characters that can't be typed in textarea
    return text.replace(/\r/g, '');
  };

  const handlePaste = async (id: string) => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        const sanitized = sanitizeText(text);
        if (isEditMode) {
          // Update editable state in edit mode
          if (leftSnippet?.id === id) setEditableLeft(sanitized);
          if (rightSnippet?.id === id) setEditableRight(sanitized);
        }
        onUpdateSnippet(id, sanitized);
      }
    } catch (err) {
      console.error('Failed to read clipboard:', err);
      alert('Could not access clipboard. Please ensure you have granted permission.');
    }
  };

  const handleCopy = async (id: string) => {
    try {
      let content = '';
      if (leftSnippet?.id === id) content = leftSnippet.content;
      else if (rightSnippet?.id === id) content = rightSnippet.content;

      if (content) {
        await navigator.clipboard.writeText(content);
      }
    } catch (err) {
      console.error('Failed to write to clipboard:', err);
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
    const part = workerDiff[index];
    if (part.type === 'delete' && workerDiff[index + 1]?.type === 'insert') return index + 1;
    if (part.type === 'insert' && workerDiff[index - 1]?.type === 'delete') return index - 1;
    return null;
  };

  const handleDiffClick = (index: number, part: DiffPart, side: 'left' | 'right') => {
    if (!isCtrlPressed) return;

    const pairIndex = getPairIndex(index);
    const pairPart = pairIndex !== null ? workerDiff[pairIndex] : null;

    // Left Side Actions
    if (side === 'left') {
      if (part.type === 'delete' && leftSnippet) {
        // If paired with insert (modified region), replace delete content with insert content
        if (pairPart && pairPart.type === 'insert') {
          const newContent = workerDiff
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
          const newContent = workerDiff
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
        const newContent = workerDiff
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
          const newContent = workerDiff
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
          const newContent = workerDiff
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
        const newContent = workerDiff
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

  // Handle hover with synchronized scrolling
  const handleHoverEnter = useCallback((index: number, side: 'left' | 'right') => {
    setHoveredIndex(index);

    let pairIndex = index;
    if (workerDiff[index].type === 'delete' && workerDiff[index + 1]?.type === 'insert') pairIndex = index + 1;
    if (workerDiff[index].type === 'insert' && workerDiff[index - 1]?.type === 'delete') pairIndex = index - 1;

    // Scroll the opposite side to show the paired element
    const targetSide = side === 'left' ? 'right' : 'left';
    const scrollContainer = targetSide === 'left' ? leftScrollRef.current : rightScrollRef.current;
    const targetElement = scrollContainer?.querySelector(`[data-diff-index="${pairIndex}"]`) as HTMLElement;

    if (targetElement && scrollContainer) {
      const containerRect = scrollContainer.getBoundingClientRect();
      const elementRect = targetElement.getBoundingClientRect();

      // Check if element is not fully visible
      const isAbove = elementRect.top < containerRect.top;
      const isBelow = elementRect.bottom > containerRect.bottom;

      if (isAbove || isBelow) {
        // Scroll to center the element
        const scrollTop = targetElement.offsetTop - scrollContainer.offsetTop - (scrollContainer.clientHeight / 2) + (targetElement.clientHeight / 2);
        scrollContainer.scrollTo({ top: scrollTop, behavior: 'smooth' });
      }
    }
  }, [workerDiff]);


  // console.warn(leftSnippet, rightSnippet);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
      {/* Stats Bar */}
      <div className="h-12 border-b border-gray-200 dark:border-gray-800 flex items-center px-6 gap-6 bg-white/50 dark:bg-gray-900/50 backdrop-blur transition-colors duration-200 relative">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-red-500/80"></span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{stats.removed} {t('chars_removed')}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500/80"></span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{stats.added} {t('chars_added')}</span>
        </div>

        {/* Snippet Indicators - Centered */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3 text-sm bg-gray-100 dark:bg-gray-950 py-1.5 px-3 rounded-full border border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2 max-w-[150px]">
            <span className="w-2 h-2 rounded-full bg-gray-400"></span>
            <span className="truncate text-gray-600 dark:text-gray-300">{leftSnippet ? leftSnippet.title : t('none')}</span>
          </div>
          <span className="text-gray-400 dark:text-gray-600">{t('vs')}</span>
          <div className="flex items-center gap-2 max-w-[150px]">
            <span className="w-2 h-2 rounded-full bg-blue-500"></span>
            <span className="truncate text-gray-600 dark:text-gray-300">{rightSnippet ? rightSnippet.title : t('none')}</span>
          </div>
        </div>

        {/* Toggle Buttons - Right Side */}
        <div className="ml-auto flex items-center gap-2">
          {/* Edit Mode Toggle */}
          <button
            onClick={() => onEditModeChange(!isEditMode)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium text-xs transition-colors ${isEditMode
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 dark:bg-gray-950 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-800'
              }`}
            title={isEditMode ? t('switch_view') : t('switch_edit')}
          >
            {EditModeIcon({ isEditMode })}
            <span>{isEditMode ? t('edit_mode') : t('view_mode')}</span>
          </button>

          {/* Split By Line Toggle */}
          <button
            onClick={() => onSplitByLineChange(!splitByLine)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-medium text-xs transition-colors ${splitByLine
              ? 'bg-green-600 text-white shadow-md'
              : 'bg-gray-100 dark:bg-gray-950 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-800'
              }`}
            title={splitByLine ? t('split_line_disable') : t('split_line_enable')}
          >
            {SplitByLineIcon({})}
            <span>{splitByLine ? t('line_mode') : t('char_mode')}</span>
          </button>
        </div>
      </div>

      {/* Main Diff Area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left Panel (Original) */}
        <div
          className={
            "flex-1 flex flex-col border-r border-gray-200 dark:border-gray-800 min-w-0 transition-all duration-200 relative "
            + (dragOverSide === 'left' ? 'ring-inset ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : '')
          }
          onDragOver={(e) => handleDragOver(e, 'left')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'left')}
          onClick={(e) => { e.stopPropagation(); onPanelSelect('left'); }}
        >
          {/* Selection Overlay */}
          {selectedPanel === 'left' && (
            <div className="absolute inset-0 z-20 pointer-events-none ring-inset ring-4 ring-blue-500/50" />
          )}
          {dragOverSide === 'left' && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-500/10 backdrop-blur-[1px] pointer-events-none">
              <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg font-medium animate-in zoom-in-95 duration-150">
                {t('drop_left')}
              </div>
            </div>
          )}
          <div className="h-10 bg-gray-100 dark:bg-gray-900 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800 select-none transition-colors duration-200">
            <div className="flex items-center overflow-hidden mr-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-500 flex-shrink-0">{t('original_left')}</span>
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 truncate">{leftSnippet?.title ?? t('none')}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => leftSnippet?.id && handleCopy(leftSnippet.id)}
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 rounded transition-colors"
                title={t('copy_tooltip')}
              >
                <CopyIcon className="w-3 h-3" />
                {t('copy')}
              </button>
              <button
                onClick={() => leftSnippet?.id && handlePaste(leftSnippet.id)}
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 rounded transition-colors"
                title={t('paste_tooltip')}
              >
                <ClipboardIcon className="w-3 h-3" />
                {t('paste')}
              </button>
            </div>
          </div>
          <div ref={leftScrollRef} className="flex-1 overflow-auto custom-scrollbar bg-white dark:bg-gray-950 transition-colors duration-200 relative">
            {/* Content Area or Placeholder */}
            {!leftSnippet ? (
              <div className="absolute inset-0 flex items-center justify-center p-6 text-center select-none pointer-events-none">
                <div className="text-gray-400 dark:text-gray-600">
                  <p className="text-lg font-medium mb-2">{t("no_snippet_selected")}</p>
                  <p className="text-sm">{t("drag_paste_select")}</p>
                </div>
              </div>
            ) : (
              <div className="relative min-h-full p-4 font-mono text-sm leading-6" style={{ paddingBottom: 'calc(33.33vh)' }}>
                {/* Edit Mode Textarea Overlay */}
                {isEditMode && (
                  <textarea
                    value={editableLeft}
                    onChange={(e) => handleTextareaChange('left', e.target.value)}
                    className="absolute overflow-hidden inset-0 w-full h-full p-4 font-mono text-sm leading-6 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 z-10 bg-transparent"
                    spellCheck={false}
                  />
                )}
                <div className={"whitespace-pre-wrap break-words " + (isEditMode ? "select-none " : "")} >
                  {workerDiff.map((part, index) => {
                    // For 'insert', check if it's paired with a previous delete
                    if (part.type === 'insert') {
                      // If paired, DO NOT show placeholder
                      if (workerDiff[index - 1]?.type === 'delete') return null;

                      return (
                        <span
                          key={index}
                          data-diff-index={index}
                          className={`absolute -translate-x-1  inline-block bg-red-500/70 dark:bg-red-500/70 w-1 h-6 align-middle mx-[1px] rounded-[1px] ${getHighlightClass(index, false)}`}
                          title={t('missing_content')}
                          onMouseEnter={() => handleHoverEnter(index, 'left')}
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
                        data-diff-index={index}
                        className={`${baseClass} ${getHighlightClass(index)}`}
                        onMouseEnter={() => handleHoverEnter(index, 'left')}
                        onMouseLeave={() => setHoveredIndex(null)}
                        onClick={() => handleDiffClick(index, part, 'left')}
                      >
                        {part.value}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel (Modified) */}
        <div
          className={`flex-1 flex flex-col min-w-0 transition-all duration-200 relative ${dragOverSide === 'right' ? 'ring-inset ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : ''
            }`}
          onDragOver={(e) => handleDragOver(e, 'right')}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, 'right')}
          onClick={(e) => { e.stopPropagation(); onPanelSelect('right'); }}
        >
          {/* Selection Overlay */}
          {selectedPanel === 'right' && (
            <div className="absolute inset-0 z-20 pointer-events-none ring-inset ring-4 ring-blue-500/50" />
          )}
          {dragOverSide === 'right' && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-blue-500/10 backdrop-blur-[1px] pointer-events-none">
              <div className="bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg font-medium animate-in zoom-in-95 duration-150">
                {t('drop_right')}
              </div>
            </div>
          )}
          <div className="h-10 bg-gray-100 dark:bg-gray-900 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800 select-none transition-colors duration-200">
            <div className="flex items-center overflow-hidden mr-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-500 flex-shrink-0">{t('modified_right')}</span>
              <span className="ml-2 text-sm text-gray-700 dark:text-gray-300 truncate">{rightSnippet?.title ?? t('none')}</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => rightSnippet?.id && handleCopy(rightSnippet.id)}
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 rounded transition-colors"
                title={t('copy_tooltip')}
              >
                <CopyIcon className="w-3 h-3" />
                {t('copy')}
              </button>
              <button
                onClick={() => rightSnippet?.id && handlePaste(rightSnippet.id)}
                className="flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-700 rounded transition-colors"
                title={t('paste_tooltip')}
              >
                <ClipboardIcon className="w-3 h-3" />
                {t('paste')}
              </button>
            </div>
          </div>
          <div ref={rightScrollRef} className="flex-1 overflow-auto bg-white dark:bg-gray-950 custom-scrollbar transition-colors duration-200 relative">
            {/* Content Area or Placeholder */}
            {!rightSnippet ? (
              <div className="absolute inset-0 flex items-center justify-center p-6 text-center select-none pointer-events-none">
                <div className="text-gray-400 dark:text-gray-600">
                  <p className="text-lg font-medium mb-2">No Snippet Selected</p>
                  <p className="text-sm">Drag text here, paste, or select from sidebar</p>
                </div>
              </div>
            ) : (
              <div className="relative min-h-full p-4 font-mono text-sm leading-6" style={{ paddingBottom: 'calc(33.33vh)' }}>
                {/* Edit Mode Textarea Overlay */}
                {isEditMode && (
                  <textarea
                    value={editableRight}
                    onChange={(e) => handleTextareaChange('right', e.target.value)}
                    className="absolute overflow-hidden inset-0 w-full h-full p-4 font-mono text-sm leading-6 text-gray-900 dark:text-gray-100 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 z-10 bg-transparent"
                    spellCheck={false}
                  />
                )}
                <div className={"whitespace-pre-wrap break-words " + (isEditMode ? "select-none " : "")} >
                  {workerDiff.map((part, index) => {
                    // For 'delete', check if it's paired with a next insert
                    if (part.type === 'delete') {
                      // If paired, DO NOT show placeholder
                      if (workerDiff[index + 1]?.type === 'insert') return null;

                      return (
                        <span
                          key={index}
                          data-diff-index={index}
                          className={`absolute -translate-x-1 inline-block bg-green-500/70 dark:bg-green-500/70 w-1 h-6 align-middle mx-[1px] rounded-[1px] ${getHighlightClass(index, false)} `}
                          title={t('missing_content')}
                          onMouseEnter={() => handleHoverEnter(index, 'right')}
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
                        data-diff-index={index}
                        className={`${baseClass} ${getHighlightClass(index)}`}
                        onMouseEnter={() => handleHoverEnter(index, 'right')}
                        onMouseLeave={() => setHoveredIndex(null)}
                        onClick={() => handleDiffClick(index, part, 'right')}
                      >
                        {part.value}
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};