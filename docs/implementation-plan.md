# hc-web-svelte Implementation Plan

## Scope

This plan covers:

- Phase 0: repository and application foundation
- Milestone 1: authenticated shell plus read-only dashboards

It does not yet cover full dashboard editing, devices, or automations implementation details.

## Architecture Rules

- Use HomeCore `/api/v1` directly.
- Do not add backend changes just to suit Svelte.
- Keep all client-specific translation inside the Svelte repo.
- Prefer typed domain models over raw endpoint maps in UI code.
- Treat `hc-web` as a behavioral reference, not an architectural template.

## Target Repo Shape

```text
hc-web-svelte/
  README.md
  package.json
  svelte.config.js
  vite.config.ts
  tsconfig.json
  src/
    app.html
    routes/
      +layout.svelte
      +page.ts
      login/
        +page.svelte
      dashboard/
        +page.ts
      dashboards/
        +page.ts
        +page.svelte
      dashboards/[id]/
        +page.ts
        +page.svelte
    lib/
      api/
        client.ts
        auth.ts
        dashboards.ts
        devices.ts
        events.ts
        scenes.ts
        modes.ts
      models/
        auth.ts
        dashboard.ts
        device.ts
        event.ts
        mode.ts
        scene.ts
      stores/
        auth.svelte.ts
        dashboards.svelte.ts
        devices.svelte.ts
      components/
        app/
        dashboard/
        ui/
      features/
        dashboard/
          widgets/
      utils/
        time.ts
        formatting.ts
  docs/
    implementation-plan.md
```

## Phase 0

### 0.1 Scaffold

- Initialize SvelteKit with TypeScript.
- Enable Svelte runes.
- Add lint/format tooling.
- Add a minimal `.gitignore`.
- Add npm scripts:
  - `dev`
  - `build`
  - `preview`
  - `check`
  - `lint`

### 0.2 Environment model

- Add one explicit API base URL configuration path.
- Support local dev against HomeCore through either:
  - direct base URL
  - or local proxy config
- Document how auth tokens and websocket URLs are derived.

### 0.3 Shared API client

Build:

- `src/lib/api/client.ts`
  - base URL handling
  - `Authorization: Bearer`
  - consistent JSON parsing
  - normalized error object

- `src/lib/api/auth.ts`
  - `login`
  - `me` or equivalent current-user bootstrap

- `src/lib/api/dashboards.ts`
  - list dashboards
  - list templates
  - get dashboard

### 0.4 Auth store

Build:

- token persistence
- login state
- logout
- startup bootstrap
- redirect unauthenticated users to `/login`

Keep this small and explicit. Do not over-engineer a generic store framework first.

### 0.5 Shell

Build:

- top app layout
- sidebar/nav
- header with current user and logout
- loading/error shell behavior

Initial nav:

- Dashboards
- Devices
- Scenes
- Modes
- Automations

Pages beyond dashboards can be placeholders initially.

## Milestone 1

### 1.1 Dashboard landing behavior

Implement:

- `/dashboard`
  - fetch dashboards
  - redirect to default dashboard if one exists
  - otherwise route to `/dashboards`

### 1.2 Dashboard manager

Implement `/dashboards` with:

- list visible dashboards
- default badge
- name, description, tags, icon
- open action

Do not implement edit/create yet in M1. Read-only manager is enough.

### 1.3 Dashboard view route

Implement `/dashboards/[id]` with:

- dashboard fetch by id or selection from list data
- app-bar switcher between dashboards
- responsive breakpoint resolution
- grid layout rendering based on saved placements

### 1.4 Initial widget set

Support only these widgets in M1:

- `markdown`
- `stat_summary`
- `mode_chips`
- `scene_row`
- `device_grid`
- `device_list`
- `event_feed`
- `dashboard_link`

Render unsupported widgets with a clear placeholder card that names the widget type.

### 1.5 Data dependencies for M1

Add the minimum supporting consumers:

- devices list
- scenes list
- modes list
- events websocket stream

Do not build device detail or mutation-heavy controls yet unless needed by the chosen widget set.

### 1.6 State strategy

Use feature-scoped runes/state modules, not a large global store layer first.

Recommended pattern:

- one state module for auth
- one for dashboards
- one for devices
- one for event stream cache

Favor straightforward explicit loading over hidden reactivity tricks.

## Milestone 1 Exit Criteria

M1 is done when:

- a user can log in
- the app shell loads reliably
- `/dashboard` routes to a real dashboard
- `/dashboards` lists saved dashboards
- `/dashboards/[id]` renders a real saved layout
- the starter dashboard is usable in the new client

## Recommended Next Step After M1

Move immediately to dashboard lifecycle flows:

- create from template
- duplicate
- export
- import

That will validate the newer dashboard API surface early and keep `hc-web-svelte` aligned with the
current HomeCore direction.

Current progress beyond the initial dashboard-only milestone:

- configurable `devices` grid page implemented
- device detail page implemented
- device metadata edit/delete implemented
- media-player detail/actions implemented
- configurable `scenes` grid page implemented
- scenes page now merges native scenes with plugin scene devices
- scene activation implemented
- read-only `modes` page implemented
- dashboard lifecycle flows implemented:
  - create from template
  - duplicate
  - export
  - import
  - set default

Related page design specs:

- `docs/device-scene-grid-spec.md` defines the long-term `Devices` and `Scenes` grid UX, including configurable columns, saved views, typed status renderers, and richer media presentation

## Concrete Build Checklist

### Phase 0 checklist

- [x] Initialize SvelteKit + TypeScript repo
- [x] Enable runes
- [x] Add lint/format scripts
- [x] Add API base URL config
- [x] Add auth API client
- [x] Add dashboard API client
- [x] Add token persistence
- [x] Add login page
- [x] Add authenticated app layout
- [x] Add placeholder routes for non-dashboard sections

### M1 checklist

- [x] Implement `/dashboard` redirect behavior
- [x] Implement dashboard list page
- [x] Implement dashboard switcher
- [x] Implement breakpoint-aware dashboard grid renderer
- [x] Implement `markdown` widget
- [x] Implement `stat_summary` widget
- [x] Implement `mode_chips` widget
- [x] Implement `scene_row` widget
- [x] Implement `device_grid` widget
- [x] Implement `device_list` widget
- [x] Implement `event_feed` widget
- [x] Implement `dashboard_link` widget
- [x] Add unsupported-widget placeholder handling
- [x] Validate against a real HomeCore dev instance
