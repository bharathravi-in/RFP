import React, { useState } from 'react';
import { PlusIcon, TrashIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface Card {
  id: string;
  title: string;
  description: string;
  image?: string;
  metadata?: Record<string, string>;
  [key: string]: any;
}

interface CardEditorProps {
  cards: Card[];
  templateType: 'case_study' | 'team_member' | 'generic';
  columnLayout: 1 | 2 | 3;
  onSave: (data: { cards: Card[]; templateType: string; columnLayout: number }) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
  color?: string;
  readOnly?: boolean;
}

interface CardTemplate {
  name: string;
  fields: string[];
}

const CARD_TEMPLATES: Record<string, CardTemplate> = {
  case_study: {
    name: 'Case Study',
    fields: ['title', 'challenge', 'solution', 'results'],
  },
  team_member: {
    name: 'Team Member',
    fields: ['title', 'role', 'bio', 'skills'],
  },
  generic: {
    name: 'Generic',
    fields: ['title', 'description'],
  },
};

export const CardEditor: React.FC<CardEditorProps> = ({
  cards: initialCards,
  templateType: initialTemplateType,
  columnLayout: initialColumnLayout,
  onSave,
  onCancel,
  isSaving = false,
  color = '#8B5CF6',
  readOnly = false,
}) => {
  const [cards, setCards] = useState<Card[]>(initialCards.length > 0 ? initialCards : [
    {
      id: '1',
      title: 'Example Card',
      description: 'Click to edit this card',
      metadata: {},
    },
  ]);
  const [templateType, setTemplateType] = useState<string>(initialTemplateType || 'generic');
  const [columnLayout, setColumnLayout] = useState<1 | 2 | 3>(initialColumnLayout || 2);
  const [error, setError] = useState<string | null>(null);

  const template = CARD_TEMPLATES[templateType] || CARD_TEMPLATES.generic;

  const handleAddCard = () => {
    const newCard: Card = {
      id: Date.now().toString(),
      title: 'New Card',
      description: '',
      metadata: {},
    };
    setCards([...cards, newCard]);
  };

  const handleDeleteCard = (id: string) => {
    setCards(cards.filter(card => card.id !== id));
  };

  const handleUpdateCard = (id: string, updates: Partial<Card>) => {
    setCards(cards.map(card => (card.id === id ? { ...card, ...updates } : card)));
  };

  const handleMoveCard = (id: string, direction: 'up' | 'down') => {
    const index = cards.findIndex(card => card.id === id);
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === cards.length - 1)) {
      return;
    }

    const newCards = [...cards];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newCards[index], newCards[targetIndex]] = [newCards[targetIndex], newCards[index]];
    setCards(newCards);
  };

  const handleSaveClick = async () => {
    try {
      setError(null);
      await onSave({ cards, templateType, columnLayout });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  const gridColsClass = {
    1: 'grid-cols-1',
    2: 'grid-cols-2',
    3: 'grid-cols-3',
  }[columnLayout];

  return (
    <div className="w-full bg-background rounded-lg shadow border border-border h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4" style={{ borderLeftWidth: '4px', borderLeftColor: color }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-text-primary">
              Card Editor
            </h2>
            <p className="text-sm text-text-muted mt-1">Create and manage card-based content</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b border-border px-6 py-3 bg-surface flex items-center gap-3 flex-wrap">
        <button
          onClick={handleAddCard}
          disabled={readOnly || isSaving}
          className="btn-secondary text-sm flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          Add Card
        </button>

        <div className="border-l border-border h-6 mx-2"></div>

        <label className="text-sm text-text-primary flex items-center gap-2">
          Template:
          <select
            value={templateType}
            onChange={(e) => setTemplateType(e.target.value)}
            disabled={readOnly}
            className="px-2 py-1 border border-border rounded text-sm bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          >
            {Object.entries(CARD_TEMPLATES).map(([key, val]) => (
              <option key={key} value={key}>
                {val.name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm text-text-primary flex items-center gap-2">
          Columns:
          <select
            value={columnLayout}
            onChange={(e) => setColumnLayout(parseInt(e.target.value) as 1 | 2 | 3)}
            disabled={readOnly}
            className="px-2 py-1 border border-border rounded text-sm bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="1">1</option>
            <option value="2">2</option>
            <option value="3">3</option>
          </select>
        </label>
      </div>

      {/* Cards Grid */}
      <div className="flex-1 p-6 overflow-auto">
        <div className={`grid ${gridColsClass} gap-4 mb-6`}>
          {cards.map((card, index) => (
            <div key={card.id} className="border border-border rounded-lg p-4 hover:border-primary transition bg-surface">
              {/* Card Header */}
              <div className="flex justify-between items-start mb-4">
                <input
                  type="text"
                  value={card.title}
                  onChange={(e) => handleUpdateCard(card.id, { title: e.target.value })}
                  disabled={readOnly}
                  className="text-lg font-bold text-gray-900 flex-1 bg-transparent border-none focus:outline-none"
                  placeholder="Card title"
                />
                {!readOnly && (
                  <button
                    onClick={() => handleDeleteCard(card.id)}
                    className="text-red-600 hover:text-red-700 ml-2"
                  >
                    <TrashIcon className="w-5 h-5" />
                  </button>
                )}
              </div>

              {/* Card Image (if applicable) */}
              <div className="mb-4">
                <input
                  type="text"
                  value={card.image || ''}
                  onChange={(e) => handleUpdateCard(card.id, { image: e.target.value })}
                  disabled={readOnly}
                  placeholder="Image URL"
                  className="w-full px-2 py-1 text-sm border border-gray-300 rounded bg-gray-50"
                />
              </div>

              {/* Card Fields based on Template */}
              <div className="space-y-3 mb-4">
                {template.fields.includes('description') && (
                  <div>
                    <label className="text-xs font-medium text-gray-600">Description</label>
                    <textarea
                      value={card.description || ''}
                      onChange={(e) => handleUpdateCard(card.id, { description: e.target.value })}
                      disabled={readOnly}
                      placeholder="Description"
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded resize-none h-20"
                    />
                  </div>
                )}

                {template.fields.includes('challenge') && (
                  <div>
                    <label className="text-xs font-medium text-gray-600">Challenge</label>
                    <textarea
                      value={card.challenge || ''}
                      onChange={(e) => handleUpdateCard(card.id, { challenge: e.target.value })}
                      disabled={readOnly}
                      placeholder="Challenge"
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded resize-none h-16"
                    />
                  </div>
                )}

                {template.fields.includes('solution') && (
                  <div>
                    <label className="text-xs font-medium text-gray-600">Solution</label>
                    <textarea
                      value={card.solution || ''}
                      onChange={(e) => handleUpdateCard(card.id, { solution: e.target.value })}
                      disabled={readOnly}
                      placeholder="Solution"
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded resize-none h-16"
                    />
                  </div>
                )}

                {template.fields.includes('results') && (
                  <div>
                    <label className="text-xs font-medium text-gray-600">Results</label>
                    <input
                      type="text"
                      value={card.results || ''}
                      onChange={(e) => handleUpdateCard(card.id, { results: e.target.value })}
                      disabled={readOnly}
                      placeholder="Results / Metrics"
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                  </div>
                )}

                {template.fields.includes('role') && (
                  <div>
                    <label className="text-xs font-medium text-gray-600">Role</label>
                    <input
                      type="text"
                      value={card.role || ''}
                      onChange={(e) => handleUpdateCard(card.id, { role: e.target.value })}
                      disabled={readOnly}
                      placeholder="Job title / Role"
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                  </div>
                )}

                {template.fields.includes('bio') && (
                  <div>
                    <label className="text-xs font-medium text-gray-600">Bio</label>
                    <textarea
                      value={card.bio || ''}
                      onChange={(e) => handleUpdateCard(card.id, { bio: e.target.value })}
                      disabled={readOnly}
                      placeholder="Biography / Background"
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded resize-none h-16"
                    />
                  </div>
                )}

                {template.fields.includes('skills') && (
                  <div>
                    <label className="text-xs font-medium text-gray-600">Skills</label>
                    <input
                      type="text"
                      value={card.skills || ''}
                      onChange={(e) => handleUpdateCard(card.id, { skills: e.target.value })}
                      disabled={readOnly}
                      placeholder="Skills (comma-separated)"
                      className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                  </div>
                )}
              </div>

              {/* Card Actions */}
              {!readOnly && (
                <div className="flex gap-2 text-xs">
                  <button
                    onClick={() => handleMoveCard(card.id, 'up')}
                    disabled={index === 0}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    ↑ Up
                  </button>
                  <button
                    onClick={() => handleMoveCard(card.id, 'down')}
                    disabled={index === cards.length - 1}
                    className="flex-1 px-2 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                  >
                    Down ↓
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700 mb-4">
            {error}
          </div>
        )}

        {!readOnly && (
          <div className="flex gap-2 mt-4 justify-end">
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

export default CardEditor;
