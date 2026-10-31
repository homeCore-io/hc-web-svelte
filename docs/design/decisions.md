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

---

# From 03 — Cards

## C1 — Three device card forms, and a short list of other cards (2026-10-15)

- **Device cards:** Compact (one row), Standard (the default: icon, name,
  state line, one control), Large (Standard plus the next most-used controls
  inline). Details always hold the rest.
- **Other cards:** room, summary chip, scene, mode chips, reading, chart,
  camera, and page items (heading, text, image, link) on hand-built pages.

## C2 — A scene card is a button: tap runs it (2026-10-15)

- **An exception to D2.** A scene's only action is to run, so tapping a scene
  card runs it; **long-press opens its details** (what it sets).
- **Consequence for N6:** on a scene card, long-press is details rather than
  the star/hide shortcut, so scenes are starred or hidden from Customise mode.

## C4 — Lock and unlock on the card (2026-10-15)

- The lock card shows Lock or Unlock according to its state. Unlocking asks
  first where confirmation is set (D2).

## C5 — Room cards: a summary, and "All off" when something is on (2026-10-15)

- Name, icon, and a summary — lights on, temperature, anything open,
  anything playing — plus an **All off** control shown only while something in
  the room is on.

## C3 — The per-kind table is the starting point (2026-10-15)

- `03-cards.md` §3 — state line, card control, what Large adds, what details
  lead with, for every kind in the house — is adopted as is, to be tuned row
  by row as cards are designed. The generic rule (§4) covers every other kind.

## C6 — Infrastructure is shown like any device (2026-10-15)

- Gateways, bridges and Pico remotes appear in their rooms on the generated
  home like everything else. Anyone who doesn't want one there hides it
  (personalise, or shared edit).

## C7 — Multi-channel devices: one card, a switch per channel (2026-10-15)

- A Z-Wave device reporting `ep1_on`, `ep2_on`… is **one card** with a switch
  for each channel, labelled from the channel names where set.

## C8 — An unconfirmed command is reported after 5 seconds, longer for slow kinds (2026-10-15)

- After a press the card shows the new state at once, marked as waiting. If
  the house hasn't confirmed it (the state change carrying the command's
  correlation id) within **5 seconds** — longer for slow kinds such as locks
  — the card returns to the real state and says the command didn't take.

## C9 — Alarming states: a built-in set, plus time rules (2026-10-15)

- **Built in:** wet, smoke, offline, lock jammed, low battery.
- **Rules an admin sets in Settings**, such as "garage open after 10 pm" or
  "front door unlocked for 30 minutes".
- Alarming states are emphasised on their cards and listed in Alerts (N7).
- **Open for 04:** where these rules live and are evaluated. If each screen
  works them out for itself, two screens can disagree, and a display would
  have to be running to notice anything; evaluating them in homeCore avoids
  both. **[core?]**

---

# From 04 — Data model

## M1 — UI data is split by purpose: house facts in homeCore, presentation in the UI's server (2026-10-15)

**homeCore keeps** facts about the house and identity — small, structured,
the same for every client, working with no UI open:
- rooms: stable id and the name as typed (D10);
- display and PIN **credentials** (D7, N9) — identities only;
- alert rules and their evaluation (M6);
- events for all of these (D11).

**The UI's own server** — the container the app runs in — keeps everything
about presentation: pages, layers (household, per-size, personal), personal
preferences, themes, room icons and order, the phone bar, which page a display
shows and its kiosk settings, images, icons, fonts, floorplans, and
third-party card code (D9b). Its formats change with the UI without touching
homeCore.

**Consequences:**
- **Sign-in stays homeCore's.** The UI server accepts a homeCore session and
  asks homeCore who it is and what it may do.
- **The UI server announces its own changes** to open screens; device and
  room changes still come from homeCore's event stream. D11's "page changes"
  events are the UI server's, not homeCore's.
- **Backups:** the UI's data is one directory (a container volume) with an
  export, backed up alongside homeCore's — not stored in homeCore.
