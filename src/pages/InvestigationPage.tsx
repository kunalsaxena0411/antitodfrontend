import {
  useMemo,
  useState,
  type ElementType,
} from 'react';

import {
  Activity,
  AlertTriangle,
  ChevronDown,
  Download,
  Eye,
  FileText,
  Filter,
  Globe,
  Hash,
  Layers,
  LayoutDashboard,
  Maximize,
  Network,
  RotateCcw,
  Save,
  Search,
  Server,
  Shield,
  ShieldAlert,
  Users,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

type NodeType =
  | 'ip'
  | 'domain'
  | 'hash'
  | 'actor'
  | 'host'
  | 'cve'
  | 'mitre';

type Severity =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low';

interface GraphNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  severity?: Severity;
}

interface GraphEdge {
  id: string;
  source: string;
  target: string;
  label: string;
  critical?: boolean;
}

const MOCK_NODES: GraphNode[] = [
  {
    id: 'n1',
    type: 'actor',
    label: 'APT28 (Fancy Bear)',
    x: 15,
    y: 50,
    severity: 'critical',
  },
  {
    id: 'n2',
    type: 'domain',
    label: 'c2-control-api.ru',
    x: 35,
    y: 30,
    severity: 'critical',
  },
  {
    id: 'n3',
    type: 'ip',
    label: '185.220.101.42',
    x: 35,
    y: 70,
    severity: 'high',
  },
  {
    id: 'n4',
    type: 'hash',
    label: 'payload_drop.exe',
    x: 55,
    y: 50,
    severity: 'critical',
  },
  {
    id: 'n5',
    type: 'host',
    label: 'SRV-DB-01',
    x: 75,
    y: 35,
  },
  {
    id: 'n6',
    type: 'host',
    label: 'SRV-WEB-04',
    x: 75,
    y: 65,
  },
  {
    id: 'n7',
    type: 'mitre',
    label: 'T1059.001 (PowerShell)',
    x: 90,
    y: 50,
  },
];

const MOCK_EDGES: GraphEdge[] = [
  {
    id: 'e1',
    source: 'n1',
    target: 'n2',
    label: 'operates',
  },
  {
    id: 'e2',
    source: 'n1',
    target: 'n3',
    label: 'owns',
  },
  {
    id: 'e3',
    source: 'n2',
    target: 'n4',
    label: 'hosts payload',
    critical: true,
  },
  {
    id: 'e4',
    source: 'n3',
    target: 'n4',
    label: 'delivers',
    critical: true,
  },
  {
    id: 'e5',
    source: 'n4',
    target: 'n5',
    label: 'executed on',
    critical: true,
  },
  {
    id: 'e6',
    source: 'n4',
    target: 'n6',
    label: 'attempted on',
  },
  {
    id: 'e7',
    source: 'n5',
    target: 'n7',
    label: 'technique mapped',
  },
];

const ICONS: Record<
  NodeType,
  ElementType
> = {
  ip: Server,
  domain: Globe,
  hash: Hash,
  actor: Users,
  host: Server,
  cve: ShieldAlert,
  mitre: Layers,
};

const TYPE_LABELS: Record<
  NodeType,
  string
> = {
  ip: 'IP Address',
  domain: 'Domain Name',
  hash: 'File Hash',
  actor: 'Threat Actor',
  host: 'Target Host',
  cve: 'Vulnerability',
  mitre: 'ATT&CK Technique',
};

const TIMELINE_EVENTS = [
  {
    time: '14:22:11',
    entity: '185.220.101.42',
    event: 'Connection Established',
    type: 'network',
    sev: 'medium',
  },
  {
    time: '14:23:05',
    entity: 'c2-control-api.ru',
    event: 'DNS Resolution',
    type: 'network',
    sev: 'medium',
  },
  {
    time: '14:25:44',
    entity: 'payload_drop.exe',
    event: 'File Dropped',
    type: 'endpoint',
    sev: 'critical',
  },
  {
    time: '14:26:10',
    entity: 'SRV-DB-01',
    event: 'Process Execution',
    type: 'endpoint',
    sev: 'critical',
  },
  {
    time: '14:26:15',
    entity: 'T1059.001',
    event: 'PowerShell Invoked',
    type: 'detection',
    sev: 'high',
  },
];

const SAVED_PIVOTS = [
  {
    label: 'Initial Payload Analysis',
    icon: LayoutDashboard,
  },
  {
    label: 'C2 Infrastructure Pivot',
    icon: Network,
  },
  {
    label: 'Actor Attribution',
    icon: Users,
  },
];

