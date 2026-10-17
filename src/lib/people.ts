/**
 * People and access (A5): who has an account, what each role allows, and the
 * keys programs use. What a role allows is read from homeCore's own scopes
 * (`/auth/roles`), never assumed from its name (S4).
 */

export interface Person {
	id: string;
	username: string;
	role: string;
	created_at: string;
	/** Whether they've set a PIN — homeCore ≥ A5 says; older ones don't. */
	has_pin?: boolean;
}

export interface RoleInfo {
	role: string;
	scopes: string[];
}

export interface ApiKey {
	id: string;
	label: string;
	prefix: string;
	owner_uid: string;
	scopes: string[];
	created_at: string;
	last_used_at: string | null;
	expires_at: string | null;
	allowed_cidrs: string[];
	revoked_at: string | null;
	/** A display's key — managed under Displays, not here. */
	display?: boolean;
}

// ---- roles, in words ----

interface RoleWords {
	name: string;
	/** Who it's for, in a few words. */
	who: string;
	/** What it allows, as a sentence. */
	what: string;
}

export const ROLE_WORDS: Record<string, RoleWords> = {
	admin: {
		name: 'Admin',
		who: 'Everything',
		what: 'Everything, including plugins, people and keys. Keep this to one or two people.'
	},
	user: {
		name: 'User',
		who: 'Trusted to change how the house works',
		what: 'Everything a household member can, and changes how the house works: rules, scenes, rooms, shared pages.'
	},
	household_member: {
		name: 'Household member',
		who: 'Family: use everything, change nothing shared',
		what: 'Uses every device and scene, sees alerts, sets up their own Home and phone bar. Can’t change rules, rooms, shared pages or settings.'
	},
	read_only: {
		name: 'Read only',
		who: 'Sees the house',
		what: 'Sees the house and presses nothing — a guest screen, say.'
	},
	device_operator: {
		name: 'Device operator',
		who: 'Uses and rearranges devices',
		what: 'Uses devices, and renames, moves and removes them; sees plugins and the audit. Writes no rules.'
	},
	rule_editor: {
		name: 'Rule editor',
		who: 'Writes rules; can’t use devices',
		what: 'Writes rules, scenes and rooms; sees plugins and the audit. Can’t command devices.'
	},
	service_operator: {
		name: 'Service operator',
		who: 'For a program: everything but plugins and people',
		what: 'What a user can do, and reads the audit — the shape for a service account.'
	},
	observer: {
		name: 'Observer',
		who: 'Watches; plugins and audit too',
		what: 'Sees the house, its plugins and the audit; changes nothing.'
	}
};

/** The roles a person is usually given, first; the rest behind "More roles". */
export const MAIN_ROLES = ['household_member', 'user', 'admin', 'read_only'];
export const ORDER = [
	'admin',
	'user',
	'household_member',
	'device_operator',
	'rule_editor',
	'service_operator',
	'observer',
	'read_only'
];

export const roleName = (role: string) =>
	ROLE_WORDS[role]?.name ??
	role
		.split('_')
		.map((w, i) => (i === 0 ? w[0]!.toUpperCase() + w.slice(1) : w))
		.join(' ');

/** homeCore's roles, in the order people think of them; unknown ones last. */
export function ordered(roles: RoleInfo[]): RoleInfo[] {
	const at = (r: string) => (ORDER.includes(r) ? ORDER.indexOf(r) : ORDER.length);
	return [...roles].sort((a, b) => at(a.role) - at(b.role) || a.role.localeCompare(b.role));
}

// ---- what each role allows ----

export type Cell = 'yes' | 'see' | 'no' | '—';

const has = (s: string[], ...any: string[]) => any.some((x) => s.includes(x));

export const COLUMNS: { label: string; of(s: string[]): Cell }[] = [
	{
		label: 'Use devices',
		of: (s) => (has(s, 'devices:command', 'devices:write') ? 'yes' : '—')
	},
	{
		label: 'Run scenes',
		of: (s) =>
			has(s, 'scenes:run', 'scenes:write')
				? 'yes'
				: has(s, 'devices:command', 'devices:write')
					? 'no'
					: '—'
	},
	{
		label: 'Rename & remove devices',
		of: (s) => (has(s, 'devices:write') ? 'yes' : '—')
	},
	{
		label: 'Rules, scenes, rooms',
		of: (s) => (has(s, 'automations:write') ? 'yes' : '—')
	},
	{ label: 'Shared pages & look', of: (s) => (has(s, 'content:write') ? 'yes' : '—') },
	{
		label: 'Plugins',
		of: (s) => (has(s, 'plugins:write') ? 'yes' : has(s, 'plugins:read') ? 'see' : '—')
	},
	{ label: 'People & keys', of: (s) => (has(s, 'users:write') ? 'yes' : '—') },
	{ label: 'Audit', of: (s) => (has(s, 'audit:read') ? 'see' : '—') }
];

export const cellsOf = (scopes: string[]) => COLUMNS.map((c) => c.of(scopes));

// ---- the list ----

