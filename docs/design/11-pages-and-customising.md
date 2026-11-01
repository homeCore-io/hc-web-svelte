# 11 — Pages and customising

Status: **decided**, see `decisions.md` (G1 to G32) · 2026-11-01 · G-a to G-e **released** (0.1.35 to 0.1.40) · the room field **matched to mockup A** on `redesign` (not released, §6)

How Home, room pages, hand-built pages and displays become one thing that
everyone can arrange, so each new customising feature is a new *kind of card*
or a new *setting*, never a new mechanism. Builds on D1, D4, D5, D6, D7, C1,
C5, M2–M4, M7, N2, N6. Mockups:
https://claude.ai/artifact/HWgAYX6VcnqZunbhG2oMML (three Home styles,
Customise with a room's box).

---

## 1. Why now

The user called Home drab, liked the Flutter "Every room" page, and wants all
three new styles (room field, room tiles, rooms in the sidebar) offered as a
choice — then asked for full customising: what a room box shows and which
sensor it reads, sections that move, things added anywhere, removed, set up.

Doc 04 already drew the right model — a page is sections of cards, and
household, per-size and personal changes are lists layered on top (M2). What
was built for round one only half follows it:

| Doc 04 says | Built |
|---|---|
| A page is `sections: [{ id, title, cards }]` | Home's sections are hard-coded in `routes/+page.svelte`; room pages in `routes/rooms/[id]/+page.svelte` |
| Cards have a `kind` and `options` | Only plugin cards have settings (`config` change) |
| `add {card} in section:x after y` | `add` has no place: added cards land under Pinned / "Also here" |
| A per-size layer (D5) | Not built |
| Hand-built pages (D4) | Not built (S6 deferred them) |

Building the asks straight onto the hard-coded pages would mean writing each
one twice (Home, rooms) and a third time for hand-built pages. Closing the
gap first is the "no re-work" path.

---

## 2. The model

### 2.1 One page document, one renderer

Every page — generated or hand-built — is the same document, drawn by one
renderer:

```
page
  id            home | room:<id> | page:<id>
  sections:     [ section ]
section
  id            alerts | chips | pinned | favourites | scenes | modes | rooms
                | devices:<group> | own:<id>
  title
  layout        grid | row | list | field | tiles     (what each layout is: §2.3)
  cards:        [ card ]
card
  ref           device:<id> | scene:<id> | room:<id> | card:<plugin>/<el>
                | piece:<kind>/<id>
  kind          (from the registry, §2.2)
  form          compact | standard | large
  options       { … kind's own settings; unknown keys kept }
```

- **Generated pages are computed into this shape** — the generator for Home
  makes the alerts, chips, favourites, scenes, modes and rooms sections from
  the house; the room generator makes Controls / Scenes / Sensors / Other as
  today. Nothing about the generated base is stored (D1 unchanged).
- **Layers apply to the document**, not to Svelte code. The household's
  changes, then (later) the size's, then the person's (M2–M4).
- **A hand-built page** is the same document, stored instead of generated
  (later milestone; §4).

### 2.2 The card kind registry

Each kind of card is one registration:

```
kind
  id            device | scene | room | summary | worth-knowing | playing
                | chart | weather | heading | text | plugin | …
  forms         which of compact/standard/large it can be
  options       a descriptor (the A0 form engine, descriptor.ts) — the
                settings sheet is generated from it, as plugin settings are
  defaults      house-wide defaults per kind, overridable per card (§2.4)
  component     the Svelte component that draws it
  addable       whether "Add" offers it, and on which pages
```

- **The settings sheet is never hand-written per kind** — it is the form
  engine reading the kind's descriptor. A kind that needs a special control
  (the sensor picker) adds one field kind to the engine, usable by all.
- **Plugin cards are one kind** whose options come from the plugin's own
  settings element, as now.
- **A new feature is a new kind.** Weather, a chart, a camera, a clock: one
  registration each, and every page gets it.

### 2.3 Styles are layouts, not pages

The three Home styles are not three Home pages. They are **section layouts**
plus one shell setting:

