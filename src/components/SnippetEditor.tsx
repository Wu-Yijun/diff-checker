import React, { useState, useEffect } from 'react';
import { Snippet } from '../types';
import { Button } from './Button';
import { CloseIcon } from './Icons';
import { useLanguage } from '../contexts/LanguageContext';

interface SnippetEditorProps {
  snippet: Snippet | null;
  onSave: (id: string, title: string, content: string) => void;
  onCancel: () => void;
  isOpen: boolean;
}

export const SnippetEditor: React.FC<SnippetEditorProps> = ({ snippet, onSave, onCancel, isOpen }) => {
  const { t } = useLanguage();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');

  useEffect(() => {
    if (snippet) {
      setTitle(snippet.title);
      setContent(snippet.content);
    } else {
      setTitle(t('untitled_snippet'));
      setContent('');
    }
  }, [snippet, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 dark:bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            {snippet ? t('edit_snippet') : t('create_snippet')}
          </h2>
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors">
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 flex flex-col p-6 gap-6 overflow-hidden bg-gray-50 dark:bg-gray-900">
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-400">{t('title_label')}</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder={t('title_placeholder')}
            />
          </div>

          <div className="flex-1 flex flex-col gap-2 min-h-0">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-400 flex justify-between">
              <span>{t('content_label')}</span>
              <span className="text-xs text-gray-500">{content.length} {t('current_chars')}</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="flex-1 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-4 text-gray-900 dark:text-white font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none leading-relaxed custom-scrollbar"
              placeholder={t('paste_placeholder')}
              spellCheck={false}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
          <Button variant="ghost" onClick={onCancel}>{t('cancel')}</Button>
          <Button onClick={() => onSave(snippet?.id || '', title, content)}>
            {t('save_snippet')}
          </Button>
        </div>
      </div>
    </div>
  );
};