/** What the list should say first about the people, if anything. */
export function advice(people: Person[], roles: RoleInfo[]): string | null {
	if (people.length < 2) return null;
	const admins = people.filter((p) => p.role === 'admin').length;
	if (admins !== people.length) return null;
	const member = roles.some((r) => r.role === 'household_member');
	const all = people.length === 2 ? 'Both people' : `All ${people.length} people`;
	return member
		? `${all} are admins. Give family members “Household member”: they use the house, and can’t change it.`
		: `${all} are admins. This homeCore has no household-member role yet — family members can be “User”, who can also change rules and rooms.`;
}

/** Whether removing `p`, or giving them `role`, would leave the house without an admin. */
export function lastAdmin(people: Person[], p: Person, role?: string): boolean {
	if (p.role !== 'admin' || role === 'admin') return false;
	return people.filter((x) => x.role === 'admin' && x.id !== p.id).length === 0;
}

export const initialOf = (name: string) => [...name.trim()][0]?.toUpperCase() ?? '?';

// ---- keys ----

export type KeyLevel = 'read' | 'use' | 'admin' | 'custom';

export const LEVEL_WORDS: Record<KeyLevel, { name: string; what: string }> = {
	read: { name: 'See the house', what: 'Devices, rooms, scenes, rules — reading only.' },
	use: { name: 'Use the house', what: 'See it, and command devices and run scenes.' },
	admin: {
		name: 'Everything you can do',
		what: 'Every permission you hold — for an admin, people, plugins and keys too.'
	},
	custom: { name: 'Choose exactly…', what: 'Pick from homeCore’s permissions, one by one.' }
};

const READS = [
	'devices:read',
	'automations:read',
	'dashboards:read',
	'scenes:read',
	'areas:read',
	'skins:read',
	'content:read'
];

/**
 * The scopes a level grants, within what the maker holds — a key takes a
 * subset of its owner's (homeCore refuses more). An older homeCore without
 * `devices:command` gets `devices:write` for "use".
 */
export function scopesFor(level: Exclude<KeyLevel, 'custom'>, mine: string[]): string[] {
	if (level === 'admin') return [...mine];
	const read = READS.filter((s) => mine.includes(s));
	if (level === 'read') return read;
	const use = mine.includes('devices:command')
		? ['devices:command']
		: mine.includes('devices:write')
			? ['devices:write']
			: [];
	const run = mine.includes('scenes:run') ? ['scenes:run'] : [];
	return [...read, ...use, ...run];
}

/** Which level a key's scopes are, as its maker would have chosen it. */
export function levelOf(scopes: string[], mine: string[]): KeyLevel {
	const same = (a: string[], b: string[]) => a.length === b.length && a.every((x) => b.includes(x));
	for (const l of ['read', 'use', 'admin'] as const) if (same(scopes, scopesFor(l, mine))) return l;
	return 'custom';
}

/** What a key may do, in a few words. */
export function keyWords(scopes: string[]): string {
	const can: string[] = [];
	if (has(scopes, 'devices:read')) can.push('see devices');
	if (has(scopes, 'devices:command', 'devices:write')) can.push('use them');
	if (has(scopes, 'scenes:run', 'scenes:write')) can.push('run scenes');
	if (has(scopes, 'automations:write')) can.push('change rules');
	if (has(scopes, 'plugins:write')) can.push('manage plugins');
	if (has(scopes, 'users:write')) can.push('manage people');
	if (has(scopes, 'audit:read')) can.push('read the audit');
	if (has(scopes, 'content:read') && !can.length) can.push('read pages');
	return can.length ? can.join(', ') : 'nothing';
}

export type KeyState = 'in use' | 'revoked' | 'expired';

export function keyState(k: ApiKey, now: number): KeyState {
	if (k.revoked_at) return 'revoked';
	if (k.expires_at && Date.parse(k.expires_at) <= now) return 'expired';
	return 'in use';
}

/** The keys this page manages — programs', not displays'. */
export const programKeys = (keys: ApiKey[]) => keys.filter((k) => !k.display);

/** Grouped for the page: in use, then stopped (revoked or expired), newest first. */
export function keyGroups(keys: ApiKey[], now: number) {
	const newest = (a: ApiKey, b: ApiKey) => b.created_at.localeCompare(a.created_at);
	const prog = programKeys(keys);
	return {
		live: prog.filter((k) => keyState(k, now) === 'in use').sort(newest),
		stopped: prog.filter((k) => keyState(k, now) !== 'in use').sort(newest)
	};
}

/** The scopes homeCore could grant, grouped for "Choose exactly". */
export function scopeChoices(mine: string[]): { group: string; scopes: string[] }[] {
	const groups: Record<string, string[]> = {};
	for (const s of [...mine].sort()) {
		const [area = s] = s.split(':');
		(groups[area] ??= []).push(s);
	}
	return Object.entries(groups).map(([group, scopes]) => ({ group, scopes }));
}

export const EXPIRY = [
	{ label: 'after 90 days', days: 90 },
	{ label: 'after 30 days', days: 30 },
	{ label: 'after a year', days: 365 },
	{ label: 'never', days: null }
] as const;
