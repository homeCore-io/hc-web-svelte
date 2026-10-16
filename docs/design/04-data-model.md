# 04 — Data model

Status: **decided** — see `decisions.md` (M1–M8; M1 revised the storage split) · 2026-10-15

What the UI has to store, where it lives, and how the generated home, the
household's edits, per-size adjustments and each person's own changes combine
into what a screen shows. Builds on D1, D5, D6, D7, D9a, D10, D11, D13, N2,
N9, C9. Decisions to make are at the end (M1–M8).

---

## 1. What has to be stored

| What | Whose | Lives in | From |
|---|---|---|---|
| Rooms: stable id, name as typed | Household | homeCore | D10 |
| Display and PIN credentials | Household / per person | homeCore | D7, N9 |
| Alert rules, and alerts | Household | homeCore | C9, M6 |
| Changes to the generated home and room pages | Household | UI server | D1 |
| Hand-built pages (grid or canvas) | Household, with edit grants | UI server | D1, D4 |
| Per-size adjustments to a page | Household | UI server | D5 |
| Room icons and order | Household | UI server | D10 |
| Default phone bar | Household | UI server | N2 |
| Themes, and the house's default | Household | UI server | D9a |
| Confirmation on or off per device or type | Household | UI server | D2 |
| A display's pages and kiosk settings | Household | UI server | D7 |
| Images, icons, fonts, floorplans | Household | UI server | — |
| Third-party card code | Household | UI server | D9b |
| Personal changes: favourites, hidden, order, pinned | Per person | UI server | D6 |
| Personal phone bar, theme, light/dark | Per person | UI server | N2, D9a |
| Last-opened page, collapsed sidebar, … | Per browser | Browser | — |

The split (M1): homeCore keeps facts about the house and identity; the UI's
own server keeps everything about presentation.

**Not stored:** the generated home itself. It is computed from rooms and
devices every time, which is what lets a new device appear without anybody
doing anything (D1).

## 2. What homeCore offers today

- **Dashboards** (`/dashboards`): a document per page with per-breakpoint
  layouts, widgets with free-form config, owner, view/edit grants, and a
  per-user default. Framework-neutral, but shaped by the previous client —
  pixel/cell placements per breakpoint, no notion of a generated base or of
  layers.
- **Skins** (`/skins`): house-wide theme seeds.
- **Assets** (`/assets`): uploaded images.
- **API keys** with **narrower scopes than their owner** — the server's own
  tests use a "hallway panel" key limited to reading dashboards and content.
  A natural basis for display credentials (D7).
- **`content:read` / `content:write` scopes** exist, but no core routes use
  them: they were for hc-web-lit's own Node server, which stored that client's
  pages beside the app.
- **Nothing for:** per-person preferences, displays, PINs, alert rules, room
  icons or order.

## 3. The layer model

How one screen's view is built. Every page is a **base** with **layers**
applied in order:

```
 generated base            (computed from rooms + devices, or a hand-built page)
   + household edits       (shared: hide, move, rename, add, resize)
   + size adjustments      (only on phone / tablet / desktop, D5)
   + personal changes      (this person's: favourite, hide, order, pin)
 = what this person sees on this screen
```

**Layers are lists of changes, not copies.** Each change names what it
changes by a **stable id** — a card's id is derived from what it shows
(`device:porch_light`, `room:kitchen`, `scene:evening`), and added cards get
their own id. A change is something like:

```
hide    device:garage_bridge
move    room:kitchen        before room:living
form    device:porch_light  large
rename  device:porch_light  "Porch"
add     {card…}             in section:favourites after device:front_door
```

- **The base can keep changing underneath.** A new device appears in its
  room; a change that names something that no longer exists is kept but
  skipped, and shown in edit mode as "refers to something that's gone". This
  is exactly what Home Assistant's "take control" copy cannot do.
- **The same mechanism serves D1, D5 and D6.** Household edits, per-size
  adjustments and personal changes are the same kind of list, owned by
  different people.
- **Hand-built pages** are a base the household wrote rather than one that
  was generated; size adjustments and personal changes apply to them the same
  way.

