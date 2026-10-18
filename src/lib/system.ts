/**
 * Running the system (A6): homeCore's log level in words, its log lines by
 * where they came from, the house's events in words with the noise folded,
 * and the audit as sentences — grouped, so a month of sign-ins is one line.
 */
import { reading } from './card.js';
import { byWhom } from './activity.js';
import { pluginLabel } from './inventory.js';
import { roleName } from './people.js';
import type { Change, Schema } from './devices.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

// ---- the log level ----

/** What keeps the broker quiet; homeCore adds it to `[logging].level` itself. */
export const BROKER_QUIET = ['rumqttc::state=info', 'rumqttd=info'];
const LEVEL_WORDS = ['error', 'warn', 'info', 'debug', 'trace'];

export type Preset = 'quiet' | 'normal' | 'detailed';

export const PRESETS: { id: Preset; label: string; level: string; what: string }[] = [
	{ id: 'quiet', label: 'Quiet', level: 'warn', what: 'Warnings and errors only.' },
	{
		id: 'normal',
		label: 'Normal',
		level: 'info',
		what: 'What homeCore and its plugins do, as it happens.'
	},
	{
		id: 'detailed',
		label: 'Detailed',
		level: 'debug',
		what: 'Everything, for chasing a problem. Turn it back down afterwards.'
	}
];

/** The directive a preset sends — its level, with the broker kept quiet. */
export const directiveOf = (p: Preset) =>
	[PRESETS.find((x) => x.id === p)!.level, ...BROKER_QUIET].join(',');

export interface LevelReading {
	/** The preset it amounts to, or null for anything else. */
	preset: Preset | null;
	/** The level everything not named gets. */
	level: string | null;
	/** Something worth saying about how it's written, if anything. */
	note: string | null;
}

/** What a directive string amounts to. */
export function readLevel(directive: string): LevelReading {
	const parts = directive
		.split(',')
		.map((p) => p.trim())
		.filter(Boolean);
	const bare = parts.filter((p) => LEVEL_WORDS.includes(p.toLowerCase()));
	const targeted = parts.filter((p) => !bare.includes(p));
	const level = bare.length ? bare[bare.length - 1]!.toLowerCase() : null;
	const onlyBroker = targeted.every((t) => BROKER_QUIET.includes(t));
	const preset = PRESETS.find((p) => p.level === level)?.id ?? null;
	let note: string | null = null;
	if (bare.length > 1)
		note = `It says ${bare.map((b) => `“${b}”`).join(' and then ')} for everything — the last one wins, so it is really ${level}.`;
	else if (!onlyBroker)
		note = `Some parts of homeCore are set apart: ${targeted.filter((t) => !BROKER_QUIET.includes(t)).join(', ')}.`;
	else if (!BROKER_QUIET.every((b) => parts.includes(b)) && level && level !== 'info')
		note = 'The broker isn’t kept quiet, so it says a lot.';
	return { preset: bare.length === 1 && onlyBroker ? preset : null, level, note };
}

/**
 * A directive as homeCore's settings keep it: `[logging] level` and, per
 * module, `[logging.targets]` — "info,hc_core::engine=debug" is level info
 * and hc_core::engine at debug. Null when it says no level for everything.
 */
export function keptOf(
	directive: string
): { level: string; targets: Record<string, string> } | null {
	const parts = directive
		.split(',')
		.map((p) => p.trim())
		.filter(Boolean);
	const bare = parts.filter((p) => LEVEL_WORDS.includes(p.toLowerCase()));
	const level = bare.at(-1)?.toLowerCase();
	if (!level) return null;
	const targets: Record<string, string> = {};
	for (const p of parts) {
		const i = p.indexOf('=');
		if (i <= 0) continue;
		const lvl = p
			.slice(i + 1)
			.trim()
			.toLowerCase();
		if (LEVEL_WORDS.includes(lvl)) targets[p.slice(0, i).trim()] = lvl;
	}
	return { level, targets };
}

// ---- log lines ----

export interface LogLine {
	timestamp: string;
	level: string;
	target: string;
	message: string;
	fields?: Record<string, unknown>;
}

export const LOG_LEVELS = [
	{ id: 'error', label: 'Errors' },
	{ id: 'warn', label: 'Warnings and worse' },
	{ id: 'info', label: 'Info and worse' },
	{ id: 'debug', label: 'Everything' }
] as const;

