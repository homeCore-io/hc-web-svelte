/**
 * Automations' calls to homeCore (A2): read, turn on and off, copy, delete,
 * test, history, import and export. Rules are homeCore's (M1).
 *
 * homeCore announces when a rule fires but not when one changes, so screens
 * read again after their own changes and when the window comes back.
 */
import type { Rule } from './ruleWords.js';
import type { Record_, TestResult } from './ruleRuns.js';

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
export const testRule = (id: string) => call<TestResult>('POST', `${one(id)}/test`);

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

/** Rule groups (homeCore's), only for turning a set on and off (E9). */
export interface RuleGroup {
	id: string;
	name: string;
	rule_ids: string[];
}
export const loadGroups = () => call<RuleGroup[]>('GET', '/automations/groups');
export const setGroupEnabled = (id: string, on: boolean) =>
	call<{ updated: number }>(
		'POST',
		`/automations/groups/${encodeURIComponent(id)}/${on ? 'enable' : 'disable'}`
	);
