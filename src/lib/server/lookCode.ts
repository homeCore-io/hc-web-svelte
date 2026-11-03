/**
 * Code in a look (13 §6.4, D2): a drawing made in the look editor may carry
 * JavaScript, which runs in the browser of everyone who sees the look. So
 * only someone who may install plugins (homeCore's `plugins:write`) may add
 * or change it, as for a plugin's own drawings (S4). Anyone else may still
 * save a document that keeps code an admin wrote, unchanged, or drops it.
 */

export const CODE_SCOPE = 'plugins:write';

/** Each made drawing's code in a document's looks, by look and drawing. */
function codeIn(doc: unknown): Map<string, string> {
	const out = new Map<string, string>();
	const looks = (doc as { looks?: unknown } | null)?.looks;
	if (!Array.isArray(looks)) return out;
	for (const l of looks) {
		const made = (l as { made?: unknown } | null)?.made;
		if (!Array.isArray(made)) continue;
		for (const m of made) {
			const code = (m as { code?: unknown } | null)?.code;
			if (typeof code === 'string' && code.trim())
				out.set(
					`${String((l as { id?: unknown }).id)}/${String((m as { id?: unknown }).id)}`,
					code
				);
		}
	}
	return out;
}

/** Whether `next` adds or changes code that `prev` didn't have. */
export function addsCode(prev: unknown, next: unknown): boolean {
	const was = codeIn(prev);
	for (const [key, code] of codeIn(next)) if (was.get(key) !== code) return true;
	return false;
}
