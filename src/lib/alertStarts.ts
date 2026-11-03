/**
 * Alerts that start automations: "Do something…" on an alert, a rule, one of
 * homeCore's own kinds or a plugin's kind of alert, and what each one starts.
 *
 * Nothing here knows a plugin: the choices are made from the alert's own
 * fields (its kind, plugin, topic, device, rule) and the house's names for
 * them. homeCore works out which automations an alert starts from their
 * triggers (`GET /alerts/automations`), so one written by hand is found too.
 */
import type { Alert, AlertKind, AlertRule } from './alerts.js';
import type { Rule } from './ruleWords.js';
import type { CoreDevice } from './devices.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Json = any;

/** Which alerts a trigger means; each field narrows (homeCore's `AlertFilter`). */
export interface AlertFilter {
	kind?: AlertKind;
	plugin_id?: string;
	topic?: string;
	device_ids?: string[];
	min_severity?: Alert['severity'];
	key?: string;
	rule_id?: string;
}

/** One automation, as far as alerts go (`GET /alerts/automations`). */
export interface AutomationAlerts {
	id: string;
	name: string;
	enabled: boolean;
	links: AlertLink[];
	other_triggers: number;
	/** On, but every trigger is an alert that can't happen now. */
	waiting: boolean;
	/** Kept, turned off, when its rule was deleted. */
	alert_deleted: boolean;
}

export interface AlertLink {
	index: number;
	when: 'raised' | 'cleared' | 'acknowledged' | 'active_for';
	minutes?: number;
	filter: AlertFilter;
	/** `rule:{id}`, `kind:{kind}`, `plugin:{plugin_id}/{topic}`. */
	sources: string[];
	waiting?: 'off' | 'ignored' | 'deleted';
}

export type When = 'raised' | 'cleared' | 'still';

/** One choice of "For" in the sheet. */
export interface Scope {
	id: string;
	name: string;
	help: string;
	filter: AlertFilter;
	/** The alert in a few words, for the editor's banner: "wet — Dishwasher Leak Sensor". */
	banner: string;
	/** For the automation's name: "Dishwasher Leak Sensor is wet" — when it happens. */
	state?: string;
	/** For the automation's name otherwise: "“Freezer warming up”". */
	alert: string;
}

/** What the sheet hands the editor: in the address of a new automation. */
export interface Start {
	when: When;
	minutes?: number;
	filter: AlertFilter;
	name: string;
	banner: string;
	/** Where the alert is kept: its rule, its kind's row. */
	href: string;
	/** What can be done to the alert: `rule` (off, deleted), `plugin` (shown or not), `own`. */
	tie: 'rule' | 'plugin' | 'own';
}

/** What the scopes are made from: the house's names, nothing a plugin says about itself. */
export interface Names {
	device: (id: string) => CoreDevice | undefined;
	deviceName: (id: string) => string;
	pluginName: (id: string) => string;
	devices: CoreDevice[];
	rules: AlertRule[];
	topicLabel: (pluginId: string, topic: string) => string | undefined;
}

export type OwnKind = 'wet' | 'smoke' | 'offline' | 'jammed' | 'low_battery';
export const OWN_KINDS: OwnKind[] = ['wet', 'smoke', 'offline', 'jammed', 'low_battery'];

/** homeCore's own kinds: their name, what raises one, and how it's said. */
export const OWN: Record<
	OwnKind,
	{
		label: string;
		word: string;
		one: string;
		many: string;
		is: string;
		anywhere: string;
		anywhereHelp: string;
		attrs: string[];
	}
