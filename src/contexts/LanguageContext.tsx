import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'en' | 'zh';

type Translations = {
  [key in Language]: {
    [key: string]: string;
  };
};

const translations: Translations = {
  en: {
    // App
    app_title: 'Different Checker',
    new_snippet: 'New Text Snippet',
    no_snippets: 'No snippets created yet.',
    drag_text_sidebar: 'Drag text here to create new snippet',
    comparison_view: 'Comparison View',
    algorithm_desc: 'Character-level deep diffing algorithm',
    semantic: 'Semantic',
    efficiency: 'Efficiency',
    edit_cost: 'Edit Cost',
    vs: 'vs',

    // DiffViewer
    chars_removed: 'chars removed',
    chars_added: 'chars added',
    none: 'None',
    edit_mode: 'Edit',
    view_mode: 'View',
    line_mode: 'Line',
    char_mode: 'Char',
    split_line_enable: 'Enable Line Split',
    split_line_disable: 'Disable Line Split',
    switch_view: 'Switch to View Mode',
    switch_edit: 'Switch to Edit Mode',
    switch_en: 'Switch to English',
    switch_zh: 'Switch to Chinese',
    original_left: 'Original (Left)',
    modified_right: 'Modified (Right)',
    copy: 'Copy',
    paste: 'Paste',
    copy_tooltip: 'Copy content to clipboard',
    paste_tooltip: 'Paste from clipboard and replace content',
    no_snippet_selected: 'No Snippet Selected',
    drag_paste_select: 'Drag text here, paste, or select from sidebar',
    drop_left: 'Drop to load on Left',
    drop_right: 'Drop to load on Right',
    missing_content: 'Missing content (Right Click to add)',

    // SnippetEditor
    edit_snippet: 'Edit Snippet',
    create_snippet: 'New Snippet',
    title_label: 'Title',
    content_label: 'Content',
    title_placeholder: 'e.g. Version 1.0 (Draft)',
    current_chars: 'characters',
    paste_placeholder: 'Paste your text here...',
    cancel: 'Cancel',
    save_snippet: 'Save Snippet',

    // Config / Defaults
    untitled_text: 'Untitled Text',
    dropped_text: 'Dropped Text',
    pasted_text: 'Pasted Text',
    confirm_delete: 'Are you sure you want to delete this snippet?',
    set_left: 'Set Left',
    set_right: 'Set Right',
    switch_theme_light: 'Switch to light mode',
    switch_theme_dark: 'Switch to dark mode',
  },
  zh: {
    // App
    app_title: 'Different Checker',
    new_snippet: '新建文本片段',
    no_snippets: '暂无文本片段',
    drag_text_sidebar: '拖拽文本到此处以创建新片段',
    comparison_view: '差异对比视图',
    algorithm_desc: '字符级深度差异比对算法',
    semantic: '语义分段',
    efficiency: '成本分段',
    edit_cost: '编辑成本',
    vs: '对比',

    // DiffViewer
    chars_removed: '字符删除',
    chars_added: '字符新增',
    none: '无',
    edit_mode: '编辑',
    view_mode: '预览',
    line_mode: '按行',
    char_mode: '按字',
    split_line_enable: '启用按行分割',
    split_line_disable: '禁用按行分割',
    switch_view: '切换至预览模式',
    switch_edit: '切换至编辑模式',
    switch_en: '切换至英文',
    switch_zh: '切换至中文',
    original_left: '原始 (左)',
    modified_right: '修改 (右)',
    copy: '复制',
    paste: '粘贴',
    copy_tooltip: '复制内容到剪贴板',
    paste_tooltip: '从剪贴板粘贴并替换内容',
    no_snippet_selected: '未选择片段',
    drag_paste_select: '拖拽文本至此，粘贴，或从侧边栏选择',
    drop_left: '拖拽至此加载到左侧',
    drop_right: '拖拽至此加载到右侧',
    missing_content: '缺失内容 (右键点击添加)',

    // SnippetEditor
    edit_snippet: '编辑片段',
    create_snippet: '新建片段',
    title_label: '标题',
    content_label: '内容',
    title_placeholder: '例如：版本 1.0 (草稿)',
    current_chars: '字符',
    paste_placeholder: '在此粘贴您的文本...',
    cancel: '取消',
    save_snippet: '保存片段',

    // Config / Defaults
    untitled_text: '未命名文本',
    dropped_text: '拖拽文本',
    pasted_text: '粘贴文本',
    confirm_delete: '确定要删除此片段吗？',
    set_left: '设为左侧',
    set_right: '设为右侧',
    switch_theme_light: '切换至亮色模式',
    switch_theme_dark: '切换至暗色模式',
  }
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('app_language');
    return (saved === 'en' || saved === 'zh') ? saved : 'en';
  });

  useEffect(() => {
    localStorage.setItem('app_language', language);
  }, [language]);

  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
