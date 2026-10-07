import React from 'react';
import {
  useMemo,
  useState,
} from 'react';

import {
  ArrowUpRight,
  BrainCircuit,
  CalendarClock,
  ChevronRight,
  CircleX, Loader2,
  Download,
  ExternalLink,
  Hash,
  Newspaper,
  Search,
  Tag,
  X,
} from 'lucide-react';

import { dataProvider } from '../services/dataProvider';
import { exportAsJson } from '../utils/exportHelpers';
import { useAppData } from '../contexts/AppDataContext';

import PageHeader from '../components/layout/PageHeader';

function formatNewsDate(timestamp?: number) {
    if (!timestamp || Number.isNaN(timestamp)) {
        return 'Unknown date';
    }

    return new Date(timestamp).toLocaleDateString('en-US', {
        month: 'short',
        day: '2-digit',
        year: 'numeric',
    });
}

function formatNewsDateTime(timestamp?: number) {
    if (!timestamp || Number.isNaN(timestamp)) {
        return 'Unknown date';
    }

    return new Date(timestamp).toLocaleString('en-US', {
        month: 'short',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
}

export default function NewsPage() {
  const [MOCK_NEWS, set_MOCK_NEWS] = React.useState<any[]>([]);
  const [isLoading, setIsLoading] = React.useState<boolean>(true);

  React.useEffect(() => {
      dataProvider.getNews().then((news) => {
          set_MOCK_NEWS(news);
          setIsLoading(false);
      });
  }, []);

  const [search, setSearch] =
    useState('');

  const [advancedMode, setAdvancedMode] =
    useState(false);

  const [activeFilters, setActiveFilters] =
    useState<string[]>([]);

  const [filterOpen, setFilterOpen] = useState(false);

  const categories = useMemo(
    () =>
      Array.from(
        new Set(
          MOCK_NEWS.map(
            (news) => news.category
          )
        )
      ).sort(),
    [MOCK_NEWS]
  );

  const [selectedNewsId, setSelectedNewsId] =
    useState<string | null>(null);

  const [inspectorTab, setInspectorTab] =
    useState<
      'Overview' | 'Entities'
    >('Overview');

  const selectedNews =
    useMemo(
      () =>
        MOCK_NEWS.find(
          (news) =>
            news.id ===
            selectedNewsId
        ) || null,
      [selectedNewsId]
    );

  const filtered = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return MOCK_NEWS.filter(
      (news) => {
        const matchSearch =
          !query ||
          news.title
            .toLowerCase()
            .includes(query) ||
          news.source
            .toLowerCase()
            .includes(query) ||
          news.category
            .toLowerCase()
            .includes(query);

        const matchFilters =
          activeFilters.length === 0 ||
          activeFilters.includes(news.category);

        return (
          matchSearch &&
          matchFilters
        );
      }
    );
  }, [search, activeFilters, MOCK_NEWS]);

  const sourceCount =
    new Set(
      MOCK_NEWS.map(
        (news) =>
          news.source
      )
    ).size;

  const categoryCount =
    new Set(
      MOCK_NEWS.map(
        (news) =>
          news.category
      )
    ).size;

  const latestPublished =
    MOCK_NEWS.length > 0
      ? MOCK_NEWS.reduce(
        (latest, news) =>
          news.timestamp > latest.timestamp ? news : latest,
        MOCK_NEWS[0]
      )
      : null;

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

  const clearAll = () => {
    setSearch('');
    setActiveFilters([]);
  };

  const toggleCategoryFilter = (
    category: string
  ) => {
    setActiveFilters((current) =>
      current.includes(category)
        ? current.filter(
            (value) => value !== category
          )
        : [...current, category]
    );
  };

  const handleExportJson = () => {
    exportAsJson(
      'antitode-news-report',
      'Threat Intelligence News',
      filtered,
      { search, selectedCategory },
    );
  };

  const handleExportReport = () => {
    const header = [
      'Published',
      'Headline',
      'Source',
      'Category',
    ];

    const rows = filtered.map(
      (news) =>
        [
          news.timestamp,
          news.title,
          news.source,
          news.category,
        ]
          .map(
            (value) =>
              `"${String(value).replace(
                /"/g,
                '""'
              )}"`
          )
          .join(',')
    );

    const csv = [
      header.join(','),
      ...rows,
    ].join('\n');

    const blob = new Blob(
      [csv],
      { type: 'text/csv;charset=utf-8;' }
    );

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement('a');

    anchor.href = url;
    anchor.download =
      `intel-feed-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

    anchor.click();

    URL.revokeObjectURL(url);
  };

  return (
    <div className="at-news-page">

      {/* ======================================================
          PAGE HEADER
          ====================================================== */}

      <PageHeader
        breadcrumbs={[
          {
            label: 'Intelligence',
          },
          {
            label: 'News',
          },
        ]}
        title="Threat Intelligence Feed"
        description="Aggregated and normalized security news, advisories, and research."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="at-btn at-btn-secondary at-btn-sm"
              onClick={handleExportReport}
              title="Export visible news as CSV"
            >
              <Download size={13} />
              Export CSV
            </button>
            <button
              type="button"
              className="at-btn at-btn-secondary at-btn-sm"
              onClick={handleExportJson}
              title="Export visible news as JSON"
            >
              <Download size={13} />
              Export JSON
            </button>
          </div>
        }
      />

      {/* ======================================================
          FEED SUMMARY
          ====================================================== */}

      <section className="at-news-summary">

        <div className="at-news-summary-total">
          <span className="at-v2-kicker">
            INTELLIGENCE FEED
          </span>

          <div>
            <strong>
              {isLoading ? '-' : MOCK_NEWS.length}
            </strong>

            <span>
              {' '}indexed articles
            </span>
          </div>
        </div>

        <div className="at-news-summary-stat">

          <span className="at-news-summary-icon">
            <Newspaper
              size={14}
            />
          </span>

          <div>
            <strong>
              {sourceCount}
            </strong>

            <small>
              {' '}sources
            </small>
          </div>

        </div>

        <div className="at-news-summary-stat">

          <span className="at-news-summary-icon">
            <Tag size={14} />
          </span>

          <div>
            <strong>
              {categoryCount}
            </strong>

            <small>
              {' '}categories
            </small>
          </div>

        </div>

        <div className="at-news-summary-latest">

          <span>
            LATEST INGEST
          </span>

          <strong>
            {latestPublished
              ? formatNewsDateTime(
                latestPublished.timestamp
              )
              : '—'}
          </strong>

        </div>

      </section>

      {/* ======================================================
          SEARCH / FILTER
          ====================================================== */}

      <section className="at-news-query">

        <div className="at-news-query-main">

          <div
            className={`at-news-search ${advancedMode
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
                  ? 'Advanced news query...'
                  : 'Search headlines, sources, or categories...'
              }
            />

            {search && (
              <button
                type="button"
                onClick={() =>
                  setSearch('')
                }
                aria-label="Clear news search"
              >
                <X size={13} />
              </button>
            )}
          </div>

          <button
            type="button"
            className={`at-news-advanced ${advancedMode
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
            <BrainCircuit
              size={13}
            />
            Advanced
          </button>

          <span className="at-news-result-count">
            {filtered.length}
            {' '}
            results
          </span>

        </div>

        <div className="at-news-filter-row">

          <span className="at-news-filter-label">
            ACTIVE FILTERS
          </span>

          {activeFilters.map(
            (filter) => (
              <span
                className="at-news-filter-chip"
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
                className="at-news-clear"
                onClick={clearAll}
              >
                <CircleX size={12} />
                Clear
              </button>
            )}

          <div className="relative">
            <button
              type="button"
              className="at-news-filter-placeholder"
              onClick={() =>
                setFilterOpen(
                  (open) => !open
                )
              }
            >
              + Filter
            </button>

            {filterOpen && (
              <div className="at-news-filter-panel">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    className={
                      activeFilters.includes(
                        category
                      )
                        ? 'active'
                        : ''
                    }
                    onClick={() =>
                      toggleCategoryFilter(
                        category
                      )
                    }
                  >
                    {category}
                  </button>
                ))}
              </div>
            )}
          </div>

        </div>

      </section>

      {/* ======================================================
          WORKSPACE
          ====================================================== */}

      <div className="at-news-workspace">

        {/* ====================================================
            NEWS FEED
            ==================================================== */}

        <section className="at-news-list">

          <div className="at-news-list-head">

            <div>
              <span className="at-v2-kicker">
                NEWS STREAM
              </span>

              <h2>
                Security intelligence
              </h2>
            </div>

            <span className="at-news-list-count">
              Showing{' '}
              <strong>
                {filtered.length}
              </strong>
            </span>

          </div>

          <div className="at-news-table-wrap">

            <table className="at-news-table">

              <thead>
                <tr>
                  <th>
                    Published
                  </th>

                  <th>
                    Headline
                  </th>

                  <th>
                    Source
                  </th>

                  <th>
                    Category
                  </th>

                  <th />
                </tr>
              </thead>

              <tbody>

                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="p-8"><div className="at-news-empty-state mx-auto max-w-sm bg-[#111] border border-[#222] rounded-xl shadow-lg py-8 flex flex-col items-center justify-center gap-2"><Loader2 size={24} className="at-spin text-[#666] mb-2" /><strong className="text-white text-sm block">Fetching Intelligence...</strong><span className="text-[#888] text-xs block text-center">Connecting to external threat feeds and ingesting data.</span></div></td>
                  </tr>
                ) : filtered.length === 0 ? (<tr><td colSpan={6} className="p-8"><div className="at-news-empty-state mx-auto max-w-sm bg-[#111] border border-[#222] rounded-xl shadow-lg py-8 flex flex-col items-center justify-center gap-2"><Newspaper size={24} className="text-[#666] mb-2" /><strong className="text-white text-sm block">No news found</strong><span className="text-[#888] text-xs block text-center">No articles match the current search.</span><button type="button" onClick={clearAll} className="mt-4 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 transition-colors rounded-lg text-xs text-white border border-neutral-700">Clear search</button></div></td></tr>) : (
                  filtered.map(
                    (
                      news,
                      index
                    ) => {
                      const selected =
                        selectedNewsId ===
                        news.id;

                      return (
                        <tr
                          key={news.id}
                          className={
                            selected
                              ? 'active'
                              : ''
                          }
                          onClick={() =>
                            setSelectedNewsId(
                              news.id
                            )
                          }
                        >

                          <td>
                            <span className="at-news-date">

                              <CalendarClock
                                size={11}
                              />

                              {formatNewsDate(
                                news.timestamp
                              )}

                            </span>
                          </td>

                          <td>

                            <button
                              type="button"
                              className="at-news-headline"
                              onClick={(
                                event
                              ) => {
                                event.stopPropagation();

                                setSelectedNewsId(
                                  news.id
                                );
                              }}
                            >
                              {
                                news.title
                              }
                            </button>

                            <span className="at-news-headline-meta">
                              Security
                              intelligence
                              article
                            </span>

                          </td>

                          <td>
                            <span className="at-news-source">
                              {
                                news.source
                              }
                            </span>
                          </td>

                          <td>

                            <span className="at-news-category">
                              <Tag
                                size={10}
                              />

                              {
                                news.category
                              }
                            </span>

                          </td>

                          <td>
                            <ChevronRight
                              size={13}
                              className="at-news-row-arrow"
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

        {selectedNews && (
          <aside className="at-news-inspector">

            {/* Header */}

            <div className="at-news-inspector-head">

              <div className="at-news-article-identity">

                <span className="at-news-article-icon">
                  <Newspaper
                    size={20}
                  />
                </span>

                <div>
                  <span>
                    {
                      selectedNews.source
                    }
                  </span>

                  <strong>
                    {
                      selectedNews.title
                    }
                  </strong>
                </div>

              </div>

              <button
                type="button"
                className="at-news-close"
                onClick={() =>
                  setSelectedNewsId(
                    null
                  )
                }
                aria-label="Close news inspector"
              >
                <X size={15} />
              </button>

            </div>

            <div className="at-news-inspector-meta">

              <span className="at-news-inspector-category">
                <Tag size={10} />

                {
                  selectedNews.category
                }
              </span>

              <span className="at-news-inspector-date">
                <CalendarClock
                  size={10}
                />

                {formatNewsDateTime(
                  selectedNews.timestamp
                )}
              </span>

            </div>

            {/* Tabs */}

            <div className="at-news-tabs">

              {[
                'Overview',
                'Entities',
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
                      | 'Overview'
                      | 'Entities'
                    )
                  }
                >
                  {tab}
                </button>
              ))}

            </div>

            {/* Content */}

            <div className="at-news-inspector-scroll">

              {inspectorTab ===
                'Overview' && (
                  <div className="at-news-inspector-content">

                    <section className="at-news-inspector-block">

                      <div className="at-news-block-title">
                        <span>
                          ARTICLE
                        </span>

                        <Newspaper
                          size={12}
                        />
                      </div>

                      <div className="at-news-article-card">

                        <strong>
                          {
                            selectedNews.title
                          }
                        </strong>

                        <div>
                          <span>
                            {
                              selectedNews.source
                            }
                          </span>

                          <span>
                            ·
                          </span>

                          <span>
                            {
                              selectedNews.category
                            }
                          </span>
                        </div>

                      </div>

                    </section>

                    <section className="at-news-inspector-block">

                      <div className="at-news-block-title">
                        <span>
                          PUBLISHED
                        </span>

                        <CalendarClock
                          size={12}
                        />
                      </div>

                      <code className="at-news-published">
                        {formatNewsDateTime(
                          selectedNews.timestamp
                        )}
                      </code>

                    </section>

                    <section className="at-news-inspector-block">

                      <div className="at-news-block-title">
                        <span>
                          AI SUMMARY
                        </span>

                        <BrainCircuit
                          size={12}
                        />
                      </div>

                      <div className="at-news-summary-card">
                        This article
                        details a
                        recent
                        development
                        involving{' '}
                        {selectedNews.category.toLowerCase()}{' '}
                        activities
                        reported by{' '}
                        {
                          selectedNews.source
                        }
                        . The threat
                        primarily
                        affects
                        enterprise
                        networks and
                        utilizes
                        advanced
                        techniques to
                        bypass
                        standard
                        monitoring.
                      </div>

                    </section>

                  </div>
                )}

              {inspectorTab ===
                'Entities' && (
                  <div className="at-news-inspector-content">

                    <section className="at-news-inspector-block">

                      <div className="at-news-block-title">
                        <span>
                          EXTRACTED ENTITIES
                        </span>

                        <Hash size={12} />
                      </div>

                      <p className="at-news-entities-intro">
                        Entities extracted
                        from the article:
                      </p>

                      <div className="at-news-entity-list">

                        <button
                          type="button"
                          className="at-news-entity"
                        >
                          <span>
                            185.220.101.42
                          </span>

                          <b>
                            IP
                          </b>
                        </button>

                        <button
                          type="button"
                          className="at-news-entity"
                        >
                          <span>
                            APT28
                          </span>

                          <b>
                            Actor
                          </b>
                        </button>

                      </div>

                    </section>

                  </div>
                )}

            </div>

            {/* Footer */}

            <div className="at-news-inspector-footer">

              <button
                type="button"
                className="at-btn at-btn-secondary"
                onClick={() => {
                  if (
                    selectedNews.url !==
                    '#'
                  ) {
                    window.open(
                      selectedNews.url,
                      '_blank',
                      'noopener,noreferrer'
                    );
                  }
                }}
              >
                Read Original
                <ExternalLink
                  size={12}
                />
              </button>

              <button
                type="button"
                className="at-btn at-btn-primary"
              >
                Open Article
                <ArrowUpRight
                  size={12}
                />
              </button>

            </div>

          </aside>
        )}

      </div>

    </div>
  );
}





