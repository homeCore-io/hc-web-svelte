/**
 * The look this screen shows (12): Classic or Lit, the person's own, else the
 * house's. It is on the page as `data-look`, and this browser keeps a copy so
 * the first paint is drawn in it before anything has loaded (`app.html`).
 */
import type { Change, LookId } from './layers.js';

const KEY = 'hc.look';

function read(): LookId {
	try {
		return localStorage.getItem(KEY) === 'lit' ? 'lit' : 'classic';
	} catch {
		return 'classic';
	}
}

class Look {
	current = $state<LookId>(typeof localStorage === 'undefined' ? 'classic' : read());

	get lit(): boolean {
		return this.current === 'lit';
	}

	/** Show a look: remember it here, and mark the page. */
	show(id: LookId): void {
		this.current = id;
		try {
			if (id === 'classic') localStorage.removeItem(KEY);
			else localStorage.setItem(KEY, id);
		} catch {
			// Private browsing: the copy lasts this visit.
		}
		const root = document.documentElement;
		if (id === 'classic') delete root.dataset.look;
		else root.dataset.look = id;
	}
}

export const look = new Look();

// ---- each look's own arrangements (13 §8.4, U3) ----

/**
 * Where a page's changes are kept for a look: Classic's under the page's own
 * key, as they always were, and every other look's under `look|page`.
 */
export const lookKey = (page: string, id: LookId = look.current): string =>
	id === 'classic' ? page : `${id}|${page}`;

/** Pages a look groups differently from Classic: its arrangements start fresh. */
const regroups = (page: string, id: LookId): boolean => id === 'lit' && page.startsWith('room:');

/**
 * A look's changes to a page. Until it has made some, a page it groups as
 * Classic does shows Classic's (a new look starts with a copy, U3); its first
 * change copies them and goes on from there.
 */
export function pageChanges(
	pages: Record<string, Change[]> | undefined,
	page: string,
	id: LookId = look.current
): Change[] {
	const own = pages?.[lookKey(page, id)];
	if (own) return own;
	if (id !== 'classic' && !regroups(page, id)) return pages?.[page] ?? [];
	return [];
}

/**
 * A page's changes, gone for a look: Classic's deleted; another look's set
 * empty, since deleting them would bring Classic's back instead of the page
 * as generated.
 */
export function withoutChanges(
	pages: Record<string, Change[]> | undefined,
	page: string,
	id: LookId = look.current
): Record<string, Change[]> {
	const out = { ...pages };
	if (id === 'classic') delete out[page];
	else out[lookKey(page, id)] = [];
	return out;
}
