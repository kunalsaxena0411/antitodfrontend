# Backend Data Gaps

This document identifies the missing or pending backend endpoints required for the Xyberah redesign to function with live data.

| Module | Frontend section | Current source | Backend endpoint | Status | Expected contract |
| ------ | ---------------- | -------------- | ---------------- | ------ | ----------------- |
| Attack Map | Global event map | `src/data/demo/attackMap.ts` | `GET /api/v1/events/global` | Pending | Array of `LogEventV2` |
| Investigations | Case list & details | `src/data/demo/investigations.ts` | `GET /api/v1/investigations` | Pending | Array of `Investigation` |
| Rules | Rule management | `src/data/demo/rules.ts` | `GET /api/v1/rules` | Pending | Array of `Rule` |
| Dashboard | Summary metrics | `src/data/demo/dashboard.ts` | `GET /api/v1/dashboard/metrics` | Pending | Object with metrics |
| Playbooks | Response playbooks | `src/data/demo/playbooks.ts` | `GET /api/v1/playbooks` | Pending | Array of `Playbook` |
| Threat Intelligence | News Feed | `src/data/demo/news.ts` | `GET /api/v1/intel/news` | Pending | Array of `ThreatNewsItem` |
| Vulnerability Manager | CVE listings | `src/data/demo/vulnerabilities.ts`| `GET /api/v1/vuln/cves` | Pending | Array of `CveEntry` |
| Actors | Threat actor profiles | `src/data/demo/actors.ts` | `GET /api/v1/intel/actors` | Pending | Array of `MalpediaActor` |

## Detailed Gap Reports

### Attack Map
**Module:** Attack Map
**Expected endpoint:** `GET /api/v1/events/global`
**HTTP method:** GET
**Expected request params:** `{ timeframe: string, severity?: string }`
**Expected response shape:**
```json
[
  {
    "id": "string",
    "timestamp": "string",
    "source_ip": "string",
    "country_code": "string",
    "event_type": "string",
    "severity": "string"
  }
]
```
**Frontend consumer:** `AttackMapPage.tsx`
**Current temporary demo source:** `src/data/demo/attackMap.ts`

### Investigations
**Module:** Investigation Bench
**Expected endpoint:** `GET /api/v1/investigations`
**HTTP method:** GET
**Expected request params:** `{ status?: string }`
**Expected response shape:**
```json
[
  {
    "id": "string",
    "title": "string",
    "status": "string",
    "severity": "string",
    "assignedTo": "string",
    "createdAt": "string",
    "relatedEntities": ["string"]
  }
]
```
**Frontend consumer:** `InvestigationPage.tsx`
**Current temporary demo source:** `src/data/demo/investigations.ts`
