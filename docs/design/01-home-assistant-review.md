# 01 — What Home Assistant gets right and wrong, and what it means for homeCore

Status: **decided** — see `decisions.md` · 2026-10-15

This is the first document of the redesign. It reviews how Home Assistant
(HA) builds its dashboards as of 2026.10, what its users and its own team say
works and fails, and how each idea maps onto what homeCore actually has. It
ends with the decisions to make. Nothing here is decided yet.

**The brief, as given:**
- **Who uses it:** admins and end-users (the household).
- **Screens:** desktop, laptop, tablet and phone, all first-class.
- **Code:** none carried over. The framework is open (Svelte 5 and SolidJS 2.x are candidates).

---

## 1. How Home Assistant dashboards work today

### Data underneath

HA shows **entities**, not devices. An entity is one controllable or readable
thing (`light.kitchen`, `sensor.kitchen_temperature`) with:
- a single state string
- attributes
- a `device_class` saying what kind of thing it is

Entities are grouped like this:
- **Devices** group the entities that come from one piece of hardware. A smart plug is one device with an on/off entity, a power entity and an energy entity.
- **Areas** group devices into rooms.
- **Floors** group areas.
- **Labels** are free tags.

A dashboard refers to entities by their id.

### Structure

A dashboard has **views** (tabs), and a view has cards.

- **Sections** became the default view in 2024.11.
  - Each section is a 12-column grid with 56px rows.
  - Sections flow left to right and wrap.
  - Column width stays fixed; the number of sections per row changes with screen width.
  - Cards declare their size in grid cells.
- **Masonry**, the older view, packs cards by height. HA's own team describes it as unpredictable (see §3).
- **Badges** are pill-shaped status chips across the top of a view.
- **Subviews** are pages without a tab that you reach by navigation.

### Cards

There are about forty built-in card types, and they overlap: entity, entities,
button, tile, glance, light, thermostat, area and so on.

**The tile card is the modern standard:**
- an icon, a name and a state
- optional **features**, which are inline controls: toggle, brightness slider, cover position, lock, media transport, thermostat target and more
- tap the card to open details; tap the icon to toggle the device

**The area card** (redesigned in 2025.7) summarises a room in the same style.

### Interaction

Every card has `tap_action`, `hold_action` and `double_tap_action`. Each can be
set to:
- open details (`more-info`)
- toggle the device
- call any service (`perform-action`)
- navigate to another view
- open a URL
- start a voice request (`assist`)

Any of these can be set to ask for confirmation first. Defaults differ by card,
which is part of the confusion described in §3.

### The details popup ("more-info")

- One dialog per entity, opened by tapping a card, a badge or a row in a list.
- It leads with a large control specific to the entity's domain:
  - a brightness slider for a light
  - artwork for a media player
  - a dial for a thermostat
- It has buttons for history and settings, and a menu with related items.
- Its contents cannot be customised (see §3, F).

### Editing

- **Who:** admins only.
- **Edit mode:** cards can be dragged within sections.
- **Card picker:** redesigned in 2026.6 to start from the *thing*. You browse floor → area → device → entity and get suggested cards with live previews built from your own data.
- **Per card:**
  - a visual editor, or YAML instead
  - a Visibility tab, with conditions on screen size, user, state, and since 2026.10 any automation condition
  - a Layout tab for size
- **Undo/redo** arrived in 2025.12.

### Generated dashboards

The default experience has moved from *you build it* to *it builds itself*:
- **2025.4:** an experimental Areas dashboard.
- **2026.2:** a **generated "Home" dashboard is the default for new installs**:
  - summaries at the top (lights, climate, security, media, energy)
  - favourites, then areas grouped by floor
  - newly discovered devices
- **"Take control"** turns a generated dashboard into an editable copy. It is one-way, and the copy stops updating as devices are added.

### Screens and devices

- Sections reflow by screen width, and cards can be hidden per screen size.
- Wall panels need the companion app's kiosk mode (iOS, 2026.7+) or third-party tools (Fully Kiosk, the Kiosk Mode plugin).
- **Defaults:** a default dashboard is per user. Since 2025.12 an admin can set one system-wide, and a per-device default is not possible.

### Users

- **Admin vs non-admin:** non-admins cannot edit dashboards or reach settings.
- **Hiding:** a view's `visible` and the "user" visibility condition hide things, but **do not secure them**. The URL still works, and there is no per-entity access control.

### Extensions

- **Custom cards** are Web Components, installed as resources, usually through HACS.
- **card-mod** injects CSS into cards' internals.
- **Themes** are sets of CSS variables.

---

## 2. What Home Assistant got right (worth keeping)

