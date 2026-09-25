import {
  useMemo,
  useState,
  type ElementType,
} from 'react';

import {
  Activity,
  ChevronDown,
  Download,
  Filter,
  Info,
  Layers,
  Search,
  Shield,
  Target,
  X,
} from 'lucide-react';

import PageHeader from '../components/layout/PageHeader';

/* -------------------------------------------------------------------------- */
/*                                   Types                                    */
/* -------------------------------------------------------------------------- */

type Coverage =
  | 'high'
  | 'medium'
  | 'low';

interface Technique {
  id: string;
  name: string;
  tactic: string;
  coverage: Coverage;
  ruleCount: number;
}

interface MitreNavigatorPageProps {
  onNavigate?: (id: string) => void;
}

/* -------------------------------------------------------------------------- */
/*                                Constants                                   */
/* -------------------------------------------------------------------------- */

const TACTICS = [
  'Initial Access',
  'Execution',
  'Persistence',
  'Privilege Escalation',
  'Defense Evasion',
  'Credential Access',
  'Discovery',
  'Lateral Movement',
  'Collection',
  'Command and Control',
  'Exfiltration',
  'Impact',
] as const;

/**
 * The current application does not expose a MITRE technique dataset through
 * AppDataContext. Keep the matrix deterministic and local rather than using
 * Math.random() or pretending these values come from an intelligence API.
 *
 * The data contract can be replaced by the real ATT&CK dataset later without
 * changing the UI architecture.
 */
const TECHNIQUE_NAMES = [
  'Technique 01',
  'Technique 02',
  'Technique 03',
  'Technique 04',
  'Technique 05',
  'Technique 06',
  'Technique 07',
  'Technique 08',
  'Technique 09',
  'Technique 10',
  'Technique 11',
  'Technique 12',
  'Technique 13',
  'Technique 14',
  'Technique 15',
  'Technique 16',
  'Technique 17',
  'Technique 18',
  'Technique 19',
  'Technique 20',
  'Technique 21',
  'Technique 22',
  'Technique 23',
  'Technique 24',
  'Technique 25',
  'Technique 26',
  'Technique 27',
  'Technique 28',
  'Technique 29',
  'Technique 30',
  'Technique 31',
  'Technique 32',
  'Technique 33',
  'Technique 34',
  'Technique 35',
  'Technique 36',
  'Technique 37',
  'Technique 38',
  'Technique 39',
  'Technique 40',
  'Technique 41',
  'Technique 42',
  'Technique 43',
  'Technique 44',
  'Technique 45',
  'Technique 46',
  'Technique 47',
  'Technique 48',
  'Technique 49',
  'Technique 50',
  'Technique 51',
  'Technique 52',
  'Technique 53',
  'Technique 54',
  'Technique 55',
  'Technique 56',
  'Technique 57',
  'Technique 58',
  'Technique 59',
  'Technique 60',
];

const COVERAGE_ORDER: Record<
  Coverage,
  number
> = {
  high: 3,
  medium: 2,
  low: 1,
};

const TYPE_ICONS: Record<
  Coverage,
  ElementType
> = {
  high: Shield,
  medium: Activity,
  low: Info,
};

/* -------------------------------------------------------------------------- */
/*                               Dataset                                      */
/* -------------------------------------------------------------------------- */

const TECHNIQUES: Technique[] =
  TECHNIQUE_NAMES.map(
    (name, index) => {
      const coveragePattern =
        (index * 7 + 3) % 10;

      const coverage: Coverage =
        coveragePattern >= 7
          ? 'high'
          : coveragePattern >= 4
            ? 'medium'
            : 'low';

      return {
        id: `T${String(
          index + 1,
        ).padStart(4, '0')}`,
        name,
        tactic:
          TACTICS[
          index % TACTICS.length
          ],
        coverage,
        ruleCount:
          coverage === 'high'
            ? 5 + (index % 4)
            : coverage === 'medium'
              ? 2 + (index % 3)
              : index % 2,
      };
    },
  );

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function escapeCsvValue(
  value: unknown,
): string {
  return `"${String(value ?? '').replace(
    /"/g,
    '""',
  )}"`;
}

