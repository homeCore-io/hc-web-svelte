# 08 — Round two plan: administration

Status: **decided** — see `decisions.md` (T1–T10, all as recommended) · 2026-10-16

Round one built the household side (R0–R7). It replaces nothing: there is no
way to write an automation, manage a plugin, add a user or back up the house
without `hc-web-flutter`. Round two is **administration**: the parts of
Settings that N1 promised, until the Flutter console has nothing left that
only it does.

---

## 1. What the Flutter console does today

From an inventory of `clients/hc-web-flutter` (`develop`, hc-web 0.1.94,
about 111k lines of Dart). Sizes are its own, as a rough guide to weight, not
a target — most of it is not carried over (no code is).

| Area | What an admin does | Flutter size | Weight |
|---|---|---|---|
| **Automations** | List, search, bulk enable/disable, clone, delete, groups; a sentence editor over nested triggers, conditions and actions with device pickers and Rhai; dry-run test; fire history; stale-reference warnings | 14.4k | **Heavy** — the main editor |
| **Plugins** | Live status, enable/disable, start/stop/restart, log level, deregister; config by descriptor form, schema form or raw TOML; plugin actions with streamed progress; registry install; discovery | 9.2k | **Heavy** — a generic form engine |
| Plugin runtimes | Approve or deny remote runtime machines; placements | 0.4k | Light |
| **Devices** | Filtered list; a detail sheet with every control, readings, scenes it's in, history, rename/room, delete | 7.1k | Medium — round one already has most of this |
| Scenes | List, activate, edit devices and target states | 1.2k | Medium |
| Modes | Toggle, solar offsets, create, delete | 0.5k | Light |
| Helpers | Timers, switches, counters, flags, groups: create, configure, delete | 1.5k | Medium |
| Areas | Rooms: create, rename, delete, assign devices | 1.0k | Done in R5 except delete/merge |
| Users & access | Users, roles, passwords, API keys (create, revoke, rotate), page access | 1.1k | Medium |
| Configuration | `homecore.toml` by descriptor form, or raw TOML | 1.0k | Light — same form engine as plugins |
| Notifications | Notify channels, send a test | 0.7k | Light |
| Data & backups | Backup download, restore; automations and scenes import/export; calendars | 0.5k | Light, but restore is dangerous |
| Maintenance | Orphaned devices, bulk delete; restart | 0.4k | Light |
| System | Health, versions, log level | 0.6k | Light |
| Audit | Filtered audit log in words | 0.8k | Light |
| Logs | Live log tail with filters | 0.5k | Light |
| Events | Live event feed and history | 0.8k | Light |
| Pages designer | Visual page builder: grid and free layers, inspector, bindings, floor plans, templates, import/export | **41k** | **Very heavy** |
| Appearance | Skin editor | 2.2k | Replaced by themes (D9a) |
| Files | Upload and manage images and fonts | 0.8k | Only needed with hand-built pages |
| Media, Cameras | Now playing by speaker group; a camera wall stored as a dashboard | 2.0k | Household features |

homeCore features with **no UI anywhere** today: mode definitions, room
merge, Matter commissioning, purging a plugin's devices, plugin-runtime
enrollment tokens, calendar events, editing an API key.

## 2. Scope

**In round two** (recommended — T2, T8):
- Every row above marked Heavy, Medium or Light except the Pages designer,
  Appearance, Files, Media and Cameras.
- The homeCore features with no UI, where they belong to an area being built.
- **A household-member role** in homeCore (T5): family accounts that can use
  the house without being able to edit it.
- **Shipping the app** as a container next to homeCore's (T9), so it can
  become the house's admin console at the end of the round.

**Left for round three:** hand-built pages and the canvas (D4), with Files;
per-size adjustments (D5); customised details popups (D3); third-party cards
(D9b); permissions by room and device (the rest of H6).

## 3. How it is built

- **One design system.** Admin screens use round one's tokens and components.
  Settings grows the two groups the Flutter console already found useful:
  **House** (devices, rooms, scenes, modes, helpers, automations, alerts,
  displays) and **System** (plugins, users and access, configuration,
  notifications, data and backups, maintenance, logs, audit, events).
- **Denser on large screens.** Admin is mostly done at a desk: list and detail
  side by side on desktop, the detail as its own page on a phone. Every admin
  screen still works on a phone.
- **Generated wherever homeCore describes itself.** homeCore already
  describes its config (`/system/config/descriptor`), each plugin's config
  (`/plugins/{id}/config/descriptor`), the rule vocabulary
  (`/automations/vocabulary`) and every device's schema. One form engine
  renders descriptors for system config, plugin config and notification
  channels; the rule editor's pickers come from the vocabulary and schemas —
  the same approach that made round one's details generated (D3).
- **Every admin change is announced.** Round one made house facts live
  (H2). Admin screens follow events too — rules, plugins, users — so two
  admins never overwrite each other unseen. Where homeCore has no event yet
  (rules, plugins, users), adding it is part of that milestone.
- **Dangerous actions say what they will do.** Restore, delete, restart,
  deregister: a confirmation in the page (not a browser dialog) that names
  what is lost.

## 4. Milestones

Proposed order (T7). Each ends with a try-out, checked as in round one, plus
T10's rule for where admin changes are tried.

