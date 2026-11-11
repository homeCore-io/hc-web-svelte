/**
 * A look as data (13 §3, §15): one choice in each of five layers (theme,
 * feel, drawings, frame, grouping), chosen as a whole (S1). Classic, Lit and
 * Console are written here the same way any look is, so a look someone makes, or
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
export const FAMILIES = [
	'lights',
	'switches',
	'scenes',
	'doors',
	'readings',
	'watching',
	'media',
	'climate'
] as const;
export type Family = (typeof FAMILIES)[number];

/** The drawings there are for each family; the first is Classic's. */
export const DRAWINGS: Record<Family, readonly { id: string; name: string }[]> = {
	lights: [
		{ id: 'classic', name: 'Card with a switch' },
		{ id: 'lit', name: 'Fills as it dims' },
		{ id: 'chip', name: 'Chip' },
		{ id: 'row', name: 'Row with a slider' }
	],
	switches: [
		{ id: 'classic', name: 'Card with a switch' },
		{ id: 'lit', name: 'Rocker' },
		{ id: 'chip', name: 'Chip' },
		{ id: 'row', name: 'Row' }
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
		{ id: 'lit', name: 'Number with its day' },
		{ id: 'band', name: 'With its usual range' },
		{ id: 'chip', name: 'Chip' }
	],
	watching: [
		{ id: 'classic', name: 'Card' },
		{ id: 'lit', name: 'One line' }
	],
	media: [
		{ id: 'classic', name: 'Card with its controls' },
		{ id: 'art', name: 'Its artwork, while playing' }
	],
	climate: [{ id: 'classic', name: 'Dial' }]
};

/** A plugin's drawing or piece, by its id in a look (§12): `plugin:{plugin}/{element}`. */
export type PluginRef = `plugin:${string}/${string}`;
export const isPluginRef = (v: unknown): v is PluginRef =>
	typeof v === 'string' && /^plugin:[a-z0-9._-]{1,64}\/[a-z][a-z0-9._-]*-[a-z0-9._-]*$/.test(v);

/** A UI extension's element, by its id in a look: `ext:{extension}/{element}`. */
export type ExtRef = `ext:${string}/${string}`;
export const isExtRef = (v: unknown): v is ExtRef =>
	typeof v === 'string' && /^ext:[a-z0-9][a-z0-9._-]{0,63}\/[a-z0-9][a-z0-9._-]{0,63}$/.test(v);

/** The pieces around a page's cards (§7). */
export interface Frame {
	/** A grouped room's header: glowing with its name, a plain title, or a plugin's. */
	header: 'glow' | 'plain' | PluginRef;
	/** Status chips in the header ("5 lights on"). */
	chips: boolean;
	/** What needs someone, first in a room. */
	needs: boolean;
	/** What's rarely used folded under "More". */
	more: boolean;
	/** A room opened over Home as a sheet, rather than as its page (G1). */
	sheet: boolean;
	/**
	 * A display settles into its rest view after this many seconds untouched
	 * (§10): Lit's, or a plugin's `piece`.
	 */
	rest: { on: boolean; after: number; piece?: PluginRef };
	/**
	 * The app's frame on a wide screen: the standard sidebar and header, or the
	 * console's toolbar, sidebar of Everywhere views and rooms, and its own
	 * controls. Absent, the standard one.
	 */
	shell?: Shell;
}

/** The frames a look can put the app in (`Frame.shell`). */
export type Shell = 'standard' | 'console';

/** The frame a look puts the app in. */
export const shellOf = (l: Look): Shell => l.frame.shell ?? 'standard';

/** Home's grouping (§8.3): the order its sections start in, which start hidden, its layout. */
export interface HomeGrouping {
	order: string[];
	hidden: string[];
	layout: 'list' | 'field' | 'tiles';
}

// ---- drawings made in the editor (§6.4) ----

