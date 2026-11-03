/**
 * Pages people make (G27–G31): the house's, made in Edit by people who may
 * edit the house's pages, and each person's own. A page is listed in its
 * owner's document (`built`) and holds only its layer's changes — sections
 * of its own and what was added into them — at `pages['page:<id>']`.
 *
 * Plain data and functions, so making, copying and removing a page can be
 * tested without drawing anything. Not in Home's first download.
 */
import {
	added,
	newId,
	type BuiltPage,
	type Change,
	type HouseDoc,
	type PersonDoc
} from './layers.js';
import { applyPage, sectionRef, withOwn, type Page } from './page.js';

export type Whose = 'house' | 'mine';

export interface Listed extends BuiltPage {
	whose: Whose;
	/** How many cards it holds. */
	cards: number;
}

export const pageKeyOf = (id: string) => `page:${id}`;

const listed = (doc: HouseDoc | PersonDoc | undefined, whose: Whose): Listed[] =>
	(doc?.built ?? []).map((p) => ({
		...p,
		whose,
		cards: added(doc?.pages?.[pageKeyOf(p.id)]).length
	}));

/** The house's pages, then the person's own (G28). */
export function listPages(house?: HouseDoc, person?: PersonDoc): Listed[] {
	return [...listed(house, 'house'), ...listed(person, 'mine')];
}

/** One page by id, and whose it is — or none, if it's gone. */
export function findPage(id: string, house?: HouseDoc, person?: PersonDoc): Listed | undefined {
	return listPages(house, person).find((p) => p.id === id);
}

/** Refs that are added afresh rather than named again: a copy's settings are its own. */
const fresh = (r: string) =>
	r.startsWith('card:') || r.startsWith('kind:') ? r.replace(/[^/]+$/, newId()) : r;
/** What a page someone made can hold: things in the house, plugins' and the app's cards. */
const copyable = (r: string) => /^(device|scene|room|card|kind):/.test(r);

/**
 * The changes a copy starts with (G29): each section shown on the original,
 * as a section of its own with its title and layout, and each card in it
 * added into it with its name, size and settings. A snapshot — it doesn't
 * follow the original afterwards. The house's own pieces (alerts, the big
 * numbers, modes) have no ref to add, so they're left out.
 */
export function copyOf(page: Page, changes: Change[] = [], mine: Change[] = []): Change[] {
	const shown = applyPage(withOwn(page, changes, mine), changes, mine);
	const seen = new Set<string>();
	const out: Change[] = [];
	for (const s of shown.sections) {
		if (s.hidden || s.section.bare) continue;
		const cards = s.groups.flatMap((g) =>
			g.shown.filter((c) => copyable(c.ref) && !seen.has(c.ref)).map((c) => ({ c, g }))
		);
		if (cards.length === 0) continue;
		const id = `own-${newId()}`;
		out.push({ op: 'section', ref: sectionRef(id), title: s.title, layout: s.layout });
		for (const { c, g } of cards) {
			seen.add(c.ref);
			const r = fresh(c.ref);
			out.push({ op: 'add', ref: r, into: id });
			const name = g.name(c.ref);
			const form = g.form(c.ref);
			const config = g.config(c.ref);
			if (name !== undefined) out.push({ op: 'rename', ref: r, name });
			if (form !== undefined) out.push({ op: 'form', ref: r, form });
			if (config !== undefined) out.push({ op: 'config', ref: r, config });
		}
	}
	return out;
}

/** A document with a page made in it, and the changes it starts with. */
export function withPage<D extends HouseDoc | PersonDoc>(
	doc: D,
	page: BuiltPage,
	changes: Change[] = []
): D {
	return {
		...doc,
		built: [...(doc.built ?? []), page],
		pages: { ...doc.pages, [pageKeyOf(page.id)]: changes }
	};
}

/** A document with a page gone: its entry and its changes. */
export function withoutPage<D extends HouseDoc | PersonDoc>(doc: D, id: string): D {
	const pages = { ...doc.pages };
	delete pages[pageKeyOf(id)];
	return { ...doc, built: (doc.built ?? []).filter((p) => p.id !== id), pages };
}

/** A document with a page renamed, or given another symbol. */
export function withPageNamed<D extends HouseDoc | PersonDoc>(
	doc: D,
	id: string,
	set: { name?: string; icon?: string }
): D {
	return {
		...doc,
		built: (doc.built ?? []).map((p) => (p.id === id ? { ...p, ...set } : p))
	};
}

/**
 * Who may make a page for whom (G28): anyone their own, only people who may
 * edit the house's pages the house's.
 */
export const mayMake = (whose: Whose, canEditHouse: boolean) => whose === 'mine' || canEditHouse;

/** Who may change a page: its owner — for the house's, people who may edit it. */
export const mayChange = (p: Listed, canEditHouse: boolean) => mayMake(p.whose, canEditHouse);

/**
 * A person's bar with a page put in or taken out (G30): in place of Pages,
 * else at the end if there's room, else in place of the last. Taken out,
 * Pages goes back where it was, unless the bar has it already.
 */
export function withPageInBar(bar: string[], id: string, on: boolean, size: number): string[] {
	const key = pageKeyOf(id);
	if (!on) {
		if (!bar.includes(key)) return bar;
		return bar.includes('pages')
			? bar.filter((d) => d !== key)
			: bar.map((d) => (d === key ? 'pages' : d));
	}
	if (bar.includes(key)) return bar;
	if (bar.includes('pages')) return bar.map((d) => (d === 'pages' ? key : d));
	if (bar.length < size) return [...bar, key];
	return [...bar.slice(0, -1), key];
}

/** A display's pages with this one first, where it rests (G31) — or taken off. */
export function withPageOnDisplay(pages: string[], id: string, on: boolean): string[] {
	const key = pageKeyOf(id);
	const rest = pages.filter((p) => p !== key);
	return on ? [key, ...rest] : rest;
}

/** The pages a display may be given (G31): the house's own, never a person's. */
export const displayPages = (house?: HouseDoc): BuiltPage[] => house?.built ?? [];
