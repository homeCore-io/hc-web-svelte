# 14 · Free layout: any card anywhere, any size

**Status:** agreed, 2026-11-07 (decisions P1 to P8 in `decisions.md`).
Building follows §11, room pages and made pages first. Steps 1 to 4 are
built locally (not released): those pages draw and arrange on the free grid. Floor plans are held for research (§12).

**What it builds on.** 11 (one page document, one renderer, changes in
layers), 13 (looks, each keeping its own arrangements, §8.4; arranging and
dragging, §9; stacks, §13.2). Where this changes them, §10 says so.

**Where it came from.** Trying stacks on the house, the user found nothing
could sit beside a stack and asked to "place widgets anywhere I want and
resize to fit how I want". The canvas board "Free layout" is the mockup this
design was agreed on.

---

## 1. What changes

Today a page is a stack of sections, each a box with its own grid, and
arranging saves an order: this card before that one, in this section, at one
of three sizes. Cards fill each grid from the top left, so a gap closes as
soon as it opens, and a tall card leaves holes beside it.

With free layout, **the whole page is one grid** of 12 columns (4 on a
phone), and every card has a place: a column, a row, a width and a height in
cells. Section headings become cards like any other. Anything can go
anywhere, at any size its drawing can draw, and gaps stay where they're left.

## 2. Every page is free (P1, P7)

Every page is free from the start; there is no switch to turn it on. A page
starts laid out as its look arranges it today (§4), so nothing moves for
anyone until they move something.

## 3. The grid

- **12 columns on a wide screen, 4 on a phone (P3)**, as Home's room field
  has. A row is 56 pixels at Classic's feel, with an 8 pixel gap; a look's
  density scales both, so a card sized in cells grows and shrinks with it.
- **A card's place** is `x`, `y`, `w`, `h` in cells, kept by a new change,
  `{ op: 'place', ref, x, y, w, h }`, in the layer being arranged, like any
  change (11 §2.5). Each look keeps its own (13 §8.4), so a look made from
  another starts with its copy.
- **Narrower screens read the page in order (P4)**: top to bottom, left to
  right, by place, laid out again on a narrower grid. Under 1080 pixels of
  page it's 8 columns, with cards in twos (2, 4, 6 or 8 wide); on a phone,
  4, a usual card taking half and anything wider the whole. A card across
  the whole page (a heading) starts a run of its own, so no card is pulled up
  past its heading. A phone arrangement of its own can come later.
- **A card taller than its rows** makes them taller rather than spilling.

## 4. Where a page starts

A page with no places of its own is laid out from what it is today: its
sections in order, each heading a full-width card, then its things at their
sizes, filled from the top left. The look's grouping still decides which
sections there are and what's in them (13 §8); a section that asked to be a
stack starts as one (13 §13.2).

The first time anyone places a card on a page, every card shown there is
given its place as drawn, in that layer. From then on the page holds still:
a new device doesn't reshuffle it.

- **A new thing** (a device added to the room, a card added from elsewhere)
  takes the first gap that fits it, top left first, at its usual size.
- **A thing that's gone** leaves a hole, which stays until someone fills it
  or tidies.

## 5. Moving and sizing

- **Dragging a card** shows its footprint under the pointer, snapped to
  cells. Let go and it's there.
- **When it lands on others (P2)**, each one it covers moves aside, the way
  the drag was going, if those rows have room for it; otherwise it moves down
  below the card, and whatever that lands on moves down in turn. A card
  never ends up above one it was below, so cards stay under their heading
  when it's pushed down. Nothing ever overlaps.
- **The page shows what it will be** while it's dragged: the cards it covers
  move aside or down as it goes, and the footprint shows where it lands.
- **Gaps stay (P5).** **Tidy**, in the arranging bar, closes them up: every
  card moves up as far as it can, keeping its column.
- **The corner** sizes a card to any width and height its drawing allows
  (§7). The size shows as it's dragged ("4 × 3"). A click on it steps to the
  drawing's next usual size.
- **Never only by dragging** (13 §9.3). The keyboard picks a card up with
  Space; the arrows move it a cell; Shift and the arrows size it. Up and down
  in a card's tools trade places with the card before or after it in reading
  order, which works the same on every width. **Move to** places it in the
  first gap after a heading, as Add here does. A screen reader hears its
  place ("Office TV, row 2, columns 1 to 6").