/** The parts a made drawing is put together from. */
export interface Parts {
	shape: 'card' | 'tile' | 'disc' | 'line';
	fill: 'none' | 'level' | 'color';
	shows: { icon: boolean; name: boolean; state: boolean; level: boolean; bar: boolean };
	tap: 'switch' | 'open' | 'none';
	/** When on: the thing's own color, or the theme's. */
	onInk: 'own' | 'theme';
}

/** Parts that follow the thing, in the expression language (looks/expr.ts). */
export interface Expressions {
	label?: string;
	color?: string;
	icon?: string;
}

/** A drawing made in the look editor: parts, expressions, and an admin's code (§6.4). */
export interface MadeDrawing {
	id: string;
	name: string;
	family: Family;
	/** The drawing it started from. */
	from: string;
	parts: Parts;
	expr: Expressions;
	/** CSS, anyone's; `url()` and `@import` are taken out where it's drawn. */
	css?: string;
	/** JavaScript, an admin's: the body of `draw(thing, host)`, returning HTML. */
	code?: string;
	/**
	 * How small and large it can be placed (14 §7, L4): one of `DRAWING_SIZES`
	 * each, in cells. Absent, its family's.
	 */
	size?: { min: Cells; max: Cells };
}

/** A width and height in cells. */
export type Cells = [number, number];

/** The sizes the drawing editor offers, smallest first (L4). */
export const DRAWING_SIZES: readonly Cells[] = [
	[2, 1],
	[2, 2],
	[3, 2],
	[4, 2],
	[4, 3],
	[6, 3],
	[6, 4],
	[8, 4],
	[12, 4],
	[12, 6]
];

/** Each family's range, for a drawing that doesn't say its own (14 §7). */
export const FAMILY_SIZE: Record<Family, { min: Cells; max: Cells }> = {
	lights: { min: [2, 1], max: [6, 4] },
	switches: { min: [2, 1], max: [6, 4] },
	scenes: { min: [2, 1], max: [4, 2] },
	doors: { min: [2, 1], max: [6, 4] },
	readings: { min: [2, 1], max: [12, 6] },
	watching: { min: [2, 1], max: [12, 6] },
	media: { min: [2, 1], max: [12, 6] },
	climate: { min: [4, 3], max: [12, 6] }
};

/** A made drawing's range: its own, else its family's. */
export const sizeOf = (m: MadeDrawing) => m.size ?? FAMILY_SIZE[m.family];

/** The families a drawing can be made for: things with a state to show. */
export const MAKEABLE: readonly Family[] = [
	'lights',
	'switches',
	'scenes',
	'doors',
	'readings',
	'watching'
];

export const PARTS_OF: Record<string, Parts> = {
	classic: {
		shape: 'card',
		fill: 'none',
		shows: { icon: true, name: true, state: true, level: false, bar: false },
		tap: 'switch',
		onInk: 'theme'
	},
	lit: {
		shape: 'card',
		fill: 'level',
		shows: { icon: false, name: true, state: true, level: true, bar: false },
		tap: 'switch',
		onInk: 'own'
	}
};

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
	cameras: 'Cameras',
	rest: 'Everything else',
	more: 'Rarely used: remotes, hubs, bridges',
	batteries: 'Every battery’s level, lowest first'
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
	/** The area it starts in (14 §8, A2); absent, the one its `place` meant. */
	area?: string;
	/**
	 * Its devices and scenes start in one stack (13 §13.2) when it has this many
	 * or more; each person can change the stack, or take things out of it.
	 */
	stack?: number;
}

/**
 * Where a grouped room's sections start (14 §8, A1): a look's own areas, in
 * rows, each row the room's 12 columns, its areas side by side.
 */
export interface Area {
	/** Stable, so rules keep finding it. */
	id: string;
	name: string;
	/** Columns of the 12. */
	w: number;
}

/** An area where it falls: its columns, and its row. */
export interface AreaAt extends Area {
	x: number;
	row: number;
}

