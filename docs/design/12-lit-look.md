# 12 · The Lit look

**Superseded in part by 13** (13-ui-and-looks.md, 2026-11-02): Lit becomes one look
in the five-layer model there, and its rooms are drawn through the page
document so they can be arranged. What follows is how it was first built.

A second way of drawing the pages people use every day. Today's look stays
as **Classic**; the new one is **Lit**. Mockups: the Home canvas, boards
"A · The lit room", "A on a phone", "A wall display at rest" and "A for a
room of switches: the garage" (2026-11-02).

## What a look is

The app already has three choices that change how it looks, and a look is a
fourth, separate from each:

| Choice                                                       | Who                                | What it changes                         |
| ------------------------------------------------------------ | ---------------------------------- | --------------------------------------- |
| Light or dark                                                | each person                        | the ground and ink                      |
| Theme (Amber, Sage, Harbour, Plum)                           | the house, a person may differ     | the colours                             |
| Home's style (List, Room field, Tiles, Rooms in the sidebar) | the house's page, a person's own   | how Home's sections are arranged        |
| **Look (Classic, Lit)**                                      | **the house, a person may differ** | **how a room and its things are drawn** |

So Lit works in any theme, light or dark, and with any of Home's styles.

## Decisions (the user, 2026-11-02)

- L1. **The house sets a look; anyone may choose another for themselves**,
  as with the theme: Settings › Look for the house, Me for a person.
- L2. **Lit draws rooms, Home and displays.** Settings, automations and
  plugins' own pages keep one look.
- L3. **The house stays Classic until someone chooses Lit.** An upgrade
  changes nothing anyone sees.

## What Lit draws differently

- **A room's header glows as the room is lit**: each light that is on adds
  its own colour at its brightness. Under the name, the room in chips: its
  readings, how many lights are on, and anything wrong, which a tap fixes.
- **What needs someone comes first**: an open lock, a door left open, a
  device that has stopped answering, each with its one-tap fix.
- **A light is a card you drag across to dim**; it fills with the light's
  colour. Lights that belong together (Holiday Lights 1 to 4) are one card
  with a dot each.
- **Switches are a panel of rockers**, grouped by what they power: lights,
  then power and water. "Lights off" switches only lights.
- **Doors, garage doors and locks are drawn as what they are**: open, shut,
  locked.
- **Scenes are round swatches**: a light scene shows its colours; a house
  scene (it does more than lights) shows the light it leaves, or a sign of
  what it is for when it leaves the room dark, with a badge for each other
  kind of thing it changes and a line saying what it does.
- **Sensors carry a faint graph of their last day**; a door sensor, a mark
  for each opening.
- **Media shows what is on**: a Roku its channels' own icons, and the
  playing app's icon, title and progress.
- **"More in this room"** folds away remotes, keypads and buttons.

## Steps

1. The choice: `look` in the house's and a person's documents, the pickers,
   `data-look` on the page from the first paint. Classic is untouched; Lit's
   code loads only when it is chosen, so Home stays inside its size budget.
2. Room pages in Lit.
3. Home and displays in Lit.
4. The phone layout, then release.

Each step is checked on the sandbox against its board before the next.