- homeCore's existing `/dashboards`, `/skins` and `/assets` stay for
  hc-web-flutter; the new app does not use them, and they can be retired once
  nothing does.

**Why:** storing presentation in homeCore would limit what the UI can do and
how it can be extended, and bloat homeCore with images, icons and UI
documents. This revises the original 04 draft, which put everything in
homeCore.

## M6 — Alert rules are checked in homeCore (2026-10-15)

- homeCore evaluates alert rules (C9) — whether or not any screen is open, the
  same for every client — and announces alerts on its event stream; screens
  only show them. homeCore's rule engine already watches states and
  durations, so this may be a thin layer over it. **[core]**

## M2 — Layers are lists of changes keyed by stable ids (2026-10-15)

- Household edits, per-size adjustments and personal changes are each a list
  of small changes — hide, move, rename, change form, add — naming what they
  change by a stable id (`device:porch_light`, `room:kitchen`; added cards get
  their own).
- Never a copy of the page. The generated base keeps changing underneath; a
  change naming something that no longer exists is kept, skipped, and shown in
  edit mode.

**Why:** it is what lets D1 work — new devices appear and changes survive.

## M3 — Personal changes win, for that person (2026-10-15)

- If the household hid something, a person may show it again on their own
  view. Hiding is presentation; real restrictions come from permissions (D8).

## M4 — Hand-built pages can be personalised too (2026-10-15)

- Favourite, hide and reorder for yourself on any page, not only the
  generated home and rooms.

## M5 — A display's identity is an admin-made key (2026-10-15)

- An admin creates a display key in Settings and enters it on the tablet once.
  No pairing flow.
- Built on homeCore's existing API keys with narrower permissions than their
  owner; a display key is not a person's account and is not an admin. **[core]**:
  a display kind of key, and whatever limits it needs until D8's permissions
  arrive.
- Which pages the display shows and its kiosk settings live in the UI server
  (M1), keyed by the display's identity.

## M7 — The advanced editor's text is JSON (2026-10-15)

- JSON, which has no comments — so nothing can be lost moving between text
  and visual editing (D13).
- Any item may carry a `note` field for explanations; the visual editor shows
  and edits it too.

## M8 — Existing pages are left where they are (2026-10-15)

- The new app starts from the generated home and new pages. Pages made with
  hc-web-lit and hc-web-flutter stay for those clients.
- An import tool can come later if they are missed.

---

# From 05 — The two servers, and round one

## S1 — The UI server is SvelteKit with its Node adapter (2026-10-15)

- The app and its server are one project, TypeScript throughout: one build,
  one container.

## S2 — The UI server stores one JSON file per document (2026-10-15)

- In its data directory (a volume), written atomically. Readable, diffable,
  trivial to back up. SQLite remains the option if querying or concurrent
  writes outgrow files.

## S3, S4 — One origin; homeCore passed through and trusted for sign-in (2026-10-15)

- The browser talks only to the UI server, which passes `/api/v1/…` and the
  event stream through to homeCore unchanged. homeCore needs no CORS.
- Every `/ui/…` request is checked by asking homeCore who the token belongs to
  and what it may do (`/auth/me`, cached briefly). The UI server stores
  nothing about passwords.

## S6 — Round one is the household side, without hand-built pages (2026-10-15)