/** Lit's: across the top, then a main area and one beside it. A look that says none has these. */
export const LIT_AREAS: Area[][] = [
	[{ id: 'top', name: 'Across the top', w: 12 }],
	[
		{ id: 'main', name: 'Main', w: 8 },
		{ id: 'beside', name: 'Beside', w: 4 }
	]
];

/** The area a rule's `place` meant, before looks had areas of their own. */
const PLACE_AREA: Record<Place, string> = { band: 'top', main: 'main', side: 'beside' };

/** A look's areas where they fall: each row's areas side by side, rows one under another. */
export function areasOf(g: Grouping): AreaAt[] {
	return (g.areas ?? LIT_AREAS).flatMap((row, r) => {
		let x = 0;
		return row.map((a) => {
			const at = { ...a, x, row: r };
			x += a.w;
			return at;
		});
	});
}

/**
 * The area a section starts in (A2, N3): its rule's, or the one its place
 * meant; where the look has no such area, the widest for the main place, the
 * narrowest for beside it, else the first. What no rule takes goes to the last.
 */
export function areaFor(g: Grouping, rule: Rule | undefined): AreaAt | undefined {
	const all = areasOf(g);
	if (!rule) return all.at(-1);
	const named =
		all.find((a) => a.id === rule.area) ?? all.find((a) => a.id === PLACE_AREA[rule.place]);
	if (named || all.length === 0) return named;
	const by = (better: (a: AreaAt, b: AreaAt) => boolean) =>
		all.reduce((best, a) => (better(a, best) ? a : best));
	if (rule.place === 'main') return by((a, b) => a.w > b.w);
	if (rule.place === 'side') return by((a, b) => a.w < b.w);
	return all[0];
}

/** An area four columns wide or less lays its cards one a row (A3). */
export const narrowArea = (a: Area) => a.w <= 4;

export interface Grouping {
	/** How a room is split into sections; absent, Classic's four. */
	room?: Rule[];
	/** Where sections start (A1); absent, Lit's. */
	areas?: Area[][];
	/** How Home starts; absent, as Home comes. */
	home?: HomeGrouping;
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
	/** Lights in their own colors; off, everything that's on is the theme's color (§4). */
	ownColors: boolean;
	feel: Feel;
	/**
	 * How each family is drawn: `classic`, `lit`, a made drawing's id, a
	 * plugin's (`plugin:…`) or a UI extension's (`ext:…`); left out, Classic's.
	 * One that's gone draws as Classic does (principle 6).
	 */
	drawings: Partial<Record<Family, string>>;
	/**
	 * The options chosen for drawings that offer some (a plugin's or an
	 * extension's), by the drawing's id: `{ "ext:hc-thermostat/dial": { pulse: false } }`.
	 * An option not set here is the drawing's own default.
	 */
	options?: Record<string, Record<string, boolean>>;
	/** Drawings made in the editor (§6.4). */
	made: MadeDrawing[];
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
	ownColors: false,
	feel: { density: 'standard', corners: 'soft', type: 1, motion: 'still' },
	drawings: {},
	made: [],
	frame: {
		header: 'plain',
		chips: true,
		needs: false,
		more: false,
		sheet: false,
		rest: { on: false, after: 60 }
	},
	grouping: {},
	reaches: 'household',
	version: 1
};

