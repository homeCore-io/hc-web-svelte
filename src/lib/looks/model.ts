/**
 * A look as data (13 §3, §15): one choice in each of five layers (theme,
 * feel, drawings, frame, grouping), chosen as a whole (S1). Classic and Lit
 * are written here the same way any look is, so a look someone makes, or
 * imports from a file (§12.3), is read exactly as the built-in ones are.
 *
 * This file is small and has no components in it: Home loads it.
 */
import type { Layout } from '../page.js';

export type Density = 'roomy' | 'standard' | 'compact';
export type Corners = 'square' | 'soft' | 'round';
export type Motion = 'still' | 'gentle' | 'lively';

/** Spacing, corners, type and motion (§5). */
export interface Feel {
	density: Density;
	corners: Corners;
	/** Type scale, 0.9 to 1.15. */
	type: number;
	motion: Motion;
}

/** The families of things a look draws its own way (§6). */
export const FAMILIES = ['lights', 'switches', 'scenes', 'doors', 'readings', 'watching'] as const;
export type Family = (typeof FAMILIES)[number];

/** The drawings there are for each family; the first is Classic's. */
export const DRAWINGS: Record<Family, readonly { id: string; name: string }[]> = {
	lights: [
		{ id: 'classic', name: 'Card with a switch' },
		{ id: 'lit', name: 'Fills as it dims' }
	],
	switches: [
		{ id: 'classic', name: 'Card with a switch' },
		{ id: 'lit', name: 'Rocker' }
	],
	scenes: [
		{ id: 'classic', name: 'Button' },
		{ id: 'lit', name: 'Swatch of its colors' }
	],
	doors: [
		{ id: 'classic', name: 'Card' },
		{ id: 'lit', name: 'Picture of the door' }
	],
	readings: [
		{ id: 'classic', name: 'Card' },
		{ id: 'lit', name: 'Number with its day' }
	],
	watching: [
		{ id: 'classic', name: 'Card' },
		{ id: 'lit', name: 'One line' }
	]
};

/** The pieces around a page's cards (§7). */
export interface Frame {
	/** A display settles into its rest view after this many seconds untouched (§10). */
	rest: { on: boolean; after: number };
}

/** What a grouping rule takes from a room (§8.1), in the words the look editor shows. */
export const TAKES = {
	header: 'The room’s header',
	needs: 'What needs someone',
	doors: 'Doors, gates and locks',
	lights: 'Lights that dim, and light groups',
	'switches.lights': 'Lights that only switch',
	'switches.power': 'Anything that powers something',
	scenes: 'Scenes',
	readings: 'Readings: temperature, humidity, air',
	watching: 'Sensors worth a glance',
	rest: 'Everything else',
	more: 'Rarely used: remotes, hubs, bridges'
} as const;
export type Take = keyof typeof TAKES;

/** Where a section sits in a room drawn in columns (11 G32). */
export type Place = 'band' | 'main' | 'side';

/** One section of a grouped room (§8.1). */
export interface Rule {
	/** Stable, so arrangements keep finding it (§8.4). */
	id: string;
	title: string;
	takes: Take[];
	layout: Layout;
	place: Place;
	/** Drawn without its heading. */
	headless?: boolean;
}

export interface Grouping {
	/** How a room is split into sections; absent, Classic's four. */
	room?: Rule[];
}

export interface Look {
	id: string;
	name: string;
	/** A line under its name. */
	sub?: string;
	/** The look it was made from (for "What changed", and where its arrangements start). */
	from?: string;
	/** A theme of its own, used where neither the person nor the house chose one. */
	theme?: string;
	feel: Feel;
	/** How each family is drawn; a family left out is drawn as Classic draws it. */
	drawings: Partial<Record<Family, string>>;
	frame: Frame;
	grouping: Grouping;
	/** Household pages and displays (the built-in looks), or settings too (S9). */
	reaches: 'household' | 'everywhere';
	version: 1;
}

export const CLASSIC: Look = {
	id: 'classic',
	name: 'Classic',
	sub: 'Cards of one size, a switch on each.',
	feel: { density: 'standard', corners: 'soft', type: 1, motion: 'still' },
	drawings: {},
	frame: { rest: { on: false, after: 60 } },
	grouping: {},
	reaches: 'household',
	version: 1
};

