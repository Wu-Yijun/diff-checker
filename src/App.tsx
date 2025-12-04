import React, { useState, useEffect } from 'react';
import { Snippet } from './types';
import { DiffViewer } from './components/DiffViewer';
import { Button } from './components/Button';
import { PlusIcon, EditIcon, TrashIcon, CompareIcon, SunIcon, MoonIcon } from './components/Icons';
import { SnippetEditor } from './components/SnippetEditor';

// Icon for edit mode toggle
const EditModeIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
  </svg>
);

const ViewModeIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
  </svg>
);

const INITIAL_SNIPPETS: Snippet[] = [
  {
    id: '1',
    title: 'Example: Original Text',
    content: `The quick brown fox jumps over the lazy dog.\nThis is a simple text to demonstrate character-level diffing.\n\nMathematical precision is key.`,
    createdAt: Date.now()
  },
  {
    id: '2',
    title: 'Example: Modified Text',
    content: `The fast brown fox leaped over the lazy dog.\nThis is a complex text to demonstrate character-level diffing algorithms.\n\nVisual precision is key.`,
    createdAt: Date.now() + 1
  }
];

export default function App() {
  const [snippets, setSnippets] = useState<Snippet[]>(INITIAL_SNIPPETS);
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
    if (confirm('Are you sure you want to delete this snippet?')) {
      setSnippets(prev => prev.filter(s => s.id !== id));
      if (leftId === id) setLeftId('');
      if (rightId === id) setRightId('');
    }
  };

  const handleSaveSnippet = (id: string, title: string, content: string) => {
    if (id) {
      // Update existing
      setSnippets(prev => prev.map(s => s.id === id ? { ...s, title, content } : s));
    } else {
      // Create new
      const newId = Math.random().toString(36).substring(2, 9);
      const newSnippet: Snippet = {
        id: newId,
        title: title || 'Untitled Snippet',
        content,
        createdAt: Date.now()
      };
      setSnippets(prev => [...prev, newSnippet]);
      // Auto-select if slot is empty
      if (!leftId) setLeftId(newId);
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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 font-sans selection:bg-blue-500/30 transition-colors duration-200">
      {/* Sidebar - Snippet Manager */}
      <div className="w-80 flex flex-col border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60 flex-shrink-0 z-10 transition-colors duration-200">
        <div className="p-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <h1 className="font-bold text-gray-900 dark:text-gray-100 text-lg tracking-tight">Different Checker</h1>
        </div>

        <div className="p-4">
          <Button onClick={handleCreateSnippet} className="w-full shadow-lg shadow-blue-900/20" icon={<PlusIcon />}>
            New Text Snippet
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-2 custom-scrollbar">
          {snippets.length === 0 && (
            <div className="text-center p-6 text-gray-500 text-sm">
              No snippets created yet.
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
              className={`group p-3 rounded-lg border transition-all duration-200 hover:shadow-md cursor-grab active:cursor-grabbing ${(leftId === snippet.id || rightId === snippet.id)
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
                  onClick={() => setLeftId(snippet.id)}
                  className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${leftId === snippet.id
                    ? 'bg-blue-600 text-white shadow-inner'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                >
                  Set Left
                </button>
                <button
                  onClick={() => setRightId(snippet.id)}
                  className={`flex-1 text-xs py-1.5 rounded font-medium transition-colors ${rightId === snippet.id
                    ? 'bg-blue-600 text-white shadow-inner'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                >
                  Set Right
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-950 transition-colors duration-200">
        <header className="h-16 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between px-6 flex-shrink-0 shadow-sm z-10 transition-colors duration-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600 dark:text-blue-400">
              <CompareIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Comparison View</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Character-level deep diffing algorithm</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Edit Mode Toggle */}
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm transition-colors ${isEditMode
                ? 'bg-blue-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-950 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-800'
                }`}
              title={isEditMode ? 'Switch to View Mode' : 'Switch to Edit Mode'}
            >
              {isEditMode ? <ViewModeIcon className="w-4 h-4" /> : <EditModeIcon className="w-4 h-4" />}
              <span>{isEditMode ? 'View' : 'Edit'}</span>
            </button>

            {/* Split By Line Toggle */}
            <button
              onClick={() => setSplitByLine(!splitByLine)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg font-medium text-sm transition-colors ${splitByLine
                ? 'bg-green-600 text-white shadow-md'
                : 'bg-gray-100 dark:bg-gray-950 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 border border-gray-200 dark:border-gray-800'
                }`}
              title={splitByLine ? 'Disable Line Split' : 'Enable Line Split'}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span>{splitByLine ? 'Line' : 'Char'}</span>
            </button>

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className="p-2 rounded-lg text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
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
                Semantic
              </button>
              <button
                onClick={() => setCleanupMode('efficiency')}
                className={`px-2 py-1 text-xs font-medium rounded transition-colors ${cleanupMode === 'efficiency' ? 'bg-blue-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
              >
                Efficiency
              </button>
            </div>

            {/* Edit Cost Control */}
            <div className={"flex items-center gap-3 bg-gray-100 dark:bg-gray-950 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-800" + (cleanupMode === "semantic" ? " opacity-50 pointer-events-none" : "")}>
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Edit Cost: {editCost}</span>
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
        />
      </div>

      {/* Editor Modal */}
      <SnippetEditor
        isOpen={isEditorOpen}
        onCancel={() => setIsEditorOpen(false)}
        onSave={handleSaveSnippet}
        snippet={editingSnippetId ? snippets.find(s => s.id === editingSnippetId) || null : null}
      />

    </div>
  );
}