## 4. Sketch of the documents

Shapes, not a schema — field names will change.

**Page** (hand-built; a generated page has the same shape but is computed):

```
page
  id, name, icon
  kind: grid | canvas
  sections: [ { id, title, cards: [ card ] } ]      (grid)
  frame: { width, height }, items: [ placed card ]  (canvas)
  access: who may view / edit
  version
card
  id
  kind: device | room | scene | summary | modes | reading | chart | camera
        | heading | text | image | link | extension:<name>
  ref: device / room / scene id, where it is about one
  form: compact | standard | large
  options: kind-specific, and unknown keys kept (extensions, D9b)
```

**Layer:** `{ page, owner: household | size:phone | person:<id>, changes: [ … ], version }`

**Display:** `{ id, name, credential, home page, pages, kiosk: { stay awake,
screensaver, reload }, version }`

**Person's preferences:** `{ person, theme, light/dark, phone bar, … }`

**Household settings:** `{ room icons and order, default phone bar, default
theme, confirmation overrides, alert rules }`

## 5. Live and consistent

- Every change is **saved and announced** — by homeCore for house facts
  (D11), by the UI server for presentation (M1) — so a wall panel updates the
  moment someone edits on a phone.
- Two people editing the same page: each change is small and named by id, so
  most edits from two people combine; editing the very same card at the same
  moment is last-write-wins, with the loser told.
- **Undo** works on changes, within an editing session.

## 6. Text mode (D13)

The text editor shows exactly what is stored — a page document or a layer's
list of changes — so round-tripping between text and visual is lossless by
construction. Unknown fields are always kept. Whether the text form is JSON
or YAML (and so whether comments exist) is M7.

## 7. Versions and migration

Every document carries a version. The app migrates old versions when it reads
them and writes the current one; it never drops a field it doesn't understand,
because an extension (D9b) or a newer app may have written it.

---

## Decisions to make

**M1 — Where shared and personal UI data lives.**
(a) **homeCore, as a small generic store for UI documents**: pages, layers,
displays, preferences, household settings, each with an owner, access rules
and change events. homeCore stores and guards them; the app defines what's in
them.
(b) **Reshape homeCore's existing `/dashboards`** to carry the new page shape,
and add separate endpoints for everything else.
(c) **The web app's own server** beside it, as hc-web-lit had.
*Recommend (a).* One source of truth for every screen and display, backed up
with homeCore, visible to other clients, no second server to run — and homeCore
doesn't have to learn each UI concept, only who may read and write what.

**M2 — Layers are lists of changes keyed by stable ids**, never copies.
*Recommend yes* — it is what makes D1 work.

**M3 — Personal changes win for that person.** If the household hid
something, may a person show it again on their own view? *Recommend yes* —
it's their view; real restrictions come from permissions (D8), not hiding.

**M4 — Personal changes on hand-built pages too**, not just the generated
home. *Recommend yes.*

**M5 — Displays are homeCore records with their own scoped credential**,
built on the existing narrow-scoped API keys, created by pairing. *Recommend
yes.* **[core]**

**M6 — Alert rules (C9) are evaluated in homeCore**, which then announces
alerts on the event stream; screens only show them. Otherwise two screens can
disagree and nothing is noticed while no screen is open. homeCore's rule
engine already watches states and durations, so an alert rule may be a thin
layer over it. *Recommend homeCore.* **[core]**

**M7 — Text format for the advanced editor (D13).**
(a) JSON — no comments, so nothing can be lost; a `note` field on any item for
explanations.
(b) YAML with comments, kept across visual edits — friendlier to read and
what HA users know, but the stored form has to keep the comments too.
*Recommend (a)* for certainty; (b) if comments matter to you.

**M8 — The old `/dashboards` documents.** The current house has pages made
with hc-web-lit and hc-web-flutter. (a) Leave them; the new app starts from
the generated home and new pages. (b) Import them once into the new page
shape, as far as they translate. *Recommend (a)*, with (b) as a later tool if
it's missed.