export const LIT: Look = {
	id: 'lit',
	name: 'Lit',
	sub: 'Rooms glow as they are lit; drag to dim; a panel of switches.',
	feel: { density: 'compact', corners: 'round', type: 1, motion: 'lively' },
	drawings: {
		lights: 'lit',
		switches: 'lit',
		scenes: 'lit',
		doors: 'lit',
		readings: 'lit',
		watching: 'lit'
	},
	frame: { rest: { on: true, after: 60 } },
	grouping: {
		room: [
			{
				id: 'head',
				title: 'Header',
				takes: ['header'],
				layout: 'list',
				place: 'band',
				headless: true
			},
			{
				id: 'needs',
				title: 'Needs you',
				takes: ['needs'],
				layout: 'list',
				place: 'band',
				headless: true
			},
			{ id: 'doors', title: 'Doors and locks', takes: ['doors'], layout: 'grid', place: 'band' },
			{ id: 'lights', title: 'Lights', takes: ['lights'], layout: 'grid', place: 'main' },
			{
				id: 'switches',
				title: 'Switches',
				takes: ['switches.lights'],
				layout: 'panel',
				place: 'main'
			},
			{
				id: 'power',
				title: 'Power and water',
				takes: ['switches.power'],
				layout: 'panel',
				place: 'main'
			},
			{ id: 'scenes', title: 'Scenes', takes: ['scenes'], layout: 'swatches', place: 'main' },
			{ id: 'readings', title: 'Readings', takes: ['readings'], layout: 'grid', place: 'side' },
			{ id: 'watching', title: 'Watching', takes: ['watching'], layout: 'lines', place: 'side' },
			{ id: 'things', title: 'Everything else', takes: ['rest'], layout: 'grid', place: 'side' },
			{
				id: 'more',
				title: 'More in this room',
				takes: ['more'],
				layout: 'fold',
				place: 'side',
				headless: true
			}
		]
	},
	reaches: 'household',
	version: 1
};

/** The looks that come with the app. */
export const BUILT_IN: readonly Look[] = [CLASSIC, LIT];

/** How a family is drawn in a look. */
export const drawingOf = (l: Look, f: Family): string => l.drawings[f] ?? 'classic';

/** Whether a look draws any family its own way. */
export const drawsOwn = (l: Look): boolean => FAMILIES.some((f) => drawingOf(l, f) !== 'classic');

// ---- feel, as the tokens every component reads (app.css) ----

const GAP: Record<Density, number> = { roomy: 14, standard: 10, compact: 8 };
const CARD: Record<Corners, number> = { square: 6, soft: 14, round: 18 };
const BOX: Record<Corners, number> = { square: 8, soft: 20, round: 20 };

/** A feel's tokens, as CSS custom properties. Motion is `data-motion` on the page. */
export function feelVars(f: Feel): Record<string, string> {
	return {
		'--feel-card-radius': `${CARD[f.corners]}px`,
		'--feel-box-radius': `${BOX[f.corners]}px`,
		'--feel-gap': `${GAP[f.density]}px`,
		'--feel-type': String(f.type)
	};
}

// ---- reading a look from a document or a file ----

const oneOf = <T extends string>(v: unknown, all: readonly T[], or: T): T =>
	all.includes(v as T) ? (v as T) : or;
const PLACES = ['band', 'main', 'side'] as const;
const LAYOUTS = ['grid', 'row', 'list', 'panel', 'swatches', 'lines', 'fold'] as const;
const ID = /^[a-z0-9][a-z0-9-]{0,47}$/;

/**
 * A look from untrusted data (a document, an imported file), or why it isn't
 * one. What it leaves out is filled from the look it was made from, else
 * Classic, so every look is complete (§11: there is no blank look).
 */
