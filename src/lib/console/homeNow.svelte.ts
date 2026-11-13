/**
 * Home in the console's look, live: what the desktop's Home (ConsoleHome)
 * and the phone's (phone/PhoneHome) show and do. The day and the weather
 * outside; every room as a tile, its drawing or photo lit by its lights
 * (home.ts, pictures.ts, photo.ts), in Home's order; the house in a line;
 * what needs attention, with its fix; the person's favorites and Every light
 * off; and what's playing.
 *
 * Made while a page is set up.
 */
import { goto } from '$app/navigation';
import { houseNow } from '#lib/houseNow.svelte.js';
import { page } from '$app/state';
import { devices } from '#lib/devices.svelte.js';
import { rooms } from '#lib/rooms.svelte.js';
import { scenes, type CoreScene } from '#lib/scenes.svelte.js';
import { personal } from '#lib/personal.svelte.js';
import { household } from '#lib/household.svelte.js';
import { alerts } from '#lib/alerts.svelte.js';
import { session } from '#lib/me.svelte.js';
import { view } from '#lib/view.svelte.js';
import { clock } from '#lib/clock.svelte.js';
import { commands } from '#lib/commands.svelte.js';
import { kindOptions } from '#lib/kindOptions.svelte.js';
import { ask } from '#lib/confirm.svelte.js';
import { goAhead } from '#lib/ask.js';
import { homeRoomOrder, ref } from '#lib/layers.js';
import { cardFor, kindOf } from '#lib/card.js';
import { displayName, type CoreDevice } from '#lib/devices.js';
import { ROOM_BUILT_IN } from '#lib/options.js';
import {
	degrees,
	outdoorStation,
	outsideTemperature,
	percent,
	readingOf,
	roomBox
} from '#lib/roomBox.js';
import { openDevice } from '#lib/popup.js';
import { roomPicture } from './pictures.js';
import { photoGlow, photoSpots } from './photo.js';
import { roomIn } from './layout.js';
import { devicesIn, tabChoicesOf } from './room.js';
import { byRoom } from '#lib/summary.js';
import { lightsCount, whereLit } from '#lib/lights.js';
import { everyRoom, lightRows, placesOf } from './everywhere.js';
import { everyLightOff as allOff } from './switchLights.js';
import {
	favoritesOf,
	houseLine,
	issuesOf,
	playingOf,
	tileOf,
	working,
	type Issue
} from './home.js';

const wants = (id: string) => commands.pending[id]?.want;

export class HomeNow {
	may = $derived(session.mayUse);