1. **The tile model: tap for details, explicit controls act.**
   - The card body opens details, and only things that look like controls change the house.
   - HA's stated rules (Dashboard Chapter 2, 2024):
     - "a clear primary action"
     - "everything designed to invite interaction looks clickable"
     - "features over icon buttons"
   - It is also the model you arrived at independently.
2. **A details popup instead of a crowded card.**
   - A device can do far more than a card can show. HA's 2023.3 redesign put "the most relevant and used information" first, with everything else one tap further in.
   - Users like popups because they keep the page behind them in view and close with a tap outside.
3. **A predictable grid over a clever one.**
   - HA's own diagnosis of masonry: cards moved by 1px height differences, so "the muscle memory of where users remember the cards will be lost every time the dashboard is displayed on another screen."
   - The sections grid traded packing efficiency for "simplicity, predictability, and memorability."
4. **Generated by default.**
   - HA's Nov 2024 roadmap: the old default "simply dumps every single entity… wildly unmanageable"; "the perfect app is no app."
   - A dashboard built from rooms and summaries works on day one, for the whole household, without anyone authoring it.
5. **Start from the thing, not the widget.**
   - HA's 2026.6 research: people "open the dashboard editor with a specific device or sensor in mind, not a card type."
   - This is the same lesson the old hc-web-lit editor taught us the hard way.
6. **Live previews with real data** in the picker, before anything is placed.
7. **Summaries.** "How many lights are on, is anything open, what's playing" at the top of the home view, and on phones instead of tabs.
8. **Ordering rooms by hand** (2025.12). Alphabetical order put "guest bathroom… before your living room."

## 3. What is wrong with Home Assistant (worth avoiding)

These are in rough order of evidence strength. The engagement figures come from
the Dec 2024 "Month of What The Heck" (WTH) forum threads.

**A. Access control is cosmetic.** This is the strongest signal.
- "WTH no access control" had 147 replies and 13.8k views. It was still open on GitHub in 2026.
  - "Without access control HA is not suited for real-life family use."
  - Teenagers re-added hidden menus, or used another browser to read the logbook.
  - A wall panel logged in 24/7 can reach every entity.
- HA's own roadmap calls it a long-standing pain point.
- **Lesson:** hiding things in the UI is not permission. It has to be enforced on the server and scoped by room or device.

**B. You still need to be technical.**
- The most-replied 2024 thread, "Do I still need to be a rocket scientist…", had 379 replies.
- **Editor problems:**
  - Editing in the UI rewrites YAML and drops comments.
  - Nested cards lose the visual editor.
  - Some cards are YAML-only.

**C. Layouts don't survive screen changes.**
- "I design a nice dashboard for my tablet on my PC, then look at it on the tablet and everything has moved around."
- There is no device preview while editing; the community's answer is browser devtools.
- Phones get a single column with wasted space.

**D. Which dashboard appears on which screen is tied to the user.**
- Since 2025.12, one default applies everywhere: "If you set your phone to one dashboard and your wall tablet to another, they'll now both revert."
- The official workaround is a separate user account per wall tablet.
- **Lesson:** "this screen is the kitchen panel" is its own concept, separate from who is signed in.

**E. A good look needs plugins, and plugins break.**
- The default theme is called "dreadfully 90s" (46 replies). Styling is "CSS variable hacking," not a design system.
- Mushroom, Bubble Card and Minimalist exist because the built-in cards weren't good enough. HA later absorbed Mushroom's chips as its badges.
- card-mod broke in 2025.11, and stacked custom layouts broke between 2026.3 and 2026.8.
- **Lesson:** ship one coherent visual system. Never make styling depend on reaching into a component's internals.

**F. The details popup can't be customised.**
- "WTH can't I use a card as more-info popup" (4.7k views).
- People want a TV remote, a dishwasher's programme and energy use, or camera pan/tilt in the popup. Workarounds are Browser Mod ("hacky") or Bubble Card ("doesn't match HA styling").

**G. It is slow on cheap tablets.**
- "Very slow for something that is eventually a webpage with a list of buttons."
- One simple dashboard measured more than 30,000 DOM elements. Even an iPad Pro was reported sluggish.
- ha-fusion, written in Svelte, was built largely to be fast.

**H. Wall panels are an afterthought.**
- Hiding chrome needs third-party tools.
- People keep building separate single-page tablet dashboards, as recently as August 2026.

**I. Entities vs devices confuses people.**
- A plug being "one device, three entities" needs explaining to beginners every few weeks.

**J. Too many overlapping card types.**
- Entity vs entities vs button vs tile vs light vs Mushroom: tutorials exist just to explain which to use.

**K. Generated or hand-built is a one-way choice.**
- "Take control" forks the generated dashboard into a static copy that stops learning about new devices. Many people therefore never customise.

