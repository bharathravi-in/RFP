import React, { useState } from 'react';
import { PlusIcon, TrashIcon, ArrowUpIcon, ArrowDownIcon, CheckIcon, XMarkIcon } from '@heroicons/react/24/outline';

type ColumnType = 'text' | 'number' | 'currency' | 'date';

interface Column {
  name: string;
  type: ColumnType;
}

interface TableRow {
  [key: string]: string | number;
}

interface TableEditorProps {
  columns: Column[];
  rows: TableRow[];
  style: 'default' | 'striped' | 'bordered' | 'compact';
  onSave: (data: { columns: Column[]; rows: TableRow[]; style: string }) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
  color?: string;
  readOnly?: boolean;
}

export const TableEditor: React.FC<TableEditorProps> = ({
  columns: initialColumns,
  rows: initialRows,
  style: initialStyle,
  onSave,
  onCancel,
  isSaving = false,
  color = '#3B82F6',
  readOnly = false,
}) => {
  const [columns, setColumns] = useState<Column[]>(initialColumns.length > 0 ? initialColumns : [
    { name: 'Column 1', type: 'text' },
    { name: 'Column 2', type: 'text' },
  ]);
  const [rows, setRows] = useState<TableRow[]>(initialRows.length > 0 ? initialRows : [
    { 'Column 1': 'Value 1', 'Column 2': 'Value 2' },
    { 'Column 1': 'Value 3', 'Column 2': 'Value 4' },
  ]);
  const [style, setStyle] = useState<'default' | 'striped' | 'bordered' | 'compact'>(initialStyle || 'default');
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

  const handleSaveClick = async () => {
    try {
      setError(null);
      await onSave({
        columns,
        rows,
        style,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    }
  };

  return (
    <div className="w-full bg-background rounded-lg shadow border border-border h-full flex flex-col">
      {/* Header */}
      <div className="border-b border-border px-6 py-4" style={{ borderLeftWidth: '4px', borderLeftColor: color }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-text-primary">
              Table Editor
            </h2>
            <p className="text-sm text-text-muted mt-1">
              Create and manage table content
            </p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="border-b border-border px-6 py-3 bg-surface flex items-center gap-3 flex-wrap">
        <button
          onClick={handleAddRow}
          disabled={readOnly || isSaving}
          className="btn-secondary text-sm flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          Add Row
        </button>
        <button
          onClick={handleAddColumn}
          disabled={readOnly || isSaving}
          className="btn-secondary text-sm flex items-center gap-2"
        >
          <PlusIcon className="w-4 h-4" />
          Add Column
        </button>
        <div className="border-l border-border h-6 mx-2"></div>
        <label className="text-sm text-text-primary flex items-center gap-2">
          Style:
          <select
            value={style}
            onChange={(e) => setStyle(e.target.value as any)}
            disabled={readOnly}
            className="px-2 py-1 border border-border rounded text-sm bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="default">Default</option>
            <option value="striped">Striped</option>
            <option value="bordered">Bordered</option>
            <option value="compact">Compact</option>
          </select>
        </label>
      </div>

      {/* Table */}
      <div className="flex-1 p-6 overflow-auto">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-surface border-b border-border">
                <th className="px-4 py-2 text-left text-sm font-semibold text-text-primary w-12">
                  #
                </th>
                {columns.map((col, idx) => (
                  <th
                    key={idx}
                    className="px-4 py-2 text-left text-sm font-semibold text-text-primary border-b border-border"
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
                          className="font-semibold bg-transparent border-none p-0 focus:outline-none text-text-primary"
                        />
                        <select
                          value={col.type}
                          onChange={(e) => {
                            const newColumns = [...columns];
                            newColumns[idx].type = e.target.value as ColumnType;
                            setColumns(newColumns);
                          }}
                          disabled={readOnly}
                          className="text-xs text-text-muted bg-transparent border-none p-0 mt-1 focus:outline-none"
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
                          className="text-error hover:text-error-dark text-sm"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                {!readOnly && <th className="px-4 py-2 w-20 text-sm font-semibold text-text-primary">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className={`border-b border-border ${
                    style === 'striped' && rowIdx % 2 === 1 ? 'bg-surface' : ''
                  }`}
                >
                  <td className="px-4 py-2 text-sm text-text-muted font-medium">
                    {rowIdx + 1}
                  </td>
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className="px-4 py-2">
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
                        className="w-full px-2 py-1 text-sm border border-border rounded bg-background text-text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </td>
                  ))}
                  {!readOnly && (
                    <td className="px-4 py-2 text-sm">
                      <div className="flex gap-1">
                        <button
                          onClick={() => handleMoveRow(rowIdx, 'up')}
                          disabled={rowIdx === 0}
                          className="text-text-muted hover:text-text-primary disabled:opacity-30"
                        >
                          <ArrowUpIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleMoveRow(rowIdx, 'down')}
                          disabled={rowIdx === rows.length - 1}
                          className="text-text-muted hover:text-text-primary disabled:opacity-30"
                        >
                          <ArrowDownIcon className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteRow(rowIdx)}
                          className="text-error hover:text-error-dark"
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
        </div>

        {error && (
          <div className="mt-4 p-3 bg-error-light border border-error rounded text-sm text-error">
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

export default TableEditor;
