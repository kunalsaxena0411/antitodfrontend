# Xyberah Frontend → Backend Knowledge Transfer

> **Purpose:** This document gives the backend team a complete understanding of how the frontend (`Xyberah-redesign`) is designed, what data it expects, what API contracts it has already defined, and exactly what backend work is needed to make every page live. It is written to be the single reference the backend developer needs to build, fix, and wire up all missing routes.

> **Last Updated:** 2026-10-01

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Tech Stack & Build](#2-tech-stack--build)
3. [Authentication Flow — How It Works Today & What Must Change](#3-authentication-flow)
4. [Routing & Navigation — Every Page the Frontend Renders](#4-routing--navigation)
5. [The Mock System — `dataProvider` & `DEMO_MODE`](#5-the-mock-system)
6. [API Client Layer — How the Frontend Talks to the Backend](#6-api-client-layer)
7. [Frontend API Services — Complete Contract Reference](#7-frontend-api-services)
   - 7.1 [authService](#71-authservice)
   - 7.2 [adminService](#72-adminservice)
   - 7.3 [honeypotService (V1, V2, V3)](#73-honeypotservice)
   - 7.4 [iocService](#74-iocservice)
   - 7.5 [agentService](#75-agentservice)
   - 7.6 [openasmClient (Recon)](#76-openasmclient)
8. [Page-by-Page Data Requirements](#8-page-by-page-data-requirements)
9. [Existing Backend — What's Already Built](#9-existing-backend)
10. [Gap Analysis — What the Backend Must Implement](#10-gap-analysis)
11. [Contract Mismatches to Fix in Existing Routes](#11-contract-mismatches)
12. [ClickUp Task Mapping — All 49 Tasks with Backend Guidance](#12-clickup-task-mapping)
13. [Recommended Implementation Order](#13-recommended-implementation-order)
14. [Environment & Configuration](#14-environment--configuration)
15. [Security Considerations](#15-security-considerations)
16. [Appendix: Complete TypeScript Type Definitions](#16-appendix-types)

---

## 1. Architecture Overview

```
Browser (React + Vite)
  │
  ├─ AuthContext  ←→  localStorage['admin-auth-token']
  │    └─ redirects to /login if no token
  │
  ├─ App.tsx (main shell)
  │    ├─ Global state (results, feeds, analysis queues)
  │    ├─ External feed loading (ransomware, exploits, news, etc.)
  │    ├─ AppDataContext → passes data to all child pages
  │    └─ ViewRouter.tsx
  │         ├─ Migrated pages (src/pages/*)  → use dataProvider → DEMO data today
  │         └─ Legacy views (components/views/*) → direct browser-side API calls
  │
  └─ API Client Layer (api/client.ts)
       ├─ authService.ts     → /AdminRoutes/adminLogin, verifyAdminAuthToken
       ├─ adminService.ts    → /AdminRoutes/* (servers, shippers)
       ├─ honeypotService.ts → /HoneyPotRoutes/* (V1, V2, V3)
       ├─ agentService.ts    → /AdminRoutes/agents/*, templates/*, deployments/*
       ├─ iocService.ts      → /IocRoutes/*
       └─ openasmClient.ts   → /asm/*, /internal/openasm/*
             │
             ▼
       Xyberah Backend (Express)
         ├─ /SuperAdminRoutes  (2 routes — exist)
         ├─ /AdminRoutes       (8 routes — exist, 31+ more needed)
         ├─ /HoneyPotRoutes    (11 routes — V1+V2 exist, 9 V3 missing)
         ├─ /IocRoutes         (4 routes — all missing)
         └─ /AsmRoutes         (entire family — missing)
```

### Key Architectural Fact

The frontend is a **design-review / mock-heavy client**. The file `src/services/dataProvider.ts` has `DEMO_MODE = true`, so all migrated pages render local demo datasets. The backend must implement the APIs so that `DEMO_MODE` can be set to `false` and pages will render real data.

---

## 2. Tech Stack & Build

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Styling | TailwindCSS + custom CSS (15,986 lines in `src/index.css`) |
| HTTP | Axios (via `api/client.ts`) |
| State | React Context (`AuthContext`, `AppDataContext`) + `useState`/`useEffect` |
| Routing | Custom `window.location.pathname` + `history.replaceState` (NOT React Router) |
| Package Manager | Bun (primary) / npm (fallback) |
| Deployment | Vercel (see `vercel.json`) |

### Key files to understand

| File | Purpose |
|------|---------|
| `config/config.ts` | All 63 API endpoint path constants + env vars |
| `api/client.ts` | Axios instance, auth header injection, 401 handling |
| `api/services/*.ts` | Typed API service modules (6 files) |
| `src/services/dataProvider.ts` | Mock/live data facade — **this is what you replace** |
| `hooks/useHoneypotData.ts` | React hook wrapping V2 honeypot APIs |
| `contexts/AuthContext.tsx` | Token storage and auth state |
| `src/contexts/AppDataContext.tsx` | Shared data context for all pages |
| `types.ts` | 1000-line TypeScript type definitions |
| `src/data/routes.ts` | URL → view ID mapping |
| `src/data/navigation.ts` | Sidebar navigation groups and labels |
| `src/components/ViewRouter.tsx` | Routes to correct page component |

---

## 3. Authentication Flow

### How it works TODAY (mocked)

```
User enters credentials
  → authService.login() → returns hardcoded "mock-token-12345" (NO backend call)
  → Token saved to localStorage['admin-auth-token']
  → AuthContext.isAuthenticated = true
  → Redirected to /dashboard
```

### How it MUST work (real)

```
User enters credentials
  → authService.login({AdminEmail, AdminPassword})
  → POST /AdminRoutes/adminLogin
  → Backend returns {message, token}
  → Token saved to localStorage['admin-auth-token']
  → All subsequent requests include header: authtoken: <token>
  → Token verified by AdminAuthMiddleware on every protected route
```

### Auth contract details

| Item | Value |
|------|-------|
| Token storage key | `admin-auth-token` (localStorage) |
| Request header | `authtoken` (lowercase, custom header) |
| Login endpoint | `POST /AdminRoutes/adminLogin` |
| Login body | `{ AdminEmail: string, AdminPassword: string }` |
| Login response | `{ message: string, token: string }` |
| Verify endpoint | `POST /AdminRoutes/verifyAdminAuthToken` |
| Verify response | `{ message: string, success?: boolean }` |
| Logout | Client-side only — removes token from localStorage |
| 401 handling | Client removes token, dispatches `auth-changed` event, redirects to `/login` |

### Backend action needed

1. Login route exists but **password comparison is plaintext** — implement bcrypt hashing (Task #20)
2. Token verification route exists
3. No token expiry — add TTL/expiry (Task #38)
4. No multi-factor auth — needed (Task #21)
5. No real logout endpoint — token should be deleted from `AdminAuthTokenModel`

---

## 4. Routing & Navigation

The frontend uses **custom routing** (NOT React Router). Every page is identified by a `viewId` mapped to a URL slug.

### Complete Page Registry (30 pages)

| View ID | URL | Page Type | Data Source Today | Backend Status |
|---------|-----|-----------|-------------------|----------------|
| `dashboard` | `/dashboard` | Migrated | `dataProvider.getDashboardMetrics` → DEMO | Needs API |
| `honeypot_logs` | `/honeypot-logs` | Migrated | `dataProvider.getAttackEvents` → DEMO | Needs V3 or V2 wiring |
| `soc_wall` | `/soc-wall` | Legacy | App-level `results` state | Fed by App feeds |
| `investigation_bench` | `/investigation-bench` | Legacy | Direct external APIs (OTX, VT, DNS) | BFF decision |
| `playbooks` | `/response-playbooks` | Migrated | `dataProvider.getPlaybooks` → DEMO | Needs API |
| `attackmap` | `/threat-map` | Migrated | `dataProvider.getAttackEvents` → DEMO | Needs V3 threat-map |
| `ransomware` | `/ransomware-monitor` | Legacy | External ransomwatch service | BFF decision |
| `analysis` | `/log-analysis` | Migrated | `dataProvider.getHosts` → DEMO | Needs V3 hosts |
| `investigate` | `/graph-investigation` | Migrated | `dataProvider.getInvestigations` → DEMO | Needs API |
| `network` | `/network-forensics` | Legacy | Client-side PCAP parser | Client-only |
| `email_forensic` | `/email-forensic` | Legacy | Client-side + external | Client-only |
| `dynamic_sandbox` | `/dynamic-sandbox` | Legacy | OTX + OTX Sandbox + Gemini | BFF decision |
| `topology` | `/network-topology` | Legacy | Client-side modeling | Client-only |
| `threat_canvas` | `/threat-canvas` | Legacy | Client-side + Gemini | Client-only |
| `navigator` | `/mitre-navigator` | Migrated | MITRE STIX CDN | Client-only |
| `intel_search` | `/intel-grounding` | Legacy | Gemini Search Grounding | Client-only |
| `actors` | `/threat-actors` | Migrated | `dataProvider.getActors` → DEMO | Needs API or proxy |
| `cve` | `/vulnerabilities` | Migrated | `dataProvider.getCves` → DEMO | Needs API or proxy |
| `exploits` | `/exploit-db` | Legacy | App-level exploit feed | Fed by App feeds |
| `news` | `/intel-feed` | Migrated | `dataProvider.getNews` → DEMO | Needs API or proxy |
| `iocs` | `/ioc-manager` | Migrated | `dataProvider.getIocs` → DEMO | Needs /IocRoutes |
| `brand_intel` | `/brand-intel` | Legacy | Direct external APIs | BFF decision |
| `cyberchef` | `/cyberchef` | Legacy | Client-side | Client-only |
| `nettools` | `/network-tools` | Legacy | Client-side + external | Client-only |
| `webcheck` | `/web-check` | Legacy | Client-side + external | Client-only |
| `sandbox` | `/security-sandbox` | Legacy | Client-side | Client-only |
| `rules` | `/soc-rules` | Migrated | `dataProvider.getRules` → DEMO | Needs API |
| `infrastructure` | `/infrastructure` | Legacy | `adminService` + `agentService` | Partial (servers/shippers exist, agents/containers/deployments missing) |
| `recon` | `/recon` | Legacy | `openasmClient` | Entire ASM family missing |
| `chat` | `/ai-assistant` | Legacy | Gemini chat | Client-only (or BFF) |
| `help` | `/system-guide` | Legacy | Static content | Client-only |

### Navigation Groups

The sidebar is organized into 8 groups: **Operations** (7 items), **Forensics** (5), **Modeling** (3), **Intelligence** (7), **Tools** (5), **Infrastructure** (1), **Reconnaissance** (1), **System** (2). Plus a **Settings** modal (not routed).

---

## 5. The Mock System

### `src/services/dataProvider.ts`

This is the **single most important file** for the backend team. Every migrated page calls methods on this object. Today ALL methods return static demo data.

```typescript
export const DEMO_MODE = true; // ← flip this to false when backend is ready

export const dataProvider = {
  getHosts:             async () => DEMO_HOSTS,
  getCveFeeds:          async () => DEMO_CVE_FEEDS,
  getDashboardMetrics:  async () => DEMO_DASHBOARD,
  getAttackEvents:      async () => DEMO_EVENTS,
  getInvestigations:    async () => DEMO_INVESTIGATIONS,
  getIntelHistory:      async () => DEMO_INTEL_HISTORY,
  getRules:             async () => DEMO_RULES,
  getPlaybooks:         async () => DEMO_PLAYBOOKS,
  getNews:              async () => DEMO_NEWS,     // has live branch (disabled)
  getCves:              async () => DEMO_CVES,     // has live branch (disabled)
  getActors:            async () => DEMO_ACTORS,   // has live branch (disabled)
  getIocs:              async () => DEMO_IOCS,
};
```

### What the backend must provide (mapped to dataProvider methods)

| dataProvider Method | Backend Route Needed | Response Shape |
|--------------------|---------------------|----------------|
| `getDashboardMetrics()` | `GET /api/dashboard/metrics` or aggregate from V3 stats | `{ totalHosts, totalEvents, criticalAlerts, ... }` |
| `getHosts()` | `GET /HoneyPotRoutes/v3/hosts` | `GetHostsV3Response` (see section 7.3) |
| `getAttackEvents()` | `GET /HoneyPotRoutes/v2/getLogEvents` or V3 equivalent | `GetLogEventsV2Response` |
| `getCveFeeds()` | Backend proxy for NVD/CISA feeds or dedicated route | `CveFeedItem[]` |
| `getNews()` | Backend proxy for RSS aggregation or dedicated route | `ThreatNewsItem[]` |
| `getCves()` | Backend proxy for NVD or dedicated route | `CveEntry[]` |
| `getActors()` | Backend proxy for Malpedia or dedicated route | `MalpediaActor[]` |
| `getIocs()` | `GET /IocRoutes/feed` | `IocFeedResponse` |
| `getInvestigations()` | New `/api/investigations` route | Investigation records |
| `getRules()` | New `/api/rules` route | Detection rule records |
| `getPlaybooks()` | New `/api/playbooks` route | Playbook definitions |
| `getIntelHistory()` | New `/api/intel/history` route | Intel search history |

---

## 6. API Client Layer

### `api/client.ts` — the Axios wrapper

Every API call goes through this client. Key behaviors:

1. **Base URL**: Reads `VITE_BACKEND_URL` from environment
2. **Timeout**: 60 seconds
3. **Auth header**: Automatically adds `authtoken: <token>` from localStorage
4. **401 handling**: Removes token, dispatches `auth-changed` event, redirects to `/login`
5. **HTML detection**: If response is HTML (backend down, Vite fallback), rejects with error
6. **Content-Type**: Always sends `application/json`

### Important for backend

- The backend MUST return JSON, never HTML (the client actively rejects HTML responses)
- The backend MUST use `401` status for authentication failures (triggers auto-logout)
- The backend MUST read the auth token from the `authtoken` header (not `Authorization`)
- CORS must allow the frontend origin (currently `origin: '*'`)

---

## 7. Frontend API Services

### 7.1 authService

**File:** `api/services/authService.ts`

| Method | HTTP | Endpoint | Request Body | Response | Backend Status |
|--------|------|----------|-------------|----------|----------------|
| `login(credentials)` | POST | `/AdminRoutes/adminLogin` | `{ AdminEmail, AdminPassword }` | `{ message, token }` | Route exists, but login() is **MOCKED** — never calls backend |
| `verifyToken()` | POST | `/AdminRoutes/verifyAdminAuthToken` | (none) | `{ message }` | Works |
| `logout()` | — | — | — | — | Client-side only |

### 7.2 adminService

**File:** `api/services/adminService.ts`

| Method | HTTP | Endpoint | Request | Response Type | Backend |
|--------|------|----------|---------|---------------|---------|
| `registerServer(data)` | POST | `/AdminRoutes/registerServer` | `{ ServerId, Hostname, PublicIp, Region, PrivateIp?, Provider?, Os? }` | `RegisterServerResponse` | Exists |
| `listServers()` | GET | `/AdminRoutes/listServers` | — | `ListServersResponse` | Exists |
| `registerShipper(data)` | POST | `/AdminRoutes/registerShipper` | `{ ServerId, AllowedIp }` | `RegisterShipperResponse` | Exists but response mismatch — frontend expects `deployment` and `instructions` fields |
| `listShippers()` | GET | `/AdminRoutes/listShippers` | — | `ListShippersResponse` | Exists |
| `deactivateShipper(data)` | POST | `/AdminRoutes/deactivateShipper` | `{ ShipperId }` | `{ message }` | Exists |
| `reactivateShipper(data)` | POST | `/AdminRoutes/reactivateShipper` | `{ ShipperId }` | `{ message }` | Exists |
| `deleteServer(serverId)` | DELETE | `/AdminRoutes/servers/:serverId` | — | `DeleteServerResponse` | **Missing** |
| `deleteShipper(shipperId)` | DELETE | `/AdminRoutes/shippers/:shipperId` | — | `DeleteShipperResponse` | **Missing** |

#### Frontend type: `RegisterShipperResponse` (what the frontend expects)

```typescript
{
  message: string;
  shipper: { ShipperId, ServerId, AllowedIp, Token };
  deployment: {          // ← BACKEND DOES NOT RETURN THIS
    installCommand: string;
    installScriptUrl: string;
    shipperBundleUrl: string;
    backendUrl: string;
  };
  instructions: string[]; // ← BACKEND DOES NOT RETURN THIS
  warning: string;
}
```

#### Frontend type: `DeleteServerResponse`

```typescript
{
  message: string;
  deleted: { server: string; agents: number; shippers: number; deployments: number; };
}
```

#### Frontend type: `DeleteShipperResponse`

```typescript
{
  message: string;
  deleted: { shipperId: string; serverId: string; };
}
```

### 7.3 honeypotService

**File:** `api/services/honeypotService.ts` (746 lines, 3 service objects)

#### V1 Service (`honeypotServiceV1`) — Legacy, PostgreSQL

| Method | HTTP | Endpoint | Params | Response | Backend |
|--------|------|----------|--------|----------|---------|
| `getLogs(params?)` | GET | `/HoneyPotRoutes/getHoneyPotLogs` | `serverId?, honeypotType?, containerName?, startDate?, endDate?, limit?, offset?, sortOrder?` | `GetLogsV1Response` | Exists |
| `getLatestLogs(params?)` | GET | `/HoneyPotRoutes/getLatestHoneyPotLogs` | `since?, limit?` | `GetLatestLogsV1Response` | Exists |
| `getLogStats(params?)` | GET | `/HoneyPotRoutes/getHoneyPotLogStats` | `startDate?, endDate?, serverId?` | `LogStatsV1Response` | Exists |
| `getHoneypotTypes()` | GET | `/HoneyPotRoutes/getHoneyPotTypes` | — | `GetHoneypotTypesResponse` | Exists |
| `getHoneypotServers()` | GET | `/HoneyPotRoutes/getHoneyPotServers` | — | `GetHoneypotServersResponse` | Exists |

#### V2 Service (`honeypotServiceV2`) — ClickHouse + Threat Intel

| Method | HTTP | Endpoint | Params/Body | Response | Backend |
|--------|------|----------|-------------|----------|---------|
| `ingestLogs(data)` | POST | `/HoneyPotRoutes/v2/ingestHoneyPotLogs` | `{ logs: HoneyPotLogV2[] }` | `IngestLogsV2Response` | Exists but **contract mismatch** (see section 11) |
| `getLogEvents(params?)` | GET | `/HoneyPotRoutes/v2/getLogEvents` | `limit?, offset?, honeypot?, event_type?, src_ip?, start_time?, end_time?` | `GetLogEventsV2Response` | Exists but **response differs** |
| `getEntityThreatIntel(entityId)` | GET | `/HoneyPotRoutes/v2/getEntityThreatIntel/:entity_id` | path: `entity_id` | `EntityThreatIntelV2` | Exists but **param mismatch** (controller reads `type`, `value` instead of `entity_id`) |
| `getLogStats(params?)` | GET | `/HoneyPotRoutes/v2/getLogsEventStats` | `time_range?, group_by?` | `LogStatsV2Response` | Exists but **response missing `success` and richer fields** |
| `getProxyLogs()` | GET | `/HoneyPotRoutes/v2/getLogs/proxy` | `limit?, offset?` | `GetProxyLogsResponse` | Works |

#### V3 Service (`honeypotServiceV3`) — ALL MISSING from backend

| Method | HTTP | Endpoint | Params | Response | Backend |
|--------|------|----------|--------|----------|---------|
| `getHosts(params?)` | GET | `/HoneyPotRoutes/v3/hosts` | `search?, q?, risk_level?, limit?, offset?, start_time?, end_time?, country?, honeypot?, detection_label?, threat_category?, sort_by?, sort_order?` | `GetHostsV3Response` | Missing |
| `getThreatMap(params?)` | GET | `/HoneyPotRoutes/v3/threat-map` | Same filters as hosts, no pagination | `ThreatMapV3Response` | Missing |
| `getHostDetails(params)` | GET | `/HoneyPotRoutes/v3/hosts/:ip` | `include_enrichment?` | `GetHostDetailsV3Response` | Missing |
| `getHostEvents(params)` | GET | `/HoneyPotRoutes/v3/hosts/:ip/events` | `limit?, offset?` | `GetHostEventsV3Response` | Missing |
| `getHostCommands(ip)` | GET | `/HoneyPotRoutes/v3/hosts/:ip/commands` | — | `GetHostCommandsV3Response` | Missing |
| `getStats()` | GET | `/HoneyPotRoutes/v3/stats` | — | `StatsV3` | Missing |
| `getHostFilters()` | GET | `/HoneyPotRoutes/v3/hosts/filters` | — | `HostFiltersV3` | Missing |
| `getHostTimeline(params)` | GET | `/HoneyPotRoutes/v3/hosts/:ip/timeline` | `granularity?, start_time?, end_time?, honeypot?` | `HostTimelineV3Response` | Missing |
| `getActivityTimeline(params?)` | GET | `/HoneyPotRoutes/v3/activity/timeline` | `granularity?, start_time?, end_time?, honeypot?, event_type?` | `ActivityTimelineV3Response` | Missing |

**V3 is the most critical missing family.** The dashboard, honeypot logs page, attack map, and log analysis page all need V3 data.

#### Complete V3 Response Types (copy these into your backend)

```typescript
// GET /v3/hosts response
interface GetHostsV3Response {
  hosts: HostV3[];
  total: number;
  returned: number;
  limit: number;
  offset: number;
  has_more: boolean;
  sort_by?: string;
  sort_order?: string;
  search?: string | null;
}

interface HostV3 {
  src_ip: string;
  first_seen: string;
  last_seen: string;
  active_days: number;
  activity_dates: string[];
  total_events: number;
  total_commands: number;
  unique_sessions: number;
  threat_score: number;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  detection_labels: string[];
  geo_country: string;
  geo_city: string;
  geo_lat: number;
  geo_lon: number;
  asn_number: number;
  asn_org: string;
  ip_is_cloud: boolean;
  ip_is_tor: boolean;
  ip_is_private: boolean;
  honeypots_targeted: string[];
  last_updated: string;
  dns_hostname: string | null;
}

// GET /v3/hosts/:ip response
interface GetHostDetailsV3Response {
  host: HostV3;
  enrichment?: {
    geo: { country: string; city: string; lat: number; lon: number; timezone: string; };
    asn: { number: number; org: string; };
    flags: { is_cloud: boolean; is_tor: boolean; is_private: boolean; is_vpn: boolean; is_proxy: boolean; };
    reputation: {
      abuseipdb: { abuse_confidence_score: number; total_reports: number; country_code: string; usage_type: string; isp: string; domain: string; is_whitelisted: boolean; };
      otx: { pulse_count: number; pulses: Array<{ name: string; description: string; created: string; tags: string[]; }>; };
    };
  };
}

// GET /v3/stats response
interface StatsV3 {
  total_hosts: number;
  total_events: number;
  hosts_by_risk: Array<{ risk_level: string; count: number; }>;
  top_countries: Array<{ country: string; count: number; }>;
}

// GET /v3/hosts/filters response
interface HostFiltersV3 {
  risk_levels: string[];
  countries: string[];
  honeypots: string[];
  detection_labels: string[];
  threat_categories: Array<{ label: string; signal_type: string; }>;
  date_range: { min: string | null; max: string | null; };
}

// GET /v3/hosts/:ip/timeline response
interface HostTimelineV3Response {
  ip: string;
  granularity: string;
  total_events: number;
  buckets: Array<{ time: string; total_events: number; event_types?: string[]; honeypots?: string[]; }>;
}

// GET /v3/activity/timeline response
interface ActivityTimelineV3Response {
  granularity: string;
  total_events: number;
  peak?: { time: string; events: number; };
  buckets: Array<{ time: string; total_events: number; unique_ips: number; event_types?: string[]; honeypots?: string[]; }>;
}
```

### 7.4 iocService

**File:** `api/services/iocService.ts` — ALL routes missing from backend

| Method | HTTP | Endpoint | Params/Body | Response | Backend |
|--------|------|----------|-------------|----------|---------|
| `getStats()` | GET | `/IocRoutes/stats` | — | `IocStatsResponse` | Missing |
| `getFeed(params?)` | GET | `/IocRoutes/feed` | `search?, source?, type?, threat?, loc?, page?, limit?, sortBy?, sortDir?` | `IocFeedResponse` | Missing |
| `getFilters()` | GET | `/IocRoutes/filters` | — | `IocFiltersResponse` | Missing |
| `sync(body?)` | POST | `/IocRoutes/sync` | `{ source? }` | `IocSyncResponse` | Missing |

#### IOC Types

```typescript
interface IocStatsResponse {
  success: boolean;
  data: { total_indicators: number; active_network_iocs: number; file_hashes: number; new_24h: number; };
}

interface IocFeedItem {
  indicator_type: string;    // 'ip' | 'network' | 'domain' | 'url' | 'hash'
  indicator_value: string;
  source: string;            // 'abuseipdb' | 'urlhaus' | 'malwarebazaar' | 'spamhaus' | 'alienvault_otx'
  threat: string;
  severity: string;          // 'critical' | 'high' | 'medium' | 'low'
  confidence: number;
  tags: string[];
  loc: string | null;
  first_seen: string;
  last_seen: string;
  ingested_at: string;
}

interface IocFeedResponse {
  success: boolean;
  data: IocFeedItem[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

interface IocFiltersResponse {
  success: boolean;
  data: { sources: string[]; threats: string[]; locs: string[]; };
}

interface IocSyncResponse {
  success: boolean;
  data: { summary: Record<string, number>; total: number; };
}
```

### 7.5 agentService

**File:** `api/services/agentService.ts` (538 lines) — ALL routes missing from backend

This is the largest missing API family. It covers server overview, agent management, container management, deployment templates, stack deployments, and metrics.

#### Server Overview (2 endpoints)

| Method | HTTP | Endpoint | Response |
|--------|------|----------|----------|
| `getServersOverview()` | GET | `/AdminRoutes/servers/overview` | `ServersOverviewResponse` |
| `getServerOverview(serverId)` | GET | `/AdminRoutes/servers/:serverId/overview` | `ServerDetailResponse` |

#### Agent Management (7 endpoints)

| Method | HTTP | Endpoint | Request/Params | Response |
|--------|------|----------|---------------|----------|
| `listAgents()` | GET | `/AdminRoutes/agents` | — | `ListAgentsResponse` |
| `registerAgent(data)` | POST | `/AdminRoutes/agents/register` | `{ ServerId }` | `RegisterAgentResponse` |
| `getAgentDetail(agentId)` | GET | `/AdminRoutes/agents/:agentId` | — | `AgentDetailResponse` |
| `deleteAgent(agentId)` | DELETE | `/AdminRoutes/agents/:agentId` | — | `{ message }` |
| `hardDeleteAgent(agentId)` | DELETE | `/AdminRoutes/agents/:agentId/hard` | — | `DeleteAgentHardResponse` |
| `getAgentStatus(agentId)` | GET | `/AdminRoutes/agents/:agentId/status` | — | `AgentStatusResponse` |
| `getInstallScript(agentId)` | GET | `/AdminRoutes/agents/:agentId/install-script` | `full?` | `AgentInstallScriptResponse` |

#### Container Management (5 endpoints)

| Method | HTTP | Endpoint | Params | Response |
|--------|------|----------|--------|----------|
| `listContainers(agentId)` | GET | `/AdminRoutes/agents/:agentId/containers` | `all?` | `ListContainersResponse` |
| `containerAction(agentId, containerId, action)` | POST | `.../containers/:containerId/{start\|stop\|restart}` | — | `{ message }` |
| `removeContainer(agentId, containerId)` | DELETE | `.../containers/:containerId` | — | `{ message }` |
| `getContainerLogs(agentId, containerId)` | GET | `.../containers/:containerId/logs` | `tail?` | `ContainerLogsResponse` |

#### Templates (5 endpoints)

| Method | HTTP | Endpoint | Request | Response |
|--------|------|----------|---------|----------|
| `listTemplates(params?)` | GET | `/AdminRoutes/templates` | `category?, active?` | `ListTemplatesResponse` |
| `createTemplate(data)` | POST | `/AdminRoutes/templates` | `CreateTemplateRequest` | `{ message, template }` |
| `getTemplate(templateId)` | GET | `/AdminRoutes/templates/:templateId` | — | `{ template }` |
| `updateTemplate(templateId, data)` | PUT | `/AdminRoutes/templates/:templateId` | `Partial<DeploymentTemplate>` | `{ message, template }` |
| `deleteTemplate(templateId)` | DELETE | `/AdminRoutes/templates/:templateId` | — | `{ message }` |

#### Deployments (4 endpoints)

| Method | HTTP | Endpoint | Request | Response |
|--------|------|----------|---------|----------|
| `deployStack(agentId, data)` | POST | `/AdminRoutes/agents/:agentId/deploy` | `DeployStackRequest` | `DeployStackResponse` |
| `listDeployments(agentId)` | GET | `/AdminRoutes/agents/:agentId/deployments` | — | `ListDeploymentsResponse` |
| `deploymentAction(deploymentId, action)` | POST | `.../deployments/:deploymentId/{start\|stop}` | — | `{ message }` |
| `removeDeployment(deploymentId)` | DELETE | `.../deployments/:deploymentId` | — | `{ message }` |

#### Metrics and Health (2 endpoints)

| Method | HTTP | Endpoint | Response |
|--------|------|----------|----------|
| `getMetrics(agentId)` | GET | `/AdminRoutes/agents/:agentId/metrics` | `AgentMetrics` |
| `getPortainerHealth()` | GET | `/AdminRoutes/portainer/health` | `PortainerHealthResponse` |

### 7.6 openasmClient

**File:** `api/services/openasmClient.ts` (670 lines) — Entire ASM family missing

This client handles Xyberah Recon (attack surface management). It uses a completely different URL prefix (`/asm/*` and `/internal/openasm/*`). The backend has no corresponding router.

Key operations: workspace CRUD, target management, asset discovery, vulnerability scanning, worker management, statistics/dashboard.

> **Note for backend:** This is a substantial feature area. Unless the recon feature is being actively worked on in the current sprint, this can be deferred.

---

## 8. Page-by-Page Data Requirements

### Pages that need NEW backend routes

| Page | What it needs from backend |
|------|--------------------------|
| **Dashboard** | V3 stats, V3 hosts (top threats), V3 activity timeline, IOC stats, news feed |
| **Honeypot Logs** | V3 hosts (primary), V2 events (drilldown), V3 host timeline |
| **Attack Map** | V3 threat-map endpoint, V3 hosts with geo data |
| **Log Analysis** | V3 hosts with command analysis |
| **Threat Actors** | Either proxy Malpedia or dedicated actors endpoint |
| **Vulnerabilities (CVE)** | Either proxy NVD/CISA or dedicated CVE endpoint |
| **Intel Feed (News)** | Either proxy RSS feeds or dedicated news endpoint |
| **IOC Manager** | Full /IocRoutes family (stats, feed, filters, sync) |
| **SOC Rules** | New rules CRUD endpoint |
| **Playbooks** | New playbooks CRUD endpoint |
| **Graph Investigation** | New investigations CRUD endpoint |
| **Infrastructure** | Full agent/container/template/deployment family |

### Pages that work WITHOUT backend changes

| Page | Why it does not need backend |
|------|----------------------------|
| Network Forensics | Client-side PCAP analysis |
| Email Forensic | Client-side + external APIs (direct from browser) |
| Network Topology | Client-side modeling engine |
| Threat Canvas | Client-side + Gemini (direct from browser) |
| MITRE Navigator | Loads from public MITRE CDN |
| CyberChef | Client-side transformation |
| Network Tools | Direct external API calls |
| Web Check | Direct external checks |
| Security Sandbox | Client-side |
| System Guide | Static content |

---

## 9. Existing Backend — What's Already Built

### Active Routes (21 total)

| Family | Method | Route | Notes |
|--------|--------|-------|-------|
| SuperAdmin | POST | `/SuperAdminRoutes/SuperAdminLogin` | Has OR bug in credential check |
| SuperAdmin | POST | `/SuperAdminRoutes/verifyAuthToken` | Works |
| Admin | POST | `/AdminRoutes/adminLogin` | Plaintext password comparison |
| Admin | POST | `/AdminRoutes/verifyAdminAuthToken` | Works |
| Admin | POST | `/AdminRoutes/registerServer` | Works |
| Admin | GET | `/AdminRoutes/listServers` | Works |
| Admin | POST | `/AdminRoutes/registerShipper` | Response missing deployment/instructions |
| Admin | GET | `/AdminRoutes/listShippers` | Works |
| Admin | POST | `/AdminRoutes/deactivateShipper` | Works |
| Admin | POST | `/AdminRoutes/reactivateShipper` | Works |
| HoneyPot V1 | POST | `/HoneyPotRoutes/ingestHoneyPotLogs` | ShipperAuth |
| HoneyPot V1 | GET | `/HoneyPotRoutes/getHoneyPotLogs` | Works |
| HoneyPot V1 | GET | `/HoneyPotRoutes/getLatestHoneyPotLogs` | Works |
| HoneyPot V1 | GET | `/HoneyPotRoutes/getHoneyPotLogStats` | Works |
| HoneyPot V1 | GET | `/HoneyPotRoutes/getHoneyPotTypes` | Works |
| HoneyPot V1 | GET | `/HoneyPotRoutes/getHoneyPotServers` | Works |
| HoneyPot V2 | POST | `/HoneyPotRoutes/v2/ingestHoneyPotLogs` | Contract mismatch |
| HoneyPot V2 | GET | `/HoneyPotRoutes/v2/getLogEvents` | Response differs |
| HoneyPot V2 | GET | `/HoneyPotRoutes/v2/getEntityThreatIntel/:entity_id` | Param mismatch |
| HoneyPot V2 | GET | `/HoneyPotRoutes/v2/getLogsEventStats` | Response missing fields |
| HoneyPot V2 | GET | `/HoneyPotRoutes/v2/getLogs/proxy` | Works |

### Database Layers

| Store | Used For |
|-------|---------|
| **PostgreSQL** (Sequelize) | Admin creds/tokens, servers, shippers, V1 logs, OTP |
| **ClickHouse** | V2 events (`honeypot.events`), threat signals, entity scores, threat detections |
| **In-memory** | V2 proxy/showcase logs |

### Backend Services (already implemented)

- `scoring.service.ts` — Threat score calculation
- `detections.service.ts` — Threat detection matching
- `signals.service.ts` — Signal generation
- `enrichment.service.ts` — IP enrichment (GeoIP, AbuseIPDB, OTX, IP flags)
- `geoip.service.ts` — MaxMind GeoLite2 integration
- `abuseipdb.service.ts` — AbuseIPDB lookups
- `otx.service.ts` — AlienVault OTX pulse lookups
- `ipflags.service.ts` — Cloud/Tor/VPN/proxy detection

### Background Jobs (exist but NOT started by entrypoint)

- Enrichment worker (every ~30s)
- Signal generation (every ~5min)
- MaxMind database update (weekly)

> **Action:** Uncomment `startBackgroundJobs()` in `index.ts` after verifying the workers.

---

## 10. Gap Analysis — What the Backend Must Implement

### Summary Counts

| Category | Missing Routes | Priority |
|----------|---------------|----------|
| Admin Delete | 2 | High |
| V3 Honeypot | 9 | **Critical** |
| IOC | 4 | High |
| Agent/Infrastructure | 25 | High |
| Metrics/Health | 2 | Medium |
| Templates | 5 | Medium |
| Deployments | 4 | Medium |
| Server Overview | 2 | Medium |
| Recon/ASM | ~20+ | Low (Phase 3) |
| **Total** | **~53+** | — |

### Route-by-Route Missing List

#### Critical Priority (blocks dashboard + core pages)

```
GET  /HoneyPotRoutes/v3/hosts
GET  /HoneyPotRoutes/v3/hosts/:ip
GET  /HoneyPotRoutes/v3/hosts/:ip/events
GET  /HoneyPotRoutes/v3/hosts/:ip/commands
GET  /HoneyPotRoutes/v3/stats
GET  /HoneyPotRoutes/v3/hosts/filters
GET  /HoneyPotRoutes/v3/hosts/:ip/timeline
GET  /HoneyPotRoutes/v3/activity/timeline
GET  /HoneyPotRoutes/v3/threat-map
```

#### High Priority (blocks IOC + Infrastructure pages)

```
GET  /IocRoutes/stats
GET  /IocRoutes/feed
GET  /IocRoutes/filters
POST /IocRoutes/sync

DELETE /AdminRoutes/servers/:serverId
DELETE /AdminRoutes/shippers/:shipperId

GET  /AdminRoutes/servers/overview
GET  /AdminRoutes/servers/:serverId/overview
GET  /AdminRoutes/agents
POST /AdminRoutes/agents/register
GET  /AdminRoutes/agents/:agentId
DELETE /AdminRoutes/agents/:agentId
DELETE /AdminRoutes/agents/:agentId/hard
GET  /AdminRoutes/agents/:agentId/status
GET  /AdminRoutes/agents/:agentId/install-script
GET  /AdminRoutes/agents/:agentId/containers
POST /AdminRoutes/agents/:agentId/containers/:containerId/start
POST /AdminRoutes/agents/:agentId/containers/:containerId/stop
POST /AdminRoutes/agents/:agentId/containers/:containerId/restart
DELETE /AdminRoutes/agents/:agentId/containers/:containerId
GET  /AdminRoutes/agents/:agentId/containers/:containerId/logs
```

#### Medium Priority (templates, deployments, metrics)

```
GET  /AdminRoutes/templates
POST /AdminRoutes/templates
GET  /AdminRoutes/templates/:templateId
PUT  /AdminRoutes/templates/:templateId
DELETE /AdminRoutes/templates/:templateId

POST /AdminRoutes/agents/:agentId/deploy
GET  /AdminRoutes/agents/:agentId/deployments
POST /AdminRoutes/deployments/:deploymentId/start
POST /AdminRoutes/deployments/:deploymentId/stop
DELETE /AdminRoutes/deployments/:deploymentId

GET  /AdminRoutes/agents/:agentId/metrics
GET  /AdminRoutes/agents/:agentId/docker-info
GET  /AdminRoutes/portainer/health
```

---

## 11. Contract Mismatches to Fix in Existing Routes

These routes exist but **will break** if the frontend calls them as-is:

### 1. V2 Ingestion Schema Mismatch

**Frontend sends:**
```json
{ "logs": [{ "src_ip": "1.2.3.4", "src_port": 22, "dst_port": 80, "username": "root" }] }
```

**Backend expects:**
```json
{ "logs": [{ "src": {"ip": "1.2.3.4", "port": 22}, "dst": {"ip": "5.6.7.8", "port": 80} }] }
```

**Fix:** Either normalize in the backend controller or update the frontend type. Backend fix is preferred.

### 2. V2 Ingestion Response Mismatch

**Frontend expects:** `{ success: true, ingested: 5, enriched_entities: ["1.2.3.4"], timestamp: "..." }`

**Backend returns:** `{ message: "Logs ingested successfully", count: 5 }`

### 3. V2 Event Query Response Differences

**Frontend expects additional fields:** `username`, `password`, `command`, `raw_log`, `severity`, `country`, `countryCode`

**Backend returns:** ClickHouse-centric fields + `threat: { threat_score, risk_level, detections }`

**Frontend also expects `success` field** — backend does not return it.

### 4. V2 Entity Threat Intel Parameter Bug

**Route:** `/v2/getEntityThreatIntel/:entity_id`

**Bug:** Controller reads `const { type, value } = req.params;` but route only provides `entity_id`. Both `type` and `value` will be `undefined`.

**Frontend calls:** `GET /HoneyPotRoutes/v2/getEntityThreatIntel/<entity_id>/<entity_id>` (double-appends ID due to client code bug too).

**Fix:** Change controller to read `const { entity_id } = req.params;` and treat it as an IP address.

### 5. V2 Stats Response Too Sparse

**Frontend expects (LogStatsV2Response):**
```json
{
  "success": true,
  "time_range": "24h",
  "total_events": 1000,
  "unique_source_ips": 50,
  "unique_targets": 10,
  "top_honeypots": [],
  "top_event_types": [],
  "top_attacking_ips": [],
  "geographic_distribution": [],
  "high_threat_entities": 5,
  "new_attackers_24h": 12
}
```

**Backend returns:**
```json
{
  "total_events": 1000,
  "by_honeypot": [],
  "by_risk_level": {}
}
```

### 6. Register Shipper Response Missing Fields

Frontend expects `deployment` and `instructions` objects. Backend only returns `shipper` + `warning`.

### 7. SuperAdmin Login OR Bug

`SuperAdminLogin` checks `email === emailFromDB || password === passwordFromDB` — should be `&&`.

---

## 12. ClickUp Task Mapping

> Based on the task screenshots provided. Each task is mapped to specific backend implementation work.

### Task 1: IOC APIs — stats, feed, filters, sync
**Backend work:** Create `/IocRoutes` router, mount in `index.ts`. Implement 4 endpoints:
- `GET /IocRoutes/stats` — aggregate IOC counts from a new ClickHouse or Postgres table
- `GET /IocRoutes/feed` — paginated query with search/filter/sort
- `GET /IocRoutes/filters` — distinct values for source, threat, location
- `POST /IocRoutes/sync` — trigger re-ingestion from external feeds (AbuseIPDB, URLhaus, MalwareBazaar, etc.)

**Frontend types:** See `api/services/iocService.ts` for exact request/response contracts.

### Task 2: Agent, Container, Template, and Deployment APIs, plus Portainer health
**Backend work:** Implement all 25 agent-family endpoints under `/AdminRoutes/agents/*`, `/AdminRoutes/templates/*`, `/AdminRoutes/deployments/*`, `/AdminRoutes/portainer/*`. These need Portainer API integration for container lifecycle management.

**Frontend types:** See `api/services/agentService.ts` for all 25 endpoint contracts.

### Task 3: V3 hosts, threat map, and timeline APIs
**Backend work:** Implement 9 V3 endpoints under `/HoneyPotRoutes/v3/*`. These aggregate ClickHouse data into host-centric views with threat scoring, geo enrichment, and timeline bucketing.

**Frontend types:** See `api/services/honeypotService.ts` V3 section for all response types.

### Task 4: Dedicated backend for Dashboard
**Backend work:** Create a dashboard aggregation endpoint that combines V3 stats, recent threat activity, IOC stats, and news feeds into a single response. Or have the frontend call V3 stats + activity timeline + IOC stats separately.

### Task 5: Dedicated backend for Attack Map
**Backend work:** Implement `GET /HoneyPotRoutes/v3/threat-map` — returns geo-located threat data for map visualization.

### Task 6: Add tenant/owner column across schema, Servers, Shippers, ClickHouse
**Backend work:** Add `TenantId` or `OwnerId` column to `ServersModel`, `ShippersModel`, `LogsModel`, and ClickHouse tables. This is foundational for multi-tenancy.

### Task 7: Enforce tenant isolation in every query and endpoint
**Backend work:** Add middleware that extracts tenant from JWT/token, applies tenant filter to every database query. Every controller must scope queries by `TenantId`.

### Task 8: Bring honeypot ingestion and query routes under permission checks
**Backend work:** Add RBAC middleware to honeypot routes. Currently they only check auth, not permissions.

### Task 9: Record which admin registered a server or shipper (AdminID on register)
**Backend work:** Add `RegisteredBy` or `AdminId` column to `ServersModel` and `ShippersModel`. Populate from `req.admin` (set by `AdminAuthMiddleware`).

### Task 10: Add audit trail for group, user, and permission changes
**Backend work:** Create `AuditLogModel` table. Log all CRUD operations on users, groups, and permissions with who/what/when.

### Task 11: Add delete group and remove user endpoints
**Backend work:**
- `DELETE /AdminRoutes/servers/:serverId` — cascade delete agents, shippers, deployments
- `DELETE /AdminRoutes/shippers/:shipperId` — delete shipper record
- User group management endpoints (if not already planned)

### Task 12: Plan and tier definitions with feature entitlements
**Backend work:** Design `TiersModel` and `EntitlementsModel`. Each tier (Free, Pro, Enterprise) maps to feature flags and usage limits.

### Task 13: Subscription and billing cycle management
**Backend work:** Create subscription lifecycle endpoints — create, upgrade, downgrade, cancel, renew.

### Task 14: Payment gateway integration
**Backend work:** Integrate Stripe or equivalent. Webhook handlers for payment events.

### Task 15: Usage metering (API calls, honeypot count, data volume)
**Backend work:** Implement usage tracking middleware that counts API calls, honeypot events, and data volume per tenant per billing period.

### Task 16: Invoicing and receipts
**Backend work:** Generate invoice records from usage data + subscription tier. PDF export endpoint.

### Task 17: Plan enforcement middleware
**Backend work:** Middleware that checks tenant's current plan entitlements before allowing actions (e.g., max honeypots, max API calls).

### Task 18: Customer self-service billing portal endpoints
**Backend work:** Endpoints for customers to view invoices, update payment method, change plan.

### Task 19: Customer signup and onboarding flow
**Backend work:** Registration endpoint (not just admin login), email verification, initial workspace setup.

### Task 20: Real password hashing
**Backend work:** Replace plaintext password comparison in `AdminAuth.controller.ts` and `SuperAdmin.controller.ts` with bcrypt. Migrate existing stored passwords.

### Task 21: Multi-factor authentication
**Backend work:** TOTP-based MFA using the existing `OtpModel`. Add MFA verification step after password check. Consider using `speakeasy` or `otplib`.

### Task 22: Rate limiting
**Backend work:** Add `express-rate-limit` or equivalent middleware. Different limits for auth routes vs data routes.

### Task 23: Security middleware and TLS termination
**Backend work:** Add helmet, HSTS, CSP headers. TLS termination is typically handled by reverse proxy (nginx/Cloudflare).

### Task 24: General audit logging beyond RBAC
**Backend work:** Log all API requests with admin ID, IP, timestamp, action, resource.

### Task 25: Reporting and export endpoints (CSV, JSON, client-side)
**Backend work:** Add export endpoints that return CSV/JSON for hosts, events, IOCs, etc. The frontend has `services/exporter.ts` that can handle client-side export, but server-side is needed for large datasets.

### Task 26: Data encryption at rest and in transit
**Backend work:** Enable PostgreSQL encryption at rest, ClickHouse encryption, TLS for all connections.

### Task 27: CI/CD pipeline and production monitoring (Prometheus/Grafana)
**Backend work:** Add `/metrics` endpoint (Prometheus format), health check endpoints, CI/CD configuration.

### Task 28: Decide billing layer timing (this push or Phase 3)
**Decision task.** Tasks 12-18 depend on this.

### Task 29: CVE page shows N/A for every CVSS score (DONE)
Frontend fix — already completed.

### Task 30: Login accepts any email and password (mock authService always succeeds)
**Backend work:** Unmock `authService.login()` — change it to actually call `POST /AdminRoutes/adminLogin`. Backend route exists; just need to fix password hashing (Task #20) first.

### Task 31: Login screen branded XYBERAH while shell is ANTITODE (DONE)
Frontend fix — already completed.

### Task 32: README claims single URL navigation (DONE)
Documentation fix — already completed.

### Task 33: Leftover debug console.log statements (DONE)
Frontend fix — already completed.

### Task 34: Two competing lockfiles (bun.lock and package-lock.json)
**Fix:** Remove one lockfile and standardize on one package manager.

### Task 35: Fix SuperAdmin credential check (OR to AND)
**Backend work:** In `SuperAdmin.controller.ts`, change `||` to `&&` in the credential check:
```typescript
// WRONG: if (email === dbEmail || password === dbPassword)
// RIGHT: if (email === dbEmail && password === dbPassword)
```

### Task 36: Remove hardcoded live credentials
**Backend work:** Audit all source files for hardcoded API keys, tokens, passwords. Move to `.env`.

### Task 37: Fix ClickHouse column name bugs breaking score recalculation and enrichment
**Backend work:** Review ClickHouse queries in scoring/detection/enrichment services for column name mismatches. The `signal-generator.worker.ts` is known to have field/argument issues.

### Task 38: Add expiry to admin and super admin auth tokens
**Backend work:** Add `ExpiresAt` column to `AdminAuthTokenModel` and `SuperAdminAuthTokenModel`. Check expiry in auth middleware. Set reasonable TTL (e.g., 24h).

### Task 39: Stop logging raw auth tokens in AdminAuth.middleware.ts
**Backend work:** Remove or redact token values from log statements in middleware.

### Task 40: Decide tenant isolation model
**Decision task.** Choose between dedicated honeypot per customer or shared pool with tenant column filtering. Impacts Tasks 6 and 7.

### Task 41: Build Shodan, Censys, and OSINT-based ASM scanning modules
**Backend work:** Create scanning service modules that integrate with Shodan and Censys APIs. Feed results into the recon/ASM system.

### Task 42: Build customer-facing IP and domain submission with risk assessment
**Backend work:** Create endpoint for customers to submit IPs/domains for risk scoring. Use existing enrichment services.

### Task 43: Decide ML analytics engine vs renegotiate heuristic scoring
**Decision task.** Current scoring is rule-based in `scoring.service.ts`. Decide if ML is needed.

### Task 44: Build SOAR and SIEM connectors
**Backend work:** Create webhook/integration endpoints for Splunk, QRadar, Sentinel, etc.

### Task 45: Add PDF and STIX/TAXII export formats
**Backend work:** Add PDF report generation and STIX 2.1/TAXII endpoints for IOC sharing.

### Task 46: Verify honeypot depth against reference features document
**Audit task.** Compare implemented honeypot types against spec.

### Task 47: Get evidence of IP data accuracy
**Validation task.** Verify GeoIP and threat intel enrichment accuracy.

### Task 48: Confirm no part of the codebase requires written approval (Section 16.2)
**Legal/compliance task.**

### Task 49: Decide Go-based honeypot stack or accept TypeScript as equivalent
**Decision task.** Impacts architecture but not the API layer.

---

## 13. Recommended Implementation Order

### Phase 1: Foundation (do first)

1. **Fix auth** — Task #20 (bcrypt), #30 (unmock login), #35 (SuperAdmin OR bug), #38 (token expiry), #39 (stop logging tokens)
2. **Fix existing V2 mismatches** — All 6 contract issues in section 11
3. **Enable background jobs** — Uncomment `startBackgroundJobs()` in `index.ts`
4. **Enable model sync** — Uncomment `syncEachModel()` in `index.ts`

### Phase 2: Core Data APIs

5. **V3 Honeypot family** (Task #3) — 9 endpoints, unlocks dashboard, honeypot logs, attack map, log analysis
6. **IOC family** (Task #1) — 4 endpoints, unlocks IOC Manager page
7. **Admin delete endpoints** (Task #11) — 2 endpoints
8. **Dashboard backend** (Task #4) — aggregation endpoint or let frontend compose from V3

### Phase 3: Infrastructure

9. **Agent/Container/Deployment family** (Task #2) — 25 endpoints, unlocks Infrastructure page
10. **Server overview** — 2 endpoints
11. **Template management** — 5 endpoints

### Phase 4: Multi-tenancy & Security

12. **Tenant columns** (Task #6)
13. **Tenant isolation** (Task #7)
14. **Permission checks** (Task #8)
15. **Audit trail** (Tasks #9, #10, #24)
16. **Rate limiting** (Task #22)
17. **Security middleware** (Task #23)

### Phase 5: Billing & Advanced Features

18. **Billing/subscription** (Tasks #12-18)
19. **Customer onboarding** (Task #19)
20. **MFA** (Task #21)
21. **Export/reporting** (Tasks #25, #45)
22. **ASM/Recon** (Tasks #41, #42)
23. **SOAR/SIEM** (Task #44)

---

## 14. Environment & Configuration

### Frontend `.env` (what the backend URL is read from)

```env
VITE_BACKEND_URL=http://localhost:3000    # Backend base URL
VITE_IPDATA_API_KEY=                      # Optional: geo enrichment
VITE_RANSOMWARE_LIVE_API_KEY=             # Optional: ransomware feed
VITE_GEMINI_API_KEY=                      # Optional: AI features
```

### Backend `.env.example` (what the backend needs)

```env
PORT=3000
NODE_ENV=development

# PostgreSQL
PG_HOST=localhost
PG_PORT=5432
PG_DATABASE=xyberah
PG_USER=postgres
PG_PASSWORD=

# ClickHouse
CLICKHOUSE_HOST=localhost
CLICKHOUSE_PORT=8123
CLICKHOUSE_USER=default
CLICKHOUSE_PASSWORD=
CLICKHOUSE_DATABASE=honeypot

# External APIs (for enrichment services)
ABUSEIPDB_API_KEY=
OTX_API_KEY=
MAXMIND_LICENSE_KEY=
```

### Important: The frontend reads `authtoken` header, NOT `Authorization`

All your backend middleware must check `req.headers.authtoken`, which is already how `AdminAuthMiddleware` works.

---

## 15. Security Considerations

These are current security issues the backend team should address:

| # | Issue | Severity | Task |
|---|-------|----------|------|
| 1 | **Plaintext passwords** — AdminLogin and SuperAdminLogin compare passwords as plain strings | Critical | #20 |
| 2 | **SuperAdmin login OR bug** — checks `email OR password` instead of `email AND password` | Critical | #35 |
| 3 | **No token expiry** — tokens never expire once created | High | #38 |
| 4 | **Raw tokens logged** — AdminAuth.middleware.ts logs raw auth tokens | High | #39 |
| 5 | **CORS wide open** — `origin: '*'` in production | High | — |
| 6 | **No rate limiting** — no request throttling on any endpoint | High | #22 |
| 7 | **Hardcoded credentials** — possible hardcoded live creds in source | High | #36 |
| 8 | **Mock login** — frontend never validates against backend | Medium | #30 |
| 9 | **No MFA** — single-factor auth only | Medium | #21 |
| 10 | **Model sync disabled** — database tables may not be created | Medium | — |

---

## 16. Appendix: Complete TypeScript Type Definitions

All frontend types that the backend must conform to are defined in these files:

| File | Lines | Contains |
|------|-------|---------|
| `types.ts` | 1000 | Core domain types (AnalyzedHost, CveEntry, CaseFile, etc.) |
| `api/services/authService.ts` | 52 | LoginCredentials, LoginResponse, VerifyTokenResponse |
| `api/services/adminService.ts` | 204 | Server, Shipper, and all admin request/response types |
| `api/services/honeypotService.ts` | 746 | V1, V2, V3 log/event/host/stats types |
| `api/services/agentService.ts` | 538 | Agent, Container, Template, Deployment, Metrics types |
| `api/services/iocService.ts` | 123 | IOC indicator, feed, filter, sync types |
| `api/services/openasmClient.ts` | 670 | Workspace, Target, Asset, Vulnerability types for Recon |

> **Critical:** These TypeScript interfaces are the API contract. Your backend responses MUST match these shapes exactly, or the frontend will break. When in doubt, consult the specific service file — it is the source of truth for what the frontend expects.

---

## Quick Reference: File Location Cheat Sheet

```
Xyberah-redesign/
  config/config.ts              <- All 63 endpoint constants
  api/
    client.ts                   <- Axios instance (auth header, 401 handling)
    services/
      authService.ts            <- Login (MOCKED), verify, logout
      adminService.ts           <- Servers + shippers CRUD
      honeypotService.ts        <- V1 + V2 + V3 honeypot APIs
      agentService.ts           <- Agents, containers, templates, deployments
      iocService.ts             <- IOC stats/feed/filters/sync
      openasmClient.ts          <- Recon/ASM (entire family missing)
  hooks/
    useHoneypotData.ts          <- React hook for V2 data
  contexts/
    AuthContext.tsx              <- Token management
  src/
    services/
      dataProvider.ts           <- DEMO_MODE = true (THE SWITCH)
    contexts/
      AppDataContext.tsx         <- Shared data for all pages
    data/
      routes.ts                 <- URL to view ID mapping
      navigation.ts             <- Sidebar groups
      demo/                     <- All static demo datasets
    pages/                      <- All migrated page components
  components/
    views/                      <- All legacy view components
  types.ts                      <- 1000-line type definitions
```

---

> **End of Knowledge Transfer Document.** This should give the backend team everything needed to build, fix, and connect all backend APIs to the Xyberah frontend. For any questions about frontend behavior, consult the specific source files referenced throughout this document.
