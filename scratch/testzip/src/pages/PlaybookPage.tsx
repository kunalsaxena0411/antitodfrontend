import { useMemo, useState } from 'react';
import {
  Download,
  Plus,
  ClipboardList,
  User,
  ShieldAlert,
  CircleCheck,
  Clock3,
  X,
  Search,
  Activity,
  ExternalLink,
} from 'lucide-react';
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
  {
    id: 'PB-1042',
    name: 'Ransomware Containment',
    incident: 'INC-9921',
    status: 'active',
    owner: 'Analyst-1',
    progress: 40,
    lastUpdated: '10 mins ago',
  },
  {
    id: 'PB-1041',
    name: 'Phishing Email Triage',
    incident: 'INC-9920',
    status: 'completed',
    owner: 'Analyst-2',
    progress: 100,
    lastUpdated: '2 hours ago',
  },
  {
    id: 'PB-1040',
    name: 'Unauthorized Access Investigation',
    incident: 'INC-9919',
    status: 'active',
    owner: 'Analyst-1',
    progress: 80,
    lastUpdated: '5 hours ago',
  },
];

const statusMeta = (status: MockPlaybook['status']) => {
  switch (status) {
    case 'completed':
      return {
        label: 'Completed',
        className:
          'bg-emerald-500/10 text-emerald-500 border-emerald-500/30',
        icon: CircleCheck,
      };
    case 'active':
      return {
        label: 'Active',
        className:
          'bg-neutral-500/10 text-white border-neutral-500/30',
        icon: Activity,
      };
    default:
      return {
        label: 'Pending',
        className: 'bg-at-surface text-at-muted border-at-border',
        icon: Clock3,
      };
  }
};

