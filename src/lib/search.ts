/**
 * One search for everything (N8): devices, rooms, scenes and the app's own
 * pages — and, for those who may change the house, its rules and every
 * Settings page (A7, as the Flutter console's palette did).
 *
 * Ranked so typing the start of a name wins: "kit" finds the Kitchen before
 * anything that merely contains "kit". Every word typed must match somewhere
 * (name, room, or kind), so "office lamp" narrows rather than widens.
 */
import { kindOf } from './card.js';
import { displayName, type CoreDevice } from './devices.js';
import type { Room } from './house.js';
import { roomOf } from './summary.js';

export type Hit =
	| { type: 'device'; id: string; title: string; detail: string }
	| { type: 'room'; id: string; title: string; detail: string }
	| { type: 'scene'; id: string; title: string; detail: string }
	| { type: 'page'; href: string; title: string; detail: string };

export interface Corpus {
	devices: CoreDevice[];
	rooms: Room[];
	scenes: { id: string; name: string }[];
	pages: { href: string; title: string }[];
	/** Rules, by name — for those who may see them. */
	rules?: { id: string; name: string }[];
	/** Settings pages — for admins. */
	settings?: { slug: string; label: string; words: string }[];
}

interface Entry {
	hit: Hit;
	/** Lower-cased words the query must find. */
	name: string;
	extra: string;
}

const KIND_WORDS: Record<string, string> = {
	media_player: 'tv speaker media player',
	contact_sensor: 'door window contact sensor',
	water_sensor: 'water leak sensor',
	motion_sensor: 'motion sensor',
	occupancy_sensor: 'occupancy presence sensor',
	temperature_sensor: 'temperature sensor thermometer',
	pico_remote: 'pico remote',
	scene: 'scene'
};

function entries(c: Corpus): Entry[] {
	const out: Entry[] = [];
	for (const d of c.devices) {
		const kind = kindOf(d);
		const room = roomOf(d, c.rooms)?.name;
		const words = KIND_WORDS[kind] ?? kind.replace(/_/g, ' ');
		const type = kind === 'scene' ? 'scene' : 'device';
		out.push({
			hit: {
				type,
				id: d.device_id,
				title: displayName(d),
				detail: [room, type === 'scene' ? 'Scene' : cap(words.split(' ')[0] ?? '')]
					.filter(Boolean)
					.join(' · ')
			},
			name: displayName(d).toLowerCase(),
			extra: `${room ?? ''} ${words} ${d.name.toLowerCase()}`.toLowerCase()
		});
	}
	for (const r of c.rooms) {
		out.push({
			hit: { type: 'room', id: r.id, title: r.name, detail: 'Room' },
			name: r.name.toLowerCase(),
			extra: 'room'
		});
	}
	for (const s of c.scenes) {
		out.push({
			hit: { type: 'scene', id: s.id, title: s.name, detail: 'Scene' },
			name: s.name.toLowerCase(),
			extra: 'scene'
		});
	}
	for (const p of c.pages) {
		out.push({
			hit: { type: 'page', href: p.href, title: p.title, detail: 'Page' },
			name: p.title.toLowerCase(),
			extra: 'page'
		});
	}
	for (const r of c.rules ?? []) {
		out.push({
			hit: {
				type: 'page',
				href: `/settings/automations/${encodeURIComponent(r.id)}`,
				title: r.name,
				detail: 'Rule'
			},
			name: r.name.toLowerCase(),
			extra: 'rule automation'
		});
	}
	for (const st of c.settings ?? []) {
		out.push({
			hit: { type: 'page', href: `/settings/${st.slug}`, title: st.label, detail: 'Settings' },
			name: st.label.toLowerCase(),
			extra: `settings ${st.words}`.toLowerCase()
		});
	}
	return out;
}

/** How well one word matches an entry; 0 is not at all. */
function score(word: string, e: Entry): number {
	if (e.name === word) return 100;
	if (e.name.startsWith(word)) return 60;
	if (e.name.split(/[\s\-_.]+/).some((w) => w.startsWith(word))) return 40;
	if (e.name.includes(word)) return 20;
	if (e.extra.split(/\s+/).some((w) => w.startsWith(word))) return 10;
	return 0;
}

const TYPE_RANK: Record<Hit['type'], number> = { room: 3, device: 2, scene: 1, page: 0 };

export function search(query: string, corpus: Corpus, limit = 20): Hit[] {
	const words = query.toLowerCase().split(/\s+/).filter(Boolean);
	if (words.length === 0) return [];
	return entries(corpus)
		.map((e) => {
			let total = 0;
			for (const w of words) {
				const s = score(w, e);
				if (s === 0) return { e, total: 0 };
				total += s;
			}
			return { e, total: total + TYPE_RANK[e.hit.type] };
		})
		.filter((x) => x.total > 0)
		.sort((a, b) => b.total - a.total || a.e.hit.title.localeCompare(b.e.hit.title))
		.slice(0, limit)
		.map((x) => x.e.hit);
}

function cap(s: string): string {
	return s === '' ? s : s[0]!.toUpperCase() + s.slice(1);
}
