import { useState } from 'react';
import { Download, Plus, FileCode, CheckCircle, Shield, Code, Play } from 'lucide-react';
import IntelLayout from '../components/layout/IntelLayout';

interface MockRule {
  id: string;
  name: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'active' | 'testing' | 'disabled';
  mitre: string[];
  format: 'sigma' | 'yara' | 'snort';
  lastModified: string;
  testStatus: 'passing' | 'failing' | 'untested';
}

const MOCK_RULES: MockRule[] = [
  { id: 'RUL-001', name: 'Suspicious PowerShell Download', severity: 'high', status: 'active', mitre: ['T1059.001'], format: 'sigma', lastModified: '2026-09-20', testStatus: 'passing' },
  { id: 'RUL-002', name: 'Cobalt Strike Beacon HTTP', severity: 'critical', status: 'active', mitre: ['T1071.001', 'T1573'], format: 'snort', lastModified: '2026-09-22', testStatus: 'passing' },
  { id: 'RUL-003', name: 'Mimikatz Execution Pattern', severity: 'critical', status: 'testing', mitre: ['T1003.001'], format: 'sigma', lastModified: '2026-09-24', testStatus: 'failing' },
  { id: 'RUL-004', name: 'Malicious Office Macro', severity: 'medium', status: 'active', mitre: ['T1059.005'], format: 'yara', lastModified: '2026-09-15', testStatus: 'passing' },
  { id: 'RUL-005', name: 'RDP Brute Force Attempt', severity: 'high', status: 'disabled', mitre: ['T1110.001'], format: 'sigma', lastModified: '2026-09-10', testStatus: 'untested' },
];

