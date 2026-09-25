import { useState } from 'react';
import { Download, Plus, PlayCircle, CheckCircle, Clock, User, ClipboardList, ShieldAlert, ArrowRight, MessageSquare } from 'lucide-react';
import IntelLayout from '../components/layout/IntelLayout';

interface MockPlaybook {
  id: string;
  name: string;
  incident: string;
  status: 'active' | 'completed' | 'pending';
  owner: string;
  progress: number;
  lastUpdated: string;
}

const MOCK_PLAYBOOKS: MockPlaybook[] = [
  { id: 'PB-1042', name: 'Ransomware Containment', incident: 'INC-9921', status: 'active', owner: 'Analyst-1', progress: 40, lastUpdated: '10 mins ago' },
  { id: 'PB-1041', name: 'Phishing Email Triage', incident: 'INC-9920', status: 'completed', owner: 'Analyst-2', progress: 100, lastUpdated: '2 hours ago' },
  { id: 'PB-1040', name: 'Unauthorized Access Investigation', incident: 'INC-9919', status: 'active', owner: 'Analyst-1', progress: 80, lastUpdated: '5 hours ago' },
];

export default function PlaybookPage() {
  const [search, setSearch] = useState('');
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [selectedPbId, setSelectedPbId] = useState<string | null>(null);

  const selectedPb = MOCK_PLAYBOOKS.find(p => p.id === selectedPbId) || null;
  const filtered = MOCK_PLAYBOOKS.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  const table = (
    <table className="w-full text-left border-collapse">
      <thead>
        <tr className="border-b border-at-border bg-at-surface/30 sticky top-0 z-10">
          <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest w-12">ID</th>
          <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest">Playbook Name</th>
          <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest">Incident</th>
          <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest">Status</th>
          <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest">Owner</th>
          <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest">Progress</th>
          <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest">Last Updated</th>
        </tr>
      </thead>
      <tbody>
        {filtered.map(pb => {
          const isSelected = selectedPbId === pb.id;
          return (
            <tr
              key={pb.id}
              onClick={() => setSelectedPbId(pb.id)}
              className={`border-b border-at-border/50 transition-colors cursor-pointer group ${isSelected ? 'bg-at-accent/5' : 'hover:bg-white/[0.02]'}`}
            >
              <td className="px-4 py-4 text-[11px] font-mono text-at-muted">{pb.id}</td>
              <td className="px-4 py-4">
                <div className={`text-[13px] font-medium ${isSelected ? 'text-at-text' : 'text-at-text-secondary group-hover:text-at-text'}`}>{pb.name}</div>
              </td>
              <td className="px-4 py-4 text-[11px] font-mono text-at-accent hover:underline">{pb.incident}</td>
              <td className="px-4 py-4">
                <span className={`at-badge ${pb.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : pb.status === 'active' ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' : 'bg-at-surface text-at-muted border-at-border'}`}>
                  {pb.status.toUpperCase()}
                </span>
              </td>
              <td className="px-4 py-4">
                <div className="flex items-center gap-1.5 text-[11px] text-at-text-secondary"><User size={12}/> {pb.owner}</div>
              </td>
              <td className="px-4 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-16 h-1.5 bg-at-subtle rounded-full overflow-hidden">
                    <div className={`h-full ${pb.progress === 100 ? 'bg-emerald-500' : 'bg-at-accent'}`} style={{ width: `${pb.progress}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-at-muted">{pb.progress}%</span>
                </div>
              </td>
              <td className="px-4 py-4 text-[11px] font-mono text-at-muted">{pb.lastUpdated}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );

  const inspector = selectedPb ? (
    <div className="flex flex-col h-full bg-at-bg">
      <div className="p-5 border-b border-at-border bg-gradient-to-br from-at-surface to-transparent relative">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <ClipboardList size={16} className="text-at-muted" />
            <div className="text-[10px] font-semibold text-at-disabled uppercase tracking-widest">{selectedPb.id}</div>
          </div>
          <span className={`at-badge ${selectedPb.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>{selectedPb.status.toUpperCase()}</span>
        </div>
        <div className="text-[16px] font-medium text-at-text mb-2 leading-tight">{selectedPb.name}</div>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1 text-at-text-secondary"><ShieldAlert size={12}/> {selectedPb.incident}</span>
          <span className="flex items-center gap-1 text-at-muted"><User size={12}/> {selectedPb.owner}</span>
        </div>
      </div>
      
      {/* Workflow Steps */}
      <div className="flex-1 p-5 overflow-y-auto space-y-0 custom-scrollbar relative">
        <div className="absolute left-8 top-5 bottom-5 w-px bg-at-border z-0" />
        
        {/* Step 1: Completed */}
        <div className="relative z-10 flex gap-4 pb-6">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle size={12} />
          </div>
          <div className="flex-1 bg-at-surface/50 border border-at-border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[12px] font-semibold text-at-text">1. Isolate Infected Host</div>
              <span className="text-[10px] font-mono text-at-muted">14:22 UTC</span>
            </div>
            <div className="text-[11px] text-at-muted mb-2">Containment action triggered via EDR API.</div>
            <div className="p-2 bg-[#060606] border border-at-border/50 rounded text-[11px] font-mono text-emerald-500 mb-2">
              Success: Host WIN-SRV-01 isolated from network.
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-at-text-secondary"><img src={`https://ui-avatars.com/api/?name=A+1&background=random&size=16`} className="w-4 h-4 rounded-full"/> Analyst-1</div>
          </div>
        </div>

        {/* Step 2: Completed */}
        <div className="relative z-10 flex gap-4 pb-6">
          <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
            <CheckCircle size={12} />
          </div>
          <div className="flex-1 bg-at-surface/50 border border-at-border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[12px] font-semibold text-at-text">2. Block C2 Infrastructure</div>
              <span className="text-[10px] font-mono text-at-muted">14:30 UTC</span>
            </div>
            <div className="text-[11px] text-at-muted mb-2">Add identified IPs to firewall blocklist.</div>
            <div className="p-2 bg-[#060606] border border-at-border/50 rounded text-[11px] font-mono text-emerald-500 mb-2">
              Success: 3 IPs added to PAN-OS external block group.
            </div>
          </div>
        </div>

        {/* Step 3: Active */}
        <div className="relative z-10 flex gap-4 pb-6">
          <div className="w-6 h-6 rounded-full bg-at-accent/20 border border-at-accent text-at-accent flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-[10px] font-bold animate-pulse">3</span>
          </div>
          <div className="flex-1 bg-at-surface border border-at-accent/50 rounded-lg p-3 shadow-[0_0_15px_rgba(214,40,40,0.05)]">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[12px] font-semibold text-at-accent">3. Acquire Memory Dump</div>
              <span className="text-[10px] font-mono text-at-muted flex items-center gap-1"><Clock size={10}/> In Progress</span>
            </div>
            <div className="text-[11px] text-at-text-secondary mb-3">Initiate remote memory acquisition on WIN-SRV-01 for forensic analysis.</div>
            
            <div className="border-l-2 border-at-border pl-2 mb-3">
              <div className="flex items-center gap-1.5 text-[10px] text-at-muted mb-1"><MessageSquare size={10}/> Analyst Note</div>
              <div className="text-[11px] text-at-text-secondary italic">"Acquisition taking longer than expected due to slow link to branch office. Waiting for completion." - Analyst-1</div>
            </div>

            <div className="flex gap-2 mt-3">
              <button className="at-btn at-btn-primary at-btn-sm flex-1 text-[10px] justify-center">Mark Complete</button>
              <button className="at-btn at-btn-ghost border border-at-border at-btn-sm text-[10px] justify-center">Skip Step</button>
            </div>
          </div>
        </div>

        {/* Step 4: Pending */}
        <div className="relative z-10 flex gap-4">
          <div className="w-6 h-6 rounded-full bg-at-bg border border-at-border text-at-disabled flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-[10px] font-bold">4</span>
          </div>
          <div className="flex-1 bg-at-bg border border-at-border rounded-lg p-3 opacity-60">
            <div className="flex items-center justify-between mb-1">
              <div className="text-[12px] font-semibold text-at-disabled">4. Post-Incident Review</div>
            </div>
            <div className="text-[11px] text-at-disabled">Document findings and update threat models.</div>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <IntelLayout
      breadcrumbs={[{ label: 'Detection & Response' }, { label: 'Playbooks' }]}
      title="Response Playbooks"
      description="Standardized operating procedures and automated response workflows."
      headerActions={<button className="at-btn at-btn-primary at-btn-sm"><Plus size={13} /> New Playbook</button>}
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search playbooks or incidents..."
      activeFilters={activeFilters}
      onRemoveFilter={f => setActiveFilters(prev => prev.filter(x => x !== f))}
      resultsCount={filtered.length}
      tableContent={table}
      inspectorContent={inspector}
      isInspectorOpen={!!selectedPbId}
      onCloseInspector={() => setSelectedPbId(null)}
    />
  );
}

