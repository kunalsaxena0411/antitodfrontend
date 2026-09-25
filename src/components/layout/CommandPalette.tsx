import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, X, Clock, ArrowRight, Hash, Globe, Server, Shield, Users, Command, MonitorPlay, Terminal } from 'lucide-react';
import { TOP_LEVEL_ITEMS, NAV_GROUPS, UTILITY_ITEMS, BOTTOM_ITEMS } from '../../data/navigation';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (id: string) => void;
}

const ENTITY_TYPES = [
  { icon: Server, label: 'IP Address', example: 'ip:192.168.1.1' },
  { icon: Globe, label: 'Domain', example: 'domain:evil.com' },
  { icon: Hash, label: 'Hash', example: 'hash:275a021b...' },
  { icon: Shield, label: 'CVE', example: 'cve:CVE-2024-1234' },
  { icon: Users, label: 'Actor', example: 'actor:APT28' },
];

const RECENT_SEARCHES = [
  '185.220.101.42', 'CVE-2024-21762', 'evil.ru', 'APT29', '45.33.32.156',
];

const SUGGESTED_COMMANDS = [
  { icon: MonitorPlay, label: 'Enter SOC Wall Mode', cmd: '> soc_wall' },
  { icon: Terminal, label: 'Open CyberChef', cmd: '> cyberchef' },
  { icon: Shield, label: 'Run MITRE Analysis', cmd: '> mitre' }
];

