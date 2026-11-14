/**
 * A room in the console's look, live: what its page shows and does, for the
 * desktop's room (ConsoleRoom) and the phone's (phone/PhoneRoom) alike. The
 * room as the person and the household arranged it (layout.ts), its tabs
 * (room.ts), its drawing or photo lit by its lights (pictures.ts, photo.ts),
 * its header's words and pills, Room on and Room off, its favorites, its
 * audio (media.ts) and what its cameras saw lately (cameras.ts).
 *
 * Made while a page is set up; the page keeps the tab shown and what's open.
 */
import { page } from '$app/state';
import { goto } from '$app/navigation';
import { nextTab } from '#lib/menuKeys.js';
import { houseNow } from '#lib/houseNow.svelte.js';
import { devices } from '#lib/devices.svelte.js';
import { rooms } from '#lib/rooms.svelte.js';
import { personal } from '#lib/personal.svelte.js';
import { household } from '#lib/household.svelte.js';
import { session } from '#lib/me.svelte.js';
import { view } from '#lib/view.svelte.js';
import { clock } from '#lib/clock.svelte.js';
import { commands } from '#lib/commands.svelte.js';
import { withPending } from '#lib/pending.js';
import { goAhead } from '#lib/ask.js';
import { roomPower } from '#lib/admin.js';
import { homeRoomOrder, ref } from '#lib/layers.js';
import { cardFor, kindOf, type CardView } from '#lib/card.js';
import type { CoreDevice } from '#lib/devices.js';
import { roomPowerLights } from '#lib/cameraLights.js';
import { openDevice } from '#lib/popup.js';
import { kindOptions } from '#lib/kindOptions.svelte.js';
import { ROOM_BUILT_IN } from '#lib/options.js';
import { roomBox } from '#lib/roomBox.js';
import { camEvents } from './camEvents.svelte.js';
import { allEvents, camerasOf, pillPrefsOf, pillsOf } from './cameras.js';
import { roomLights, roomPicture } from './pictures.js';
import { isLit } from '#lib/lights.js';
import { playingNow } from '#lib/playing.js';
import { photoGlow, photoSpots } from './photo.js';
import {
	audioChoices,
	muteCmd,
	orderPlayers,
	playerName,
	roomAudioOf,
	stepCmd,
	volumeCmd,
	volumeOf,
	withRoomAudio
} from './media.js';
import { send } from './send.js';
import { apart } from './apart.js';
import {
	brandOf,
	consoleRoom,
	devicesIn,
	LIGHTS_WIDTH,
	shortName,
	tabChoicesOf,
	type TabId
} from './room.js';
import { faderStyle, switchStyle } from './style.js';
import { arrangeTabs, resolve, roomIn, tabWith } from './layout.js';

export class RoomNow {
	#id: () => string;
	#across: () => number;

	/**
	 * `id` is the room's; `across`, the width its Lights tab has, in pixels,
	 * once the page knows it (0 until then: a laptop's).
	 */
	constructor(id: () => string, across: () => number) {
		this.#id = id;
		this.#across = across;
	}

	get id(): string {
		return this.#id();
	}
	/** The Lights tab's width, as the room lays it out (room.ts). */
	width = (): number => {
		const a = this.#across();
		return a > 0 ? a - 4 : LIGHTS_WIDTH;
	};

	room = $derived(rooms.list.find((r) => r.id === this.id));
	list = $derived(this.room ? devicesIn(devices.byId, this.room) : []);

