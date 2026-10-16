# 06 — Visual design

Status: **decided** — see `decisions.md` (V1–V5) · 2026-10-15

The design system: one set of shapes, type and spacing, with two colour
themes. Chosen from the mockups at
<https://claude.ai/artifact/Lu21gsovfuPFbpvVR9ZedM> (private), which drew the
same three screens — phone home, device details, desktop home — in three
directions using the house's real devices. Builds on D9a (tokens, per-person
choice), D12 (performance), C1 (card forms).

**Chosen:** direction A (Calm) as the **light** theme and direction B (Night
panel) as the **dark** theme. Direction C (Bright tiles) is not taken forward.

---

## 1. One system, two themes

Everything except colour is shared. A theme is only a set of colour tokens;
a third-party card (D9b) gets the tokens and so follows the theme.

### Colour tokens

| Token | Light (Calm) | Dark (Night panel) | Used for |
|---|---|---|---|
| `bg` | #F3F0E8 | #0D1015 | Page ground |
| `surface` | #FFFFFF | #161A21 | Cards, chips |
| `surface-2` | #EEEAE0 | #202630 | Wells, icon chips (off), secondary buttons |
| `sheet` | #FBFAF6 | #12161C | Popups and sheets |
| `side` | #EEEAE0 | #0A0D11 | Desktop sidebar |
| `line` | #E2DCCF | #2A303B | Dividers, control borders |
| `card-line` | #E9E3D6 | #232934 | Card borders |
| `ink` | #1E2126 | #E9EDF2 | Text |
| `ink-muted` | #5D6470 | #9AA4B2 | Secondary text, state lines |
| `accent` | #9A4A07 | #F2B544 | Primary buttons, active mode, links |
| `accent-ink` | #FFFFFF | #1A1306 | Text on accent |
| `lit-bg` | #FBE3BF | #3D3014 | Icon chip of something that is on |
| `lit-ink` | #8A4206 | #F7C866 | Icon of something that is on |
| `lit-card-line` | = `card-line` | #5A4520 | Card border when on (dark only: the glow) |
| `track-on` / `track-off` | #C9701A / #CFC8BA | #E0A23A / #3A414D | Switches |
| `fill` | #F6C987 | #B9862E | Brightness and level fills |
| `alert` | #B42318 | #FF7A6B | Alarming state text and marks |
| `alert-bg` / `alert-line` | #FCE9E6 / #F2C2BB | #33191A / #5C2A27 | Alarming chips and cards |
| `scrim` | rgba(30,33,38,.35) | rgba(0,0,0,.55) | Behind popups |

**The language of colour:** amber means *on* — a light lit, a TV playing, a
mode active. Red (light) / coral (dark) means *needs attention*. Nothing else
is coloured, so both stand out. Every text pairing above meets 4.5:1.

### Type

- **Figtree** for everything. **IBM Plex Mono** for numbers and readings —
  temperatures, percentages, times — so they line up and read as data.
- Both self-hosted with the app (§5), never loaded from Google at run time.

| Style | Size / weight | Used for |
|---|---|---|
| Page title | 28 / 700 (desktop 26) | "Home", a room's name |
| Sheet title | 19 / 700 | Device name in details |
| Section label | 13 / 600, caps, +0.06em | "Favourites", "Rooms" |
| Card name | 15 / 600 | Device and room names |
| Body | 14 / 500 | Buttons, rows |
| State | 13 / 400 | "On · 80%", "Door open" |
| Caption | 11 / 600 | Badges, tab labels |
| Reading | Plex Mono 13–22 / 400–500 | Numbers |

### Shape and space

- **Spacing** on a 4px scale: 4, 8, 12, 16, 20, 24, 32.
- **Corners:** cards 14px, icon chips 11px, pills fully round, sheets 24px at
  the top.
- **Depth:** light theme — a faint shadow under cards; dark theme — borders
  only, no shadows, and a warm border on cards that are on.
- **Touch targets** at least 44×44 px everywhere, including a switch (its
  track is smaller; its target isn't).

### Icons

One stroke icon set, 24px grid, 1.8px stroke, round caps — the style the
mockups used. The set itself is V3.

### Motion

- State changes (a switch, a card lighting) 150 ms; sheets and dialogs 250 ms.
- Everything respects the person's reduced-motion setting.
- No animation that runs on its own — a wall panel shows a still screen.

## 2. When the app is dark (V2)

- By default the app follows the phone's or computer's own light/dark setting.
- Each person can force light or dark for themselves (D9a).
- A display (D7) has its own setting, which can include following the house's
  Night Mode — so a kitchen panel dims with the house.

## 3. Cards, as drawn

The mockups fix the details C1 left open:

- **Standard card:** icon chip top-left, the card's one control top-right,
  name and state line at the bottom; tap anywhere else for details (D2).
- **On** is shown by the icon chip turning amber (and, in the dark theme, a
  warm border). The card itself stays the same surface — quieter than filling
  the whole card, which was direction C.
- **Alarming** is shown by the icon chip and state line turning alert
  colour, and the card's border warming to `alert-line`.
- **Large card:** the Standard header row, then labelled sliders.
- **Room card:** icon chip, name, summary line, "All off" while something is
  on, a chevron.
- **Details sheet:** header with icon, name, room and state, settings and
  close; then the main control large (a full-width brightness bar with the
  power button beside it for a light), secondary controls, actions, a 24-hour
  history line, and activity — who or what changed it, and when.

## 4. Performance budget (D12) — V5

Proposed, on a **mid-range phone** (a current Pixel "a"-series or similar) and
a **base iPad**, on the home network:

| Measure | Budget |
|---|---|
| Cold load to a usable home | ≤ 1.5 s |
| Reload with the app cached | ≤ 0.5 s |
| Tap to visible response | ≤ 100 ms |
| Device change to the screen showing it | ≤ 250 ms after homeCore announces it |
| JavaScript for the home, compressed | ≤ 150 KB |
| Elements on the home page, this house (184 devices) | ≤ 1,500 |
| Scrolling | Smooth at 60 fps |

Checked automatically on every change against a recorded copy of this
house's devices, so the numbers can't drift unnoticed.

## 5. Works without the internet — V4

A house keeps working when its internet connection is down, so the app must
too: fonts, icons and everything else are served by the UI server, nothing is
fetched from a third party at run time.

---

## Decisions to make

**V3 — Icon set.** *Recommend* **Lucide** (open source, ISC licence, the
stroke style the mockups use, ~1,500 icons, a Svelte package that ships only
the icons used). Alternative: Phosphor (more weights), or draw our own.

**V4 — Self-hosted assets, no third-party requests at run time.**
*Recommend yes.*

**V5 — The performance budget in §4.** Adopt as the starting numbers?