### A0 — The admin frame
Settings' House and System groups; list-and-detail on desktop; the in-page
confirmation; **the descriptor form engine**, proven on Configuration
(`homecore.toml`) and Notifications.
*Try it:* change a config value and a notify channel; send a test notification.

### A1 — The house model
Devices admin (delete, orphans, bulk delete, history), Scenes editor, Modes
(including definitions and solar offsets), Helpers, room delete and merge.
*Try it:* build a scene, add a timer helper, merge a duplicate room.

### A2 — Automations, read and manage
The list (search, filters, groups, bulk enable/disable, clone, delete), each
rule **shown in words**, fire history, stale references, dry-run test, import
and export.
*Try it:* find every rule that touches the garage; disable a group; test one.

### A3 — Automations, write
The editor (T3, T4): triggers, conditions, actions; pickers from the
vocabulary and device schemas; the text form beside it, round-tripping
losslessly (D13).
*Try it:* write a new rule and change an existing one in both forms.

### A4 — Plugins
List and live status, start/stop/restart, log level, enable/disable,
deregister and purge; config by the A0 form engine, with raw TOML; plugin
actions with progress; registry install; discovery; plugin runtimes; Matter
commissioning.
*Try it:* change a plugin's setting and restart it; install one from the
registry.

### A5 — People and access
Users, roles, passwords, API keys (with edit), PIN reset; **the household
member role** (H6a, T5) in homeCore.
*Try it:* give each family member an account; sign in as one on their phone.

### A6 — Running the system
Health and versions, log level, live logs, events, audit in words, backup
and restore, calendars, restart.
*Try it:* take a backup; find yesterday's changes in the audit.

### A7 — Cut over
The app's container release and its place next to homeCore's (T9); the
Flutter console frozen, with a list of anything it still does that this app
doesn't; the household moves to the new app.
*Try it:* a week of running the house from the new app alone.

---

## Decisions to make

**T1 — Round two's goal is replacing the Flutter console for administration.**
*Recommend yes.* Measured by A7's list: nothing an admin needs is only in
Flutter.

**T2 — The pages designer.** Flutter's is its largest part (41k lines), and
the house's existing pages are made with it (and with hc-web-lit).
(a) Round three, as S6 planned: Flutter keeps running for pages only until
then.
(b) Round two, before the cut-over.
*Recommend (a).* Administration is what blocks daily use; pages have the
generated home as a stand-in, and doing pages properly (D4's grid and canvas,
D13's text editor) is a round of its own.

**T3 — How the automation editor is designed.**
(a) Follow Flutter's sentence editor, re-made in this design system.
(b) A design pass first — a doc and mockups (09) before A3 — over what
people get wrong in rules today, then build.
(c) Text-first: the JSON form with good validation, a visual editor later.
*Recommend (b).* It is the most-used admin screen and the hardest; round one
showed that agreeing the design first is what keeps an editor from being
rebuilt (the brief's lesson from hc-web-lit).

**T4 — The rule editor's text form.** Rules are stored as RON files; the API
speaks JSON; M7 chose JSON for the advanced editor.
(a) JSON, as M7 says; RON stays the storage format, viewable read-only.
(b) RON, matching the files on disk.
*Recommend (a).*

**T5 — Permissions in round two.** Today "User" can also rename rooms, edit
shared pages and write rules; "Device operator" can't run scenes. Neither
fits a family member.
(a) A **household member** role in homeCore — operate devices, run scenes,
personalise; no authoring — and room/device scoping in round three.
(b) The whole of H6 (scoping by room and device) in round two.
(c) None; family members use "User".
*Recommend (a).* Small, unblocks family accounts in A5; scoping is a bigger
design that displays and pages both feed into.

**T6 — One descriptor form engine** for system config, plugin config and
notification channels, generated from homeCore's descriptors.
*Recommend yes*, built in A0 and proven on the two smallest cases before
plugins depend on it.

**T7 — The order.** A0 frame → A1 house model → A2–A3 automations → A4
plugins → A5 people → A6 system → A7 cut-over. The alternative is plugins
before automations (A4 first), since plugin config is what most often sends
someone to the Flutter console today.
*Recommend as written* — but you know which you open Flutter for most.

**T8 — What isn't carried over.** The skin editor (replaced by themes, D9a),
the Media page and the camera wall.
(a) Drop all three; media and cameras return as cards in round three's pages.
(b) Keep the camera wall in round two.
*Recommend (a)*, unless the camera wall is used daily.

**T9 — Shipping the app.** It has a Dockerfile but no CI or release.
(a) CI and a container release in A0, deployed next to homeCore as each
milestone lands, behind a different port until A7.
(b) Only at A7.
*Recommend (a)*: the household can start using it as soon as round one's
side is there, and A7 isn't a big bang.

**T10 — Where admin changes are tried.** Round one's try-outs pressed real
buttons; admin try-outs edit rules, restart plugins and restore backups.
(a) On the live house, as round one — with a backup before each try-out.
(b) A standing sandbox homeCore with a copy of the house's rules and config
(no plugins connected) for A1–A4 and A6, and the live house only for the
final try-out of each.
*Recommend (b).* A rule edited wrongly acts on the house; a restore done
wrongly loses it.
