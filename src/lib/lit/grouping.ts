/**
 * Lit's grouping of a room (13 §8): the room made into the page document, so
 * it is drawn by the one renderer and arranged like any page. Loaded only in
 * Lit, by the room's page, so Home carries none of it.
 *
 * Its sections have ids of their own (`doors`, `lights`, …); each look keeps
 * its own arrangements (§8.4), so they needn't match Classic's.
 */
import { cardFor, type CardView } from '../card.js';
import type { Card, Page, Section } from '../page.js';
import { roomPage, type RoomInput } from '../page.js';
import { byRoom } from '../summary.js';
import { ref } from '../layers.js';
import { isGroup, litRoom } from './room.js';

const MAIN = { column: 'main', movable: true } as const;
const SIDE = { column: 'side', movable: true } as const;
const BAND = { column: 'band' } as const;

const section = (
	id: string,
	title: string,
	layout: Section['layout'],
	cards: Card[],
	field: Section['field'],
	extra: Partial<Section> = {}
): Section => ({
	id,
	title,
	layout,
	cards,
	field,
	accepts: true,
	hint: 'Nothing here now. Move a card in from another section.',
	...extra
});

/** A room as Lit draws it: header, what needs someone, doors, lights, switches, scenes, readings, Watching, the rest, More. */
export function litRoomPage(id: string, h: RoomInput): Page {
	const classic = roomPage(id, h);
	const inRoom = byRoom(h.devices, h.rooms).get(id === 'none' ? '' : id) ?? [];
	const name = id === 'none' ? 'Not in a room' : (h.rooms.find((r) => r.id === id)?.name ?? '');
	const cards: (Card & { kind: 'device' })[] = inRoom.map((d) => ({
		ref: ref.device(d.device_id),
		kind: 'device',
		device: d,
		scene:
			cardFor(d, h.now).kind === 'scene' &&
			(d.schema?.actions?.some((a) => a.id === 'activate') ?? false),
		form: cardFor(d, h.now).kind === 'media_player' ? 'large' : undefined
	}));
	const views: Record<string, CardView> = Object.fromEntries(
		cards.map((c) => [c.ref, cardFor(c.device, h.now)])
	);
	const lit = litRoom(cards, views);
	const sceneCards = lit.scenes.map((s) => s.card);
	const lights: Card[] = lit.lights.map((l) =>
		isGroup(l)
			? {
					ref: `group:${l.name}`,
					kind: 'lampgroup',
					name: l.name,
					devices: l.members.map((m) => m.card.device)
				}
			: l.card
	);

	const sections: Section[] = [
		section(
			'head',
			'Header',
			'list',
			[{ ref: `piece:roomhead/${id}`, kind: 'roomhead', id, name, devices: inRoom }],
			BAND,
			{ headless: true, accepts: false, hint: undefined }
		),
		section(
			'needs',
			'Needs you',
			'list',
			[{ ref: `piece:needs/${id}`, kind: 'needs', id, devices: inRoom }],
			BAND,
			{
				headless: true,
				accepts: false,
				hint: undefined
			}
		),
		section('doors', 'Doors and locks', 'grid', lit.doors, BAND),
		section('lights', 'Lights', 'grid', lights, MAIN),
		section(
			'switches',
			'Switches',
			'panel',
			lit.switches.lights.map((l) => l.card),
			MAIN
		),
		section(
			'power',
			'Power and water',
			'panel',
			lit.switches.power.map((l) => l.card),
			MAIN
		),
		section('scenes', 'Scenes', 'swatches', sceneCards, MAIN),
		section(
			'readings',
			'Readings',
			'grid',
			lit.readings.map((r) => r.card),
			SIDE
		),
		section(
			'watching',
			'Watching',
			'lines',
			lit.watch.map((w) => w.card),
			SIDE
		),
		section('things', 'Everything else', 'grid', lit.rest, SIDE),
		section('more', 'More in this room', 'fold', lit.more, SIDE, { headless: true })
	];
	// What the household added from elsewhere, as Classic has it ("Also here").
	const added = classic.sections.find((s) => s.id === 'added');
	if (added) sections.push({ ...added, field: SIDE });

	return { id: `room:${id}`, sections, cardTools: true, columns: true };
}
