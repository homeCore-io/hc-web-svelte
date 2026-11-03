/**
 * Rows an `import` field brings in, merged into a table's rows by the
 * table's key (`key_by`). A new row is added. A row already there is
 * updated, but only where it has nothing yet: a key it lacks, or holds
 * empty (`null`, `""`, `[]`), is filled from the import — what someone set
 * by hand (a kind, a room, a fade) is never overwritten. So re-reading a
 * report fills in what an older import left out (a Pico's buttons) without
 * undoing anyone's choices.
 */
export type Row = Record<string, unknown>;

const empty = (v: unknown) =>
	v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0);

export function mergeRows(
	have: Row[],
	incoming: Row[],
	by: string | undefined
): { rows: Row[]; added: number; updated: number } {
	const rows = have.map((r) => ({ ...r }));
	let added = 0;
	let updated = 0;
	for (const r of incoming) {
		if (!r || typeof r !== 'object') continue;
		const at = by ? rows.findIndex((h) => JSON.stringify(h[by]) === JSON.stringify(r[by])) : -1;
		if (at < 0) {
			rows.push({ ...r });
			added++;
			continue;
		}
		const row = rows[at]!;
		let changed = false;
		for (const [k, v] of Object.entries(r)) {
			if (empty(row[k]) && !empty(v)) {
				row[k] = v;
				changed = true;
			}
		}
		if (changed) updated++;
	}
	return { rows, added, updated };
}