> = {
	wet: {
		label: 'Wet',
		word: 'wet',
		one: 'leak sensor',
		many: 'leak sensors',
		is: 'is wet',
		anywhere: 'Anything wet in the house',
		anywhereHelp: 'Any device from any plugin that reports water',
		attrs: ['water_detected', 'leak', 'wet']
	},
	smoke: {
		label: 'Smoke',
		word: 'smoke',
		one: 'smoke alarm',
		many: 'smoke alarms',
		is: 'smells smoke',
		anywhere: 'Smoke anywhere in the house',
		anywhereHelp: 'Any device from any plugin that reports smoke',
		attrs: ['smoke', 'smoke_detected']
	},
	offline: {
		label: 'Offline',
		word: 'offline',
		one: 'device',
		many: 'devices',
		is: 'goes offline',
		anywhere: 'Any device going offline',
		anywhereHelp: 'From any plugin',
		attrs: []
	},
	jammed: {
		label: 'Jammed',
		word: 'jammed',
		one: 'lock',
		many: 'locks',
		is: 'is jammed',
		anywhere: 'Any lock jamming',
		anywhereHelp: 'From any plugin',
		attrs: ['jammed', 'last_alert']
	},
	low_battery: {
		label: 'Low battery',
		word: 'low battery',
		one: 'device on battery',
		many: 'devices on battery',
		is: 'runs low on battery',
		anywhere: 'Any battery running low',
		anywhereHelp: 'From any plugin',
		attrs: ['battery_pct', 'battery', 'battery_level', 'battery_low']
	}
};

const SEVERITY: Record<Alert['severity'], string> = {
	info: 'Information',
	warning: 'Warnings',
	error: 'Errors',
	critical: 'Urgent alerts'
};

const isOwn = (k: string): k is OwnKind => (OWN_KINDS as string[]).includes(k);

/** A plugin's devices that could raise one of homeCore's own kinds. */
export function ownDevicesOf(kind: OwnKind, pluginId: string, all: CoreDevice[]): CoreDevice[] {
	const attrs = OWN[kind].attrs;
	return all.filter(
		(d) => d.plugin_id === pluginId && (attrs.length === 0 || attrs.some((a) => a in d.attributes))
	);
}

function anything(severity: Alert['severity']): Scope {
	return {
		id: 'serious',
		name: 'Anything this serious or worse',
		help: `${SEVERITY[severity]}${severity === 'critical' ? '' : ' and above'}, from anywhere`,
		filter: { min_severity: severity },
		banner: `anything ${severity === 'info' ? 'at all' : `${severity} or worse`}`,
		alert: `any ${severity} alert or worse`
	};
}

/** "For": this device, any like it, broader — for one alert. */
export function scopesForAlert(a: Alert, n: Names): Scope[] {
	const name = n.device(a.device_id) ? n.deviceName(a.device_id) : n.pluginName(a.device_id);
	const plugin = a.plugin_id ?? a.device_plugin_id ?? n.device(a.device_id)?.plugin_id;
	if (a.kind === 'rule' && a.rule_id) {
		const rule = n.rules.find((r) => r.id === a.rule_id);
		return rule ? scopesForRule(rule, n) : [];
	}
	if (a.kind === 'plugin' && a.plugin_id && a.topic) {
		const label = n.topicLabel(a.plugin_id, a.topic) ?? cap(a.topic.replace(/_/g, ' '));
		return [
			{
				id: 'this',
				name: `Only ${name}`,
				help: `${label}, on this one device`,
				filter: {
					kind: 'plugin',
					plugin_id: a.plugin_id,
					topic: a.topic,
					device_ids: [a.device_id]
				},
				banner: `${lower(label)} — ${name}`,
				state: `${name}: ${lower(label)}`,
				alert: `“${label}” on ${name}`
			},
			...scopesForPluginKind(a.plugin_id, a.topic, n),
			anything(a.severity)
		];
	}
	if (!isOwn(a.kind)) return [];
	const own = OWN[a.kind];
	const one: Scope = {
		id: 'this',
		name: `Only ${name}`,
		help: `This one ${a.kind === 'offline' ? 'device' : own.one.split(' ').pop()}`,
		filter: { kind: a.kind, device_ids: [a.device_id] },
		banner: `${own.word} — ${name}`,
		state: `${name} ${own.is}`,
		alert: `the ${own.word} alert for ${name}`
	};
	const everywhere = scopesForKind(a.kind, n)[0]!;
	if (!plugin) return [one, everywhere];
	const P = n.pluginName(plugin);
	const count = ownDevicesOf(a.kind, plugin, n.devices).length;
	const theirs: Scope =
		a.kind === 'offline'
			? {
					id: 'plugin',
					name: `Any ${P} device going offline`,
					help: `${P} only`,
					filter: { kind: a.kind, plugin_id: plugin },
					banner: `offline — any ${P} device`,
					state: `a ${P} device goes offline`,
					alert: `the offline alert for any ${P} device`
				}
			: {
					id: 'plugin',
					name: `Any ${P} ${own.one}`,
					help: `${count} ${count === 1 ? own.one.split(' ').pop() : own.many.split(' ').pop()} now, and any you add later`,
					filter: { kind: a.kind, plugin_id: plugin },
					banner: `${own.word} — any ${P} ${own.one}`,
					state: `any ${P} ${own.one} ${own.is}`,
					alert: `the ${own.word} alert for any ${P} ${own.one}`
				};
	// Offline reads best as this one, any, then just this plugin's.
	return a.kind === 'offline' ? [one, everywhere, theirs] : [one, theirs, everywhere];
}