- **Its tools float over it** while it's pointed at or chosen (a tap on a
  phone), so the page keeps the shape it will have.
- **On a narrower screen** the page is arranged with the keyboard and up and
  down; dragging by cells is on the twelve-column grid.
- **Stacks.** A device or a scene dragged onto a stack goes in it; a line
  dragged out of a stack becomes its own card where it's let go.
- **Changing a card's size** in its tools or its settings gives it that
  size's cells where it is; a stack's width and height do too.
- **Two layers.** The household places cards, then a person places theirs
  on top. Where a person's place lands on the household's, the person's wins
  and the other moves aside or down, as when dragging.

## 6. Headings and widgets

The old sections are **heading cards**: a heading is a card with words,
placed and sized freely, so "Scenes" can sit beside a stack at part width.
A section's tools go onto its heading: rename, hide, and **Add here**, which
adds just under it. Hiding a heading hides its cards too, as hiding a section
does today: looks start some sections hidden (More, until someone shows it),
and households have hidden sections, so hiding the heading alone would bring
those cards back. A card can still be hidden on its own.

A section a look draws as one box (a list, swatches, a panel, folded lines)
is placed whole, its heading inside it, until step 3 lets its cards go free.

**Widgets for designing a page (P8)**, all in Add › Cards, each placed in
the first gap that fits and then moved and sized like any card:

| Widget | What |
|---|---|
| Title | big words: a page's or an area's name |
| Heading | a small label above a group (exists as a card today) |
| Text box | a note or instructions (exists as Text today) |
| Divider | a line between areas |
| Space | empty room, seen only while arranging |
| Picture | an image, uploaded to the app's own server as extensions are |
| Link to a page | a button that opens another page or room |
| Clock | the time and date, growing with its size |

**As built (step 4):** all six are in Add › Cards. A title's words and a
clock's time grow with their place. A divider can carry words. A space shows
only while arranging. A link opens Home, Scenes, Alerts, a room or a page,
and says so if what it opened is gone. A picture is sent to the app's own
server (`pictures/` in its data directory), up to 8 MB, and only PNG, JPEG,
WebP or GIF, told by its first bytes; SVG is refused, since it can carry
script. Any signed-in person may add one, and a picture is drawn only from
the app's own address, never one typed in.

Plugins and UI extensions can offer widgets too, through the slots they
already have (13 §12).

## 7. Drawings fill their size

Today a drawing promises three sizes: compact, standard and large. A free
card can be any number of cells, so each kind of card says its smallest and
largest size, and its drawing fills what it gets, showing more as it grows:
a stack lists more things and goes to two columns, a TV shows more apps, a
reading adds its graph, a player its controls. Drawings do this with
container queries; twelve components already do.

A drawing that says nothing, such as a plugin's or an extension's card that
declares only `forms`, keeps its three sizes: its corner snaps between them,
and in a larger place it draws at its largest, centered.

| Kind | Smallest | Usual | Largest |
|---|---|---|---|
| a device, compact, standard, large | 2 × 1 | 2 × 2, 4 × 3 | 6 × 4 |
| a scene's button | 2 × 1 | 2 × 1 | 4 × 2 |
| a stack | 2 × 3 | fits its things | 12 × 10 |
| a player, a TV | 3 × 2 | 4 × 3, 6 × 3 | 12 × 6 |
| a chart, a reading | 2 × 2 | 3 × 2 | 12 × 6 |
| heading, title, divider | 2 × 1 | 12 × 1 | 12 × 2 |

**As built (step 3):** the corner and the keyboard keep a card within its
range. A card with several drawings shows the largest whose usual size fits
its place, so a lamp sized 2 × 1 draws compact and 4 × 3 large. A stack
fills its place, scrolling what doesn't fit, with two columns of things from
8 cells wide (or from 4, where its settings ask for two). A thermostat is
4 × 4 to 8 × 6; players and readings grow to 12 × 6, other devices to 6 × 4.
Drawings that show more as they grow (a TV's apps, a reading's graph) come
kind by kind; until then they draw their largest form, stretched.

## 8. Looks and the look editor