	// ---- the room as the person and the household arranged it (layout.ts) ----
	#inRoom = $derived(new Set(this.list.map((d) => ref.device(d.device_id))));
	lay = $derived(
		resolve(
			roomIn(personal.doc.console?.rooms, this.id),
			roomIn(household.doc.console?.rooms, this.id),
			(personal.doc.favourites ?? []).filter((r) => this.#inRoom.has(r))
		)
	);
	#chosen = $derived(tabChoicesOf(household.doc.console?.tabs));
	// The room's lights, as Home, the sidebar and Everywhere count them (lights.ts).
	#lamps = $derived(
		roomLights(this.room?.name ?? '', this.list, devices.byId, {
			links: roomIn(household.doc.console?.rooms, this.id).links,
			chosen: this.#chosen
		})
	);
	model = $derived.by(() => {
		const lamps = new Set(this.#lamps);
		return consoleRoom(
			this.list,
			this.width(),
			this.#chosen,
			new Set(this.lay.off),
			devices.byId,
			(d) => lamps.has(d)
		);
	});
	arranged = $derived(arrangeTabs(this.model.tabs, this.lay));

	fader = $derived(faderStyle(personal.doc.console, household.doc.console));
	sw = $derived(switchStyle(personal.doc.console, household.doc.console));
	may = $derived(session.mayUse);

	card = (d: CoreDevice): CardView =>
		withPending(cardFor(d, clock.now), commands.pending[d.device_id]);
	nameOf = (d: CoreDevice): string => d.name_override ?? d.name;

	// ---- the rooms either side, in Home's order ----
	#order = $derived(homeRoomOrder(rooms.list, (r) => ref.room(r.id), view.changes('home')).shown);
	#at = $derived(this.#order.findIndex((r) => r.id === this.id));
	prev = $derived(this.#at > 0 ? this.#order[this.#at - 1] : undefined);
	next = $derived(
		this.#at >= 0 && this.#at < this.#order.length - 1 ? this.#order[this.#at + 1] : undefined
	);

	// ---- what the room is like now ----
	// The room's number, as its box on Home and the sidebar show it: its temperature.
	#box = $derived(
		roomBox(
			this.list,
			this.list.map((d) => cardFor(d, clock.now)),
			devices.byId,
			kindOptions.of('home', 'room', ref.room(this.id), ROOM_BUILT_IN),
			houseNow.lightIds
		)
	);
	temperature = $derived(this.#box.bigIs === 'lights' ? undefined : this.#box.big);
	// The room's drawing, lit as its lights are, with commands on their way.
	lit = $derived(
		roomPicture(
			this.room?.name ?? '',
			this.list,
			clock.now,
			(d) => commands.pending[d]?.want,
			this.lay.links,
			devices.byId
		)
	);
	// The household's photo, if it chose one and it's still there, lit by its spots.
	photo = $derived(this.lay.picture === 'photo' ? household.photoOf(this.id) : undefined);
	glow = $derived(
		this.photo
			? photoGlow(
					photoSpots(this.lay.spots, this.lit.picture, this.lit.spots),
					devices.byId,
					clock.now,
					(d) => commands.pending[d]?.want
				)
			: []
	);
	// Counted with commands on their way.
	#lampsOn = $derived(this.#lamps.filter((d) => isLit(d, commands.pending)).length);
	lightsWord = $derived(
		this.#lamps.length === 0
			? undefined
			: this.#lampsOn === 0
				? 'Lights off'
				: this.#lampsOn === 1
					? '1 light on'
					: `${this.#lampsOn} lights on`
	);
	// As every place counts it (playing.ts): a grouped speaker by its leader.
	playing = $derived(
		this.model.byTab.media.filter((d) =>
			playingNow(d, devices.byId, commands.pending[d.device_id]?.want)
		).length
	);

	// ---- locks and doors ----
	short = (s: string): string => shortName(s.replace(/\s+sensor$/i, ''), this.room?.name ?? '');
	async lockPill(d: CoreDevice): Promise<void> {
		const c = this.card(d);
		if (c.control?.kind !== 'lock' || !this.may) return openDevice(d.device_id, page.url);
		if (c.control.locked) {
			if (!(await goAhead(d.device_id, c.kind, `Unlock ${this.nameOf(d)}?`))) return;
			return void commands.set(d.device_id, c.kind, { locked: false }, d.attributes);
		}
		void commands.set(d.device_id, c.kind, { locked: true }, d.attributes);
	}
	/**
	 * A door's pill: the tab the door is on, while it is shown, else the door
	 * itself, so a pill never does nothing.
	 */
	openingPill(d: CoreDevice, choose: (t: TabId) => void): void {
		const t = tabWith(this.model.byTab, this.arranged.shown, d.device_id);
		if (t) choose(t);
		else openDevice(d.device_id, page.url);
	}
	/** What the pill says it does, for its title. */
	openingHint(d: CoreDevice): string {
		const t = tabWith(this.model.byTab, this.arranged.shown, d.device_id);
		const name = this.arranged.shown.find((x) => x.id === t)?.name;
		return name ? `See it on ${name}` : `Open ${this.nameOf(d)}`;
	}
	// Locks and doors as pills, but those the household left out.
	locks = $derived(this.model.locks.filter((d) => !this.lay.pillsOff.includes(d.device_id)));
	openings = $derived(this.model.openings.filter((d) => !this.lay.pillsOff.includes(d.device_id)));
	// Two pills with one name ("Test Door: Closed" twice) say which is which.
	#pillApart = $derived(
		apart([...this.locks, ...this.openings], (d) => this.short(this.nameOf(d)))
	);
	/** A lock's or door's name on its pill. */
	pillName = (d: CoreDevice): string => {
		const apartBy = this.#pillApart.get(d.device_id);
		return this.short(this.nameOf(d)) + (apartBy ? ` (${apartBy})` : '');
	};

	// ---- the tabs ----
	/** Shows tab `t` in place of the one shown; the address keeps it. */
	choose = (t: TabId): void => {
		const url = new URL(page.url.href);
		url.searchParams.set('tab', t);
		url.searchParams.delete('event');
		void goto(url.pathname + url.search, { replace: true, reset: false });
	};
	/** A camera's pill: the Cameras tab, at what it saw. */
	showEvent = (key: string): void => {
		const url = new URL(page.url.href);
		url.searchParams.set('tab', 'cameras');
		url.searchParams.set('event', key);
		void goto(url.pathname + url.search, { replace: true, reset: false });
	};
	/** The tabs' arrow keys, from `tab`: the next one shown, focused in `box` once it is. */
	tabKeys = (e: KeyboardEvent, tab: TabId | undefined, box: HTMLElement | undefined): void => {
		const shown = this.arranged.shown;
		const to = nextTab(
			e.key,
			shown.findIndex((t) => t.id === tab),
			shown.length
		);
		const next = to === null ? undefined : shown[to];
		if (!next) return;
		e.preventDefault();
		this.choose(next.id);
		queueMicrotask(() => box?.querySelector<HTMLElement>(`[data-tab="${next.id}"]`)?.focus());
	};

	// ---- Room on, Room off ----
	/** Whether Room on and Room off would reach anything: a light, not a camera's spotlight. */
	hasPower = $derived(roomPowerLights(this.list, devices.byId).length > 0);
	// Kept with the room they are for, so the next room's buttons start free
	// and clear, while this one's answer still comes back to it.
	#busy = $state<{ room: string; on: boolean } | null>(null);
	#trouble = $state<{ room: string; text: string } | null>(null);
	busy = $derived<'on' | 'off' | null>(
		this.#busy?.room === this.id ? (this.#busy.on ? 'on' : 'off') : null
	);
	trouble = $derived(this.#trouble?.room === this.id ? this.#trouble.text : null);
	async power(on: boolean): Promise<void> {
		const room = this.room;
		if (!room || this.busy) return;
		this.#busy = { room: room.id, on };
		this.#trouble = null;
		const { error, lights } = await roomPower(room.id, on);
		if (this.#busy?.room === room.id) this.#busy = null;
		if (error) {
			this.#trouble = { room: room.id, text: error };
			return;
		}
		// Each light it sent a command to waits for its answer, as a fader would.
		for (const lid of lights) {
			const d = devices.byId[lid];
			if (d) commands.expect(lid, kindOf(d), { on }, d.attributes);
		}
	}

	// ---- favorites from this room ----
	favs = $derived.by(() => {
		const here = new Map(this.list.map((d) => [ref.device(d.device_id), d]));
		return this.lay.favs.map((r) => here.get(r)).filter((d): d is CoreDevice => d !== undefined);
	});
	useFav(d: CoreDevice): void {
		const c = this.card(d);
		if (c.kind === 'scene' && d.schema?.actions?.some((a) => a.id === 'activate'))
			return void commands.act(d.device_id, 'activate');
		if (c.control?.kind === 'switch' && this.may && d.available)
			return void commands.set(
				d.device_id,
				c.kind,
				{ [c.control.attr]: !c.control.on },
				d.attributes
			);
		openDevice(d.device_id, page.url);
	}

	// ---- the room's audio ----
	// The one device the room plays through (media.ts): chosen for the house,
	// or by a person for themselves, else the room's first screen or speaker.
	players = $derived(orderPlayers(this.model.byTab.media));
	audio = $derived(
		roomAudioOf(
			this.id,
			this.model.byTab.media,
			devices.byId,
			household.doc.roomAudio,
			personal.doc.roomAudio
		).device
	);
	#audioWant = $derived(this.audio ? commands.pending[this.audio.device_id]?.want : undefined);
	choices = $derived(audioChoices(this.model.byTab.media, devices.byId));
	/** Kept for the house by people who may change it; else for the person alone. */
	playThrough = (choice: string): void => {
		const edit = <D extends { roomAudio?: Record<string, string> }>(d: D) =>
			withRoomAudio(d, this.id, choice);
		if (session.can('content:write')) void household.change(edit);
		else void personal.change(edit);
	};
	// A device that reports no level (a Roku) only steps: the bar counts the
	// presses since the room's audio was last chosen, as its own remote would feel.
	#pressed = $state<{ id?: string; by: number; muted: boolean }>({ by: 0, muted: false });
	#presses = $derived(
		this.#pressed.id === this.audio?.device_id
			? this.#pressed
			: { id: this.audio?.device_id, by: 0, muted: false }
	);
	volStep = (by: 1 | -1): void => {
		const audio = this.audio;
		if (!audio) return;
		void send(audio, stepCmd(audio, by, this.#audioWant));
		if (!volumeOf(audio, this.#audioWant).level)
			this.#pressed = { id: audio.device_id, by: this.#presses.by + by, muted: false };
	};
	volMute = (): void => {
		const audio = this.audio;
		if (!audio) return;
		void send(audio, muteCmd(audio, this.#audioWant));
		if (volumeOf(audio, this.#audioWant).muted === undefined)
			this.#pressed = { ...this.#presses, id: audio.device_id, muted: !this.#presses.muted };
	};
	volLevel = (v: number): void => {
		if (this.audio) void send(this.audio, volumeCmd(this.audio, v));
	};
	stepNote = $derived(
		this.#presses.muted
			? 'Muted'
			: this.#presses.by > 0
				? `Up ${this.#presses.by}`
				: this.#presses.by < 0
					? `Down ${-this.#presses.by}`
					: `No level from the ${brandOf(this.audio?.plugin_id)}`
	);
	audioNote = $derived(
		!this.audio
			? 'Choose the room’s audio below for the volume keys'
			: volumeOf(this.audio, this.#audioWant).level ||
				  (this.#presses.by === 0 && !this.#presses.muted)
				? `Volume keys drive the room’s audio: ${playerName(this.audio)}`
				: `${playerName(this.audio)}: ${this.stepNote.toLowerCase()}`
	);

	// ---- what the room's cameras saw lately, as pills ----
	roomCams = $derived(camerasOf(this.model.byTab.cameras, devices.byId));
	#pillPrefs = $derived(pillPrefsOf(household.doc.console?.pills));
	camPills = $derived(
		!this.#pillPrefs.off.includes(this.id)
			? pillsOf(
					allEvents(
						camEvents.byCam,
						this.roomCams.map((c) => c.id)
					),
					clock.now,
					this.#pillPrefs.kinds
				)
			: []
	);
	camName = (cam: string): string | undefined =>
		this.roomCams.length > 1
			? shortName(this.roomCams.find((c) => c.id === cam)?.name ?? '', this.room?.name ?? '')
			: undefined;
}