**HA's own direction in one line:** a toolkit of card types in masonry → a predictable grid with drag and drop → a generated home built from areas and summaries, with editing that starts from the thing in the house. They are fixing A, D and F last, or not at all.

## 4. What the community's own builds tell us

| Project | What it was built to fix |
|---|---|
| Mushroom (5.2k★) | A consistent look and a visual editor on every card. HA adopted its style. |
| Bubble Card (4.7k★) | Phone-first: a calm main view, slide-up popups, swipe to close. |
| Dwains Dashboard | Builds itself from areas and works on every screen. Anticipated HA's Home dashboard. |
| Minimalist UI | One coherent design system with templates. |
| ha-fusion (Svelte) | Speed, and real drag and drop. "Setup went from over a month to 15 minutes." |
| Kiosk Mode, Browser Mod, Restriction Card | Wall-panel mode, per-screen behaviour, real access control. |
| HomeKit-style dashboards | Apple Home's look, and separate phone and tablet layouts. |

The most common way families are kept away from HA is to bridge it into Apple
Home. That is weak, marketing-grade evidence, but it is consistent with the
HomeKit-clone dashboards.

## 5. Mapping to homeCore

Where HA's ideas land on homeCore's actual model. "Fits" means homeCore already
supports it; "Gap" means it would need server work.

| HA idea | homeCore today | |
|---|---|---|
| Entity: one state, one control | **Device**: one record with a flat attribute map, a schema (attribute kinds, writable, units, ranges, options, `primary` readings) and declared actions with parameters | Fits better. Cards are per device, and the schema says what to draw. |
| Device grouping several entities | No grouping. Multi-function hardware is either sibling devices (a Hue bulb plus its connectivity and power siblings) or prefixed attributes (`ep1_on`, `ep2_on`). `parent_device_id` exists but no plugin sets it. | Gap. The UI can't tell that siblings belong together. |
| Areas, floors, ordering, area icons | Areas only, stored as slugs (`living_room`). The id is derived from the name. No display name, icon, order or floor. | Gap. Needed for a generated home. |
| Labels | None on devices | Gap (minor). |
| Tile features: inline controls | Schema gives writable attributes and actions; `primary` ranks readings; `category` hides diagnostic and config attributes; actions carry `confirm`, `sentence`, `writes` | Fits. Inline controls can be derived, not hand-written. |
| More-info popup | Not in the server. Schema plus history plus provenance (`last_change`, `attributes_changed_at`) support a rich one. | Fits. Customising it per device type is a new concept. |
| Scenes | **Two kinds:** native scenes (`/scenes`, need `scenes:write` to activate) and plugin scenes (Hue, Lutron, Caseta, ISY), which are devices of type `scene` | Gap. Needs one presentation. |
| House mode (Home/Away/Night) | Modes are independent on/off flags (solar or manual) | Gap, or a presentation choice. |
| Summaries (lights on, open doors, playing) | Derivable on the client from device state | Fits. |
| Live updates | The event stream pushes full state changes, availability, schema changes, modes, timers and scenes. **No snapshot on connect** (load over REST first) and **no events for renames, area moves, new devices, or dashboard and area edits.** | Partial. A second open screen goes stale on metadata edits. |
| Command result | Commands go over REST only and return 202. The result is only visible as a later state change with a matching correlation id. | Fits for optimistic UI, with a timeout. |
| Server-side dashboards | `DashboardDefinition`: framework-neutral, with per-breakpoint layouts, widgets with free-form config, view/edit grants, per-user default, and a widget vocabulary served by core | Fits, but shaped by the old client. Re-examine rather than inherit. |
| Per-user permissions | Roles map to scopes and the server enforces them. But `devices:write` covers both commanding and deleting or renaming devices; device_operator can't activate scenes; read-only roles can't set a default dashboard; action `requires_role` isn't enforced; there is nothing per area or device; and whitelisted IPs become one synthetic admin. | Gap. This is HA's biggest failure, and homeCore is only partly better. |
| Per-screen identity (the kitchen panel) | Nothing. The whitelist is per IP but makes everyone an admin. | Gap. |
| User profile | id, username, role. No display name, picture or preferences. | Gap (minor). |
| Theming | House-wide skins on the server. No per-user choice. | Partial. |

## 6. Decisions to make

Each has a recommendation. They are yours to accept, change or reject. Some
need server changes in `core/`, marked **[core]**.

**D1 — What a person sees by default.**
- (a) Generated from rooms and summaries, like HA's Home.
- (b) Hand-built pages only.
- (c) Generated, with personal changes **layered on top**: hide, pin, reorder, rename, add a card. The generated part keeps learning about new devices.
- *Recommend (c).* It avoids HA's one-way "take control" (K) and still works on day one.

