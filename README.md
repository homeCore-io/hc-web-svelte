# hc-web-svelte

`hc-web-svelte` is the planned Svelte web client for HomeCore.

This client exists alongside Flutter `hc-web`, not as an in-place replacement. The goal is to
build a web-native client that consumes the HomeCore API cleanly while preserving HomeCore's
API-first, client-agnostic architecture.

## Principles

- HomeCore remains the source of truth. No client-specific backend shortcuts.
- The web client should optimize for web quality, not cross-platform code sharing.
- The client must consume documented `/api/v1` contracts that any framework or language can use.
- Flutter `hc-web` remains the reference client until `hc-web-svelte` is good enough to daily-drive.

## Planned Stack

- SvelteKit
- TypeScript
- Svelte runes
- Vite
- fetch-based API client with a small wrapper for auth/error handling
- native WebSocket wrapper for `/api/v1/events/stream`
- charting and drag/resize libraries chosen only after the core shell is working

## Delivery Order

1. Foundation: app shell, auth, API client, websocket wrapper, shared models.
2. Dashboards read-only: list, default redirect, dashboard view, initial widget set.
3. Dashboards management: create, duplicate, import/export, template flows.
4. Dashboard editor: widget config forms, layout editing, drag/resize.
5. Devices and media.
6. Scenes, modes, and events.
7. Automations.
8. Production cutover review.

## Immediate Goal

The first milestone is a usable authenticated shell with dashboard browsing:

- login
- app layout/nav
- dashboard list
- default dashboard redirect
- dashboard viewer with a small starter widget catalog

See [`docs/implementation-plan.md`](/home/john/RustroverProjects/homeCore/clients/hc-web-svelte/docs/implementation-plan.md) for the concrete build checklist.

## Current Status

The repo now has the initial Phase 0 foundation in place:

- SvelteKit + TypeScript scaffolded
- runes-ready Svelte 5 project structure
- minimal fetch-based HomeCore API client
- token-backed auth state and login route
- authenticated app shell and navigation
- initial dashboard routes:
  - `/dashboard`
  - `/dashboards`
  - `/dashboards/[id]`
- dashboard switcher in the dashboard view
- live websocket-backed event stream store for dashboard event widgets
- initial read-only dashboard rendering for:
  - `markdown`
  - `stat_summary`
  - `mode_chips`
  - `scene_row`
  - `device_grid`
  - `device_list`
  - `event_feed`
  - `dashboard_link`

Current notable gaps:

- dashboard editing and delete flows
- richer widget fidelity and controls
- websocket-driven state updates outside the event feed

Current dashboard lifecycle support:

- create from template
- duplicate
- export to JSON
- import from JSON
- set default dashboard

Current device support:

- sortable, filterable device inventory table
- configurable device columns saved locally
- device detail route
- device metadata edit and delete from the detail page
- media-player detail/status
- basic media actions from device detail when supported by HomeCore
- inline device table controls for common toggles and media play or pause

Current scene support:

- sortable, filterable scene inventory table
- configurable scene columns saved locally
- native HomeCore scenes and plugin-managed scene devices shown together
- scene last-activation activity from the HomeCore event log
- collapsible top toolbar like the devices page
- inline `Activate` control

Current modes and events support:

- sortable, filterable `Modes` grid with schedule/state columns
- first-class `Events` page backed by `GET /events` plus the live websocket stream
- shared collapsible filter panel and column dropdown components used across inventory pages

Current automation support:

- sortable, filterable automation inventory table
- trigger, condition, action, priority, and enabled-state summaries
- configurable automation columns saved locally

Design references:

- `docs/device-scene-grid-spec.md` for the target `Devices` and `Scenes` data-grid UX

## Dev Run

For local development, the Svelte app uses relative `/api/v1` requests and relies on a Vite proxy.

Default proxy target:

- `http://localhost:8080`

If `homeCore` is running on a different host or port, set:

- `HOMECORE_DEV_PROXY_TARGET`

Example for this LAN host:

```bash
HOMECORE_DEV_PROXY_TARGET=http://10.0.1.30:8080 npm run dev
```

Then open:

```text
http://10.0.1.30:5173
```

If you prefer bypassing the proxy entirely, `VITE_HOMECORE_API_BASE_URL` can still be set to a full
`/api/v1` base URL, but the proxy path is the intended dev default.