export const LIT: Look = {
	id: 'lit',
	name: 'Lit',
	sub: 'Rooms glow as they are lit; drag to dim; a panel of switches.',
	ownColors: true,
	feel: { density: 'compact', corners: 'round', type: 1, motion: 'lively' },
	drawings: {
		lights: 'lit',
		switches: 'lit',
		scenes: 'lit',
		doors: 'lit',
		readings: 'lit',
		watching: 'lit',
		media: 'art'
	},
	made: [],
	frame: {
		header: 'glow',
		chips: true,
		needs: true,
		more: true,
		sheet: true,
		rest: { on: true, after: 60 }
	},
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
			{ id: 'cameras', title: 'Cameras', takes: ['cameras'], layout: 'grid', place: 'main' },
			{ id: 'readings', title: 'Readings', takes: ['readings'], layout: 'grid', place: 'side' },
			{ id: 'watching', title: 'Watching', takes: ['watching'], layout: 'lines', place: 'side' },
			{ id: 'things', title: 'Everything else', takes: ['rest'], layout: 'grid', place: 'side' },
			{ id: 'batteries', title: 'Batteries', takes: ['batteries'], layout: 'list', place: 'side' },
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

/**
 * A desktop app's look (the console boards): a dark, glossy frame with a
 * toolbar, the house's Everywhere views and its rooms down the side, and
 * faders and switches like a lighting desk's. Its pages are Classic's until
 * the console draws rooms its own way.
 */
export const CONSOLE: Look = {
	id: 'console',
	name: 'Console',
	sub: 'A desktop app: rooms down the side, faders and switches.',
	ownColors: true,
	feel: { density: 'standard', corners: 'round', type: 1, motion: 'gentle' },
	drawings: {},
	made: [],
	frame: {
		header: 'plain',
		chips: true,
		needs: false,
		more: false,
		sheet: false,
		rest: { on: false, after: 60 },
		shell: 'console'
	},
	grouping: {},
	reaches: 'household',
	version: 1
};

/** The looks that come with the app. */
export const BUILT_IN: readonly Look[] = [CLASSIC, LIT, CONSOLE];

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
const LAYOUTS = [
	'grid',
	'row',
	'list',
	'panel',
	'swatches',
	'lines',
	'fold',
	'chips',
	'joined'
] as const;
const ID = /^[a-z0-9][a-z0-9-]{0,47}$/;
const bool = (v: unknown, or: boolean): boolean => (typeof v === 'boolean' ? v : or);
const text = (v: unknown, max: number): string | undefined =>
	typeof v === 'string' && v.trim() ? v.slice(0, max) : undefined;

/** A made drawing from untrusted data, or nothing if it can't be one. */
/** A made drawing's range, read: two of the editor's sizes, the smaller first. */
function readSize(v: unknown): { size?: { min: Cells; max: Cells } } {
	const o = (v ?? {}) as { min?: unknown; max?: unknown };
	const at = (c: unknown) =>
		Array.isArray(c) ? DRAWING_SIZES.findIndex(([w, h]) => w === c[0] && h === c[1]) : -1;
	const lo = at(o.min);
	const hi = at(o.max);
	return lo >= 0 && hi >= lo ? { size: { min: DRAWING_SIZES[lo]!, max: DRAWING_SIZES[hi]! } } : {};
}

function readMade(raw: unknown): MadeDrawing | null {
	if (!raw || typeof raw !== 'object') return null;
	const o = raw as Record<string, unknown>;
	if (typeof o.id !== 'string' || !ID.test(o.id) || o.id === 'classic' || o.id === 'lit')
		return null;
	const family = oneOf(o.family, MAKEABLE, 'lights');
	if (o.family !== family) return null;
	const from = o.from === 'lit' ? 'lit' : 'classic';
	const base = PARTS_OF[from]!;
	const p = (o.parts ?? {}) as Record<string, unknown>;
	const sh = (p.shows ?? {}) as Record<string, unknown>;
	const e = (o.expr ?? {}) as Record<string, unknown>;
	const label = text(e.label, 300);
	const color = text(e.color, 300);
	const icon = text(e.icon, 300);
	const css = text(o.css, 20_000);
	const code = text(o.code, 50_000);
	return {
		id: o.id,
		name: text(o.name, 60)?.trim() || 'A drawing',
		family,
		from,
		parts: {
			shape: oneOf(p.shape, ['card', 'tile', 'disc', 'line'], base.shape),
			fill: oneOf(p.fill, ['none', 'level', 'color'], base.fill),
			shows: {
				icon: bool(sh.icon, base.shows.icon),
				name: bool(sh.name, base.shows.name),
				state: bool(sh.state, base.shows.state),
				level: bool(sh.level, base.shows.level),
				bar: bool(sh.bar, base.shows.bar)
			},
			tap: oneOf(p.tap, ['switch', 'open', 'none'], base.tap),
			onInk: oneOf(p.onInk, ['own', 'theme'], base.onInk)
		},
		expr: {
			...(label ? { label } : {}),
			...(color ? { color } : {}),
			...(icon ? { icon } : {})
		},
		...(css ? { css } : {}),
		...readSize(o.size),
		...(code ? { code } : {})
	};
}

/** A new made drawing's id from its name, unlike the look's others. */
export function madeId(name: string, made: readonly MadeDrawing[]): string {
	const stem =
		name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 40) || 'drawing';
	let id = stem;
	for (let n = 2; made.some((m) => m.id === id) || id === 'classic' || id === 'lit'; n++)
		id = `${stem}-${n}`;
	return id;
}

