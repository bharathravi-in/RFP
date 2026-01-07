import { useState, useMemo, useCallback } from 'react';

interface FilterConfig<T> {
    /** Field to filter on */
    field: keyof T;
    /** Filter type */
    type: 'text' | 'select' | 'date' | 'range' | 'boolean';
    /** Label for UI */
    label: string;
}

interface UseSearchFilterOptions<T> {
    /** Initial data to filter */
    data: T[];
    /** Fields to search in */
    searchFields: (keyof T)[];
    /** Filter configurations */
    filters?: FilterConfig<T>[];
    /** Default sort field */
    defaultSortField?: keyof T;
    /** Default sort direction */
    defaultSortDir?: 'asc' | 'desc';
}

interface FilterValue {
    field: string;
    value: any;
    operator?: 'eq' | 'gt' | 'lt' | 'gte' | 'lte' | 'contains';
}

interface UseSearchFilterReturn<T> {
    /** Filtered and sorted results */
    results: T[];
    /** Search query */
    searchQuery: string;
    /** Set search query */
    setSearchQuery: (query: string) => void;
    /** Active filters */
    activeFilters: FilterValue[];
    /** Add filter */
    addFilter: (filter: FilterValue) => void;
    /** Remove filter */
    removeFilter: (field: string) => void;
    /** Clear all filters */
    clearFilters: () => void;
    /** Sort field */
    sortField: keyof T | null;
    /** Sort direction */
    sortDir: 'asc' | 'desc';
    /** Set sort */
    setSort: (field: keyof T, dir?: 'asc' | 'desc') => void;
    /** Total count (before filtering) */
    totalCount: number;
    /** Filtered count */
    filteredCount: number;
}

/**
 * Hook for client-side search, filter, and sort functionality.
 */
export function useSearchFilter<T extends Record<string, any>>(
    options: UseSearchFilterOptions<T>
): UseSearchFilterReturn<T> {
    const {
        data,
        searchFields,
        defaultSortField = null,
        defaultSortDir = 'asc'
    } = options;

    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilters, setActiveFilters] = useState<FilterValue[]>([]);
    const [sortField, setSortField] = useState<keyof T | null>(defaultSortField);
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>(defaultSortDir);

    // Add filter
    const addFilter = useCallback((filter: FilterValue) => {
        setActiveFilters(prev => {
            // Replace existing filter for same field
            const filtered = prev.filter(f => f.field !== filter.field);
            return [...filtered, filter];
        });
    }, []);

    // Remove filter
    const removeFilter = useCallback((field: string) => {
        setActiveFilters(prev => prev.filter(f => f.field !== field));
    }, []);

    // Clear all filters
    const clearFilters = useCallback(() => {
        setActiveFilters([]);
        setSearchQuery('');
    }, []);

    // Set sort
    const setSort = useCallback((field: keyof T, dir?: 'asc' | 'desc') => {
        if (sortField === field && !dir) {
            // Toggle direction
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir(dir || 'asc');
        }
    }, [sortField]);

    // Compute results
    const results = useMemo(() => {
        let filtered = [...data];

        // Apply search
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(item =>
                searchFields.some(field => {
                    const value = item[field];
                    if (typeof value === 'string') {
                        return value.toLowerCase().includes(query);
                    }
                    if (typeof value === 'number') {
                        return value.toString().includes(query);
                    }
                    return false;
                })
            );
        }

        // Apply filters
        for (const filter of activeFilters) {
            filtered = filtered.filter(item => {
                const value = item[filter.field];
                const filterValue = filter.value;
                const operator = filter.operator || 'eq';

                switch (operator) {
                    case 'eq':
                        return value === filterValue;
                    case 'gt':
                        return value > filterValue;
                    case 'lt':
                        return value < filterValue;
                    case 'gte':
                        return value >= filterValue;
                    case 'lte':
                        return value <= filterValue;
                    case 'contains':
                        return String(value).toLowerCase().includes(String(filterValue).toLowerCase());
                    default:
                        return true;
                }
            });
        }

        // Apply sort
        if (sortField) {
            filtered.sort((a, b) => {
                const aVal = a[sortField];
                const bVal = b[sortField];

                let comparison = 0;
                if (typeof aVal === 'string' && typeof bVal === 'string') {
                    comparison = aVal.localeCompare(bVal);
                } else if (aVal instanceof Date && bVal instanceof Date) {
                    comparison = aVal.getTime() - bVal.getTime();
                } else {
                    comparison = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
                }

                return sortDir === 'desc' ? -comparison : comparison;
            });
        }

        return filtered;
    }, [data, searchQuery, searchFields, activeFilters, sortField, sortDir]);

    return {
        results,
        searchQuery,
        setSearchQuery,
        activeFilters,
        addFilter,
        removeFilter,
        clearFilters,
        sortField,
        sortDir,
        setSort,
        totalCount: data.length,
        filteredCount: results.length,
    };
}

/**
 * SearchInput component
 */
export function SearchInput({
    value,
    onChange,
    placeholder = 'Search...',
    className = '',
}: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
}) {
    return (
        <div className= {`relative ${className}`
}>
    <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
fill = "none"
stroke = "currentColor"
viewBox = "0 0 24 24"
    >
    <path
          strokeLinecap="round"
strokeLinejoin = "round"
strokeWidth = { 2}
d = "M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
    </svg>
    < input
type = "text"
value = { value }
onChange = {(e) => onChange(e.target.value)}
placeholder = { placeholder }
className = "w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
bg - white dark: bg - gray - 800 focus: outline - none focus: ring - 2 focus: ring - primary"
    />
    { value && (
        <button
          onClick={ () => onChange('') }
className = "absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
    >
    <svg className="w-4 h-4" fill = "none" stroke = "currentColor" viewBox = "0 0 24 24" >
        <path strokeLinecap="round" strokeLinejoin = "round" strokeWidth = { 2} d = "M6 18L18 6M6 6l12 12" />
            </svg>
            </button>
      )}
</div>
  );
}

/**
 * SortButton component
 */
export function SortButton<T>({
    field,
    label,
    currentField,
    currentDir,
    onSort,
}: {
    field: keyof T;
    label: string;
    currentField: keyof T | null;
    currentDir: 'asc' | 'desc';
    onSort: (field: keyof T) => void;
}) {
    const isActive = currentField === field;

    return (
        <button
      onClick= {() => onSort(field)
}
className = {`flex items-center gap-1 px-2 py-1 rounded text-sm
                  ${isActive ? 'text-primary font-medium' : 'text-gray-600 dark:text-gray-400'}`}
    >
    { label }
{
    isActive && (
        <svg
          className={ `w-4 h-4 transition-transform ${currentDir === 'desc' ? 'rotate-180' : ''}` }
    fill = "none"
    stroke = "currentColor"
    viewBox = "0 0 24 24"
        >
        <path strokeLinecap="round" strokeLinejoin = "round" strokeWidth = { 2} d = "M5 15l7-7 7 7" />
            </svg>
      )
}
</button>
  );
}

export default useSearchFilter;
