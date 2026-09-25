import { useMemo, useState } from 'react';
import {
  Download,
  Plus,
  FileCode2,
  CheckCircle2,
  CircleAlert,
  ShieldCheck,
  Search,
  X,
  ExternalLink,
} from 'lucide-react';
import IntelLayout from '../components/layout/IntelLayout';

type RuleSeverity = 'critical' | 'high' | 'medium' | 'low';
type RuleStatus = 'active' | 'testing' | 'disabled';
type RuleFormat = 'sigma' | 'yara' | 'snort';
type TestStatus = 'passing' | 'failing' | 'untested';

interface MockRule {
  id: string;
  name: string;
  severity: RuleSeverity;
  status: RuleStatus;
  mitre: string[];
  format: RuleFormat;
  lastModified: string;
  testStatus: TestStatus;
}

const MOCK_RULES: MockRule[] = [
  {
    id: 'RUL-001',
    name: 'Suspicious PowerShell Download',
    severity: 'high',
    status: 'active',
    mitre: ['T1059.001'],
    format: 'sigma',
    lastModified: '2026-09-20',
    testStatus: 'passing',
  },
  {
    id: 'RUL-002',
    name: 'Cobalt Strike Beacon HTTP',
    severity: 'critical',
    status: 'active',
    mitre: ['T1071.001', 'T1573'],
    format: 'snort',
    lastModified: '2026-09-22',
    testStatus: 'passing',
  },
  {
    id: 'RUL-003',
    name: 'Mimikatz Execution Pattern',
    severity: 'critical',
    status: 'testing',
    mitre: ['T1003.001'],
    format: 'sigma',
    lastModified: '2026-09-24',
    testStatus: 'failing',
  },
  {
    id: 'RUL-004',
    name: 'Malicious Office Macro',
    severity: 'medium',
    status: 'active',
    mitre: ['T1059.005'],
    format: 'yara',
    lastModified: '2026-09-15',
    testStatus: 'passing',
  },
  {
    id: 'RUL-005',
    name: 'RDP Brute Force Attempt',
    severity: 'high',
    status: 'disabled',
    mitre: ['T1110.001'],
    format: 'sigma',
    lastModified: '2026-09-10',
    testStatus: 'untested',
  },
];

const severityClass = (severity: RuleSeverity) => {
  switch (severity) {
    case 'critical':
      return 'at-badge-critical';
    case 'high':
      return 'at-badge-high';
    case 'medium':
      return 'at-badge-medium';
    default:
      return 'at-badge-neutral';
  }
};

const statusDotClass = (status: RuleStatus) => {
  switch (status) {
    case 'active':
      return 'bg-emerald-500';
    case 'testing':
      return 'bg-amber-500';
    default:
      return 'bg-at-disabled';
  }
};

const statusTextClass = (status: RuleStatus) => {
  switch (status) {
    case 'active':
      return 'text-emerald-500';
    case 'testing':
      return 'text-amber-500';
    default:
      return 'text-at-muted';
  }
};

const testStatusMeta = (status: TestStatus) => {
  switch (status) {
    case 'passing':
      return {
        label: 'Passing',
        className: 'text-emerald-500',
        icon: CheckCircle2,
      };
    case 'failing':
      return {
        label: 'Failing',
        className: 'text-at-accent',
        icon: CircleAlert,
      };
    default:
      return {
        label: 'Untested',
        className: 'text-at-muted',
        icon: ShieldCheck,
      };
  }
};