export default function RulesPage() {
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);

  const selectedRule = MOCK_RULES.find(r => r.id === selectedRuleId) || null;
  const filtered = MOCK_RULES.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()));

  const table = (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="border-b border-at-border bg-at-surface/30 sticky top-0 z-10">
          <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest w-12">Format</th>
          <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest">Rule Name</th>
          <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest">Severity</th>
          <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest">Status</th>
          <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest">MITRE</th>
          <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest">Test Status</th>
          <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest text-right">Modified</th>
        </tr>
      </thead>
      <tbody>
        {filtered.map(rule => {
          const isSelected = selectedRuleId === rule.id;
          return (
            <tr
              key={rule.id}
              onClick={() => setSelectedRuleId(rule.id)}
              className={`border-b border-at-border/50 transition-colors cursor-pointer group ${isSelected ? 'bg-at-accent/5' : 'hover:bg-white/[0.02]'}`}
            >
              <td className="px-4 py-3">
                <span className="text-[10px] font-mono font-bold uppercase text-at-muted bg-at-surface border border-at-border px-1.5 py-0.5 rounded">{rule.format}</span>
              </td>
              <td className="px-4 py-3">
                <div className={`text-[12px] font-medium ${isSelected ? 'text-at-text' : 'text-at-text-secondary group-hover:text-at-text'}`}>{rule.name}</div>
              </td>
              <td className="px-4 py-3">
                <span className={`at-badge ${rule.severity === 'critical' ? 'at-badge-critical' : rule.severity === 'high' ? 'at-badge-high' : 'at-badge-medium'}`}>{rule.severity}</span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5 text-[11px] text-at-muted">
                  <div className={`w-1.5 h-1.5 rounded-full ${rule.status === 'active' ? 'bg-at-accent' : rule.status === 'testing' ? 'bg-amber-500' : 'bg-at-disabled'}`} />
                  <span className="capitalize">{rule.status}</span>
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex gap-1 flex-wrap">
                  {rule.mitre.map(t => <span key={t} className="text-[10px] font-mono text-at-text-secondary bg-[#060606] px-1.5 py-0.5 rounded">{t}</span>)}
                </div>
              </td>
              <td className="px-4 py-3">
                <span className={`text-[10px] uppercase tracking-widest font-semibold flex items-center gap-1 ${rule.testStatus === 'passing' ? 'text-emerald-500' : rule.testStatus === 'failing' ? 'text-at-accent' : 'text-at-muted'}`}>
                  {rule.testStatus === 'passing' ? <CheckCircle size={10} /> : rule.testStatus === 'failing' ? <Shield size={10} /> : null}
                  {rule.testStatus}
                </span>
              </td>
              <td className="px-4 py-3 text-[11px] font-mono text-at-muted text-right">{rule.lastModified}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const inspector = selectedRule ? (
    <div className="flex flex-col h-full bg-at-bg">
      <div className="p-4 border-b border-at-border flex items-center justify-between bg-at-surface/30">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-at-surface border border-at-border flex items-center justify-center text-at-text"><FileCode size={14} /></div>
          <div>
            <div className="text-[14px] font-medium text-at-text leading-tight">{selectedRule.name}</div>
            <div className="text-[10px] font-mono text-at-muted">{selectedRule.id}</div>
          </div>
        </div>
      </div>
      
      {/* Editor Surface */}
      <div className="flex-1 flex flex-col p-4 bg-[#0a0a0a]">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-semibold text-at-disabled uppercase tracking-widest flex items-center gap-1.5"><Code size={12}/> Rule Definition</span>
          <div className="flex gap-2">
            <span className="text-[10px] font-mono text-at-muted bg-at-surface px-1.5 py-0.5 rounded">{selectedRule.format.toUpperCase()}</span>
          </div>
        </div>
        <div className="flex-1 border border-at-border rounded bg-[#060606] p-4 overflow-y-auto font-mono text-[12px] text-at-text-secondary leading-relaxed custom-scrollbar">
          <span className="text-at-muted">title:</span> Suspicious PowerShell Download<br/>
          <span className="text-at-muted">id:</span> 34a2e5d5-24b5-412f-9815-f864459f2a24<br/>
          <span className="text-at-muted">status:</span> experimental<br/>
          <span className="text-at-muted">description:</span> Detects suspicious PowerShell download cradle<br/>
          <span className="text-at-muted">logsource:</span><br/>
          &nbsp;&nbsp;<span className="text-at-muted">product:</span> windows<br/>
          &nbsp;&nbsp;<span className="text-at-muted">service:</span> powershell<br/>
          <span className="text-at-muted">detection:</span><br/>
          &nbsp;&nbsp;<span className="text-at-muted">selection:</span><br/>
          &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-at-muted">EventID:</span> 4104<br/>
          &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-at-muted">ScriptBlockText|contains:</span><br/>
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- <span className="text-amber-500">'Net.WebClient'</span><br/>
          &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;- <span className="text-amber-500">'DownloadString'</span><br/>
          &nbsp;&nbsp;<span className="text-at-muted">condition:</span> selection<br/>
        </div>
      </div>

      {/* Editor Actions */}
      <div className="p-4 border-t border-at-border bg-at-surface/50 flex gap-2 shrink-0">
        <button className="at-btn at-btn-secondary flex-1 text-[11px] justify-center"><Play size={12}/> Run Tests</button>
        <button className="at-btn at-btn-primary flex-1 text-[11px] justify-center">Save Rule</button>
      </div>
    </div>
  ) : null;

  return (
    <IntelLayout
      breadcrumbs={[{ label: 'Detection & Response' }, { label: 'Rules' }]}
      title="Detection Engineering"
      description="Manage, author, and test detection rules across the environment."
      headerActions={<button className="at-btn at-btn-primary at-btn-sm"><Plus size={13} /> New Rule</button>}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search rules, tags, or mitre tactics..."
      activeFilters={activeFilters}
      onRemoveFilter={f => setActiveFilters(prev => prev.filter(x => x !== f))}
      resultsCount={filtered.length}
      tableContent={table}
      inspectorContent={inspector}
      isInspectorOpen={!!selectedRuleId}
      onCloseInspector={() => setSelectedRuleId(null)}
    />
  );
}

