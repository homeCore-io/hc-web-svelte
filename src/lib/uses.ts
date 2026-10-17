/**
 * Where something is used (A1): the rules whose triggers, conditions or
 * actions name a device, a helper or a mode. Rules nest (conditions inside
 * actions, parallel steps), so the whole rule is searched for the id.
 *
 * It finds mentions, not meanings — a rule names the device, not whether it
 * starts or checks it; the rule's own page (A2) says that, in words.
 */
export interface RuleRef {
	id: string;
	name: string;
	enabled?: boolean;
	[field: string]: unknown;
}

/** Whether `v` holds the string `id` anywhere — as a value, not a key. */
export function mentions(v: unknown, id: string): boolean {
	if (v === id) return true;
	if (Array.isArray(v)) return v.some((x) => mentions(x, id));
	if (v !== null && typeof v === 'object') return Object.values(v).some((x) => mentions(x, id));
	return false;
}

/** The rules that name any of `ids` (a device's id, its name in rules), by name. */
export function rulesNaming(rules: RuleRef[], ...ids: (string | undefined)[]): RuleRef[] {
	const want = ids.filter((x): x is string => !!x);
	return rules
		.filter((r) => {
			// Everything but the rule's own identity: its trigger(s), conditions,
			// actions — whatever shape this homeCore gives them.
			const { id: _id, name: _name, ...body } = r;
			return want.some((id) => mentions(body, id));
		})
		.sort((a, b) => a.name.localeCompare(b.name));
}

/** All rules, or null when homeCore wouldn't say. */
export async function loadRules(): Promise<RuleRef[] | null> {
	try {
		const res = await fetch('/api/v1/automations');
		return res.ok ? ((await res.json()) as RuleRef[]) : null;
	} catch {
		return null;
	}
}
