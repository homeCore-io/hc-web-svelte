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
- initial read-only dashboard rendering for:
  - `markdown`
  - `stat_summary`
  - `mode_chips`
  - `scene_row`
  - `device_grid`
  - `device_list`
  - `event_feed`
  - `dashboard_link`

Current placeholders remain for:

- devices
- scenes
- modes
- automations
