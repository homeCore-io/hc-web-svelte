/**
 * Automations' calls to homeCore (A2): read, turn on and off, copy, delete,
 * test, history, import and export. Rules are homeCore's (M1).
 *
 * homeCore announces when a rule fires but not when one changes, so screens
 * read again after their own changes and when the window comes back.
 */
import type { Rule } from './ruleWords.js';
import type { Record_, TestResult } from './ruleRuns.js';
import type { Vocabulary } from './ruleEdit.js';

export type Answer<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(method: string, path: string, body?: unknown): Promise<Answer<T>> {
	let res: Response;
	try {
		res = await fetch(`/api/v1${path}`, {
			method,
			headers: body === undefined ? undefined : { 'content-type': 'application/json' },
			body: body === undefined ? undefined : JSON.stringify(body)
		});
	} catch {
		return { ok: false, error: 'homeCore is not answering.' };
	}
	if (res.status === 401 || res.status === 403)
		return { ok: false, error: "You aren't allowed to change this." };
	const text = await res.text();
	let data: unknown = text;
	try {
		data = text === '' ? null : JSON.parse(text);
	} catch {
		// Plain text (a rule's RON source).
	}
	if (res.ok) return { ok: true, data: data as T };
	const said = data as { error?: unknown } | null;
	return {
		ok: false,
		error: typeof said?.error === 'string' ? said.error : `homeCore said no (${res.status}).`
	};
}

const one = (id: string) => `/automations/${encodeURIComponent(id)}`;

export const loadRules = () => call<Rule[]>('GET', '/automations');
export const loadRule = (id: string) => call<Rule>('GET', one(id));
export const history = (id: string) => call<Record_[]>('GET', `${one(id)}/history`);
export const ronOf = (id: string) => call<string>('GET', `${one(id)}/ron`);
/** `?at=` for a dry run judged at another time, or nothing for now. */
const atQuery = (at?: string) => (at ? `?at=${encodeURIComponent(at)}` : '');
export const testRule = (id: string, at?: string) =>
	call<TestResult>('POST', `${one(id)}/test${atQuery(at)}`);
/** Every rule naming `from` names `to` instead (homeCore 0.1.82). */
export const repointAll = (from: string, to: string) =>
	call<{ changed: string[] }>('POST', '/automations/repoint', { from, to });

/** The rules that name a device, as written or as the placeholder its deletion left. */
export const rulesNaming = (rules: Rule[], deviceId: string) => {
	const plain = deviceId.replace(/^DELETED:/, '');
	const marks = [`"${plain}"`, `"DELETED:${plain}"`];
	return rules.filter((r) => marks.some((m) => JSON.stringify(r).includes(m)));
};

/** Run a rule now; homeCore answers before it runs (homeCore with `run_now`). */
/** Rules another rule has paused (homeCore 0.1.84; older ones say 404). */
export const loadPaused = () => call<{ paused: string[] }>('GET', '/automations/paused');
/** Resume one by hand. */
export const resumeRule = (id: string) => call<unknown>('DELETE', `${one(id)}/pause`);
/** The house values rules keep, with what each is now. */
export const loadHouseValues = () =>
	call<{ hub: Record<string, unknown> }>('GET', '/automations/variables');

export const runRule = (id: string, checks: boolean) =>
	call<{ rule_id: string; checks: boolean }>('POST', `${one(id)}/run`, { checks });

export const setEnabled = (id: string, enabled: boolean) =>
	call<Rule>('PATCH', one(id), { enabled });

/** Several at once; rules a mode made are left as they are by homeCore. */
export const setManyEnabled = (ids: string[], enabled: boolean) =>
	call<{ updated: number }>('PATCH', '/automations', { ids, enabled });

/** A copy, turned off, called "Copy of …". */
export const cloneRule = (id: string) => call<Rule>('POST', `${one(id)}/clone`);

/** The whole rule, as changed — homeCore replaces it. */
export function saveRule(rule: Rule): Promise<Answer<Rule>> {
	const { id, error: _error, ...body } = rule;
	return call<Rule>('PUT', one(id), body);
}

export const deleteRule = (id: string) => call<null>('DELETE', one(id));

/** Delete several; says how many went and what went wrong, if anything. */
export async function deleteRules(ids: string[]): Promise<{ done: number; error?: string }> {
	let done = 0;
	for (const id of ids) {
		const res = await deleteRule(id);
		if (!res.ok) return { done, error: res.error };
		done++;
	}
	return { done };
}

/** Add or remove a tag on several rules, saving each that changes. */
export async function retag(
	rules: Rule[],
	tag: string,
	add: boolean
): Promise<{ done: number; error?: string }> {
	let done = 0;
	for (const r of rules) {
		const tags = r.tags ?? [];
		const next = add ? [...new Set([...tags, tag])] : tags.filter((x) => x !== tag);
		if (next.length === tags.length && next.every((x, i) => x === tags[i])) continue;
		const res = await saveRule({ ...r, tags: next });
		if (!res.ok) return { done, error: `${r.name}: ${res.error}` };
		done++;
	}
	return { done };
}

