import { dataProvider } from '../services/dataProvider';
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ElementType,
} from 'react';

import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
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
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

/* -------------------------------------------------------------------------- */
/*                                  Types                                     */
/* -------------------------------------------------------------------------- */

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

type InspectorTab =
  | 'Overview'
  | 'Intelligence'
  | 'Evidence';

type EntityFilter =
  | 'ALL'
  | NodeType;

type SeverityFilter =
  | 'ALL'
  | Severity;

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

/* -------------------------------------------------------------------------- */
/*                              Investigation data                            */
/* -------------------------------------------------------------------------- */

/**
 * Local graph fixture.
 *
 * The current InvestigationPage contract does not receive a graph dataset
 * from AppDataContext/API, so the existing graph model is retained as the
 * page's local investigation workspace dataset rather than inventing a new
 * API contract here.
 */
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

const ICONS: Record<NodeType, ElementType> = {
  ip: Server,
  domain: Globe,
  hash: Hash,
  actor: Users,
  host: Server,
  cve: ShieldAlert,
  mitre: Layers,
};

const TYPE_LABELS: Record<NodeType, string> = {
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
    nodeId: 'n3',
    event: 'Connection Established',
    type: 'network',
    sev: 'medium' as Severity,
  },
  {
    time: '14:23:05',
    entity: 'c2-control-api.ru',
    nodeId: 'n2',
    event: 'DNS Resolution',
    type: 'network',
    sev: 'medium' as Severity,
  },
  {
    time: '14:25:44',
    entity: 'payload_drop.exe',
    nodeId: 'n4',
    event: 'File Dropped',
    type: 'endpoint',
    sev: 'critical' as Severity,
  },
  {
    time: '14:26:10',
    entity: 'SRV-DB-01',
    nodeId: 'n5',
    event: 'Process Execution',
    type: 'endpoint',
    sev: 'critical' as Severity,
  },
  {
    time: '14:26:15',
    entity: 'T1059.001',
    nodeId: 'n7',
    event: 'PowerShell Invoked',
    type: 'detection',
    sev: 'high' as Severity,
  },
];

const SAVED_PIVOTS = [
  {
    label: 'Initial Payload Analysis',
    icon: LayoutDashboard,
    nodeId: 'n4',
  },
  {
    label: 'C2 Infrastructure Pivot',
    icon: Network,
    nodeId: 'n2',
  },
  {
    label: 'Actor Attribution',
    icon: Users,
    nodeId: 'n1',
  },
];

/* -------------------------------------------------------------------------- */
/*                                  Helpers                                   */
/* -------------------------------------------------------------------------- */