**In:** sign-in; phone, tablet and desktop navigation; the generated home;
generated room pages; cards for every kind in the house in three forms, live,
with waiting and offline states; generated device details in the address;
scenes and modes; personalise; shared edit of the generated home and rooms;
search; alerts (once homeCore's H4 exists); displays with a key, home page and
kiosk behaviour (PIN unlock once H5 exists); Settings for rooms, device name
and room, displays and themes.

**Later:** hand-built pages and the canvas; per-size adjustments; the
advanced text editor; custom details popups; third-party cards; the rest of
the admin console; room and device permissions.

## S5 — The order of homeCore work (2026-10-15)

- **H1** rooms with a stable id and typed name, and **H2** the event-stream
  fixes, come before the app is usable.
- **H3** display keys, **H4** alert rules and **H5** PINs come within round
  one.
- **H6** room and device permissions is the next round.

## S7 — homeCore work lands on core's develop branch (2026-10-15)

- Each H-change is made, documented and tested in the `core/` monorepo and
  lands on its `develop` branch as it is done — no long-lived branch.

## S8 — Backups: two volumes for now (2026-10-15)

- The UI server's data volume, and its export archive, are backed up
  alongside homeCore's. Having homeCore's own backup fetch the UI archive, so
  one backup holds both, can come later.

---

# From 06 — Visual design

## V1 — One design system: Calm is the light theme, Night panel the dark (2026-10-15)

- From the three mockup directions, **A (Calm)** becomes the light theme and
  **B (Night panel)** the dark theme. C (Bright tiles) is not taken forward.
- Everything but colour is shared: **Figtree** for all text, **IBM Plex Mono**
  for numbers and readings; 14px card corners; one spacing scale.
- Amber means *on*; red/coral means *needs attention*; nothing else is
  coloured. Token values are in `06-visual-design.md` §1.

**Why:** a night mode is needed, and A and B already share the warm amber
"on" language; C's whole-card fills were the loudest of the three.

## V2 — Dark follows the device, with a per-person override (2026-10-15)

- By default the app follows the phone's or computer's light/dark setting.
- Each person can force light or dark (D9a).
- A display has its own setting, which can include following the house's
  Night Mode.

## V3 — Icons: Lucide (2026-10-15)

- Open source (ISC), the thin-stroke style of the mockups, about 1,500 icons,
  with a Svelte package that ships only the icons used.

## V4 — Works without the internet (2026-10-15)

- Fonts, icons and every other asset are served by the UI server. Nothing is
  fetched from a third party at run time, so the house's UI keeps working when
  the internet is down and no third party sees who uses it.

## V5 — The performance budget (2026-10-15)

On a mid-range phone and a base iPad, on the home network:
- cold load to a usable home ≤ 1.5 s; reload with the app cached ≤ 0.5 s;
- tap to visible response ≤ 100 ms;
- a device change on screen ≤ 250 ms after homeCore announces it;
- JavaScript for the home ≤ 150 KB compressed;
- ≤ 1,500 elements on this house's home (184 devices);
- smooth 60 fps scrolling.

Checked automatically on every change against a recorded copy of this
house's devices. Settles D12's numbers.

---

# From 07 — Round one plan

## P1 — Milestones in the order written (2026-10-15)

R0 foundations → R1 homeCore rooms and live updates → R2 the generated home,
live → R3 details, scenes, search → R4 personalise → R5 shared editing and
Settings → R6 alerts → R7 displays.

## P2 — Try-outs on a dev instance against the live homeCore (2026-10-15)

- A dev instance on fractal, on its own port, reachable from the Mac, talking
  to the live homeCore. From R2 its controls operate real devices.
- Its UI data is its own volume, separate from anything that exists today.

## P3 — homeCore changes reach the house through homeCore's own releases (2026-10-15)

- H-changes are committed on core's `develop` (S7). To reach the house, they
  go through **homeCore's release process** — release notes entry, CI green on
  the release commit, then the tag (`AGENTS.md`, "Releasing") — after which
  GitHub Actions builds the container and **the user deploys it by hand**.
- So a milestone that needs an H-change (R1, R6, R7) can be tried on the
  house only after a homeCore release has been cut and deployed. Until then
  the UI side is built and tested against a recorded or locally run homeCore.
- Releases, pushes and tags are outward-facing: each is confirmed with the
  user before it happens. H1's room migration must be called out in that
  release's notes.

## P4 — Automated tests never command the live house (2026-10-15)

- Tests use a recorded copy of the house; only people trying a milestone press
  real buttons.

## P5 — No gate between milestones (2026-10-15)

- Work continues from one milestone to the next; each is tried and reviewed
  when convenient rather than blocking the next.

---

# Made while building

## B1 — The session lives in httpOnly cookies, not in the app (R0, 2026-10-15)

- Refines S4. Signing in goes through the UI server (`/ui/auth/login`), which
  passes the password to homeCore and keeps homeCore's access and refresh
  tokens in `HttpOnly`, `SameSite=Strict` cookies. Everything passed through to
  homeCore gets the access token added by the UI server, including the event
  stream (as its `token` parameter).
- The app's code never holds a credential, so a script injected into the page
  has nothing to steal, and no URL the page builds carries a token.
- Refresh tokens are single-use in homeCore (reuse revokes the chain), so the
  UI server makes at most one refresh per refresh token and shares the result.

## B2 — The UI server never forwards an anonymous request (R0, 2026-10-15)

- Found while testing R0 against the house: homeCore treats whitelisted
  addresses as admin with no token, the UI server's own address (fractal,
  10.0.10.200) is whitelisted on the house's homeCore, and every request
  through the UI server comes from that address.