/** Every rule a mode's definition made, with the mode's name. */
export async function modeMade(): Promise<Record<string, string>> {
	const res = await call<
		{
			config?: { name?: string; id?: string };
			definition?: { generated_rule_ids?: string[] } | null;
		}[]
	>('GET', '/modes');
	const out: Record<string, string> = {};
	if (!res.ok || !Array.isArray(res.data)) return out;
	for (const m of res.data)
		for (const id of m.definition?.generated_rule_ids ?? [])
			out[id] = m.config?.name ?? m.config?.id ?? 'a mode';
	return out;
}

// ---- import and export ----

/** Rules as a file someone keeps, or brings to another house. */
export function download(rules: Rule[], name: string): void {
	const blob = new Blob([JSON.stringify(rules, null, 2)], { type: 'application/json' });
	const a = document.createElement('a');
	a.href = URL.createObjectURL(blob);
	a.download = name;
	a.click();
	setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const exportAll = () => call<Rule[]>('GET', '/automations/export');

export interface Imported {
	imported: number;
	/** Why nothing was imported: each rule that couldn't be, by name. */
	failures?: { index: number; name: string; error: string }[];
	error?: string;
}

/**
 * Add the rules in a file. homeCore gives each a new id and imports all or
 * none: one naming a device the house lacks stops the lot.
 */
export async function importRules(text: string): Promise<Imported> {
	let list: unknown;
	try {
		list = JSON.parse(text);
	} catch {
		return { imported: 0, error: 'That file isn’t rules — it isn’t JSON.' };
	}
	if (!Array.isArray(list)) list = [list];
	if (!(list as unknown[]).every((r) => r && typeof r === 'object' && 'trigger' in (r as object)))
		return { imported: 0, error: 'That file isn’t rules — they each need a trigger.' };
	// homeCore gives every imported rule a new id but won't read one without.
	const rules = (list as Record<string, unknown>[]).map((r) => ({
		...r,
		id: typeof r.id === 'string' ? r.id : crypto.randomUUID()
	}));
	let res: Response;
	try {
		res = await fetch('/api/v1/automations/import', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(rules)
		});
	} catch {
		return { imported: 0, error: 'homeCore is not answering.' };
	}
	const reply = await res.text();
	let said: Imported & { error?: string } = { imported: 0 };
	try {
		said = JSON.parse(reply) as Imported & { error?: string };
	} catch {
		// homeCore's own words, when it couldn't read the file at all.
		said = { imported: 0, error: reply.trim() || undefined };
	}
	if (res.ok) return { imported: said.imported ?? rules.length };
	return {
		imported: 0,
		failures: said.failures,
		error:
			res.status === 403
				? "You aren't allowed to change this."
				: (said.error ?? `homeCore said no (${res.status}).`)
	};
}

/**
 * Rule groups (homeCore's): "sets" here, named rules turned on and off
 * together (E9). Tags still do the grouping of the list.
 */
export interface RuleGroup {
	id: string;
	name: string;
	description?: string;
	rule_ids: string[];
}
export const loadGroups = () => call<RuleGroup[]>('GET', '/automations/groups');
export const setGroupEnabled = (id: string, on: boolean) =>
	call<{ updated: number }>(
		'POST',
		`/automations/groups/${encodeURIComponent(id)}/${on ? 'enable' : 'disable'}`
	);

/** homeCore assigns the id, but won't read a body without one. */
export const createGroup = (name: string, rule_ids: string[], description?: string) =>
	call<RuleGroup>('POST', '/automations/groups', {
		id: '00000000-0000-0000-0000-000000000000',
		name,
		...(description ? { description } : {}),
		rule_ids
	});
/** homeCore can't drop a description, only set one: '' reads as none here. */
export const changeGroup = (
	id: string,
	patch: Partial<Pick<RuleGroup, 'name' | 'description' | 'rule_ids'>>
) => call<RuleGroup>('PATCH', `/automations/groups/${encodeURIComponent(id)}`, patch);
export const deleteGroup = (id: string) =>
	call<{ deleted: boolean }>('DELETE', `/automations/groups/${encodeURIComponent(id)}`);

/** A set's members after adding or taking out some, in its order. */
export function withMembers(group: RuleGroup, ids: string[], add: boolean): string[] {
	if (!add) return group.rule_ids.filter((id) => !ids.includes(id));
	return [...group.rule_ids, ...ids.filter((id) => !group.rule_ids.includes(id))];
}

// ---- writing (A3) ----

/** A new rule; homeCore gives it its id. */
export function createRule(rule: Rule): Promise<Answer<Rule>> {
	const { id: _id, error: _error, ...body } = rule;
	return call<Rule>('POST', '/automations', body);
}

/** A dry run of a draft that isn't saved (homeCore with `test_draft`). */
export function testDraft(rule: Rule, at?: string): Promise<Answer<TestResult>> {
	const { id: _id, error: _error, ...body } = rule;
	return call<TestResult>('POST', `/automations/test${atQuery(at)}`, body);
}

let vocabulary: Promise<Vocabulary | null> | null = null;
/** What this homeCore's rules can say — read once. */
export function loadVocabulary(): Promise<Vocabulary | null> {
	vocabulary ??= call<Vocabulary>('GET', '/automations/vocabulary').then((r) =>
		r.ok ? r.data : null
	);
	return vocabulary;
}
