# Rule Trace Viewer Plan

## Goal

Add a rule firing trace viewer that explains what happened when a rule ran:

- what triggered it
- which conditions passed or failed
- which actions were attempted
- which devices/scenes/modes were affected
- when it happened

This should start as a UI built on current event data and then get deeper as the API grows.

## Why It Matters

Today users can see that a rule fired. They still cannot easily answer:

- why did this rule run?
- why did it not run?
- what did it do after firing?
- which action failed?

The trace viewer should become the main debugging surface for automations.

## First Implementation Shape

### Entry points

- from `Automations`
  - `Last Triggered`
  - `Recent fires`
  - future per-rule details drawer
- from `Events`
  - clicking a `rule_fired` event opens the rule trace view filtered to that fire

### First UI

Start with a trace drawer or side panel, not a full complex page:

- header
  - rule name
  - rule id
  - fired timestamp
  - trigger summary
- timeline
  - rule fired
  - condition summaries
  - action summaries
  - linked target entities
- context
  - device link(s)
  - scene link(s)
  - event links

## Data Sources

### Phase 1: current API only

Use what HomeCore already exposes:

- `rule_fired` events
- event log around the same timestamp
- rule metadata from `/automations`

This supports a useful first trace:

- when the rule ran
- which rule it was
- what nearby device/scene events followed

### Phase 2: richer backend correlation

Add server-side trace correlation so a firing has a stable trace id and structured spans:

- trigger evaluation
- condition evaluation result per condition
- action dispatch result per action
- timing/duration
- error messages

That likely requires backend work in `core`.

## Proposed Trace Model

### UI model

- `trace_id`
- `rule_id`
- `rule_name`
- `fired_at`
- `trigger`
- `conditions[]`
- `actions[]`
- `related_events[]`
- `outcome`

### Condition rows

Each condition row should show:

- label
- pass/fail/unknown
- optional details

### Action rows

Each action row should show:

- action type
- target
- sent/skipped/failed
- optional response or error

## Cross Linking

The trace viewer should link outward to:

- device detail pages
- scene detail or scene list filters
- events filtered to this rule
- automation list filtered to this rule

And the rest of the app should link back into traces.

## Suggested Rollout

### Phase 1

- automation row links to filtered events
- rule trace drawer built from current events
- nearby event correlation by time window

### Phase 2

- dedicated `/automations/[id]/traces` page
- trace list per rule
- last 10 runs
- richer status pills

### Phase 3

- backend-generated trace ids
- per-condition and per-action results
- durations and failures
- export/share trace JSON

## Backend Gaps To Consider Later

The current event stream is enough for a first approximation, but a true trace viewer will likely need:

- explicit `rule_trace_started` / `rule_trace_finished`
- condition evaluation events
- action dispatch result events
- trace id carried through child events

That should be planned carefully so it remains API-first and usable by `hc-tui` or any future client.
