import React, { useState, useCallback, useEffect } from 'react';
import { PencilIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface Section {
  id: number;
  title: string;
  content: string;
  section_type?: {
    name: string;
    icon: string;
    color?: string;
    template_type: string;
    recommended_word_count?: number;
  };
}

interface NarrativeEditorProps {
  section: Section;
  onSave: (content: string) => Promise<void>;
  readOnly?: boolean;
}

export const NarrativeEditor: React.FC<NarrativeEditorProps> = ({
  section,
  onSave,
  readOnly = false,
}) => {
  const [content, setContent] = useState(section.content || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(true);
  const [autoSaveTimer, setAutoSaveTimer] = useState<NodeJS.Timeout | null>(null);

  const wordCount = content.trim().split(/\s+/).filter(word => word.length > 0).length;
  const recommendedWordCount = section.section_type?.recommended_word_count || 300;
  const wordCountPercentage = Math.min((wordCount / recommendedWordCount) * 100, 100);

  // Auto-save after 2 seconds of inactivity
  useEffect(() => {
    if (readOnly || !isSaved) {
      if (autoSaveTimer) clearTimeout(autoSaveTimer);

      const timer = setTimeout(() => {
        handleAutoSave();
      }, 2000);

      setAutoSaveTimer(timer);

      return () => clearTimeout(timer);
    }
  }, [content]);

  const handleAutoSave = useCallback(async () => {
    if (content === section.content) {
      setIsSaved(true);
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSave(content);
      setIsSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to auto-save');
    } finally {
      setSaving(false);
    }
  }, [content, section.content, onSave]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await onSave(content);
      setIsSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setContent(section.content || '');
    setIsSaved(true);
    setError(null);
  };

  const handleRedo = () => {
    // Placeholder for redo functionality
    console.log('Redo not implemented yet');
  };

  const handleUndo = () => {
    // Placeholder for undo functionality
    console.log('Undo not implemented yet');
  };

  const estimatedReadingTime = Math.ceil(wordCount / 200); // Average 200 words per minute

  const sectionColor = section.section_type?.color || '#3B82F6';

  return (
    <div className="w-full bg-white rounded-lg shadow">
      {/* Header */}
      <div className="border-b px-6 py-4" style={{ borderColor: sectionColor }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{section.section_type?.icon || '📝'}</span>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                {section.section_type?.name || section.title}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Narrative section • Recommended: ~{recommendedWordCount} words
              </p>
            </div>
          </div>
          {!isSaved && (
            <span className="text-sm text-orange-600 font-medium flex items-center gap-2">
              <span className="w-2 h-2 bg-orange-600 rounded-full animate-pulse"></span>
              Unsaved changes
            </span>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b px-6 py-3 bg-gray-50 flex items-center gap-2">
        <button
          onClick={handleUndo}
          className="p-2 text-gray-600 hover:bg-gray-200 rounded transition"
          title="Undo"
          disabled={readOnly}
        >
          <span className="text-xl">↶</span>
        </button>
        <button
          onClick={handleRedo}
          className="p-2 text-gray-600 hover:bg-gray-200 rounded transition"
          title="Redo"
          disabled={readOnly}
        >
          <span className="text-xl">↷</span>
        </button>
        <div className="border-l border-gray-300 h-6 mx-2"></div>
        <span className="text-sm text-gray-600">Basic formatting available</span>
      </div>

      {/* Editor Area */}
      <div className="p-6">
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setIsSaved(false);
          }}
          placeholder={`Write your ${section.section_type?.name || 'section'} content here...`}
          readOnly={readOnly}
          className={`w-full h-96 p-4 border-2 border-gray-300 rounded-lg font-mono text-sm resize-none focus:outline-none focus:border-blue-500 ${
            readOnly ? 'bg-gray-50 text-gray-600' : 'bg-white'
          }`}
        />

        {/* Footer with Stats */}
        <div className="mt-6 space-y-4">
          {/* Word Count Progress */}
          <div className="space-y-2">
            <div className="flex justify-between items-baseline">
              <label className="text-sm font-medium text-gray-700">Word Count</label>
              <span className="text-sm text-gray-600">
                {wordCount} / ~{recommendedWordCount}
                <span className="text-xs text-gray-500 ml-2">
                  ({Math.round(wordCountPercentage)}%)
                </span>
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  wordCount < recommendedWordCount * 0.8
                    ? 'bg-red-500'
                    : wordCount < recommendedWordCount
                    ? 'bg-yellow-500'
                    : 'bg-green-500'
                }`}
                style={{ width: `${wordCountPercentage}%` }}
              ></div>
            </div>
          </div>

          {/* Reading Time */}
          <div className="flex justify-between text-sm text-gray-600">
            <span>Estimated reading time: {estimatedReadingTime} min</span>
            <span>Characters: {content.length}</span>
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Auto-save Indicator */}
          {!readOnly && (
            <div className="text-xs text-gray-500 flex items-center gap-2">
              {saving && (
                <>
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></span>
                  Auto-saving...
                </>
              )}
              {isSaved && !saving && (
                <>
                  <CheckIcon className="w-4 h-4 text-green-600" />
                  All changes saved
                </>
              )}
            </div>
          )}

          {/* Action Buttons */}
          {!readOnly && (
            <div className="flex gap-3 pt-4">
              <button
                onClick={handleSave}
                disabled={saving || isSaved}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition ${
                  isSaved
                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <CheckIcon className="w-5 h-5" />
                Save Changes
              </button>
              <button
                onClick={handleCancel}
                disabled={saving || isSaved}
                className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition ${
                  isSaved
                    ? 'bg-gray-100 text-gray-500 cursor-not-allowed'
                    : 'border-2 border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <XMarkIcon className="w-5 h-5" />
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NarrativeEditor;
