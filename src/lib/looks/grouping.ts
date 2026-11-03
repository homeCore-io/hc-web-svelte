/**
 * A room grouped by a look's rules (13 §8): the room made into the page
 * document, so it is drawn by the one renderer and arranged like any page.
 * Loaded only for a look that groups rooms its own way, so Home carries none
 * of it.
 *
 * Each rule makes a section, taking what it names; a thing goes to the first
 * rule that takes it, and what no rule takes goes to "Also here", so a
 * grouping can't lose a device (principle 6). Sections keep their rules' ids,
 * and each look keeps its own arrangements (§8.4).
 */
import { cardFor, type CardView } from '../card.js';
import type { Card, Page, Section } from '../page.js';
import { roomPage, type RoomInput } from '../page.js';
import { byRoom } from '../summary.js';
import { ref } from '../layers.js';
import { isGroup, litRoom } from '../lit/room.js';
import type { Frame, Place, Rule, Take } from './model.js';

const FIELD: Record<Place, Section['field']> = {
	band: { column: 'band' },
	main: { column: 'main', movable: true },
	side: { column: 'side', movable: true }
};

/** A room as a look's rules group it. */
export function groupRoom(
	id: string,
	h: RoomInput,
	given: readonly Rule[],
	frame?: Pick<Frame, 'needs' | 'more'>
): Page {
	// The frame can leave out what needs someone, and unfold what's rarely used (13 §7).
	const rules = given
		.filter((r) => frame?.needs !== false || !r.takes.includes('needs'))
		.map((r) =>
			frame?.more === false && r.layout === 'fold'
				? { ...r, layout: 'grid' as const, headless: false }
				: r
		);
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
	const sorted = litRoom(cards, views);

	// What each take holds; pieces are cards of their own (§7).
	const holds: Record<Take, Card[]> = {
		header: [{ ref: `piece:roomhead/${id}`, kind: 'roomhead', id, name, devices: inRoom }],
		needs: [{ ref: `piece:needs/${id}`, kind: 'needs', id, devices: inRoom }],
		doors: sorted.doors,
		lights: sorted.lights.map((l) =>
			isGroup(l)
				? {
						ref: `group:${l.name}`,
						kind: 'lampgroup' as const,
						name: l.name,
						devices: l.members.map((m) => m.card.device)
					}
				: l.card
		),
		'switches.lights': sorted.switches.lights.map((l) => l.card),
		'switches.power': sorted.switches.power.map((l) => l.card),
		scenes: sorted.scenes.map((s) => s.card),
		readings: sorted.readings.map((r) => r.card),
		watching: sorted.watch.map((w) => w.card),
		rest: sorted.rest,
		more: sorted.more
	};
	const taken = new Set<Take>();
	const sections: Section[] = rules.map((r) => {
		const mine = r.takes.filter((t) => !taken.has(t));
		for (const t of mine) taken.add(t);
		const piece = mine.some((t) => t === 'header' || t === 'needs');
		return {
			id: r.id,
			title: r.title,
			layout: r.layout,
			cards: mine.flatMap((t) => holds[t]),
			field: FIELD[r.place],
			accepts: !piece,
			...(piece ? {} : { hint: 'Nothing here now. Move a card in from another section.' }),
			...(r.headless ? { headless: true } : {})
		};
	});
	// What the household added from elsewhere, as Classic has it, and what no rule took.
	const left = (Object.keys(holds) as Take[])
		.filter((t) => !taken.has(t) && t !== 'header' && t !== 'needs')
		.flatMap((t) => holds[t]);
	const added = classic.sections.find((s) => s.id === 'added');
	if (added || left.length)
		sections.push({
			...(added ?? { id: 'added', title: 'Also here', layout: 'grid', accepts: true }),
			cards: [...left, ...(added?.cards ?? [])],
			field: FIELD.side
		});

	return { id: `room:${id}`, sections, cardTools: true, columns: true };
}