- So the UI server refuses (401) any request to homeCore that carries no
  session and no `Authorization` header, except signing in and refreshing. A
  credential wins over the whitelist in homeCore's REST API — and, from H2,
  on the event stream too (B5).
- The old hc-web-lit dev server on fractal had the same exposure; it was
  stopped on 2026-10-16. The whitelist itself is described in homeCore as
  deprecated; removing fractal from it is the household's call.

## B3 — Rooms a bridge reports are made; renames and merges leave aliases (R1, 2026-10-16)

- Refines D10 for H1. A room is a record with an id assigned once (rooms that
  existed keep the id they had), the name as typed, its slug, and aliases.
- A room a plugin reports that the house does not have is **made**, named as
  the bridge spells it. A rename keeps the old slug as an alias, so the bridge
  still saying "Tv room" puts its devices in the renamed room instead of
  bringing the old one back. **Merging** a room into another (new:
  `POST /areas/{id}/merge`) moves every slug it answered to, so a bridge's room
  can be folded away for good; deleting one only lasts until the bridge
  reports it again.
- Migration names the existing rooms in Title Case ("Tv Room"); the first
  bridge to spell a room its own way ("Master Bedroom") replaces the guess. A
  person's name is never replaced.

## B4 — Device and scene changes are announced by homeCore's store (R1, 2026-10-16)

- For H2. Devices are written from dozens of places and deleted from eight, so
  the events (`device_added`, `device_metadata_changed`, `device_removed`,
  `scene_changed`, `scene_removed`) are raised by the state store on any write
  that changes them, not by each edit path. Room events come from the rooms
  module. A state report raises none of these; it has its own event.
- The snapshot is opt-in (`?snapshot=true`), because clients written before it
  would not know the frame.

## B5 — On the event stream, a token wins over the whitelist (R1, 2026-10-16)

- Found building H2: the stream checked the whitelist before the token, so a
  signed-in person's stream through the UI server (a whitelisted address)
  counted as admin, while their REST calls counted as them. Now the stream
  matches REST. It matters more with a snapshot, which will be scoped to what
  the person may read (D8).

## B6 — A command is confirmed by the device reporting what was asked (R2, 2026-10-16)

- Refines C8. homeCore accepts a command without handing back its
  correlation id, so the app treats a command as confirmed when the device
  reports the values asked for (allowing a bridge to round a level). This is
  also what a person means by "it worked": the light is on, whoever turned it
  on. Asking for what the device already reports is sent without waiting,
  since homeCore sends nothing back for a change that changes nothing.
- Actions (play, a scene) have no value to wait for; they report only a
  failure to send. Locks get 20 seconds, everything else 5.

## B7 — The generated home and rooms, as built (R2, 2026-10-16)

- **Home:** chips for leaks, what's open, what's unlocked, lights on and
  what's playing, each opening the cards behind it; the house's modes and
  the scenes in no room; then every room with its summary and All off.
  Devices in no room are listed under "Not in a room".
