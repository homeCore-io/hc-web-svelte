# 02 — Navigation and structure

Status: **decided** — see `decisions.md` (N1–N9) · 2026-10-15

What the app consists of, and how somebody moves around it on a phone, a
tablet, a laptop or desktop, and a display. Builds on `decisions.md` (D1–D14);
references like (D3) point there. Decisions to make are at the end (N1–N9).

---

## 1. What has to fit

From the decisions already taken:

- **A generated home** (D1), personalisable by everyone (D6), editable as
  shared pages by admins.
- **Hand-built pages** beside it (D1), on a grid (D4), or on a canvas for
  panels and floorplans.
- **Device details** as a popup — a sheet on phones, a dialog elsewhere (D3).
- **Displays** (D7): a kitchen panel is not a person, has its own home, and
  runs without menus.
- **Two kinds of editing** (D6): *personalising* my own view, and *editing*
  the shared home and pages. They must never be confused — a person hiding a
  card for themselves must not hide it for the household.
- **An advanced text mode** for pages and cards (D13).

And from the existing clients: `hc-web-flutter` is a whole console — devices,
rooms, scenes, modes, helpers, automations (with trace), plugins, users, audit,
logs, system, notifications, wall panels, dashboards. A household member uses
almost none of that; an admin uses all of it. Where it belongs is N1.

## 2. The parts of the app

Grouped by who uses them. "Everyone" means any signed-in person; displays get
a subset (§5).

**Everyone — using the house**

| Part | What it is |
|---|---|
| **Home** | The generated home (D1): summaries, favourites, rooms in the household's order, plus anything personalised. |
| **Room** | One room, generated the same way: its devices as cards, its scenes, its readings. Reached from Home. |
| **Pages** | Hand-built pages the household has made (D1, D4): "Media", "Bedtime", "Garden". |
| **Device details** | The popup (D3). Opens over whatever page it was opened from. |
| **Scenes & modes** | Every scene, one kind regardless of source (D10), and the house's modes as chips. |
| **Search** | One box for devices, rooms, scenes, pages — and, for admins, settings. ⌘K / Ctrl-K on keyboards. |
| **Alerts** | What needs attention: open doors at night, low batteries, devices offline, plugin problems. Appears as a summary on Home and as a list. |
| **Me** | Theme and light/dark (D9a), my personalisation and "reset to shared" (D6), sign out. |

**People with edit rights — shaping the house's pages**

| Part | What it is |
|---|---|
| **Edit mode** | In place, on Home, a Room or a Page: the shared layout, with the grid, the size previews (D5) and the text mode (D13). |
| **New page** | Grid or canvas (D4). |

**Admins — running homeCore** *(placement is N1)*

Devices (rename, room, hint, hide, delete) · Rooms (create, rename, order,
icon) · Scenes (native) · Modes · Helpers (timers, counters, groups…) ·
Automations (with test and trace) · Plugins · Users & roles · Displays (pair,
home, permissions) · Themes · Alerts & notifications settings · System
(status, logs, audit, backup).

## 3. Navigation by screen

The proposal. The same parts everywhere; only the frame changes.

**Phone (portrait)** — a bottom bar with four or five destinations, thumb-reachable:

```
┌─────────────────────────┐
│ Home            🔍  🔔  │  ← title, search, alerts
│                         │
│  (page content)         │
│                         │
├─────────────────────────┤
│ 🏠    ▦     ✦     ☰     │
│ Home Pages Scenes  More │  ← More: Me, (admin) Settings
└─────────────────────────┘
```