const TAGS = [
  'malicious',
  'c2',
  'cobalt-strike',
];

function severityColor(
  severity?: Severity
) {
  switch (severity) {
    case 'critical':
      return '#D62828';

    case 'high':
      return '#E7782A';

    case 'medium':
      return '#B78E2C';

    case 'low':
      return '#548A63';

    default:
      return '#717171';
  }
}

export default function InvestigationPage() {
  const [
    selectedNodeId,
    setSelectedNodeId,
  ] = useState<string | null>('n4');

  const [
    inspectorTab,
    setInspectorTab,
  ] = useState<
    'Overview' |
    'Intelligence' |
    'Evidence'
  >('Overview');

  const [
    graphQuery,
    setGraphQuery,
  ] = useState('');

  const [
    showFilters,
    setShowFilters,
  ] = useState(false);

  const selectedNode = useMemo(
    () =>
      MOCK_NODES.find(
        (node) =>
          node.id === selectedNodeId
      ) || null,
    [selectedNodeId]
  );

  const connectedNodes = useMemo(() => {
    if (!selectedNodeId) {
      return new Set<string>();
    }

    const connected =
      new Set<string>([
        selectedNodeId,
      ]);

    MOCK_EDGES.forEach((edge) => {
      if (
        edge.source ===
        selectedNodeId
      ) {
        connected.add(edge.target);
      }

      if (
        edge.target ===
        selectedNodeId
      ) {
        connected.add(edge.source);
      }
    });

    return connected;
  }, [selectedNodeId]);

  const visibleNodes = useMemo(() => {
    const needle =
      graphQuery.trim().toLowerCase();

    if (!needle) {
      return MOCK_NODES;
    }

    return MOCK_NODES.filter(
      (node) =>
        node.label
          .toLowerCase()
          .includes(needle) ||
        TYPE_LABELS[node.type]
          .toLowerCase()
          .includes(needle)
    );
  }, [graphQuery]);

  const visibleNodeIds = new Set(
    visibleNodes.map((node) => node.id)
  );

  const visibleEdges = MOCK_EDGES.filter(
    (edge) =>
      visibleNodeIds.has(edge.source) &&
      visibleNodeIds.has(edge.target)
  );

  const selectedRelations =
    selectedNodeId
      ? MOCK_EDGES.filter(
        (edge) =>
          edge.source ===
          selectedNodeId ||
          edge.target ===
          selectedNodeId
      ).length
      : 0;

  const getNodeOpacity = (
    node: GraphNode
  ) => {
    if (!selectedNodeId) {
      return 1;
    }

    if (
      node.id ===
      selectedNodeId
    ) {
      return 1;
    }

    if (
      connectedNodes.has(node.id)
    ) {
      return 0.95;
    }

    return 0.28;
  };

  const getEdgeOpacity = (
    edge: GraphEdge
  ) => {
    if (!selectedNodeId) {
      return 1;
    }

    if (
      edge.source ===
      selectedNodeId ||
      edge.target ===
      selectedNodeId
    ) {
      return 1;
    }

    return 0.13;
  };

  return (
    <div className="at-investigation-page">

      {/* ======================================================
          WORKSPACE TOOLBAR
          ====================================================== */}

      <header className="at-investigation-toolbar">

        <div className="at-investigation-toolbar-left">

          <div className="at-investigation-identity">
            <div className="at-investigation-identity-mark">
              <Network size={16} />
            </div>

            <div>
              <strong>
                INV-2901:
                Cobalt Strike
                Beacon
              </strong>

              <span>
                <i />
                Active Investigation
              </span>
            </div>
          </div>

          <div className="at-investigation-toolbar-divider" />

          <div className="at-investigation-search">
            <Search size={13} />

            <input
              value={graphQuery}
              onChange={(event) =>
                setGraphQuery(
                  event.target.value
                )
              }
              placeholder="Search graph entities..."
            />
          </div>

        </div>

        <div className="at-investigation-toolbar-actions">

          <div className="at-investigation-view-tools">
            <button
              type="button"
              title="Zoom In"
            >
              <ZoomIn size={14} />
            </button>

            <button
              type="button"
              title="Fit to Screen"
            >
              <Maximize
                size={14}
              />
            </button>

            <button
              type="button"
              title="Zoom Out"
            >
              <ZoomOut size={14} />
            </button>

            <button
              type="button"
              title="Reset"
            >
              <RotateCcw
                size={13}
              />
            </button>
          </div>

          <div className="at-investigation-toolbar-divider" />

          <button
            type="button"
            className={`at-investigation-tool-button ${showFilters
                ? 'active'
                : ''
              }`}
            onClick={() =>
              setShowFilters(
                (value) => !value
              )
            }
          >
            <Filter size={13} />
            Filter
          </button>

          <button
            type="button"
            className="at-investigation-tool-button"
          >
            <Download size={13} />
            Export
          </button>

          <button
            type="button"
            className="at-investigation-save-button"
          >
            <Save size={13} />
            Save State
          </button>

        </div>

      </header>

      {/* Optional filter strip */}

      {showFilters && (
        <div className="at-investigation-filter-strip">
          <span>
            GRAPH FILTERS
          </span>

          <button type="button">
            All entity types
            <ChevronDown size={11} />
          </button>

          <button type="button">
            All severities
            <ChevronDown size={11} />
          </button>

          <button type="button">
            Related only
            <ChevronDown size={11} />
          </button>

          <button
            type="button"
            className="reset"
            onClick={() => {
              setGraphQuery('');
              setSelectedNodeId(
                'n4'
              );
            }}
          >
            Reset
          </button>
        </div>
      )}

      <div className="at-investigation-body">

        {/* ====================================================
            LEFT CONTEXT
            ==================================================== */}

        <aside className="at-investigation-context">

          <div className="at-investigation-context-section">
            <span className="at-investigation-kicker">
              INVESTIGATION CONTEXT
            </span>

            <div className="at-investigation-context-row">
              <span>
                Assigned To
              </span>

              <strong>
                <i className="at-investigation-avatar">
                  A1
                </i>
                Analyst-1
              </strong>
            </div>

            <div className="at-investigation-context-row">
              <span>
                Priority
              </span>

              <strong className="critical">
                <AlertTriangle
                  size={12}
                />
                Critical
              </strong>
            </div>

            <div className="at-investigation-context-row">
              <span>
                Created
              </span>

              <code>
                2026-09-24
                14:22 UTC
              </code>
            </div>
          </div>

          <div className="at-investigation-context-section pivots">

            <div className="at-investigation-context-heading">
              <span>
                SAVED PIVOTS
              </span>

              <Save size={11} />
            </div>

            <div className="at-investigation-pivots">
              {SAVED_PIVOTS.map(
                (pivot) => {
                  const Icon =
                    pivot.icon;

                  return (
                    <button
                      type="button"
                      key={pivot.label}
                    >
                      <Icon size={12} />

                      <span>
                        {pivot.label}
                      </span>
                    </button>
                  );
                }
              )}
            </div>
          </div>

          <div className="at-investigation-context-footer">
            <div>
              <span>
                ENTITIES
              </span>

              <strong>
                {MOCK_NODES.length}
              </strong>
            </div>

            <div>
              <span>
                RELATIONS
              </span>

              <strong>
                {MOCK_EDGES.length}
              </strong>
            </div>
          </div>

        </aside>

        {/* ====================================================
            GRAPH CANVAS
            ==================================================== */}

        <main className="at-investigation-canvas">

          <div className="at-investigation-canvas-grid" />

          <div className="at-investigation-canvas-label top-left">
            RELATIONSHIP GRAPH
          </div>

          <div className="at-investigation-canvas-label top-right">
            {visibleNodes.length}
            {' '}
            VISIBLE ENTITIES
          </div>

          <svg
            className="at-investigation-edges"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <defs>
              <marker
                id="at-arrow"
                markerWidth="5"
                markerHeight="5"
                refX="4"
                refY="2.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 5 2.5, 0 5"
                  fill="rgba(130,130,130,0.5)"
                />
              </marker>

              <marker
                id="at-arrow-critical"
                markerWidth="5"
                markerHeight="5"
                refX="4"
                refY="2.5"
                orient="auto"
              >
                <polygon
                  points="0 0, 5 2.5, 0 5"
                  fill="rgba(214,40,40,0.8)"
                />
              </marker>
            </defs>

            {visibleEdges.map(
              (edge) => {
                const source =
                  MOCK_NODES.find(
                    (node) =>
                      node.id ===
                      edge.source
                  );

                const target =
                  MOCK_NODES.find(
                    (node) =>
                      node.id ===
                      edge.target
                  );

                if (
                  !source ||
                  !target
                ) {
                  return null;
                }

                const connected =
                  !selectedNodeId ||
                  edge.source ===
                  selectedNodeId ||
                  edge.target ===
                  selectedNodeId;

                return (
                  <g
                    key={edge.id}
                    opacity={getEdgeOpacity(
                      edge
                    )}
                  >
                    <line
                      x1={`${source.x}%`}
                      y1={`${source.y}%`}
                      x2={`${target.x}%`}
                      y2={`${target.y}%`}
                      stroke={
                        edge.critical
                          ? 'rgba(214,40,40,0.8)'
                          : 'rgba(130,130,130,0.5)'
                      }
                      strokeWidth={
                        edge.critical &&
                          connected
                          ? 0.7
                          : 0.4
                      }
                      strokeDasharray={
                        edge.critical
                          ? undefined
                          : '2 2'
                      }
                      markerEnd={
                        edge.critical
                          ? 'url(#at-arrow-critical)'
                          : 'url(#at-arrow)'
                      }
                    />

                    <text
                      x={`${(source.x +
                          target.x) /
                        2
                        }%`}
                      y={`${(source.y +
                          target.y) /
                        2
                        }%`}
                      dy="-3"
                      fill={
                        edge.critical
                          ? '#B65656'
                          : '#666'
                      }
                      fontSize="2"
                      textAnchor="middle"
                      fontFamily="JetBrains Mono, monospace"
                    >
                      {edge.label}
                    </text>
                  </g>
                );
              }
            )}
          </svg>

          {visibleNodes.map(
            (node) => {
              const Icon =
                ICONS[node.type];

              const selected =
                node.id ===
                selectedNodeId;

              const connected =
                connectedNodes.has(
                  node.id
                );

              return (
                <button
                  key={node.id}
                  type="button"
                  className={`at-investigation-node ${selected
                      ? 'selected'
                      : ''
                    } ${connected
                      ? 'connected'
                      : ''
                    }`}
                  style={{
                    left: `${node.x}%`,
                    top: `${node.y}%`,
                    opacity:
                      getNodeOpacity(
                        node
                      ),
                  }}
                  onClick={() =>
                    setSelectedNodeId(
                      node.id
                    )
                  }
                >
                  <span
                    className="at-investigation-node-orbit"
                    style={{
                      borderColor:
                        selected
                          ? `${severityColor(
                            node.severity
                          )}55`
                          : 'transparent',
                    }}
                  />

                  <span
                    className="at-investigation-node-core"
                    style={{
                      borderColor:
                        selected
                          ? severityColor(
                            node.severity
                          )
                          : undefined,
                    }}
                  >
                    <Icon size={18} />
                  </span>

                  <span
                    className="at-investigation-node-label"
                    title={node.label}
                  >
                    {node.label}
                  </span>

                  <span className="at-investigation-node-type">
                    {TYPE_LABELS[node.type]}
                  </span>
                </button>
              );
            }
          )}

          <button
            type="button"
            className="at-investigation-canvas-clear"
            onClick={() =>
              setSelectedNodeId(
                null
              )
            }
          >
            <Eye size={12} />
            Clear focus
          </button>

          {/* Timeline */}
          <section className="at-investigation-timeline">

            <div className="at-investigation-timeline-header">
              <div>
                <span className="at-investigation-kicker">
                  INVESTIGATION TIMELINE
                </span>

                <strong>
                  Event sequence
                </strong>
              </div>

              <div>
                <button type="button">
                  <Filter size={11} />
                </button>

                <button type="button">
                  <ChevronDown
                    size={11}
                  />
                </button>
              </div>
            </div>

            <div className="at-investigation-timeline-track">

              <div className="at-investigation-timeline-line" />

              {TIMELINE_EVENTS.map(
                (event) => (
                  <button
                    type="button"
                    className="at-investigation-timeline-event"
                    key={`${event.time}-${event.entity}`}
                  >
                    <span className="at-investigation-timeline-time">
                      {event.time}
                    </span>

                    <span
                      className={`at-investigation-timeline-dot ${event.sev}`}
                    />

                    <strong>
                      {event.event}
                    </strong>

                    <code>
                      {event.entity}
                    </code>
                  </button>
                )
              )}
            </div>
          </section>

        </main>

        {/* ====================================================
            RIGHT INSPECTOR
            ==================================================== */}

        <aside className="at-investigation-inspector">

          {!selectedNode ? (
            <div className="at-investigation-no-selection">
              <Network size={28} />

              <strong>
                No Entity Selected
              </strong>

              <span>
                Select a node on the
                graph to inspect its
                properties and context.
              </span>
            </div>
          ) : (
            <>
              <div className="at-investigation-inspector-head">

                <div className="at-investigation-entity-icon">
                  {(() => {
                    const Icon =
                      ICONS[
                      selectedNode
                        .type
                      ];

                    return (
                      <Icon size={19} />
                    );
                  })()}
                </div>

                <div className="at-investigation-entity-copy">
                  <span>
                    {
                      TYPE_LABELS[
                      selectedNode
                        .type
                      ]
                    }
                  </span>

                  <strong
                    title={
                      selectedNode.label
                    }
                  >
                    {
                      selectedNode.label
                    }
                  </strong>
                </div>

              </div>

              <div className="at-investigation-entity-meta">

                {selectedNode.severity && (
                  <span
                    className={`at-investigation-risk-badge ${selectedNode.severity}`}
                  >
                    {
                      selectedNode
                        .severity
                        .toUpperCase()
                    }
                    {' '}
                    RISK
                  </span>
                )}

                <span className="at-investigation-relations-badge">
                  {selectedRelations}
                  {' '}
                  Relations
                </span>

              </div>

              {/* Inspector tabs */}
              <div className="at-investigation-tabs">
                {[
                  'Overview',
                  'Intelligence',
                  'Evidence',
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
                        | 'Intelligence'
                        | 'Evidence'
                      )
                    }
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="at-investigation-inspector-scroll">

                {inspectorTab ===
                  'Overview' && (
                    <div className="at-investigation-inspector-content">

                      <div className="at-investigation-observation-grid">
                        <div>
                          <span>
                            FIRST SEEN
                          </span>

                          <code>
                            2026-09-21
                          </code>
                        </div>

                        <div>
                          <span>
                            LAST SEEN
                          </span>

                          <code>
                            2 mins ago
                          </code>
                        </div>
                      </div>

                      {selectedNode.type ===
                        'ip' && (
                          <>
                            <div className="at-investigation-detail-block">
                              <span>
                                LOCATION
                              </span>

                              <strong>
                                <Globe
                                  size={
                                    12
                                  }
                                />
                                Moscow,
                                Russia
                              </strong>
                            </div>

                            <div className="at-investigation-detail-block">
                              <span>
                                ASN
                              </span>

                              <code>
                                AS207656
                                {' '}
                                (Hosting
                                LLC)
                              </code>
                            </div>
                          </>
                        )}

                      {selectedNode.type ===
                        'hash' && (
                          <div className="at-investigation-detail-block">
                            <span>
                              DETECTION
                              RATIO
                            </span>

                            <strong className="at-investigation-detection">
                              45 / 72

                              <small>
                                VirusTotal
                              </small>
                            </strong>
                          </div>
                        )}

                      <div className="at-investigation-detail-block">
                        <span>
                          TAGS
                        </span>

                        <div className="at-investigation-tags">
                          {TAGS.map(
                            (tag) => (
                              <span
                                key={tag}
                              >
                                {tag}
                              </span>
                            )
                          )}
                        </div>
                      </div>

                    </div>
                  )}

                {inspectorTab ===
                  'Intelligence' && (
                    <div className="at-investigation-empty-panel">
                      <Activity
                        size={20}
                      />

                      <strong>
                        Intelligence
                      </strong>

                      <span>
                        Intelligence
                        enrichment is
                        available for
                        this entity in
                        the investigation
                        workspace.
                      </span>
                    </div>
                  )}

                {inspectorTab ===
                  'Evidence' && (
                    <div className="at-investigation-empty-panel">
                      <FileText
                        size={20}
                      />

                      <strong>
                        Evidence
                      </strong>

                      <span>
                        Evidence associated
                        with this entity
                        can be reviewed
                        from this tab.
                      </span>
                    </div>
                  )}

              </div>

              <div className="at-investigation-inspector-actions">

                <button
                  type="button"
                  className="at-btn at-btn-secondary"
                >
                  <Search size={12} />
                  Pivot Search
                </button>

                <button
                  type="button"
                  className="at-btn at-btn-ghost at-investigation-shield-action"
                >
                  <Shield size={14} />
                </button>

              </div>
            </>
          )}

        </aside>

      </div>
    </div>
  );
}