const escapeCsv = (value: string) => {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

export default function RulesPage() {
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState<'all' | RuleSeverity>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | RuleStatus>('all');
  const [formatFilter, setFormatFilter] = useState<'all' | RuleFormat>('all');
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return MOCK_RULES.filter((rule) => {
      const matchesSearch =
        !query ||
        rule.name.toLowerCase().includes(query) ||
        rule.id.toLowerCase().includes(query) ||
        rule.format.includes(query) ||
        rule.mitre.some((technique) => technique.toLowerCase().includes(query));

      const matchesSeverity =
        severityFilter === 'all' || rule.severity === severityFilter;

      const matchesStatus =
        statusFilter === 'all' || rule.status === statusFilter;

      const matchesFormat =
        formatFilter === 'all' || rule.format === formatFilter;

      return matchesSearch && matchesSeverity && matchesStatus && matchesFormat;
    });
  }, [search, severityFilter, statusFilter, formatFilter]);

  const selectedRule =
    MOCK_RULES.find((rule) => rule.id === selectedRuleId) ?? null;

  const exportRules = () => {
    const header = [
      'id',
      'name',
      'severity',
      'status',
      'format',
      'mitre',
      'test_status',
      'last_modified',
    ];

    const rows = filtered.map((rule) => [
      rule.id,
      rule.name,
      rule.severity,
      rule.status,
      rule.format,
      rule.mitre.join('|'),
      rule.testStatus,
      rule.lastModified,
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map((value) => escapeCsv(value)).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');

    anchor.href = url;
    anchor.download = 'antitode-detection-rules.csv';
    anchor.click();

    URL.revokeObjectURL(url);
  };

  const activeFilterCount =
    (severityFilter !== 'all' ? 1 : 0) +
    (statusFilter !== 'all' ? 1 : 0) +
    (formatFilter !== 'all' ? 1 : 0);

  const clearFilters = () => {
    setSeverityFilter('all');
    setStatusFilter('all');
    setFormatFilter('all');
  };

  const table = (
    <div className="min-w-[860px]">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-at-border bg-at-surface/70 sticky top-0 z-10">
            <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest">
              Format
            </th>
            <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest">
              Rule
            </th>
            <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest">
              Severity
            </th>
            <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest">
              Status
            </th>
            <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest">
              MITRE
            </th>
            <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest">
              Validation
            </th>
            <th className="px-4 py-3 text-[10px] font-semibold text-at-disabled uppercase tracking-widest text-right">
              Modified
            </th>
          </tr>
        </thead>

        <tbody>
          {filtered.map((rule) => {
            const isSelected = selectedRuleId === rule.id;
            const testMeta = testStatusMeta(rule.testStatus);
            const TestIcon = testMeta.icon;

            return (
              <tr
                key={rule.id}
                tabIndex={0}
                onClick={() => setSelectedRuleId(rule.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setSelectedRuleId(rule.id);
                  }
                }}
                className={`border-b border-at-border/60 cursor-pointer outline-none transition-colors ${isSelected
                    ? 'bg-at-accent/5'
                    : 'hover:bg-white/[0.025] focus:bg-white/[0.025]'
                  }`}
              >
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center gap-2">
                    <span className="w-7 h-7 rounded-md border border-at-border bg-at-bg flex items-center justify-center text-at-muted">
                      <FileCode2 size={13} />
                    </span>
                    <span className="text-[10px] font-mono font-semibold uppercase text-at-text-secondary">
                      {rule.format}
                    </span>
                  </span>
                </td>

                <td className="px-4 py-3.5">
                  <div className="font-medium text-[12px] text-at-text">
                    {rule.name}
                  </div>
                  <div className="mt-0.5 text-[10px] font-mono text-at-muted">
                    {rule.id}
                  </div>
                </td>

                <td className="px-4 py-3.5">
                  <span className={`at-badge ${severityClass(rule.severity)}`}>
                    {rule.severity}
                  </span>
                </td>

                <td className="px-4 py-3.5">
                  <div
                    className={`flex items-center gap-2 text-[11px] ${statusTextClass(
                      rule.status,
                    )}`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${statusDotClass(
                        rule.status,
                      )}`}
                    />
                    <span className="capitalize">{rule.status}</span>
                  </div>
                </td>

                <td className="px-4 py-3.5">
                  <div className="flex flex-wrap gap-1">
                    {rule.mitre.map((technique) => (
                      <span
                        key={technique}
                        className="px-1.5 py-1 rounded border border-at-border bg-at-bg text-[10px] font-mono text-at-text-secondary"
                      >
                        {technique}
                      </span>
                    ))}
                  </div>
                </td>

                <td className="px-4 py-3.5">
                  <span
                    className={`inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider ${testMeta.className}`}
                  >
                    <TestIcon size={11} />
                    {testMeta.label}
                  </span>
                </td>

                <td className="px-4 py-3.5 text-right text-[11px] font-mono text-at-muted">
                  {rule.lastModified}
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
            No rules match the current query
          </div>
          <div className="mt-1 text-[11px] text-at-muted">
            Clear the search or adjust the active filters.
          </div>
        </div>
      )}
    </div>
  );

  const inspector = selectedRule ? (
    <div className="flex h-full flex-col bg-at-bg">
      <div className="border-b border-at-border px-5 py-4 bg-at-surface/35">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg border border-at-border bg-at-bg flex items-center justify-center text-at-text shrink-0">
              <FileCode2 size={15} />
            </div>

            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-at-text truncate">
                {selectedRule.name}
              </div>
              <div className="mt-1 text-[10px] font-mono text-at-muted">
                {selectedRule.id}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setSelectedRuleId(null)}
            className="w-7 h-7 rounded-md border border-transparent hover:border-at-border hover:bg-at-surface flex items-center justify-center text-at-muted hover:text-at-text transition-colors"
            aria-label="Close rule inspector"
          >
            <X size={15} />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className={`at-badge ${severityClass(selectedRule.severity)}`}>
            {selectedRule.severity}
          </span>
          <span className="at-badge at-badge-neutral uppercase">
            {selectedRule.format}
          </span>
          <span className="at-badge at-badge-neutral capitalize">
            {selectedRule.status}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
        <section>
          <div className="text-[10px] font-semibold text-at-disabled uppercase tracking-widest mb-2">
            Detection metadata
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-at-border bg-at-surface/40 p-3">
              <div className="text-[10px] text-at-muted">Validation</div>
              <div className="mt-1 text-[12px] font-medium text-at-text capitalize">
                {selectedRule.testStatus}
              </div>
            </div>

            <div className="rounded-lg border border-at-border bg-at-surface/40 p-3">
              <div className="text-[10px] text-at-muted">Last modified</div>
              <div className="mt-1 text-[12px] font-mono text-at-text">
                {selectedRule.lastModified}
              </div>
            </div>
          </div>
        </section>

        <section>
          <div className="text-[10px] font-semibold text-at-disabled uppercase tracking-widest mb-2">
            ATT&CK mapping
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedRule.mitre.map((technique) => (
              <span
                key={technique}
                className="px-2 py-1.5 rounded-md border border-at-border bg-at-surface/50 text-[10px] font-mono text-at-text-secondary"
              >
                {technique}
              </span>
            ))}
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-semibold text-at-disabled uppercase tracking-widest">
              Definition
            </div>
            <span className="text-[10px] text-at-muted">
              Source definition unavailable
            </span>
          </div>

          <div className="rounded-xl border border-at-border bg-[#090909] overflow-hidden">
            <div className="px-3 py-2 border-b border-at-border flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-at-disabled" />
              <span className="text-[10px] font-mono text-at-muted">
                {selectedRule.format.toUpperCase()}
              </span>
            </div>

            <div className="p-4 font-mono text-[11px] leading-6 text-at-text-secondary whitespace-pre-wrap">
              {`rule:
  id: ${selectedRule.id}
  name: ${selectedRule.name}
  severity: ${selectedRule.severity}
  status: ${selectedRule.status}
  format: ${selectedRule.format}
  mitre:
${selectedRule.mitre.map((id) => `    - ${id}`).join('\n')}

validation:
  status: ${selectedRule.testStatus}

note:
  The connected rule-definition payload is not available in
  this workspace, so the original detection body is not
  represented here.`}
            </div>
          </div>
        </section>
      </div>

      <div className="border-t border-at-border px-4 py-3 bg-at-surface/35">
        <div className="flex items-center gap-2 text-[10px] text-at-muted">
          <ShieldCheck size={12} />
          Rule execution and persistence are not connected to this workspace.
        </div>
      </div>
    </div>
  ) : null;

  return (
    <IntelLayout
      breadcrumbs={[
        { label: 'Detection & Response' },
        { label: 'Rules' },
      ]}
      title="Detection Engineering"
      description="Manage and review detection coverage across the environment."
      headerActions={
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={exportRules}
            className="at-btn at-btn-secondary at-btn-sm"
          >
            <Download size={13} />
            Export
          </button>

          <button
            type="button"
            className="at-btn at-btn-primary at-btn-sm"
            title="Rule authoring requires a connected persistence workflow."
          >
            <Plus size={13} />
            New Rule
          </button>
        </div>
      }
      searchValue={search}
      onSearchChange={setSearch}
      searchPlaceholder="Search rules, IDs, formats, or MITRE IDs..."
      activeFilters={[
        ...(severityFilter !== 'all' ? [`severity:${severityFilter}`] : []),
        ...(statusFilter !== 'all' ? [`status:${statusFilter}`] : []),
        ...(formatFilter !== 'all' ? [`format:${formatFilter}`] : []),
      ]}
      onRemoveFilter={(filter) => {
        if (filter.startsWith('severity:')) setSeverityFilter('all');
        if (filter.startsWith('status:')) setStatusFilter('all');
        if (filter.startsWith('format:')) setFormatFilter('all');
      }}
      resultsCount={filtered.length}
      tableContent={
        <div className="h-full flex flex-col">
          <div className="px-4 py-3 border-b border-at-border bg-at-surface/25 flex flex-wrap items-center gap-2">
            <select
              value={severityFilter}
              onChange={(event) =>
                setSeverityFilter(
                  event.target.value as 'all' | RuleSeverity,
                )
              }
              className="at-input h-8 text-[11px] w-auto min-w-[110px]"
              aria-label="Filter by severity"
            >
              <option value="all">All severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as 'all' | RuleStatus)
              }
              className="at-input h-8 text-[11px] w-auto min-w-[110px]"
              aria-label="Filter by status"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="testing">Testing</option>
              <option value="disabled">Disabled</option>
            </select>

            <select
              value={formatFilter}
              onChange={(event) =>
                setFormatFilter(event.target.value as 'all' | RuleFormat)
              }
              className="at-input h-8 text-[11px] w-auto min-w-[100px]"
              aria-label="Filter by format"
            >
              <option value="all">All formats</option>
              <option value="sigma">Sigma</option>
              <option value="yara">YARA</option>
              <option value="snort">Snort</option>
            </select>

            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="at-btn at-btn-ghost at-btn-sm"
              >
                <X size={12} />
                Clear filters
              </button>
            )}
          </div>

          <div className="flex-1 overflow-auto custom-scrollbar">
            {table}
          </div>
        </div>
      }
      inspectorContent={inspector}
      isInspectorOpen={!!selectedRuleId}
      onCloseInspector={() => setSelectedRuleId(null)}
    />
  );
}