# ANTITODE

ANTITODE is the redesigned shell for the original Xyberah security-operations frontend.

## What this version does

The redesign changes the application shell and presentation while retaining the original product modules, services, API clients, data models, and workflows.

### Application shell

- Supabase-style collapsible left navigation.
- Original Xyberah module taxonomy restored in the sidebar.
- Global module command palette with `Ctrl/Cmd + K`.
- Sidebar toggle with `Ctrl/Cmd + B`.
- All modules render inside the same application URL: `/`.
- No module navigation pushes `/dashboard`, `/cve`, `/rules`, etc. into the browser URL.
- Settings is an in-app modal rather than a separate route.

### Functional source retained

The original implementation is retained for:

- honeypot V1/V2/V3 APIs
- IOC management
- threat intelligence feeds
- log analysis and enrichment
- threat actors
- CVE / vulnerability workflows
- exploit intelligence
- news / intelligence feed
- ransomware monitoring
- brand monitoring
- graph investigation
- investigation bench and playbooks
- email forensics
- network forensics
- MITRE Navigator
- SOC rules and rule testing/conversion
- sandbox/browser workflows
- CyberChef
- network tools
- network topology
- threat canvas
- infrastructure / agent management
- Xyberah Recon
- AI assistant and grounding workflows

The original service layer, API client, types, hooks, and view components remain in the project rather than being replaced with generated mock functionality.

## Environment

Copy `.env.example` to `.env.local` and provide the environment values required by the original API/services.

The frontend expects the original backend routes described in `API_INTEGRATION.md` and `RENGINE_API_DOCUMENTATION.md`.

## Development

```bash
npm install
npm run dev
```

The application opens at:

`http://localhost:5173/`

## Build

```bash
npm run build
```
