import React, { useState, useEffect } from 'react';
import { Snippet } from './types';
import { DiffViewer } from './components/DiffViewer';
import { Button } from './components/Button';
import { PlusIcon, EditIcon, TrashIcon, CompareIcon, SunIcon, MoonIcon } from './components/Icons';
import { SnippetEditor } from './components/SnippetEditor';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { useLanguage } from './contexts/LanguageContext';

const version = "1.0.0";

const INITIAL_SNIPPETS: Snippet[] = [
  {
    id: '1',
    title: 'Example: Original Text',
    content: `The quick brown fox jumps over the lazy dog.\nThis is a simple text to demonstrate character-level diffing.\n\n(Current Version: ${version})`,
    createdAt: Date.now()
  },
  {
    id: '2',
    title: 'Example: Modified Text',
    content: `The fast brown fox leaped over the lazy dog.\nThis is a complex text to demonstrate character-level diffing algorithms.\n\n(This snippet only appears at the first time)`,
    createdAt: Date.now() + 1
  }
];

export default function App() {
  const { t } = useLanguage();
  const [snippets, setSnippets] = useState<Snippet[]>(() => {
    const old_version = localStorage.getItem('version');
    if (old_version !== version) {
      localStorage.setItem('version', version);
      return INITIAL_SNIPPETS;
    }
    return [];
  });
  const [leftId, setLeftId] = useState<string>('1');
  const [rightId, setRightId] = useState<string>('2');

  // Editor State
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingSnippetId, setEditingSnippetId] = useState<string | null>(null);

  // Diff Settings
  const [editCost, setEditCost] = useState<number>(4);
  const [cleanupMode, setCleanupMode] = useState<'semantic' | 'efficiency'>('efficiency');

  // Theme State
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const savedTheme = localStorage.getItem('theme');
    return (savedTheme as 'light' | 'dark') || 'dark';
  });

  // Edit Mode State
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  // Split By Line State
  const [splitByLine, setSplitByLine] = useState<boolean>(false);

  // Panel Selection State
  const [selectedPanel, setSelectedPanel] = useState<'left' | 'right' | null>(null);

  // Sidebar Drop Zone Highlight State
  const [isDropZoneActive, setIsDropZoneActive] = useState<boolean>(false);

  // Snippet Creation Counters
  const [untitledCounter, setUntitledCounter] = useState<number>(0);
  const [droppedCounter, setDroppedCounter] = useState<number>(0);
  const [pastedCounter, setPastedCounter] = useState<number>(0);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Helper to get actual objects
  const leftSnippet = snippets.find(s => s.id === leftId) || null;
  const rightSnippet = snippets.find(s => s.id === rightId) || null;

  const handleCreateSnippet = () => {
    setEditingSnippetId(null);
    setIsEditorOpen(true);
  };

  const handleEditSnippet = (id: string) => {
    setEditingSnippetId(id);
    setIsEditorOpen(true);
  };

  const handleDeleteSnippet = (id: string) => {
    if (confirm(t('confirm_delete'))) {
      // Clear selection first to prevent potential render issues
      if (leftId === id) setLeftId('');
      if (rightId === id) setRightId('');
      // Then remove from list
      setSnippets(prev => prev.filter(s => s.id !== id));
    }
  };

  const handleSaveSnippet = (id: string, title: string, content: string) => {
    if (id) {
      // Update existing
      setSnippets(prev => prev.map(s => s.id === id ? { ...s, title, content } : s));
    } else {
      // Create new from "New Snippet" button
      const newId = Math.random().toString(36).substring(2, 9);
      const newCounter = untitledCounter + 1;
      setUntitledCounter(newCounter);
      const finalTitle = title || (newCounter === 1 ? t('untitled_text') : `${t('untitled_text')} ${newCounter}`);
      const newSnippet: Snippet = {
        id: newId,
        title: finalTitle,
        content,
        createdAt: Date.now()
      };
      setSnippets(prev => [...prev, newSnippet]);

      // Auto-assign to selected panel if available, otherwise check empty slots
      if (selectedPanel === 'left') setLeftId(newId);
      else if (selectedPanel === 'right') setRightId(newId);
      else if (!leftId) setLeftId(newId);
      else if (!rightId) setRightId(newId);
    }
    setIsEditorOpen(false);
  };


  const handleUpdateSnippetContent = (id: string, newContent: string) => {
    setSnippets(prev => prev.map(s => s.id === id ? { ...s, content: newContent } : s));
  };

  const handleSnippetDrop = (side: 'left' | 'right', snippetId: string) => {
    if (side === 'left') setLeftId(snippetId);
    if (side === 'right') setRightId(snippetId);
  };

  const handleTextDrop = (content: string, side?: 'left' | 'right', source: 'drop' | 'paste' = 'drop') => {
    // Helper to create a new snippet from text
    const createSnippet = (text: string) => {
      const newId = Math.random().toString(36).substring(2, 9);

      let title: string;
      if (source === 'drop') {
        const newCounter = droppedCounter + 1;
        setDroppedCounter(newCounter);
        title = newCounter === 1 ? t('dropped_text') : `${t('dropped_text')} ${newCounter}`;
      } else {
        const newCounter = pastedCounter + 1;
        setPastedCounter(newCounter);
        title = newCounter === 1 ? t('pasted_text') : `${t('pasted_text')} ${newCounter}`;
      }

      const newSnippet: Snippet = {
        id: newId,
        title,
        content: text,
        createdAt: Date.now()
      };
      setSnippets(prev => [...prev, newSnippet]);
      return newId;
    };

    if (side) {
      // Dropped into a specific panel
      const currentId = side === 'left' ? leftId : rightId;
      const currentSnippet = snippets.find(s => s.id === currentId);

      if (currentSnippet) {
        // Replace content of existing snippet
        handleUpdateSnippetContent(currentId, content);
      } else {
        // Create new snippet and assign
        const newId = createSnippet(content);
        if (side === 'left') setLeftId(newId);
        else setRightId(newId);
      }
    } else {
      // Dropped into sidebar
      createSnippet(content);
    }
  };

  const handleSnippetClick = (id: string) => {
    if (selectedPanel === 'left') setLeftId(id);
    else if (selectedPanel === 'right') setRightId(id);
  };

  // Global Key Handler for Copy/Paste
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // If user has selected text on the page, do not override copy behavior
      // This handles both the hidden textarea in View mode and normal inputs
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) return;

      // Also check if active element is an input/textarea to be safe, though getSelection covers most cases
      // except where caret is inside but no text selected - we want Panel Copy in that case? 
      // User request: "Copy/replace internal text (provided internal text is not selected)"
      // If caret is in textarea but no selection, Ctrl+C usually does nothing or copies line. 
      // We will override if NO selection.

      if (selectedPanel && (e.ctrlKey || e.metaKey)) {
        if (e.key === 'c') {
          // Copy
          const snippet = selectedPanel === 'left' ? leftSnippet : rightSnippet;
          if (snippet) {
            e.preventDefault();
            try {
              await navigator.clipboard.writeText(snippet.content);
            } catch (err) {
              console.error('Failed to copy', err);
            }
          }
        } else if (e.key === 'v') {
          // Paste
          e.preventDefault();
          try {
            const text = await navigator.clipboard.readText();
            if (text) {
              handleTextDrop(text, selectedPanel, 'paste');
            }
          } catch (err) {
            console.error('Failed to paste', err);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPanel, leftSnippet, rightSnippet]);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans selection:bg-blue-500/30 transition-colors duration-200">
      {/* Sidebar - Snippet Manager */}
      <div
        className="w-80 flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 flex-shrink-0 z-10 transition-colors duration-200"
        onClick={() => setSelectedPanel(null)}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h1 className="font-bold text-gray-900 dark:text-gray-100 text-lg tracking-tight">{t('app_title')}</h1>
        </div>

        <div className="p-4">
          <Button onClick={handleCreateSnippet} className="w-full shadow-lg shadow-blue-900/20" icon={<PlusIcon />}>
            {t('new_snippet')}
          </Button>
        </div>

        <div
          className="flex-1 overflow-y-auto px-2 pb-4 space-y-2 custom-scrollbar"
          onDragOver={(e) => {
            e.preventDefault();
            // Only handle text drops, not snippet drags
            if (e.dataTransfer.types.includes('text/plain') && !e.dataTransfer.types.includes('snippetid')) {
              e.dataTransfer.dropEffect = 'copy';
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            // Only handle text drops if a snippet is not being dragged
            if (!e.dataTransfer.getData('snippetId')) {
              const text = e.dataTransfer.getData('text/plain');
              if (text) handleTextDrop(text);
            }
          }}
        >
          {snippets.length === 0 && (
            <div className="text-center p-6 text-gray-500 text-sm">
              {t('no_snippets')}
            </div>
          )}
          {snippets.map(snippet => (
            <div
              key={snippet.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('snippetId', snippet.id);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              onClick={(e) => {
                e.stopPropagation();
                handleSnippetClick(snippet.id);
              }}
              className={`group p-3 rounded-lg border transition-all duration-200 hover:shadow-md cursor-pointer ${(leftId === snippet.id || rightId === snippet.id)
                ? 'bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-600 shadow-sm'
                : 'bg-white dark:bg-gray-900/50 border-gray-200 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                }`}
            >
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-medium text-sm text-gray-800 dark:text-gray-200 truncate w-40" title={snippet.title}>
                  {snippet.title}
                </h3>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleEditSnippet(snippet.id); }}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-blue-500 dark:hover:text-blue-400"
                  >
                    <EditIcon className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDeleteSnippet(snippet.id); }}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded text-gray-400 hover:text-red-500 dark:hover:text-red-400"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="text-xs text-gray-500 font-mono mb-3 truncate">
                {snippet.content.substring(0, 50).replace(/\n/g, ' ')}...
              </div>

              {/* Selection Controls */}
              <div className="flex gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); setLeftId(snippet.id); }}
                  className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${leftId === snippet.id
                    ? 'bg-blue-600 text-white shadow-inner'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                >
                  {t('set_left')}
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setRightId(snippet.id); }}
                  className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${rightId === snippet.id
                    ? 'bg-blue-600 text-white shadow-inner'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                >
                  {t('set_right')}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Drop Zone for new text snippets */}
        <div
          className={`p-4 border-t border-gray-200 dark:border-gray-800 text-center transition-all duration-200 ${isDropZoneActive
            ? 'bg-blue-50 dark:bg-blue-900/20'
            : 'bg-gray-50 dark:bg-gray-900/40'
            }`}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            setIsDropZoneActive(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDropZoneActive(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setIsDropZoneActive(false);
            const text = e.dataTransfer.getData('text/plain');
            if (text) handleTextDrop(text);
          }}
        >
          <p className={`text-xs rounded p-2 border-dashed border-2 transition-all duration-200 ${isDropZoneActive
            ? 'text-blue-600 dark:text-blue-400 border-blue-400 dark:border-blue-500 bg-blue-100/50 dark:bg-blue-800/30'
            : 'text-gray-400 border-gray-300 dark:border-gray-700'
            }`}>
            {t('drag_text_sidebar')}
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <div
        className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-950 transition-colors duration-200"
        onClick={(e) => {
          // Deselect if clicking anywhere in the main area (background/header/etc)
          // Panels stop propagation, so this only fires for clicks outside panels
          setSelectedPanel(null);
        }}
      >
        <header className="h-16 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between px-6 flex-shrink-0 shadow-sm z-10 transition-colors duration-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
              <CompareIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{t('comparison_view')}</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('algorithm_desc')}</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={t(theme === 'light' ? 'switch_theme_dark' : 'switch_theme_light')}
            >
              {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
            </button>

            {/* Cleanup Mode Switcher */}
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-950 px-2 py-1 rounded-lg border border-gray-200 dark:border-gray-800">
              <button
                onClick={() => setCleanupMode('semantic')}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${cleanupMode === 'semantic' ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
              >
                {t('semantic')}
              </button>
              <button
                onClick={() => setCleanupMode('efficiency')}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${cleanupMode === 'efficiency' ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
              >
                {t('efficiency')}
              </button>
            </div>

            {/* Edit Cost Control */}
            <div className={"flex items-center gap-3 bg-gray-100 dark:bg-gray-950 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800" + (cleanupMode === "semantic" ? " opacity-50 pointer-events-none" : "")}>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">{t('edit_cost')}: {editCost}</span>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={editCost}
                onChange={(e) => cleanupMode === "semantic" ? null : setEditCost(parseInt(e.target.value))}
                className="w-24 h-1 bg-gray-300 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>


          </div>
        </header>

        <DiffViewer
          leftSnippet={leftSnippet}
          rightSnippet={rightSnippet}
          onUpdateSnippet={handleUpdateSnippetContent}
          editCost={editCost}
          cleanupMode={cleanupMode}
          onSnippetDrop={handleSnippetDrop}
          isEditMode={isEditMode}
          splitByLine={splitByLine}
          onEditModeChange={setIsEditMode}
          onSplitByLineChange={setSplitByLine}
          selectedPanel={selectedPanel}
          onPanelSelect={setSelectedPanel}
          onTextDrop={handleTextDrop}
        />
      </div>

      {/* Editor Modal */}
      <SnippetEditor
        isOpen={isEditorOpen}
        onCancel={() => setIsEditorOpen(false)}
        onSave={handleSaveSnippet}
        snippet={editingSnippetId ? snippets.find(s => s.id === editingSnippetId) || null : null}
        nextCounter={untitledCounter + 1}
      />

    </div>
  );
}