- **A room page:** controls, scenes, sensors, then infrastructure (C6), as
  Standard cards; media players as Large.
- **All off** turns off lights, switches, fans and players that are on —
  never locks, modes or timers — and a room's summary counts every one of
  them, so the button never sits beside "All quiet".
- **To revisit:** this house has 21 scenes in no room, which is most of
  Home on a phone. Personalising (R4) can hide or star them; giving them
  rooms is the other answer.

## B8 — Details, scenes and search, as built (R3, 2026-10-16)

- **Details** are generated by one function over the schema (`details.ts`):
  the card's control made large, every other writable attribute, actions
  grouped by the plugin's own categories (the first two open, the rest
  folded), readings, a day's chart, recent activity saying who changed it,
  and housekeeping under More. An action that stands in for an attribute
  (`writes`) replaces that attribute's control; one whose choices are empty
  is not offered. A light's, switch's, fan's or player's leftover readings go
  under More, and players get no chart — what they report is noise.
- **Activity** comes from homeCore's recent event log, so it starts empty
  after homeCore restarts. A lasting history of who did what would need
  homeCore to keep provenance with its history — a later H-change if missed.
- **The popup** is a native modal dialog, in the address as `?device=`;
  back closes it when the app opened it, and a direct link or reload keeps
  it open. Action confirmations use the browser's own confirm for now.
- **Scenes:** long-press (or right-click) opens a plugin scene's details;
  homeCore's own scenes have none yet.
- **Search** ranks the start of a name first and needs every word to match
  name, room or kind. Settings join it when Settings exists (R5).

## B9 — Personalising, as built (R4, 2026-10-16)

- **The UI server's store** (S2): one JSON file per document under the data
  directory, written to a temporary file and renamed, each with a version.
  A save names the version it was made against; a stale one is refused with
  the current document (409). Writes to one document are queued.
- **A person's document** (`/ui/prefs`, only theirs, named by their homeCore
  id) holds their favourites, their changes per page (`home`,
  `room:{id}`), their phone bar and their light/dark choice. The app shows a
  change at once and saves behind; on a conflict it reapplies the same
  change to what the server has, so changes on two of their screens both
  survive. Their other screens hear of it on `/ui/events` (server-sent
  events, announced only to the person whose document it is).
- **Changes** are `hide`, `show`, `move … before …` and `form`, keyed by
  `device:`, `room:` and `scene:` ids (M2). A later change to the same thing
  replaces the earlier, so the list stays the size of what was changed.
- **Favourites** are one ordered list, shown at the top of Home; anything
  can be starred from wherever it appears.
- **Customise** (N6) is a mode per page: a banner saying only you see these
  changes, Reset to shared, Done; each card goes quiet with its tools under
  it. **Long-press or right-click** a card for the shortcut: star, or hide
  for me.
- **The phone bar** (N2) is chosen on Me: up to four of Home, Pages, Scenes,
  Alerts, Search or any room, then More.
- **Light/dark** moved from this browser to the person's document, with a
  copy kept in the browser for the first paint; a choice made before R4 is
  saved for them rather than lost.
- **Not yet:** the household default bar and household edits (R5), and
  undo within a Customise session.

## B10 — Shared editing and Settings, as built (R5, 2026-10-16)

- **The household's document** (`/ui/house`, one for the house): its changes
  per page, room icons, the default phone bar, the house's theme and
  confirmation overrides. Everyone signed in reads it; writing takes
  homeCore's `content:write` — its scope for authoring how the house presents
  itself — judged from homeCore's answer, never the role's name. Saving works
  as for a person's document (version, 409, reapply); every open screen hears
  of a change on `/ui/events`.
- **What a screen shows** is the generated page, then the household's
  changes, then the person's (M3): a person may show what the household hid.
- **New changes:** `rename` (a card's label on that page — the device keeps
  its own name), and `add` / `remove` (a card for something not generated
  there: under **Pinned** on Home, **Also here** on a room).