| Style | Rooms section layout | Shell |
|---|---|---|
| Room field | `field` (sized by what's in each room) | no rooms in the sidebar |
| Room tiles | `tiles` (same size, busiest first) | no rooms in the sidebar |
| Rooms in the sidebar | section hidden on Home | sidebar rooms show status |

Picking a style in Customise writes those changes (a layout change and a
shell setting), so a person can start from a style and still move things.
Any section can take any layout that suits its cards — scenes as a `row`,
favourites as a `grid`, rooms as `field`.

### 2.4 Settings: defaults, then the card

A setting is looked up in this order, first found wins:

1. this card's options on this page (person's layer, then household's)
2. the household's default for this kind ("Same details for every room…")
3. the kind's built-in default

So "Office: temperature from Office Desk Temperature" is one card option;
"every room box shows music" is one kind default. Stored in the existing
`HouseDoc` / `PersonDoc` as layer changes (`config`) and a new
`defaults: { [kind]: options }` — display settings in the UI server, as
decided 2026-10-31.

### 2.5 Changes, extended not replaced

The existing change list (`layers.ts`) gains, without breaking stored docs:

| Change | Now | Becomes |
|---|---|---|
| `move ref before` | within its section | + optional `into: <section id>` |
| `add ref` | lands in Pinned / Also here | + optional `into`, `before` |
| `config ref config` | plugin cards only | any card, and sections (`layout`, `title`) |
| `hide`, `rename`, `form` | cards | cards and sections (`section:<id>` refs) |
| — | — | `section` (make an own section: id, title, layout) |

Old changes read exactly as before; a doc's `version` moves to 2 and the
app migrates on read (04 §7). The JSON text mode (M7) shows these as stored.

### 2.6 Rules that don't bend

- **Alerts first, always.** The alerts section can't be hidden or moved
  below anything; a room box always shows an open door, leak, smoke or
  offline device, whatever its details say.
- **Personal can hide, never widen.** A person's layer may hide, move,
  resize and pick among options; it can't point a card at a device they
  can't read (D8 later).
- **Something that's gone is skipped, not lost** (04 §3), and Customise
  says "refers to something that's gone".

---

## 3. What this unlocks, by milestone

Sized so each ends with something visible and nothing half-built. Each is
mocked up and agreed before it's built, and tried on the sandbox first.

**G-a — Foundation, and sections that move.**
Page document + renderer + kind registry; Home and room pages generated
into it; every current card and change ported; Home renders as it does
today (screenshot-compared). Visible: sections can be moved, hidden and
renamed; Scenes above Rooms. *Mostly invisible work — the riskiest
milestone, so it ships with the least new UI.*

**G-b — Room boxes and the three styles.**
`room` kind options (big number, temperature/humidity source incl. any
sensor and averages, details, All off); `field` and `tiles` layouts; the
`summary` kind (the big numbers band, its numbers chosen); style picker;
sidebar rooms with status; "same details for every room". The mockups'
Customise artboard, built.

**G-c — Add anything, anywhere.**
Add places into any section; own sections; layouts per section; new kinds:
heading, text, worth-knowing, playing, weather, chart. Pinned becomes an
ordinary section.

**G-d — Device card settings, room pages in full.**
`device` kind options (which readings, which control, icon); room pages
use sections, layouts and Add like Home.

**G-e — Hand-built pages.**
Pages of your own in the same document, Pages in the phone bar (N2),
displays showing chosen pages (D7). Little new code if G-a–G-d held.

**Later, reserved in the model now:** per-size changes (D5: an
`owner: size:phone` layer), show-when conditions (a `when` card option),
copy a layout between household / person / room pages, the canvas page
type (D4).

---

## 4. What stays where

| Thing | Where |
|---|---|
| Generated base | Computed, never stored |
| Household's changes, kind defaults, hand-built pages | UI server, `HouseDoc` (+ page docs in G-e) |
| A person's changes and style | UI server, `PersonDoc` |
| Rooms, devices, alerts | homeCore (unchanged) |

No homeCore changes are needed for G-a–G-d. (Unrelated gaps found on the way
and listed separately: `GET /devices` omits `area_override`; the Devices list
counts modes as "not in a room".)

---

## Decisions to make

**G1 — One page document and one renderer for every page**, generated pages
computed into it (§2.1). *Recommend yes* — the whole point.

**G2 — A card kind registry whose settings are descriptors for the existing
form engine** (§2.2). *Recommend yes* — no hand-written settings sheets.

**G3 — The three styles are section layouts plus a shell setting** (§2.3),
and any section may use any layout that suits it. *Recommend yes.*

**G4 — Settings resolve card → household default for the kind → built-in**
(§2.4). *Recommend yes.* Should a person also have their own kind defaults
("on my screens, no batteries")? *Recommend yes, same lookup with the
person's first.*

**G5 — Extend the change list rather than replace it** (§2.5), version 2
with migration on read. *Recommend yes.*

**G6 — Alerts first, always; room boxes always show alarming states**
(§2.6). *Recommend yes.*

**G7 — Pinned becomes an ordinary section** once Add can place cards
anywhere (G-c). *Recommend yes;* existing pins stay where they are.

**G8 — Each style keeps its own section order?** (a) One order; switching
style changes only layouts. (b) Each style remembers its own arrangement.
*Recommend (a)* — simpler to explain, and (b) can be added later as stored
presets.

**G9 — Milestones G-a to G-e in that order**, each mocked up and agreed
first. *Recommend yes.*

**G10 — G-a ships with only section move/hide/rename as new UI**, so a
regression is easy to see against today's Home. *Recommend yes.*

---

## 5. G-a plan (2026-10-31)

Mockup: "G-a · Moving, hiding and renaming sections" on the canvas above.

**Found in the code, and how the plan handles it**

- `version` on the UI server's documents is the save counter
  (`server/store.js:97`), so the document format gets its own field:
  `schema?: 2` (absent = 1). Migration runs in `Synced` on every read and on
  a 409's `current`.
- Done drops every change whose ref the page doesn't present
  (`EditBar.svelte:27`). `presentRefs(page)` must include `section:<id>`, or
  Done deletes section changes. An older app still deployed would drop them
  too — the app is released as one version, never mixed.
- Room order comes from `home` changes in three places (Shell, More,
  Settings → Rooms); all three move to one `homeRoomOrder()`.
- Favourites keep their own list's order and only the person's `form`
  changes, as today.
- Room pages pass `page` to device cards (their Hide shortcut); Home doesn't.
  Kept.

**Modules**

- `src/lib/page.ts` — `Page`/`Section`/`Card` types, `homePage()`,
  `roomPage()`, `applyPage()` (sections first, fixed ones pulled to the
  front; cards per section exactly as v1; `move … into` implemented, not yet
  offered), `presentRefs()`, `homeRoomOrder()`. Pure, unit-tested.
- `src/lib/kinds.ts` — the registry: `device`, `scene`, `room`, `plugin`,
  and the pieces `alerts`, `chips`, `modes`; components in
  `components/kinds/`, wrapping today's cards unchanged.
- `components/PageView.svelte` — the one renderer; `SectionTools.svelte`
  for move up/down, hide/show, rename while arranging.

**Sections**

| Page | Sections (id) |
|---|---|
| Home | `alerts` (fixed), `chips`, `pinned`, `favourites`, `scenes` (modes drawn at its top), `rooms` |
| Room | `devices:controls`, `devices:scenes`, `devices:sensors`, `devices:other`, `added` ("Also here") |

Scenes and modes stay one section in G-a (splitting them changes Home's
spacing); they split in G-c.

**Proof it's unchanged:** unit tests over stored v1 change lists, and
before/after screenshots (390 px and 1280 px, light and dark; Home, Edit,
Customise, a room, Not in a room) against the sandbox homeCore with a copy
of the real UI documents — pixel-identical when not arranging.

**Commits, each leaving the app working:** (1) layers: `schema`, `into`,
migration, `homeRoomOrder` everywhere; (2) `page.ts` + tests, unwired;
(3) `kinds.ts` + kind components; (4) room pages on `PageView`, compared;
(5) Home on `PageView`, compared; (6) section tools; (7) dead code removed.

**As built (2026-10-31)** — commits "Pages, step 1"–"step 7" on `redesign`.

- Section rename is Edit only, as for cards (decided 2026-10-31); Customise
  moves and hides sections.
- One `migrate()` serves both documents; it only stamps `schema: 2`.
- A card carries a `group`: "Also here" is ordered and drawn as two runs —
  devices, then plugins' cards — exactly as before. Cards have no `options`
  yet; G-b adds them with the first kind that has settings.
- Sections carry `bare` (alerts, chips: no heading or tools when not
  arranging), `lead` (modes above scenes), `favourites`, `hint` and `show`.
- While arranging, an empty section with a hint shows it (Favourites, and
  Pinned in Edit), so the household can place sections that are empty
  today; a hidden section shows only its heading and Show.
- Room pages get the same section tools — one renderer.
- `CardGrid` stays (the "what's on" pages use it); `AddedCards` is gone.
- Proof: unit tests over v1 change lists (page, kinds, layers); screenshots
  on the sandbox at 390/1280, light/dark — Home, Customise, a room and Not in
  a room match the old pages but for live times and readings; Edit adds the
  empty Favourites section. Section move, hide (Customise) and rename (Edit)
  tried on the sandbox: saved in shape 2, Done keeps them.
- Release note when it ships: an older app still open somewhere drops
  section changes on its Edit → Done. Release as one version.

---

## 6. G-b plan (2026-10-31)

Mockups: "Customise · style and a room's box" and "G-b · Every room's box,
choosing a sensor, the big numbers" on the canvas above — agreed, with: a
room's own settings win over anyone's every-room settings (G4), and the big
numbers wrap to a second row past about five on a phone (no cap).

**Scope:** the `room` kind's options; the `field` and `tiles` layouts; the
`summary` kind (the big numbers); the style picker; the sidebar's rooms with
their status; "Every room's box" (kind defaults) with "Rooms set on their
own". Alarming states always show on a box (G6).

**Found in the code, and how the plan handles it**

- `config` changes replace a card's settings wholesale (`apply` keeps the
  last). That suits a plugin's settings element, which reports everything.
  Room and summary settings are read **per setting** across the layers
  instead (G13): the person's card setting, the household's card setting,
  the person's every-room setting, the household's, then built-in. Each
  layer's `config` holds only what that layer set.