export default function CommandPalette({ isOpen, onClose, onNavigate }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const allNavItems = useMemo(() => [
    ...TOP_LEVEL_ITEMS,
    ...NAV_GROUPS.flatMap(g => g.items),
    ...UTILITY_ITEMS,
    ...BOTTOM_ITEMS
  ], []);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const filteredItems = useMemo(() => {
    if (!query) return [];
    
    // Command mode
    if (query.startsWith('>')) {
       const cmdQuery = query.slice(1).trim().toLowerCase();
       return SUGGESTED_COMMANDS.filter(c => c.label.toLowerCase().includes(cmdQuery) || c.cmd.toLowerCase().includes(cmdQuery))
        .map(c => ({ type: 'command', id: c.cmd, label: c.label, icon: c.icon, desc: c.cmd }));
    }

    // Navigation mode
    return allNavItems
      .filter(i => i.label.toLowerCase().includes(query.toLowerCase()) || i.desc.toLowerCase().includes(query.toLowerCase()))
      .map(i => ({ type: 'nav', id: i.id, label: i.label, icon: i.icon, desc: i.desc }));
  }, [query, allNavItems]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        // Toggle handled by parent
      }
      
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, filteredItems.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter' && filteredItems.length > 0) {
        e.preventDefault();
        const item = filteredItems[selectedIndex];
        if (item) {
          if (item.type === 'nav') {
            onNavigate(item.id);
          } else if (item.type === 'command') {
            const navId = item.id.replace('> ', '');
            onNavigate(navId);
          }
          onClose();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose, filteredItems, selectedIndex, onNavigate]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-start justify-center pt-[12vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-at-bg/80 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-2xl bg-at-elevated border border-at-border rounded-[8px] shadow-2xl overflow-hidden animate-fade-in-up flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input header */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-at-border bg-at-surface">
          <Search size={20} className="text-at-muted flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search resources, IP addresses, or type > for commands..."
            className="flex-1 bg-transparent text-[15px] font-medium text-at-text outline-none placeholder:text-at-disabled"
          />
          {query && (
            <button onClick={() => setQuery('')} className="p-1 rounded hover:bg-at-subtle text-at-muted mr-2">
              <X size={16} />
            </button>
          )}
          <div className="flex items-center gap-1">
             <kbd className="text-[10px] bg-at-bg border border-at-border px-1.5 py-0.5 rounded text-at-muted">ESC</kbd>
          </div>
        </div>

        {/* Results area */}
        <div className="max-h-[60vh] overflow-y-auto custom-scrollbar flex-1">
          {query && filteredItems.length > 0 && (
            <div className="p-2">
              <div className="px-3 py-2 text-[11px] font-semibold text-at-disabled uppercase tracking-[0.05em]">
                {query.startsWith('>') ? 'Commands' : 'Navigation & Pages'}
              </div>
              {filteredItems.map((item, idx) => {
                const selected = idx === selectedIndex;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => {
                      if (item.type === 'nav') onNavigate(item.id);
                      else onNavigate(item.id.replace('> ', ''));
                      onClose();
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[6px] text-left transition-colors ${
                      selected ? 'bg-at-subtle border border-at-border-hover' : 'border border-transparent hover:bg-white/[0.02]'
                    }`}
                  >
                    <div className={`p-1.5 rounded ${selected ? 'bg-at-accent-muted text-at-accent' : 'bg-at-bg text-at-muted'}`}>
                       <Icon size={16} />
                    </div>
                    <div className="flex-1">
                      <div className={`text-[13px] ${selected ? 'text-at-text font-medium' : 'text-at-text-secondary'}`}>{item.label}</div>
                      <div className="text-[11px] text-at-muted mt-0.5">{item.desc}</div>
                    </div>
                    <ArrowRight size={14} className={selected ? 'text-at-accent' : 'text-transparent'} />
                  </button>
                );
              })}
            </div>
          )}

          {!query && (
            <div className="flex flex-col md:flex-row min-h-[300px]">
              {/* Left column: Recent & Suggestions */}
              <div className="flex-1 p-2 border-b md:border-b-0 md:border-r border-at-border">
                <div className="px-3 py-2 text-[11px] font-semibold text-at-disabled uppercase tracking-[0.05em]">Recent Searches</div>
                <div className="space-y-0.5">
                  {RECENT_SEARCHES.map(s => (
                    <button
                      key={s}
                      onClick={() => setQuery(s)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-[6px] hover:bg-white/[0.03] text-left group transition-colors"
                    >
                      <Clock size={14} className="text-at-disabled group-hover:text-at-muted" />
                      <span className="text-[13px] font-mono text-at-muted group-hover:text-at-text-secondary">{s}</span>
                    </button>
                  ))}
                </div>

                <div className="px-3 py-2 mt-4 text-[11px] font-semibold text-at-disabled uppercase tracking-[0.05em]">Commands</div>
                <div className="space-y-0.5">
                  {SUGGESTED_COMMANDS.map(c => (
                    <button
                      key={c.cmd}
                      onClick={() => setQuery(c.cmd)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-[6px] hover:bg-white/[0.03] text-left group transition-colors"
                    >
                      <Command size={14} className="text-at-disabled group-hover:text-at-muted" />
                      <span className="text-[13px] text-at-text-secondary group-hover:text-at-text">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Right column: Filters & Types */}
              <div className="flex-1 p-2 bg-at-subtle/50">
                <div className="px-3 py-2 text-[11px] font-semibold text-at-disabled uppercase tracking-[0.05em]">Search by Entity</div>
                <div className="flex flex-col gap-1 px-1">
                  {ENTITY_TYPES.map(et => {
                    const EtIcon = et.icon;
                    return (
                      <button
                        key={et.label}
                        className="flex items-center gap-3 px-3 py-2 rounded-[6px] hover:bg-white/[0.04] text-left group transition-colors border border-transparent hover:border-at-border"
                        onClick={() => setQuery(et.example)}
                      >
                        <div className="p-1 rounded bg-at-bg border border-at-border text-at-muted group-hover:text-at-accent group-hover:border-at-accent/30 transition-colors">
                          <EtIcon size={12} />
                        </div>
                        <span className="text-[12px] text-at-text-secondary flex-1">{et.label}</span>
                        <span className="text-[10px] font-mono text-at-disabled group-hover:text-at-muted">{et.example}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="px-3 py-2 mt-4 text-[11px] font-semibold text-at-disabled uppercase tracking-[0.05em]">Smart Filters</div>
                <div className="flex flex-wrap gap-1.5 px-3 pt-1">
                  {['severity:critical', 'country:russia', 'type:ipv4', 'last_seen:24h'].map(f => (
                    <button key={f} className="at-chip text-[11px] hover:border-at-accent/50 hover:text-at-accent transition-colors bg-at-bg" onClick={() => setQuery(f)}>
                      {f}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {query && filteredItems.length === 0 && (
            <div className="flex flex-col items-center justify-center p-12 text-center h-[300px]">
              <Search size={32} className="text-at-disabled mb-4" />
              <div className="text-[15px] font-medium text-at-text mb-1">No results found</div>
              <div className="text-[13px] text-at-muted">
                We couldn't find anything matching "<span className="text-at-text-secondary font-mono">{query}</span>"
              </div>
            </div>
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-at-border bg-at-surface text-[11px] text-at-muted">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5"><kbd className="bg-at-bg border border-at-border px-1.5 py-0.5 rounded font-mono text-at-text-secondary">â†‘</kbd><kbd className="bg-at-bg border border-at-border px-1.5 py-0.5 rounded font-mono text-at-text-secondary -ml-1">â†“</kbd> to navigate</span>
            <span className="flex items-center gap-1.5"><kbd className="bg-at-bg border border-at-border px-1.5 py-0.5 rounded font-mono text-at-text-secondary">â†µ</kbd> to select</span>
          </div>
          <div className="flex items-center gap-1.5">
             <kbd className="bg-at-bg border border-at-border px-1.5 py-0.5 rounded font-mono text-at-text-secondary">&gt;</kbd> for commands
          </div>
        </div>
      </div>
    </div>
  );
}

