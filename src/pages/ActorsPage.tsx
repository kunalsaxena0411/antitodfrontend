import {
  useMemo,
  useState,
} from 'react';

import {
  Activity,
  ArrowUpRight,
  ChevronRight,
  CircleX,
  Crosshair,
  Download,
  FileText,
  MapPin,
  Search,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';

import {
  MOCK_ACTORS,
  type MockActor,
} from '../data/mockData';

import PageHeader from '../components/layout/PageHeader';

function formatDate(
  value: string
) {
  return new Date(value).toLocaleDateString(
    'en-US',
    {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
    }
  );
}

export default function ActorsPage() {
  const [search, setSearch] =
    useState('');

  const [
    advancedMode,
    setAdvancedMode,
  ] = useState(false);

  const [
    activeFilters,
    setActiveFilters,
  ] = useState<string[]>([]);

  const [
    selectedActorId,
    setSelectedActorId,
  ] = useState<string | null>(
    null
  );

  const [
    inspectorTab,
    setInspectorTab,
  ] = useState<
    'Profile' |
    'TTPs' |
    'Campaigns'
  >('Profile');

  const selectedActor =
    useMemo(
      () =>
        MOCK_ACTORS.find(
          (actor) =>
            actor.id ===
            selectedActorId
        ) || null,
      [selectedActorId]
    );

  const filtered = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return MOCK_ACTORS.filter(
      (actor) => {
        if (!query) {
          return true;
        }

        return (
          actor.name
            .toLowerCase()
            .includes(query) ||
          actor.aliases.some(
            (alias) =>
              alias
                .toLowerCase()
                .includes(query)
          )
        );
      }
    );
  }, [search]);

  const countryCounts =
    useMemo(() => {
      return MOCK_ACTORS.reduce(
        (
          result,
          actor
        ) => {
          result[actor.country] =
            (result[actor.country] ||
              0) + 1;

          return result;
        },
        {} as Record<
          string,
          number
        >
      );
    }, []);

  const motivationCounts =
    useMemo(() => {
      return MOCK_ACTORS.reduce(
        (
          result,
          actor
        ) => {
          result[actor.motivation] =
            (result[
              actor.motivation
            ] || 0) + 1;

          return result;
        },
        {} as Record<
          string,
          number
        >
      );
    }, []);

  const removeFilter = (
    filter: string
  ) => {
    setActiveFilters(
      (previous) =>
        previous.filter(
          (value) =>
            value !== filter
        )
    );
  };

  const clearSearch = () => {
    setSearch('');
    setActiveFilters([]);
  };

  return (
    <div className="at-actors-page">

      {/* ======================================================
          PAGE HEADER
          ====================================================== */}

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
          >
            <Download size={13} />
            Export MISP
          </button>
        }
      />

      {/* ======================================================
          SUMMARY
          ====================================================== */}

      <section className="at-actors-summary">

        <div className="at-actors-summary-total">
          <span className="at-v2-kicker">
            THREAT ACTOR REPOSITORY
          </span>

          <div>
            <strong>
              {MOCK_ACTORS.length}
            </strong>

            <span>
              tracked actor profiles
            </span>
          </div>
        </div>

        <div className="at-actors-summary-stat">
          <span className="at-actors-summary-stat-icon">
            <MapPin size={14} />
          </span>

          <div>
            <strong>
              {
                Object.keys(
                  countryCounts
                ).length
              }
            </strong>

            <small>
              origin countries
            </small>
          </div>
        </div>

        <div className="at-actors-summary-stat">
          <span className="at-actors-summary-stat-icon">
            <Crosshair
              size={14}
            />
          </span>

          <div>
            <strong>
              {
                new Set(
                  MOCK_ACTORS.flatMap(
                    (actor) =>
                      actor.targets
                  )
                ).size
              }
            </strong>

            <small>
              target sectors
            </small>
          </div>
        </div>

        <div className="at-actors-summary-stat">
          <span className="at-actors-summary-stat-icon">
            <Activity
              size={14}
            />
          </span>

          <div>
            <strong>
              {
                new Set(
                  MOCK_ACTORS.flatMap(
                    (actor) =>
                      actor.ttps
                  )
                ).size
              }
            </strong>

            <small>
              ATT&amp;CK mappings
            </small>
          </div>
        </div>

        <div className="at-actors-summary-motivation">
          <span className="at-actors-summary-motivation-label">
            MOTIVATION
          </span>

          <div>
            {Object.entries(
              motivationCounts
            ).map(
              ([
                motivation,
                count,
              ]) => (
                <span
                  key={
                    motivation
                  }
                >
                  {motivation}
                  <b>
                    {count}
                  </b>
                </span>
              )
            )}
          </div>
        </div>

      </section>

      {/* ======================================================
          QUERY
          ====================================================== */}

      <section className="at-actors-query">

        <div className="at-actors-query-main">

          <div
            className={`at-actors-search ${advancedMode
                ? 'advanced'
                : ''
              }`}
          >
            <Search size={14} />

            <input
              value={search}
              onChange={(event) =>
                setSearch(
                  event.target.value
                )
              }
              placeholder={
                advancedMode
                  ? 'Advanced actor query...'
                  : 'Search actor name or aliases...'
              }
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch('')
                }
                aria-label="Clear actor search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            type="button"
            className={`at-actors-advanced ${advancedMode
                ? 'active'
                : ''
              }`}
            onClick={() =>
              setAdvancedMode(
                (value) =>
                  !value
              )
            }
          >
            <Activity size={13} />
            Advanced
          </button>

          <span className="at-actors-result-count">
            {filtered.length}
            {' '}
            results
          </span>

        </div>

        <div className="at-actors-filter-row">

          <span className="at-actors-filter-label">
            ACTIVE FILTERS
          </span>

          {activeFilters.map(
            (filter) => (
              <span
                className="at-actors-filter-chip"
                key={filter}
              >
                {filter}

                <button
                  type="button"
                  onClick={() =>
                    removeFilter(
                      filter
                    )
                  }
                  aria-label={`Remove ${filter}`}
                >
                  <X size={10} />
                </button>
              </span>
            )
          )}

          {activeFilters.length >
            0 && (
              <button
                type="button"
                className="at-actors-clear"
                onClick={
                  clearSearch
                }
              >
                <CircleX size={12} />
                Clear
              </button>
            )}

          <button
            type="button"
            className="at-actors-filter-placeholder"
          >
            + Filter
          </button>

        </div>
      </section>

      {/* ======================================================
          WORKSPACE
          ====================================================== */}

      <div className="at-actors-workspace">

        {/* ====================================================
            ACTOR LIST
            ==================================================== */}

        <section className="at-actors-list">

          <div className="at-actors-list-head">

            <div>
              <span className="at-v2-kicker">
                THREAT INTELLIGENCE
              </span>

              <h2>
                Actor profiles
              </h2>
            </div>

            <span className="at-actors-list-count">
              Showing{' '}
              <strong>
                {filtered.length}
              </strong>
            </span>

          </div>

          <div className="at-actors-table-wrap">

            <table className="at-actors-table">

              <thead>
                <tr>
                  <th>
                    Designation
                  </th>

                  <th>
                    Aliases
                  </th>

                  <th>
                    Origin
                  </th>

                  <th>
                    Motivation
                  </th>

                  <th>
                    Targets
                  </th>

                  <th>
                    Activity
                  </th>

                  <th />
                </tr>
              </thead>

              <tbody>

                {filtered.length ===
                  0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="at-actors-empty"
                    >
                      <Users
                        size={21}
                      />

                      <strong>
                        No actors found
                      </strong>

                      <span>
                        No threat actor
                        matches the
                        current search.
                      </span>

                      <button
                        type="button"
                        onClick={
                          clearSearch
                        }
                      >
                        Clear search
                      </button>
                    </td>
                  </tr>
                ) : (
                  filtered.map(
                    (actor) => {
                      const selected =
                        selectedActorId ===
                        actor.id;

                      return (
                        <tr
                          key={actor.id}
                          className={
                            selected
                              ? 'active'
                              : ''
                          }
                          onClick={() =>
                            setSelectedActorId(
                              actor.id
                            )
                          }
                        >
                          <td>

                            <div className="at-actors-designation">

                              <span
                                className={`at-actors-actor-icon ${selected
                                    ? 'active'
                                    : ''
                                  }`}
                              >
                                <Users
                                  size={12}
                                />
                              </span>

                              <div>
                                <button
                                  type="button"
                                  className="at-actors-name"
                                  onClick={(
                                    event
                                  ) => {
                                    event.stopPropagation();

                                    setSelectedActorId(
                                      actor.id
                                    );
                                  }}
                                >
                                  {
                                    actor.name
                                  }
                                </button>

                                <span>
                                  {
                                    actor.id
                                  }
                                </span>
                              </div>

                            </div>

                          </td>

                          <td>

                            <div className="at-actors-aliases">
                              {actor.aliases.map(
                                (
                                  alias,
                                  index
                                ) => (
                                  <span
                                    key={
                                      `${alias}-${index}`
                                    }
                                  >
                                    {
                                      alias
                                    }
                                  </span>
                                )
                              )}
                            </div>

                          </td>

                          <td>

                            <span className="at-actors-origin">
                              <MapPin
                                size={11}
                              />

                              {
                                actor.country
                              }
                            </span>

                          </td>

                          <td>

                            <span className="at-actors-motivation">
                              {
                                actor.motivation
                              }
                            </span>

                          </td>

                          <td>

                            <div className="at-actors-targets">

                              {actor.targets
                                .slice(
                                  0,
                                  2
                                )
                                .map(
                                  (
                                    target
                                  ) => (
                                    <span
                                      key={
                                        target
                                      }
                                    >
                                      {
                                        target
                                      }
                                    </span>
                                  )
                                )}

                              {actor.targets
                                .length >
                                2 && (
                                  <span>
                                    +
                                    {actor
                                      .targets
                                      .length -
                                      2}
                                  </span>
                                )}

                            </div>

                          </td>

                          <td>

                            <div className="at-actors-activity">
                              <span>
                                {
                                  actor.ttps
                                    .length
                                }
                                {' '}
                                TTPs
                              </span>

                              <small>
                                {
                                  actor.targets
                                    .length
                                }
                                {' '}
                                sectors
                              </small>
                            </div>

                          </td>

                          <td>
                            <ChevronRight
                              size={13}
                              className="at-actors-row-arrow"
                            />
                          </td>

                        </tr>
                      );
                    }
                  )
                )}

              </tbody>

            </table>

          </div>

        </section>

        {/* ====================================================
            INSPECTOR
            ==================================================== */}

        {selectedActor && (
          <aside className="at-actors-inspector">

            {/* Header */}

            <div className="at-actors-inspector-head">

              <div className="at-actors-identity">

                <span className="at-actors-identity-icon">
                  <Users
                    size={21}
                  />
                </span>

                <div>
                  <span>
                    THREAT ACTOR
                  </span>

                  <strong>
                    {
                      selectedActor.name
                    }
                  </strong>

                  <small>
                    {
                      selectedActor.aliases.join(
                        ' · '
                      )
                    }
                  </small>
                </div>

              </div>

              <button
                type="button"
                className="at-actors-close"
                onClick={() =>
                  setSelectedActorId(
                    null
                  )
                }
                aria-label="Close actor inspector"
              >
                <X size={15} />
              </button>

            </div>

            {/* Meta */}

            <div className="at-actors-inspector-meta">

              <span className="at-actors-motivation-badge">
                <ShieldAlert
                  size={10}
                />

                {
                  selectedActor.motivation
                }
              </span>

              <span className="at-actors-country-badge">
                <MapPin
                  size={10}
                />

                {
                  selectedActor.country
                }
              </span>

            </div>

            {/* Tabs */}

            <div className="at-actors-tabs">

              {[
                'Profile',
                'TTPs',
                'Campaigns',
              ].map((tab) => (
                <button
                  type="button"
                  key={tab}
                  className={
                    inspectorTab ===
                      tab
                      ? 'active'
                      : ''
                  }
                  onClick={() =>
                    setInspectorTab(
                      tab as
                      | 'Profile'
                      | 'TTPs'
                      | 'Campaigns'
                    )
                  }
                >
                  {tab}
                </button>
              ))}

            </div>

            {/* Content */}

            <div className="at-actors-inspector-scroll">

              {inspectorTab ===
                'Profile' && (
                  <div className="at-actors-inspector-content">

                    {/* Observation */}
                    <section className="at-actors-inspector-block">

                      <div className="at-actors-block-title">
                        <span>
                          OBSERVATION
                        </span>

                        <Activity
                          size={12}
                        />
                      </div>

                      <div className="at-actors-observation">

                        <div>
                          <span>
                            First Tracked
                          </span>

                          <code>
                            {formatDate(
                              selectedActor.firstSeen
                            )}
                          </code>
                        </div>

                        <div>
                          <span>
                            Last Active
                          </span>

                          <code>
                            {formatDate(
                              selectedActor.lastSeen
                            )}
                          </code>
                        </div>

                      </div>

                    </section>

                    {/* Target sectors */}
                    <section className="at-actors-inspector-block">

                      <div className="at-actors-block-title">
                        <span>
                          TARGETED SECTORS
                        </span>

                        <Crosshair
                          size={12}
                        />
                      </div>

                      <div className="at-actors-sector-list">

                        {selectedActor.targets.map(
                          (
                            target
                          ) => (
                            <span
                              key={
                                target
                              }
                            >
                              {
                                target
                              }
                            </span>
                          )
                        )}

                      </div>

                    </section>

                    {/* Known tooling */}
                    <section className="at-actors-inspector-block">

                      <div className="at-actors-block-title">
                        <span>
                          KNOWN TOOLING
                        </span>

                        <Activity
                          size={12}
                        />
                      </div>

                      <div className="at-actors-tool-list">

                        {[
                          'Cobalt Strike',
                          'Mimikatz',
                          'Custom Dropper',
                          'Powershell Empire',
                        ].map(
                          (tool) => (
                            <span
                              key={
                                tool
                              }
                            >
                              {
                                tool
                              }
                            </span>
                          )
                        )}

                      </div>

                    </section>

                    {/* Aliases */}
                    <section className="at-actors-inspector-block">

                      <div className="at-actors-block-title">
                        <span>
                          KNOWN ALIASES
                        </span>

                        <Users
                          size={12}
                        />
                      </div>

                      <div className="at-actors-alias-list">

                        {selectedActor.aliases.map(
                          (
                            alias
                          ) => (
                            <span
                              key={
                                alias
                              }
                            >
                              {
                                alias
                              }
                            </span>
                          )
                        )}

                      </div>

                    </section>

                  </div>
                )}

              {inspectorTab ===
                'TTPs' && (
                  <div className="at-actors-ttps">

                    <div className="at-actors-ttps-intro">
                      <span className="at-v2-kicker">
                        MITRE ATT&amp;CK
                      </span>

                      <p>
                        Mapped techniques
                        associated with this
                        actor profile.
                      </p>
                    </div>

                    <div className="at-actors-ttp-list">

                      {selectedActor.ttps.map(
                        (ttp) => (
                          <button
                            type="button"
                            key={ttp}
                            className="at-actors-ttp"
                          >
                            <span>
                              {ttp}
                            </span>

                            <ChevronRight
                              size={12}
                            />
                          </button>
                        )
                      )}

                    </div>

                  </div>
                )}

              {inspectorTab ===
                'Campaigns' && (
                  <div className="at-actors-empty-state">

                    <Activity
                      size={22}
                    />

                    <strong>
                      No campaign data
                    </strong>

                    <span>
                      Campaign records are
                      not included in the
                      current actor dataset.
                    </span>

                  </div>
                )}

            </div>

            {/* Footer */}

            <div className="at-actors-inspector-footer">

              <button
                type="button"
                className="at-btn at-btn-secondary"
              >
                <FileText
                  size={12}
                />
                View Full Dossier
              </button>

              <button
                type="button"
                className="at-btn at-btn-primary"
              >
                <ArrowUpRight
                  size={12}
                />
                Enrich
              </button>

            </div>

          </aside>
        )}

      </div>

    </div>
  );
}