- Edit keeps a session of edits to the household's document; today they are
  all page changes. Kind defaults and the shell setting become edits in the
  same session (G15), so Undo, Cancel and Done cover them.
- `Field` is core's descriptor vocabulary. The sensor picker is one new
  field kind, `sensor`, and the big numbers' order one new `render` of
  `list` (`order`); both live only in this app and either can be used by any
  descriptor. One client-only field property, `near` (a room id), puts that
  room's sensors first.
- The rooms list on Home (`RoomRow`) stays exactly as it is: it is today's
  style, "List". Box settings apply to boxes and the sidebar's status.
- Style C hides Home's rooms only where the sidebar shows them (1100 px and
  wider, sidebar not folded) — on a phone there's no sidebar, so Home keeps
  its rooms (G12).
- Tiles keep the section's order, as G8 says; the mockup's "busiest first"
  would reorder boxes as lights change (G14).

**The model**

- `HouseDoc` / `PersonDoc` gain `defaults?: { [kind]: options }` and
  `shell?: { rooms?: 'names' | 'status' }`. No other new keys.
- Card settings: `config` on `room:<id>` and `piece:summary/home`. Section
  layout: `config` on `section:<id>`, `{ layout }`, limited to the layouts
  that section allows (`rooms`: list, field, tiles).
- A new Home section, `summary` ("At a glance"), between the chips and
  Pinned, **hidden unless shown** — the generated Home is today's until
  someone picks a style or shows it (G11).
- Styles are what they write (G3): List = rooms `list`, no band; Room field
  = `field` + band; Room tiles = `tiles` + band; Rooms in the sidebar =
  `list` + band + `shell.rooms: status`. The picker reads the style back from
  those; anything else reads as the nearest.

**Modules**

- `options.ts` — `resolve()` per setting through the layers, `prune()`
  (drops what would apply anyway), the room and summary descriptors.
- `roomBox.ts` — a room's box from its devices and settings: big number,
  line, badges, glow, alarms, All off, field size; the big numbers from the
  house. Pure, unit-tested.