function severityColor(
  severity?: Severity,
): string {
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

/* -------------------------------------------------------------------------- */
/*                              Investigation page                            */
/* -------------------------------------------------------------------------- */

export default function InvestigationPage() {
    const [investigations, setInvestigations] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        dataProvider.getInvestigations().then(data => {
            setInvestigations(data);
            setIsLoading(false);
        });
    }, []);

  /* ------------------------------------------------------------------------ */
  /*                                  State                                   */
  /* ------------------------------------------------------------------------ */

  const [selectedNodeId, setSelectedNodeId] =
    useState<string | null>('n4');

  const [inspectorTab, setInspectorTab] =
    useState<InspectorTab>('Overview');

  const [graphQuery, setGraphQuery] =
    useState('');

  const [showFilters, setShowFilters] =
    useState(false);

  const [entityFilter, setEntityFilter] =
    useState<EntityFilter>('ALL');

  const [severityFilter, setSeverityFilter] =
    useState<SeverityFilter>('ALL');

  const [relatedOnly, setRelatedOnly] =
    useState(false);

  const [zoom, setZoom] =
    useState(1);

  const [saveStateMessage, setSaveStateMessage] =
    useState('');

  /* ------------------------------------------------------------------------ */
  /*                         Restore saved workspace                           */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(
        'antitode-investigation-state',
      );

      if (!saved) {
        return;
      }

      const state = JSON.parse(saved) as {
        selectedNodeId?: string | null;
        inspectorTab?: InspectorTab;
        graphQuery?: string;
        entityFilter?: EntityFilter;
        severityFilter?: SeverityFilter;
        relatedOnly?: boolean;
        zoom?: number;
      };

      if (
        state.selectedNodeId === null ||
        MOCK_NODES.some(
          (node) =>
            node.id === state.selectedNodeId,
        )
      ) {
        if (
          typeof state.selectedNodeId !==
          'undefined'
        ) {
          setSelectedNodeId(
            state.selectedNodeId ?? null,
          );
        }
      }

      if (
        state.inspectorTab ===
        'Overview' ||
        state.inspectorTab ===
        'Intelligence' ||
        state.inspectorTab ===
        'Evidence'
      ) {
        setInspectorTab(
          state.inspectorTab,
        );
      }

      if (
        typeof state.graphQuery ===
        'string'
      ) {
        setGraphQuery(
          state.graphQuery,
        );
      }

      if (
        state.entityFilter === 'ALL' ||
        MOCK_NODES.some(
          (node) =>
            node.type ===
            state.entityFilter,
        )
      ) {
        if (
          typeof state.entityFilter !==
          'undefined'
        ) {
          setEntityFilter(
            state.entityFilter,
          );
        }
      }

      if (
        state.severityFilter ===
        'ALL' ||
        ['critical', 'high', 'medium', 'low'].includes(
          state.severityFilter,
        )
      ) {
        if (
          typeof state.severityFilter !==
          'undefined'
        ) {
          setSeverityFilter(
            state.severityFilter,
          );
        }
      }

      if (
        typeof state.relatedOnly ===
        'boolean'
      ) {
        setRelatedOnly(
          state.relatedOnly,
        );
      }

      if (
        typeof state.zoom === 'number'
      ) {
        setZoom(
          Math.min(
            1.8,
            Math.max(0.65, state.zoom),
          ),
        );
      }
    } catch {
      /* Invalid persisted state is safely ignored. */
    }
  }, []);

  /* ------------------------------------------------------------------------ */
  /*                            Selected node                                 */
  /* ------------------------------------------------------------------------ */

  const selectedNode = useMemo(
    () =>
      MOCK_NODES.find(
        (node) =>
          node.id === selectedNodeId,
      ) ?? null,
    [selectedNodeId],
  );

  /* ------------------------------------------------------------------------ */
  /*                         Connected entities                               */
  /* ------------------------------------------------------------------------ */

  const connectedNodes = useMemo(() => {
    if (!selectedNodeId) {
      return new Set<string>();
    }

    const connected =
      new Set<string>([
        selectedNodeId,
      ]);

    for (const edge of MOCK_EDGES) {
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
    }

    return connected;
  }, [selectedNodeId]);

  /* ------------------------------------------------------------------------ */
  /*                               Graph query                                */
  /* ------------------------------------------------------------------------ */

  const visibleNodes = useMemo(() => {
    const needle =
      graphQuery.trim().toLowerCase();

    return MOCK_NODES.filter((node) => {
      if (entityFilter !== 'ALL') {
        if (
          node.type !== entityFilter
        ) {
          return false;
        }
      }

      if (
        severityFilter !== 'ALL'
      ) {
        if (
          node.severity !==
          severityFilter
        ) {
          return false;
        }
      }

      if (
        relatedOnly &&
        !connectedNodes.has(node.id)
      ) {
        return false;
      }

      if (!needle) {
        return true;
      }

      return (
        node.label
          .toLowerCase()
          .includes(needle) ||
        TYPE_LABELS[node.type]
          .toLowerCase()
          .includes(needle)
      );
    });
  }, [
    graphQuery,
    entityFilter,
    severityFilter,
    relatedOnly,
    connectedNodes,
  ]);

  const visibleNodeIds = useMemo(
    () =>
      new Set(
        visibleNodes.map(
          (node) => node.id,
        ),
      ),
    [visibleNodes],
  );

  const visibleEdges = useMemo(
    () =>
      MOCK_EDGES.filter(
        (edge) =>
          visibleNodeIds.has(
            edge.source,
          ) &&
          visibleNodeIds.has(
            edge.target,
          ),
      ),
    [visibleNodeIds],
  );

  const selectedRelations =
    selectedNodeId
      ? MOCK_EDGES.filter(
        (edge) =>
          edge.source ===
          selectedNodeId ||
          edge.target ===
          selectedNodeId,
      )
      : [];

  /* ------------------------------------------------------------------------ */
  /*                     Keep selection visible                              */
  /* ------------------------------------------------------------------------ */

  useEffect(() => {
    if (!selectedNodeId) {
      return;
    }

    if (
      !visibleNodeIds.has(
        selectedNodeId,
      )
    ) {
      setSelectedNodeId(
        visibleNodes[0]?.id ??
        null,
      );
    }
  }, [
    selectedNodeId,
    visibleNodeIds,
    visibleNodes,
  ]);

  /* ------------------------------------------------------------------------ */
  /*                              Opacity                                    */
  /* ------------------------------------------------------------------------ */

  const getNodeOpacity = (
    node: GraphNode,
  ): number => {
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
    edge: GraphEdge,
  ): number => {
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

  /* ------------------------------------------------------------------------ */
  /*                                Actions                                   */
  /* ------------------------------------------------------------------------ */

  const resetWorkspace = () => {
    setGraphQuery('');
    setEntityFilter('ALL');
    setSeverityFilter('ALL');
    setRelatedOnly(false);
    setSelectedNodeId('n4');
    setInspectorTab('Overview');
    setZoom(1);
    setSaveStateMessage('');
  };

  const clearFocus = () => {
    setSelectedNodeId(null);
  };

  const zoomIn = () => {
    setZoom((current) =>
      Math.min(
        1.8,
        Number(
          (current + 0.1).toFixed(2),
        ),
      ),
    );
  };

  const zoomOut = () => {
    setZoom((current) =>
      Math.max(
        0.65,
        Number(
          (current - 0.1).toFixed(2),
        ),
      ),
    );
  };

  const fitGraph = () => {
    setZoom(1);
  };

  const saveState = () => {
    const state = {
      selectedNodeId,
      inspectorTab,
      graphQuery,
      entityFilter,
      severityFilter,
      relatedOnly,
      zoom,
      savedAt:
        new Date().toISOString(),
    };

    try {
      window.localStorage.setItem(
        'antitode-investigation-state',
        JSON.stringify(state),
      );

      setSaveStateMessage(
        'Workspace state saved',
      );

      window.setTimeout(() => {
        setSaveStateMessage('');
      }, 2200);
    } catch {
      setSaveStateMessage(
        'Unable to save workspace state',
      );
    }
  };

  const exportGraph = () => {
    const payload = {
      exportedAt:
        new Date().toISOString(),
      query: graphQuery,
      filters: {
        entity:
          entityFilter,
        severity:
          severityFilter,
        relatedOnly,
      },
      selectedNodeId,
      nodes: visibleNodes,
      edges: visibleEdges,
    };

    downloadFile(
      `antitode-investigation-${new Date()
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

  const activatePivot = (
    nodeId: string,
  ) => {
    setGraphQuery('');
    setEntityFilter('ALL');
    setSeverityFilter('ALL');
    setRelatedOnly(false);
    setSelectedNodeId(nodeId);
    setInspectorTab(
      'Overview',
    );
  };

  const searchSelectedNode = () => {
    if (!selectedNode) {
      return;
    }

    setGraphQuery(
      selectedNode.label,
    );
  };

  /* ------------------------------------------------------------------------ */
  /*                              Render helpers                              */
  /* ------------------------------------------------------------------------ */

  const graphStageStyle: CSSProperties =
  {
    position: 'absolute',
    inset: 0,
    transform: `scale(${zoom})`,
    transformOrigin:
      '50% 50%',
    transition:
      'transform 160ms ease',
  };

  /* ------------------------------------------------------------------------ */
  /*                                  Render                                  */
  /* ------------------------------------------------------------------------ */

  return (
    <div className="at-investigation-page">
      {/* ================================================================
   
   ================================================================ */}

      <header className="at-investigation-toolbar">
        <div className="at-investigation-toolbar-left">
          <div className="at-investigation-identity">
            <div className="at-investigation-identity-mark">
              <Network size={16} />
            </div>

            <div>
              <strong>
                Investigation Workspace
              </strong>

              <span>
                <i />
                Relationship analysis
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
                  event.target.value,
                )
              }
              placeholder="Search graph entities..."
              aria-label="Search graph entities"
              spellCheck={false}
            />

            {graphQuery && (
              <button
                type="button"
                onClick={() =>
                  setGraphQuery('')
                }
                aria-label="Clear graph search"
              >
                <X size={11} />
              </button>
            )}
          </div>
        </div>

        <div className="at-investigation-toolbar-actions">
          <div className="at-investigation-view-tools">
            <button
              type="button"
              title="Zoom In"
              onClick={zoomIn}
            >
              <ZoomIn size={14} />
            </button>

            <button
              type="button"
              title="Fit to Screen"
              onClick={fitGraph}
            >
              <Maximize size={14} />
            </button>

            <button
              type="button"
              title="Zoom Out"
              onClick={zoomOut}
            >
              <ZoomOut size={14} />
            </button>

            <button
              type="button"
              title="Reset workspace"
              onClick={resetWorkspace}
            >
              <RotateCcw size={13} />
            </button>

            <span
              className="at-investigation-zoom-indicator"
              aria-label={`Zoom ${Math.round(
                zoom * 100,
              )}%`}
            >
              {Math.round(
                zoom * 100,
              )}
              %
            </span>
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
                (value) => !value,
              )
            }
            aria-expanded={
              showFilters
            }
          >
            <Filter size={13} />
            Filter
          </button>

          <button
            type="button"
            className="at-investigation-tool-button"
            onClick={exportGraph}
            disabled={
              visibleNodes.length === 0
            }
          >
            <Download size={13} />
            Export
          </button>

          <button
            type="button"
            className="at-investigation-save-button"
            onClick={saveState}
          >
            <Save size={13} />
            Save State
          </button>

          {saveStateMessage && (
            <span
              className="at-investigation-save-message"
              role="status"
              aria-live="polite"
            >
              {saveStateMessage}
            </span>
          )}
        </div>
      </header>

      {/* ================================================================
   
   ================================================================ */}

      {showFilters && (
        <div className="at-investigation-filter-strip">
          <span>
            GRAPH FILTERS
          </span>

          <label>
            <span className="sr-only">
              Entity type
            </span>

            <select
              value={entityFilter}
              onChange={(event) =>
                setEntityFilter(
                  event.target
                    .value as EntityFilter,
                )
              }
            >
              <option value="ALL">
                All entity types
              </option>

              {(
                Object.entries(
                  TYPE_LABELS,
                ) as Array<
                  [NodeType, string]
                >
              ).map(
                ([type, label]) => (
                  <option
                    key={type}
                    value={type}
                  >
                    {label}
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            <span className="sr-only">
              Severity
            </span>

            <select
              value={severityFilter}
              onChange={(event) =>
                setSeverityFilter(
                  event.target
                    .value as SeverityFilter,
                )
              }
            >
              <option value="ALL">
                All severities
              </option>

              <option value="critical">
                Critical
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
            className={
              relatedOnly
                ? 'active'
                : ''
            }
            onClick={() =>
              setRelatedOnly(
                (value) => !value,
              )
            }
            aria-pressed={
              relatedOnly
            }
          >
            Related only
            <ChevronDown size={11} />
          </button>

          <button
            type="button"
            className="reset"
            onClick={resetWorkspace}
          >
            Reset
          </button>
        </div>
      )}

      {/* ================================================================
   
   ================================================================ */}

      <div className="at-investigation-body">
        {/* ================================================================
   
   ================================================================ */}

        <aside className="at-investigation-context">
          <div className="at-investigation-context-section">
            <span className="at-investigation-kicker">
              INVESTIGATION CONTEXT
            </span>

            <div className="at-investigation-context-row">
              <span>
                Workspace
              </span>

              <strong>
                Graph Analysis
              </strong>
            </div>

            <div className="at-investigation-context-row">
              <span>
                Focus
              </span>

              <strong>
                {selectedNode
                  ? selectedNode.label
                  : 'None'}
              </strong>
            </div>

            <div className="at-investigation-context-row">
              <span>
                Visible
              </span>

              <strong>
                {visibleNodes.length}{' '}
                entities
              </strong>
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
                      onClick={() =>
                        activatePivot(
                          pivot.nodeId,
                        )
                      }
                    >
                      <Icon size={12} />

                      <span>
                        {pivot.label}
                      </span>
                    </button>
                  );
                },
              )}
            </div>
          </div>

          <div className="at-investigation-context-section">
            <div className="at-investigation-context-heading">
              <span>
                ENTITY TYPES
              </span>

              <Layers size={11} />
            </div>

            <div className="at-investigation-entity-summary">
              {(
                Object.entries(
                  TYPE_LABELS,
                ) as Array<
                  [NodeType, string]
                >
              ).map(
                ([type, label]) => {
                  const count =
                    visibleNodes.filter(
                      (node) =>
                        node.type === type,
                    ).length;

                  if (count === 0) {
                    return null;
                  }

                  return (
                    <div
                      key={type}
                    >
                      <span>
                        {label}
                      </span>

                      <strong>
                        {count}
                      </strong>
                    </div>
                  );
                },
              )}
            </div>
          </div>

          <div className="at-investigation-context-footer">
            <div>
              <span>
                ENTITIES
              </span>

              <strong>
                {visibleNodes.length}
              </strong>
            </div>

            <div>
              <span>
                RELATIONS
              </span>

              <strong>
                {visibleEdges.length}
              </strong>
            </div>
          </div>
        </aside>

        {/* ================================================================
   
   ================================================================ */}

        <main className="at-investigation-canvas">
          <div className="at-investigation-canvas-grid" />

          <div className="at-investigation-graph-header">
            <div>
              <span>RELATIONSHIP GRAPH</span>
              <strong>
                {selectedNode
                  ? selectedNode.label
                  : 'No focus selected'}
              </strong>
            </div>

            <span>
              {visibleNodes.length} entities
            </span>
          </div>

          <div
            className="at-investigation-graph-stage"
            style={graphStageStyle}
          >
            <svg
              className="at-investigation-edges"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden="true"
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
                        edge.source,
                    );

                  const target =
                    MOCK_NODES.find(
                      (node) =>
                        node.id ===
                        edge.target,
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
                        edge,
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

                      {(
                        !selectedNodeId ||
                        edge.source === selectedNodeId ||
                        edge.target === selectedNodeId
                      ) && (
                        <text
                          x={`${(source.x + target.x) / 2}%`}
                          y={`${(source.y + target.y) / 2}%`}
                          dy="-3"
                          fill={
                            edge.critical
                              ? '#C86669'
                              : '#727880'
                          }
                          fontSize="2"
                          textAnchor="middle"
                          fontFamily="JetBrains Mono, monospace"
                        >
                          {edge.label}
                        </text>
                      )}
                    </g>
                  );
                },
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
                    node.id,
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
                          node,
                        ),
                    }}
                    onClick={() =>
                      setSelectedNodeId(
                        node.id,
                      )
                    }
                    aria-label={`Inspect ${node.label}`}
                  >
                    <span
                      className="at-investigation-node-orbit"
                      style={{
                        borderColor:
                          selected
                            ? `${severityColor(
                              node.severity,
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
                              node.severity,
                            )
                            : undefined,
                      }}
                    >
                      <Icon size={18} />
                    </span>

                    {(selected || connected) && (
                      <span
                        className="at-investigation-node-label"
                        title={node.label}
                      >
                        {node.label}
                      </span>
                    )}
                  </button>
                );
              },
            )}
          </div>

          {/* ================================================================
   
   ================================================================ */}

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
                <button
                  type="button"
                  title="Filter timeline to current focus"
                  onClick={() =>
                    setRelatedOnly(
                      true,
                    )
                  }
                >
                  <Filter size={11} />
                </button>

                <button
                  type="button"
                  title="Reset timeline filters"
                  onClick={() =>
                    setRelatedOnly(
                      false,
                    )
                  }
                >
                  <RotateCcw
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
                    onClick={() =>
                      setSelectedNodeId(
                        event.nodeId,
                      )
                    }
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
                ),
              )}
            </div>
          </section>
        </main>

        {/* ================================================================
   
   ================================================================ */}

        <aside className={`at-investigation-inspector ${!selectedNode ? 'is-empty' : ''}`}>
          {!selectedNode ? (
            <div className="at-investigation-no-selection">
              <Network size={28} />

              <strong>
                No Entity Selected
              </strong>

              <span>
                Select a node on the graph
                to inspect its properties
                and relationships.
              </span>
            </div>
          ) : (
            <>
              <div className="at-investigation-inspector-head">
                <div className="at-investigation-entity-icon">
                  {(() => {
                    const Icon =
                      ICONS[
                      selectedNode.type
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
                      selectedNode.type
                      ]
                    }
                  </span>

                  <strong
                    title={
                      selectedNode.label
                    }
                  >
                    {selectedNode.label}
                  </strong>
                </div>

                <button
                  type="button"
                  className="at-investigation-inspector-close"
                  onClick={() =>
                    setSelectedNodeId(
                      null,
                    )
                  }
                  aria-label="Close entity inspector"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="at-investigation-entity-meta">
                {selectedNode.severity && (
                  <span
                    className={`at-investigation-risk-badge ${selectedNode.severity}`}
                  >
                    {
                      selectedNode.severity.toUpperCase()
                    }
                    {' '}
                    RISK
                  </span>
                )}

                <span className="at-investigation-relations-badge">
                  {
                    selectedRelations.length
                  }{' '}
                  {selectedRelations.length ===
                    1
                    ? 'Relation'
                    : 'Relations'}
                </span>
              </div>

              <div className="at-investigation-inspector-scroll">
                <div className="at-investigation-inspector-content">
                  <div className="at-investigation-focus-card">
                    <span>
                      {TYPE_LABELS[selectedNode.type]}
                    </span>

                    <strong>
                      {selectedNode.label}
                    </strong>

                    {selectedNode.severity && (
                      <div>
                        <span
                          className={`at-investigation-risk-badge ${selectedNode.severity}`}
                        >
                          {selectedNode.severity}
                        </span>

                        <span className="at-investigation-relations-badge">
                          {selectedRelations.length} relations
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="at-investigation-detail-block">
                    <span>IDENTIFIER</span>

                    <code>
                      {selectedNode.id}
                    </code>
                  </div>

                  <div className="at-investigation-detail-block">
                    <span>RELATIONSHIPS</span>

                    {selectedRelations.length > 0 ? (
                      <div className="at-investigation-related-list">
                        {selectedRelations.map((relation) => {
                          const otherNodeId =
                            relation.source === selectedNode.id
                              ? relation.target
                              : relation.source;

                          const otherNode =
                            MOCK_NODES.find(
                              (node) => node.id === otherNodeId,
                            );

                          if (!otherNode) {
                            return null;
                          }

                          return (
                            <button
                              key={relation.id}
                              type="button"
                              className="at-investigation-related-item"
                              onClick={() =>
                                setSelectedNodeId(otherNode.id)
                              }
                            >
                              <span>
                                <strong>
                                  {otherNode.label}
                                </strong>

                                <small>
                                  {relation.label}
                                </small>
                              </span>

                              <ChevronRight size={11} />
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <span className="at-investigation-muted">
                        No relationships recorded.
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    className="at-investigation-inspector-action"
                    onClick={searchSelectedNode}
                  >
                    <Search size={13} />
                    Search this entity
                    <ArrowUpRight size={12} />
                  </button>
                </div>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}