**D2 — Card interaction.** Tapping the card opens details; only explicit controls act. Should the icon toggle, as in HA? HA's icon-toggle is easy to hit by accident and isn't obviously a control.
- *Recommend:* no icon toggle. A visible switch or button is the control.
- Also: should locks, garage doors and alarms ask to confirm? homeCore actions already carry `confirm`, so *recommend* following what the device declares.

**D3 — The details popup.**
- Generated from the device schema (controls, readings, history, activity, settings)?
- Customisable per device or device type, HA's top unfixed request (F)?
- *Recommend:* generated first, with customisation designed in from the start (so it isn't bolted on) and built later.

**D4 — Layout model.**
- (a) A predictable responsive grid of sections, like HA's.
- (b) A free canvas, like the old hc-web-lit designer.
- (c) A grid everywhere, plus a free canvas only for wall panels and floorplans.
- *Recommend (c), or (a) to start.* Predictability across screens is what users praise most, and the free canvas is what made the last editor hard.

**D5 — One layout or one per screen size?**
- HA reflows one layout and hides cards per size. Users still find phones wasteful.
- *Recommend:* one layout that reflows by default, plus the option to adjust per size. The editor previews each size (C).

**D6 — Who edits, and what.**
- (a) Admins only, as in HA.
- (b) Anyone with page-write permission.
- (c) Admins build shared pages; every user can personalise their own view: favourites, order, hidden items.
- *Recommend (c).* Personalising should be safe enough for anyone.

**D7 — Screens as things.** A "display" (kitchen panel, hall tablet) with:
- its own home page
- kiosk behaviour built in
- its own **limited** permissions

It is separate from user accounts and fixes D and H. *Recommend yes.* **[core]** to do properly.

**D8 — Permissions.** Should the UI rely on server-enforced, room- and device-scoped permissions?
- That means splitting "operate a device" from "rename or delete it", letting operators run scenes, and enforcing `requires_role`.
- *Recommend yes,* as a core work item alongside the UI. Without it, homeCore repeats HA's biggest failure (A). **[core]**

**D9 — Visual system.**
- One built-in design system with a small set of card forms.
- Theming through design tokens, never by reaching into components (E).
- Per-user light and dark preference and choice of theme.
- *Recommend yes.* Also decide whether third parties can add card *forms* at all, and if so through a stable, versioned interface.

**D10 — Rooms and the house model.** A generated home needs:
- room display names, icons and order
- optionally floors
- a way to group sibling devices into one physical thing
- one presentation for both kinds of scene
- (maybe) a multi-valued house mode

*Recommend* deciding which of these are in scope for round one. **[core]**

**D11 — Live correctness.**
- A snapshot on connect, plus events for renames, area moves, new devices, and dashboard and area changes, so two open screens never disagree.
- *Recommend yes.* **[core]**, small.

**D12 — Performance budget.** HA's slowness on cheap tablets (G) is the case for a hard budget, for example a cold start and DOM size limit on a low-end Android tablet. It should also drive the framework choice. *Recommend* setting the budget before choosing the framework.

**D13 — Text editing.** HA's YAML mode is both loved and a source of pain (B).
- *Recommend:* none in the UI. A lossless export/import of the stored document is enough.

**D14 — Framework.** Svelte 5 vs SolidJS 2.x (or another). *Recommend* deciding after D1–D12, against the performance budget, with a small spike in each.

---

## Sources

Primary sources are home-assistant.io docs and release notes, the HA developer
docs, and HA blog posts:
- "Dashboard chapter 1" (2024-03-04)
- "Dashboard chapter 2" (2024-07-26)
- "Roadmap 2024H2" (2024-11-15)
- Release notes 2022.11 through 2026.10

Community evidence is from community.home-assistant.io, mainly the Dec 2024
WTH threads:
- access control (802297)
- rocket scientist (809898)
- YAML comments (802437)
- slow dashboards (803120)
- card as more-info (802493)
- outdated theme (814583)
- designing for other devices (804914)
- default per user (467847)

Also: GitHub discussion home-assistant #1171 and frontend issue #26754, the
project pages for Mushroom, Bubble Card, Dwains, Minimalist, ha-fusion and Kiosk
Mode, and the simon42 forum.

Evidence limits:
- Reddit could not be reached during research, so it is under-represented.
- Comparisons with other platforms (Apple Home, Homey) come from vendor and SEO pages and are weak.
- A few per-version details of the more-info dialog are unverified.

homeCore facts come from `core/crates/hc-types`, `hc-api`, `hc-auth` and
`docs/devNotes.md`. Note that `core/docs/openapi.yaml` is **stale** for
`DeviceState`, dashboards and rule unions; the Rust types are what the server
sends.
