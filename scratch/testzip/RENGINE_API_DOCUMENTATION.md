# ReNgine API Documentation — Full E2E Guide

This document provides complete API documentation for integrating a frontend with ReNgine via the Xyberah reverse proxy. All paths are relative to the proxy base: **`/rengine/`**.

---

## Table of Contents

1. [Architecture & Authentication](#1-architecture--authentication)
2. [Proxy Path Mapping](#2-proxy-path-mapping)
3. [API Reference](#3-api-reference)
4. [E2E Scenarios](#4-e2e-scenarios)
5. [Data Models & Enums](#5-data-models--enums)
6. [Error Handling](#6-error-handling)

---

## 1. Architecture & Authentication

### Request Flow

```
Frontend  ──►  POST /AdminRoutes/adminLogin  ──►  Xyberah Backend (returns authtoken)
Frontend  ──►  GET/POST /rengine/api/...     ──►  Xyberah Backend  ──►  ReNgine (Django)
                    [authtoken header]              [injects sessionid + csrftoken]
```

### Required Headers

| Header        | Required For | Description                                      |
|---------------|--------------|--------------------------------------------------|
| `authtoken`   | All requests | Xyberah admin auth token from `adminLogin`        |
| `x-csrftoken` | POST/PUT/DELETE | CSRF token from `GET /rengine/_proxy/csrf` |
| `Content-Type`| POST/PUT     | `application/json` for JSON bodies               |

### CSRF Token Flow

```ts
// 1. Fetch CSRF token before mutating requests
const res = await fetch('/rengine/_proxy/csrf', {
  headers: { authtoken: localStorage.getItem('authtoken')! },
});
const { csrftoken } = await res.json();

// 2. Include in mutating requests
fetch('/rengine/api/add/target/', {
  method: 'POST',
  headers: {
    authtoken: localStorage.getItem('authtoken')!,
    'Content-Type': 'application/json',
    'x-csrftoken': csrftoken,
  },
  body: JSON.stringify({ domain_name: 'example.com', slug: 'default' }),
});
```

---

## 2. Proxy Path Mapping

### ReNgine Paths (behind `/rengine/` proxy)

| ReNgine Path (behind proxy) | Description                    |
|-----------------------------|--------------------------------|
| `/rengine/api/*`            | REST API (JSON)                |
| `/rengine/target/*`         | Target management (HTML + some JSON) |
| `/rengine/scan/*`           | Scan management (HTML forms)   |
| `/rengine/_proxy/csrf`      | CSRF token endpoint (Xyberah)  |

### Mapping from Frontend Integration Guide

| Guide Path | Actual ReNgine Path | Notes |
|------------|---------------------|-------|
| `/api/listTargets/` | `/api/listTargets/` | ✓ Same |
| `/api/addTarget/` | `/api/add/target/` | Different path |
| `/api/deleteTarget/<id>/` | `/target/delete/target/<id>/` | **Not under /api/**; POST required |
| `/api/listScans/` | `/api/listScanHistory/` | Use `?project=<slug>` |
| `/api/startScan/` | **Not in ReNgine** | Implement in Xyberah backend |
| `/api/queryAllAssets/` | Multiple: `querySubdomains`, `listEndpoints`, `listVulnerability` | No single endpoint |
| `/api/queryAllEndpoints/` | `/api/listEndpoints/` or `/api/queryEndpoints/` | |
| `/api/queryAllVulnerability/` | `/api/listVulnerability/` | |
| `/api/queryAllSubdomains/` | `/api/querySubdomains/` or `/api/listDatatableSubdomain/` | |
| `/api/getDashboardUpdate/` | `/api/scan_status/` | Use `?project=<slug>` |

**Important:** Full scan initiation is **not** exposed as a REST API in ReNgine. It is done via HTML form POST. See [Appendix: Full Scan Start](#appendix-full-scan-start-backend-implementation) for how to implement it in your Xyberah backend.

---

## 3. API Reference

### 3.1 Targets (Domains)

#### List Targets (Datatable)

```
GET /rengine/api/listTargets/
```

**Query Parameters:**

| Param  | Type   | Description                          |
|--------|--------|--------------------------------------|
| `slug` | string | Project slug (e.g. `default`)       |
| `format` | string | `datatables` for DataTables server-side |

**DataTables params** (when `format=datatables`): `search[value]`, `order[0][column]`, `order[0][dir]`, `start`, `length`.

**Response:** Array of target objects (Domain serializer).

```json
[
  {
    "id": 1,
    "name": "example.com",
    "description": "Bug bounty scope",
    "insert_date": "Mar 18, 2025",
    "start_scan_date": "Mar 17, 2025",
    "vuln_count": 5,
    "organization": ["Acme Corp"],
    "most_recent_scan": 42,
    "project": 1
  }
]
```

---

#### Add Target

```
POST /rengine/api/add/target/
```

**Request Body:**

| Field           | Type   | Required | Description                          |
|-----------------|--------|----------|--------------------------------------|
| `domain_name`   | string | Yes      | Domain, IP, or URL (validated)      |
| `description`   | string | No       | Target description                  |
| `slug`          | string | Yes      | Project slug                         |
| `organization`  | string | No       | Organization name to tag target     |
| `h1_team_handle`| string | No       | HackerOne team handle                |

**Example:**

```json
{
  "domain_name": "example.com",
  "description": "Bug bounty scope",
  "slug": "default",
  "organization": "Acme Corp"
}
```

**Response (success):**

```json
{
  "status": true,
  "message": "Domain successfully added as target !",
  "domain_name": "example.com"
}
```

**Response (failure):**

```json
{
  "status": false,
  "message": "Invalid domain or IP"
}
```

---

#### Delete Target (Non-API — use proxy)

ReNgine does **not** expose target deletion via REST API. The UI uses:

```
POST /rengine/target/delete/target/<id>/
```

**Headers:** `x-csrftoken`, `authtoken`, `Content-Type: application/x-www-form-urlencoded` (or form-data with CSRF).

**Response:**

```json
{ "status": "true" }
```

**Note:** Your Xyberah proxy must forward this POST. The path is under `/target/`, not `/api/`.

---

### 3.2 Scan History

#### List Scan History

```
GET /rengine/api/listScanHistory/
```

**Query Parameters:**

| Param    | Type   | Description     |
|----------|--------|-----------------|
| `project`| string | Project slug    |

**Response:** Array of scan history objects.

```json
[
  {
    "id": 42,
    "subdomain_count": 150,
    "endpoint_count": 1200,
    "vulnerability_count": 8,
    "current_progress": 100,
    "completed_time": 3600,
    "elapsed_time": "1h 0m",
    "completed_ago": "2 hours ago",
    "start_scan_date": "2025-03-18T10:00:00Z",
    "scan_status": 2,
    "domain": { "id": 1, "name": "example.com" },
    "scan_type": { "id": 1, "engine_name": "Full Scan" },
    "tasks": ["subdomain_discovery", "fetch_url", "vulnerability_scan"]
  }
]
```

**Scan Status Values:** `-1` = Initiated, `0` = Failed, `1` = Running, `2` = Success, `3` = Aborted.

---

#### Scan Status (Ongoing & Pending)

```
GET /rengine/api/scan_status/
```

**Query Parameters:**

| Param    | Type   | Description     |
|----------|--------|-----------------|
| `project`| string | Project slug    |

**Response:**

```json
{
  "scans": {
    "pending": [...],
    "scanning": [...],
    "completed": [...]
  },
  "tasks": {
    "pending": [...],
    "running": [...],
    "completed": [...]
  }
}
```

---

### 3.3 Subdomains

#### List Subdomains (Datatable / JSON)

```
GET /rengine/api/listDatatableSubdomain/
```

**Query Parameters:**

| Param           | Type   | Description                          |
|-----------------|--------|--------------------------------------|
| `project`       | string | Project slug (required)              |
| `scan_id`       | int    | Filter by scan history ID           |
| `target_id`     | int    | Filter by domain ID                  |
| `query_param`    | string | Domain name filter                  |
| `ip_address`    | string | Filter by IP                        |
| `name`          | string | Exact subdomain name                |
| `is_important`   | flag   | Only important subdomains           |
| `only_directory`| flag   | Only subdomains with directories    |
| `format`        | string | `datatables` or `json`              |
| `no_page`       | flag   | Disable pagination                  |

**Response:** Array of subdomain objects with `name`, `http_url`, `http_status`, `page_title`, `content_length`, `ip_addresses`, `technologies`, etc.

---

#### Query Subdomains (Simple List)

```
GET /rengine/api/querySubdomains/
```

**Query Parameters:** `scan_id`, `target_id`, `project`, `ip_address`, `port`, `tech`, `only_important`, `no_lookup_interesting`.

**Response:**

```json
{
  "subdomains": [
    {
      "id": 1,
      "name": "api.example.com",
      "http_url": "https://api.example.com",
      "http_status": 200,
      "page_title": "API",
      "content_length": 1024,
      "is_important": false
    }
  ]
}
```

---

#### List Subdomain Changes (Added/Removed)

```
GET /rengine/api/listSubdomainChanges/
```

**Query Parameters:** `scan_id` (required), `changes` (`added` | `removed` | omit for both), `format=datatables`.

---

### 3.4 Vulnerability Report (HackerOne)

```
GET /rengine/api/vulnerability/report/
```

**Query Parameters:** `vulnerability_id` (required).

**Response:** `{ "status": true }` or `{ "status": false }` — reports vulnerability to HackerOne if configured.

---

### 3.5 Endpoints

#### List Endpoints

```
GET /rengine/api/listEndpoints/
```

**Query Parameters:**

| Param           | Type   | Description                    |
|-----------------|--------|--------------------------------|
| `project`       | string | Project slug                  |
| `scan_history`  | int    | Scan ID                       |
| `target_id`     | int    | Domain ID                     |
| `subdomain_id`  | int    | Subdomain ID                  |
| `gf_tag`        | string | GF pattern filter             |
| `only_urls`     | flag   | Return only `http_url`        |
| `format`        | string | `datatables` or `json`        |

**Response:**

```json
{
  "endpoints": [
    {
      "id": 1,
      "http_url": "https://api.example.com/login",
      "http_status": 200,
      "page_title": "Login",
      "content_length": 2048,
      "content_type": "text/html"
    }
  ]
}
```

---

#### Query Endpoints (Simple)

```
GET /rengine/api/queryEndpoints/
```

**Query Parameters:** `scan_id`, `target_id`, `subdomain_name`, `pattern`, `only_urls`.

---

### 3.6 Vulnerabilities

#### List Vulnerabilities

```
GET /rengine/api/listVulnerability/
```

**Query Parameters:**

| Param             | Type   | Description              |
|-------------------|--------|--------------------------|
| `project`         | string | Project slug             |
| `scan_history`    | int    | Scan ID                  |
| `target_id`       | int    | Domain ID                |
| `subdomain_id`    | int    | Subdomain ID             |
| `subdomain`       | string | Subdomain name           |
| `domain`          | string | Domain name              |
| `severity`        | int    | 0=Info, 1=Low, 2=Med, 3=High, 4=Critical, -1=Unknown |
| `vulnerability_name` | string | Filter by name        |
| `format`          | string | `datatables` or `json`   |

**Response:** Array of vulnerability objects with `name`, `severity`, `http_url`, `description`, `template`, `cvss_score`, etc.

---

### 3.7 Subscans (Sub-tasks)

#### List Subscans

```
POST /rengine/api/listSubScans/
```

**Request Body:**

| Field           | Type | Description                    |
|-----------------|------|--------------------------------|
| `subdomain_id`  | int  | Filter by subdomain            |
| `scan_history_id` | int | Filter by scan                |
| `domain_id`     | int  | Filter by domain               |

**Response:**

```json
{
  "status": true,
  "results": [
    {
      "id": 1,
      "type": "port_scan",
      "subdomain_name": "api.example.com",
      "start_scan_date": "2025-03-18T10:00:00Z",
      "stop_scan_date": "2025-03-18T10:05:00Z",
      "status": 2,
      "engine": "Full Scan"
    }
  ]
}
```

---

#### Initiate Subscan

```
POST /rengine/api/action/initiate/subtask/
```

**Request Body:**

| Field          | Type  | Description                          |
|----------------|-------|--------------------------------------|
| `subdomain_ids`| int[] | Subdomain IDs to run subscan on      |
| `engine_id`    | int   | Scan engine ID                      |
| `tasks`        | string[] | Task types, e.g. `["port_scan", "vulnerability_scan", "fetch_url", "dir_file_fuzz", "screenshot", "subdomain_discovery"]` |

**Response:**

```json
{ "status": true }
```

---

#### Fetch Subscan Results

```
GET /rengine/api/fetch/results/subscan/
```

**Query Parameters:** `subscan_id` (required).

**Response:**

```json
{
  "subscan": {
    "id": 1,
    "type": "port_scan",
    "subdomain_name": "api.example.com",
    "status": 2
  },
  "result": [ /* IPs, vulnerabilities, endpoints, etc. depending on task type */ ]
}
```

---

### 3.8 Scan Engines

#### List Engines

```
GET /rengine/api/listEngines/
```

**Response:**

```json
{
  "engines": [
    {
      "id": 1,
      "engine_name": "Full Scan",
      "default_engine": true,
      "tasks": ["subdomain_discovery", "fetch_url", "port_scan", "vulnerability_scan", "screenshot"]
    }
  ]
}
```

---

### 3.9 Projects

#### Create Project

```
GET /rengine/api/action/create/project
```

**Query Parameters:** `name` (project name; slug is auto-generated).

**Response:**

```json
{
  "status": true,
  "project_name": "My Project"
}
```

---

### 3.10 Organizations

#### List Organizations

```
GET /rengine/api/listOrganizations/
```

**Response:** `{ "organizations": [...] }`

---

#### Query Targets in Organization

```
GET /rengine/api/queryTargetsInOrganization/
```

**Query Parameters:** `organization_id`.

---

#### Query Targets Without Organization

```
GET /rengine/api/queryTargetsWithoutOrganization/
```

---

### 3.11 Scan Actions

#### Stop Scan

```
POST /rengine/api/action/stop/scan/
```

**Request Body:**

```json
{
  "scan_ids": [42, 43],
  "subscan_ids": [10, 11]
}
```

**Response:** `{ "status": true }` or `{ "status": false, "message": "..." }`

---

#### Delete Subdomains

```
POST /rengine/api/action/subdomain/delete/
```

**Request Body:** `{ "subdomain_ids": [1, 2, 3] }`

---

#### Delete Vulnerabilities

```
POST /rengine/api/action/vulnerability/delete/
```

**Request Body:** `{ "vulnerability_ids": [1, 2, 3] }`

---

#### Delete Multiple Rows (Subscans, Organizations)

```
POST /rengine/api/action/rows/delete/
```

**Request Body:**

```json
{
  "type": "subscan",
  "rows": [1, 2, 3]
}
```

`type` can be `subscan` or `organization`.

---

### 3.12 Toggle Subdomain Important

```
POST /rengine/api/toggle/subdomain/important/
```

**Request Body:** `{ "subdomain_id": 1 }`

---

### 3.13 Recon Notes / Todos

#### Add Recon Note

```
POST /rengine/api/add/recon_note/
```

**Request Body:**

| Field         | Type   | Description      |
|---------------|--------|------------------|
| `subdomain_id`| int    | Optional         |
| `title`       | string | Note title       |
| `description` | string | Note content     |
| `project`     | string | Project slug     |

---

#### List Todo Notes

```
GET /rengine/api/listTodoNotes/
```

**Query Parameters:** `scan_id`, `project`, `target_id`, `todo_id`, `subdomain_id`.

---

### 3.14 Toolbox / Utilities

#### WHOIS Lookup

```
GET /rengine/api/tools/whois/
```

**Query Parameters:** `target` (domain or IP), `is_reload` (optional, force refresh).

---

#### Reverse WHOIS

```
GET /rengine/api/tools/reverse/whois/
```

**Query Parameters:** `lookup_keyword`.

---

#### IP to Domain

```
GET /rengine/api/tools/ip_to_domain/
```

**Query Parameters:** `ip_address` (required; supports CIDR).

---

#### Domain IP History

```
GET /rengine/api/tools/domain_ip_history
```

**Query Parameters:** `domain`.

---

#### CMS Detector

```
GET /rengine/api/tools/cms_detector/
```

**Query Parameters:** `url` (required).

---

#### CVE Details

```
GET /rengine/api/tools/cve_details/
```

**Query Parameters:** `cve_id` (e.g. `CVE-2024-1234`).

---

#### WAF Detector

```
GET /rengine/api/tools/waf_detector/
```

**Query Parameters:** `url` (required).

---

### 3.15 Analytics & Insights

#### Fetch Most Vulnerable (Targets/Subdomains)

```
POST /rengine/api/fetch/most_vulnerable/
```

**Request Body:**

| Field           | Type   | Description                    |
|-----------------|--------|--------------------------------|
| `slug`          | string | Project slug                  |
| `scan_history_id` | int  | Filter by scan                |
| `target_id`     | int    | Filter by domain              |
| `limit`         | int    | Default 20                    |
| `ignore_info`   | bool   | Exclude info severity         |

---

#### Fetch Most Common Vulnerability

```
POST /rengine/api/fetch/most_common_vulnerability/
```

**Request Body:** Same as above.

---

### 3.16 Search

#### Universal Search

```
GET /rengine/api/search/
```

**Query Parameters:** `query` (required).

**Response:** `{ "status": true, "results": { "subdomains": [...], "endpoints": [...], "vulnerabilities": [...] } }`

---

#### Search History

```
GET /rengine/api/search/history/
```

---

### 3.17 Visualisation

#### Query Scan Result Visualisation

```
GET /rengine/api/queryAllScanResultVisualise/
```

**Query Parameters:** `scan_id`.

---

### 3.18 Other Query Endpoints

| Endpoint | Method | Key Params | Description |
|----------|--------|------------|-------------|
| `/api/queryTechnologies/` | GET | `scan_id`, `target_id` | Technologies by scan/target |
| `/api/queryPorts/` | GET | `scan_id`, `target_id`, `ip_address` | Open ports |
| `/api/queryIps/` | GET | `scan_id`, `target_id`, `port` | IP addresses |
| `/api/queryInterestingSubdomains/` | GET | `scan_id`, `target_id` | Interesting subdomains |
| `/api/queryInterestingSubdomains/` (path) | GET | - | Same, different path |
| `/api/queryOsintUsers/` | GET | `scan_id` | OSINT users |
| `/api/queryMetadata/` | GET | `scan_id` | Metadata |
| `/api/queryEmails/` | GET | `scan_id` | Emails |
| `/api/queryEmployees/` | GET | `scan_id` | Employees |
| `/api/queryDorks/` | GET | `scan_id`, `type` | Google dorks |
| `/api/queryDorkTypes/` | GET | `scan_id` | Dork types |
| `/api/listInterestingKeywords/` | GET | - | Interesting keywords |
| `/api/listDatatableSubdomain/` | GET | - | Subdomains datatable |
| `/api/listIps/` | GET | `scan_id` | IPs (datatable) |
| `/api/listDirectories/` | GET | `scan_history`, `subdomain_id` | Directories |
| `/api/listActivityLogs/` | GET | `activity_id` | Activity logs |
| `/api/listScanLogs/` | GET | `scan_id` | Scan logs |

---

### 3.19 Notifications

#### List Notifications

```
GET /rengine/api/notifications/
```

**Query Parameters:** `project_slug`.

---

#### Mark Notification Read

```
POST /rengine/api/notifications/<id>/mark_read/
```

---

#### Mark All Read

```
POST /rengine/api/notifications/mark_all_read/
```

**Body:** `{ "project_slug": "default" }` (optional).

---

#### Unread Count

```
GET /rengine/api/notifications/unread_count/
```

**Query Parameters:** `project_slug`.

---

#### Clear All

```
POST /rengine/api/notifications/clear_all/
```

---

### 3.20 HackerOne / BountyHub

#### List HackerOne Programs

```
GET /rengine/api/hackerone-programs/
```

**Query Parameters:** `sort_by` (age|name|reports), `sort_order` (asc|desc).

---

#### Bookmarked Programs

```
GET /rengine/api/hackerone-programs/bookmarked_programs/
```

---

#### Bounty Programs

```
GET /rengine/api/hackerone-programs/bounty_programs/
```

---

#### Program Details

```
GET /rengine/api/hackerone-programs/<handle>/program_details/
```

---

#### Import Programs

```
POST /rengine/api/hackerone-programs/import_programs/
```

**Query Parameters:** `project_slug`.

**Request Body:** `{ "handles": ["acme", "other"] }`

---

#### Sync Bookmarked

```
GET /rengine/api/hackerone-programs/sync_bookmarked/
```

**Query Parameters:** `project_slug`.

---

### 3.21 Bug Bounty Mode

```
POST /rengine/api/toggle-bug-bounty-mode/
```

**Response:** `{ "bug_bounty_mode": true }`

---

## 4. E2E Scenarios

### Scenario 1: Add Target and Start Full Scan

**Note:** ReNgine does not expose full scan start via REST API. You must implement a wrapper in your Xyberah backend that:

1. Calls ReNgine’s `create_scan_object(host_id, engine_id, initiated_by_id)` (or equivalent logic).
2. Triggers `initiate_scan` Celery task with the correct kwargs.

**Suggested Xyberah API:** `POST /rengine/api/startScan/` (you implement this).

**Request body your backend should accept:**

```json
{
  "domain_id": 1,
  "engine_id": 1,
  "slug": "default",
  "imported_subdomains": [],
  "out_of_scope_subdomains": [],
  "starting_point_path": "",
  "excluded_paths": []
}
```

**Alternative:** Use the HTML form endpoint (requires session/cookies):

```
POST /rengine/scan/<slug>/start/<domain_id>
Content-Type: application/x-www-form-urlencoded

scan_mode=1&importSubdomainTextArea=&outOfScopeSubdomainTextarea=&startingPointPath=&excludedPaths=/admin,/api
```

---

### Scenario 2: Add Target → List → Run Subscan

```ts
// 1. Add target
const addRes = await rengine.post('/api/add/target/', {
  domain_name: 'example.com',
  description: 'Test',
  slug: 'default',
});
// addRes.status === true

// 2. List targets to get domain id
const targets = await rengine.get('/api/listTargets/?slug=default');
const domainId = targets[0].id;

// 3. Start full scan (via your backend wrapper or HTML form)
// ... see Scenario 1

// 4. Poll scan status
const status = await rengine.get('/api/scan_status/?project=default');
// status.scans.scanning, status.scans.completed

// 5. List scan history
const history = await rengine.get('/api/listScanHistory/?project=default');
const scanId = history[0].id;

// 6. List subdomains
const subdomains = await rengine.get(`/api/querySubdomains/?scan_id=${scanId}`);

// 7. Initiate subscan on a subdomain
await rengine.post('/api/action/initiate/subtask/', {
  subdomain_ids: [subdomains.subdomains[0].id],
  engine_id: 1,
  tasks: ['port_scan', 'vulnerability_scan'],
});
```

---

### Scenario 3: Dashboard Overview

```ts
// 1. Scan status
const status = await rengine.get('/api/scan_status/?project=default');

// 2. Most vulnerable targets
const mostVuln = await rengine.post('/api/fetch/most_vulnerable/', {
  slug: 'default',
  limit: 10,
  ignore_info: true,
});

// 3. Most common vulnerabilities
const commonVuln = await rengine.post('/api/fetch/most_common_vulnerability/', {
  slug: 'default',
  limit: 10,
});

// 4. Unread notifications
const notif = await rengine.get('/api/notifications/unread_count/?project_slug=default');
```

---

### Scenario 4: Vulnerability Workflow

```ts
// 1. List vulnerabilities
const vulns = await rengine.get('/api/listVulnerability/?project=default&format=json');

// 2. Filter by severity (e.g. High = 3)
const highVulns = vulns.filter(v => v.severity === 3);

// 3. Report to HackerOne (if configured)
// GET /api/vulnerability/report/?vulnerability_id=1

// 4. Delete false positive
await rengine.post('/api/action/vulnerability/delete/', {
  vulnerability_ids: [1],
});
```

---

### Scenario 5: Target Management

```ts
// 1. Add target
await rengine.post('/api/add/target/', {
  domain_name: 'newtarget.com',
  slug: 'default',
  organization: 'Acme',
});

// 2. List targets
const targets = await rengine.get('/api/listTargets/?slug=default');

// 3. Delete target (via non-API endpoint)
await fetch('/rengine/target/delete/target/1/', {
  method: 'POST',
  headers: {
    authtoken: token,
    'x-csrftoken': csrf,
  },
});
```

---

## 5. Data Models & Enums

### Scan Status

| Value | Constant        | Meaning   |
|-------|-----------------|-----------|
| -1    | INITIATED_TASK  | Pending   |
| 0     | FAILED_TASK     | Failed    |
| 1     | RUNNING_TASK    | Running   |
| 2     | SUCCESS_TASK    | Success   |
| 3     | ABORTED_TASK    | Aborted   |

### Vulnerability Severity

| Value | Label        |
|-------|--------------|
| -1    | Unknown      |
| 0     | Info         |
| 1     | Low          |
| 2     | Medium       |
| 3     | High         |
| 4     | Critical     |

### Subscan Task Types

- `subdomain_discovery`
- `port_scan`
- `fetch_url`
- `dir_file_fuzz`
- `vulnerability_scan`
- `screenshot`

---

## 6. Error Handling

| Status | Meaning | Action |
|--------|---------|--------|
| 401 | Missing or invalid `authtoken` | Re-login to Xyberah backend |
| 403 | CSRF invalid/expired | Fetch `GET /rengine/_proxy/csrf` and retry |
| 404 | Resource not found | Check IDs and project slug |
| 502 | ReNgine unreachable | Show maintenance message |
| 503 | Could not obtain ReNgine session | Check backend credentials |

---

## Appendix: Full Scan Start (Backend Implementation)

If you implement `POST /rengine/api/startScan/` in your Xyberah backend, it should:

1. Validate `domain_id`, `engine_id`, `slug`.
2. Call ReNgine (or replicate logic):
   - `create_scan_object(host_id=domain_id, engine_id=engine_id, initiated_by_id=request.user.id)`
   - `initiate_scan.apply_async(kwargs={...})`
3. Return `{ "status": true, "scan_history_id": 123 }`.

Required kwargs for `initiate_scan`:

```python
{
    'scan_history_id': scan.id,
    'domain_id': domain_id,
    'engine_id': engine_id,
    'scan_type': 0,  # LIVE_SCAN
    'results_dir': '/usr/src/scan_results',
    'imported_subdomains': [],
    'out_of_scope_subdomains': [],
    'starting_point_path': '',
    'excluded_paths': [],
    'initiated_by_id': user_id
}
```

---

*Generated from ReNgine v2.2.0 codebase. Paths are relative to `/rengine/` proxy base.*