/** Where a line came from, as a person names it. */
export function sourceOf(l: LogLine): string {
	const plugin = l.fields?.plugin_id;
	if (typeof plugin === 'string') return pluginLabel(plugin);
	// A library's line bridged from `log` carries its real target in a field.
	const target =
		l.target === 'log' && typeof l.fields?.['log.target'] === 'string'
			? (l.fields['log.target'] as string)
			: l.target;
	if (/^rumqtt/.test(target)) return 'the broker';
	if (/^(hc_|homecore)/.test(target) || target === 'log') return 'homeCore';
	return target.split('::')[0] ?? target;
}

/** A line's detail: where in the code, and its fields. */
export function detailOf(l: LogLine): string {
	const fields = Object.entries(l.fields ?? {})
		.filter(([k]) => k !== 'plugin_id' && k !== 'message')
		.map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`);
	return [...fields, l.target].join(' · ');
}

/** Whether a line is at `min` or worse. */
export function atLeast(level: string, min: string): boolean {
	const order = ['error', 'warn', 'info', 'debug', 'trace'];
	return order.indexOf(level.toLowerCase()) <= order.indexOf(min);
}

// ---- events, in words ----

export type EventKind = 'device' | 'rule' | 'command' | 'timer' | 'scene' | 'system' | 'warn';

export interface EventRow {
	key: string;
	at: string;
	kind: EventKind;
	/** Words, with names to show strong. */
	words: { t: string; strong?: boolean }[];
	room?: string;
	/** How many this row stands for, when folded. */
	count?: number;
	href?: string;
}

export interface EventHouse {
	name(id: string): string | undefined;
	schema(id: string): Schema | undefined;
	room(id: string): string | undefined;
}

const s = (t: string) => ({ t, strong: true });
const p = (t: string) => ({ t });

/** Attributes that move without anyone doing anything — folded by default. */
export const NOISY =
	/^(rssi|lqi|signal|uptime|battery_volts|remaining_secs|power|current|voltage|energy|watts?)$|^last_|position|duration|elapsed|_ms$|_at$|_w$|_kwh$|_v$|_a$|screensaver/;

/** One event in words, or nothing for one that says nothing a person needs. */
export function eventRow(e: Json, house: EventHouse): EventRow | undefined {
	const at: string = e.timestamp ?? '';
	const name = (id: string, given?: string) => given ?? house.name(id) ?? id;
	const base = { at, room: e.device_id ? house.room(e.device_id) : undefined };
	switch (e.type) {
		case 'device_state_changed': {
			const schema = house.schema(e.device_id) ?? { attributes: {} };
			const changed: string[] = e.changed ?? [];
			const said = changed
				.map((a) => {
					const v = reading(e.current ?? {}, schema as Schema, a);
					if (v === undefined) return undefined;
					return typeof e.current?.[a] === 'boolean' ? v.toLowerCase() : `${label(a)} ${v}`;
				})
				.filter((x): x is string => !!x);
			if (!said.length) return undefined;
			const who = byWhom(e.change as Change | undefined);
			return {
				...base,
				key: `d:${e.device_id}:${changed.join(',')}`,
				kind: 'device',
				words: [
					s(name(e.device_id, e.device_name)),
					p(` — ${said.join(', ')}`),
					...(who ? [p(` · ${who}`)] : [])
				],
				href: `/settings/devices/${encodeURIComponent(e.device_id)}`
			};
		}
		case 'device_availability_changed':
			return {
				...base,
				key: `a:${e.device_id}`,
				kind: e.available ? 'device' : 'warn',
				words: [s(name(e.device_id, e.device_name)), p(e.available ? ' is back' : ' went offline')]
			};
		case 'rule_fired':
			return {
				...base,
				key: `r:${e.rule_id}`,
				kind: 'rule',
				words: [p('Rule '), s(e.rule_name || e.rule_id), p(' ran')],
				href: `/settings/automations/${encodeURIComponent(e.rule_id)}`
			};
		case 'action_failed':
			return {
				...base,
				key: `f:${e.rule_id}`,
				kind: 'warn',
				words: [
					p('Rule '),
					s(e.rule_name || e.rule_id),
					p(` couldn’t do step ${(e.action_index ?? 0) + 1}: ${e.error}`)
				],
				href: `/settings/automations/${encodeURIComponent(e.rule_id)}`
			};
		case 'device_command_sent': {
			const cmd =
				e.command && typeof e.command === 'object'
					? Object.entries(e.command as Record<string, unknown>)
							.filter(([k]) => !k.startsWith('_'))
							.map(([k, v]) => (k === 'action' ? String(v) : `${label(k)} ${String(v)}`))
							.join(', ')
					: String(e.command);
			return {
				...base,
				key: `c:${e.device_id}`,
				kind: 'command',
				words: [p('Sent to '), s(name(e.device_id, e.device_name)), p(`: ${cmd}`)]
			};
		}
		case 'scene_activated':
			return {
				...base,
				key: `s:${e.scene_id}`,
				kind: 'scene',
				words: [p('Scene '), s(e.scene_name), p(' ran')]
			};
		case 'mode_changed':
			return {
				...base,
				key: `m:${e.mode_id}`,
				kind: 'system',
				words: [s(e.mode_name), p(e.on ? ' began' : ' ended')]
			};
		case 'timer_state_changed': {
			const n = e.timer_name ?? name(e.timer_id);
			const st = String(e.state ?? '');
			const what =
				st === 'running' && e.remaining_secs
					? ` started — ${minutes(e.remaining_secs)}`
					: st === 'finished' || st === 'idle'
						? ' finished'
						: ` ${st}`;
			return { ...base, key: `t:${e.timer_id}`, kind: 'timer', words: [s(n), p(what)] };
		}
		case 'device_battery_low':
			return {
				...base,
				key: `b:${e.device_id}`,
				kind: 'warn',
				words: [
					s(name(e.device_id, e.device_name)),
					p(` battery low — ${Math.round(e.battery_pct)}%`)
				]
			};
		case 'alert_raised':
			return {
				...base,
				key: `al:${e.alert?.id}`,
				kind: 'warn',
				words: [p(e.alert?.message ?? 'An alert')]
			};
		case 'device_schema_changed':
			return {
				...base,
				key: `sc:${e.device_id}`,
				kind: 'system',
				words: [s(name(e.device_id)), p(' re-declared its controls')]
			};
		case 'plugin_status_changed':
			return {
				...base,
				key: `p:${e.plugin_id}`,
				kind: e.status === 'active' ? 'system' : 'warn',
				words: [p('Plugin '), s(pluginLabel(e.plugin_id)), p(` is ${e.status}`)]
			};
		case 'system_alert':
			return { ...base, key: `sys:${e.message}`, kind: 'warn', words: [p(e.message)] };

		// ---- things added, changed, removed (0.1.x had no words for these) ----
		case 'device_added': {
			const id = e.device?.device_id ?? '';
			return {
				...base,
				room: house.room(id),
				key: `da:${id}`,
				kind: 'device',
				words: [s(e.device?.name_override ?? e.device?.name ?? name(id)), p(' was added')],
				href: `/settings/devices/${encodeURIComponent(id)}`
			};
		}
		case 'device_removed':
			return {
				...base,
				key: `dr:${e.device_id}`,
				kind: 'device',
				words: [s(name(e.device_id)), p(' was removed')]
			};
		case 'device_name_changed':
			return {
				...base,
				key: `dn:${e.device_id}`,
				kind: 'device',
				words: [s(e.previous_name ?? name(e.device_id)), p(' is now called '), s(e.current_name)],
				href: `/settings/devices/${encodeURIComponent(e.device_id)}`
			};
		case 'device_metadata_changed': {
			const id = e.device?.device_id ?? '';
			return {
				...base,
				room: house.room(id),
				key: `dm:${id}`,
				kind: 'device',
				words: [s(e.device?.name_override ?? e.device?.name ?? name(id)), p('’s details changed')],
				href: `/settings/devices/${encodeURIComponent(id)}`
			};
		}
		case 'device_battery_recovered':
			return {
				...base,
				key: `br:${e.device_id}`,
				kind: 'device',
				words: [
					s(name(e.device_id, e.device_name)),
					p(` battery is fine again — ${Math.round(e.battery_pct)}%`)
				]
			};
		case 'alert_cleared':
			return {
				...base,
				key: `ac:${e.alert_id}`,
				kind: 'device',
				words: [s(name(e.device_id)), p(' no longer needs attention')]
			};
		case 'room_changed':
			return {
				...base,
				key: `rc:${e.room?.id}`,
				kind: 'system',
				words: [p('Room '), s(e.room?.name ?? 'a room'), p(' changed')]
			};
		case 'room_removed':
			return {
				...base,
				key: `rr:${e.room_id}`,
				kind: 'system',
				words: [p(e.merged_into ? 'A room was merged into another' : 'A room was removed')]
			};
		case 'scene_changed':
			return {
				...base,
				key: `scc:${e.scene?.id}`,
				kind: 'scene',
				words: [p('Scene '), s(e.scene?.name ?? 'a scene'), p(' changed')]
			};
		case 'scene_removed':
			return {
				...base,
				key: `scr:${e.scene_id}`,
				kind: 'scene',
				words: [p('A scene was removed')]
			};
		case 'rule_changed':
			return {
				...base,
				key: `rch:${e.rule?.id}`,
				kind: 'rule',
				words: [p('Rule '), s(e.rule?.name ?? 'a rule'), p(' changed')],
				href: e.rule?.id ? `/settings/automations/${encodeURIComponent(e.rule.id)}` : undefined
			};
		case 'rule_removed':
			return {
				...base,
				key: `rrm:${e.rule_id}`,
				kind: 'rule',
				words: [p('A rule was deleted')]
			};
		case 'rule_evaluation_failed':
			return {
				...base,
				key: `ref:${e.rule_id}`,
				kind: 'warn',
				words: [
					p('Rule '),
					s(e.rule_name || e.rule_id),
					p(` couldn’t check whether to run: ${e.reason ?? 'no reason given'}`)
				],
				href: `/settings/automations/${encodeURIComponent(e.rule_id)}`
			};
		case 'plugin_registered':
			return {
				...base,
				key: `pr:${e.plugin_id}`,
				kind: 'system',
				words: [p('Plugin '), s(pluginLabel(e.plugin_id)), p(' connected')]
			};
		case 'plugin_offline':
			return {
				...base,
				key: `po:${e.plugin_id}`,
				kind: 'warn',
				words: [p('Plugin '), s(pluginLabel(e.plugin_id)), p(' went offline')]
			};
		case 'plugin_capabilities':
			return {
				...base,
				key: `pc:${e.plugin_id}`,
				kind: 'system',
				words: [p('Plugin '), s(pluginLabel(e.plugin_id)), p(' re-declared what it can do')]
			};
		// homeCore's own housekeeping (a schedule's tick, a run asked for, a
		// plugin saying it's still there): not news.
		case 'custom':
		case 'plugin_heartbeat':
		// The stream's own frames: the house as it stands, or "you fell behind".
		case 'snapshot':
		case 'lagged':
			return undefined;
		default:
			return {
				...base,
				key: `?:${e.type}`,
				kind: 'system',
				words: [p(String(e.type ?? 'something').replace(/_/g, ' '))]
			};
	}
}

/**
 * Fold the noise: a reading that changes all the time becomes one line per
 * device and reading ("power — 30 in 9 minutes"), and controls a device
 * keeps re-declaring become one warning. Everything else stands.
 */
export function folded(rows: EventRow[], noisy: (r: EventRow) => boolean): EventRow[] {
	const out: EventRow[] = [];
	const groups = new Map<string, EventRow>();
	for (const r of rows) {
		const fold = noisy(r) || r.key.startsWith('sc:');
		if (!fold) {
			out.push(r);
			continue;
		}
		const g = groups.get(r.key);
		if (g) {
			g.count = (g.count ?? 1) + 1;
			continue;
		}
		const first = { ...r, count: 1 };
		groups.set(r.key, first);
		out.push(first);
	}
	for (const g of groups.values()) {
		const n = g.count ?? 1;
		if (g.key.startsWith('sc:')) {
			if (n < 2) continue;
			g.kind = 'warn';
			g.words = [...g.words.slice(0, 1), p(` re-declared its controls ${n} times`)];
		} else {
			// A reading's value is the noise; say what moved, and how often.
			const attrs = g.key.split(':').slice(2).join(':').split(',').filter(Boolean);
			g.words = [
				...g.words.slice(0, 1),
				p(` — ${attrs.map(label).join(', ')} changed${n > 1 ? ` ${n} times` : ''}`)
			];
		}
	}
	return out;
}

/** Whether a device row is only noisy readings. */
export const onlyNoise = (e: Json) =>
	e?.type === 'device_state_changed' &&
	(e.changed ?? []).length > 0 &&
	(e.changed as string[]).every((a) => NOISY.test(a));

function label(name: string): string {
	const w = name.replace(/_(pct|secs|w)$/, '').replace(/[_.]+/g, ' ');
	return w[0]!.toUpperCase() + w.slice(1);
}

const minutes = (secs: number) => (secs >= 60 ? `${Math.round(secs / 60)} min` : `${secs} s`);

// ---- the audit, in words ----

export interface AuditEntry {
	id: number;
	ts: string;
	actor_type: string;
	actor_id: string | null;
	actor_label: string;
	event_type: string;
	target_kind: string | null;
	target_id: string | null;
	ip: string | null;
	user_agent: string | null;
	result: 'success' | 'denied' | 'error';
	detail: Record<string, unknown>;
}

/** Who did it, as a person names them. */
export function whoOf(a: AuditEntry): string {
	const l = a.actor_label;
	if (a.actor_type === 'system') return 'homeCore';
	if (a.actor_type === 'local_admin') return 'the admin console';
	if (a.actor_type === 'ip_whitelist') return 'a trusted address';
	if (l.startsWith('user:')) return l.slice(5);
	if (l.startsWith('api_key:')) return `the key “${l.slice(8)}”`;
	if (l.startsWith('attempted_username:')) return `someone as “${l.slice(19)}”`;
	return l || 'someone';
}

const THING: Record<string, string> = {
	automation: 'the rule',
	automation_group: 'the rule group',
	device: 'the device',
	helper: 'the helper',
	mode: 'the mode',
	area: 'the room',
	scene: 'the scene',
	alert_rule: 'the alert rule',
	plugin: 'the plugin',
	plugin_runtime: 'a plugin runtime',
	calendar: 'the calendar',
	api_key: 'the API key',
	display: 'the display',
	user: 'the account'
};

const VERB: Record<string, string> = {
	created: 'made',
	updated: 'changed',
	deleted: 'removed',
	removed: 'removed',
	copied: 'copied',
	imported: 'imported',
	revoked: 'revoked',
	rotated: 'gave a new secret to',
	installed: 'installed',
	started: 'started',
	stopped: 'stopped',
	restarted: 'restarted',
	uninstalled: 'removed',
	enabled: 'turned on',
	disabled: 'turned off',
	merged: 'merged',
	fetched: 'added',
	uploaded: 'uploaded',
	approved: 'let in',
	denied: 'turned away'
};

/** One audit entry as a sentence: who, then what they did to what. */
export function auditWords(a: AuditEntry): { t: string; strong?: boolean }[] {
	const who = s(whoOf(a));
	const d = a.detail ?? {};
	const looksLikeId = (x: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(x);
	const name =
		typeof d.name === 'string'
			? d.name
			: typeof d.label === 'string'
				? d.label
				: a.target_id && !looksLikeId(a.target_id) && a.target_kind !== 'system'
					? a.target_id
					: undefined;
	const named = (thing: string) => (name ? [p(` ${thing} `), s(name)] : [p(` ${thing}`)]);
	const ok = a.result === 'success';
	const [area = '', verb = ''] = a.event_type.split(/\.(.*)/s);
	switch (a.event_type) {
		case 'auth.login':
			return ok ? [who, p(' signed in')] : [who, p(' couldn’t sign in — wrong password')];
		case 'auth.refresh':
			return [who, p(' kept a session going')];
		case 'auth.refresh.reuse':
			return [who, p('’s old session was used again, and refused')];
		case 'auth.pin_session':
			return [who, p(' unlocked a display with their PIN')];
		case 'auth.pin_failed':
			return [p('A wrong PIN at a display')];
		case 'user.password_changed':
			return [who, p(' changed their password')];
		case 'user.password_reset':
			return [who, p(' set a new password for an account')];
		case 'user.role_changed':
			return [
				who,
				p(
					` changed someone from ${roleName(String(d.from ?? '')).toLowerCase()} to ${roleName(String(d.to ?? '')).toLowerCase()}`
				)
			];
		case 'user.pin_set':
			return [who, p(' set their PIN')];
		case 'user.pin_cleared':
			return [who, p(d.by_admin ? ' cleared someone’s PIN' : ' removed their PIN')];
		case 'user.created':
			return [who, p(' added an account')];
		case 'user.deleted':
			return [who, p(' removed an account')];
		case 'automation.bulk_changed':
			return [who, p(` changed ${String(d.count ?? 'several')} rules at once`)];
		case 'device.bulk_updated':
			return [who, p(` moved ${String(d.count ?? 'several')} devices`)];
		case 'device.bulk_deleted':
			return [who, p(` removed ${String(d.count ?? 'several')} devices`)];
		case 'area.devices_set':
			return [who, p(' changed which devices are in'), ...named('the room')];
		case 'plugin.config_updated':
			return [who, p(' changed the settings of'), ...named('the plugin')];
		case 'plugin.action_run':
			return [who, p(` ran “${String(d.action ?? 'an action')}” on`), ...named('the plugin')];
		case 'plugin.devices_removed':
			return [who, p(' removed the devices of'), ...named('the plugin')];
		case 'plugin.log_level_changed':
			return [who, p(' changed how much'), ...named('a plugin'), p(' logs')];
		case 'plugin_runtime.token_issued':
			return [who, p(' made a join token for a plugin runtime')];
		case 'system.log_level_changed':
			return [who, p(` set homeCore’s log to “${String(d.level ?? '')}”`)];
		case 'system.config_updated':
			return [who, p(' changed homeCore’s settings')];
		case 'system.backup_created':
			return [who, p(' took a backup')];
		case 'system.restore_staged':
			return [who, p(' put a backup in place for the next restart')];
		case 'system.restore_completed':
			return ok
				? [who, p(' started from a restored backup')]
				: [who, p(' couldn’t put a restored backup in place')];
		case 'system.restart_requested':
			return [who, p(' restarted homeCore')];
		case 'notify.test':
			return [who, p(' sent a test notification')];
		case 'api_key.created':
			return [who, p(' made'), ...named('the API key')];
		case 'display.created':
			return [who, p(' set up'), ...named('the display')];
	}
	const thing = THING[thingOf(a, area)];
	if (thing && verb === 'updated') {
		if (typeof d.enabled === 'boolean' && (d.fields as string[] | undefined)?.length === 1)
			return [who, p(d.enabled ? ' turned on' : ' turned off'), ...named(thing)];
		if (typeof d.renamed_to === 'string')
			return [who, p(' renamed'), ...named(thing), p(' to '), s(d.renamed_to)];
	}
	const v = VERB[verb];
	if (thing && v) return [who, p(` ${v}`), ...named(thing)];
	return [who, p(` — ${a.event_type}`)];
}

function thingOf(a: AuditEntry, area: string): string {
	if (area === 'helper' || area === 'mode') return area;
	return a.target_kind ?? area;
}

export type AuditFilter = 'all' | 'changes' | 'signins' | 'refused';

export function auditMatches(a: AuditEntry, f: AuditFilter): boolean {
	const signin = /^auth\./.test(a.event_type);
	if (f === 'signins') return signin;
	if (f === 'refused') return a.result !== 'success';
	if (f === 'changes') return !signin && a.result === 'success';
	return true;
}

export interface AuditRow {
	key: string;
	first: AuditEntry;
	/** Every entry this row stands for, newest first. */
	all: AuditEntry[];
}

/**
 * Group repeats: the same person doing the same routine thing (signing in,
 * keeping a session) on the same day is one row. Changes always stand alone.
 */
export function auditRows(entries: AuditEntry[], tz?: string): AuditRow[] {
	const day = (ts: string) => new Date(ts).toLocaleDateString('en-CA', { timeZone: tz });
	const routine = (a: AuditEntry) =>
		a.event_type === 'auth.login' || a.event_type === 'auth.refresh';
	const out: AuditRow[] = [];
	for (const a of entries) {
		const key = `${a.event_type}|${a.actor_label}|${a.result}|${day(a.ts)}`;
		const last = out[out.length - 1];
		if (last && routine(a) && last.key === key) {
			last.all.push(a);
			continue;
		}
		out.push({ key, first: a, all: [a] });
	}
	return out;
}