Rooms are reached from Home (the room list is Home's main body), not from the
bar. Device details slide up as a sheet; swipe down or back closes it.

**Tablet** — portrait behaves like the phone with more columns; landscape
gets a narrow rail on the left instead of the bottom bar.

**Laptop / desktop** — a sidebar that can collapse to a rail:

```
┌────────────┬──────────────────────────────────────┐
│ homeCore   │ Home                       🔍  🔔  ✎ │
│            │                                      │
│ 🏠 Home    │  (page content, more columns)        │
│ ▦ Pages  ▸ │                                      │
│ ✦ Scenes   │                                      │
│ 🔔 Alerts  │                                      │
│ ── Rooms ─ │                                      │
│  Kitchen   │                                      │
│  Living    │                                      │
│  …         │                                      │
│ ─────────  │                                      │
│ ⚙ Settings │  ← admins only                       │
│ 👤 Me      │                                      │
└────────────┴──────────────────────────────────────┘
```

Rooms are listed in the sidebar here, because there is room for them.

**Display (kiosk)** — no app chrome. Its home fills the screen; if it is
allowed more than one page, a small row of page tabs or a swipe between them.
Device details open as on a tablet. No Settings, no Me, no sign-out from the
panel itself; the admin manages it from Settings → Displays.

## 4. URLs and the back button

- Every part has a URL, so anything can be bookmarked, shared to another
  screen, or set as a display's home: `/`, `/rooms/{id}`, `/pages/{id}`,
  `/scenes`, `/alerts`, `/settings/...`.
- **Device details are in the URL too** (for example `?device={id}` on
  whatever page it opened over). Then the phone's back gesture closes the
  popup instead of leaving the page, a popup can be linked to directly, and a
  page reload keeps it open. (Bubble Card's popups work this way and are one
  of the reasons people choose it.)
- Edit mode is in the URL (`?edit`), so a reload during editing stays in
  editing.

## 5. Who sees what

- A part someone may not use is **not shown** — no disabled menu items. This
  is presentation only; the server is the security (D8).
- Settings exists only for admins, and partially for roles that may manage
  some of it (an automation editor sees Automations).
- Displays see only their home and the pages they are allowed, with no way to
  navigate elsewhere.

## 6. Personalising vs editing

The two must be visibly different, so nobody changes the household's layout
by accident.

- **Personalise** (everyone): long-press or a "Customise" item on Home or a
  Room. Lets you star, hide, reorder for yourself. Says "Only you see these
  changes" and offers "Reset to shared".
- **Edit** (people with edit rights): the ✎ in the header. A visibly different
  mode (frame, toolbar) that says "Editing the shared page — everyone sees
  this", with Done and Cancel.

---

## Decisions to make

**N1 — Does this app also replace the admin console?**
(a) Yes, one app: Settings holds everything `hc-web-flutter` does, built in
later rounds; round one is the household side plus the admin parts the
household side needs (rooms, device names, displays).
(b) Two apps: this one is for using the house; administration stays in
`hc-web-flutter` (or a separate admin app) for now.
(c) Yes, one app, and round one includes the full console.
*Recommend (a).* One app means one design system and one place to learn, as
HA has; building the household side first puts the effort where the family
is, and the Flutter client keeps working for admin tasks in the meantime.

**N2 — The phone bar.** Proposal: Home · Pages · Scenes · More (Me, Settings),
with search and alerts in the header. Alternatives: add Rooms as its own tab;
put Alerts in the bar.

**N3 — Large screens.** Proposal: a collapsible sidebar with rooms listed in
it. Alternative: a top bar with tabs, as on the phone but wider.

**N4 — Rooms as a destination.** Proposal: rooms are reached from Home (and
listed in the desktop sidebar), not a tab of their own on phones.

**N5 — Device details in the URL**, so back closes the popup and popups can
be linked. *Recommend yes.*

**N6 — Personalise vs Edit** as two visibly different modes, as in §6.
*Recommend yes.* Also: how is Personalise entered — long-press on a card, a
"Customise" button, or both?

**N7 — Alerts.** Proposal: a summary on Home and a bell in the header with a
count, opening the list. Do alerts include notifications that rules send to
people, or only the house's own state (open, offline, low battery)?

**N8 — Search.** One search for everything, including settings for admins.
*Recommend yes.*

**N9 — Displays.** If a display may show several pages: tabs along the
bottom, swipe between them, or both? And may someone at a display open the
full app by signing in (a PIN, say), or never?
