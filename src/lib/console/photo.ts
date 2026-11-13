/**
 * A room's photo in the console (the PhotoAvatar board): the household's
 * picture of the room behind its header and on its tile on Home, with light
 * spots laid over it that glow as the drawings' do (pictures.ts).
 *
 * A photo starts with the drawing's spots: each one that shows a device
 * becomes a spot on the photo, where it sits in the drawing, in percent
 * across and down. The household then moves them to where the lights are in
 * the photo, picks their devices and how far they glow (Customize).
 *
 * Pure: the photo draws what this decides.
 */
import type { CoreDevice } from '../devices.js';
import type { GlowSize, PhotoSpot } from './layout.js';
import {
	fits,
	op,
	PICTURES,
	spotValue,
	type PictureId,
	type SpotKind,
	type Wants
} from './pictures.js';

/**
 * Where each drawing's spots sit, in percent across and down its picture:
 * the middle of the fixture, or of its glow where the fixture is off the top.
 */
export const SPOT_AT: Record<PictureId, Record<string, [number, number]>> = {
	family: {
		over: [70, 16],
		floor: [47.8, 18],
		small: [83, 55],
		desk: [97, 44],
		hol: [60, 5],
		fan: [70, 12]
	},
	living: {
		c1: [52, 6],
		c2: [78, 6],
		floor: [47, 32],
		floor2: [42, 28],
		sofa: [62, 56],
		tower: [56, 16],
		arch: [70, 24],
		strip: [90, 52],
		hol: [64, 5],
		tv: [90, 45],
		door: [12, 48],
		lock: [17, 48]
	},
	office: {
		over: [64, 8],
		c1: [52, 6],
		c2: [76, 6],
		odl: [56, 60],
		dl: [70, 60],
		tv: [88, 45]
	},
	garage: {
		ceil: [62, 6],
		bench: [90, 60],
		zone: [38, 6],
		heat: [96, 80],
		oh1: [51.5, 55],
		oh2: [74.5, 55]
	},
	kitchen: { p1: [38, 45], p2: [62, 45], ucl: [21, 40], ucr: [71, 40] },
	bedroom: { fan: [56, 6], lampL: [38, 48], lampR: [76, 48] },
	bathroom: { vanity: [53, 28], ceil: [56, 5] },
	hallway: { c1: [18, 10], c2: [50, 22], c3: [82, 10] },
	laundry: { ceil: [50, 6] },
	dining: { chand: [50, 30], buffet: [86, 48] },
	attic: { bulb: [50, 40] },
	equipment: { ceil: [50, 6] },
	outside: { porch: [41.5, 64], flood: [62, 48], path: [21, 84] },
	plain: { ceil: [62, 6] }
};

export const GLOW_SIZES: readonly { id: GlowSize; name: string }[] = [
	{ id: 's', name: 'Small' },
	{ id: 'm', name: 'Medium' },
	{ id: 'l', name: 'Large' }
];

/** How far each size reaches, against a medium glow. */
export const GLOW_SCALE: Record<GlowSize, number> = { s: 0.6, m: 1, l: 1.6 };

/** Each kind's glow on a photo. */
export const GLOW_COLOR: Record<SpotKind, string> = {
	light: 'rgba(255, 200, 120, 0.75)',
	holiday: 'rgba(255, 120, 120, 0.6)',
	screen: 'rgba(110, 150, 255, 0.6)',
	fan: 'rgba(225, 235, 255, 0.35)',
	door: 'rgba(255, 138, 91, 0.6)',
	lock: 'rgba(79, 224, 160, 0.5)',
	heat: 'rgba(255, 107, 74, 0.6)'
};

/** A light from the ceiling, or across the yard, reaches further than a lamp. */
const BIG = /overhead|ceiling|chandelier|flood|bulb|fan/i;
const SMALL = /strip|path|under|holiday|lock/i;

const sizeOf = (name: string): GlowSize | undefined =>
	BIG.test(name) ? 'l' : SMALL.test(name) ? 's' : undefined;

/**
 * A photo's first spots, from the drawing's: each spot that shows a device,
 * where it sits in the drawing. A spot showing several devices gets one
 * spot each, side by side. With none, one spot for the household to place.
 */
