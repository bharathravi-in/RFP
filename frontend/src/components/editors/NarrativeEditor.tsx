import React, { useState, useCallback, useEffect } from 'react';
import { CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface NarrativeEditorProps {
  content: string;
  onSave: (data: { content: string }) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
  color?: string;
  readOnly?: boolean;
}

export const NarrativeEditor: React.FC<NarrativeEditorProps> = ({
  content: initialContent,
  onSave,
  onCancel,
  isSaving = false,
  color = '#3B82F6',
  readOnly = false,
}) => {
  const [content, setContent] = useState(initialContent || '');
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(true);
  const [autoSaveTimer, setAutoSaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const wordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;
  const recommendedWordCount = 300;
  const wordCountPercentage = Math.min((wordCount / recommendedWordCount) * 100, 100);

  // Auto-save after 2 seconds of inactivity
  useEffect(() => {
    if (readOnly || isSaved) {
      if (autoSaveTimer) clearTimeout(autoSaveTimer);
      return;
    }

    if (autoSaveTimer) clearTimeout(autoSaveTimer);

    const timer = setTimeout(() => {
      handleAutoSave();
    }, 2000);

    setAutoSaveTimer(timer);

    return () => clearTimeout(timer);
  }, [content, isSaved, readOnly]);

  const handleAutoSave = useCallback(async () => {
    if (content === initialContent) {
      setIsSaved(true);
      return;
    }

    try {
      await onSave({ content });
      setIsSaved(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to auto-save');
    }
  }, [content, initialContent, onSave]);

  const handleSaveClick = async () => {
    try {
      setError(null);
      await onSave({ content });
      setIsSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const estimatedReadingTime = Math.ceil(wordCount / 200); // Average 200 words per minute

  return (
    <div className="w-full bg-background rounded-lg shadow border border-border h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4" style={{ borderLeftWidth: '4px', borderLeftColor: color }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-text-primary">
              Narrative Editor
            </h2>
            <p className="text-sm text-text-muted mt-1">
              Recommended: ~{recommendedWordCount} words
            </p>
          </div>
          {!isSaved && (
            <span className="text-sm text-warning font-medium flex items-center gap-2">
              <span className="w-2 h-2 bg-warning rounded-full animate-pulse"></span>
              Unsaved changes
            </span>
          )}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 p-6 overflow-hidden flex flex-col">
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setIsSaved(false);
          }}
          placeholder="Write your section content here..."
          readOnly={readOnly}
          className="w-full flex-1 p-4 border border-border rounded-lg font-sans text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary bg-background text-text-primary placeholder-text-muted"
        />

        {/* Footer with Stats */}
        <div className="mt-4 space-y-3">
          {/* Word Count Progress */}
          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <label className="text-sm font-medium text-text-primary">Word Count</label>
              <span className="text-sm text-text-secondary">
                {wordCount} / ~{recommendedWordCount}
                <span className="text-xs text-text-muted ml-2">
                  ({Math.round(wordCountPercentage)}%)
                </span>
              </span>
            </div>
            <div className="w-full bg-border rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  wordCount < recommendedWordCount * 0.8
                    ? 'bg-error'
                    : wordCount < recommendedWordCount
                    ? 'bg-warning'
                    : 'bg-success'
                }`}
                style={{ width: `${wordCountPercentage}%` }}
              />
            </div>
          </div>

          {/* Reading Time */}
          <div className="flex justify-between text-xs text-text-muted">
            <span>Reading time: {estimatedReadingTime} min</span>
            <span>Characters: {content.length}</span>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-error-light border border-error rounded text-sm text-error">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          {!readOnly && (
            <div className="flex gap-2 pt-2 justify-end">
              <button
                onClick={() => {
                  setContent(initialContent);
                  setIsSaved(true);
                  onCancel();
                }}
                disabled={isSaving}
                className="btn-secondary text-sm"
              >
                <XMarkIcon className="w-4 h-4" />
                Cancel
              </button>
              <button
                onClick={handleSaveClick}
                disabled={isSaving || isSaved}
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
    </div>
  );
};

export default NarrativeEditor;