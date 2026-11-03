/**
 * The look this screen shows (13 §3): the person's own, else a display's or
 * the house's, else Classic, as a whole look (looks/model.ts), not just a
 * name. Its feel is on the page as tokens and `data-motion`, its id as
 * `data-look`, and this browser keeps a copy so the first paint is drawn in
 * it before anything has loaded (`app.html`).
 */
import { getContext, setContext } from 'svelte';
import type { Change } from './layers.js';
import {
	BUILT_IN,
	CLASSIC,
	drawingOf,
	feelVars,
	findLook,
	type Family,
	type Look
} from './looks/model.js';

const KEY = 'hc.look';

/** What the first paint needs of a look, kept in this browser. */
interface Kept {
	id: string;
	vars: Record<string, string>;
	motion: string;
}

function read(): Look {
	try {
		const raw = localStorage.getItem(KEY);
		if (raw === 'lit') return BUILT_IN[1]!;
		const kept = raw ? (JSON.parse(raw) as Kept) : null;
		return findLook(BUILT_IN, kept?.id);
	} catch {
		return CLASSIC;
	}
}

class LookNow {
	/** The look shown; until the documents load, the built-in one kept here, or Classic. */
	def = $state<Look>(typeof localStorage === 'undefined' ? CLASSIC : read());
	/** Every look there is to choose: built in, the house's, the person's. */
	all = $state<readonly Look[]>(BUILT_IN);
	/** A display's own look (13 §10), set while this screen is one. */
	display = $state<string | undefined>(undefined);

	get id(): string {
		return this.def.id;
	}

	/** How this look draws a family of things (§6). */
	draws(f: Family): string {
		return drawingOf(this.def, f);
	}

	/**
	 * Show a look: mark the page with its feel, and remember it here. Where it
	 * doesn't reach (settings, for a look of the household's pages, S9), the
	 * screen keeps Classic's feel.
	 */
	show(l: Look, all?: readonly Look[], reaches = true): void {
		this.def = l;
		if (all) this.all = all;
		const root = document.documentElement;
		const feel = reaches ? l.feel : CLASSIC.feel;
		for (const [k, v] of Object.entries(feelVars(feel))) root.style.setProperty(k, v);
		root.dataset.motion = feel.motion;
		const vars = feelVars(l.feel);
		if (l.id === 'classic') delete root.dataset.look;
		else root.dataset.look = l.id;
		try {
			if (l.id === 'classic') localStorage.removeItem(KEY);
			else
				localStorage.setItem(
					KEY,
					JSON.stringify({ id: l.id, vars, motion: l.feel.motion } satisfies Kept)
				);
		} catch {
			// Private browsing: the copy lasts this visit.
		}
	}
}

export const look = new LookNow();

/** What a drawing asks of the look it's drawn in. */
export interface LookHere {
	readonly def: Look;
	draws(f: Family): string;
	/** Drawn in a preview: shows, but doesn't act or take the page's title. */
	readonly preview?: boolean;
}

const HERE = Symbol('look here');

/**
 * The look to draw in here: a preview's draft (the look editor's, 13 §11),
 * else the one on screen. Called while a component starts.
 */
export const lookHere = (): LookHere => getContext<LookHere | undefined>(HERE) ?? look;

/** Draw what's inside in this look instead of the one on screen (the editor's preview). */
export function previewIn(get: () => Look): void {
	setContext<LookHere>(HERE, {
		get def() {
			return get();
		},
		draws: (f) => drawingOf(get(), f),
		preview: true
	});
}

// ---- each look's own arrangements (13 §8.4, U3) ----

/**
 * Where a page's changes are kept for a look: Classic's under the page's own
 * key, as they always were, and every other look's under `look|page`.
 */
export const lookKey = (page: string, id: string = look.id): string =>
	id === 'classic' ? page : `${id}|${page}`;

/** Whether two looks group a page differently: one's rooms by rules, the other's not. */
const regroups = (page: string, a: Look, b: Look): boolean =>
	page.startsWith('room:') && !a.grouping.room !== !b.grouping.room;

/**
 * A look's changes to a page. Until it has made some, it shows those of the
 * look it was made from (a new look starts with a copy, U3), unless that one
 * groups the page differently; its first change copies them and goes on.
 */
export function pageChanges(
	pages: Record<string, Change[]> | undefined,
	page: string,
	id: string = look.id,
	all: readonly Look[] = look.all
): Change[] {
	let l = findLook(all, id);
	for (let hops = 0; hops < 8; hops++) {
		const own = pages?.[lookKey(page, l.id)];
		if (own) return own;
		if (l.id === 'classic') return [];
		const from = findLook(all, l.from ?? 'classic');
		if (regroups(page, l, from)) return [];
		l = from;
	}
	return [];
}

/**
 * A page's changes, gone for a look: Classic's deleted; another look's set
 * empty, since deleting them would bring back those it started from instead
 * of the page as generated.
 */
export function withoutChanges(
	pages: Record<string, Change[]> | undefined,
	page: string,
	id: string = look.id
): Record<string, Change[]> {
	const out = { ...pages };
	if (id === 'classic') delete out[page];
	else out[lookKey(page, id)] = [];
	return out;
}