- `styles.ts` — the four styles, `styleOf()`, `styleChanges()`.
- `components/RoomBox.svelte`, `kinds/SummaryKind.svelte`,
  `KindSettings.svelte` (a kind's sheet from its descriptor, with a preview),
  `EveryRoom.svelte`, `StylePicker.svelte`, `form/SensorPicker.svelte`.

**Commits, each leaving the app working:** (1) settings and boxes, pure, with
tests; (2) the form engine's `sensor` field and `order` list; (3) room boxes:
`field` and `tiles` layouts and a room's own settings; (4) the big numbers;
(5) every room's box; (6) styles and the sidebar's rooms; (7) tidy, and this
section as built.

**Proof:** unit tests; screenshots on the sandbox at 390 and 1280, light and
dark — Home not arranged must match G-a's; each style; a room with its own
settings; the every-room sheet; the picker, one and average; the big numbers.

**Older apps (release note):** old documents read unchanged; still shape 2 —
new keys are optional and new changes use existing ops. A 0.1.35 app keeps
`defaults` and `shell` when it saves (it changes documents by spreading
them) and ignores them. But its Edit → Done drops changes naming things it
doesn't present: the band's Show and its numbers (`section:summary`,
`piece:summary/home`). Release as one version again.

**As built (2026-10-31)** — commits "Boxes, step 1"–"step 7" on `redesign`.

- The options module is `options.ts` (`settings.ts` was taken by Settings'
  groups). Resolution and the sheets' layers are in `kindOptions.svelte.ts`.
- The room box's "Doors & locks" detail is **Locks** (unlocked ones): an
  open door always shows, so it can't be a detail (G6). Low batteries go
  with **Batteries**; with it off they show only in Alerts, as today.
- A box is red for a leak, smoke or a jammed lock; an open door and an
  offline device show in its line in the alert colour.
- The room field is a wrapping row of boxes, each as wide as what's in its
  room (three sizes) — no holes, and the order is the section's.
- "Use these instead" applies at once; the sheets' other settings on Done.
  Closing a sheet with × keeps nothing.
- "Every room's box" is in the Rooms section's tools while arranging, and
  only in the field, tiles or sidebar styles — the list keeps today's rows,
  which have no box settings.
- A sensor's value is read with the schema's unit first, as cards read
  it; a device whose schema and own unit disagree (the sandbox's stand-in
  Office Motion: °C in its schema, `temperature_unit: F`) reads wrong in
  both. Not changed here.
- Proof: unit tests over the options, boxes, big numbers, styles and
  section layouts. On the sandbox (390/1280, light/dark): Home unarranged
  matches G-a's but for live alerts and readings; choosing "Room list"
  again gives that Home back; field, tiles and rooms in the sidebar chosen
  through the app, for everyone (Edit) and just me (Customise); a room
  with its own temperature sensor; the room sheet, the picker (one and an
  average), every room's box with "Rooms set on their own", the big
  numbers' sheet with seven numbers wrapping on a phone. Documents checked
  after each: only the settings that differ are kept.
- Release note: as planned above — one version; an older app's Edit → Done
  drops the band's Show and its numbers.
- **Not yet like mockup A (user, 2026-11-01).** The Room field as built
  differs from "A · Room field" and its phone board. The user hid some
  boxes, found it close enough for now, and deferred the fix:
  1. The mockup is a 12-column grid with 84px rows: busy rooms are tall as
     well as wide (Living Room 5 × 3), quiet ones 2 × 2. Built, every box
     is 150px tall and only its width varies (`.field` / `.cell.sN` in
     `PageView.svelte`).
  2. A small box in the mockup has its name, one badge and one line
     ("75° · Lights off"), no All off; built, it has the big number, All
     off and a wrapping line.
  3. The line strings everything together ("3 of 4 lights on·55%·Roku
     Smart Soundbar - YL0001073725 playing"); the mockup says lights and
     humidity, then one note in a big room.
  4. Quiet rooms are large boxes saying "All quiet".
  5. On a phone the mockup is a four-column field, fourteen rooms on one
     screen; built, most boxes take the full width.
  6. The mockup has the big numbers, then the field, with Needs attention,
     Worth knowing, Playing and Modes & scenes in a column beside it;
     built, the field comes last, after alerts, chips, Pinned, Favourites
     and Scenes.
  7. The chips row repeats the big numbers beneath it.

- **Matched to mockup A (2026-11-01).** The user sent the board and asked
  for its layout, then for Pinned and Favourites beside the rooms too, with
  the side column arranged like any other sections (G32). As built
  ("The room field drawn as mockup A…" on `redesign`):
  - Header and band. Home's title keeps its name and has the day and the
    house's mode above it, shortened on a phone ("Sun, Nov 1 · Day Mode").
    The big numbers follow, with a rule above and below and 48px numbers on
    a wide screen. The chips row isn't drawn in this style.
  - The field. A 12-column grid of 84px rows, packed densely. The three
    busiest rooms are three rows tall and 5, 4 and 3 columns wide; with two
    busy rooms they are 6 and 6, with one 6. The next two are two rows tall
    (3 and 3, or 4 when there is one), and every other room is 2 × 2. A
    room with nothing going on is never big. Busyness counts lights on,
    marks and what's wrong (`fieldPlan` in `roomBox.ts`). The busiest three
    come first by busyness, and the rest keep the order they were arranged
    in. On a phone the field has four columns of 74px: 2 × 2, 2 × 1 and
    1 × 1.
  - A big box has its name, up to three marks (22px tiles: alert red for an
    open door, a leak or a low battery; amber for unlocked; grey for someone
    here, playing, a fan, a timer), its big number, a mono line of lights
    then humidity ("3 of 4 lights on · 55%"), one note (what's wrong first,
    such as "2 offline") and All off while lights are on. A small box has
    its name on up to two lines, one mark and one short line ("64° · Lights
    off", "1/1 on"). Where something is wrong, a small box's line says that
    in the alert colour instead (G6). The glow follows the share of lights
    on, and a box with something wrong has the alert border. The room's own
    settings still choose its big number and what it says.
  - The heading reads "Rooms" (the section's name, which can be renamed in
    Edit; the mockup says "The house"), with "Brighter is more of it on"
    and its ramp on the right. The footer reads "Sized by what is in each
    room · 17 rooms · tap one to open it".
  - The side column (G32) has a rule on its left and between its sections.
    By default it holds Needs attention, Pinned, Favourites, Worth knowing,
    Playing, then Scenes & modes. Alerts are compact rows (up to five, then
    "All N alerts"). Cards are one to a row and never Large. Worth knowing
    is plain rows under its heading. Playing is as the board draws it: the
    artwork or the player's icon in a tile, what's playing, its room, and
    a pause button. A player that gives its own id as the title (a Sonos on
    its line-in, "RINCON_542A…") says its name and "Playing" instead. Modes and scenes are
    34px chips, with the active mode in the lit colour.
  - On a phone the alerts are one line after the band ("1 door open · 8
    alerts"), and the side sections follow the field in their order.
  - The sidebar lists no rooms while Home is in the room field
    (§2.3), read from Home's changes as this screen shows them.
  - Room tiles, the room list and rooms in the sidebar look as they did.
    Worth knowing and Playing aren't drawn in those styles.
  - Arranging keeps the two columns. The field's boxes are drawn in order
    and all the same size, with their tools. Section tools in this style
    have "Beside the rooms" or "Under the rooms". Up and down move a section
    among the others in its column. The Rooms section leads the main column
    and can't move. Changing a section's layout or column keeps its other
    setting.
  - Home's JavaScript is 142.5 KB. The full alert list (with its seen and
    ignore tools) is fetched alongside Home's code, since Home only shows
    three alerts and they arrive from the network after it anyway. That
    took it from 152.1 KB, over budget, to 142.4 KB.
  - Still different from the board: no sparkline under Inside; "°" in
    place of "°F"; Worth knowing lists what's out of the ordinary now
    instead of a timed log of events; Customise stays in the header's
    pencil menu instead of a button beside the title. Pinned and Favourites
    cards are standard device cards, so the side column runs longer than
    the field when there are several.
  - Proof: unit tests for the field's plan, a box's text and marks, the
    columns through the layers and their default order, and Home's style
    read back. On the sandbox at 1280 × 900, 1440 × 1060 and 390 × 844,
    light and dark: the field chosen in Edit; in Customise, Playing moved
    above Favourites, Worth knowing hidden, Favourites put under the rooms;
    the person's document read back with `move`, `hide` and
    `config: { column: "main" }`. Tiles, list and rooms in the sidebar
    checked at 1280 and 390.
  - Older apps: a 0.1.40 app draws the field as before and ignores
    `column`. Its Edit → Done drops the household's changes to Worth
    knowing and Playing, which it doesn't have, and choosing a section's
    layout there drops that section's column. Release as one version.

## 7. G-c plan (2026-10-31)

Mockup: "G-c · Add anything, anywhere; your own sections" on the canvas
above — agreed, with: Customise (just me) adds and makes sections too, in
the person's layer; the weather card shows what a chosen weather device
reads now, and a forecast only when that device publishes one (an
Open-Meteo plugin is on the list; it isn't built here).

**Scope:** Add into any section, from Edit and Customise ("Add here" on a
section, an Into picker in the sheet, two tabs: things in the house, and
cards); sections of one's own; a layout per section; Pinned an ordinary
section; six new kinds — heading, text, worth knowing, playing, weather,
chart; taking an added card or an own section off again.

**Found in the code, and how the plan handles it**

- `applyPage` already moves a card `into` another section (G5). An `add`
  with `into` (and `before`) is read as the same move, placed ahead of the
  other changes, so a later move still wins. An `add` without `into` lands
  where it always has: Pinned on Home, "Also here" on a room's page — every
  stored pin stays where it is.
- `homePage` takes the added refs from the changes on screen. Edit adds to
  the household's list, Customise to the person's; the two lists are read
  separately (`added(house) ∪ added(mine)`), so taking one's own card off
  never takes the household's away.
- Edit → Done drops changes naming what the page doesn't present
  (`presentRefs`). Own sections come from changes, so `presentRefs` is taken
  from the page **with** its own sections (`withOwn`), and new cards are
  generated from their `add` like any other — both stay present.
- Kind components are imported by the registry, so each is in Home's first
  download. The new kinds load their component when first drawn
  (`load`), and the Add sheet loads when opened: Home's budget (≤150 KB,
  which v0.1.36 broke) stays as it is.
- The settings sheet (`KindSettings`) and the form engine draw every new
  kind's options. The engine gains: `text` with `render: 'multiline'` (a
  note), and a `sensor` field with `render: 'one'` (no average — a chart or
  a weather card reads one device).
- `chart` reuses the device page's `Chart` (GET `/devices/{id}/history`,
  thinned by homeCore to 160 points).

**The model**

- Changes, no new shape: still schema 2.
  - `add` with `into` / `before` (G5's fields, now used).
  - `{ op: 'section', ref: 'section:own-<n>', title, layout }` makes a
    section; `{ op: 'remove', ref: 'section:own-<n>' }` takes it away
    (`section` and `remove` supersede each other, as `add` and `remove` do).
    It's placed with an ordinary `move` of its section ref; it's renamed,
    hidden and laid out like any section.
- New cards are refs of their own: `kind:<kind>/<n>`, their settings a
  `config` on that ref (G13: only what the layer set).
- **Who may take things off (G18):** what the layer being changed made —
  the household's in Edit, the person's own in Customise. Anything else can
  be hidden.
- **Layouts per section (G19):** Pinned, Favourites and own sections — grid,
  row, list; Scenes & modes — row, grid, list; Rooms — list, field, tiles
  (as G-b, still also what the styles write); a room page's sections —
  grid, list. Field and tiles stay for rooms: they size by what's in a room.
- **Where Add goes (G20):** any section but Needs attention, What's going
  on, the big numbers, Favourites (starred, not added) and Rooms (generated
  from the house). Own sections, Pinned, Scenes & modes, a room's sections.
- **The new kinds (G21):** each one registration in `kinds.ts` with a
  descriptor —
  - *heading*: `text`. Spans its section's width.
  - *text*: `text` (multiline). A note for the household or oneself.
  - *worth knowing*: what's unusual now, by name — leaks, open, unlocked,
    playing (each a toggle; lights left out, the chips count those).
  - *playing*: every speaker or TV playing, its room and what's on.
  - *weather*: `station` (`auto` = the house's weather station; or one
    device). Its temperature large, then humidity, wind, rain where it
    reads them. **A forecast** shows when the device has a `forecast`
    attribute: a list of `{ time, high?, low?, condition?,
    precipitation_probability? }`, temperatures in °C (homeCore's rule),
    up to five shown. That's the contract for the weather plugin.
  - *chart*: `reading` (temperature or humidity), a sensor for it (one),
    and `span` (6 hours, a day, a week).
- New cards open their settings when added, where they need some (a note's
  text, a chart's sensor); the others are ready as they are.

**Modules**

- `layers.ts` — the `section` op, `ref.kind()`/`kindRef()`.
- `page.ts` — `withOwn()`, adds placed `into`, new cards from `kind:` refs,
  section `layouts` and `accepts`, who made an own section.
- `pieces.ts` — worth knowing, playing, the weather's readings and forecast:
  pure, unit-tested.
- `kinds.ts` + `components/kinds/{Heading,Text,Worth,Playing,Weather,
  Chart}Kind.svelte`, loaded when drawn.
- `components/AddCard.svelte` — Into, two tabs, either mode;
  `components/NewSection.svelte`; `SectionTools` — Add here, Layout,
  Remove (own).

**Commits, each leaving the app working:** (1) the model — changes, page,
tests, nothing drawn differently; (2) the kinds and their sheets, the form
engine's additions; (3) the Add sheet, from Edit and Customise, Add here,
taking added cards off; (4) own sections and a layout per section; (5)
tidy, and this section as built.

**Proof:** unit tests; build and budget on every commit; on the sandbox at
390 and 1280, light and dark — Home unchanged until something is added; the
sheet's two tabs; adding into several sections and an own section; the new
section sheet; each new kind on the page (a chart over the sandbox's
history, the weather from a sandbox station); Customise (just me) next to
Edit (everyone); Pinned with its old pins. Documents read back after each.

**Older apps (release note):** documents read unchanged. A 0.1.37 app shows
a card added `into` a section in Pinned, and doesn't show new kinds' cards
or own sections (it can't draw them). Its Edit → Done drops changes naming
what it doesn't present: own sections (`section` ops and their moves) and
new cards' settings and moves. Release as one version again.

**As built (2026-10-31)** — commits "Adding, step 1"–"step 5" on `redesign`.

- Add is opened from the bar ("Add" in Edit and in Customise) or a
  section's "Add here"; the sheet's "Add to" picks the section. Generated
  things already on the page aren't offered twice, as before.
- A scene added into another section is drawn there and not in Scenes &
  modes as well: an `add … into` reads as a move (G16), and a move takes a
  card out of wherever the page generated it.
- Taking off what this layer added (G18) uses the layer's own list:
  `view.added()` reads the household's and the person's separately, and
  `view.addedHere()` says whether this screen's layer added a card.
- Removing an own section removes what this layer added into it, with a
  question first. In Customise the person's other changes naming it (its
  move, a note's text) stay in their document and are skipped, as changes
  to anything gone are (M2); Edit's Done tidies the household's.
- A person can rename their own sections in Customise; the household's
  are renamed only in Edit (G10).
- Pinned and "Also here" show their hint while arranging in Customise too
  (they're ordinary sections now, G7); "Also here" is no longer drawn empty
  once its cards are added elsewhere.
- Layouts are a select in a section's tools; the Rooms section's is the
  same setting the styles write.
- New sheets (Add, New section) and the six new kinds' components load when
  first used: Home's JavaScript went from 142.8 KB to 146.1 KB compressed.
- The weather card shows the device's main readings (Ecowitt's humidity and
  pressures) and, where the device has `forecast`, up to five days. The
  sandbox's station has none, so the forecast is proven by unit tests, not
  a screenshot.
- Proof: unit tests over own sections, adds into sections, app cards, worth
  knowing, playing, weather and forecast, chart settings. On the sandbox
  (390/1280, light/dark): Home on fresh documents matches v0.1.37 (same
  sections and cards; the v0.1.37 copy ran from a worktree that drew a
  fallback font, so not pixel for pixel); the Add sheet's two tabs; adding
  a note, heading, weather, chart, worth knowing, playing and a light
  through Customise and Edit; own sections made in both, with a layout and
  a place; removing one's own section; a weather card added into a room's
  Controls. Documents read back each time: adds carry `into`, own
  sections are `section` changes with a `move`, settings are `config` on
  `kind:` refs.
- Release note: as planned above — one version; an older app's Edit → Done
  drops own sections and new cards' settings.
- **Afterwards (user, 2026-10-31): tidied, and cards move between sections.**
  - Worth knowing no longer lists what plays (the Playing card's job; an old
    `playing` setting is ignored) and says "Open for 10 days" in one phrase.
  - Weather names its readings: humidity, feels like, wind with its compass
    point, gusts, rain today, UV, pressure — relative only; the older
    Ecowitt's `barometric_rel` reads as inHg — four at most.
  - A chart on a card shows its reading's value beside the name, never
    wrapped, over a taller line fitted to the readings, its range beneath.
  - A row draws scenes' buttons in runs and anything else added between them
    in a grid of its own (`runsOf`), so buttons keep their height.
  - **Move to (G22):** while arranging, a card's tools have "Move to", listing
    the other sections shown here that take cards (`accepts`). It writes
    `move … into` at the section's end; up and down place it from there.
    A room's box stays among the rooms; Favourites and the house's pieces
    don't leave theirs. A move into a section since removed is skipped, so
    the card is where it was before — never lost. Room pages too.
  - A room's section emptied by moves isn't drawn as a bare heading; while
    arranging it shows, with a hint, so a card can be moved back in.
  - Older app (0.1.37): it already reads `move … into` (G5), so a moved card
    shows where it was moved; its Edit → Done keeps those moves, as they name
    cards it has.

## 8. G-d plan (2026-10-31)

Mockup: "G-d · A device card's settings" on the canvas — agreed, with:
a card with no control (a sensor) opens its page on tap, as today; a card
can instead be switched by tapping anywhere on it (a big target for wall
panels), and then opens from a small arrow or a long press; a card can have
a symbol of its own (a switch that runs a fan). Room pages stay as they are.

**Scope:** the `device` kind gets settings, drawn by the form engine like
every other kind's, per card and as a default for every card of a device
type. Nothing else.

**Found in the code, and how the plan handles it**

- `cardFor(device, now)` already builds everything a card shows, and its
  tests hold "no card offers a control the device doesn't declare". The
  settings are applied there — `cardFor(device, now, options)` — so that
  rule still holds: a setting can only choose among what `describe` found.
- Device cards' tools carry S/M/L. On a phone the tool row is already full
  (G-c's fix). The settings sheet takes over size for device cards: the
  tools show a settings button instead of S/M/L, and the sheet writes the
  same `form` change it always did. Plugin cards (`plugin` kind) keep S/M/L
  and their own settings element.
- `kindOptions` looks a card's settings up by a kind string and a ref. A
  device card uses `device:<type>` (card.ts `kindOf`: `light`,
  `motion_sensor`, …) as its kind, so "every light card" is one default and
  every motion sensor's another, through the same layers (G4, G13).
- `GenericDeviceCard`: only visible controls act (D2); the rest of the card
  is a link to the details (D3); a long press opens a small menu. Tapping
  the whole card to switch it replaces that link with a button and adds the
  arrow and the menu's "Open details" — keyboards and screen readers keep a
  named details link.
- A device a plugin draws (`device.card`) keeps its plugin's drawing: its
  sheet offers Size only, and says the rest is the plugin's.
- Budget: the sheet and the form engine are already lazy (`CardOptions`);
  only applying settings (small, in `card.ts`) and the descriptor builder
  are added to Home's first download.

**The model** — no new change shapes; still schema 2.

- A card's settings: `{ op: 'config', ref: 'device:<id>', config }` on the
  page, in the household's layer (Edit) or the person's (Customise).
- Every card of a type: `defaults['device:<type>']` in the household's or
  the person's document. Lookup (G4/G13): the person's card setting, the
  household's, the person's type default, the household's, built in.
- The options (all optional; built in = today's card):
  - `main` — what the state line leads with: `auto` (today's line) or one
    of the device's readings (`primary` first, then the rest, as the device
    page lists them).
  - `show_<attr>` — further readings after it on the state line (battery,
    temperature on a motion sensor, door on a lock…). Off unless chosen.
  - `extra_<attr>` — on Large: each slider, steps, transport or reading
    `cardFor` found (brightness, warmth, volume, speed…), on unless turned off.
  - `last` — "When it last changed", under the state line on Standard and
    Large.
  - `tap` — `details` (built in) or `control`: the whole card switches,
    locks or plays it. Offered only when the card has a control.
  - `symbol` — `auto` (the device's own, `status_icon`) or one of card.ts
    `SYMBOLS`, on this card only. A symbol keeps its state pair (lock and
    unlock, door and open door), as the device's own does.
- Size stays the page's `form` change; the sheet shows it with the rest.
- Never wider than the device: a reading the device stops publishing is
  skipped; `tap: control` on a card with no control acts as `details`.

**Commits** (each leaving the app working; gated on test, check, prettier,
build + budget)

1. `card.ts`: `cardFor(device, now, options?)` applies the options; the
   device's readings for choosing; tests (main, shown readings, Large
   extras off, last changed, symbol with its pair, tap without a control).
2. `options.ts` + `kinds.ts`: the device descriptor (built per card: its
   readings, its extras, tap only with a control, Size), the form engine's
   `enum` with `render: 'icons'` (a grid of the app's symbols); `DeviceKind`
   reads its options through `kindOptions` with `device:<type>`.
3. The sheet: `CardOptions` for device cards — Size written as `form`, the
   rest as `config`; "Same for every <type> card…" switching the sheet to
   the type's default and back; a plugin-drawn device shows Size only.
   Device cards' tools show settings instead of S/M/L.
4. Tapping: whole-card switching, the open arrow, "Open details" in the
   long-press menu; a separate details link for keyboards.
5. Doc 11 §8 as built.

**Migration and older apps.** Documents read unchanged; a card with no
settings draws as it did. A 0.1.38 app ignores `config` on device refs and
`defaults['device:…']` and keeps them when it saves (its Edit → Done keeps
changes naming cards it has, and device refs are such). So an older app
still open shows device cards as before and loses nothing. Release as one
version anyway, to keep the house's screens alike.

**As built (2026-10-31)** — "Device cards, step 1"–"step 4" on `redesign`.

- `cardFor(device, now, options)` applies a card's settings after it is
  described; with none it is the card it was. A card can only lead with,
  add or drop what it found, and `tap: control` takes effect only where the
  card already has a switch, lock or play control (tested over every device
  in the fixture house).
- **What a card offers to say** (`cardReadings`): what the device reports
  now, primary first — not its settings (`category: config`) or
  diagnostics, except its battery, and not a second form of another
  reading (`temperature_f`, `illuminance_raw`, `color_temp_mirek`). Plugins
  list a lot as primary (Hue's motion sensor lists nine), so this keeps the
  sheet to what reads as news.
- The sheet is built when it opens (`deviceOptions.ts`, in the lazy
  `CardOptions` chunk); the registry carries `settable` for device cards
  instead of a descriptor. Scenes a plugin publishes as devices have none.
- Device cards' tools show settings instead of S/M/L; the sheet's Size
  writes the same `form` change. Plugin cards (`plugin` kind) keep S/M/L.
- "Same for every <type> card…" turns the sheet to `defaults['device:<type>']`
  (no Size or Symbol there — those are one card's), and Done or close goes
  back to the card's own sheet, which now starts from the new default.
- Whole-card tapping: the card is a button named for what it does ("Turn
  Holiday Lights 1 off"); its page opens from an arrow beside its name (a
  44px target, the named details link) and from the long-press menu's
  "Open details". Offline or for someone who may only look, the card opens
  its page as usual.
- Size's segmented control wraps in the form engine's two-column rows on a
  wide screen (label left, control right); it reads, but the engine's row
  layout is worth a look on its own later.
- Home's JavaScript: 147.9 KB compressed (from 146.8).
- Proof: unit tests (card options over the fixture house, the sheet per
  device kind, the readings offered). On the sandbox (390/1280,
  light/dark): Home unchanged before any setting; the sheets for a light, a
  motion sensor and a lock; in Customise — the motion sensor leading with
  its light level and saying when it last changed, the lamp without its
  Warmth slider, Holiday Lights 1 drawn as a fan and switched by the whole
  card (its tap sends `PATCH …/state {"on":false}`), "Open details" in its
  long-press menu, every light card saying when it last changed while the
  lamp opts out; in Edit — the lock locking from anywhere on it, with its
  battery. Documents read back: `config` on `device:` refs in each layer,
  `defaults: { "device:light": { "last": true } }`.
- Release note: documents unchanged in shape; a 0.1.38 app ignores device
  cards' settings and keeps them when it saves, so nothing is lost if one
  is still open.
- **Matched to the mockup (coordinator, 2026-10-31).** The sheet reads
  Size; Main reading (a list of choices, each with its value now — the
  form engine's `enum` with `render: 'choices'` and an option's `sub`); "On
  the card" for a light (its sliders, "Large size only", and when it last
  changed) or "Also show" for anything else (plain labels, each value as a
  second line); Tapping the card with its one-line hint; Symbol; then "Same
  for every … card…". The form engine lays a field's label beside its
  control only where the form is wide (a container query at 620px — a
  settings page), so in a sheet every control takes the full width under
  its label and Size never wraps; the settings pages keep two columns.
  Readings offered are capped at six, most useful first, and leave out an
  effect engine's state (Hue's dynamics), "Enabled", sensitivities and how
  a lock was last worked — that goes on the last-changed line instead
  ("Changed 2 h ago by keypad"). The filter lives with the sheet, so Home's
  JavaScript stays at 147.8 KB.

## 9. G-e plan (2026-11-01)

Mockup: "G-e · Pages of your own, in the bar and on displays" on the canvas.
The user agreed to it, with four points: pages that are just yours as well
as the house's; a copy of Home or a room is a snapshot; only people who edit
the house's pages make the house's; the canvas page type (D4) and per-size
changes stay for later.

**Scope:** `/pages` lists the house's pages, then the person's. New page
takes a name, what to start from (empty, a copy of Home or a copy of a
room) and who sees it. A page is drawn by `PageView` and arranged with Edit
or Customise, like Home. It has a name, a symbol and a way to remove it,
plus "In my phone bar", and displays are offered the house's pages.
Nothing changes in homeCore.

**Found in the code, and how the plan handles it**

- A page is a generated base with layers on top (`applyPage`). Since G-c a
  layer can already make sections (`section`) and add cards into them
  (`add … into`). A page of one's own is that with an empty base. Its only
  generated section, "Cards", holds what was added without a section and
  has a heading only while arranging, as the big numbers do. There are no
  new change shapes.
- `cardOf` turns refs into cards for Pinned and "Also here": devices,
  scenes, plugin cards and app cards. A copy of Home holds room boxes, so
  `cardOf` learns `room:<id>` too, with the room's devices. The house's own
  pieces (alerts, chips, the big numbers, modes) have no ref to add, so a
  copy leaves them out. Alerts stay one tap away in the header.
- `Synced` saves the whole document it is given, and the UI server keeps
  every field. A 0.1.39 app saving the household's or a person's document
  therefore keeps `built` and the `page:` lists. Its Edit → Done tidies only
  the page being edited (`forget(key, …)`), and it never edits a `page:`
  key.
- Edit's "Back to the generated page" and Customise's "Reset to shared"
  would empty a page of one's own. On such pages they are left out, and the
  page's sheet has "Remove this page", with a question first. A person's
  layer over a house page keeps "Reset to shared".
- `pageKey` (nav.ts) says which pages can be arranged, and `/pages/<id>`
  joins as `page:<id>`. The pencil on a person's own page goes straight to
  Customise, and `?edit` on it does nothing.
- The bar drops anything it doesn't know (`safeBar`). `pages` and
  `page:<id>` become known, a page only while it exists: the house's for
  everyone, a person's own for them.
- `display.ts` names a display's pages as the bar does. `page:<id>` joins,
  for the house's pages only, and `allowedOn` lets the display be there.
  Displays already read the household's document.
- Budget: Home is at 147.8 KB of 150. The list, the page and its sheets
  are their own routes and lazy sheets; Home gains only the bar's and the
  sidebar's few lines.

**The model** (`layers.ts`, `built.ts`)

- `built?: { id, name, icon? }[]` on `HouseDoc` and on `PersonDoc`, in the
  order shown, with the page's changes at `pages['page:<id>']` in the same
  document.
- A page's key is `page:<id>` and its address `/pages/<id>`. The document
  that holds it says whose it is. Ids are new random ones (`newId`), so a
  house page and a person's page never share one.
- Making a page writes its entry in `built`. For a copy it also writes the
  changes: a `section` per section shown on the original (title and
  layout), and an `add … into` per card with its `rename`, `form` and
  `config`. A plugin's card or one of the app's own gets a new ref, so the
  copy's settings are its own. The copy is of what the maker sees: the
  shared page (the household's changes alone) for a house page, and the
  page as they see it for one's own.
- Removing a page removes its entry and its changes. A person's changes to
  a house page that's gone are left and skipped (M2).
- The bar takes `pages` and `page:<id>` (G30). "In my phone bar" writes the
  person's own bar: the page goes in place of Pages, else at the end if
  there's room, else in place of the last. Switched off, Pages goes back
  where the page was.
- Displays take `page:<id>` in their `pages` (G31). From a page's sheet an
  admin can put it on a display, first, where the display rests (as the
  mockup shows), or take it off.

**Modules**

- `layers.ts`: `built`, and bar choices with pages. `page.ts`: `builtPage`,
  `cardOf` with rooms, and own sections that keep a room layout. `built.ts`
  (new, not in Home's bundle): listing, making, copying, removing,
  renaming, the bar switch. `nav.ts`: `pageKey`, `barFor` with pages, Pages
  in the sidebar and More.
- `routes/pages/+page.svelte` (the list and New page),
  `routes/pages/[id]/+page.svelte` (the page), `PageAbout.svelte` (lazy:
  name, symbol, the bar, displays, removal).
- `display.ts`, Settings → Displays and the `Kiosk` tabs name pages.

**Commits** (each gated on test, check, prettier, build and budget)

1. The model: `built`, `builtPage`, rooms in `cardOf`, `built.ts`, and the
   bar's and displays' choices, with tests.
2. `/pages`: the list and New page.
3. The page: drawn, arranged in Edit or Customise, with its sheet (name,
   symbol, removal), the bar switch and displays.
4. Pages in the bar, the sidebar and More; Settings → Displays and the Me
   and Settings bar choosers offer pages.
5. Doc 11 §9 as built.

**Proof:** unit tests cover making a page, copying (a snapshot, so a new
device doesn't appear), whose a page is, the bar, display tabs, a page
that's gone, a person's page never offered to a display, and a non-editor
never making a house page. On the sandbox at 390 and 1280, light and dark:
the list, New page, an empty page ready to add to, a page built with Add, a
copy of Home, a page of one's own, the bar with a page in it, and Settings →
Displays offering a page. The documents are read back.

**Older apps (release note):** documents read unchanged. A 0.1.39 app shows its Pages screen as still to come and ignores `built`, the `page:` changes,
and a bar or display that names a page. It drops them from what it shows,
and its saves keep them all. Release as one version anyway.

**As built (2026-11-01).** Commits "Pages, own, step 1" to "step 4" and
"Pages, own, fixes from the sandbox" on `redesign`.

- A page someone made is `builtPage`: one generated section, "Cards", that
  holds whatever its layer added. Sections and adds are the G-c changes, so
  Edit, Customise, Add, New section, Move to, layouts and every card's
  settings work on it unchanged. Add also offers rooms' boxes there (a
  "Rooms" chip), and a room in a grid is drawn as its box at the grid's
  size, since a room's line was too narrow in a grid.
- New page offers "Everyone in the house" only to people who may edit the
  house's pages; for anyone else the page is theirs. An empty house page
  opens in Edit, and an empty page of one's own opens in Customise
  (`?customise`, read once by the page). A copy opens as it is.
- A copy of Home writes 42 changes on the sandbox house: Pinned, Favourites
  (for one's own page), Scenes & modes and Rooms as sections of the page's
  own, with sizes and names kept. Left out: alerts, chips, the big numbers,
  the modes row and "Not in a room" (`room:none` has no box to add yet).
- The page has a row with whose it is ("Everyone" or "Just you") and "This
  page", which opens the sheet: who sees it; name and symbol (the rooms'
  symbols) for whoever may change it; "In my phone bar" with the person's
  bar drawn as it would be (labels, and the page's own symbol); for an
  admin, each display with a switch; and "Remove this page". Name, symbol
  and removal of a house page are saved straight to the household's
  document, outside an Edit session.
- The bar preview in the sheet shows labels only, without the bar's icons.
  Importing those icons from the sheet would split them out of Home's
  chunks.
- Pages is in the sidebar and in More, and in the default phone bar once
  there are pages. The bar draws a page with its symbol, or the Pages icon
  if it has none.
- Settings → Displays lists the house's pages among a display's choices.
  `Kiosk` waits for the household's document before deciding where a
  display may be, and a display opened at `/` (after it is set up, or on a
  reload there) now rests on its first page. Before, it stayed on Home
  whenever Home was one of its pages. A display draws a page without its
  "This page" row.
- Found and fixed on the sandbox: the bar switch did nothing, because
  `Synced` runs a change twice (to show it, then to save it) and the second
  run read the switch after the first had flipped it. New section, made
  last, stored a move before itself, which `apply` read as "to the end", so
  a section made first could end up last once more were made. NewSection
  now reads where it goes before making the section, and a move before
  itself does nothing.
- Home's JavaScript: 148.4 KB compressed, up from 147.8. A first build was
  at 149.5 because Rollup split modules shared with the new routes (`nav`,
  `customise`, the plugin host, an icon) out of Home's chunks. The new code
  no longer imports them. `page.ts` is still its own chunk (+0.5 KB),
  because New page needs `homePage` to make a copy.
- Proof: 549 unit tests, 18 of them new (`built.test.ts` and the move before itself); the own sections test now also covers a room layout. On the sandbox through the
  app (`ge-shots/` in the session's scratchpad): the empty list, New page,
  an empty page in Edit and as seen, a page built with Add (Scenes as a row
  of two scenes, Lights with three lights, Rooms with Kitchen's box), a
  copy of Home made "Just me", Customise on it without "Reset to shared",
  the list with both, the sheet with the bar switch on and the page in the
  phone bar, the page put on a new display, Settings → Displays showing it
  first, and an enrolled display resting on it with "Kitchen panel · Home"
  tabs. Each was shot at 390 and 1280, light and dark, except the Edit,
  Customise and Settings shots (1280 light) and the display (1280×800,
  light and dark). Documents read back: `built` and `page:` changes in the
  household's and the person's, `bar: ["home", "page:…", "scenes",
  "alerts"]`, and the display's `pages: ["page:…", "home"]`. The sandbox
  display was deleted afterwards.
- Proven by unit tests only: a non-editor not being offered the house's
  pages (`mayMake`), a copy of a room, a page that's gone dropping out of
  the bar and a display's tabs, and the bar switch's off path.
- Against the mockup: the list, New page, the empty page and the page match
  it. The page's details are a sheet opened from "This page"; the mockup
  draws them beside the page. The sheet's bar preview has labels without
  icons.
- Release note: as planned above. A 0.1.39 app ignores pages and keeps
  them when it saves. A display set to a page needs this version, because
  an older one skips the page and shows its other tabs.
