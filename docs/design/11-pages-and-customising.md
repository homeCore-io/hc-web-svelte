# 11 — Pages and customising

Status: **decided** — see `decisions.md` (G1–G15) · 2026-10-31 · **G-a released** (0.1.35) · **G-b built** on `redesign` (not released, §6)

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
