/** Set via `.env` — see `.env.example`. No production default (required for API calls). */
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? '';

/** ipdata.co — optional; geo enrichment is skipped when unset. */
export const IPDATA_API_KEY = import.meta.env.VITE_IPDATA_API_KEY ?? '';

/** ransomware.live — optional; live victim feed is skipped when unset. */
export const RANSOMWARE_LIVE_API_KEY = import.meta.env.VITE_RANSOMWARE_LIVE_API_KEY ?? '';

/** Google Gemini — optional; AI features are disabled when unset. */
export const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY ?? '';

export const API_ENDPOINTS = {
    // Admin endpoints
    ADMIN_LOGIN: '/AdminRoutes/adminLogin',
    VERIFY_ADMIN_TOKEN: '/AdminRoutes/verifyAdminAuthToken',
    REGISTER_SERVER: '/AdminRoutes/registerServer',
    REGISTER_SHIPPER: '/AdminRoutes/registerShipper',
    LIST_SERVERS: '/AdminRoutes/listServers',
    LIST_SHIPPERS: '/AdminRoutes/listShippers',
    DEACTIVATE_SHIPPER: '/AdminRoutes/deactivateShipper',
    REACTIVATE_SHIPPER: '/AdminRoutes/reactivateShipper',
    DELETE_SERVER: '/AdminRoutes/servers/:serverId',
    DELETE_SHIPPER: '/AdminRoutes/shippers/:shipperId',

    // V1 HoneyPot endpoints (legacy)
    INGEST_LOGS_V1: '/HoneyPotRoutes/ingestHoneyPotLogs',
    GET_LOGS_V1: '/HoneyPotRoutes/getHoneyPotLogs',
    GET_LATEST_LOGS_V1: '/HoneyPotRoutes/getLatestHoneyPotLogs',
    GET_LOG_STATS_V1: '/HoneyPotRoutes/getHoneyPotLogStats',
    GET_HONEYPOT_TYPES: '/HoneyPotRoutes/getHoneyPotTypes',
    GET_HONEYPOT_SERVERS: '/HoneyPotRoutes/getHoneyPotServers',

    // V2 HoneyPot endpoints (recommended)
    INGEST_LOGS_V2: '/HoneyPotRoutes/v2/ingestHoneyPotLogs',
    GET_LOG_EVENTS_V2: '/HoneyPotRoutes/v2/getLogEvents',
    GET_ENTITY_THREAT_INTEL_V2: '/HoneyPotRoutes/v2/getEntityThreatIntel',
    GET_LOG_STATS_V2: '/HoneyPotRoutes/v2/getLogsEventStats',
    GET_PROXY_LOGS_V2: '/HoneyPotRoutes/v2/getLogs/proxy',

    // V3 HoneyPot endpoints (latest)
    GET_HOSTS_V3: '/HoneyPotRoutes/v3/hosts',
    GET_HOST_DETAILS_V3: '/HoneyPotRoutes/v3/hosts/:ip',
    GET_HOST_EVENTS_V3: '/HoneyPotRoutes/v3/hosts/:ip/events',
    GET_HOST_COMMANDS_V3: '/HoneyPotRoutes/v3/hosts/:ip/commands',
    GET_STATS_V3: '/HoneyPotRoutes/v3/stats',
    GET_HOST_FILTERS_V3: '/HoneyPotRoutes/v3/hosts/filters',
    GET_HOST_TIMELINE_V3: '/HoneyPotRoutes/v3/hosts/:ip/timeline',
    GET_ACTIVITY_TIMELINE_V3: '/HoneyPotRoutes/v3/activity/timeline',
    GET_THREAT_MAP_V3: '/HoneyPotRoutes/v3/threat-map',

    // IOC Routes
    IOC_STATS: '/IocRoutes/stats',
    IOC_FEED: '/IocRoutes/feed',
    IOC_FILTERS: '/IocRoutes/filters',
    IOC_SYNC: '/IocRoutes/sync',

    // ── Agent / Infrastructure Routes ──────────────────────────────────────
    // Server overview
    SERVERS_OVERVIEW: '/AdminRoutes/servers/overview',
    SERVER_OVERVIEW: '/AdminRoutes/servers/:serverId/overview',

    // Agent management
    AGENTS_LIST: '/AdminRoutes/agents',
    AGENT_REGISTER: '/AdminRoutes/agents/register',
    AGENT_DETAIL: '/AdminRoutes/agents/:agentId',
    AGENT_DELETE: '/AdminRoutes/agents/:agentId',
    AGENT_HARD_DELETE: '/AdminRoutes/agents/:agentId/hard',
    AGENT_STATUS: '/AdminRoutes/agents/:agentId/status',
    AGENT_INSTALL_SCRIPT: '/AdminRoutes/agents/:agentId/install-script',

    // Container management
    AGENT_CONTAINERS: '/AdminRoutes/agents/:agentId/containers',
    AGENT_CONTAINER_DETAIL: '/AdminRoutes/agents/:agentId/containers/:containerId',
    AGENT_CONTAINER_START: '/AdminRoutes/agents/:agentId/containers/:containerId/start',
    AGENT_CONTAINER_STOP: '/AdminRoutes/agents/:agentId/containers/:containerId/stop',
    AGENT_CONTAINER_RESTART: '/AdminRoutes/agents/:agentId/containers/:containerId/restart',
    AGENT_CONTAINER_REMOVE: '/AdminRoutes/agents/:agentId/containers/:containerId',
    AGENT_CONTAINER_LOGS: '/AdminRoutes/agents/:agentId/containers/:containerId/logs',

    // Deployment templates
    TEMPLATES_LIST: '/AdminRoutes/templates',
    TEMPLATE_CREATE: '/AdminRoutes/templates',
    TEMPLATE_DETAIL: '/AdminRoutes/templates/:templateId',
    TEMPLATE_UPDATE: '/AdminRoutes/templates/:templateId',
    TEMPLATE_DELETE: '/AdminRoutes/templates/:templateId',

    // Stack deployments
    AGENT_DEPLOY: '/AdminRoutes/agents/:agentId/deploy',
    AGENT_DEPLOYMENTS: '/AdminRoutes/agents/:agentId/deployments',
    DEPLOYMENT_START: '/AdminRoutes/deployments/:deploymentId/start',
    DEPLOYMENT_STOP: '/AdminRoutes/deployments/:deploymentId/stop',
    DEPLOYMENT_REMOVE: '/AdminRoutes/deployments/:deploymentId',

    // Metrics & health
    AGENT_METRICS: '/AdminRoutes/agents/:agentId/metrics',
    AGENT_DOCKER_INFO: '/AdminRoutes/agents/:agentId/docker-info',
    PORTAINER_HEALTH: '/AdminRoutes/portainer/health',
} as const;

export const AUTH_CONFIG = {
    TOKEN_KEY: 'admin-auth-token',
    TOKEN_HEADER: 'authtoken',
} as const;
