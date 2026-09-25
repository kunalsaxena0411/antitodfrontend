import { useState } from 'react';
import { Download, Filter, Search, Layers, X, Target, Info, Shield } from 'lucide-react';
import PageHeader from '../components/layout/PageHeader';

const TACTICS = [
  'Initial Access', 'Execution', 'Persistence', 'Privilege Escalation', 'Defense Evasion',
  'Credential Access', 'Discovery', 'Lateral Movement', 'Collection', 'Command and Control',
  'Exfiltration', 'Impact'
];

const MOCK_TECHNIQUES = Array.from({ length: 60 }).map((_, i) => ({
  id: `T1${i.toString().padStart(3, '0')}`,
  name: `Technique ${i}`,
  tactic: TACTICS[i % TACTICS.length],
  coverage: Math.random() > 0.7 ? 'high' : Math.random() > 0.4 ? 'medium' : 'low'
}));

export default function MitreNavigatorPage() {
  const [selectedTech, setSelectedTech] = useState<string | null>(null);
  
  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#060606]">
      <PageHeader
        breadcrumbs={[{ label: 'Detection & Response' }, { label: 'MITRE Navigator' }]}
        title="ATT&CK Navigator"
        description="Visualize threat actor techniques and detection coverage."
        actions={
          <div className="flex gap-2">
            <button className="at-btn at-btn-ghost at-btn-sm"><Filter size={13} /> Filter View</button>
            <button className="at-btn at-btn-secondary at-btn-sm"><Download size={13} /> Export Matrix</button>
          </div>
        }
      />
      
      {/* Workspace */}
      <div className="flex flex-1 min-h-0 relative">
        
        {/* Matrix Centerpiece */}
        <div className="flex-1 overflow-auto p-4 custom-scrollbar bg-at-bg">
          <div className="inline-flex gap-2 min-w-max">
            {TACTICS.map(tactic => {
              const tacticsTechs = MOCK_TECHNIQUES.filter(t => t.tactic === tactic);
              return (
                <div key={tactic} className="w-[180px] flex flex-col gap-1.5 shrink-0">
                  <div className="bg-at-surface border border-at-border p-2 rounded text-[11px] font-semibold text-at-text text-center shadow-sm sticky top-0 z-10 truncate" title={tactic}>
                    {tactic}
                    <div className="text-[9px] font-normal text-at-muted mt-0.5">{tacticsTechs.length} techniques</div>
                  </div>
                  
                  {tacticsTechs.map(tech => (
                    <div
                      key={tech.id}
                      onClick={() => setSelectedTech(tech.id)}
                      className={`p-2 rounded border cursor-pointer transition-colors text-[10px] flex flex-col gap-1
                        ${selectedTech === tech.id ? 'border-at-accent bg-at-accent/10 shadow-[0_0_10px_rgba(214,40,40,0.15)] ring-1 ring-at-accent' : 
                          'border-at-border bg-[#0a0a0a] hover:border-at-muted hover:bg-at-surface'
                        }
                      `}
                    >
                      <div className="flex items-center justify-between">
                        <span className={`font-mono ${selectedTech === tech.id ? 'text-at-accent' : 'text-at-text-secondary'}`}>{tech.id}</span>
                        <div className={`w-1.5 h-1.5 rounded-full ${tech.coverage === 'high' ? 'bg-emerald-500' : tech.coverage === 'medium' ? 'bg-amber-500' : 'bg-at-bg border border-at-border'}`} title={`Coverage: ${tech.coverage}`} />
                      </div>
                      <div className={`truncate font-medium ${selectedTech === tech.id ? 'text-at-text' : 'text-at-muted'}`}>{tech.name}</div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Detail Flyout */}
        {selectedTech && (
          <div className="w-[320px] shrink-0 border-l border-at-border bg-at-surface shadow-[-8px_0_24px_rgba(0,0,0,0.5)] flex flex-col animate-slide-left z-20 h-full relative">
            <div className="p-4 border-b border-at-border">
              <button onClick={() => setSelectedTech(null)} className="absolute top-4 right-4 text-at-disabled hover:text-at-text"><X size={14} /></button>
              <div className="text-[10px] font-semibold text-at-disabled uppercase tracking-widest mb-1 flex items-center gap-1"><Layers size={10}/> ATT&CK Technique</div>
              <div className="text-[16px] font-mono font-bold text-at-text mb-1">{selectedTech}</div>
              <div className="text-[12px] text-at-text-secondary">Technique Name Placeholder</div>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto space-y-5">
              <div>
                <div className="text-[10px] text-at-disabled mb-2 uppercase tracking-widest font-semibold">Coverage Status</div>
                <div className="p-3 bg-at-bg border border-at-border rounded flex items-center gap-3">
                  <Shield size={16} className="text-amber-500" />
                  <div>
                    <div className="text-[11px] font-semibold text-at-text">Medium Coverage</div>
                    <div className="text-[10px] text-at-muted">3 active rules mapped.</div>
                  </div>
                </div>
              </div>
              
              <div>
                <div className="text-[10px] text-at-disabled mb-2 uppercase tracking-widest font-semibold">Description</div>
                <div className="text-[11px] text-at-text-secondary leading-relaxed bg-[#060606] p-3 rounded border border-at-border/50">
                  Adversaries may execute their own malicious payloads by hijacking the way operating systems run programs...
                </div>
              </div>
              
              <div>
                <div className="text-[10px] text-at-disabled mb-2 uppercase tracking-widest font-semibold flex items-center gap-1.5"><Target size={12}/> Threat Actors</div>
                <div className="flex flex-wrap gap-1.5">
                  {['APT28', 'Lazarus Group', 'FIN7'].map(a => <span key={a} className="px-2 py-1 bg-at-bg border border-at-border rounded text-[10px] font-mono text-at-text-secondary">{a}</span>)}
                </div>
              </div>
            </div>
            
            <div className="p-4 border-t border-at-border bg-[#060606]">
              <button className="at-btn at-btn-secondary w-full text-[11px] justify-center flex items-center gap-2"><Info size={12}/> View Associated Rules</button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