/** "For", from an alert rule's row: only it, any of yours, anything as serious. */
export function scopesForRule(r: AlertRule, n: Names): Scope[] {
	const count = n.rules.length;
	return [
		{
			id: 'this',
			name: `Only this rule, “${r.name}”`,
			help: r.device_ids.map((d) => n.deviceName(d)).join(', '),
			filter: { kind: 'rule', rule_id: r.id },
			banner: `“${r.name}”`,
			alert: `“${r.name}”`
		},
		{
			id: 'rules',
			name: 'Any of your alert rules',
			help: count === 1 ? 'The one rule' : `All ${count} rules`,
			filter: { kind: 'rule' },
			banner: 'any of your alert rules',
			alert: 'any of your alert rules'
		},
		anything(r.severity)
	];
}

/** "For", from one of homeCore's own kinds: anywhere, or one plugin's devices. */
export function scopesForKind(kind: OwnKind, n: Names): Scope[] {
	const own = OWN[kind];
	const out: Scope[] = [
		{
			id: 'any',
			name: own.anywhere,
			help: own.anywhereHelp,
			filter: { kind },
			banner: `${own.word} — anywhere`,
			state: kind === 'offline' ? 'any device goes offline' : `anything ${own.is}`,
			alert: `any ${own.word} alert`
		}
	];
	const plugins = [...new Set(n.devices.map((d) => d.plugin_id).filter(Boolean) as string[])];
	for (const p of plugins.sort()) {
		const count = ownDevicesOf(kind, p, n.devices).length;
		if (count === 0 || kind === 'offline') continue;
		const P = n.pluginName(p);
		out.push({
			id: `plugin:${p}`,
			name: `Any ${P} ${own.one}`,
			help: `${count} now, and any you add later`,
			filter: { kind, plugin_id: p },
			banner: `${own.word} — any ${P} ${own.one}`,
			state: `any ${P} ${own.one} ${own.is}`,
			alert: `the ${own.word} alert for any ${P} ${own.one}`
		});
	}
	return out;
}

