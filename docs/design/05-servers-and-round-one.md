# 05 — The two servers, and what round one builds

Status: **decided** — see `decisions.md` (S1–S8) · 2026-10-15

Since M1 there are two servers behind the app: **homeCore**, which keeps the
house and who may do what, and **the UI server**, which keeps how it is shown.
This document says what each does, what has to change in homeCore, and what
round one delivers. Decisions to make are at the end (S1–S8).

---

## 1. The shape

```
  phone / tablet / desktop / display
        │  one origin: https://home.example/
        ▼
  ┌─────────────────────────────────────────────┐
  │ UI server  (the app's container)             │
  │  • serves the app                            │
  │  • /ui/…  pages, layers, preferences,        │
  │           themes, files, extensions          │
  │  • /ui/events  changes to the above          │
  │  • passes /api/v1/… and the event stream     │
  │    through to homeCore                       │
  │  • data: one directory (a volume)            │
  └───────────────┬─────────────────────────────┘
                  │ who is this? (/auth/me)
                  │ /api/v1/…  /events/stream
                  ▼
  ┌─────────────────────────────────────────────┐
  │ homeCore                                     │
  │  devices, rooms, scenes, modes, rules,       │
  │  users, keys (incl. displays), PINs,         │
  │  alert rules, events                         │
  └─────────────────────────────────────────────┘
```

- **One origin.** The browser talks only to the UI server, which passes
  homeCore's API and event stream through. homeCore sends no CORS headers, and
  one origin also means one address to bookmark and one certificate.
- **Sign-in is homeCore's.** The app signs in to homeCore (through the pass-
  through) and holds a homeCore token. The UI server checks every `/ui/…`
  request by asking homeCore who the token belongs to and what it may do
  (`/auth/me`, cached briefly), and stores nothing about passwords.
- **Two event streams, one connection each.** Device and room changes come
  from homeCore's stream; page, layer and preference changes from the UI
  server's. The app merges them.

## 2. The UI server

What it does in round one:

1. **Serves the app** — the built Svelte app and its assets.
2. **Passes `/api/v1/…` and the event stream through** to homeCore, unchanged.
3. **Stores UI documents** — pages, layers, display settings, preferences,
   household settings (room icons and order, phone bar, themes, confirmation
   overrides) — with an owner on each and the access rules from D6/M3/M4.
4. **Stores files** — images, icons, floorplans — content-addressed.
5. **Announces changes** to open screens (`/ui/events`).
6. **Exports and imports** everything as one archive, for backup and for
   moving to a new machine.
7. **Hosts extensions** later (D9b) — not round one.

It owns no device state and makes no decisions about the house.

## 3. What homeCore needs

From the decisions so far, in the order round one needs them.

| # | Change | From | Notes |
|---|---|---|---|
| H1 | **Rooms keep the name as typed and an id that survives a rename** | D10 | Today a room is only a slug, and its id is derived from it. Devices also name their room by slug (`area`, `area_override`), and plugins supply slugs on every registration. So: a room record with a stable id, a display name and its slug; renaming updates the slug and keeps every device pointed at the room; a plugin's slug for a room maps onto it. Device rule names (`living_room.floor_lamp`) are assigned once and don't change on rename, so rules are unaffected. One-time migration of existing rooms. |
| H2 | **A snapshot on connect, and events for what changes today without one** | D11 | Devices added and removed, renames, room moves, `ui_hint` and icon changes, room created/renamed/reordered/deleted, scene and mode created or deleted. |
| H3 | **A display kind of key** | D7, M5 | Built on the existing narrow-scoped API keys: made by an admin, not a person, never an admin; may read devices and command them; whatever further limits are possible before H6. |
| H4 | **Alert rules, checked in homeCore** | C9, M6 | Built-in alarming states (wet, smoke, offline, jammed, low battery) plus time rules ("open after 10 pm"); homeCore raises and clears alerts and announces them; the app lists them. Probably a thin layer over the rule engine. |
| H5 | **Per-person PINs, and a short session on a display** | N9 | A PIN identifies a person at a display; the display then acts with that person's rights for a few minutes. |
| H6 | **Permissions by room and device** | D8 | Later round. Split "operate" from "rename/delete", let operators run scenes, enforce actions' `requires_role`, scope people and displays to rooms and devices. |

H1 and H2 are needed before the app is usable; H3–H5 can follow within
round one; H6 is the next round.

## 4. What round one delivers

A proposal: the smallest whole thing a household can live with.

**In:**
- Sign in; the app on phone, tablet, desktop (N2, N3).
- The **generated home**: summaries, favourites, rooms in order (D1, C5).
- **Room pages**, generated (N4).
- **Cards** for every kind in the house, three forms (C1–C8), live, with the
  waiting and offline states.
- **Device details** popups, generated (D3), in the address (N5).
- **Scenes and modes** (C2, D10).
- **Personalise**: favourite, hide, reorder, Large/Compact, reset (D6, N6, M2–M4).
- **Shared edit** of the generated home and rooms: hide, move, rename, form,
  add a card (D1, N6).
- **Search** (N8).
- **Alerts** (N7, C9), once H4 exists.
- **Displays**: a display key, a home page, kiosk behaviour (D7, M5); PIN
  unlock once H5 exists.
- **Settings — the parts the household side needs:** rooms (create, rename,
  order, icon), device name and room, displays, themes (light/dark and the
  built-in themes).

**Not in round one:**
- Hand-built pages and the canvas (D4) — the generated home and rooms come
  first.
- Per-size adjustments (D5) — reflow only until pages exist.
- The advanced text editor (D13).
- Custom details popups (D3), third-party cards (D9b).
- The rest of the admin console (N1) — hc-web-flutter covers it.
- Room and device permissions (D8, H6).

## 5. How it is built and run

- **One container** for the UI server and the app, next to homeCore's, with
  one volume for its data. Configured with homeCore's address.
- Development runs the same way: the UI server in dev mode, pointed at a
  homeCore — the live house read-only, or a test instance for anything that
  writes.

---

## Decisions to make

**S1 — How the UI server is built.**
(a) **SvelteKit with its Node adapter** — the app and its server in one
project, one language (TypeScript) throughout.
(b) A static Svelte app plus a separate small server (Node, or Rust beside
homeCore).
*Recommend (a)* — one project, one build, one container; the server's needs
(store documents, pass through, check tokens, stream changes) are small.

**S2 — How the UI server stores documents.**
(a) **One JSON file per document** in the data directory, written atomically.
(b) SQLite.
*Recommend (a)* — the data is small, files are readable, diffable and trivial
to back up; (b) if querying or concurrency outgrow it.

**S3 — One origin, with the UI server passing homeCore through.** *Recommend
yes* (§1). The alternative — the browser calling homeCore directly — needs
CORS in homeCore and two addresses.

**S4 — The UI server checks tokens with homeCore** (`/auth/me`, cached for a
short time), and never sees passwords except passing a sign-in through.
*Recommend yes.*

**S5 — The order of homeCore work:** H1 and H2 before the app is usable, H3–H5
within round one, H6 next round. *Recommend yes.*

**S6 — Round one scope as in §4.** In particular: **hand-built pages are not
in round one** — the generated home, rooms and personalising come first. Agree,
or move pages in?

**S7 — Where homeCore work happens.** In the `core/` monorepo on its own
branch, alongside this one, with each H-change documented and tested there as
usual. *Recommend yes.*

**S8 — Backups.** The UI server's export archive, plus its data directory
being a volume you back up with homeCore's. Should homeCore's own backup
fetch the UI server's archive, so one backup holds both? *Recommend later* —
two volumes are fine to start.