export function seedSpots(picture: PictureId, spots: Map<string, CoreDevice[]>): PhotoSpot[] {
	const at = SPOT_AT[picture];
	const out: PhotoSpot[] = [];
	for (const s of PICTURES[picture].spots) {
		const [x, y] = at[s.id] ?? [50, 50];
		const size = sizeOf(s.name);
		(spots.get(s.id) ?? []).forEach((d, i) =>
			out.push({
				x: Math.min(100, x + i * 4),
				y,
				device: d.device_id,
				...(size ? { size } : {})
			})
		);
	}
	if (out.length > 0) return out;
	const first = PICTURES[picture].spots[0];
	const [x, y] = (first && at[first.id]) ?? [50, 50];
	return [{ x, y }];
}

/** The spots a photo has: the household's, else those seeded from the drawing. */
export const photoSpots = (
	saved: PhotoSpot[] | undefined,
	picture: PictureId,
	spots: Map<string, CoreDevice[]>
): PhotoSpot[] => saved ?? seedSpots(picture, spots);

const KINDS: SpotKind[] = ['light', 'screen', 'fan', 'door', 'lock', 'heat'];

/** What a device shows as on a photo: a light, a screen, a door…; none for a sensor. */
export const kindFor = (d: CoreDevice): SpotKind | undefined => KINDS.find((k) => fits(k, d));

/** A spot on the photo as it's drawn: where, its glow's color and size, and how bright. */
export interface SpotGlow {
	x: number;
	y: number;
	color: string;
	scale: number;
	/** The glow's opacity, as a drawing's: 0 when off. */
	opacity: number;
	/** Whether it's a light that's on: a photo with none is drawn dimmer. */
	lit: boolean;
}

/**
 * How the photo is lit now: each spot's glow, as the drawings work it out
 * (`spotValue`, `op`). A spot with no device, or one no longer here, is dark.
 */
export function photoGlow(
	spots: PhotoSpot[],
	byId: Record<string, CoreDevice | undefined>,
	now: number,
	wants: Wants = () => undefined
): SpotGlow[] {
	return spots.map((s) => {
		const d = s.device ? byId[s.device] : undefined;
		const kind = d ? kindFor(d) : undefined;
		const v = d && kind ? spotValue(kind, d, now, wants(d.device_id)) : 0;
		return {
			x: s.x,
			y: s.y,
			color: GLOW_COLOR[kind ?? 'light'],
			scale: GLOW_SCALE[s.size ?? 'm'],
			opacity: op(v),
			lit: kind === 'light' && v > 0
		};
	});
}

/** Whether any light in the photo is on: a tile with none is drawn dimmer. */
export const photoLit = (g: SpotGlow[]): boolean => g.some((s) => s.lit);

/** A spot moved by the arrow keys, kept on the photo. */
export function nudgeSpot(s: PhotoSpot, dx: number, dy: number): PhotoSpot {
	const clamp = (v: number) => Math.round(Math.min(100, Math.max(0, v)) * 10) / 10;
	return { ...s, x: clamp(s.x + dx), y: clamp(s.y + dy) };
}

/** Which part of a photo stays in view, by the picker's `focus` (0 to 8): each way, 0 to 1. */
export const focusOf = (focus = 4): [number, number] => {
	const f = Number.isInteger(focus) && focus >= 0 && focus <= 8 ? focus : 4;
	return [(f % 3) / 2, Math.floor(f / 3) / 2];
};

/**
 * Where a photo is drawn to cover a box, cut to fit: its left, top, width and
 * height, in the box's pixels. Spots sit on the photo, not the box, so they
 * stay on their lights however the header or a tile crops it.
 */
export function coverFrame(
	box: { w: number; h: number },
	img: { w: number; h: number },
	focus?: number
): { left: number; top: number; width: number; height: number } {
	if (!(img.w > 0 && img.h > 0 && box.w > 0 && box.h > 0))
		return { left: 0, top: 0, width: box.w, height: box.h };
	const k = Math.max(box.w / img.w, box.h / img.h);
	const width = img.w * k;
	const height = img.h * k;
	const [fx, fy] = focusOf(focus);
	return { left: (box.w - width) * fx || 0, top: (box.h - height) * fy || 0, width, height };
}
