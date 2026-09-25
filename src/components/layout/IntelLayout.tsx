import { ReactNode } from 'react';
import { Search, Filter, X, LayoutGrid, TerminalSquare } from 'lucide-react';
import PageHeader from './PageHeader';

interface IntelLayoutProps {
  breadcrumbs: { label: string }[];
  title: string;
  description: string;
  headerActions?: ReactNode;
  searchPlaceholder?: string;
  searchValue: string;
  onSearchChange: (val: string) => void;
  activeFilters: string[];
  onRemoveFilter: (filter: string) => void;
  resultsCount: number;
  tableContent: ReactNode;
  inspectorContent?: ReactNode;
  isInspectorOpen: boolean;
  onCloseInspector: () => void;
  advancedMode?: boolean;
  onToggleAdvanced?: () => void;
}

export default function IntelLayout({
  breadcrumbs, title, description, headerActions,
  searchPlaceholder = 'Search...', searchValue, onSearchChange,
  activeFilters, onRemoveFilter, resultsCount,
  tableContent, inspectorContent, isInspectorOpen, onCloseInspector,
  advancedMode = false, onToggleAdvanced
}: IntelLayoutProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0 bg-at-bg">
      <PageHeader
        breadcrumbs={breadcrumbs}
        title={title}
        description={description}
        actions={headerActions}
      />
      
      {/* Query Bar */}
      <div className="flex flex-col border-b border-at-border bg-[#0e0e0e]">
        <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Search Input */}
          <div className="flex-1 max-w-2xl flex items-center gap-3">
            <div className={`flex-1 relative flex items-center ${advancedMode ? 'border-at-accent/40' : 'border-at-border'} border rounded-[10px] bg-[rgba(255,255,255,0.03)] transition-colors focus-within:border-at-accent/40`}>
              <div className="pl-3.5 text-at-disabled">
                {advancedMode ? <TerminalSquare size={15} className="text-at-accent" /> : <Search size={15} />}
              </div>
              <input
                value={searchValue}
                onChange={e => onSearchChange(e.target.value)}
                placeholder={advancedMode ? "e.g. severity:critical AND type:domain" : searchPlaceholder}
                className={`w-full bg-transparent outline-none px-3 py-2.5 text-[13.5px] ${advancedMode ? 'font-mono text-at-text' : 'text-at-text-secondary'} placeholder:text-at-disabled`}
              />
              {searchValue && (
                <button onClick={() => onSearchChange('')} className="pr-3.5 text-at-disabled hover:text-at-text transition-colors">
                  <X size={15} />
                </button>
              )}
            </div>
            {onToggleAdvanced && (
              <button 
                onClick={onToggleAdvanced} 
                className={`p-2.5 border rounded-[10px] transition-colors ${advancedMode ? 'bg-at-accent/8 border-at-accent/25 text-at-accent' : 'bg-[rgba(255,255,255,0.03)] border-at-border text-at-muted hover:text-at-text'}`}
                title={advancedMode ? "Switch to standard search" : "Switch to advanced query"}
              >
                <LayoutGrid size={15} />
              </button>
            )}
          </div>
          
          <div className="flex items-center gap-3">
            <button className="at-btn at-btn-ghost at-btn-sm text-at-muted hover:text-at-text"><Filter size={14} /> Filters</button>
            <div className="h-5 w-px bg-at-border mx-1"></div>
            <span className="text-[12px] font-mono text-at-muted">{resultsCount.toLocaleString()} results</span>
          </div>
        </div>

        {/* Filter Chips */}
        {activeFilters.length > 0 && (
          <div className="px-5 pb-4 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-at-disabled uppercase tracking-wider mr-1">Active:</span>
            {activeFilters.map(f => (
              <span key={f} className="flex items-center gap-1.5 text-[12px] font-mono px-2.5 py-1 rounded-[6px] border border-at-border bg-[rgba(255,255,255,0.03)] text-at-text-secondary">
                {f}
                <button onClick={() => onRemoveFilter(f)} className="text-at-disabled hover:text-at-accent transition-colors"><X size={11} /></button>
              </span>
            ))}
            <button className="text-[11px] text-at-accent hover:underline ml-2" onClick={() => activeFilters.forEach(f => onRemoveFilter(f))}>Clear All</button>
          </div>
        )}
      </div>

      {/* Main Workspace (Table + Inspector) */}
      <div className="flex flex-1 min-h-0 relative">
        <div className="flex-1 overflow-auto">
          {tableContent}
        </div>
        
        {/* Right Inspector */}
        {isInspectorOpen && (
          <div className="w-[380px] shrink-0 border-l border-at-border bg-[#0e0e0e] shadow-[-8px_0_24px_rgba(0,0,0,0.4)] flex flex-col animate-slide-left z-20">
            {inspectorContent}
          </div>
        )}
      </div>
    </div>
  );
}
