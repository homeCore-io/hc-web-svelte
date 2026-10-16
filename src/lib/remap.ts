/**
 * After homeCore merges one room into another (H1), what the UI server keeps
 * about the first — its place on Home, its icon, a display's page, someone's
 * phone bar — is about the second. Room ids are UUIDs, so the id, and
 * `room:{id}`, are rewritten wherever they appear: as values and as keys.
 * Where both rooms had something under a key, the one merged into keeps its own.
 */
export function remapRoom(value: unknown, from: string, into: string): unknown {
	const swap = (s: string) => (s === from ? into : s === `room:${from}` ? `room:${into}` : s);
	if (typeof value === 'string') return swap(value);
	if (Array.isArray(value)) {
		// A list that named both now names the one twice; keep the first.
		const out: unknown[] = [];
		for (const x of value) {
			const y = remapRoom(x, from, into);
			if ((y === into || y === `room:${into}`) && out.includes(y)) continue;
			out.push(y);
		}
		return out;
	}
	if (value !== null && typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>);
		const out: Record<string, unknown> = {};
		// Keys already about the target first, so they win over the merged room's.
		for (const [k, v] of entries) if (swap(k) === k) out[k] = remapRoom(v, from, into);
		for (const [k, v] of entries) {
			const nk = swap(k);
			if (nk !== k && !(nk in out)) out[nk] = remapRoom(v, from, into);
		}
		return out;
	}
	return value;
}