export function readLook(raw: unknown, known: readonly Look[] = BUILT_IN): Look | string {
	if (!raw || typeof raw !== 'object') return 'This isn’t a look.';
	const o = raw as Record<string, unknown>;
	if (o.version !== 1) return 'This look is from a newer homeCore.';
	if (typeof o.id !== 'string' || !ID.test(o.id)) return 'The look has no id it can be kept under.';
	if (BUILT_IN.some((b) => b.id === o.id)) return `“${o.id}” is a built-in look’s name.`;
	if (typeof o.name !== 'string' || !o.name.trim()) return 'The look has no name.';
	const base = known.find((l) => l.id === o.from) ?? CLASSIC;
	const f = (o.feel ?? {}) as Record<string, unknown>;
	const type = typeof f.type === 'number' ? Math.min(1.15, Math.max(0.9, f.type)) : base.feel.type;
	const drawings: Partial<Record<Family, string>> = { ...base.drawings };
	if (o.drawings && typeof o.drawings === 'object')
		for (const fam of FAMILIES) {
			const d = (o.drawings as Record<string, unknown>)[fam];
			if (DRAWINGS[fam].some((x) => x.id === d)) drawings[fam] = d as string;
		}
	const fr = (o.frame ?? {}) as { rest?: { on?: unknown; after?: unknown } };
	const rest = {
		on: typeof fr.rest?.on === 'boolean' ? fr.rest.on : base.frame.rest.on,
		after:
			typeof fr.rest?.after === 'number' && fr.rest.after >= 10
				? Math.round(fr.rest.after)
				: base.frame.rest.after
	};
	const g = (o.grouping ?? {}) as { room?: unknown };
	let room = base.grouping.room;
	if (g.room === null) room = undefined;
	else if (Array.isArray(g.room)) {
		const rules = g.room.flatMap((r): Rule[] => {
			if (!r || typeof r !== 'object') return [];
			const x = r as Record<string, unknown>;
			if (typeof x.id !== 'string' || !ID.test(x.id) || typeof x.title !== 'string') return [];
			const takes = Array.isArray(x.takes) ? x.takes.filter((t): t is Take => t in TAKES) : [];
			return [
				{
					id: x.id,
					title: x.title,
					takes,
					layout: oneOf(x.layout, LAYOUTS, 'grid'),
					place: oneOf(x.place, PLACES, 'main'),
					...(x.headless === true ? { headless: true } : {})
				}
			];
		});
		const ids = new Set(rules.map((r) => r.id));
		if (ids.size !== rules.length) return 'Two of the look’s sections share an id.';
		room = rules;
	}
	return {
		id: o.id,
		name: o.name.trim().slice(0, 60),
		...(typeof o.sub === 'string' ? { sub: o.sub.slice(0, 120) } : {}),
		...(typeof o.from === 'string' ? { from: o.from } : {}),
		...(typeof o.theme === 'string' && /^[a-z]+$/.test(o.theme) ? { theme: o.theme } : {}),
		feel: {
			density: oneOf(f.density, ['roomy', 'standard', 'compact'], base.feel.density),
			corners: oneOf(f.corners, ['square', 'soft', 'round'], base.feel.corners),
			type,
			motion: oneOf(f.motion, ['still', 'gentle', 'lively'], base.feel.motion)
		},
		drawings,
		frame: { rest },
		grouping: room ? { room } : {},
		reaches: o.reaches === 'everywhere' ? 'everywhere' : 'household',
		version: 1
	};
}

/** Every look someone may choose: the built-in ones, then the house's, then their own. */
export function allLooks(house?: unknown[], mine?: unknown[]): Look[] {
	const out: Look[] = [...BUILT_IN];
	for (const raw of [...(house ?? []), ...(mine ?? [])]) {
		const l = readLook(raw, out);
		if (typeof l !== 'string' && !out.some((x) => x.id === l.id)) out.push(l);
	}
	return out;
}

/** A look by id among those there are; Classic if it's gone (principle 6). */
export const findLook = (all: readonly Look[], id: string | undefined): Look =>
	all.find((l) => l.id === id) ?? CLASSIC;

/** A new look's id from its name, unlike any there is. */
export function newLookId(name: string, all: readonly Look[]): string {
	const stem =
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 40) || 'look';
	let id = stem;
	for (let n = 2; all.some((l) => l.id === id); n++) id = `${stem}-${n}`;
	return id;
}

/** A copy of a look to start a new one from (§11: "Start from Lit"). */
export function copyOf(l: Look, name: string, all: readonly Look[]): Look {
	return {
		...structuredClone(l),
		id: newLookId(name, all),
		name,
		from: l.id,
		sub: `Made from ${l.name}.`
	};
}

/** A look as a file to share (§12.3): only its choices, no drawings in code yet. */
export function lookFile(l: Look): string {
	return JSON.stringify({ homeCoreLook: 1, look: l }, null, '\t');
}

/** A look from a shared file's text, or why not. */
export function fromFile(text: string, all: readonly Look[]): Look | string {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch {
		return 'This file isn’t a look.';
	}
	const o = data as { homeCoreLook?: unknown; look?: unknown };
	if (o?.homeCoreLook !== 1) return 'This file isn’t a look.';
	return readLook(o.look, all);
}