/** "For", from a plugin's kind of alert: it on any device. */
export function scopesForPluginKind(pluginId: string, topic: string, n: Names): Scope[] {
	const label = n.topicLabel(pluginId, topic) ?? cap(topic.replace(/_/g, ' '));
	const P = n.pluginName(pluginId);
	return [
		{
			id: 'kind',
			name: `${label} on any ${P} device`,
			help: `From ${P}, any device it has now or later`,
			filter: { kind: 'plugin', plugin_id: pluginId, topic },
			banner: `${lower(label)} — ${P}`,
			state: `${P}: ${lower(label)}`,
			alert: `“${P} · ${label}”`
		}
	];
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const WHENS: { id: When; name: (m: number) => string }[] = [
	{ id: 'raised', name: () => 'happens' },
	{ id: 'cleared', name: () => 'ends' },
	{ id: 'still', name: (m) => `is still on after ${m} min` }
];

/** The trigger for a choice. */
export function triggerOf(when: When, filter: AlertFilter, minutes = 10): Json {
	const f = clean(filter);
	if (when === 'cleared') return { AlertCleared: { filter: f } };
	if (when === 'still') return { AlertActiveFor: { filter: f, minutes } };
	return { AlertRaised: { filter: f } };
}

const clean = (f: AlertFilter): AlertFilter =>
	Object.fromEntries(
		Object.entries(f).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0))
	) as AlertFilter;

/** What the sheet's choice starts: handed to the editor through the address. */
export function startOf(
	scope: Scope,
	when: When,
	minutes: number,
	tie: Start['tie'],
	href: string
): Start {
	const what = WHENS.find((w) => w.id === when)!.name(minutes);
	const name =
		when === 'raised' && scope.state ? `When ${scope.state}` : `When ${scope.alert} ${what}`;
	return {
		when,
		...(when === 'still' ? { minutes } : {}),
		filter: clean(scope.filter),
		name,
		banner: scope.banner,
		href,
		tie
	};
}

export const startHref = (s: Start) =>
	`/settings/automations/new?alert=${encodeURIComponent(JSON.stringify(s))}`;

export function readStart(param: string | null): Start | null {
	if (!param) return null;
	try {
		const s = JSON.parse(param) as Start;
		return s && typeof s === 'object' && s.filter && s.when ? s : null;
	} catch {
		return null;
	}
}

/** A new automation from a start: its trigger filled in, nothing to do yet. */
export function draftOf(s: Start, blank: Rule): Rule {
	return { ...blank, name: s.name, trigger: triggerOf(s.when, s.filter, s.minutes ?? 10) };
}

/** Where an alert's own place is, in Settings › Alert rules. */
export const placeOf = (a: Pick<Alert, 'kind' | 'rule_id' | 'plugin_id' | 'topic'>) =>
	a.kind === 'rule' && a.rule_id
		? `/settings/alerts#rule-${a.rule_id}`
		: a.kind === 'plugin' && a.plugin_id && a.topic
			? `/settings/alerts#${pluginKey(a.plugin_id, a.topic)}`
			: `/settings/alerts#kind-${a.kind}`;

export const pluginKey = (pluginId: string, topic: string) =>
	`plugin-${pluginId}-${topic}`.replace(/[^A-Za-z0-9_-]/g, '-');

export const tieOf = (kind: AlertKind): Start['tie'] =>
	kind === 'rule' ? 'rule' : kind === 'plugin' ? 'plugin' : 'own';

/** The banner's second sentence: what turning the alert off or deleting it does. */
export function tieWords(tie: Start['tie']): string {
	if (tie === 'rule')
		return "It stays tied to that alert: turn the alert off and this waits; delete the alert and you'll be asked about this too.";
	if (tie === 'plugin')
		return 'It stays tied to that alert: set it to “Show it: Off” or ignore it, and this waits.';
	return 'It stays tied to that alert: ignore it, and this waits.';
}

// ---- what an alert starts ----

const rankOf = { info: 0, warning: 1, error: 2, critical: 3 } as const;

