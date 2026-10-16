# 03 — Cards

Status: **decided** — see `decisions.md` (C1–C9) · 2026-10-15

What a device looks like on a page, which controls sit on its card, and which
live in its details. Builds on D2 (tap for details, visible controls act), D3
(details generated from the schema), D4/D5 (grid), D9 (one design system, a
small set of card forms). Decisions to make are at the end (C1–C9).

The device kinds below are this house's, read from the live system on
2026-10-15: 184 devices, 22 kinds.

| Kind | Count | Writable | Actions |
|---|---|---|---|
| scene | 58 | — | activate |
| switch | 31 | on | — |
| light | 19 | on, brightness, warmth, colour, effect | — |
| temperature sensor | 14 | — | — |
| contact sensor | 9 | — | — |
| Pico remote | 8 | — | — |
| media player | 7 | on, source, state, channel | play, pause, stop, next, previous, … |
| water sensor | 7 | — | — |
| occupancy sensor | 5 | — | — |
| fan | 4 | on, speed | — |
| timer | 4 | (commands) | — |
| keypad | 3 | — | press button, set LED |
| lock | 3 | locked | — |
| gateway, bridge | 3 | — | refresh, pair |
| motion sensor | 2 | — | — |
| mode | 2 | on | — |
| lightning, rain, weather, vibration | 4 | — | — |
| vcrx (Lutron receiver) | 1 | — | press button, set LED |

---

## 1. Principles

1. **A card answers "what is it doing?" at a glance, and offers at most one
   obvious action.** Everything else is one tap away in the details (D3).
2. **The control on the card is the one people use most** — the switch for a
   light, not its colour. A device with no single obvious action has no
   control on its card, and that is fine.
3. **Cards are derived from the schema**, not hand-written per brand, so a new
   plugin's devices get sensible cards on day one. Known kinds get tuned
   presentations; unknown kinds fall back to the generic rule (§4).
4. **Few forms, all from one design system** (D9). The house should look like
   one thing, not forty card types.

## 2. Card forms

Three sizes of the same device card, plus a handful of cards that are not
about one device.

**Device cards**

```
Compact (1 row)            Standard                     Large
┌───────────────────┐      ┌───────────────────────┐    ┌───────────────────────────┐
│💡 Porch    On [●─]│      │ 💡 Porch light   [●──] │    │ 💡 Porch light      [●──]  │
└───────────────────┘      │    On · 80%            │    │    On · 80%                │
                           └───────────────────────┘    │  ☀ ━━━━━━━━━●━━━━━━  80%   │
                                                        │  ◐ ━━━━●━━━━━━━━━━  warm   │
                                                        └───────────────────────────┘
```

- **Compact** — icon, name, state word, the card's one control if it has one.
  For dense lists: a room's twelve switches.
- **Standard** — the default. Icon, name, a state line, the one control.
- **Large** — the standard card plus the device's *next* most-used controls
  drawn inline: brightness and warmth for a light, artwork and transport for
  a media player, speed for a fan. Still never everything; details still
  hold the rest.

Every form: tap anywhere but the control → details (D2). Long-press → the
personalise shortcut, star or hide (N6).

**Other cards**

| Card | What it shows | Tap |
|---|---|---|
| **Room** (on Home) | Room name and icon; a summary — lights on, temperature, anything open, playing | Opens the room |
| **Summary chip** (top of Home) | "4 lights on", "1 door open", "Office TV playing" | Opens the list behind it |
| **Scene** | Scene name; whether it is active, where the scene reports it | See C2 |
| **Mode chips** | The house's modes, current ones lit | Each chip is a control |
| **Reading** | One number, big: outside temperature, rain today | Details |
| **Chart** | A reading over time | Details |
| **Camera** | Live picture | Full screen |
| **Page items** | Heading, text, image, link to a page — hand-built pages only | — |

## 3. What each kind shows

Proposal, per kind in this house. "Card" is the control on Compact and
Standard; "Large adds" is what the Large form draws inline; "Details" is what
the popup leads with (D3 puts history, activity and settings under it for
everything).

