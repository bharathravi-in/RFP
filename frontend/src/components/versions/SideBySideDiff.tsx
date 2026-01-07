/**
 * Side-by-Side Diff Viewer
 * Enhanced diff visualization with inline changes
 */
import { useState, useMemo } from 'react';
import {
    ArrowsRightLeftIcon,
    MinusIcon,
    PlusIcon,
    DocumentDuplicateIcon,
    ClipboardIcon,
} from '@heroicons/react/24/outline';
import clsx from 'clsx';
import toast from 'react-hot-toast';

interface DiffLine {
    type: 'unchanged' | 'added' | 'removed' | 'modified';
    lineA?: string;
    lineB?: string;
    lineNumberA?: number;
    lineNumberB?: number;
}

interface SideBySideDiffProps {
    contentA: string;
    contentB: string;
    labelA?: string;
    labelB?: string;
    className?: string;
}

// Simple diff algorithm
function computeDiff(textA: string, textB: string): DiffLine[] {
    const linesA = textA.split('\n');
    const linesB = textB.split('\n');
    const result: DiffLine[] = [];
    
    let i = 0;
    let j = 0;
    let lineNumA = 1;
    let lineNumB = 1;
    
    // Simple LCS-based diff
    while (i < linesA.length || j < linesB.length) {
        if (i >= linesA.length) {
            // Remaining lines in B are additions
            result.push({
                type: 'added',
                lineB: linesB[j],
                lineNumberB: lineNumB++,
            });
            j++;
        } else if (j >= linesB.length) {
            // Remaining lines in A are deletions
            result.push({
                type: 'removed',
                lineA: linesA[i],
                lineNumberA: lineNumA++,
            });
            i++;
        } else if (linesA[i] === linesB[j]) {
            // Lines match
            result.push({
                type: 'unchanged',
                lineA: linesA[i],
                lineB: linesB[j],
                lineNumberA: lineNumA++,
                lineNumberB: lineNumB++,
            });
            i++;
            j++;
        } else {
            // Lines differ - check if it's a modification or add/remove
            const aInB = linesB.indexOf(linesA[i], j);
            const bInA = linesA.indexOf(linesB[j], i);
            
            if (aInB === -1 && bInA === -1) {
                // Modified line
                result.push({
                    type: 'modified',
                    lineA: linesA[i],
                    lineB: linesB[j],
                    lineNumberA: lineNumA++,
                    lineNumberB: lineNumB++,
                });
                i++;
                j++;
            } else if (aInB !== -1 && (bInA === -1 || aInB - j < bInA - i)) {
                // Line from B was added
                result.push({
                    type: 'added',
                    lineB: linesB[j],
                    lineNumberB: lineNumB++,
                });
                j++;
            } else {
                // Line from A was removed
                result.push({
                    type: 'removed',
                    lineA: linesA[i],
                    lineNumberA: lineNumA++,
                });
                i++;
            }
        }
    }
    
    return result;
}

// Highlight word-level changes within a line
function highlightWordChanges(lineA: string, lineB: string): { wordsA: Array<{ text: string; changed: boolean }>; wordsB: Array<{ text: string; changed: boolean }> } {
    const wordsA = lineA.split(/(\s+)/);
    const wordsB = lineB.split(/(\s+)/);
    
    const resultA: Array<{ text: string; changed: boolean }> = [];
    const resultB: Array<{ text: string; changed: boolean }> = [];
    
    const maxLen = Math.max(wordsA.length, wordsB.length);
    
    for (let i = 0; i < maxLen; i++) {
        const wordA = wordsA[i] || '';
        const wordB = wordsB[i] || '';
        
        if (wordA === wordB) {
            resultA.push({ text: wordA, changed: false });
            resultB.push({ text: wordB, changed: false });
        } else {
            if (wordA) resultA.push({ text: wordA, changed: true });
            if (wordB) resultB.push({ text: wordB, changed: true });
        }
    }
    
    return { wordsA: resultA, wordsB: resultB };
}

