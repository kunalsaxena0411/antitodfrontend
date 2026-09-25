import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Activity,
  ChevronRight,
  Download,
  ExternalLink,
  Filter,
  Info,
  Layers,
  Search,
  Shield,
  Target,
  X,
} from 'lucide-react';

import PageHeader from '../components/layout/PageHeader';
import {
  getMitreMatrix,
  type MitreMatrix,
  type MitreTechnique,
} from '../../services/mitre';

interface MitreNavigatorPageProps {
  onNavigate?: (id: string) => void;
}

type CoverageFilter = 'ALL' | 'SUBTECHNIQUES' | 'TECHNIQUES';

interface TacticSummary {
  slug: string;
  name: string;
  count: number;
}

function escapeCsv(value: unknown): string {
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

  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  anchor.style.display = 'none';

  document.body.appendChild(anchor);
  anchor.click();

  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function shortPlatformList(
  platforms: string[],
): string {
  if (!platforms.length) {
    return 'Platform data unavailable';
  }

  if (platforms.length <= 3) {
    return platforms.join(' · ');
  }

  return `${platforms.slice(0, 3).join(' · ')} +${platforms.length - 3
    }`;
}

function techniqueType(
  technique: MitreTechnique,
): string {
  return technique.isSubTechnique
    ? 'Sub-technique'
    : 'Technique';
}

function normalizeDescription(
  description: string,
): string {
  return description
    .replace(/\s+/g, ' ')
    .trim();
}

export default function MitreNavigatorPage({
  onNavigate,
}: MitreNavigatorPageProps) {
  const [matrix, setMatrix] =
    useState<MitreMatrix | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState('');

  const [selectedTactic, setSelectedTactic] =
    useState('ALL');

  const [typeFilter, setTypeFilter] =
    useState<CoverageFilter>('ALL');

  const [selectedTechniqueId, setSelectedTechniqueId] =
    useState<string | null>(null);

  const [showFilters, setShowFilters] =
    useState(false);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError(null);

        const data =
          await getMitreMatrix();

        if (!mounted) {
          return;
        }

        setMatrix(data);
      } catch (loadError) {
        console.error(
          'MITRE matrix load failed',
          loadError,
        );

        if (!mounted) {
          return;
        }

        setError(
          'Unable to load the MITRE ATT&CK dataset.',
        );
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      mounted = false;
    };
  }, []);

  const allTechniques = useMemo(() => {
    if (!matrix) {
      return [];
    }

    const unique = new Map<
      string,
      MitreTechnique
    >();

    for (const tactic of matrix.tactics) {
      for (const technique of
        matrix.techniques[tactic.slug] ?? []) {
        if (!unique.has(technique.id)) {
          unique.set(
            technique.id,
            technique,
          );
        }
      }
    }

    return Array.from(unique.values()).sort(
      (a, b) =>
        a.name.localeCompare(
          b.name,
        ),
    );
  }, [matrix]);

  const filteredTechniques =
    useMemo(() => {
      const query =
        search.trim().toLowerCase();

      return allTechniques.filter(
        (technique) => {
          if (
            selectedTactic !== 'ALL' &&
            !technique.tactics.includes(
              selectedTactic,
            )
          ) {
            return false;
          }

          if (
            typeFilter ===
            'SUBTECHNIQUES' &&
            !technique.isSubTechnique
          ) {
            return false;
          }

          if (
            typeFilter ===
            'TECHNIQUES' &&
            technique.isSubTechnique
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
            technique.tactics.some(
              (tactic) =>
                tactic
                  .toLowerCase()
                  .includes(query),
            ) ||
            technique.platforms.some(
              (platform) =>
                platform
                  .toLowerCase()
                  .includes(query),
            )
          );
        },
      );
    }, [
      allTechniques,
      search,
      selectedTactic,
      typeFilter,
    ]);

  const filteredByTactic =
    useMemo(() => {
      if (!matrix) {
        return new Map<
          string,
          MitreTechnique[]
        >();
      }

      const result = new Map<
        string,
        MitreTechnique[]
      >();

      for (const tactic of matrix.tactics) {
        result.set(
          tactic.slug,
          filteredTechniques.filter(
            (technique) =>
              technique.tactics.includes(
                tactic.slug,
              ),
          ),
        );
      }

      return result;
    }, [matrix, filteredTechniques]);

  const tacticSummary =
    useMemo<TacticSummary[]>(() => {
      if (!matrix) {
        return [];
      }

      return matrix.tactics.map(
        (tactic) => ({
          slug: tactic.slug,
          name: tactic.name,
          count:
            filteredByTactic.get(
              tactic.slug,
            )?.length ?? 0,
        }),
      );
    }, [
      matrix,
      filteredByTactic,
    ]);

  const selectedTechnique =
    useMemo(() => {
      if (
        !selectedTechniqueId
      ) {
        return null;
      }

      return (
        allTechniques.find(
          (technique) =>
            technique.id ===
            selectedTechniqueId,
        ) ?? null
      );
    }, [
      allTechniques,
      selectedTechniqueId,
    ]);

  const totalSubTechniques =
    allTechniques.filter(
      (technique) =>
        technique.isSubTechnique,
    ).length;

  const totalTechniques =
    allTechniques.length -
    totalSubTechniques;

  const tacticCount =
    matrix?.tactics.length ?? 0;

  const clearFilters = () => {
    setSearch('');
    setSelectedTactic('ALL');
    setTypeFilter('ALL');
  };

  const exportCsv = () => {
    const header = [
      'Technique ID',
      'Technique',
      'Type',
      'Tactics',
      'Platforms',
      'ATT&CK URL',
    ];

    const rows =
      filteredTechniques.map(
        (technique) => [
          technique.id,
          technique.name,
          techniqueType(
            technique,
          ),
          technique.tactics.join('; '),
          technique.platforms.join('; '),
          technique.url ?? '',
        ],
      );

    const csv = [
      header
        .map(escapeCsv)
        .join(','),
      ...rows.map((row) =>
        row.map(escapeCsv).join(','),
      ),
    ].join('\n');

    downloadFile(
      `antitode-attack-matrix-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`,
      csv,
      'text/csv;charset=utf-8',
    );
  };

  const exportJson = () => {
    const payload = {
      product: 'ANTITODE',
      dataset: 'MITRE ATT&CK Enterprise',
      exportedAt:
        new Date().toISOString(),
      filters: {
        search,
        tactic: selectedTactic,
        type: typeFilter,
      },
      techniques:
        filteredTechniques,
    };

    downloadFile(
      `antitode-attack-matrix-${new Date()
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

  return (
    <div className="at-mitre-page-v2">
      <PageHeader
        breadcrumbs={[
          {
            label: 'Detection & Response',
          },
          {
            label: 'MITRE Navigator',
          },
        ]}
        title="ATT&CK Navigator"
        description="Map enterprise ATT&CK techniques by tactic, platform and sub-technique."
        actions={
          <div className="at-mitre-header-actions">
            <button
              type="button"
              className={`at-btn at-btn-secondary at-btn-sm ${showFilters
                  ? 'is-active'
                  : ''
                }`}
              onClick={() =>
                setShowFilters(
                  (value) => !value,
                )
              }
            >
              <Filter size={13} />
              Filters
            </button>

            <button
              type="button"
              className="at-btn at-btn-secondary at-btn-sm"
              onClick={exportCsv}
              disabled={
                loading ||
                filteredTechniques.length ===
                0
              }
            >
              <Download size={13} />
              CSV
            </button>

            <button
              type="button"
              className="at-btn at-btn-secondary at-btn-sm"
              onClick={exportJson}
              disabled={
                loading ||
                filteredTechniques.length ===
                0
              }
            >
              Export JSON
            </button>
          </div>
        }
      />

      <div className="at-mitre-v2-content">
        {/* ================================================================
            Overview
           ================================================================ */}

        <div className="at-mitre-overview">
          <div className="at-mitre-overview-card">
            <span>TACTICS</span>
            <strong>{tacticCount}</strong>
            <small>
              Enterprise attack lifecycle
            </small>
          </div>

          <div className="at-mitre-overview-card">
            <span>TECHNIQUES</span>
            <strong>
              {totalTechniques}
            </strong>
            <small>
              Primary ATT&amp;CK techniques
            </small>
          </div>

          <div className="at-mitre-overview-card">
            <span>SUB-TECHNIQUES</span>
            <strong>
              {totalSubTechniques}
            </strong>
            <small>
              Nested technique coverage
            </small>
          </div>

          <div className="at-mitre-overview-card">
            <span>VISIBLE</span>
            <strong>
              {filteredTechniques.length}
            </strong>
            <small>
              Current filtered dataset
            </small>
          </div>
        </div>

        {/* ================================================================
            Query / filtering
           ================================================================ */}

        <div className="at-mitre-query">
          <div className="at-mitre-query-search">
            <Search size={14} />

            <input
              type="search"
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value,
                )
              }
              placeholder="Search technique, tactic, ID, platform..."
              spellCheck={false}
              aria-label="Search ATT&CK dataset"
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch('')
                }
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <span className="at-mitre-query-count">
            {filteredTechniques.length.toLocaleString()}{' '}
            results
          </span>

          <button
            type="button"
            className="at-mitre-query-filter"
            onClick={() =>
              setShowFilters(
                (value) => !value,
              )
            }
          >
            <Filter size={12} />
            {showFilters
              ? 'Hide filters'
              : 'Filter view'}
          </button>
        </div>

        {showFilters && (
          <div className="at-mitre-filterbar">
            <label>
              <span>TACTIC</span>

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

                {matrix?.tactics.map(
                  (tactic) => (
                    <option
                      key={tactic.slug}
                      value={tactic.slug}
                    >
                      {tactic.name}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label>
              <span>TYPE</span>

              <select
                value={typeFilter}
                onChange={(event) =>
                  setTypeFilter(
                    event.target
                      .value as CoverageFilter,
                  )
                }
              >
                <option value="ALL">
                  All techniques
                </option>

                <option value="TECHNIQUES">
                  Techniques only
                </option>

                <option value="SUBTECHNIQUES">
                  Sub-techniques only
                </option>
              </select>
            </label>

            <button
              type="button"
              className="at-mitre-reset"
              onClick={clearFilters}
            >
              Reset filters
            </button>
          </div>
        )}

        {/* ================================================================
            Main workspace
           ================================================================ */}

        <div className="at-mitre-main">
          <div className="at-mitre-matrix-shell">
            <div className="at-mitre-matrix-header">
              <div>
                <span>
                  ATT&amp;CK ENTERPRISE MATRIX
                </span>

                <strong>
                  Technique coverage by tactic
                </strong>
              </div>

              <span>
                Click a technique to inspect
              </span>
            </div>

            {loading ? (
              <div className="at-mitre-loading">
                <Activity
                  size={20}
                  className="at-spin"
                />

                <strong>
                  Loading ATT&amp;CK dataset
                </strong>

                <span>
                  Retrieving the current
                  enterprise technique matrix.
                </span>
              </div>
            ) : error ? (
              <div className="at-mitre-loading">
                <Info size={20} />

                <strong>
                  {error}
                </strong>

                <span>
                  Refresh the page to retry the
                  dataset request.
                </span>
              </div>
            ) : (
              <div className="at-mitre-matrix-scroll custom-scrollbar">
                <div className="at-mitre-matrix-v2">
                  {matrix?.tactics.map(
                    (tactic) => {
                      const techniques =
                        filteredByTactic.get(
                          tactic.slug,
                        ) ?? [];

                      return (
                        <section
                          key={tactic.slug}
                          className="at-mitre-column"
                        >
                          <header className="at-mitre-column-header">
                            <div>
                              <span>
                                {tactic.name}
                              </span>

                              <small>
                                {techniques.length}{' '}
                                techniques
                              </small>
                            </div>

                            <Target
                              size={13}
                            />
                          </header>

                          <div className="at-mitre-column-list">
                            {techniques.length ===
                              0 ? (
                              <div className="at-mitre-column-empty">
                                No matching techniques
                              </div>
                            ) : (
                              techniques.map(
                                (
                                  technique,
                                ) => {
                                  const selected =
                                    selectedTechniqueId ===
                                    technique.id;

                                  return (
                                    <button
                                      key={
                                        technique.id
                                      }
                                      type="button"
                                      className={`at-mitre-tech-card ${selected
                                          ? 'selected'
                                          : ''
                                        }`}
                                      onClick={() =>
                                        setSelectedTechniqueId(
                                          technique.id,
                                        )
                                      }
                                    >
                                      <div className="at-mitre-tech-top">
                                        <code>
                                          {
                                            technique.id
                                          }
                                        </code>

                                        <span
                                          className={
                                            technique.isSubTechnique
                                              ? 'sub'
                                              : ''
                                          }
                                        >
                                          {
                                            technique.isSubTechnique
                                              ? 'SUB'
                                              : 'T'
                                          }
                                        </span>
                                      </div>

                                      <strong>
                                        {
                                          technique.name
                                        }
                                      </strong>

                                      <small>
                                        {shortPlatformList(
                                          technique.platforms,
                                        )}
                                      </small>

                                      {selected && (
                                        <ChevronRight
                                          size={
                                            12
                                          }
                                          className="at-mitre-card-arrow"
                                        />
                                      )}
                                    </button>
                                  );
                                },
                              )
                            )}
                          </div>
                        </section>
                      );
                    },
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ================================================================
              Inspector
             ================================================================ */}

          {selectedTechnique && (
            <aside className="at-mitre-inspector-v2">
              <div className="at-mitre-inspector-head-v2">
                <div>
                  <span>
                    TECHNIQUE
                  </span>

                  <code>
                    {selectedTechnique.id}
                  </code>

                  <h2>
                    {
                      selectedTechnique.name
                    }
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedTechniqueId(
                      null,
                    )
                  }
                  aria-label="Close technique details"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="at-mitre-inspector-scroll-v2 custom-scrollbar">

                <section className="at-mitre-focus-card">
                  <div>
                    <span>
                      TACTICS
                    </span>

                    <strong>
                      {
                        selectedTechnique.tactics
                          .map(
                            (slug) => {
                              const tactic =
                                matrix?.tactics.find(
                                  (item) =>
                                    item.slug ===
                                    slug,
                                );

                              return (
                                tactic?.name ??
                                slug
                              );
                            },
                          )
                          .join(' · ')
                      }
                    </strong>
                  </div>

                  <div>
                    <span>
                      TYPE
                    </span>

                    <strong>
                      {
                        techniqueType(
                          selectedTechnique,
                        )
                      }
                    </strong>
                  </div>
                </section>

                <section className="at-mitre-inspector-section">
                  <div className="at-mitre-section-title">
                    <span>DESCRIPTION</span>
                    <Info size={12} />
                  </div>

                  <p>
                    {normalizeDescription(
                      selectedTechnique.description,
                    ) ||
                      'No description is available for this technique.'}
                  </p>
                </section>

                <section className="at-mitre-inspector-section">
                  <div className="at-mitre-section-title">
                    <span>PLATFORMS</span>
                    <Layers size={12} />
                  </div>

                  <div className="at-mitre-platforms">
                    {selectedTechnique.platforms.map(
                      (platform) => (
                        <span
                          key={platform}
                        >
                          {platform}
                        </span>
                      ),
                    )}
                  </div>
                </section>

                <section className="at-mitre-inspector-section">
                  <div className="at-mitre-section-title">
                    <span>DATA</span>
                    <Shield size={12} />
                  </div>

                  <div className="at-mitre-detail-list">
                    <div>
                      <span>
                        STIX Object
                      </span>

                      <code>
                        {
                          selectedTechnique.stixId
                        }
                      </code>
                    </div>

                    <div>
                      <span>
                        Sub-technique
                      </span>

                      <strong>
                        {selectedTechnique.isSubTechnique
                          ? 'Yes'
                          : 'No'}
                      </strong>
                    </div>
                  </div>
                </section>

              </div>

              <div className="at-mitre-inspector-actions">
                {selectedTechnique.url && (
                  <a
                    href={
                      selectedTechnique.url
                    }
                    target="_blank"
                    rel="noopener noreferrer"
                    className="at-btn at-btn-secondary"
                  >
                    <ExternalLink
                      size={12}
                    />
                    MITRE ATT&amp;CK
                  </a>
                )}

                {onNavigate && (
                  <button
                    type="button"
                    className="at-btn at-btn-primary"
                    onClick={() =>
                      onNavigate(
                        'rules',
                      )
                    }
                  >
                    <Target size={12} />
                    Detection Rules
                  </button>
                )}
              </div>
            </aside>
          )}
        </div>

        {/* ================================================================
            Tactic summary
           ================================================================ */}

        <div className="at-mitre-tactic-strip">
          {tacticSummary.map(
            (tactic) => (
              <button
                type="button"
                key={tactic.slug}
                onClick={() =>
                  setSelectedTactic(
                    tactic.slug,
                  )
                }
                className={
                  selectedTactic ===
                    tactic.slug
                    ? 'active'
                    : ''
                }
              >
                <span>
                  {tactic.name}
                </span>

                <strong>
                  {tactic.count}
                </strong>
              </button>
            ),
          )}
        </div>
      </div>
    </div>
  );
}