/** Whether a look has a made drawing with code: only an admin may save or import one (§6.4, S4). */
export const hasCode = (l: Pick<Look, 'made'>): boolean => l.made.some((d) => !!d.code);

/**
 * A look from untrusted data (a document, an imported file), or why it isn't
 * one. What it leaves out is filled from the look it was made from, else
 * Classic, so every look is complete (§11: there is no blank look).
 */
/**
 * A look's areas, read: rows of areas with known ids, none repeated, each at
 * least a column and each row no wider than 12. Anything else, none: Lit's.
 */
export function readAreas(v: unknown): Area[][] | undefined {
	if (!Array.isArray(v)) return undefined;
	const seen = new Set<string>();
	const rows: Area[][] = [];
	for (const row of v) {
		if (!Array.isArray(row)) return undefined;
		const out: Area[] = [];
		for (const a of row) {
			const x = (a ?? {}) as Record<string, unknown>;
			const w = Number(x.w);
			if (typeof x.id !== 'string' || !ID.test(x.id) || seen.has(x.id)) return undefined;
			if (!Number.isInteger(w) || w < 1 || w > 12) return undefined;
			seen.add(x.id);
			out.push({ id: x.id, name: typeof x.name === 'string' ? x.name.slice(0, 40) : x.id, w });
		}
		if (out.length === 0 || out.reduce((n, a) => n + a.w, 0) > 12) return undefined;
		rows.push(out);
	}
	return rows.length ? rows : undefined;
}

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
	const made = Array.isArray(o.made)
		? o.made
				.flatMap((m) => readMade(m) ?? [])
				.filter((m, i, all) => all.findIndex((x) => x.id === m.id) === i)
		: base.made;
	// A drawing it can use: built in, made in this look, or a plugin's.
	const usable = (fam: Family, d: unknown) =>
		DRAWINGS[fam].some((x) => x.id === d) ||
		made.some((m) => m.id === d && m.family === fam) ||
		isPluginRef(d) ||
		isExtRef(d);
	const drawings: Partial<Record<Family, string>> = { ...base.drawings };
	for (const fam of FAMILIES) if (!usable(fam, drawings[fam])) delete drawings[fam];
	if (o.drawings && typeof o.drawings === 'object')
		for (const fam of FAMILIES) {
			const d = (o.drawings as Record<string, unknown>)[fam];
			if (usable(fam, d)) drawings[fam] = d as string;
		}
	// Options for plugins' and extensions' drawings: on or off, by name.
	let options: Look['options'];
	if (o.options && typeof o.options === 'object')
		for (const [d, v] of Object.entries(o.options as Record<string, unknown>)) {
			if (!(isExtRef(d) || isPluginRef(d)) || !v || typeof v !== 'object') continue;
			const kept = Object.fromEntries(
				Object.entries(v as Record<string, unknown>).filter(
					(e): e is [string, boolean] =>
						/^[a-z][a-zA-Z0-9_]{0,31}$/.test(e[0]) && typeof e[1] === 'boolean'
				)
			);
			if (Object.keys(kept).length) (options ??= {})[d] = kept;
		}
	const fr = (o.frame ?? {}) as Record<string, unknown> & {
		rest?: { on?: unknown; after?: unknown; piece?: unknown };
	};
	const rest = {
		on: typeof fr.rest?.on === 'boolean' ? fr.rest.on : base.frame.rest.on,
		after:
			typeof fr.rest?.after === 'number' && fr.rest.after >= 10
				? Math.round(fr.rest.after)
				: base.frame.rest.after
	};
	// A plugin's rest view, its own or the one it was made from's; null takes it off.
	const piece = fr.rest?.piece === undefined ? base.frame.rest.piece : fr.rest.piece;
	const restWith = isPluginRef(piece) ? { ...rest, piece } : rest;
	// The frame it puts the app in: its own, else the one it was made from's.
	const shell: Shell | undefined =
		fr.shell === 'standard' || fr.shell === 'console' ? fr.shell : base.frame.shell;
	const g = (o.grouping ?? {}) as { room?: unknown; home?: unknown; areas?: unknown };
	const areas = g.areas === undefined ? base.grouping.areas : readAreas(g.areas);
	let home = base.grouping.home;
	if (g.home === null) home = undefined;
	else if (g.home && typeof g.home === 'object') {
		const h = g.home as Record<string, unknown>;
		const ids = (v: unknown) =>
			Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && ID.test(x)) : [];
		home = {
			order: ids(h.order),
			hidden: ids(h.hidden),
			layout: oneOf(h.layout, ['list', 'field', 'tiles'], 'list')
		};
	}
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
					...(x.headless === true ? { headless: true } : {}),
					...(typeof x.area === 'string' && ID.test(x.area) ? { area: x.area } : {}),
					...(typeof x.stack === 'number' && x.stack >= 2 && x.stack <= 50
						? { stack: Math.round(x.stack) }
						: {})
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
		ownColors: bool(o.ownColors, base.ownColors),
		feel: {
			density: oneOf(f.density, ['roomy', 'standard', 'compact'], base.feel.density),
			corners: oneOf(f.corners, ['square', 'soft', 'round'], base.feel.corners),
			type,
			motion: oneOf(f.motion, ['still', 'gentle', 'lively'], base.feel.motion)
		},
		drawings,
		...(options ? { options } : {}),
		made,
		frame: {
			header: isPluginRef(fr.header)
				? fr.header
				: oneOf(fr.header, ['glow', 'plain'], base.frame.header),
			chips: bool(fr.chips, base.frame.chips),
			needs: bool(fr.needs, base.frame.needs),
			more: bool(fr.more, base.frame.more),
			sheet: bool(fr.sheet, base.frame.sheet),
			rest: restWith,
			...(shell ? { shell } : {})
		},
		grouping: {
			...(room ? { room } : {}),
			...(home ? { home } : {}),
			...(areas ? { areas } : {})
		},
		reaches: o.reaches === 'everywhere' ? 'everywhere' : 'household',
		version: 1
	};
}

/**
 * Whether a screen is one of the household's pages, which every look reaches
 * (S9): Home, rooms, the house's own pages, scenes, alerts. Settings, Me and
 * the admin screens are reached only by a look that says "everywhere".
 */
export const householdPage = (path: string): boolean =>
	path === '/' || /^\/(rooms|pages|scenes|alerts)(\/|$)/.test(path);

/** Whether a look reaches this screen. */
export const reachesHere = (l: Look, path: string): boolean =>
	l.reaches === 'everywhere' || householdPage(path);

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
