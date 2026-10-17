# 09 — Automations: the list and the editor

Status: **decided** — see `decisions.md` (E1–E9, all as recommended) · 2026-10-16

The design pass T3 asked for, before A2 (read and manage) and A3 (write).
It starts from the house's own 42 rules, not from the model's full reach.

---

## 1. What the house's rules show

Read from the live house on 2026-10-16 (`GET /automations`).

**The model is large; the house uses a corner of it.** homeCore offers 18
trigger kinds, 13 condition kinds (with And, Or, Not, Xor and Rhai) and 36
action kinds (loops, waits, per-mode variants, fades, variables). The house's
rules use:

| | Used | Count |
|---|---|---|
| Triggers | A device changed · homeCore started · a sun event | 37 · 3 · 2 |
| Conditions | A device's state · a mode · a time window · one Or | 34 · 5 · 2 · 1 |
| Actions | Set a device · in parallel · notify · if/otherwise · wait | 63 · 3 · 3 · 2 · 1 |
| Never | Rhai conditions, rule variables, cooldowns, run modes, priorities | — |

28 rules have one action; none nest deeper than one level.

**Half the rules are pairs or families of one intent.** One trigger per rule
forces it:

| Family | Rules | What it is really |
|---|---|---|
| Keypad lutron_72 Btn1–4 · On / Off | 8 | Four buttons, each toggling a set of lamps |
| LED sync · Btn1–4 LED on / off | 8 | Four keypad LEDs kept in step with lamps |
| Bathroom · Play Music on Close (Morning / Afternoon) | 2 | One door rule whose music depends on the time |
| OH1 Timer Close (Day) / Night | 2 | One rule with a time-dependent step |
| Startup Check · OH1 / Laundry / Garage Deck | 3 | Door rules re-checked when homeCore starts |

So 23 of 42 rules are 9 intents. People maintain them by keeping copies in
step by hand, and the names carry the distinction ("(Morning)", "Btn3").

**Names carry device ids** — "Keypad lutron_72" — because the rule itself
does: every reference is an id like
`hue_001788fffe6841b3_light_03113f8a_204d_4887_b9a0_00d385620886`. Any
screen that shows a rule must show names, from the house, not from the
rule's text.

**Tags are rooms.** 17 rules are tagged "living room", 11 "garage", 6
"bathroom"; only "door-alerts" and "startup" are something else. No rule
groups exist.

**If/otherwise is written in Rhai.** The one way to branch inside a rule
(`Conditional`) takes a script string: `device_state("yolink_…")["open"] ==
true`. A visual editor cannot build or read that without parsing Rhai.

**One rule is an alert in disguise.** "Door Alert - OH1 Open 10min"
(disabled) waits for a timer, re-checks the door and sends a Telegram
message — what an alert time rule (H4) now does without a rule.

**Rules name devices three ways.** By id, by name in rules
(`canonical_name`), or by plain name — homeCore resolves all three when it
loads a rule (`rule_resolver.rs`), and keeps the rule as written. Both "Play
Music on Close" rules send their "play a favourite" step to `bathroom`: not a
missing device, as this doc first said, but the Bathroom speaker's name in
rules (`sonos_bathroom` is its id). A screen that reads a rule must resolve
names the same way, or it reports working rules as broken.

**Fire history is good.** Each firing records the triggering event (device,
attribute, old and new value), every condition's result and every action's
outcome. "Why did it do that?" and "why didn't it?" are answerable from it —
the morning music rule's history shows the door closing at 05:04 and the
06:00–12:00 window saying no.

## 2. What the design must fix

1. **One intent, one automation.** On/off pairs, button toggles, time-of-day
   variants and start-up re-checks must each be one thing to read and change.
2. **Read as sentences, with the house's names.** In the list and in the
   editor: "When **Bathroom Door** opens → stop **Bathroom** speaker, start
   **Bathroom Exhaust** for 5 min."
3. **"When" and "only if" never confused.** The trigger is the moment; the
   conditions are checked at that moment. Each is visibly its own part.
4. **Why it did or didn't run, from its history** — the last firings, each
   expandable into what triggered it, which check failed, what each step did.
5. **Editing a working rule is safe.** Changes are a draft until saved; a
   test replays a real recent event without commanding the house.
6. **The rest of the model is reachable, not in the way.** Waits, loops,
   run modes, Rhai — there when needed, out of sight when not, always shown
   when a rule uses them.