function downloadFile(
  filename: string,
  content: string,
  mimeType: string,
): void {
  const blob = new Blob([content], {
    type: mimeType,
  });

  const url =
    URL.createObjectURL(blob);

  const anchor =
    document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);

  URL.revokeObjectURL(url);
}

/* -------------------------------------------------------------------------- */
/*                              Page component                                */
/* -------------------------------------------------------------------------- */

export default function MitreNavigatorPage({
  onNavigate,
}: MitreNavigatorPageProps) {
  /* ------------------------------------------------------------------------ */
  /*                                  State                                   */
  /* ------------------------------------------------------------------------ */

  const [selectedTechId, setSelectedTechId] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState('');

  const [selectedTactic, setSelectedTactic] =
    useState('ALL');

  const [selectedCoverage, setSelectedCoverage] =
    useState<Coverage | 'ALL'>('ALL');

  const [showFilters, setShowFilters] =
    useState(false);

  /* ------------------------------------------------------------------------ */
  /*                             Selected technique                            */
  /* ------------------------------------------------------------------------ */

  const selectedTechnique =
    useMemo(
      () =>
        TECHNIQUES.find(
          (technique) =>
            technique.id ===
            selectedTechId,
        ) ?? null,
      [selectedTechId],
    );

  /* ------------------------------------------------------------------------ */
  /*                                Filtering                                 */
  /* ------------------------------------------------------------------------ */

  const filteredTechniques =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return TECHNIQUES.filter(
        (technique) => {
          if (
            selectedTactic !==
            'ALL' &&
            technique.tactic !==
            selectedTactic
          ) {
            return false;
          }

          if (
            selectedCoverage !==
            'ALL' &&
            technique.coverage !==
            selectedCoverage
          ) {
            return false;
          }

          if (!query) {
            return true;
          }

          return (
            technique.id
              .toLowerCase()
              .includes(query) ||
            technique.name
              .toLowerCase()
              .includes(query) ||
            technique.tactic
              .toLowerCase()
              .includes(query)
          );
        },
      );
    }, [
      search,
      selectedTactic,
      selectedCoverage,
    ]);

  const techniquesByTactic =
    useMemo(() => {
      const result =
        new Map<
          string,
          Technique[]
        >();

      for (const tactic of TACTICS) {
        result.set(
          tactic,
          filteredTechniques.filter(
            (technique) =>
              technique.tactic ===
              tactic,
          ),
        );
      }

      return result;
    }, [filteredTechniques]);

  /* ------------------------------------------------------------------------ */
  /*                                Statistics                                */
  /* ------------------------------------------------------------------------ */

  const coverageCounts =
    useMemo(
      () => ({
        high: TECHNIQUES.filter(
          (technique) =>
            technique.coverage ===
            'high',
        ).length,

        medium: TECHNIQUES.filter(
          (technique) =>
            technique.coverage ===
            'medium',
        ).length,

        low: TECHNIQUES.filter(
          (technique) =>
            technique.coverage ===
            'low',
        ).length,
      }),
      [],
    );

  const matchedCoverageCounts =
    useMemo(
      () => ({
        high: filteredTechniques.filter(
          (technique) =>
            technique.coverage ===
            'high',
        ).length,

        medium:
          filteredTechniques.filter(
            (technique) =>
              technique.coverage ===
              'medium',
          ).length,

        low: filteredTechniques.filter(
          (technique) =>
            technique.coverage ===
            'low',
        ).length,
      }),
      [filteredTechniques],
    );

  const totalRules =
    TECHNIQUES.reduce(
      (sum, technique) =>
        sum + technique.ruleCount,
      0,
    );

  /* ------------------------------------------------------------------------ */
  /*                                 Actions                                  */
  /* ------------------------------------------------------------------------ */

  const clearFilters = () => {
    setSearch('');
    setSelectedTactic('ALL');
    setSelectedCoverage('ALL');
  };

  const handleExport = () => {
    const payload = {
      product: 'ANTITODE',
      view: 'MITRE Navigator',
      exportedAt:
        new Date().toISOString(),
      filters: {
        search,
        tactic: selectedTactic,
        coverage:
          selectedCoverage,
      },
      techniques:
        filteredTechniques,
    };

    downloadFile(
      `antitode-mitre-matrix-${new Date()
        .toISOString()
        .slice(0, 10)}.json`,
      JSON.stringify(
        payload,
        null,
        2,
      ),
      'application/json;charset=utf-8',
    );
  };

  const handleExportCsv = () => {
    const headers = [
      'Technique ID',
      'Technique',
      'Tactic',
      'Coverage',
      'Mapped Rules',
    ];

    const rows =
      filteredTechniques.map(
        (technique) => [
          technique.id,
          technique.name,
          technique.tactic,
          technique.coverage,
          technique.ruleCount,
        ],
      );

    const csv = [
      headers
        .map(escapeCsvValue)
        .join(','),
      ...rows.map((row) =>
        row
          .map(escapeCsvValue)
          .join(','),
      ),
    ].join('\n');

    downloadFile(
      `antitode-mitre-matrix-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`,
      csv,
      'text/csv;charset=utf-8',
    );
  };

  const openRules =
    () => {
      if (onNavigate) {
        onNavigate('rules');
        return;
      }

      /*
       * The current router does not yet pass onNavigate into this page.
       * Avoid hard-coding a browser navigation that could break SPA state.
       */
      const notice =
        document.querySelector(
          '[data-mitre-rules-notice]',
        ) as
        | HTMLElement
        | null;

      if (notice) {
        notice.textContent =
          'Connect the Rules workspace through the page navigation contract.';
      }
    };

  /* ------------------------------------------------------------------------ */
  /*                                Render                                    */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="at-mitre-page">
      <PageHeader
        breadcrumbs={[
          {
            label:
              'Detection & Response',
          },
          {
            label:
              'MITRE Navigator',
          },
        ]}
        title="ATT&CK Navigator"
        description="Visualize technique coverage across the detection surface."
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              className={`at-btn at-btn-ghost at-btn-sm ${showFilters
                  ? 'active'
                  : ''
                }`}
              onClick={() =>
                setShowFilters(
                  (value) =>
                    !value,
                )
              }
            >
              <Filter size={13} />
              Filter View
            </button>

            <button
              type="button"
              className="at-btn at-btn-secondary at-btn-sm"
              onClick={
                handleExport
              }
              disabled={
                filteredTechniques.length ===
                0
              }
            >
              <Download size={13} />
              Export Matrix
            </button>
          </div>
        }
      />

      {/* ================================================================
   
   ================================================================ */}

      <div className="at-mitre-querybar">
        <div className="at-mitre-search">
          <Search size={14} />

          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder="Search technique, tactic, or ID..."
            aria-label="Search MITRE techniques"
            spellCheck={false}
          />

          {search && (
            <button
              type="button"
              onClick={() =>
                setSearch('')
              }
              aria-label="Clear technique search"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <span className="at-mitre-result-count">
          {filteredTechniques.length}{' '}
          of {TECHNIQUES.length}{' '}
          techniques
        </span>

        <div className="at-mitre-query-actions">
          <span>
            High{' '}
            <strong>
              {coverageCounts.high}
            </strong>
          </span>

          <span>
            Medium{' '}
            <strong>
              {coverageCounts.medium}
            </strong>
          </span>

          <span>
            Low{' '}
            <strong>
              {coverageCounts.low}
            </strong>
          </span>
        </div>
      </div>

      {showFilters && (
        <div className="at-mitre-filter-panel">
          <label>
            <span>
              TACTIC
            </span>

            <select
              value={selectedTactic}
              onChange={(event) =>
                setSelectedTactic(
                  event.target.value,
                )
              }
            >
              <option value="ALL">
                All tactics
              </option>

              {TACTICS.map(
                (tactic) => (
                  <option
                    key={tactic}
                    value={tactic}
                  >
                    {tactic}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            <span>
              COVERAGE
            </span>

            <select
              value={
                selectedCoverage
              }
              onChange={(event) =>
                setSelectedCoverage(
                  event.target
                    .value as
                  | Coverage
                  | 'ALL',
                )
              }
            >
              <option value="ALL">
                All coverage
              </option>

              <option value="high">
                High
              </option>

              <option value="medium">
                Medium
              </option>

              <option value="low">
                Low
              </option>
            </select>
          </label>

          <button
            type="button"
            className="at-btn at-btn-ghost at-btn-sm"
            onClick={clearFilters}
          >
            Clear filters
          </button>

          <button
            type="button"
            className="at-btn at-btn-secondary at-btn-sm"
            onClick={
              handleExportCsv
            }
          >
            <Download size={12} />
            CSV
          </button>
        </div>
      )}

      {/* ================================================================
   
   ================================================================ */}

      <div className="at-mitre-workspace">
        {/* ================================================================
   
   ================================================================ */}

        <div className="at-mitre-matrix-wrap custom-scrollbar">
          <div className="at-mitre-matrix">
            {TACTICS.map((tactic) => {
              const tacticsTechs =
                techniquesByTactic.get(
                  tactic,
                ) ?? [];

              return (
                <div
                  key={tactic}
                  className="at-mitre-tactic-column"
                >
                  <div
                    className="at-mitre-tactic-header"
                    title={tactic}
                  >
                    <span>
                      {tactic}
                    </span>

                    <small>
                      {
                        tacticsTechs.length
                      }{' '}
                      techniques
                    </small>
                  </div>

                  {tacticsTechs.length ===
                    0 ? (
                    <div className="at-mitre-column-empty">
                      No matches
                    </div>
                  ) : (
                    tacticsTechs.map(
                      (technique) => {
                        const selected =
                          selectedTechId ===
                          technique.id;

                        const CoverageIcon =
                          TYPE_ICONS[
                          technique.coverage
                          ];

                        return (
                          <button
                            type="button"
                            key={
                              technique.id
                            }
                            className={`at-mitre-technique ${selected
                                ? 'selected'
                                : ''
                              }`}
                            onClick={() =>
                              setSelectedTechId(
                                technique.id,
                              )
                            }
                          >
                            <div className="at-mitre-technique-top">
                              <span>
                                {
                                  technique.id
                                }
                              </span>

                              <CoverageIcon
                                size={11}
                                className={`at-mitre-coverage-icon ${technique.coverage}`}
                                aria-label={`${technique.coverage} coverage`}
                              />
                            </div>

                            <strong
                              title={
                                technique.name
                              }
                            >
                              {
                                technique.name
                              }
                            </strong>

                            <small>
                              {
                                technique.ruleCount
                              }{' '}
                              rules
                            </small>
                          </button>
                        );
                      },
                    )
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ================================================================
   
   ================================================================ */}

        {selectedTechnique && (
          <aside className="at-mitre-inspector">
            <div className="at-mitre-inspector-head">
              <div>
                <span className="at-v2-kicker">
                  ATT&amp;CK TECHNIQUE
                </span>

                <strong>
                  {
                    selectedTechnique.id
                  }
                </strong>

                <small>
                  {
                    selectedTechnique.name
                  }
                </small>
              </div>

              <button
                type="button"
                className="at-mitre-close"
                onClick={() =>
                  setSelectedTechId(
                    null,
                  )
                }
                aria-label="Close technique inspector"
              >
                <X size={14} />
              </button>
            </div>

            <div className="at-mitre-inspector-meta">
              <span>
                {
                  selectedTechnique.tactic
                }
              </span>

              <span
                className={`at-mitre-coverage-badge ${selectedTechnique.coverage}`}
              >
                {
                  selectedTechnique.coverage
                }{' '}
                coverage
              </span>
            </div>

            <div className="at-mitre-inspector-scroll">
              {/* Coverage */}

              <section className="at-mitre-inspector-block">
                <div className="at-mitre-block-title">
                  <span>
                    COVERAGE STATUS
                  </span>

                  <Shield size={12} />
                </div>

                <div className="at-mitre-coverage-card">
                  <span
                    className={`at-mitre-coverage-indicator ${selectedTechnique.coverage}`}
                  >
                    <Activity
                      size={15}
                    />
                  </span>

                  <div>
                    <strong>
                      {selectedTechnique.coverage ===
                        'high'
                        ? 'High Coverage'
                        : selectedTechnique.coverage ===
                          'medium'
                          ? 'Medium Coverage'
                          : 'Low Coverage'}
                    </strong>

                    <small>
                      {
                        selectedTechnique.ruleCount
                      }{' '}
                      mapped detection{' '}
                      {selectedTechnique.ruleCount ===
                        1
                        ? 'rule'
                        : 'rules'}
                      .
                    </small>
                  </div>
                </div>
              </section>

              {/* Technique context */}

              <section className="at-mitre-inspector-block">
                <div className="at-mitre-block-title">
                  <span>
                    TECHNIQUE CONTEXT
                  </span>

                  <Layers size={12} />
                </div>

                <div className="at-mitre-detail-grid">
                  <div>
                    <span>
                      Technique ID
                    </span>

                    <code>
                      {
                        selectedTechnique.id
                      }
                    </code>
                  </div>

                  <div>
                    <span>
                      Tactic
                    </span>

                    <strong>
                      {
                        selectedTechnique.tactic
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Coverage
                    </span>

                    <strong>
                      {
                        selectedTechnique.coverage
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      Rules
                    </span>

                    <strong>
                      {
                        selectedTechnique.ruleCount
                      }
                    </strong>
                  </div>
                </div>
              </section>

              {/* Scope note */}

              <section className="at-mitre-inspector-block">
                <div className="at-mitre-block-title">
                  <span>
                    DATASET STATUS
                  </span>

                  <Info size={12} />
                </div>

                <div className="at-mitre-data-note">
                  <strong>
                    Coverage workspace
                  </strong>

                  <span>
                    Technique metadata and
                    detection counts shown here are
                    provided by the current local
                    navigator dataset. Live ATT&amp;CK
                    enrichment is not connected to
                    this page yet.
                  </span>
                </div>
              </section>
            </div>

            <div className="at-mitre-inspector-footer">
              <button
                type="button"
                className="at-btn at-btn-secondary"
                onClick={
                  openRules
                }
              >
                <Target size={12} />
                View Associated Rules
              </button>

              <button
                type="button"
                className="at-btn at-btn-primary"
                onClick={
                  handleExport
                }
              >
                <Download size={12} />
                Export Technique
              </button>
            </div>

            <span
              data-mitre-rules-notice
              className="sr-only"
              aria-live="polite"
            />
          </aside>
        )}
      </div>

      {/* ================================================================
   
   ================================================================ */}

      <div className="at-mitre-statusbar">
        <span>
          <Activity size={11} />
          Detection coverage
          workspace
        </span>

        <span>
          {
            matchedCoverageCounts.high
          }{' '}
          high ·{' '}
          {
            matchedCoverageCounts.medium
          }{' '}
          medium ·{' '}
          {
            matchedCoverageCounts.low
          }{' '}
          low
        </span>

        <span>
          {totalRules} mapped rules
        </span>
      </div>
    </div>
  );
}