| Kind | State line | Card control | Large adds | Details lead with |
|---|---|---|---|---|
| **Light** | On · 80% / Off | Switch | Brightness; warmth or colour where supported | Brightness, warmth, colour wheel, effects |
| **Switch / outlet** | On / Off (+ power if reported) | Switch | Power reading | Power and energy if reported |
| **Fan** | On · Medium / Off | Switch | Speed steps | Speed |
| **Lock** | Locked / Unlocked (+ by whom, recently) | Lock or Unlock button (confirm per D2) | Who and when | Lock/unlock, operation type, battery, who did what |
| **Media player** | Playing — title / Paused / Off | Play/pause | Artwork, previous/next, volume | Transport, volume, source, channels, the device's own actions grouped |
| **Scene** | Active / — | See C2 | — | Activate; what it sets |
| **Mode** | On / Off | Switch | — | — |
| **Timer** | Running · 4:32 left / Idle | Start or Cancel | Remaining as a ring | Start, pause, cancel, duration |
| **Contact (door/window)** | Open · 5 min / Closed | — | How long, last opened | History of open/close |
| **Water / leak** | Dry / **Wet** | — | — | History, battery |
| **Motion / occupancy** | Clear for 40 min / **Motion** | — | — | History |
| **Temperature / weather** | 21.5° (+ humidity) | — | Last 24 h line | Every reading, history |
| **Rain, lightning, vibration** | The reading in words | — | — | History |
| **Keypad** | Last button pressed | — | Its buttons | Buttons (press, LEDs), button names |
| **Pico remote** | Last button pressed | — (it can't be pressed remotely) | — | Button history |
| **Gateway / bridge** | Online / Offline | — | — | Its actions (refresh, pair), devices behind it |

**Alarming states are emphasised** on the card itself — wet, open at night,
motion where none is expected, offline — in the design system's alert colour,
and they feed Alerts (N7).

## 4. Any other device — the generic rule

For a kind with no tuned presentation (a new plugin, a Matter device):

1. **State line** from the device's `primary` readings, formatted with their
   units and, for booleans, the device's own words (`states`).
2. **Card control**, first that applies:
   - a writable boolean `on` → a switch;
   - exactly one action with no parameters → a button with that action's
     label (`confirm` honoured);
   - otherwise none.
3. **Large adds** the next writable attribute of a simple kind (a number with
   a range → a slider; an enum → a segmented choice).
4. **Details** are generated from everything declared: controls for writable
   attributes, actions with their parameters, readings, history.
   Diagnostic and config attributes go under a "More" fold.

## 5. States every card handles the same way

- **Unavailable** — dimmed, state line "Offline · 3 h", control disabled.
- **Waiting** — after a press, the control shows the new position at once and
  a subtle "working" mark until the house confirms; if it doesn't within a few
  seconds, it returns and says so. (homeCore confirms a command only by the
  state change that follows, matched by correlation id.)
- **Changed elsewhere** — a quiet note in the state line when the last change
  was physical or by a rule ("turned on at the wall"), from `last_change`.
- **Stale reading** — a sensor that hasn't reported in a long while says how
  long.

## 6. On the grid

Card sizes in grid cells (D4), at every screen size:

| Form | Width | Height |
|---|---|---|
| Compact | 1 column of a section | 1 row |
| Standard | 1 column | 2 rows |
| Large | 2 columns | 3–4 rows |

A section is the width of two Standard cards on a phone, more on larger
screens. Exact cell sizes are set with the design system.

---

## Decisions to make

**C1 — Three device card forms (Compact, Standard, Large) and the other
cards in §2.** *Recommend yes.* Anything missing from the "other cards" list?

**C2 — Scenes.** A scene's only action is "activate", so the D2 rule (tap =
details) means a scene card needs a separate Activate button. Options:
(a) **Scene cards are the exception: tapping activates**, long-press opens
details. (b) Follow D2 strictly: an Activate button on the card, tap for
details. *Recommend (a)* — a scene is an action, and a button-shaped card
that does nothing on tap is surprising; but it is an exception to a rule we
just made, so it is yours to call.

**C3 — The per-kind table in §3.** Adopt as the starting point? Changes?

**C4 — Lock control on the card.** Lock and unlock both on the card (unlock
with confirmation where set), or lock only — unlocking from details?
*Recommend both, with confirmation following D2.*

**C5 — Room cards on Home.** Show a summary only, or also a control such as
"All lights off"? *Recommend summary plus an "all off" control when
something is on* — it is the most common thing people do to a room.

**C6 — Infrastructure on the generated home.** Gateways, bridges and Pico
remotes have nothing to control from a page. *Recommend* left out of the
generated home and rooms by default (still in search, settings and details),
with personalise able to bring one back.

**C7 — Multi-channel devices** (Z-Wave `ep1_on`, `ep2_on`…): one card with a
switch per channel, or one card per channel? *Recommend one card per
channel* on the generated home — each channel is usually a separate light —
named from the channel names where set.

**C8 — The waiting state in §5.** How long before a command that hasn't been
confirmed is reported as not having worked? *Recommend 5 seconds*, per kind
adjustable (a lock can take longer).

**C9 — Alert emphasis on cards.** Which states count as alarming is partly
personal (a garage open at noon is fine). *Recommend* a small built-in set
(wet, smoke, offline, lock jammed) plus time rules set in Settings ("open
after 10 pm").
