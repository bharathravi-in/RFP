import React, { useState } from 'react';
import { PlusIcon, TrashIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface CodeBlock {
  id: string;
  language: string;
  code: string;
}

interface TechnicalEditorProps {
  description: string;
  codeBlocks: CodeBlock[];
  onSave: (data: {
    description: string;
    codeBlocks: CodeBlock[];
  }) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
  color?: string;
  readOnly?: boolean;
}

const LANGUAGE_OPTIONS = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'yaml', label: 'YAML' },
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML' },
  { value: 'html', label: 'HTML' },
];

export const TechnicalEditor: React.FC<TechnicalEditorProps> = ({
  description: initialDescription,
  codeBlocks: initialCodeBlocks,
  onSave,
  onCancel,
  isSaving = false,
  color = '#FB923C',
  readOnly = false,
}) => {
  const [description, setDescription] = useState(initialDescription || '');
  const [codeBlocks, setCodeBlocks] = useState<CodeBlock[]>(initialCodeBlocks.length > 0 ? initialCodeBlocks : [
    { id: '1', language: 'javascript', code: '// Example code' },
  ]);
  const [viewMode, setViewMode] = useState<'edit' | 'preview' | 'split'>('edit');
  const [darkMode, setDarkMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddCodeBlock = () => {
    const newBlock: CodeBlock = {
      id: Date.now().toString(),
      language: 'javascript',
      code: '',
    };
    setCodeBlocks([...codeBlocks, newBlock]);
  };

  const handleDeleteCodeBlock = (id: string) => {
    setCodeBlocks(codeBlocks.filter(block => block.id !== id));
  };

  const handleUpdateCodeBlock = (id: string, updates: Partial<CodeBlock>) => {
    setCodeBlocks(
      codeBlocks.map(block => (block.id === id ? { ...block, ...updates } : block))
    );
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
  };

  const handleSaveClick = async () => {
    try {
      setError(null);
      await onSave({
        description,
        codeBlocks,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  return (
    <div className={`w-full rounded-lg shadow border border-border h-full flex flex-col ${darkMode ? 'bg-gray-900' : 'bg-background'}`}>
      {/* Header */}
      <div
        className={`border-b border-border px-6 py-4 ${darkMode ? 'bg-gray-800' : 'bg-background'}`}
        style={{ borderLeftWidth: '4px', borderLeftColor: color }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className={`text-lg font-bold ${darkMode ? 'text-white' : 'text-text-primary'}`}>
              Technical Editor
            </h2>
            <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-text-muted'}`}>
              Add code blocks and technical documentation
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div
        className={`border-b px-6 py-3 flex items-center gap-3 flex-wrap ${
          darkMode ? 'bg-gray-800 border-gray-700' : 'bg-gray-50'
        }`}
      >
        <button
          onClick={handleAddCodeBlock}
          disabled={readOnly || isSaving}
          className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          <PlusIcon className="w-4 h-4" />
          Add Code Block
        </button>

        <div className={`border-l h-6 ${darkMode ? 'border-gray-700' : 'border-gray-300'}`}></div>

        <div className="flex gap-2">
          {(['edit', 'preview', 'split'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 text-sm rounded capitalize ${
                viewMode === mode
                  ? 'bg-blue-600 text-white'
                  : `${
                      darkMode
                        ? 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        : 'bg-white border border-gray-300 hover:bg-gray-50'
                    }`
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        <button
          onClick={() => setDarkMode(!darkMode)}
          className={`px-3 py-1 text-sm rounded ${
            darkMode
              ? 'bg-yellow-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {darkMode ? '☀️ Light' : '🌙 Dark'}
        </button>
      </div>

      {/* Content Area */}
      <div
        className={`p-6 ${
          darkMode ? 'bg-gray-900' : 'bg-white'
        } ${viewMode === 'split' ? 'grid grid-cols-2 gap-4' : ''}`}
      >
        {/* Editor / Description */}
        {(viewMode === 'edit' || viewMode === 'split') && (
          <div>
            <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Description (Markdown)
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={readOnly}
              placeholder="Enter technical description using Markdown..."
              className={`w-full h-40 p-4 rounded-lg font-mono text-sm resize-none border ${
                darkMode
                  ? 'bg-gray-800 text-white border-gray-700 focus:border-blue-500'
                  : 'bg-white border-gray-300 focus:border-blue-500'
              }`}
            />
          </div>
        )}

        {/* Preview / Code Blocks */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div>
            <label className={`text-sm font-medium ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
              Preview
            </label>
            <div
              className={`p-4 rounded-lg h-40 overflow-auto ${
                darkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-50 text-gray-700'
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{description || '(No description)'}</div>
            </div>
          </div>
        )}
      </div>

      {/* Code Blocks */}
      <div className={`px-6 py-4 space-y-4 ${darkMode ? 'bg-gray-900' : 'bg-white'}`}>
        <h3 className={`text-lg font-semibold ${darkMode ? 'text-white' : 'text-gray-900'}`}>
          Code Blocks
        </h3>

        {codeBlocks.map((block) => (
          <div
            key={block.id}
            className={`rounded-lg border-2 overflow-hidden ${
              darkMode
                ? 'bg-gray-800 border-gray-700'
                : 'bg-white border-gray-200 hover:border-blue-300'
            }`}
          >
            {/* Code Block Header */}
            <div
              className={`flex items-center justify-between p-3 ${
                darkMode ? 'bg-gray-700' : 'bg-gray-100'
              }`}
            >
              <select
                value={block.language}
                onChange={(e) => handleUpdateCodeBlock(block.id, { language: e.target.value })}
                disabled={readOnly}
                className={`px-2 py-1 rounded text-sm border ${
                  darkMode
                    ? 'bg-gray-600 text-white border-gray-500'
                    : 'bg-white border-gray-300'
                }`}
              >
                {LANGUAGE_OPTIONS.map(lang => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>

              <div className="flex gap-2">
                <button
                  onClick={() => handleCopyCode(block.code)}
                  className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Copy
                </button>
                {!readOnly && (
                  <button
                    onClick={() => handleDeleteCodeBlock(block.id)}
                    className="px-3 py-1 text-sm text-red-600 hover:text-red-700"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Code Block Content */}
            <textarea
              value={block.code}
              onChange={(e) => handleUpdateCodeBlock(block.id, { code: e.target.value })}
              disabled={readOnly}
              placeholder={`Enter ${block.language} code...`}
              className={`w-full p-4 font-mono text-sm resize-none border-none focus:outline-none min-h-40 ${
                darkMode
                  ? 'bg-gray-900 text-white'
                  : 'bg-white text-gray-900'
              }`}
            />
          </div>
        ))}

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        {!readOnly && (
          <div className="flex gap-2 pt-4 justify-end">
            <button
              onClick={() => {
                setError(null);
                onCancel();
              }}
              disabled={isSaving}
              className="btn-secondary text-sm flex items-center gap-2"
            >
              <XMarkIcon className="w-4 h-4" />
              Cancel
            </button>
            <button
              onClick={handleSaveClick}
              disabled={isSaving}
              className="btn-primary text-sm flex items-center gap-2"
            >
              {isSaving && <span className="w-4 h-4 animate-spin">⟳</span>}
              <CheckIcon className="w-4 h-4" />
              Save
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TechnicalEditor;