export default function SideBySideDiff({
    contentA,
    contentB,
    labelA = 'Version A',
    labelB = 'Version B',
    className,
}: SideBySideDiffProps) {
    const [viewMode, setViewMode] = useState<'side-by-side' | 'unified'>('side-by-side');
    const [showLineNumbers, setShowLineNumbers] = useState(true);
    
    const diff = useMemo(() => computeDiff(contentA, contentB), [contentA, contentB]);
    
    const stats = useMemo(() => {
        let added = 0;
        let removed = 0;
        let modified = 0;
        diff.forEach(line => {
            if (line.type === 'added') added++;
            else if (line.type === 'removed') removed++;
            else if (line.type === 'modified') modified++;
        });
        return { added, removed, modified };
    }, [diff]);
    
    const copyToClipboard = (content: string) => {
        navigator.clipboard.writeText(content);
        toast.success('Copied to clipboard');
    };

    return (
        <div className={clsx('rounded-lg border border-gray-200 overflow-hidden', className)}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 text-sm">
                        {stats.added > 0 && (
                            <span className="flex items-center gap-1 text-green-600">
                                <PlusIcon className="h-4 w-4" />
                                {stats.added} added
                            </span>
                        )}
                        {stats.removed > 0 && (
                            <span className="flex items-center gap-1 text-red-600">
                                <MinusIcon className="h-4 w-4" />
                                {stats.removed} removed
                            </span>
                        )}
                        {stats.modified > 0 && (
                            <span className="flex items-center gap-1 text-amber-600">
                                <ArrowsRightLeftIcon className="h-4 w-4" />
                                {stats.modified} modified
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input
                            type="checkbox"
                            checked={showLineNumbers}
                            onChange={(e) => setShowLineNumbers(e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300 text-primary"
                        />
                        Line numbers
                    </label>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                        <button
                            onClick={() => setViewMode('side-by-side')}
                            className={clsx(
                                'px-3 py-1 text-sm',
                                viewMode === 'side-by-side' ? 'bg-primary text-white' : 'bg-white text-gray-600'
                            )}
                        >
                            Side-by-side
                        </button>
                        <button
                            onClick={() => setViewMode('unified')}
                            className={clsx(
                                'px-3 py-1 text-sm',
                                viewMode === 'unified' ? 'bg-primary text-white' : 'bg-white text-gray-600'
                            )}
                        >
                            Unified
                        </button>
                    </div>
                </div>
            </div>
            
            {/* Column Headers */}
            <div className="grid grid-cols-2 border-b border-gray-200 bg-gray-100">
                <div className="px-4 py-2 flex items-center justify-between border-r border-gray-200">
                    <span className="font-medium text-sm text-gray-700">{labelA}</span>
                    <button
                        onClick={() => copyToClipboard(contentA)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="Copy"
                    >
                        <ClipboardIcon className="h-4 w-4" />
                    </button>
                </div>
                <div className="px-4 py-2 flex items-center justify-between">
                    <span className="font-medium text-sm text-gray-700">{labelB}</span>
                    <button
                        onClick={() => copyToClipboard(contentB)}
                        className="p-1 text-gray-400 hover:text-gray-600"
                        title="Copy"
                    >
                        <ClipboardIcon className="h-4 w-4" />
                    </button>
                </div>
            </div>
            
            {/* Diff Content */}
            <div className="max-h-[600px] overflow-auto">
                {viewMode === 'side-by-side' ? (
                    <table className="w-full text-sm font-mono">
                        <tbody>
                            {diff.map((line, idx) => (
                                <tr key={idx} className="border-b border-gray-100 last:border-0">
                                    {/* Left side (A) */}
                                    <td
                                        className={clsx(
                                            'align-top border-r border-gray-200',
                                            line.type === 'removed' && 'bg-red-50',
                                            line.type === 'modified' && 'bg-amber-50'
                                        )}
                                    >
                                        <div className="flex">
                                            {showLineNumbers && line.lineNumberA && (
                                                <span className="w-10 px-2 py-1 text-gray-400 text-right bg-gray-50 border-r border-gray-100 select-none">
                                                    {line.lineNumberA}
                                                </span>
                                            )}
                                            <span className={clsx(
                                                'flex-1 px-2 py-1 whitespace-pre-wrap',
                                                line.type === 'removed' && 'text-red-800',
                                                line.type === 'modified' && 'text-amber-800'
                                            )}>
                                                {line.type === 'modified' && line.lineA && line.lineB ? (
                                                    highlightWordChanges(line.lineA, line.lineB).wordsA.map((w, i) => (
                                                        <span
                                                            key={i}
                                                            className={w.changed ? 'bg-red-200 rounded' : ''}
                                                        >
                                                            {w.text}
                                                        </span>
                                                    ))
                                                ) : (
                                                    line.lineA || ''
                                                )}
                                            </span>
                                        </div>
                                    </td>
                                    
                                    {/* Right side (B) */}
                                    <td
                                        className={clsx(
                                            'align-top',
                                            line.type === 'added' && 'bg-green-50',
                                            line.type === 'modified' && 'bg-amber-50'
                                        )}
                                    >
                                        <div className="flex">
                                            {showLineNumbers && line.lineNumberB && (
                                                <span className="w-10 px-2 py-1 text-gray-400 text-right bg-gray-50 border-r border-gray-100 select-none">
                                                    {line.lineNumberB}
                                                </span>
                                            )}
                                            <span className={clsx(
                                                'flex-1 px-2 py-1 whitespace-pre-wrap',
                                                line.type === 'added' && 'text-green-800',
                                                line.type === 'modified' && 'text-amber-800'
                                            )}>
                                                {line.type === 'modified' && line.lineA && line.lineB ? (
                                                    highlightWordChanges(line.lineA, line.lineB).wordsB.map((w, i) => (
                                                        <span
                                                            key={i}
                                                            className={w.changed ? 'bg-green-200 rounded' : ''}
                                                        >
                                                            {w.text}
                                                        </span>
                                                    ))
                                                ) : (
                                                    line.lineB || ''
                                                )}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    /* Unified view */
                    <div className="font-mono text-sm">
                        {diff.map((line, idx) => {
                            if (line.type === 'unchanged') {
                                return (
                                    <div key={idx} className="flex border-b border-gray-50">
                                        {showLineNumbers && (
                                            <span className="w-10 px-2 py-1 text-gray-400 text-right bg-gray-50 border-r border-gray-100 select-none">
                                                {line.lineNumberA}
                                            </span>
                                        )}
                                        <span className="flex-1 px-2 py-1 whitespace-pre-wrap text-gray-600">
                                            {line.lineA}
                                        </span>
                                    </div>
                                );
                            }
                            
                            return (
                                <div key={idx}>
                                    {(line.type === 'removed' || line.type === 'modified') && line.lineA && (
                                        <div className="flex border-b border-gray-50 bg-red-50">
                                            {showLineNumbers && (
                                                <span className="w-10 px-2 py-1 text-red-400 text-right bg-red-100 border-r border-red-200 select-none">
                                                    -{line.lineNumberA}
                                                </span>
                                            )}
                                            <span className="flex-1 px-2 py-1 whitespace-pre-wrap text-red-800">
                                                - {line.lineA}
                                            </span>
                                        </div>
                                    )}
                                    {(line.type === 'added' || line.type === 'modified') && line.lineB && (
                                        <div className="flex border-b border-gray-50 bg-green-50">
                                            {showLineNumbers && (
                                                <span className="w-10 px-2 py-1 text-green-400 text-right bg-green-100 border-r border-green-200 select-none">
                                                    +{line.lineNumberB}
                                                </span>
                                            )}
                                            <span className="flex-1 px-2 py-1 whitespace-pre-wrap text-green-800">
                                                + {line.lineB}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
