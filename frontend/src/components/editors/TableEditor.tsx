import React, { useState, useCallback } from 'react';
import { PlusIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/outline';

interface TableRow {
  [key: string]: string | number;
}

interface TableEditorProps {
  section: {
    id: number;
    title: string;
    content?: string;
    section_type?: {
      name: string;
      icon: string;
      color?: string;
      template_type: string;
      recommended_word_count?: number;
    };
  };
  onSave: (tableData: { headers: string[]; rows: TableRow[]; style: string }) => Promise<void>;
  readOnly?: boolean;
}

type ColumnType = 'text' | 'number' | 'currency' | 'date';

interface Column {
  name: string;
  type: ColumnType;
}

export const TableEditor: React.FC<TableEditorProps> = ({
  section,
  onSave,
  readOnly = false,
}) => {
  const [columns, setColumns] = useState<Column[]>([
    { name: 'Item', type: 'text' },
    { name: 'Value', type: 'text' },
  ]);
  const [rows, setRows] = useState<TableRow[]>([
    { Item: 'Example 1', Value: 'Data 1' },
    { Item: 'Example 2', Value: 'Data 2' },
  ]);
  const [style, setStyle] = useState<'striped' | 'bordered' | 'compact'>('striped');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddRow = () => {
    const newRow: TableRow = {};
    columns.forEach(col => {
      newRow[col.name] = '';
    });
    setRows([...rows, newRow]);
  };

  const handleAddColumn = () => {
    const newColumnName = `Column ${columns.length + 1}`;
    setColumns([...columns, { name: newColumnName, type: 'text' }]);
    setRows(
      rows.map(row => ({
        ...row,
        [newColumnName]: '',
      }))
    );
  };

  const handleDeleteRow = (index: number) => {
    setRows(rows.filter((_, i) => i !== index));
  };

  const handleDeleteColumn = (index: number) => {
    const columnName = columns[index].name;
    setColumns(columns.filter((_, i) => i !== index));
    setRows(
      rows.map(row => {
        const newRow = { ...row };
        delete newRow[columnName];
        return newRow;
      })
    );
  };

  const handleCellChange = (rowIndex: number, columnName: string, value: string | number) => {
    const newRows = [...rows];
    newRows[rowIndex] = { ...newRows[rowIndex], [columnName]: value };
    setRows(newRows);
  };

  const handleMoveRow = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === rows.length - 1) return;

    const newRows = [...rows];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newRows[index], newRows[targetIndex]] = [newRows[targetIndex], newRows[index]];
    setRows(newRows);
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      setError(null);
      await onSave({
        headers: columns.map(c => c.name),
        rows,
        style,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const sectionColor = section.section_type?.color || '#EF4444';

  return (
    <div className="w-full bg-white rounded-lg shadow">
      {/* Header */}
      <div className="border-b px-6 py-4" style={{ borderColor: sectionColor }}>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{section.section_type?.icon || '📊'}</span>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {section.section_type?.name || section.title}
            </h2>
            <p className="text-sm text-gray-500 mt-1">Table editor</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b px-6 py-3 bg-gray-50 flex items-center gap-3 flex-wrap">
        <button
          onClick={handleAddRow}
          disabled={readOnly || saving}
          className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          <PlusIcon className="w-4 h-4" />
          Add Row
        </button>
        <button
          onClick={handleAddColumn}
          disabled={readOnly || saving}
          className="flex items-center gap-2 px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 disabled:opacity-50"
        >
          <PlusIcon className="w-4 h-4" />
          Add Column
        </button>
        <div className="border-l border-gray-300 h-6"></div>
        <label className="text-sm text-gray-700">
          Style:
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value as any)}
            disabled={readOnly}
            className="ml-2 px-2 py-1 border border-gray-300 rounded text-sm"
          >
            <option value="striped">Striped</option>
            <option value="bordered">Bordered</option>
            <option value="compact">Compact</option>
          </select>
        </label>
      </div>

      {/* Table */}
      <div className="p-6 overflow-x-auto">
        <table
          className={`w-full border-collapse ${
            style === 'striped'
              ? 'border-2 border-gray-300'
              : style === 'bordered'
              ? 'border border-gray-300'
              : ''
          }`}
        >
          <thead>
            <tr className="bg-gray-100">
              <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700 w-12 border border-gray-300">
                #
              </th>
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={`px-4 py-2 text-left text-sm font-semibold text-gray-700 border border-gray-300 ${
                    style === 'striped' ? '' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <input
                        type="text"
                        value={col.name}
                        onChange={(e) => {
                          const newColumns = [...columns];
                          newColumns[idx].name = e.target.value;
                          setColumns(newColumns);
                        }}
                        disabled={readOnly}
                        className="font-semibold bg-transparent border-none p-0 focus:outline-none"
                      />
                      <select
                        value={col.type}
                        onChange={(e) => {
                          const newColumns = [...columns];
                          newColumns[idx].type = e.target.value as ColumnType;
                          setColumns(newColumns);
                        }}
                        disabled={readOnly}
                        className="text-xs text-gray-500 bg-transparent border-none p-0 mt-1 focus:outline-none"
                      >
                        <option value="text">Text</option>
                        <option value="number">Number</option>
                        <option value="currency">Currency</option>
                        <option value="date">Date</option>
                      </select>
                    </div>
                    {!readOnly && (
                      <button
                        onClick={() => handleDeleteColumn(idx)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              {!readOnly && <th className="px-4 py-2 w-20 border border-gray-300">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr
                key={rowIdx}
                className={style === 'striped' && rowIdx % 2 === 1 ? 'bg-gray-50' : ''}
              >
                <td className="px-4 py-2 text-sm text-gray-600 border border-gray-300 font-medium">
                  {rowIdx + 1}
                </td>
                {columns.map((col, colIdx) => (
                  <td key={colIdx} className="px-4 py-2 border border-gray-300">
                    <input
                      type={col.type === 'date' ? 'date' : col.type === 'number' ? 'number' : 'text'}
                      value={row[col.name] || ''}
                      onChange={(e) =>
                        handleCellChange(
                          rowIdx,
                          col.name,
                          col.type === 'number' ? parseFloat(e.target.value) || '' : e.target.value
                        )
                      }
                      disabled={readOnly}
                      className="w-full px-2 py-1 text-sm border-none bg-transparent focus:outline-none"
                    />
                  </td>
                ))}
                {!readOnly && (
                  <td className="px-4 py-2 text-sm border border-gray-300">
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleMoveRow(rowIdx, 'up')}
                        disabled={rowIdx === 0}
                        className="text-gray-600 hover:text-gray-900 disabled:opacity-50"
                      >
                        <ArrowUpIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleMoveRow(rowIdx, 'down')}
                        disabled={rowIdx === rows.length - 1}
                        className="text-gray-600 hover:text-gray-900 disabled:opacity-50"
                      >
                        <ArrowDownIcon className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteRow(rowIdx)}
                        className="text-red-600 hover:text-red-700"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {error && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        {!readOnly && (
          <div className="flex gap-3 mt-6">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              Save Table
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TableEditor;
