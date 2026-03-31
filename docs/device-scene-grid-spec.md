# Device And Scene Grid Specification

## Purpose

Define the target interaction model for the `Devices` and `Scenes` pages in `hc-web-svelte`.

These pages should be built as configurable data-grid experiences first, with card or detail views treated as secondary affordances. The goal is to match and improve on the strong parts of HomeSeer-style sortable and filterable lists while fitting HomeCore's API-first and multi-client design.

## Design Principles

1. Use one shared grid system for devices and scenes.
2. Separate data display from row actions.
3. Make columns configurable per user.
4. Support compact scanning first, richer media detail second.
5. Preserve row-level detail navigation without sacrificing inline control.
6. Allow saved views so users can tailor the page to room, purpose, or workflow.

## Shared Grid Model

Both pages should use a shared `DataGrid` feature with:

- sortable columns
- column visibility toggle
- column reorder
- adjustable column widths
- multi-column filtering
- search box
- density modes
- saved views
- sticky header
- keyboard-friendly row focus
- optional expandable detail rows

The grid should support these interaction zones:

- top toolbar
- optional saved-view bar
- table/grid body
- row detail affordance

## Toolbar Layout

Recommended toolbar content:

- search field
- quick filter chips
- sort control
- column picker
- density toggle
- saved-view selector
- page-specific actions

### Devices actions

- refresh
- create saved view
- reset current view

### Scenes actions

- refresh
- create saved view
- reset current view

## Devices Page

### Primary Layout

The default page should be a configurable table with these baseline columns:

- `status_icon`
- `name`
- `area`
- `device_type`
- `status_text`
- `last_changed`
- `control`

Optional columns:

- `canonical_name`
- `plugin`
- `source`
- `battery`
- `signal`
- `attributes_summary`
- `media_info`
- `updated_at`
- `device_id`

### Devices Column Definitions

#### `status_icon`

Purpose:

- quick scan of current state

Behavior:

- uses typed renderers by device class and status
- supports icon-only, icon-plus-text, or text-only display modes in preferences

Examples:

- light on/off
- lock locked/unlocked
- motion active/clear
- media playing/paused/stopped
- offline warning

#### `name`

Purpose:

- primary row label

Behavior:

- clickable
- opens device detail page
- may optionally show secondary canonical name as muted subtitle

#### `area`

Purpose:

- show physical or logical location

Behavior:

- sortable
- filterable
- should use known HomeCore area list in filters instead of free text where possible

#### `device_type`

Purpose:

- indicate device class

Behavior:

- shown as readable label, not raw API jargon where avoidable

#### `status_text`

Purpose:

- readable summary of current device state

Examples:

- `On`
- `Off`
- `Locked`
- `Motion detected`
- `Paused`
- `Open`
- `22% battery`

#### `last_changed`

Purpose:

- operational recency

Behavior:

- relative by default
- full timestamp on hover or expanded row

#### `control`

Purpose:

- inline single-row action or mini-control

Examples:

- on/off toggle
- lock/unlock
- one-shot trigger for devices with a single useful action
- media play/pause/stop cluster

This cell must not consume the whole row click target.

### Device Row Modes

The devices grid should support two row presentation modes.

#### Compact mode

Best for large inventories.

Columns remain narrow and focused on scanability:

- icon
- name
- area
- status
- last changed
- control

#### Rich mode

Best for media-heavy or touch-heavy setups.

Allows richer cells such as:

- album art thumbnail
- now playing title or artist
- progress preview
- larger inline control cluster

This should be a view preference, not a global forced mode.

### Media Player Rows

Media players need two presentation levels.

#### Standard media row

Shown in normal device grids.

Columns:

- media status icon
- name
- area
- playback state
- `media_info` summary like `Artist - Title`
- control buttons

#### Rich media row

Shown when the view opts into richer presentation or when a row is expanded.

Includes:

- album art
- title
- artist
- album
- source
- progress bar
- transport controls
- volume and mute state

### Device Filters

Default quick filters:

- all
- favorites
- online
- offline
- media
- lights
- sensors
- battery alerts

Structured filters should support:

- area
- device type
- plugin
- online state
- battery threshold
- current status
- capability

Prefer typed selectors over raw text:

- area dropdown
- device type multi-select
- plugin multi-select
- status chips

### Saved Views

Users should be able to save a full device-grid view including:

- visible columns
- column order
- sort
- filters
- density
- row mode

Starter views:

- `All Devices`
- `By Room`
- `Media`
- `Offline`
- `Battery Alerts`
- `Security Sensors`

## Scenes Page

### Primary Layout

Scenes should use the same grid system, but with a simpler control model.

Default columns:

- `name`
- `area`
- `summary`
- `activate`

Optional columns:

- `scene_type`
- `tags`
- `device_count`
- `last_activated`
- `scene_id`

### Scene Column Definitions

#### `name`

Purpose:

- primary scene label

Behavior:

- clickable
- opens scene detail page later when available

#### `area`

Purpose:

- show location or grouping context

Behavior:

- sortable
- filterable with area selector

#### `summary`

Purpose:

- human-readable scene description

Examples:

- `Evening lighting`
- `Turns off downstairs lights`
- `Movie mode`

#### `activate`

Purpose:

- primary action

Behavior:

- always a single `Activate` button
- scenes are not modeled as on or off toggles

### Scene Filters

Default quick filters:

- all
- recent
- area
- favorites

Structured filters:

- area
- tags
- scene type

### Scene Saved Views

Starter views:

- `All Scenes`
- `By Room`
- `Lighting`
- `Media`
- `Security`

## Row Interaction Rules

For both devices and scenes:

- clicking the row opens detail
- clicking a control does not trigger row navigation
- control cells should stop propagation cleanly
- keyboard focus should distinguish row focus from inner control focus

Expandable detail rows are optional, but if used they should be:

- fast to open
- non-destructive to sort and filter state
- especially useful for media devices

## Status Renderer Rules

Status display should be renderer-driven, not raw-JSON-driven.

Renderers should exist for:

- switch or light
- lock
- cover
- motion or contact
- water or leak
- battery or signal
- media player
- generic sensor
- offline or unknown

Each renderer should be able to provide:

- icon
- color treatment
- short text
- optional subtitle

## User Preferences

Persist per-user preferences for each page:

- visible columns
- column order
- column widths
- density
- row mode
- last selected view
- preferred sort

These can begin as client-side preferences, but should eventually be server-backed if shared multi-device consistency becomes important.

## Responsive Behavior

Desktop:

- full configurable grid

Tablet:

- fewer default columns
- allow horizontal scroll when needed

Mobile:

- switch to simplified stacked rows
- preserve sorting, filtering, and view selection
- keep primary actions accessible

The mobile layout should be a derived presentation of the same saved view model, not a separate page concept.

## Implementation Phasing

### Phase A

- build reusable `DataGrid`
- implement devices page with basic configurable columns
- implement scenes page on same grid foundation

### Phase B

- add saved views
- add adjustable column widths and reorder
- add rich media row rendering

### Phase C

- add expandable detail rows
- add stronger typed filters
- add scene detail route

### Phase D

- consider server-backed saved views and preferences

## Out Of Scope For This Pass

- bulk edit actions
- inline full device editing
- full scene editor
- dashboard embedding behavior
- server-backed user preference sync