- **Edit** (N6) is the ✎ in the header, for people with `content:write`, and
  is in the address (`?edit`, N5). An accent frame and bar say "Editing the
  shared page — Everyone sees this", with Undo, Add a card, Cancel and Done.
  Edits are kept until Done and saved as one change; leaving with unsaved
  edits asks first. The page shows no personal changes while editing, and no
  Favourites. Changes naming something gone are counted and can be cleared;
  "Back to the generated page" drops the household's changes to it.
- **Rooms' order** is the household's order on Home, so Settings orders only
  rooms that appear there (rooms with nothing in them are listed apart). The
  sidebar follows the same order and shows each room's icon.
- **Settings:** Rooms (create and rename in homeCore; order and icon in the
  UI server), Devices (name and room in homeCore), Asking first, Look.
- **Asking first** (D2): a choice for a device beats one for its kind, which
  beats the device's own declared prompt. Unlocking asks only where someone
  said so (C4); locking never asks. It covers switches, locks, timers and
  actions on cards and in details, not sliders. Only kinds that take
  commands are listed.
- **Themes** (D9a) are accent families — Amber (the tokens' own), Sage,
  Harbour, Plum — each with a light and a dark set. The house picks one; a
  person may pick another on Me. A copy is kept in the browser for the first
  paint, as light/dark is.
- **The household's phone bar** is used by anyone who hasn't chosen their own;
  "Back to the household's bar" on Me clears the person's choice.
- **Not yet:** undo inside Customise; per-size adjustments (D5) and hand-built
  pages (later rounds).

## B11 — Alerts, as built (R6 and H4, 2026-10-16)

- **homeCore decides** (M6). An alert engine in hc-core works out the whole
  set of alerts the house calls for — from the stored devices and the time
  rules — on every relevant device event and every 30 seconds, and
  announces the difference: `alert_raised` (the whole alert, sent again if
  its words change) and `alert_cleared`. Working out the whole set means a
  missed event or a restart never leaves a stale alert. `GET /alerts` and the
  connect snapshot carry the active ones (`devices:read`).
- **Built in:** wet (`water_detected`, `leak`, `wet`) and smoke (`smoke`,
  `smoke_detected`) are urgent; a jammed lock (`jammed`, or a `last_alert`
  mentioning a jam — no plugin reports jams another way yet) is urgent; a low
  battery (`battery_low`, or a level at or under the battery watcher's
  threshold, cleared above its recover band) and a device offline for five
  minutes are warnings.
- **Time rules** (`/alert-rules`, `automations:read`/`:write`, stored in
  redb): devices, a state (`attribute` = `value`, with the state's words),
  optionally a window of the day (`after`/`until`, spanning midnight when
  `until` is earlier) and a minimum duration. "Held for" uses the device's
  stored `attributes_changed_at`, so it survives a restart; offline time is
  counted from when the engine first saw it.
- **On screen:** the bell carries a count; Home leads with the three most
  serious; the Alerts page lists them all, each opening its device; a device
  with an alert has its card in the alert colour, and a time rule's reason
  ("Open after 22:00") replaces its state line. Settings → Alerts writes the
  rules, offering each device's states in its own words.
- **Not yet:** turning a built-in kind off, or snoozing an alert; alerts do
  not notify anyone (N7 — notifications are the rules engine's).

## B12 — Displays and PINs, as built (R7, H3 and H5, 2026-10-16)

- **A display is an API key marked as one** (H3), made by an admin in
  Settings → Displays, its key shown once. It may read the house, command
  devices and run scenes — a new `scenes:run`, accepted where
  `scenes:write` was, so a panel can run scenes without editing them — and
  nothing else. `/auth/me` answers for it as the display.
- **Keys are no longer admins by default.** homeCore judged every API key an
  admin in its admin-only checks (users, backup, system config), whatever its
  scopes; a key is now an admin only if it holds an admin-only scope
  (`users:write`). Found while building H3: a display would otherwise have
  been a full admin on a wall.
- **Setting up the tablet:** `/display`, the key typed once. The UI server
  keeps it in an httpOnly cookie and uses it whenever no person is signed in
  in that browser; page scripts never see it.
- **The kiosk:** no menus, Settings or Me — only the pages the admin chose
  (Home, Scenes, Alerts, any room; Home's rooms open from Home), tabs along
  the bottom when there are several, a swipe between them, a clock, the
  alert count, and the lock. It keeps the screen on, can go dark while Night
  Mode is on, and can reload daily. Its settings are a UI-server document
  per display (M1).
- **PINs** (H5): a person sets their own on Me, with their password; 4–8
  digits, unique in the house since the PIN alone names the person. Only a
  display may swap a PIN for a session: five minutes, no refresh token, held
  in the access cookie for exactly that long, so the display returns to
  itself on the server even if the page does nothing. Five wrong PINs in
  fifteen minutes make that display wait. PINs use light Argon2id — a hash
  can't make 4–8 digits slow to search; the per-display limit is the defence.
- **While unlocked** the full app shows "{person} on {display} · 4:12 left"
  and Lock.
- **Not yet:** a screensaver; per-display permissions narrower than "the
  house" (H6); keys' `allowed_cidrs` are still not enforced by homeCore.

---

# From 08 — Round two plan

All ten taken as recommended (2026-10-16).

## T1 — Round two replaces the Flutter console for administration (2026-10-16)

- Done when nothing an admin needs is only in `hc-web-flutter` (A7's list).

## T2 — The pages designer waits for round three (2026-10-16)

- `hc-web-flutter` keeps running for hand-built pages only, until round three
  builds them properly (D4, D13).

## T3 — The automation editor is designed before it is built (2026-10-16)

- A design doc and mockups (09) come before A3. More broadly, round two's
  admin components are mocked up and agreed before each is built.

## T4 — The rule editor's text form is JSON (2026-10-16)

- As M7. RON stays the storage format, viewable read-only.

## T5 — A household-member role now; room and device scoping in round three (2026-10-16)

- A homeCore role that may operate devices, run scenes and personalise, and
  author nothing. Part of A5. The rest of H6 is round three.

## T6 — One descriptor form engine (2026-10-16)

- Renders homeCore's descriptors for system config, plugin config and
  notification channels. Built in A0, proven on config and notifications
  before plugins depend on it.

## T7 — Milestones in the order written (2026-10-16)

A0 admin frame → A1 house model → A2 automations, read and manage → A3
automations, write → A4 plugins → A5 people and access → A6 running the
system → A7 cut-over.

## T8 — The skin editor, Media page and camera wall are not carried over (2026-10-16)

- Themes replace skins (D9a); media and cameras return as cards with round
  three's pages.

## T9 — The app ships from A0 (2026-10-16)

- CI and a container release in A0, deployed next to homeCore as milestones
  land, on its own port until the cut-over in A7.

## T10 — Admin changes are tried on a sandbox first (2026-10-16)

- A standing sandbox homeCore with a copy of the house's rules and config, no
  plugins connected, for A1–A4 and A6; the live house only for each
  milestone's final try-out, with a backup taken first.

---

# From 09 — Automations

All nine taken as recommended (2026-10-16).

## E1 — The editor is sentences in three parts (2026-10-16)

- When · Only if · Do, each a list of sentence rows built with pickers that
  speak the house (room → device → its states in its own words). Not a node
  graph, not a form per rule kind.

## E2 — A rule can have several triggers (2026-10-16)

- **[core]** `triggers`, with `trigger` still read as one. Turns the house's
  23 family rules into 9.

## E3 — If/otherwise takes structured checks (2026-10-16)

- **[core]** `Conditional.condition` accepts a `Condition` as well as Rhai
  text, so the visual editor can build and read branches.

## E4 — The list offers to combine families (2026-10-16)

- Rules that look like one intent are shown together with a previewed offer
  to combine; never automatic; the originals are kept, turned off, unless
  the person chooses to delete them.

## E5 — Four patterns to start from (2026-10-16)

- Keep in step, A button toggles, Off after a while, At a time of day — from
  the house's own rules. More only when the house shows a need.

## E6 — Edits are drafts; tests replay real moments (2026-10-16)

- Editing makes a draft; the rule keeps running as it was until Save. Test
  replays a real recent event (from history, or a chosen time) as a dry run.
  **[core]** the test endpoint takes an event.

## E7 — Advanced options under More (2026-10-16)

- Run mode, cooldown, priority, logging, Rhai expressions, variables —
  collapsed, opened automatically when a rule uses any.

## E8 — Rules that are alerts are offered as alerts (2026-10-16)

- A rule that only notifies that a state lasted gets a suggestion to become
  an alert time rule (H4).

## E9 — The list is grouped by tag (2026-10-16)

- Tags are edited as chips and group the list; a rule may sit in two rooms.
  Rule groups remain for switching a set on and off.

Also from 09: **[core]** a step aimed at a device homeCore doesn't know is
reported as such, stale references cover every action target, and rule
changes are announced (`rule_changed`, `rule_removed`).

## G1 — One page document and one renderer for every page (2026-10-31)

- Home, room pages and (later) hand-built pages are the same document —
  sections of cards — drawn by one renderer. Generated pages are computed
  into it; layers apply to the document (11 §2.1).

**Why:** customising features otherwise get written once per page type.

## G2 — Card kinds are registered, their settings are form-engine descriptors (2026-10-31)

- Each kind: forms, an options descriptor, defaults, a component, whether
  Add offers it. No hand-written settings sheets; plugin cards are one kind.

## G3 — Styles are section layouts plus a shell setting (2026-10-31)

- Room field, room tiles, rooms in the sidebar = the Rooms section's layout
  (`field`, `tiles`, hidden) and whether the sidebar lists rooms. Any section
  may use any layout that suits it.

## G4 — Settings resolve card → person's kind default → household's kind default → built-in (2026-10-31)

- Room box settings (big number, sensor sources, details, All off) are
  display settings in the UI server, as decided the same day.

## G5 — The change list is extended, not replaced (2026-10-31)

- `move`/`add` gain `into` (and `before`), `config` covers any card and
  sections, sections are refs (`section:<id>`), a `section` change makes an
  own section. Docs move to version 2, migrated on read.

## G6 — Alerts first, always (2026-10-31)

- The alerts section can't be hidden or moved down; a room box always shows
  an open door, leak, smoke or offline device whatever its details say.

## G7 — Pinned becomes an ordinary section once Add can place cards anywhere (2026-10-31)

## G8 — One section order for all styles (2026-10-31)

- Switching style changes layouts only. Per-style arrangements may come
  later as stored presets.

## G9 — Milestones G-a to G-e in order, each mocked up and agreed first (2026-10-31)

## G10 — G-a ships with only section move, hide and rename as new UI (2026-10-31)

**Why:** G-a replaces how every page is drawn; with little new UI, any
regression shows plainly against today's Home.

## G11 — Home is generated as today; the new styles are chosen (2026-10-31)

- The big numbers' section is generated hidden, and the Rooms section keeps
  its list, until someone picks a style — the household in Edit, or a person
  in Customise. Nobody's Home changes on upgrade.

## G12 — "Rooms in the sidebar" hides Home's rooms only where the sidebar shows them (2026-10-31)

- 1100 px and wider with the sidebar open. Phones and folded sidebars keep
  the rooms on Home.

## G13 — Kind settings resolve per setting, each layer holding only what it set (2026-10-31)

- A person's card setting, the household's card setting, the person's
  every-room setting, the household's, built-in — first set wins, setting by
  setting. A sheet saves only what differs from what would apply anyway.
  Plugin cards' `config` is unchanged (their element reports it whole).

## G14 — Tiles keep the section's order (2026-10-31)

- Per G8; "busiest first" would move boxes about as lights change.

## G15 — Edit's session covers kind defaults and the shell setting (2026-10-31)

- Undo, Cancel and Done apply to them as to page changes.