/** homeCore's `AlertFilter::matches`, for an alert on screen. */
export function matches(f: AlertFilter, a: Alert): boolean {
	const plugin = a.plugin_id ?? a.device_plugin_id;
	return (
		(f.kind === undefined || f.kind === a.kind) &&
		(f.plugin_id === undefined || f.plugin_id === plugin) &&
		(f.topic === undefined || f.topic === a.topic) &&
		(f.key === undefined || f.key === a.key) &&
		(f.rule_id === undefined || f.rule_id === a.rule_id) &&
		(!f.device_ids?.length || f.device_ids.includes(a.device_id)) &&
		(f.min_severity === undefined || rankOf[a.severity] >= rankOf[f.min_severity])
	);
}

/** The automations this alert starts. */
export const startedBy = (a: Alert, list: AutomationAlerts[]) =>
	list.filter((x) => x.links.some((l) => matches(l.filter, a)));

/** The automations each source starts, by source key. */
export function bySource(list: AutomationAlerts[]): Map<string, AutomationAlerts[]> {
	const out = new Map<string, AutomationAlerts[]>();
	for (const x of list)
		for (const key of new Set(x.links.flatMap((l) => l.sources))) {
			out.set(key, [...(out.get(key) ?? []), x]);
		}
	return out;
}

export const ruleSource = (id: string) => `rule:${id}`;
export const kindSource = (k: string) => `kind:${k}`;
export const pluginSource = (p: string, t: string) => `plugin:${p}/${t}`;

/** An alert trigger's alert, in words: “Freezer warming up”, “Wet” on Dishwasher Leak Sensor. */
export function linkName(l: AlertLink, n: Names): string {
	const f = l.filter;
	const one = f.device_ids?.length === 1 ? n.deviceName(f.device_ids[0]!) : undefined;
	if (f.rule_id) {
		if (f.rule_id.startsWith('DELETED:')) return 'a deleted rule';
		return `“${n.rules.find((r) => r.id === f.rule_id)?.name ?? 'a deleted rule'}”`;
	}
	if (f.plugin_id && f.topic) {
		const label = n.topicLabel(f.plugin_id, f.topic) ?? f.topic.replace(/_/g, ' ');
		return `“${n.pluginName(f.plugin_id)} · ${label}”${one ? ` on ${one}` : ''}`;
	}
	if (f.kind && isOwn(f.kind)) {
		const by = one ? ` on ${one}` : f.plugin_id ? ` from ${n.pluginName(f.plugin_id)}` : '';
		return `“${OWN[f.kind].label}”${by}`;
	}
	if (f.kind === 'rule') return 'any of your alert rules';
	if (f.plugin_id) return `any ${n.pluginName(f.plugin_id)} alert`;
	if (f.min_severity) return `any ${f.min_severity} alert or worse`;
	return 'any alert';
}

/** What an automation's card says about the alert that starts it. */
export function cardLine(
	x: AutomationAlerts,
	n: Names
): { text: string; tone: 'bad' | 'wait' | 'by' } {
	if (x.alert_deleted)
		return { text: 'Its alert was deleted — choose another trigger or delete it', tone: 'bad' };
	if (x.waiting) {
		const l = x.links.find((y) => y.waiting) ?? x.links[0]!;
		const why =
			l.waiting === 'ignored'
				? 'is ignored'
				: l.waiting === 'deleted'
					? 'was deleted'
					: 'is turned off';
		return { text: `Its alert ${linkName(l, n)} ${why}`, tone: 'wait' };
	}
	const names = [...new Set(x.links.map((l) => linkName(l, n)))];
	const more = x.other_triggers > 0 ? ', or something else' : '';
	return { text: `Started by the alert ${names.join(', or ')}${more}`, tone: 'by' };
}

/** "Starts 1 automation: Freezer — flash garage light". */
export function startsText(list: AutomationAlerts[]): string {
	if (list.length === 0) return '';
	const names = list.map((x) => x.name);
	return `Starts ${list.length === 1 ? '1 automation' : `${list.length} automations`}: ${names.slice(0, 3).join(', ')}${names.length > 3 ? `, and ${names.length - 3} more` : ''}`;
}
