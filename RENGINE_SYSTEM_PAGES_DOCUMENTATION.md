# ReNgine System & Pages Documentation

This document describes how the ReNgine web application works: architecture, the **Project** model, each page's purpose, when and how backend requests are made, and integration patterns.

---

## Table of Contents

1. [System Architecture](#1-system-architecture)
2. [The Project Model](#2-the-project-model)
3. [Current Project Context](#3-current-project-context)
4. [Page-by-Page Documentation](#4-page-by-page-documentation)
5. [Request Flow & Timing](#5-request-flow--timing)
6. [Integration Patterns](#6-integration-patterns)

---

## 1. System Architecture

### High-Level Flow

```
Login  →  Onboarding (if no projects)  →  Dashboard
              ↓
         Create Project
              ↓
    ┌─────────┴─────────┐
    │  Project Context  │  (slug in URL, current_project in template)
    └─────────┬─────────┘
              │
    ┌─────────┼─────────┬─────────────┬──────────────┐
    │         │         │             │              │
 Targets    Scans   Subdomains   Endpoints   Vulnerabilities
    │         │         │             │              │
    └─────────┴─────────┴─────────────┴──────────────┘
              │
    All data filtered by project (Domain.project, ScanHistory.domain.project)
```

### URL Structure

All authenticated pages use a **project-scoped** URL pattern: `<slug:slug>` appears in most routes. The slug identifies the **current project** and is used to filter all data.

```
/                           → Onboarding (if no projects) or redirect to first project dashboard
/<slug>/dashboard/           → Dashboard for project
/<slug>/profile/             → User profile
/target/<slug>/list/target    → Targets list
/scan/<slug>/history/scan    → Scan history
/api/*                       → REST API (project passed as query param: ?slug=, ?project=)
```

### Request Flow

```
Browser  →  Django View (server-rendered HTML)  →  Template
    ↓
Page Load  →  $(document).ready()  →  API calls (fetch/$.getJSON)
    ↓
API  →  /api/...  →  Django REST Framework  →  JSON response
```

### Key Components

| Component | Location | Purpose |
|-----------|----------|---------|
| **Context Processor** | `reNgine/context_processors.py` | Injects `current_project`, `projects`, `RENGINE_CURRENT_VERSION` into every template |
| **Base Template** | `templates/base/base.html` | Layout, top nav, right sidebar, global scripts |
| **Global Scripts** | `static/custom/custom.js`, `right_sidebar.js`, `notification.js` | Shared logic, scan status, notifications |
| **CSRF** | Django middleware | All POST/PUT/DELETE require `X-CSRFToken` header from cookie |

---

## 2. The Project Model

### What is a Project?

A **Project** is the top-level organizational unit in ReNgine. All recon data is scoped to a project.

| Field | Type | Description |
|-------|------|-------------|
| `id` | int | Primary key |
| `name` | string | Display name (e.g. "Default", "Bug Bounty 2025") |
| `slug` | string | URL-safe identifier (e.g. "default") |
| `insert_date` | datetime | Creation time |

### Data Hierarchy

```
Project
  └── Domain (Target)     ← project FK
        └── ScanHistory   ← domain FK
              └── Subdomain, EndPoint, Vulnerability, etc.
  └── Organization       ← project FK
        └── domains (M2M with Domain)
```

- **Domain** (target) belongs to one Project.
- **ScanHistory** belongs to one Domain; thus indirectly to one Project.
- **Organization** belongs to one Project and groups multiple Domains.
- **InAppNotification** can be project-scoped or system-wide.

### Project Lifecycle

1. **Creation**: On first login, user sees **Onboarding** (`/`). Submitting the form creates the first Project (and optionally API keys, users).
2. **Selection**: User selects current project from top-bar dropdown. Navigating to any `<slug>/...` URL sets `current_project` via context processor.
3. **Switching**: Clicking a project in the dropdown navigates to `/<slug>/dashboard/`.

---

## 3. Current Project Context

### How `current_project` is Set

**Context processor** (`reNgine/context_processors.py`):

```python
def projects(request):
    slug = request.resolver_match.kwargs.get('slug')
    project = Project.objects.get(slug=slug) if slug else None
    return {'projects': Project.objects.all(), 'current_project': project}
```

- **When URL has `<slug:slug>`** (e.g. `/default/dashboard/`): `current_project` = that project.
- **When URL has no slug** (e.g. `/api/listTargets/`, `/target/`): `current_project` = `None`. Templates that extend `base.html` may fail if they assume `current_project` exists.

### Where `current_project` is Used

- **Top nav**: All links use `current_project.slug` (Dashboard, Targets, Scan History, etc.).
- **Hidden input**: `<input name="current_project" value="{{ current_project.slug }}">` — JavaScript reads this via `getCurrentProjectSlug()`.
- **API calls**: Most client-side requests append `?project=<slug>` or `?slug=<slug>`.

---

## 4. Page-by-Page Documentation

### 4.1 Login / Logout

| Attribute | Value |
|-----------|-------|
| **URL** | `/login/`, `/logout/` |
| **View** | Django `auth_views.LoginView`, `LogoutView` |
| **Template** | `base/login.html`, `base/logout.html` |

**Flow:** Standard Django auth. After login, user is redirected to `/` (onboarding or dashboard).

---

### 4.2 Onboarding (`/`)

| Attribute | Value |
|-----------|-------|
| **URL** | `/` |
| **View** | `dashboard.views.onboarding` |
| **Auth** | Required (login) |
| **When** | First visit when no projects exist |

**Flow:**
1. **GET**: If any project exists → redirect to `/<first_project.slug>/dashboard/`.
2. **GET**: If no projects → render onboarding form.
3. **POST**: Create Project, optionally User, API keys (OpenAI, Netlas, Chaos, HackerOne), set UserPreferences (bug_bounty_mode).

**Backend requests:** None from client; all via form POST.

---

### 4.3 Dashboard (`/<slug>/dashboard/`)

| Attribute | Value |
|-----------|-------|
| **URL** | `/<slug>/dashboard/` |
| **View** | `dashboard.views.index` |
| **Template** | `dashboard/index.html` |

**Server-side (view):**
- Loads domains, subdomains, endpoints, scan_histories, vulnerabilities for the project.
- Computes counts, charts data (last 7 days), activity feed, vulnerability feed.
- Passes all to template.

**Client-side (on load):**
| When | Request | Purpose |
|------|---------|---------|
| `$(document).ready` | `GET /api/search/history/` | Populate search history dropdown |
| `$(document).ready` | `GET /api/scan_status/?project=<slug>` | Right sidebar: pending/running/completed scans |
| `$(document).ready` | `checkDailyUpdate()` → `GET /api/rengine/update/` | Check for ReNgine updates |
| `$(document).ready` | `get_most_vulnerable_target(slug, ...)` | `POST /api/fetch/most_vulnerable/` |
| `$(document).ready` | `get_most_common_vulnerability(slug, ...)` | `POST /api/fetch/most_common_vulnerability/` |

**User actions:**
- "Ignore Info" checkbox → re-fetches most vulnerable & most common vulnerability.

---

### 4.4 Projects List (`/<slug>/projects/`)

| Attribute | Value |
|-----------|-------|
| **URL** | `/<slug>/projects/` |
| **View** | `dashboard.views.projects` |
| **Template** | `dashboard/projects.html` |

**Server-side:** Renders list of all projects.

**Client-side:**
| When | Request | Purpose |
|------|---------|---------|
| Delete project | `POST /delete/project/<id>` | Delete project (CSRF required) |

---

### 4.5 Targets List (`/target/<slug>/list/target`)

| Attribute | Value |
|-----------|-------|
| **URL** | `/target/<slug>/list/target` |
| **View** | `targetApp.views.list_target` |
| **Template** | `target/list.html` |

**Server-side:** Renders page with empty table shell.

**Client-side (on load):**
| When | Request | Purpose |
|------|---------|---------|
| DataTable init | `GET /api/listTargets/?format=datatables&slug=<slug>` | Server-side paginated targets |

**User actions:**
| Action | Request | Purpose |
|--------|---------|---------|
| Add Target (modal) | `POST /api/add/target/` | Add domain (JSON body: domain_name, slug, description, organization, h1_team_handle) |
| Delete target | `POST /target/delete/target/<id>` | Delete target |
| Delete multiple | Form POST to `/target/<slug>/delete/multiple` | Bulk delete |
| Scan multiple | Form POST to `/scan/<slug>/start/multiple/` | Start scan on selected targets |

**Known issue:** Add Target API returns `{ status, message, domain_name }` but **not** `domain_id`. The success flow offers "Initiate Scan" and redirects to `/scan/<slug>/start/${data.domain_id}` — but `data.domain_id` is undefined. The redirect will fail. User should initiate scan manually from the Targets list after adding.

---

### 4.6 Add Target (`/target/<slug>/add/target`)

| Attribute | Value |
|-----------|-------|
| **URL** | `/target/<slug>/add/target` |
| **View** | `targetApp.views.add_target` |
| **Template** | `target/add.html` |

**Flow:**
- **GET**: Render form (single target, bulk, IP, CSV upload).
- **POST**: Process form, create Domain(s), optionally Organization. Redirect to list.

**Backend requests:** Form POST only; no client-side API.

---

### 4.7 Target Summary (`/target/<slug>/summary/<id>`)

| Attribute | Value |
|-----------|-------|
| **URL** | `/target/<slug>/summary/<id>` |
| **View** | `targetApp.views.target_summary` |
| **Template** | `target/summary.html` |

**Server-side:** Renders target overview with scan history, subdomain table shell.

**Client-side (on load):**
| When | Request | Purpose |
|------|---------|---------|
| DataTable init | `GET /api/listDatatableSubdomain/?project=<slug>&target_id=<id>&format=datatables` | Subdomains for target |
| Tab/action | `get_endpoints(project, null, domain_id, null)` | `GET /api/listEndpoints/?project=...&target_id=...` |
| Tab/action | `get_most_vulnerable_target(slug, null, target_id, ...)` | `POST /api/fetch/most_vulnerable/` |
| Tab/action | `get_most_common_vulnerability(slug, null, target_id, ...)` | `POST /api/fetch/most_common_vulnerability/` |

---

### 4.8 Scan History (`/scan/<slug>/history/scan`)

| Attribute | Value |
|-----------|-------|
| **URL** | `/scan/<slug>/history/scan` |
| **View** | `startScan.views.scan_history` |
| **Template** | `startScan/history.html` |

**Server-side:** Passes `scan_history` queryset (filtered by project) to template. Table rows are server-rendered.

**Client-side (on load):**
- DataTable initializes on existing DOM rows (no AJAX for initial data).
- Filter dropdowns populated from table data.

**User actions:**
| Action | Request | Purpose |
|--------|---------|---------|
| Start scan | Navigate to `/scan/<slug>/start/<domain_id>` | — |
| Delete scan | `POST /scan/delete/scan/<id>` | — |
| Stop scan | `POST /scan/stop/scan/<id>` | — |
| Delete multiple | Form POST to `/scan/<slug>/delete/multiple` | — |
| Stop multiple | Form POST to `/scan/<slug>/stop/multiple` | — |
| Generate report | Modal → `GET /scan/create_report/<id>?template=...&report_type=...` | PDF download |

---

### 4.9 Start Scan UI (`/scan/<slug>/start/<domain_id>`)

| Attribute | Value |
|-----------|-------|
| **URL** | `/scan/<slug>/start/<domain_id>` |
| **View** | `startScan.views.start_scan_ui` |
| **Template** | `startScan/start_scan_ui.html` |

**Flow:**
- **GET**: Render form (engine selection, imported/out-of-scope subdomains, paths).
- **POST**: Call `create_scan_object()`, then `initiate_scan.apply_async()`. Redirect to scan history.

**Backend requests:** Form POST only. No REST API for starting a full scan.

---

### 4.10 Scan Detail (`/scan/<slug>/detail/<id>`)

| Attribute | Value |
|-----------|-------|
| **URL** | `/scan/<slug>/detail/<id>` |
| **View** | `startScan.views.detail_scan` |
| **Template** | `startScan/detail_scan.html` |

**Server-side:** Loads scan, subdomains, endpoints, vulns, activity, etc. Renders tabs (Summary, Subdomains, Endpoints, Vulnerabilities, OSINT, etc.).

**Client-side (on load / tab switch):**
| When | Request | Purpose |
|------|---------|---------|
| Endpoints tab | `GET /api/listEndpoints/?project=...&scan_history=...` | Endpoints DataTable |
| Subdomains tab | `GET /api/listDatatableSubdomain/?project=...&scan_id=...` | Subdomains DataTable |
| Vulnerabilities tab | `GET /api/listVulnerability/?project=...&format=datatables` | Vulns DataTable |
| Subscan history | `POST /api/listSubScans/` | Subscans for scan/domain |
| Initiate subscan | `POST /api/action/initiate/subtask/` | Start subscan on selected subdomains |
| Add recon note | `POST /api/add/recon_note/` | Add todo note |
| Delete subdomain | `POST /api/action/subdomain/delete/` | — |
| Toggle important | `POST /api/toggle/subdomain/important/` | — |
| Fetch subscan results | `GET /api/fetch/results/subscan/?subscan_id=...` | Modal content |

---

### 4.11 All Subdomains (`/scan/<slug>/all/subdomains`)

| Attribute | Value |
|-----------|-------|
| **URL** | `/scan/<slug>/all/subdomains` |
| **View** | `startScan.views.all_subdomains` |
| **Template** | `startScan/subdomains.html` |

**Client-side:** DataTable with `GET /api/listDatatableSubdomain/?project=<slug>&format=datatables` (+ optional `name`, `ip_address` from query params).

---

### 4.12 All Endpoints (`/scan/<slug>/detail/all/endpoint`)

| Attribute | Value |
|-----------|-------|
| **URL** | `/scan/<slug>/detail/all/endpoint` |
| **View** | `startScan.views.all_endpoints` |
| **Template** | `startScan/endpoints.html` |

**Client-side:** `get_endpoints(project, null, null, null)` → `GET /api/listEndpoints/?project=<slug>&format=datatables`.

---

### 4.13 Vulnerabilities (`/scan/<slug>/detail/vuln`)

| Attribute | Value |
|-----------|-------|
| **URL** | `/scan/<slug>/detail/vuln` |
| **View** | `startScan.views.detail_vuln_scan` |
| **Template** | `startScan/vulnerabilities.html` |

**Client-side:** DataTable with `GET /api/listVulnerability/?project=<slug>&format=datatables` (+ optional `domain`, `subdomain`, `vulnerability_name` from query params).

---

### 4.14 Todo / Recon Notes (`/recon_note/<slug>/list_note`)

| Attribute | Value |
|-----------|-------|
| **URL** | `/recon_note/<slug>/list_note` |
| **View** | `recon_note.views.list_note` |
| **Template** | `note/index.html` |

**Client-side:**
| When | Request | Purpose |
|------|---------|---------|
| Scan select | `GET /api/querySubdomains/?project=...&scan_id=...` | Populate subdomain dropdown |
| Load notes | `GET /api/listTodoNotes/?project=...` | Display notes |
| Flip todo | `POST /recon_note/flip_todo_status` | Toggle is_done |
| Flip important | `POST /recon_note/flip_important_status` | Toggle is_important |
| Delete note | `POST /recon_note/delete_note` | Delete note |
| Add note | `POST /api/add/recon_note/` | Add note (from detail scan page) |

---

### 4.15 Organizations (`/target/<slug>/list/organization`)

| Attribute | Value |
|-----------|-------|
| **URL** | `/target/<slug>/list/organization` |
| **View** | `targetApp.views.list_organization` |
| **Template** | `organization/list.html` |

**Server-side:** Renders organization list. Actions: start scan, schedule scan, edit — all link to other views/forms.

---

### 4.16 Search (`/<slug>/search`)

| Attribute | Value |
|-----------|-------|
| **URL** | `/<slug>/search?query=...` |
| **View** | `dashboard.views.search` |
| **Template** | `dashboard/search.html` |

**Client-side (on submit):**
| When | Request | Purpose |
|------|---------|---------|
| Search | `GET /api/search/?query=...` | Universal search (subdomains, endpoints, vulns) |

---

### 4.17 Bounty Hub / HackerOne (`/<slug>/bountyhub/list/programs`)

| Attribute | Value |
|-----------|-------|
| **URL** | `/<slug>/bountyhub/list/programs` |
| **View** | `dashboard.views.list_bountyhub_programs` |
| **Template** | `dashboard/bountyhub_programs.html` |

**Client-side:** Uses `GET /api/hackerone-programs/`, `sync_bookmarked`, etc. (when HackerOne is configured).

---

### 4.17 Subscan History (`/scan/<slug>/history/subscan`)

| Attribute | Value |
|-----------|-------|
| **URL** | `/scan/<slug>/history/subscan` |
| **View** | `startScan.views.subscan_history` |
| **Template** | `startScan/subscan_history.html` |

**Server-side:** Renders list of subscans for the project. User can view results, stop, etc.

---

### 4.19 Scheduled Scans (`/scan/<slug>/scheduled/`)

| Attribute | Value |
|-----------|-------|
| **URL** | `/scan/<slug>/scheduled/` |
| **View** | `startScan.views.scheduled_scan_view` |
| **Template** | `startScan/schedule_scan_list.html` |

**Server-side:** Renders scheduled (periodic/clocked) scans.

**Client-side:**
| Action | Request | Purpose |
|--------|---------|---------|
| Delete scheduled | `POST /scan/delete/scheduled_task/<id>` | Remove scheduled task |
| Toggle status | `POST /scan/toggle/scheduled_task/<id>` | Enable/disable |

---

### 4.20 Scan Engine / Settings (`/scanEngine/<slug>/...`)

| Page | URL | Purpose |
|------|-----|---------|
| Engines | `/scanEngine/<slug>/` | List scan engines |
| Add engine | `/scanEngine/<slug>/add/` | Create engine |
| Wordlists | `/scanEngine/<slug>/wordlist/` | Manage wordlists |
| API Vault | `/scanEngine/<slug>/api_vault` | API keys |
| Tool Arsenal | `/scanEngine/<slug>/tool_arsenal` | External tools |
| Notification | `/scanEngine/<slug>/notification_settings` | Slack/Discord/Telegram |
| HackerOne | `/scanEngine/<slug>/hackerone_settings` | HackerOne config |
| Proxy | `/scanEngine/<slug>/proxy_settings` | Proxy config |
| Report | `/scanEngine/<slug>/report_settings` | Report templates |

These are mostly form-based; some use API for tool management (e.g. `GET /api/tool/update/`, `GET /api/github/tool/get_latest_releases/`).

---

## 5. Request Flow & Timing

### Global (Every Page with Base Template)

| Timing | Request | Source |
|--------|---------|--------|
| Page load | `GET /api/search/history/` | `base.html` → `render_search_history()` |
| Page load | `GET /api/scan_status/?project=<slug>` | `base.html` → `getScanStatusSidebar()` |
| Daily | `GET /api/rengine/update/` | `update.js` → `checkDailyUpdate()` |
| Notification panel open | `GET /api/notifications/?project_slug=<slug>` | `notification.js` |
| Notification actions | `POST /api/notifications/.../mark_read`, `mark_all_read`, `clear_all` | `notification.js` |

### Page-Specific Timing

| Page | On Load | On User Action |
|------|---------|----------------|
| Dashboard | most_vulnerable, most_common_vulnerability | Re-fetch on "Ignore Info" toggle |
| Targets | listTargets (DataTable) | add/target, delete, scan multiple |
| Target Summary | listDatatableSubdomain, endpoints | most_vulnerable, most_common_vulnerability |
| Scan History | (server-rendered) | delete, stop, report |
| Scan Detail | listEndpoints, listDatatableSubdomain, listVulnerability (per tab) | initiate subscan, add note, delete, toggle important |
| Todo | listTodoNotes, querySubdomains | flip status, delete, add |
| Search | — | search API on submit |

---

## 6. Integration Patterns

### Pattern 1: Project-Scoped Data

All project-scoped API calls include `project=<slug>` or `slug=<slug>`:

```ts
fetch(`/api/listTargets/?format=datatables&slug=${getCurrentProjectSlug()}`);
fetch(`/api/scan_status/?project=${getCurrentProjectSlug()}`);
```

### Pattern 2: CSRF for Mutating Requests

```ts
headers: {
  'X-CSRFToken': getCookie('csrftoken'),
  'Content-Type': 'application/json'
}
```

### Pattern 3: DataTables Server-Side

Many tables use DataTables with `serverSide: true` and `ajax: '/api/...'`. The API must support DataTables parameters: `draw`, `start`, `length`, `search[value]`, `order[0][column]`, `order[0][dir]`.

### Pattern 4: Form POST for Non-API Actions

- Start scan: `POST /scan/<slug>/start/<domain_id>` (form)
- Delete target: `POST /target/delete/target/<id>`
- Delete scan: `POST /scan/delete/scan/<id>`

### Pattern 5: Modal + API for Quick Actions

- Add target (modal) → `POST /api/add/target/`
- Add recon note (modal) → `POST /api/add/recon_note/`
- Initiate subscan (modal) → `POST /api/action/initiate/subtask/`

---

## Appendix: URL Reference

| Path | View/Handler |
|------|--------------|
| `/` | onboarding |
| `/<slug>/dashboard/` | dashboard index |
| `/<slug>/profile/` | profile |
| `/<slug>/projects/` | projects list |
| `/<slug>/search` | search |
| `/<slug>/admin_interface/` | admin (users) |
| `/<slug>/bountyhub/list/programs` | Bounty Hub |
| `/target/<slug>/list/target` | targets list |
| `/target/<slug>/add/target` | add target |
| `/target/<slug>/summary/<id>` | target summary |
| `/target/delete/target/<id>` | delete target |
| `/scan/<slug>/history/scan` | scan history |
| `/scan/<slug>/history/subscan` | subscan history |
| `/scan/<slug>/detail/<id>` | scan detail |
| `/scan/<slug>/start/<domain_id>` | start scan |
| `/scan/<slug>/start/multiple/` | start multiple scans |
| `/scan/<slug>/all/subdomains` | all subdomains |
| `/scan/<slug>/detail/all/endpoint` | all endpoints |
| `/scan/<slug>/detail/vuln` | all vulnerabilities |
| `/recon_note/<slug>/list_note` | todo/recon notes |
| `/scanEngine/<slug>/` | scan engines |
| `/api/*` | REST API |

---

*Generated from ReNgine web application analysis.*