	// ---- the greeting ----
	at = $derived(new Date(clock.now));
	day = $derived(
		this.at.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
	);
	time = $derived(this.at.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }));
	night = $derived(this.at.getHours() < 6 || this.at.getHours() >= 19);

	// ---- the weather outside: the house's station, and a weather plugin's words ----
	outside = $derived(degrees(outsideTemperature(devices.byId)));
	station = $derived(outdoorStation(devices.byId));
	humidity = $derived(this.station ? percent(readingOf(this.station, 'humidity')) : undefined);
	#forecast = $derived(
		Object.values(devices.byId).find(
			(d) => kindOf(d) === 'weather' && typeof d.attributes.condition === 'string'
		)
	);
	condition = $derived(this.#forecast?.attributes.condition as string | undefined);
	cloudy = $derived(/cloud|overcast|rain|snow|fog|drizzle|storm|mist/i.test(this.condition ?? ''));
	partly = $derived(/partly|mostly sunny|few/i.test(this.condition ?? ''));

	// ---- every room, as a tile ----
	#order = $derived(homeRoomOrder(rooms.list, (r) => ref.room(r.id), view.changes('home')).shown);
	// The house's lights, as every place counts them (lights.ts): every room's,
	// shown on Home or not, and those in no room, as Everywhere › Lights has them.
	#lightRows = $derived(
		lightRows(
			placesOf(
				byRoom(devices.byId, rooms.list),
				everyRoom(this.#order, rooms.list),
				tabChoicesOf(household.doc.console?.tabs),
				(id) => roomIn(household.doc.console?.rooms, id).links
			)
		).map((r) => ({ room: r.place.room, name: r.place.name, lights: r.lights }))
	);
	tiles = $derived(
		this.#order.map((room) => {
			const list = devicesIn(devices.byId, room);
			const cards = list.map((d) => cardFor(d, clock.now));
			const box = roomBox(
				list,
				cards,
				devices.byId,
				kindOptions.of('home', 'room', ref.room(room.id), ROOM_BUILT_IN),
				houseNow.lightIds
			);
			const lay = roomIn(household.doc.console?.rooms, room.id);
			const lit = roomPicture(room.name, list, clock.now, wants, lay.links, devices.byId);
			// The household may have chosen the room plain, with no drawing, or its photo (layout.ts).
			const plain = lay.picture === 'plain';
			const photo = lay.picture === 'photo' ? household.photoOf(room.id) : undefined;
			const glow = photo
				? photoGlow(photoSpots(lay.spots, lit.picture, lit.spots), devices.byId, clock.now, wants)
				: [];
			return {
				room,
				list,
				cards,
				...tileOf(
					room,
					list,
					cards,
					box,
					this.#lightRows.find((r) => r.room?.id === room.id)?.lights ?? [],
					wants
				),
				...lit,
				plain,
				photo,
				glow
			};
		})
	);

	// ---- the house in a line ----
	#all = $derived(Object.values(devices.byId));
	lights = $derived(lightsCount(this.#lightRows, commands.pending));
	lightsOn = $derived(this.lights.on);
	issues = $derived(
		issuesOf(
			this.tiles.map((t) => ({ room: t.room, cards: t.cards })),
			alerts.list,
			this.#all,
			rooms.list
		)
	);
	playing = $derived(playingOf(this.#all, rooms.list, (d) => cardFor(d, clock.now).nowPlaying));
	line = $derived(
		houseLine({
			lights: this.lights,
			playing: this.playing.filter((p) => p.playing).length,
			working: this.#all.filter((d) => working(d) !== undefined).length,
			issues: this.issues.filter((i) => i.key !== 'rest').length
		})
	);

	// ---- what needs attention ----
	fix = async (i: Issue): Promise<void> => {
		if ('href' in i.fix) return void goto(i.fix.href);
		const d = devices.byId[i.fix.lock];
		if (!d || !this.may) return;
		void commands.set(d.device_id, kindOf(d), { locked: true }, d.attributes);
	};

	// ---- favorites ----
	favs = $derived(favoritesOf(personal.doc.favourites ?? [], devices.byId, scenes.list));
	busy = $state(false);
	trouble = $state<string | null>(null);
	/**
	 * Every light in the house off, after asking: the same lights Everywhere ›
	 * Lights turns off, in every room (shown on Home or not) and in no room.
	 */
	everyLightOff = async (): Promise<void> => {
		const n = this.lights.on;
		if (this.busy || n === 0) return;
		const ok = await ask({
			title: 'Turn every light off?',
			body: `${n === 1 ? 'The one light on goes' : `All ${n} lights on ${whereLit(this.lights)} go`} off. Room on brings a room back as it was.`,
			go: 'Turn them off'
		});
		if (!ok) return;
		this.busy = true;
		this.trouble = null;
		this.trouble = await allOff(this.#lightRows);
		this.busy = false;
	};
	useDevice = async (d: CoreDevice): Promise<void> => {
		const c = cardFor(d, clock.now);
		if (c.kind === 'scene' && d.schema?.actions?.some((a) => a.id === 'activate'))
			return void commands.act(d.device_id, 'activate');
		if (c.control?.kind === 'lock' && this.may && d.available) {
			if (c.control.locked) {
				if (!(await goAhead(d.device_id, c.kind, `Unlock ${displayName(d)}?`))) return;
				return void commands.set(d.device_id, c.kind, { locked: false }, d.attributes);
			}
			return void commands.set(d.device_id, c.kind, { locked: true }, d.attributes);
		}
		if (c.control?.kind === 'switch' && this.may && d.available)
			return void commands.set(
				d.device_id,
				c.kind,
				{ [c.control.attr]: !c.control.on },
				d.attributes
			);
		openDevice(d.device_id, page.url);
	};
	runScene = async (s: CoreScene): Promise<void> => {
		const done = await scenes.run(s.id);
		this.trouble = done === true ? null : `${s.name} didn’t run: ${done}.`;
	};
}
