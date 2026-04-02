# Dashboard Card Plan

## Goal

Make HomeCore dashboards feel closer to a modern Home Assistant setup:

- many card/widget types
- highly flexible placement
- compact but information-rich cards
- clean, icon-forward visual styling
- practical editing that feels drag-first, not form-first

This is a design and implementation sequence, not a one-shot rewrite.

## Reference Direction

Home Assistant's dashboard model is useful for three reasons:

1. views can use different layout modes instead of forcing one dashboard style
2. cards are composable and typed, with clear responsibility per card
3. dense cards can still be readable because primary, secondary, icon, and action areas are visually separated

The official Home Assistant docs are useful references for:

- dashboard views and layout styles  
  https://www.home-assistant.io/dashboards/views/
- card catalog and add-card patterns  
  https://www.home-assistant.io/dashboards/cards/
- sections-based dashboards  
  https://www.home-assistant.io/dashboards/sections/

For visual treatment, Mushroom Cards are the best style reference:

- compact card shells
- strong icon treatment
- primary/secondary text hierarchy
- clean chip-like actions

Reference:

- https://github.com/piitaya/lovelace-mushroom

## Recommended HomeCore Card System

### Core card families

Start with a small set of high-value cards and make them excellent:

- `entity_card`
  - one device, compact status, one or two quick actions
- `entities_table`
  - dense list/table inside a dashboard card
- `media_card`
  - artwork, title, artist, transport, volume
- `scene_card`
  - scene title, area, activate button
- `mode_card`
  - mode chips or current-state card
- `history_card`
  - small chart with timeframe presets
- `event_feed_card`
  - recent system/device/rule activity
- `markdown_card`
  - getting-started/help/status narrative
- `camera_card`
  - static/refreshing preview first, richer video later
- `dashboard_link_card`
  - jump between dashboards/areas/security/media views

### Second-wave cards

After the core set feels stable:

- `area_summary_card`
- `automation_status_card`
- `rule_trace_card`
- `weather_card`
- `embed_card`
- `tile_group_card`

## Card Styling Direction

Use Mushroom as inspiration, not as a literal copy.

### Visual rules

- rounded cards with soft elevation, not heavy borders
- icon-first layout with strong semantic color
- large primary label, muted secondary detail
- optional tertiary metadata for dense cards
- consistent action strip at the bottom or trailing edge
- practical spacing for desktop and tablet, not oversized mobile-only layouts

### Content hierarchy

Every compact card should have a predictable structure:

1. icon/status
2. primary label
3. secondary state or metadata
4. quick action(s)
5. optional expanded details

### Card size model

Cards should not be infinitely resizable. Use practical size bands:

- `xs`
  - chips, links, small status
- `sm`
  - single entity/tile
- `md`
  - entity with secondary status or controls
- `lg`
  - media/history/events
- `xl`
  - charts, camera, composite lists

Each card type should declare:

- minimum width
- minimum height
- preferred width
- whether it can grow vertically

That will keep editing flexible without letting users create unusable layouts.

## Layout Model

HomeCore should support more than one dashboard layout style over time, but the first editor pass should focus on one excellent freeform grid.

### First implementation

- grid-based free placement
- drag/drop add
- drag move
- edge/corner resize
- collision resolution
- snap to column grid
- per-breakpoint layouts

### Later

- sections view
- masonry-like automatic packing view
- presentation/kiosk mode

## Editor Direction

The editor should feel like a page builder:

- left: card/widget catalog
- center: live canvas
- right: inspector for selected card

### Add flow

1. drag card from catalog to canvas
2. drop into live grid
3. open inspector with sensible defaults
4. pick device/area/query/source from selects, not raw text first

### Editing rules

- drag card itself to move
- drag handles to resize
- inline title/edit affordances only for common actions
- advanced config lives in inspector
- keyboard nudging and numeric sizing remain available for precision

## Data Binding Model

Every card should support one of these binding strategies:

- specific entity/device
- area
- device type
- saved query/filter
- static/manual content
- dashboard link target

Do not make raw JSON the primary editing path.

## Suggested Iteration Order

### Phase 1

- finalize visual system tokens
- create shared card shell
- create shared icon/status treatment
- create card size metadata
- make current dashboard renderer use those primitives

### Phase 2

- `entity_card`
- `scene_card`
- `mode_card`
- `dashboard_link_card`
- improved `markdown_card`

### Phase 3

- `media_card`
- `history_card`
- improved `event_feed_card`
- `area_summary_card`

### Phase 4

- drag/drop add from card catalog
- resize handles
- collision resolution and snap
- right-side inspector

### Phase 5

- camera/video policy-aware cards
- embed cards
- richer plugin-specific enrichments

## Immediate Next Step

Before implementing more editor behavior, define:

- card visual tokens
- shared card shell
- card size constraints
- catalog taxonomy
- inspector layout

That keeps the upcoming dashboard editor work coherent instead of turning into one-off card forms.

## Deferred Follow-Up

Add a HomeCore dashboard-store reload path after dashboard editor development is complete.

- Goal: avoid requiring a HomeCore restart when `data/dashboards.json` changes during development
- Rationale: the web UI is an API client, so file edits are invisible until the server reloads its persistent dashboard store
- Scope: server-side reload endpoint, file watcher, or another explicit refresh mechanism
