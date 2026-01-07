import { useState, useEffect, useRef, useCallback } from 'react';
import clsx from 'clsx';
import {
    TableCellsIcon,
    ArrowDownTrayIcon,
    XMarkIcon,
    ArrowsPointingOutIcon,
    ArrowsPointingInIcon,
    ExclamationTriangleIcon,
    MagnifyingGlassPlusIcon,
    MagnifyingGlassMinusIcon,
} from '@heroicons/react/24/outline';
import * as XLSX from 'xlsx';

interface ExcelViewerProps {
    /** File blob data */
    fileData: Blob | ArrayBuffer | null;
    /** File name for display */
    fileName?: string;
    /** Callback when close button is clicked */
    onClose?: () => void;
    /** Callback when download button is clicked */
    onDownload?: () => void;
    /** CSS class name */
    className?: string;
    /** Minimum height */
    minHeight?: string;
}

/**
 * Excel Viewer Component with Sheet Tabs
 * 
 * Uses xlsx library to parse and render Excel files with:
 * - Multiple sheet tabs at the bottom (Excel-style)
 * - Full table rendering
 * - Zoom controls
 * - Microsoft Excel green UI
 */
export default function ExcelViewer({
    fileData,
    fileName = 'Spreadsheet.xlsx',
    onClose,
    onDownload,
    className = '',
    minHeight = '600px',
}: ExcelViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [zoom, setZoom] = useState(100);

    // Excel data state
    const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
    const [sheets, setSheets] = useState<string[]>([]);
    const [activeSheet, setActiveSheet] = useState(0);
    const [tableHtml, setTableHtml] = useState<string>('');

    // Parse Excel file when data changes
    useEffect(() => {
        if (!fileData) return;

        setIsLoading(true);
        setError(null);

        const parseExcel = async () => {
            try {
                const data = fileData instanceof Blob
                    ? await fileData.arrayBuffer()
                    : fileData;

                const wb = XLSX.read(data, { type: 'array' });
                setWorkbook(wb);
                setSheets(wb.SheetNames);
                setActiveSheet(0);

                // Render first sheet
                if (wb.SheetNames.length > 0) {
                    renderSheet(wb, 0);
                }

                setIsLoading(false);
            } catch (err: unknown) {
                console.error('Excel parse error:', err);
                const message = err instanceof Error ? err.message : 'Unknown error';
                setError('Failed to parse Excel file: ' + message);
                setIsLoading(false);
            }
        };

        parseExcel();
    }, [fileData]);

    // Render a specific sheet
    const renderSheet = useCallback((wb: XLSX.WorkBook, sheetIndex: number) => {
        const sheetName = wb.SheetNames[sheetIndex];
        const sheet = wb.Sheets[sheetName];
        const html = XLSX.utils.sheet_to_html(sheet, {
            id: 'excel-table',
            editable: false,
        });
        setTableHtml(html);
    }, []);

    // Handle sheet tab click
    const handleSheetChange = useCallback((index: number) => {
        setActiveSheet(index);
        if (workbook) {
            renderSheet(workbook, index);
        }
    }, [workbook, renderSheet]);

    const handleZoomIn = useCallback(() => {
        setZoom(prev => Math.min(prev + 25, 200));
    }, []);

    const handleZoomOut = useCallback(() => {
        setZoom(prev => Math.max(prev - 25, 50));
    }, []);

    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            containerRef.current?.requestFullscreen();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen();
            setIsFullscreen(false);
        }
    }, []);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    return (
        <div
            ref={containerRef}
            className={clsx(
                'bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col shadow-xl',
                isFullscreen && 'fixed inset-0 z-50 rounded-none',
                className
            )}
        >
            {/* Excel Green Header */}
            <div className="flex flex-col border-b border-gray-200">
                {/* Top bar with file name */}
                <div className="flex items-center justify-between px-4 py-2.5 bg-[#217346]">
                    <div className="flex items-center gap-3">
                        <TableCellsIcon className="h-5 w-5 text-white" />
                        <span className="text-white font-medium truncate max-w-[250px]">
                            {fileName}
                        </span>
                        <span className="text-white/70 text-xs px-2 py-0.5 bg-white/15 rounded">
                            Excel
                        </span>
                    </div>
                    <div className="flex items-center gap-1">
                        {onDownload && (
                            <button
                                onClick={onDownload}
                                className="p-2 rounded hover:bg-white/20 text-white transition-colors"
                                title="Download"
                            >
                                <ArrowDownTrayIcon className="h-5 w-5" />
                            </button>
                        )}
                        <button
                            onClick={toggleFullscreen}
                            className="p-2 rounded hover:bg-white/20 text-white transition-colors"
                            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                        >
                            {isFullscreen ? (
                                <ArrowsPointingInIcon className="h-5 w-5" />
                            ) : (
                                <ArrowsPointingOutIcon className="h-5 w-5" />
                            )}
                        </button>
                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-2 rounded hover:bg-white/20 text-white transition-colors"
                                title="Close"
                            >
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Toolbar with zoom */}
                <div className="flex items-center gap-4 px-4 py-2 bg-gray-50">
                    {/* Zoom controls */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleZoomOut}
                            disabled={zoom <= 50}
                            className={clsx(
                                'p-1.5 rounded border transition-colors',
                                zoom <= 50
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                                    : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300'
                            )}
                            title="Zoom out"
                        >
                            <MagnifyingGlassMinusIcon className="h-4 w-4" />
                        </button>
                        <span className="text-sm text-gray-600 min-w-[50px] text-center font-medium">
                            {zoom}%
                        </span>
                        <button
                            onClick={handleZoomIn}
                            disabled={zoom >= 200}
                            className={clsx(
                                'p-1.5 rounded border transition-colors',
                                zoom >= 200
                                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-200'
                                    : 'bg-white hover:bg-gray-100 text-gray-700 border-gray-300'
                            )}
                            title="Zoom in"
                        >
                            <MagnifyingGlassPlusIcon className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="h-6 w-px bg-gray-300" />

                    {/* Sheet count */}
                    <span className="text-sm text-gray-500">
                        {sheets.length} {sheets.length === 1 ? 'sheet' : 'sheets'}
                    </span>
                </div>
            </div>

            {/* Main content area - split into scrollable content and fixed tabs */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Loading State */}
                {isLoading && (
                    <div className="flex-1 flex items-center justify-center bg-gray-50">
                        <div className="flex flex-col items-center gap-3">
                            <div className="h-10 w-10 border-4 border-[#217346]/30 border-t-[#217346] rounded-full animate-spin" />
                            <span className="text-sm text-gray-600">Loading Excel file...</span>
                        </div>
                    </div>
                )}

                {/* Error State */}
                {error && !isLoading && (
                    <div className="flex-1 flex items-center justify-center bg-gray-50">
                        <div className="flex flex-col items-center gap-3 text-center p-6 bg-white rounded-lg shadow-lg max-w-sm">
                            <ExclamationTriangleIcon className="h-12 w-12 text-amber-500" />
                            <div>
                                <p className="text-sm font-medium text-gray-900">{error}</p>
                            </div>
                            {onDownload && (
                                <button
                                    onClick={onDownload}
                                    className="flex items-center gap-1.5 px-4 py-2 bg-[#217346] text-white rounded-lg hover:bg-[#1a5c38] transition-colors"
                                >
                                    <ArrowDownTrayIcon className="h-4 w-4" />
                                    Download Instead
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Excel Content - Scrollable area */}
                {!isLoading && !error && tableHtml && (
                    <div
                        className="flex-1 overflow-auto bg-white"
                        style={{ minHeight: '400px' }}
                    >
                        <div
                            style={{
                                transform: `scale(${zoom / 100})`,
                                transformOrigin: 'top left',
                                width: `${10000 / zoom}%`,
                            }}
                            dangerouslySetInnerHTML={{ __html: tableHtml }}
                        />
                    </div>
                )}
            </div>

            {/* Sheet Tabs - Fixed at bottom, OUTSIDE scrollable area */}
            {!isLoading && !error && sheets.length > 0 && (
                <div className="flex items-center gap-1 px-3 py-2 bg-[#e6e6e6] border-t border-gray-300 overflow-x-auto flex-shrink-0">
                    {sheets.map((sheet, index) => (
                        <button
                            key={sheet}
                            onClick={() => handleSheetChange(index)}
                            className={clsx(
                                'px-4 py-2 text-sm rounded transition-colors whitespace-nowrap',
                                activeSheet === index
                                    ? 'bg-white text-gray-900 font-medium shadow-sm border border-gray-300'
                                    : 'bg-[#f5f5f5] text-gray-600 hover:bg-white/80 border border-transparent'
                            )}
                        >
                            {sheet}
                        </button>
                    ))}
                </div>
            )}

            {/* Excel table styles */}
            <style>{`
                #excel-table {
                    border-collapse: collapse;
                    width: 100%;
                    font-size: 13px;
                    font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
                }
                
                #excel-table td,
                #excel-table th {
                    border: 1px solid #d4d4d4;
                    padding: 4px 8px;
                    text-align: left;
                    min-width: 64px;
                    max-width: 300px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                
                #excel-table th {
                    background-color: #f0f0f0;
                    font-weight: 600;
                    position: sticky;
                    top: 0;
                    z-index: 1;
                }
                
                #excel-table tr:nth-child(even) {
                    background-color: #fafafa;
                }
                
                #excel-table tr:hover {
                    background-color: #e8f4e8;
                }
                
                #excel-table td:first-child {
                    background-color: #f0f0f0;
                    font-weight: 500;
                    position: sticky;
                    left: 0;
                    z-index: 1;
                }
            `}</style>
        </div>
    );
}

// Modal wrapper
interface ExcelViewerModalProps extends Omit<ExcelViewerProps, 'onClose'> {
    isOpen: boolean;
    onClose: () => void;
}

export function ExcelViewerModal({
    isOpen,
    onClose,
    ...props
}: ExcelViewerModalProps) {
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 animate-fade-in"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <div className="w-full max-w-7xl max-h-[90vh] flex flex-col">
                <ExcelViewer
                    {...props}
                    onClose={onClose}
                    className="flex-1"
                    minHeight="calc(90vh - 60px)"
                />
            </div>
        </div>
    );
}
