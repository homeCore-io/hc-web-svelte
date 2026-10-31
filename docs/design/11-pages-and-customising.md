# 11 — Pages and customising

Status: **decided** — see `decisions.md` (G1–G10, all as recommended) · 2026-10-31

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
