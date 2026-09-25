import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from 'react';

import {
  Activity,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleX,
  Crosshair,
  Download,
  FileText,
  MapPin,
  Search,
  ShieldAlert,
  SlidersHorizontal,
  Users,
  X,
} from 'lucide-react';

import { useAppData } from '../contexts/AppDataContext';
import PageHeader from '../components/layout/PageHeader';

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function formatDate(value: string | undefined): string {
  if (!value) {
    return 'Unknown';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  });
}

function escapeCsvValue(value: unknown): string {
  const normalized = String(value ?? '');
  return `"${normalized.replace(/"/g, '""')}"`;
}

function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>,
): void {
  const csv = [
    headers.map(escapeCsvValue).join(','),
    ...rows.map((row) => row.map(escapeCsvValue).join(',')),
  ].join('\n');

  const blob = new Blob([csv], {
    type: 'text/csv;charset=utf-8;',
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

/* -------------------------------------------------------------------------- */
/*                              Page component                                */
/* -------------------------------------------------------------------------- */

export default function ActorsPage() {
  const { MOCK_ACTORS } = useAppData();

  /* ------------------------------------------------------------------------ */
  /*                                 State                                    */
  /* ------------------------------------------------------------------------ */

  const [search, setSearch] = useState('');
  const [advancedMode, setAdvancedMode] = useState(false);

  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedMotivation, setSelectedMotivation] = useState('');

  const [selectedActorId, setSelectedActorId] = useState<string | null>(
    null,
  );

  const [inspectorTab, setInspectorTab] = useState<
    'Profile' | 'TTPs' | 'Campaigns'
  >('Profile');

  const [showFilterMenu, setShowFilterMenu] = useState(false);

  /* ------------------------------------------------------------------------ */
  /*                          Derived filter options                           */
  /* ------------------------------------------------------------------------ */

  const countryOptions = useMemo(() => {
    return Array.from(
      new Set(
        MOCK_ACTORS
          .map((actor) => actor.country)
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [MOCK_ACTORS]);

  const motivationOptions = useMemo(() => {
    return Array.from(
      new Set(
        MOCK_ACTORS
          .map((actor) => actor.motivation)
          .filter(Boolean),
      ),
    ).sort((a, b) => a.localeCompare(b));
  }, [MOCK_ACTORS]);

  /* ------------------------------------------------------------------------ */
  /*                              Active filters                              */
  /* ------------------------------------------------------------------------ */

  const activeFilters = useMemo(() => {
    const filters: string[] = [];

    if (selectedCountry) {
      filters.push(`Origin: ${selectedCountry}`);
    }

    if (selectedMotivation) {
      filters.push(`Motivation: ${selectedMotivation}`);
    }

    return filters;
  }, [selectedCountry, selectedMotivation]);

  /* ------------------------------------------------------------------------ */
  /*                            Selected actor                                */
  /* ------------------------------------------------------------------------ */

  const selectedActor = useMemo(() => {
    if (!selectedActorId) {
      return null;
    }

    return (
      MOCK_ACTORS.find((actor) => actor.id === selectedActorId) ?? null
    );
  }, [MOCK_ACTORS, selectedActorId]);

  /* ------------------------------------------------------------------------ */
  /*                              Filtered data                               */
  /* ------------------------------------------------------------------------ */

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return MOCK_ACTORS.filter((actor) => {
      if (query) {
        const matchesText =
          actor.name.toLowerCase().includes(query) ||
          actor.id.toLowerCase().includes(query) ||
          actor.country.toLowerCase().includes(query) ||
          actor.motivation.toLowerCase().includes(query) ||
          actor.aliases.some((alias) =>
            alias.toLowerCase().includes(query),
          ) ||
          actor.targets.some((target) =>
            target.toLowerCase().includes(query),
          ) ||
          actor.ttps.some((ttp) =>
            ttp.toLowerCase().includes(query),
          );

        if (!matchesText) {
          return false;
        }
      }

      if (
        selectedCountry &&
        actor.country !== selectedCountry
      ) {
        return false;
      }

      if (
        selectedMotivation &&
        actor.motivation !== selectedMotivation
      ) {
        return false;
      }

      return true;
    });
  }, [
    MOCK_ACTORS,
    search,
    selectedCountry,
    selectedMotivation,
  ]);

  /* ------------------------------------------------------------------------ */
  /*                               Statistics                                 */
  /* ------------------------------------------------------------------------ */

  const countryCounts = useMemo(() => {
    return MOCK_ACTORS.reduce<Record<string, number>>(
      (result, actor) => {
        result[actor.country] =
          (result[actor.country] ?? 0) + 1;

        return result;
      },
      {},
    );
  }, [MOCK_ACTORS]);

  const motivationCounts = useMemo(() => {
    return MOCK_ACTORS.reduce<Record<string, number>>(
      (result, actor) => {
        result[actor.motivation] =
          (result[actor.motivation] ?? 0) + 1;

        return result;
      },
      {},
    );
  }, [MOCK_ACTORS]);

  const targetSectorCount = useMemo(() => {
    return new Set(
      MOCK_ACTORS.flatMap((actor) => actor.targets),
    ).size;
  }, [MOCK_ACTORS]);

  const techniqueCount = useMemo(() => {
    return new Set(
      MOCK_ACTORS.flatMap((actor) => actor.ttps),
    ).size;
  }, [MOCK_ACTORS]);

  /* ------------------------------------------------------------------------ */
  /*                           Filter operations                              */
  /* ------------------------------------------------------------------------ */

  const removeFilter = (filter: string) => {
    if (filter.startsWith('Origin: ')) {
      setSelectedCountry('');
    }

    if (filter.startsWith('Motivation: ')) {
      setSelectedMotivation('');
    }
  };

  const clearFilters = () => {
    setSearch('');
    setSelectedCountry('');
    setSelectedMotivation('');
    setShowFilterMenu(false);
  };

  const clearSearch = () => {
    setSearch('');
  };

  const toggleAdvancedMode = () => {
    setAdvancedMode((current) => !current);
  };

  /* ------------------------------------------------------------------------ */
  /*                             Inspector                                    */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!selectedActorId) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedActorId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedActorId]);

  useEffect(() => {
    if (
      selectedActorId &&
      !MOCK_ACTORS.some(
        (actor) => actor.id === selectedActorId,
      )
    ) {
      setSelectedActorId(null);
    }
  }, [MOCK_ACTORS, selectedActorId]);

  /* ------------------------------------------------------------------------ */
  /*                               Export                                     */
  /* ------------------------------------------------------------------------ */

  const handleExport = () => {
    const rows = filtered.map((actor) => [
      actor.id,
      actor.name,
      actor.aliases.join(' | '),
      actor.country,
      actor.motivation,
      actor.targets.join(' | '),
      actor.ttps.join(' | '),
      actor.firstSeen,
      actor.lastSeen,
    ]);

    downloadCsv(
      `antitode-threat-actors-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`,
      [
        'Actor ID',
        'Name',
        'Aliases',
        'Origin',
        'Motivation',
        'Target Sectors',
        'ATT&CK Techniques',
        'First Tracked',
        'Last Active',
      ],
      rows,
    );
  };

  /* ------------------------------------------------------------------------ */
  /*                           Search handler                                 */
  /* ------------------------------------------------------------------------ */

  const handleSearchChange = (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    setSearch(event.target.value);
  };

  /* ------------------------------------------------------------------------ */
  /*                                  Render                                  */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="at-actors-page">
      {/* ================================================================== */
      /* PAGE HEADER                                                         */
      /* ================================================================== */}

      <PageHeader
        breadcrumbs={[
          {
            label: 'Intelligence',
          },
          {
            label: 'Actors',
          },
        ]}
        title="Threat Actors"
        description="Dossiers and profiles on state-sponsored, financial, and hacktivist groups."
        actions={
          <button
            type="button"
            className="at-btn at-btn-secondary at-btn-sm"
            onClick={handleExport}
            title={`Export ${filtered.length} visible actor profiles`}
          >
            <Download size={13} />
            Export
          </button>
        }
      />

      {/* ================================================================== */
      /* SUMMARY                                                             */
      /* ================================================================== */}

      <section className="at-actors-summary">
        <div className="at-actors-summary-total">
          <span className="at-v2-kicker">
            THREAT ACTOR REPOSITORY
          </span>

          <div>
            <strong>{MOCK_ACTORS.length}</strong>

            <span>tracked actor profiles</span>
          </div>
        </div>

        <div className="at-actors-summary-stat">
          <span className="at-actors-summary-stat-icon">
            <MapPin size={14} />
          </span>

          <div>
            <strong>
              {Object.keys(countryCounts).length}
            </strong>

            <small>origin countries</small>
          </div>
        </div>

        <div className="at-actors-summary-stat">
          <span className="at-actors-summary-stat-icon">
            <Crosshair size={14} />
          </span>

          <div>
            <strong>{targetSectorCount}</strong>

            <small>target sectors</small>
          </div>
        </div>

        <div className="at-actors-summary-stat">
          <span className="at-actors-summary-stat-icon">
            <Activity size={14} />
          </span>

          <div>
            <strong>{techniqueCount}</strong>

            <small>ATT&amp;CK mappings</small>
          </div>
        </div>

        <div className="at-actors-summary-motivation">
          <span className="at-actors-summary-motivation-label">
            MOTIVATION
          </span>

          <div>
            {Object.entries(motivationCounts).map(
              ([motivation, count]) => (
                <span key={motivation}>
                  {motivation}
                  <b>{count}</b>
                </span>
              ),
            )}
          </div>
        </div>
      </section>

      {/* ================================================================== */
      /* QUERY / FILTER BAR                                                  */
      /* ================================================================== */}

      <section className="at-actors-query">
        <div className="at-actors-query-main">
          <div
            className={`at-actors-search ${advancedMode ? 'advanced' : ''
              }`}
          >
            <Search size={14} />

            <input
              type="search"
              value={search}
              onChange={handleSearchChange}
              placeholder={
                advancedMode
                  ? 'Search by actor, alias, country, sector, or ATT&CK technique...'
                  : 'Search actor name or aliases...'
              }
              aria-label="Search threat actors"
              spellCheck={false}
            />

            {search && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label="Clear actor search"
                className="at-icon-button"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            type="button"
            className={`at-actors-advanced ${advancedMode ? 'active' : ''
              }`}
            onClick={toggleAdvancedMode}
            aria-pressed={advancedMode}
          >
            <Activity size={13} />
            Advanced
          </button>

          <button
            type="button"
            className={`at-actors-filter-placeholder ${showFilterMenu ? 'active' : ''
              }`}
            onClick={() =>
              setShowFilterMenu((current) => !current)
            }
            aria-expanded={showFilterMenu}
            aria-haspopup="true"
          >
            <SlidersHorizontal size={13} />
            Filter
            <ChevronDown
              size={12}
              className={
                showFilterMenu ? 'rotate-180' : ''
              }
            />
          </button>

          <span className="at-actors-result-count">
            {filtered.length}{' '}
            {filtered.length === 1 ? 'result' : 'results'}
          </span>
        </div>

        {showFilterMenu && (
          <div
            className="at-actors-filter-panel"
            role="region"
            aria-label="Actor filters"
          >
            <div className="at-actors-filter-control">
              <label htmlFor="actor-origin-filter">
                Origin
              </label>

              <select
                id="actor-origin-filter"
                value={selectedCountry}
                onChange={(event) =>
                  setSelectedCountry(event.target.value)
                }
              >
                <option value="">All origins</option>

                {countryOptions.map((country) => (
                  <option
                    key={country}
                    value={country}
                  >
                    {country}
                  </option>
                ))}
              </select>
            </div>

            <div className="at-actors-filter-control">
              <label htmlFor="actor-motivation-filter">
                Motivation
              </label>

              <select
                id="actor-motivation-filter"
                value={selectedMotivation}
                onChange={(event) =>
                  setSelectedMotivation(event.target.value)
                }
              >
                <option value="">
                  All motivations
                </option>

                {motivationOptions.map(
                  (motivation) => (
                    <option
                      key={motivation}
                      value={motivation}
                    >
                      {motivation}
                    </option>
                  ),
                )}
              </select>
            </div>

            <button
              type="button"
              className="at-btn at-btn-ghost at-btn-sm"
              onClick={clearFilters}
            >
              Clear filters
            </button>
          </div>
        )}

        <div className="at-actors-filter-row">
          <span className="at-actors-filter-label">
            ACTIVE FILTERS
          </span>

          {activeFilters.length === 0 ? (
            <span className="at-actors-filter-empty">
              No filters applied
            </span>
          ) : (
            activeFilters.map((filter) => (
              <span
                className="at-actors-filter-chip"
                key={filter}
              >
                {filter}

                <button
                  type="button"
                  onClick={() =>
                    removeFilter(filter)
                  }
                  aria-label={`Remove ${filter}`}
                >
                  <X size={10} />
                </button>
              </span>
            ))
          )}

          {activeFilters.length > 0 && (
            <button
              type="button"
              className="at-actors-clear"
              onClick={clearFilters}
            >
              <CircleX size={12} />
              Clear
            </button>
          )}

          <button
            type="button"
            className="at-actors-filter-placeholder"
            onClick={() =>
              setShowFilterMenu(true)
            }
          >
            + Filter
          </button>
        </div>
      </section>

      {/* ================================================================== */
      /* WORKSPACE                                                           */
      /* ================================================================== */}

      <div className="at-actors-workspace">
        {/* ================================================================ */
        /* ACTOR LIST                                                        */
        /* ================================================================ */}

        <section className="at-actors-list">
          <div className="at-actors-list-head">
            <div>
              <span className="at-v2-kicker">
                THREAT INTELLIGENCE
              </span>

              <h2>Actor profiles</h2>
            </div>

            <span className="at-actors-list-count">
              Showing{' '}
              <strong>{filtered.length}</strong>
              {filtered.length !==
                MOCK_ACTORS.length && (
                  <>
                    {' '}
                    of {MOCK_ACTORS.length}
                  </>
                )}
            </span>
          </div>

          <div className="at-actors-table-wrap">
            <table className="at-actors-table">
              <thead>
                <tr>
                  <th>Designation</th>
                  <th>Aliases</th>
                  <th>Origin</th>
                  <th>Motivation</th>
                  <th>Targets</th>
                  <th>Activity</th>
                  <th aria-label="Open actor" />
                </tr>
              </thead>

              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="at-actors-empty"
                    >
                      <Users size={21} />

                      <strong>No actors found</strong>

                      <span>
                        No threat actor matches the
                        current search or filters.
                      </span>

                      <button
                        type="button"
                        onClick={clearFilters}
                      >
                        Clear search &amp; filters
                      </button>
                    </td>
                  </tr>
                ) : (
                  filtered.map((actor) => {
                    const selected =
                      selectedActorId === actor.id;

                    return (
                      <tr
                        key={actor.id}
                        className={
                          selected ? 'active' : ''
                        }
                        tabIndex={0}
                        aria-selected={selected}
                        onClick={() =>
                          setSelectedActorId(
                            actor.id,
                          )
                        }
                        onKeyDown={(event) => {
                          if (
                            event.key === 'Enter' ||
                            event.key === ' '
                          ) {
                            event.preventDefault();

                            setSelectedActorId(
                              actor.id,
                            );
                          }
                        }}
                      >
                        <td>
                          <div className="at-actors-designation">
                            <span
                              className={`at-actors-actor-icon ${selected
                                  ? 'active'
                                  : ''
                                }`}
                            >
                              <Users size={12} />
                            </span>

                            <div>
                              <button
                                type="button"
                                className="at-actors-name"
                                onClick={(event) => {
                                  event.stopPropagation();

                                  setSelectedActorId(
                                    actor.id,
                                  );
                                }}
                              >
                                {actor.name}
                              </button>

                              <span>{actor.id}</span>
                            </div>
                          </div>
                        </td>

                        <td>
                          <div className="at-actors-aliases">
                            {(actor.aliases || [])
                              .slice(0, 3)
                              .map(
                                (alias, index) => (
                                  <span
                                    key={`${alias}-${index}`}
                                  >
                                    {alias}
                                  </span>
                                ),
                              )}

                            {(actor.aliases?.length || 0) >
                              3 && (
                                <span>
                                  +
                                  {(actor.aliases?.length || 0) -
                                    3}
                                </span>
                              )}
                          </div>
                        </td>

                        <td>
                          <span className="at-actors-origin">
                            <MapPin size={11} />
                            {actor.country}
                          </span>
                        </td>

                        <td>
                          <span className="at-actors-motivation">
                            {actor.motivation}
                          </span>
                        </td>

                        <td>
                          <div className="at-actors-targets">
                            {(actor.targets || [])
                              .slice(0, 2)
                              .map((target) => (
                                <span key={target}>
                                  {target}
                                </span>
                              ))}

                            {(actor.targets?.length || 0) >
                              2 && (
                                <span>
                                  +
                                  {(actor.targets?.length || 0) -
                                    2}
                                </span>
                              )}
                          </div>
                        </td>

                        <td>
                          <div className="at-actors-activity">
                            <span>
                              {actor.ttps?.length || 0}{' '}
                              TTP
                              {(actor.ttps?.length || 0) ===
                                1
                                ? ''
                                : 's'}
                            </span>

                            <small>
                              {actor.targets?.length || 0}{' '}
                              {(actor.targets?.length || 0) ===
                                1
                                ? 'sector'
                                : 'sectors'}
                            </small>
                          </div>
                        </td>

                        <td>
                          <ChevronRight
                            size={13}
                            className="at-actors-row-arrow"
                            aria-hidden="true"
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ================================================================ */
        /* INSPECTOR                                                         */
        /* ================================================================ */}

        {selectedActor && (
          <aside
            className="at-actors-inspector"
            aria-label={`Actor details for ${selectedActor.name}`}
          >
            {/* Header */}

            <div className="at-actors-inspector-head">
              <div className="at-actors-identity">
                <span className="at-actors-identity-icon">
                  <Users size={21} />
                </span>

                <div>
                  <span>THREAT ACTOR</span>

                  <strong>
                    {selectedActor.name}
                  </strong>

                  <small>
                    {(selectedActor.aliases?.length || 0) > 0
                      ? (selectedActor.aliases || []).join(
                        ' · ',
                      )
                      : 'No aliases recorded'}
                  </small>
                </div>
              </div>

              <button
                type="button"
                className="at-actors-close"
                onClick={() =>
                  setSelectedActorId(null)
                }
                aria-label="Close actor inspector"
                title="Close inspector"
              >
                <X size={15} />
              </button>
            </div>

            {/* Meta */}

            <div className="at-actors-inspector-meta">
              <span className="at-actors-motivation-badge">
                <ShieldAlert size={10} />
                {selectedActor.motivation}
              </span>

              <span className="at-actors-country-badge">
                <MapPin size={10} />
                {selectedActor.country}
              </span>
            </div>

            {/* Tabs */}

            <div
              className="at-actors-tabs"
              role="tablist"
              aria-label="Actor details"
            >
              {(
                [
                  'Profile',
                  'TTPs',
                  'Campaigns',
                ] as const
              ).map((tab) => {
                const isActive =
                  inspectorTab === tab;

                return (
                  <button
                    type="button"
                    key={tab}
                    className={
                      isActive ? 'active' : ''
                    }
                    onClick={() =>
                      setInspectorTab(tab)
                    }
                    role="tab"
                    aria-selected={isActive}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>

            {/* Content */}

            <div className="at-actors-inspector-scroll">
              {inspectorTab === 'Profile' && (
                <div className="at-actors-inspector-content">
                  {/* Observation */}

                  <section className="at-actors-inspector-block">
                    <div className="at-actors-block-title">
                      <span>OBSERVATION</span>
                      <Activity size={12} />
                    </div>

                    <div className="at-actors-observation">
                      <div>
                        <span>First Tracked</span>

                        <code>
                          {formatDate(
                            selectedActor.firstSeen,
                          )}
                        </code>
                      </div>

                      <div>
                        <span>Last Active</span>

                        <code>
                          {formatDate(
                            selectedActor.lastSeen,
                          )}
                        </code>
                      </div>
                    </div>
                  </section>

                  {/* Target sectors */}

                  <section className="at-actors-inspector-block">
                    <div className="at-actors-block-title">
                      <span>TARGETED SECTORS</span>
                      <Crosshair size={12} />
                    </div>

                    {(selectedActor.targets?.length || 0) >
                      0 ? (
                      <div className="at-actors-sector-list">
                        {(selectedActor.targets || []).map(
                          (target) => (
                            <span key={target}>
                              {target}
                            </span>
                          ),
                        )}
                      </div>
                    ) : (
                      <div className="at-actors-inline-empty">
                        <span>
                          No target sectors recorded.
                        </span>
                      </div>
                    )}
                  </section>

                  {/* Known tooling */}

                  <section className="at-actors-inspector-block">
                    <div className="at-actors-block-title">
                      <span>KNOWN TOOLING</span>
                      <Activity size={12} />
                    </div>

                    <div className="at-actors-tool-list">
                      {[
                        'Cobalt Strike',
                        'Mimikatz',
                        'Custom Dropper',
                        'Powershell Empire',
                      ].map((tool) => (
                        <span key={tool}>
                          {tool}
                        </span>
                      ))}
                    </div>

                    <p className="at-actors-data-note">
                      Tooling shown here reflects the
                      current actor-profile presentation
                      and is not inferred from additional
                      external telemetry.
                    </p>
                  </section>

                  {/* Aliases */}

                  <section className="at-actors-inspector-block">
                    <div className="at-actors-block-title">
                      <span>KNOWN ALIASES</span>
                      <Users size={12} />
                    </div>

                    {(selectedActor.aliases?.length || 0) >
                      0 ? (
                      <div className="at-actors-alias-list">
                        {(selectedActor.aliases || []).map(
                          (alias) => (
                            <span key={alias}>
                              {alias}
                            </span>
                          ),
                        )}
                      </div>
                    ) : (
                      <div className="at-actors-inline-empty">
                        <span>
                          No aliases recorded.
                        </span>
                      </div>
                    )}
                  </section>
                </div>
              )}

              {inspectorTab === 'TTPs' && (
                <div className="at-actors-ttps">
                  <div className="at-actors-ttps-intro">
                    <span className="at-v2-kicker">
                      MITRE ATT&amp;CK
                    </span>

                    <p>
                      Mapped techniques associated
                      with this actor profile.
                    </p>
                  </div>

                  {(selectedActor.ttps?.length || 0) >
                    0 ? (
                    <div className="at-actors-ttp-list">
                      {(selectedActor.ttps || []).map(
                        (ttp) => (
                          <button
                            type="button"
                            key={ttp}
                            className="at-actors-ttp"
                          >
                            <span>{ttp}</span>
                            <ChevronRight
                              size={12}
                            />
                          </button>
                        ),
                      )}
                    </div>
                  ) : (
                    <div className="at-actors-empty-state">
                      <Activity size={22} />

                      <strong>
                        No ATT&amp;CK mappings
                      </strong>

                      <span>
                        No techniques are recorded
                        for this actor profile.
                      </span>
                    </div>
                  )}
                </div>
              )}

              {inspectorTab === 'Campaigns' && (
                <div className="at-actors-empty-state">
                  <Activity size={22} />

                  <strong>
                    No campaign data
                  </strong>

                  <span>
                    Campaign records are not
                    included in the current actor
                    dataset.
                  </span>
                </div>
              )}
            </div>

            {/* Footer */}

            <div className="at-actors-inspector-footer">
              <button
                type="button"
                className="at-btn at-btn-secondary"
                onClick={() => {
                  /*
                   * Full dossier routing can be connected once a dedicated
                   * actor-dossier route exists. Keeping this control
                   * intentionally non-destructive avoids inventing a route
                   * that is not present in the current application.
                   */
                }}
              >
                <FileText size={12} />
                View Full Dossier
              </button>

              <button
                type="button"
                className="at-btn at-btn-primary"
                onClick={() => {
                  /*
                   * Enrichment is intentionally not fabricated here.
                   * The current page does not receive an actor enrichment
                   * callback from AppDataContext. The control remains
                   * available for the dedicated enrichment workflow once
                   * that API contract is wired.
                   */
                }}
              >
                <ArrowUpRight size={12} />
                Enrich
              </button>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}