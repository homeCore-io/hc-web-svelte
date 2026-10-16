# 07 — Round one plan

Status: **decided** — see `decisions.md` (P1–P5; P3 and P5 differ from the draft's recommendations) · 2026-10-15

Round one's scope is S6. This puts it in order as milestones. Each milestone
ends with something the household can try on the live house and passes its
tests and the performance budget (V5). Milestones are reviewed when
convenient, not as a gate (P5).
Decisions to make are at the end (P1–P5).

---

## Milestones

### R0 — Foundations

**Builds:**
- The SvelteKit project with its Node adapter (S1).
- The UI server's pass-through to homeCore's API and event stream, and
  sign-in through homeCore (S3, S4).
- The design system as code: both themes' tokens, Figtree and Plex Mono
  self-hosted, Lucide (V1–V4); light/dark following the device, with the
  per-person override (V2).
- The app frame: the phone bar, the tablet rail, the desktop sidebar (N2, N3),
  with empty pages behind them.
- The performance check, against a recorded copy of this house's devices (V5).
- The container and its data volume (S2, S8).

**Try it:** sign in on the phone and on the Mac; move between the empty pages;
switch light and dark.

### R1 — homeCore: rooms and live updates

**homeCore (on `develop`, S7):**
- **H1** rooms with a stable id and the name as typed, devices kept pointed at
  their room through a rename, plugin room slugs mapped onto rooms, and the
  one-time migration.
- **H2** a snapshot on connect, and events for devices added and removed,
  renames, room moves, `ui_hint` and icon changes, and room, scene and mode
  changes.

**Try it:** rename a room — "Tv room" to "TV Room" — and see devices stay in
it and every open client update.

### R2 — The generated home, live

**Builds:**
- The generated home: summary chips, rooms in order, room cards with their
  summaries and "All off" (D1, C5).
- Generated room pages.
- Cards for every kind in the house — Compact, Standard, Large — with their
  controls (C1–C4, C6, C7), the generic rule for anything else (03 §4), and
  the shared states: waiting with the 5-second report (C8), offline, changed
  elsewhere, stale.

**Try it:** run the house from the phone — lights, locks, the TV, the
garage — and watch changes made elsewhere appear.

### R3 — Details, scenes, search

**Builds:**
- Device details: the sheet on phones, the dialog elsewhere, generated from
  each device's schema, in the address so back closes it (D3, N5).
- Scenes as buttons — tap runs, long-press for details — and the modes as
  chips (C2, D10).
- One search, from the header and ⌘K (N8).

**Try it:** open any device and use everything it can do; run scenes; find
anything by typing.

### R4 — Personalise

**Builds:**
- The UI server's document store and its change events (S2, M1).
- Personal layers (M2–M4): favourite, hide, reorder, choose a card's form,
  "Reset to shared"; Customise mode and the long-press shortcut (N6); the
  personal phone bar (N2).

**Try it:** two people set up their own home differently on their own
phones; each sees only their own changes.

### R5 — Shared editing and Settings

**Builds:**
- Edit mode for the household's home and room pages: hide, move, rename,
  change form, add a card; Done and Cancel; undo within the session (N6, M2).
- Settings for: rooms — create, rename, order, icon (D10); a device's name
  and room; themes; confirmation per device or type (D2); the default phone
  bar (N2).

**Try it:** arrange the household's home; reorder rooms; rename a device.

### R6 — Alerts

**homeCore:** **H4** alert rules — the built-in alarming states and time
rules — raised and cleared by homeCore and announced (C9, M6).

**Builds:** the alert summary and the bell (N7); alarming states emphasised
on cards; time rules in Settings.

**Try it:** leave the garage open past the rule's time and see it raised
everywhere, then cleared.

### R7 — Displays

**homeCore:** **H3** display keys (M5); **H5** per-person PINs and the short
session on a display (N9).

**Builds:** Settings → Displays (create, home page, pages, kiosk settings);
the kiosk frame — no menus, tabs and swipe, stays awake, follows Night Mode
if set (V2); PIN unlock.

**Try it:** turn a spare tablet into the kitchen panel.

## How each milestone is checked

- **Tests** for the app's logic (card choice, layers, the generic rule),
  component tests for cards and pages, and end-to-end tests in a browser —
  all against a **recorded copy of this house**, never sending commands to
  the live house.
- **The performance budget** (V5), measured on every change.
- **A try-out on the live house** by the household before the milestone is
  called done.

---

## Decisions to make

**P1 — The order above.** In particular: alerts (R6) and displays (R7) come
after personalising and editing. *Recommend as written* — the generated home,
details and personalising are what every person uses every day.

**P2 — Where milestones are tried.** *Recommend* a dev instance on fractal,
reachable from the Mac like the current one (a different port), talking to
the live homeCore. From R2 on, its controls operate real devices — that is
what trying it means. Its own data (the UI server's volume) is separate from
anything existing.

**P3 — How homeCore changes reach the house.** H1–H5 land on core's `develop`
(S7); to try them they must run on the house's homeCore.
(a) Deploy `develop` to the house's homeCore after each H-change, with a
backup taken first (H1 includes a data migration).
(b) Run a second, test homeCore on fractal with a copy of the house's data,
and point the dev instance at it until the change has been tried.
*Recommend (b) for H1* (the migration) *and (a) for the rest* — but this is
your production system, so it's your call.

**P4 — Tests never command the live house.** Automated tests use the
recorded copy; only people trying a milestone press real buttons.
*Recommend yes.*

**P5 — Review between milestones.** Each milestone ends with a try-out and
your go-ahead before the next starts. *Recommend yes* — it is how the last
editor would have been caught early.