- **A look's grouping gives the starting layout** (§4). A grouping rule can
  also say where its section starts ("at the left, 3 wide"), so a look can
  lay a room out differently, not just recolor it.
- **Lit's columns and Home's room field** are fixed grids today; they become
  starting layouts, so they keep their look until someone moves something.
- **The editor's preview** shows a room as the look starts it, now placed.
  Drawings made in the editor get a size range and a preview at each size.
- **Layouts to share:** copy a room's layout to another, start a room from a
  layout, and export it with a look.

## 9. What it could break, and how it's handled

| What | How |
|---|---|
| Arranging saved order; it now saves places | Places are a new change; the old moves still read, to lay out a page that has no places yet (§4) |
| Up, down, Move to, the keyboard | New meanings (§5) |
| Phones | Reading order (§3) |
| New and removed devices | First gap; holes stay; Tidy (§4, §5) |
| Two layers on the same cells | The person's wins, the other moves (§5) |
| Each look's own arrangement | Places are kept per look; a copy keeps them; a look that groups rooms differently starts over, as today |
| Drawings know three sizes | Smallest and largest per kind; three-size drawings snap (§7) |
| Feel changes row height | Cards size in cells; text wraps or cuts, never spills |
| Screen readers | Read in order: top to bottom, left to right |
| Favorites | Each person's own list, placed in their layer only |
| Alerts first | Needs attention stays pinned at the top of Home, above the grid |

## 10. Changes to earlier decisions

- **11 §2 (sections):** a page is still made of sections in the document,
  but on screen they're headings in one grid.
- **13 §9.1 and §9.2:** arranging moves and sizes cards by cells instead of
  ordering them in sections; dragging between sections becomes dragging
  anywhere.
- **13 §9.5:** resizing is any size within the drawing's range, not three
  steps.
- **13 §13.2:** a stack's width and height become its place's.

## 11. Steps

1. **The model.** `place`, the starting layout (§4), landing on others
   (§5), first gap, Tidy; the free grid drawn on room pages and made pages,
   reading order on phones; headings as cards with the section's tools.
2. **Arranging.** Dragging by cells with the footprint, sizing from the
   corner, the keyboard, up and down, Move to.
3. **Drawings fill their size.** Smallest and largest per kind (§7); the
   built-in drawings grow; three-size drawings snap.
4. **Widgets.** Title, divider, space, picture, link, clock (§6).
5. **Looks and the editor.** Placed previews; grouping rules that place;
   layouts to share (§8).
6. **Home and displays (P6),** with Lit's columns and the room field as
   starting layouts.
7. **Floor plans** (13 §18, step 8): held for research (§12).

Each step is mocked up where it differs from the board, and tried on a
sandbox before it's released.

## 12. Floor plans: held for research

The cells are too coarse for a floor plan, and they change shape: columns
stretch with the screen while rows stay 56 pixels, so a picture behind the
grid would drift away from the cards on it. The direction the user liked,
2026-11-07, is a **floor plan card**: placed on the page grid like any card,
with markers inside it at fractions of the picture (37.5% across, 62% down),
so they stay on their spots at any size; markers a constant size; pinch and
pan on a phone; floors as tabs. Nothing is decided or built until it's been
researched further.

## 13. Still to do

Found while building steps 1 to 3, kept here until each is done:

- **Drawings that show more as they grow**, kind by kind: a TV's apps, a
  reading's graph, a player's controls. Until then a big card is its largest
  drawing, stretched.
- **A light at 2 × 1 cuts a long name** ("Ceili…"): the compact drawing
  needs to wrap or shrink its words at that width.
- **A plugin's card in a place bigger than its largest form** should draw at
  its largest, centered; it stretches today.
- **Dragging from the Add sheet** onto a free page (the Add button works).
- **Dragging by cells on a narrower screen**; today the keyboard and up and
  down arrange it there.
- **Not yet tried:** touch dragging, phones, Edit mode saving for the
  household, Move to and Add here in the browser, a page someone made.
- **Pictures are never deleted** from the server when taken off a page; a
  tidy-up of ones no page uses is still to come.
- **Widgets on Home and on Lit's rooms** draw in their sections until step 6
  puts those pages on the grid.
- **Floor plans**, held for research (§12).
