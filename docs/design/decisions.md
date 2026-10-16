# Design decisions

Decisions taken while working through `01-home-assistant-review.md` §6. Each
records what was chosen and why. A later decision that reverses one says so
here rather than editing the history.

## D1 — The default experience: generated, with changes layered on top (2026-10-15)

- **What opens:** a home generated from rooms and summaries — what's on, what's
  open, what's playing — then favourites, then rooms in the household's order.
- **Personal changes are layers, not a fork.** Hiding, pinning, reordering,
  renaming and added cards are stored as changes on top of the generated home.
  A new device still appears in its room automatically, and the changes
  survive.
- **Hand-built pages exist as well**, alongside the home.

**Why:** generated works on day one for the whole household with nobody
authoring it. Home Assistant's "take control" is a one-way fork that stops
learning about new devices, so most people never customise; layering avoids
that.

## D2 — Cards: tap for details, visible controls act (2026-10-15)

- **Tapping a card opens its details.** Anywhere on the card that is not a
  control.
- **Only visible controls act** — a switch, a button, a slider. The icon is
  only an icon; it does not toggle (unlike Home Assistant's tile card).
- **Confirmation follows the device, and an admin can change it.** homeCore
  actions already declare a `confirm` prompt; that is the default. An admin can
  turn confirmation on or off per device or per device type (for example,
  always confirm unlocking the front door).

**Why:** one rule to learn, and nothing changes in the house unless something
that looks like a control was pressed. HA's icon toggle is easy to hit by
accident and doesn't look like a control.

## D3 — The details popup: generated, customisable later, adaptive form (2026-10-15)

- **Content is generated from the device's schema:** the main control, large;
  other controls and actions; readings; history; recent activity, saying who
  or what changed it (homeCore's `last_change` provenance); settings.
- **Customising it per device or device type** (a TV remote layout, a
  dishwasher's programme and energy) **is designed in from the start and built
  in a later round.** The first round must not make it hard to add.
- **Form adapts to the screen, content does not:** a sheet that slides up and
  swipes down to close on a phone; a centred dialog over the dimmed page on
  tablet and desktop.

**Why:** a device can do far more than a card shows, and the popup is where the
rest lives. Home Assistant never let people customise it, and it is one of
their most-requested fixes — so the model has to allow it even before it is
built.

## D4 — Layout: a responsive grid, plus a canvas page type for panels (2026-10-15)

- **Pages are a predictable grid of sections.** Cards snap to cells; sections
  wrap as the screen narrows.
- **A separate canvas page type** exists for wall panels and floorplans, where
  exact placement matters and the screen size is known. It is not the general
  page model.

**Why:** predictability across screens is what Home Assistant users praise
most, and HA abandoned its packed layout because cards moved between screens.
A free canvas for every page is what made the previous editor hard.

## D5 — Screen sizes: one layout that reflows, adjustable per size (2026-10-15)

- **One layout reflows automatically** across phone, tablet and desktop.
- **Optional per-size adjustments:** hide a card on phones, reorder for
  tablet, resize for desktop — stored as differences from the one layout, not
  as separate copies.
- **The editor previews each size**, so nobody has to open the page on another
  device (or in browser devtools) to see what will happen.

**Why:** separate layouts per size drift apart and multiply the work; pure
reflow leaves phones wasteful, which HA users complain about. Previewing is the
fix for "I designed it on my PC and it fell apart on the tablet."

## D6 — Editing: shared pages by admins, a personal layer for everyone (2026-10-15)

- **Shared:** admins, and anyone granted edit on a particular page, build and
  change the shared home and pages for the household.
- **Personal:** every user can personalise their own view — favourites, room
  order, hiding and showing things, pinning cards. It affects only them, and
  "reset to shared" always takes them back.
- The personal layer is the same mechanism as D1's layers, applied per user.

**Why:** in Home Assistant only admins change anything, so family members live
with what one person built. Personal changes that touch nobody else are safe
enough to give everyone.

## D7 — Displays: a screen is its own thing, separate from users (2026-10-15)

- **An admin registers a display** (kitchen panel, hall tablet, bedside clock),
  for example by pairing: the tablet shows a code, the admin enters it.
- **Each display has** its own home page, built-in kiosk behaviour (no menus,
  stays awake, optional screensaver, scheduled reload) and its own limited
  permissions.
- People sign in on their own phones and computers as normal; a display is
  not a person and does not use a person's account.

**Why:** Home Assistant ties "which dashboard opens" to the user, so its
official answer for wall tablets is one user account per tablet, and kiosk
behaviour needs third-party tools. A whitelisted tablet in homeCore today is a
full admin.

## D8 — Permissions by room and device: designed in now, enforced later (2026-10-15)

- **The UI is designed so server-enforced permissions slot in** — every view
  and control shows only what the session may do, from what the server says,
  never by hiding as security.
- **The first round uses today's roles and scopes.** The homeCore work —
  splitting "operate a device" from "rename or delete it", letting operators
  run scenes, enforcing actions' `requires_role`, scoping users and displays
  to rooms or devices — comes in a later round.

**Consequence for D7:** in the first round a display gets its own identity,
home page and kiosk behaviour, but its "limited permissions" are only as fine
as today's roles allow until the D8 work lands. Display pairing and display
credentials are still a core addition in round one — what a whitelisted IP
gets today (synthetic admin) is not acceptable for a display.

**Why:** the user chose to sequence the core permission work after the first
UI round rather than block on it.

## D9 — Look and extensibility (2026-10-15)

**D9a — Design tokens, with per-user choice.**
- One built-in design system with a small set of card forms.
- Themes are sets of design tokens — colour, type, radius, density — and
  never CSS that reaches into a component's internals.
- The house has a default theme; each user chooses light, dark or auto and may
  choose another theme; a display (D7) has its own.

**D9b — Third-party cards: later, as code components.**
- Not in round one.
- Later, third parties ship their own card forms as code through a stable,
  versioned interface (Home Assistant's custom-card model).
- **Consequences to design for now:**
  - The interface must not depend on the host's framework. If the host is
    Svelte or Solid (D14), an extension author must not have to be — the
    natural boundary is a standard custom element with a small, versioned
    contract (device data in, commands out, theme tokens inherited).
  - Extensions get the design tokens, so they can match the theme without
    reaching into anything.
  - The host has to survive a broken or slow extension: a card that throws or
    stalls must not take the page with it, and a performance budget (D12)
    applies to extension cards too.

**Why:** the user prefers the freedom of code components over data-only cards,
accepting HA's known risks — breakage on upgrade, off-theme looks, slowness —
and so the contract has to be designed to contain them.

## D10 — The house model for round one (2026-10-15)

**Rooms — stable id and typed name in core; icon and order in the UI.**
- homeCore keeps a room's **name as typed** ("TV Room", "Kid's Room"), still
  deriving the slug rules use, and gives rooms an **id that survives a
  rename**. Today the server stores only the slug and derives the id from it
  (`core/crates/hc-types/src/device.rs:465`,
  `core/crates/hc-api/src/handlers.rs:2390`), so a rename breaks anything that
  refers to the room — a personal room order, a pinned room, a display scoped
  to the kitchen (D7). Needs a one-time migration of existing rooms. **[core]**
- **Icon and household order live in the UI's own storage**, keyed by the
  stable id.

**Floors — not in round one.**

**Grouping related devices — not needed.** Plugins already merge what belongs
together: Hue folds connectivity into the light
(`core/plugins/hc-hue/src/sync.rs:288`) and motion, temperature and light level
into one device (`compact_motion_facets`, on by default). The remaining case,
Z-Wave multi-channel devices arriving as one device with `ep1_on`, `ep2_on`…,
is presentation: the UI shows one control per channel.

**Scenes — one kind, as far as the UI is concerned.** Native scenes and plugin
scenes (Hue, Lutron, Caseta, ISY devices of type `scene`) look and behave the
same everywhere in the UI, whatever their source. Whether that is unified in
the client or in core is an implementation question still to settle.

**House mode — present the existing modes; no server change.** Today's on/off
modes are shown as a clear set of chips; a group configured as mutually
exclusive is shown as one choice.

## D11 — Live correctness: fix the event stream in round one (2026-10-15)

- homeCore sends a **snapshot when a client connects**, and **events for**
  device renames, room moves, devices added and removed, and room, page and
  scene changes. **[core]**
- So two open screens never disagree: a wall panel updates the moment someone
  renames a device on their phone.

**Why:** today a client must load state over REST before the stream is any
use, and metadata edits are saved without an event
(`core/crates/hc-api/src/handlers.rs:796`), so every other open screen goes
stale until it reloads.

## D12 — Performance: held to a mid-range target (2026-10-15)

- Measured against a **recent mid-range phone and a base-model tablet**, not
  the cheapest hardware.
- The measures — cold-load time to a usable home, time from tap to visible
  response, and a cap on page size (element count) — are set as numbers before
  the framework is chosen (D14) and checked automatically on every change.
- Applies to third-party cards too (D9b).

**Why:** Home Assistant's dashboards are slow even on good hardware (one
simple dashboard measured over 30,000 elements). A budget only works if it is
measured.

## D13 — Text editing: an advanced mode, kept in sync with the visual editor (2026-10-15)

- An **advanced-mode text editor** for any page or card, alongside the visual
  editor.
- **Round-trips without loss.** Switching between text and visual editing must
  never drop anything the other wrote — Home Assistant's editor rewriting YAML
  and discarding comments is one of its top complaints. Whether the text form
  is YAML (comments must then survive) or JSON is still to decide.
- Export and import of pages, themes and settings as files, for backup and
  sharing, comes with it.

**Why:** chosen over visual-only so advanced users are never blocked by the
visual editor; the cost is that both editors must agree on everything.

## D14 — Framework: Svelte 5 (2026-10-15)

- The redesigned client is built with **Svelte 5**.
- Third-party cards (D9b) still meet the host at a framework-neutral boundary
  (a standard custom element), so extension authors do not need Svelte.
- The D12 performance budget is still set as numbers and measured; choosing
  the framework first does not remove it.

**Why:** the user's choice. Svelte 5 is compiler-based with a large community,
and ha-fusion — the community dashboard built for speed — uses it.

---

# From 02 — Navigation and structure

## N1 — One app, household side first (2026-10-15)

- This app becomes the only homeCore web UI. A **Settings** area will
  eventually hold everything `hc-web-flutter` does — devices, rooms, scenes,
  modes, helpers, automations, plugins, users, displays, themes, alerts,
  system.
- **Round one** builds the household side plus the admin parts it depends on:
  rooms (D10), device names and rooms, displays (D7).
- `hc-web-flutter` stays in use for every other admin task until its
  replacement is built.

**Why:** one design system and one place to learn; effort goes first where the
whole household is.

## N2 — Phone bar: Home · Pages · Scenes · More, configurable (2026-10-15)

- **Default:** Home · Pages · Scenes · More. Rooms are reached from Home;
  search and alerts are in the header; More holds Me and, for admins,
  Settings.
- **Configurable.** Which destinations sit in the bar, and in what order, can
  be changed. Assumed until said otherwise: the household default is set by an
  admin, and each person may change their own (the D6 personal layer).

## N3 — Laptop and desktop: a collapsible sidebar (2026-10-15)

- A left sidebar: Home, Pages, Scenes, Alerts, the household's rooms in order,
  then Settings (admins) and Me. It collapses to an icon rail.
- Tablet landscape uses the rail; tablet portrait behaves like the phone.

## N4 — Rooms are reached from Home (2026-10-15)

- On phones, Home's main body is the room list; a room opens from there. No
  Rooms destination by default — though a person can add one to their bar
  (N2).
- On larger screens, rooms are also listed in the sidebar (N3).

## N5 — An open device popup is part of the address (2026-10-15)

- The address carries the open device (for example `?device={id}` over
  whatever page it opened on).
- So the phone's back gesture closes the popup rather than leaving the page, a
  popup can be linked to directly, and a reload keeps it open. Edit mode is in
  the address the same way.

## N6 — Personalise and Edit are different modes (2026-10-15)

- **Personalise** (everyone): a "Customise" item in the page's menu enters it.
  It is labelled "Only you see these changes" and offers "Reset to shared".
  **Long-press on a card** is a shortcut to star or hide it for yourself.
- **Edit** (people with edit rights): the ✎ in the header. Visibly different —
  frame and toolbar — and labelled "Editing the shared page — everyone sees
  this", with Done and Cancel.

**Why:** a person hiding a card for themselves must never hide it for the
household.

## N7 — Alerts are the house's own state (2026-10-15)

- Alerts are what the house's state implies: doors or windows open, devices
  offline, low batteries, plugin problems.
- A summary on Home and a bell with a count in the header, opening the list.
- Notifications that automations send to people are **not** alerts here; they
  go to their own channels (phone push and so on).

## N8 — One search for everything (2026-10-15)

- One search, from the header or ⌘K / Ctrl-K, finds devices, rooms, scenes,
  pages and — for admins — settings, limited to what the person may see.
- Choosing a device opens its popup (N5); a room or page goes there.

## N9 — Displays: tabs and swipe; a PIN unlocks the full app for a while (2026-10-15)

- A display with several pages shows a small row of tabs, and swiping moves
  between pages.
- A person can **unlock the full app on a display with their own PIN** for a
  short time; it then locks back to the display's pages.
- **[core]:** needs per-user PINs and a short-lived session on a display's
  device — the PIN identifies the person, and while unlocked the display acts
  with that person's rights, not its own.