## 3. The design

### The list (A2)

- Grouped by room (tag), then the rest; search finds rules by **device name**
  as well as by rule name, so "garage door" finds every rule that touches it.
- Each row is the rule in one line of words, its last firing ("12 min ago"),
  and its state: on, off, failing (an `error`), refers to something gone.
- Families detected (same trigger device and attribute, opposite values; or
  same everything but a time window) are shown together, with an offer to
  combine them (E4).
- Bulk: turn on or off, tag, delete, export.

### A rule, read (A2)

The sentence at the top; below it, its recent firings as a timeline — fired,
skipped (and which check said no), failed (which step) — and Test, which
replays the most recent real triggering event as a dry run (E6).

### The editor (A3)

Three parts, always in this order, each a list of sentence rows:

- **When** — one or more moments (E2). "Bathroom Door opens", "Keypad button
  1 is pressed", "at sunset", "homeCore starts and the door is already open".
- **Only if** — checks at that moment, all must pass; "any of" as a group.
  "Night Mode is on", "between 06:00 and 12:00".
- **Do** — steps in order: set a device, run a scene, notify, wait, and
  **if / otherwise** with structured checks (E3); "at the same time" groups.

Each row is built with pickers that speak the house: room → device → the
states it reports, in its own words from its schema ("opens", "is pressed",
"turns on") — the same source as round one's details. Values the device
declares (a Sonos favourite, a Lutron LED) are chosen, not typed.

**Patterns** (E5) start the common intents whole, from the house's own:
- **Keep in step** — "keypad LED 1 follows: any Living Room lamp is on".
- **A button toggles** — "button 1: if all are off, turn them on; otherwise
  off".
- **Off after a while** — "when the door opens, start a timer; when it ends,
  turn off".
- **At a sun event** — "at sunset, turn on the deck lights".

**More** (E7) holds run mode, cooldown, priority, logging, Rhai
expressions and variables — collapsed, unless the rule uses any of them.

**The text form** (T4, D13) is a second tab: the rule as JSON, editable,
round-tripping without loss; anything the visual editor can't draw is shown
as a block that opens the text form at that place.

## 4. What homeCore needs

| Change | Why |
|---|---|
| **Several triggers per rule** (`triggers`, `trigger` kept as one) | One intent, one rule (E2) |
| **Structured checks in if/otherwise** (`Conditional.condition` takes a `Condition` as well as Rhai text) | A visual if/otherwise (E3) |
| **"Also when homeCore starts, if already true"** on a device trigger | Replaces the start-up copies |
| **Rule change events** (`rule_changed`, `rule_removed`) | Two admins never overwrite each other unseen |
| **Test against a given event** (the test endpoint takes an event, e.g. one from history) | Replay a real firing safely (E6) |

All are additive: existing rule files keep loading unchanged.

---

## Decisions to make

**E1 — The editor's shape.**
(a) Sentences in three parts — When / Only if / Do — built with pickers.
(b) A node graph (Node-RED style).
(c) A form per rule kind.
*Recommend (a).* The house's rules are short sentences already; a graph
suits long flows the house doesn't have, and costs every simple rule a
canvas.

**E2 — Several triggers per rule** in homeCore. *Recommend yes.* It is what
turns 23 rules into 9.

**E3 — Structured if/otherwise** in homeCore, keeping Rhai text as an
option. *Recommend yes.*

**E4 — Combining families.** The list notices rules that look like one
intent and offers to combine them — previewed, never automatic.
*Recommend yes.*

**E5 — Patterns.** The four above, drawn from the house's rules, as starting
points; more added only when the house shows a need. *Recommend yes.*

**E6 — Drafts and tests.** Editing a rule makes a draft; Save replaces the
rule; Test replays a recent real event as a dry run, never commanding the
house. *Recommend yes.*

**E7 — Advanced options under More**, opened automatically when a rule uses
any. *Recommend yes.*

**E8 — Rules that are really alerts.** When a rule only notifies that a
state has lasted, the editor suggests an alert time rule instead (as "Door
Alert - OH1 Open 10min" is). *Recommend yes, as a suggestion.*

**E9 — Organising.** Tags are rooms in practice; groups are unused.
(a) Group the list by tag, edit tags as chips; keep groups only for turning
a set on and off.
(b) Group by the room of the trigger device, ignoring tags.
*Recommend (a)* — tags are what you already maintain, and a rule can
belong to two rooms.