const escapeCsv = (value: string) => {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

export default function PlaybookPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<
    'all' | MockPlaybook['status']
  >('all');
  const [selectedPbId, setSelectedPbId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return MOCK_PLAYBOOKS.filter((playbook) => {
      const matchesSearch =
        !query ||
        playbook.name.toLowerCase().includes(query) ||
        playbook.id.toLowerCase().includes(query) ||
        playbook.incident.toLowerCase().includes(query) ||
        playbook.owner.toLowerCase().includes(query);

      const matchesStatus =
        statusFilter === 'all' || playbook.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [search, statusFilter]);

  const selectedPb =
    MOCK_PLAYBOOKS.find((playbook) => playbook.id === selectedPbId) ?? null;

  const exportPlaybooks = () => {
    const header = [
      'id',
      'name',
      'incident',
      'status',
      'owner',
      'progress',
      'last_updated',
    ];

    const rows = filtered.map((playbook) => [
      playbook.id,
      playbook.name,
      playbook.incident,
      playbook.status,
      playbook.owner,
      String(playbook.progress),
      playbook.lastUpdated,
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map(escapeCsv).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = 'antitode-playbooks.csv';
    anchor.click();

    URL.revokeObjectURL(url);
  };

  const table = (
    <div className="min-w-[880px]">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-at-border bg-at-surface/70 sticky top-0 z-10">
            <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest">
              ID
            </th>
            <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest">
              Playbook
            </th>
            <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest">
              Incident
            </th>
            <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest">
              Status
            </th>
            <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest">
              Owner
            </th>
            <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest">
              Progress
            </th>
            <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest">
              Updated
            </th>
          </tr>
        </thead>

        <tbody>
          {filtered.map((playbook) => {
            const isSelected = selectedPbId === playbook.id;
            const meta = statusMeta(playbook.status);
            const StatusIcon = meta.icon;

            return (
              <tr
                key={playbook.id}
                tabIndex={0}
                onClick={() => setSelectedPbId(playbook.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedPbId(playbook.id);
                  }
                }}
                className={`border-b border-at-border/60 cursor-pointer outline-none transition-colors ${isSelected
                    ? 'bg-at-accent/5'
                    : 'hover:bg-white/[0.025] focus:bg-white/[0.025]'
                  }`}
              >
                <td className="px-4 py-4 text-[11px] font-mono text-at-muted">
                  {playbook.id}
                </td>

                <td className="px-4 py-4">
                  <div className="text-[13px] font-medium text-at-text">
                    {playbook.name}
                  </div>
                </td>

                <td className="px-4 py-4">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-at-accent">
                    <ShieldAlert size={11} />
                    {playbook.incident}
                  </span>
                </td>

                <td className="px-4 py-4">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[10px] font-semibold uppercase tracking-wide ${meta.className}`}
                  >
                    <StatusIcon size={10} />
                    {meta.label}
                  </span>
                </td>

                <td className="px-4 py-4">
                  <span className="inline-flex items-center gap-1.5 text-[11px] text-at-text-secondary">
                    <User size={12} className="text-at-muted" />
                    {playbook.owner}
                  </span>
                </td>

                <td className="px-4 py-4">
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-1.5 rounded-full bg-at-subtle overflow-hidden">
                      <div
                        className={`h-full rounded-full ${playbook.progress === 100
                            ? 'bg-emerald-500'
                            : 'bg-at-accent'
                          }`}
                        style={{ width: `${playbook.progress}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-at-muted">
                      {playbook.progress}%
                    </span>
                  </div>
                </td>

                <td className="px-4 py-4 text-[11px] font-mono text-at-muted">
                  {playbook.lastUpdated}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {filtered.length === 0 && (
        <div className="py-16 text-center">
          <div className="mx-auto w-10 h-10 rounded-xl border border-at-border bg-at-surface flex items-center justify-center text-at-muted">
            <Search size={17} />
          </div>

          <div className="mt-3 text-[13px] font-medium text-at-text">
            No playbooks match the current filters
          </div>

          <div className="mt-1 text-[11px] text-at-muted">
            Try another incident, owner, or playbook name.
          </div>
        </div>
      )}
    </div>
  );

  const inspector = selectedPb ? (
    <div className="flex flex-col h-full bg-at-bg">
      <div className="p-5 border-b border-at-border bg-at-surface/30">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl border border-at-border bg-at-bg flex items-center justify-center text-at-text shrink-0">
              <ClipboardList size={17} />
            </div>

            <div className="min-w-0">
              <div className="text-[10px] font-semibold text-at-disabled uppercase tracking-widest">
                {selectedPb.id}
              </div>

              <div className="mt-1 text-[15px] font-semibold text-at-text truncate">
                {selectedPb.name}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedPbId(null)}
            className="w-7 h-7 rounded-md border border-transparent hover:border-at-border hover:bg-at-surface flex items-center justify-center text-at-muted hover:text-at-text"
            aria-label="Close playbook inspector"
          >
            <X size={15} />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span
            className={`at-badge ${statusMeta(selectedPb.status).className}`}
          >
            {statusMeta(selectedPb.status).label}
          </span>

          <span className="at-badge at-badge-neutral font-mono">
            {selectedPb.incident}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
        <section>
          <div className="text-[10px] font-semibold text-at-disabled uppercase tracking-widest mb-2">
            Execution overview
          </div>

          <div className="rounded-xl border border-at-border bg-at-surface/40 p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[11px] text-at-muted">
                  Current progress
                </div>
                <div className="mt-1 text-2xl font-semibold text-at-text tracking-tight">
                  {selectedPb.progress}%
                </div>
              </div>

              <div className="w-12 h-12 rounded-full border border-at-border bg-at-bg flex items-center justify-center text-[11px] font-mono text-at-text">
                {selectedPb.progress}
              </div>
            </div>

            <div className="mt-4 h-2 rounded-full bg-at-subtle overflow-hidden">
              <div
                className={`h-full rounded-full ${selectedPb.progress === 100
                    ? 'bg-emerald-500'
                    : 'bg-at-accent'
                  }`}
                style={{ width: `${selectedPb.progress}%` }}
              />
            </div>

            <div className="mt-2 flex items-center justify-between text-[10px] text-at-muted">
              <span>Execution state</span>
              <span className="capitalize">{selectedPb.status}</span>
            </div>
          </div>
        </section>

        <section>
          <div className="text-[10px] font-semibold text-at-disabled uppercase tracking-widest mb-2">
            Context
          </div>

          <div className="space-y-2">
            <div className="rounded-lg border border-at-border bg-at-surface/30 p-3">
              <div className="text-[10px] text-at-muted">Incident</div>
              <div className="mt-1 flex items-center gap-2 text-[12px] font-mono text-at-text">
                <ShieldAlert size={12} className="text-at-accent" />
                {selectedPb.incident}
              </div>
            </div>

            <div className="rounded-lg border border-at-border bg-at-surface/30 p-3">
              <div className="text-[10px] text-at-muted">Owner</div>
              <div className="mt-1 flex items-center gap-2 text-[12px] text-at-text">
                <User size={12} className="text-at-muted" />
                {selectedPb.owner}
              </div>
            </div>

            <div className="rounded-lg border border-at-border bg-at-surface/30 p-3">
              <div className="text-[10px] text-at-muted">Last updated</div>
              <div className="mt-1 text-[12px] font-mono text-at-text">
                {selectedPb.lastUpdated}
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-semibold text-at-disabled uppercase tracking-widest">
              Execution telemetry
            </div>

            <Activity size={13} className="text-at-muted" />
          </div>

          <div className="rounded-xl border border-dashed border-at-border bg-at-surface/20 p-5">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg border border-at-border bg-at-bg flex items-center justify-center text-at-muted shrink-0">
                <Clock3 size={14} />
              </div>

              <div>
                <div className="text-[12px] font-medium text-at-text">
                  Live workflow steps are not connected
                </div>

                <div className="mt-1 text-[11px] leading-5 text-at-muted">
                  The current data contract exposes playbook metadata and
                  progress, but not the underlying step execution log,
                  timestamps, notes, or action results.
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div className="p-4 border-t border-at-border bg-at-surface/30">
        <div className="text-[10px] leading-5 text-at-muted">
          Workflow mutations and step execution should be handled by the
          connected response backend.
        </div>
      </div>
    </div>
  ) : null;

  return (
    <IntelLayout
      breadcrumbs={[
        { label: 'Detection & Response' },
        { label: 'Playbooks' },
      ]}
      title="Response Playbooks"
      description="Review standardized response workflows and their current execution state."
      headerActions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportPlaybooks}
            className="at-btn at-btn-secondary at-btn-sm"
          >
            <Download size={13} />
            Export
          </button>

          <button
            type="button"
            className="at-btn at-btn-primary at-btn-sm"
            title="Playbook authoring requires a connected persistence workflow."
          >
            <Plus size={13} />
            New Playbook
          </button>
        </div>
      }
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search playbooks, incidents, IDs, or owners..."
      activeFilters={[
        ...(statusFilter !== 'all' ? [`status:${statusFilter}`] : []),
      ]}
      onRemoveFilter={(filter) => {
        if (filter.startsWith('status:')) setStatusFilter('all');
      }}
      resultsCount={filtered.length}
      tableContent={
        <div className="h-full flex flex-col">
          <div className="px-4 py-3 border-b border-at-border bg-at-surface/25">
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(
                  event.target.value as 'all' | MockPlaybook['status'],
                )
              }
              className="at-input h-8 text-[11px] w-auto min-w-[110px]"
              aria-label="Filter playbooks by status"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar">
            {table}
          </div>
        </div>
      }
      inspectorContent={inspector}
      isInspectorOpen={!!selectedPbId}
      onCloseInspector={() => setSelectedPbId(null)}
    />
  );
}