# 10 — Cut over

Status: **in progress** (A7) · 2026-10-17

T1 set round two's finish line: *nothing an admin needs is only in
hc-web-flutter.* This is that check — every feature the Flutter console has,
read from its source on 2026-10-17, and where it is now. Then how the house
moves.

---

## 1. Where everything went

✓ in the app · ◐ in the app, differently · — not carried (why)

### Getting around

| Flutter | Here |
|---|---|
| Nav rail, collapse, hub launcher, bottom bar | ✓ Sidebar and phone bar (round one, N1–N5) |
| Command palette (⌘K): places, devices, rules | ✓ Search (⌘K), and Settings' own search over every setting |
| Live dot, sign out | ✓ Header dot; Me → Sign out |
| Command-failed banner, optimistic commands rolled back | ✓ Round one's pending commands (P2) |
| Sign-in, refresh on 401, stay signed in | ✓ The UI server keeps the session (S4) |
| "Set as Home" landing page | — Home is the person's own (M2); hand-built pages stay in Flutter |

### The house

| Flutter | Here |
|---|---|
| Home: rooms, toggles, dimmers, locks, thermostats, scenes per room, arrange, hide rooms | ✓ Home and rooms (round one), Customise |
| Needs-attention strip | ✓ Alerts, and Settings' "needs attention" |
| Devices: search, group, sort, grid/table, filter chips, no-room, low battery | ✓ Settings → Devices (A1) |
| Device: controls, actions with parameters, readings, history (24 h – 30 d) | ✓ Details popup (round one) and Settings → device |
| Device: name, room, name in rules, used by, remove | ✓ Settings → device |
| Device: button names, "shown as" type, hardware, behind which device | ✓ Settings → device (added in A7) |
| Device: icon picker | — The app draws a device's icon from its kind; `status_icon` is Flutter's |
| Rooms: add, rename, devices in/out, delete | ✓ Settings → Rooms, with merge (A1) |
| Scenes: run, filter by source, editor, add attribute as JSON | ✓ Scenes; Settings → Scenes editor and delete (A1) |
| Modes: new, on/off, solar offsets, delete | ✓ Settings → Modes (A1) |
| Helpers: all eleven kinds, edit, delete | ✓ Settings → Helpers (A1) |
| Automations list: search, status, sort, groups by tag, enable, history, dry run, duplicate, delete, bulk | ✓ Settings → Automations (A2), in words |
| Rule groups: enable/disable all | ✓ Tag groups and homeCore's rule groups (A2) |
| Rule editor: every trigger, condition and action; run mode, cooldown, logging, required expression | ✓ The editor (A3) — and several moments per rule, checks in if/otherwise (E2, E3) |
| Stale rule references | ✓ Automations → needs attention, repoint a missing device (A2) |
| Events: live and history, device and type filters | ✓ Settings → Events, in words, noise folded (A6) |

### Plugins

| Flutter | Here |
|---|---|
| List, status, updates, registry install | ✓ Settings → Plugins, Add (A4) |
| Studio: start/stop/restart, enable, update, uninstall (keep config) | ✓ Plugin page (A4) |
| Actions with parameters, streamed progress, prompts, cancel, re-attach | ✓ (A4) |
| Settings form from the descriptor, raw TOML, secrets | ✓ (A4), saved as a patch so comments stay |
| Log level per plugin; its live log | ✓ (A4) |
| Plugin runtimes: approve, deny, join token | ✓ Settings → Plugins → Runtimes (A4) |
| Install "where should it run?" on a remote runtime | — Not yet: no house uses a remote runtime |
| Matter: commission, re-interview, remove | ✓ Matter panel (A4) |
| `/dev/config` Sonos preview | — A developer page |

### Running the system

| Flutter | Here |
|---|---|
| Users: add, role, password (own and others'), delete | ✓ Settings → People & access, Me → Password (A5) |
| API keys: list, new, copy once, revoke | ✓ And edit, new secret (A5) |
| Per-page dashboard access | — Hand-built pages stay in Flutter |
| System: status, versions, signed in as | ✓ Settings → System (A6) |
| "Show times in UTC" | — Times are shown in the house's time zone |
| Configuration: form, TOML, search, restart | ✓ Settings → Configuration (A0) |
| Configuration: reload from disk | ◐ Leaving and coming back reads it again |
| Notifications: channels, test | ✓ Settings → Notifications (A0) |
| Data: backup, restore, rules and scenes in and out, calendars | ✓ Settings → Data & backups (A6) — restore checked first, scenes import without doubling |
| Maintenance: orphaned and unclaimed devices, bulk delete | ✓ Settings → Devices (A1) |
| Audit: filters, denied only, search, details | ✓ Settings → Audit, as sentences (A6) |
| Logs: live, level, module filter, copy a line, log-level dialog | ✓ Settings → Logs and System (A6) |
| Logs: the browser's own failed requests ("client errors") | — A developer aid |

### Left in Flutter on purpose (T2, T8)

Hand-built pages and their designer, page templates, import/export of pages,
Files (pictures and fonts for pages), skins (themes replace them, D9a), Media,
Cameras and the camera wall. The Flutter console keeps serving these until
round three builds pages properly.

---

## 2. How the house moves

The house runs the stack under Dockhand on 10.0.10.150, host networking,
from `/opt/stacks/homecore/compose.host.yml`. Dockhand itself holds port
3000; the Flutter console is on **3001**, which the household knows.

Decided 2026-10-17: the new app takes **3001** at once, and Flutter moves to
**3002** for hand-built pages only.

1. **homeCore's release** — A3–A6 (several moments per rule, checks in
   if/otherwise, rule events, plugin fixes, the household-member role, the
   full audit, staged restore, the calendar fix). Release-notes entry first;
   tag only after CI is green.
2. **The app's first release** — `redesign` becomes the app's `main`; tag
   `v0.1.0`, which publishes `ghcr.io/homecore-io/hc-web-svelte:0.1.0` and
   `:latest`.
3. **The stack** — the docker repo's compose files gain the app (its
   defaults: app 3000, Flutter 3001); the house's own `compose.host.yml` sets
   app 3001, Flutter 3002, since Dockhand owns 3000. Then redeploy from
   Dockhand.
4. **The try-out** — a week of running the house from the new app alone (08,
   A7). Anything that sends someone back to Flutter goes on this list.
