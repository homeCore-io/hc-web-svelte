<!--
	A room in Customize (the CustomizeConsole board): the room stays in view,
	with dashed outlines on what can change. Its favorites reorder, unpin and
	pin from anything in the room; its tabs reorder and hide, and a star picks
	the one it opens on; the Lights tab's columns reorder and single lights
	hide. Down the side, the room's audio device, its picture, its header
	pills and the person's own controls.

	A room's photo (the PhotoAvatar board) comes from the pictures library,
	kept by the app server and never by homeCore. Its light spots show on it
	numbered: pick one in the list or on the photo, then click the photo to
	move it, or nudge it with the arrow keys. The same device choice fixes a
	drawing's spots by hand.

	A bar across the top says whose layout changes: "Just me" (the person's
	own layer) or "Everyone" (the household's, for people who may change the
	house's content). Every change can be undone until Done, and each layer
	can go back to the one below (layout.ts).

	Things reorder by dragging, by their ‹ › buttons, or by the arrow keys on
	the thing itself.
-->
<script lang="ts">
	import { tick } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import LayoutGrid from '@lucide/svelte/icons/layout-grid';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Star from '@lucide/svelte/icons/star';
	import Eye from '@lucide/svelte/icons/eye';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import X from '@lucide/svelte/icons/x';
	import Plus from '@lucide/svelte/icons/plus';
	import PicturePicker from '#lib/components/PicturePicker.svelte';
	import { sized } from '#lib/pictures.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { household } from '#lib/household.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { ref, type HouseDoc, type PersonDoc } from '#lib/layers.js';
	import { cardFor, kindOf } from '#lib/card.js';
	import type { CoreDevice } from '#lib/devices.js';
	import { moved, reorder, type Reorder } from '#lib/reorder.js';
	import Icon from '#lib/components/Icon.svelte';
	import RoomPicture from './RoomPicture.svelte';
	import RoomPhoto from './RoomPhoto.svelte';
	import { fits, PICTURES, roomPicture } from './pictures.js';
	import { GLOW_SIZES, kindFor, nudgeSpot, photoGlow, photoSpots } from './photo.js';
	import { audioChoices, roomAudioOf, withRoomAudio } from './media.js';
	import { KINDS, pillPrefsOf, withHousePills, type EventKind } from './cameras.js';
	import {
		brandOf,
		consoleRoom,
		devicesIn,
		LIGHTS_WIDTH,
		shortName,
		tabChoicesOf,
		type TabId
	} from './room.js';
	import {
		blocksOf,
		flipped,
		nudged,
		ordered,
		MAX_SPOTS,
		PICTURE_CHOICES,
		resolve,
		roomIn,
		withoutRoom,
		withRoomLayout,
		withRoomStars,
		type PhotoSpot,
		type RoomLayout,
		type RoomLayouts
	} from './layout.js';
	import {
		FADER_STYLES,
		SET_LOOKS,
		SWITCH_STYLES,
		faderStyle,
		switchesAs,
		switchStyle,
		withConsole,
		type Choice
	} from './style.js';

	let { id }: { id: string } = $props();

	const room = $derived(rooms.list.find((r) => r.id === id));
	const name = $derived(room?.name ?? '');
	const list = $derived(room ? devicesIn(devices.byId, room) : []);
	// Everything in the room, hidden lights too, so they can be shown again.
	const full = $derived(consoleRoom(list, LIGHTS_WIDTH, tabChoicesOf(household.doc.console?.tabs)));
	const short = (d: CoreDevice) => shortName(d.name_override ?? d.name, name);
	/** As the header's pill names it: "Door", not "Door Sensor". */
	const pillName = (d: CoreDevice) =>
		shortName((d.name_override ?? d.name).replace(/\s+sensor$/i, ''), name);

	// ---- whose layout: the person's own, or everyone's ----
	const mayAll = $derived(session.can('content:write'));
	let layer = $state<'me' | 'all'>('me');
	const forAll = $derived(layer === 'all' && mayAll);
	const house = $derived(roomIn(household.doc.console?.rooms, id));
	const mine = $derived(roomIn(personal.doc.console?.rooms, id));
	const inRoom = $derived(new Set(list.map((d) => ref.device(d.device_id))));
	const stars = $derived((personal.doc.favourites ?? []).filter((r) => inRoom.has(r)));
	// What the layer being changed shows: the household's alone, or the person's over it.
	const view = $derived(resolve(forAll ? undefined : mine, house, stars));
	const lit = $derived(roomPicture(name, list, clock.now, undefined, view.links));

	// ---- every change can be undone: what it changed, as it was ----
	type HouseSnap = Pick<HouseDoc, 'console' | 'roomAudio' | 'photos'>;
	type MeSnap = Pick<PersonDoc, 'console' | 'favourites' | 'roomAudio'>;
	type Step = { house: HouseSnap } | { me: MeSnap };
	let history = $state<Step[]>([]);
	const put = <D extends object>(d: D, snap: object): D => {
		const out: Record<string, unknown> = { ...(d as Record<string, unknown>) };
		for (const [k, v] of Object.entries(snap)) {
			if (v === undefined) delete out[k];
			else out[k] = v;
		}
		return out as D;
	};
	function toHouse(edit: (d: HouseDoc) => HouseDoc) {
		const d = $state.snapshot(household.doc) as HouseDoc;
		history.push({ house: { console: d.console, roomAudio: d.roomAudio, photos: d.photos } });
		void household.change(edit);
	}
	function toMe(edit: (d: PersonDoc) => PersonDoc) {
		const d = $state.snapshot(personal.doc) as PersonDoc;
		history.push({ me: { console: d.console, favourites: d.favourites, roomAudio: d.roomAudio } });
		void personal.change(edit);
	}
	function undo() {
		const step = history.pop();
		if (!step) return;
		if ('house' in step) void household.change((d) => put(d, step.house));
		else void personal.change((d) => put(d, step.me));
	}
	const withConsoleOf = <D extends { console?: object }>(d: D, c: object | undefined): D => {
		const { console: _drop, ...rest } = d;
		return (c ? { ...rest, console: c } : rest) as D;
	};

	/** A change to the room's layout, in the layer being changed. */
	function setLayout(patch: Partial<Record<keyof RoomLayout, unknown>>) {
		if (forAll) toHouse((d) => withConsoleOf(d, withRoomLayout(d.console, id, patch)));
		else toMe((d) => withConsoleOf(d, withRoomLayout(d.console, id, patch)));
	}
	/** "Go back to …": the layer being changed, for this room, as if never touched. */
	function reset() {
		const edit = <
			D extends { console?: { rooms?: RoomLayouts }; roomAudio?: Record<string, string> }
		>(
			d: D
		) => withRoomAudio(withConsoleOf(d, withoutRoom(d.console, id)), id, undefined);
		if (forAll) toHouse(edit);
		else toMe(edit);
	}

	// ---- favorites ----
	const here = $derived(new Map(list.map((d) => [ref.device(d.device_id), d])));
	/** A person's favorites are their stars: the room's in the new order, and theirs from now on. */
	function setFavs(next: string[]) {
		if (forAll) return setLayout({ favs: next });
		toMe((d) =>
			withConsoleOf(
				{ ...d, favourites: withRoomStars(d.favourites ?? [], inRoom, next) },
				withRoomLayout(d.console, id, { ownFavs: true })
			)
		);
	}
	const favKeys = $derived(view.favs.filter((r) => here.has(r)));
	const kindWord = (d: CoreDevice) =>
		`${brandOf(d.plugin_id)} ${kindOf(d).replace(/_/g, ' ')}`.trim();

	// ---- tabs ----
	const tabNames = $derived(new Map(full.tabs.map((t) => [t.id, t.name])));
	const tabKeys = $derived(
		ordered(
			full.tabs.map((t) => t.id),
			(t) => t,
			view.tabs
		)
	);
	const opens = $derived(
		tabKeys.includes(view.opens as TabId)
			? view.opens
			: tabKeys.find((t) => !view.hidden.includes(t))
	);
	const isHidden = (t: TabId) => t !== opens && view.hidden.includes(t);
	const star = (t: TabId) => setLayout({ opens: t, hidden: view.hidden.filter((x) => x !== t) });
	const hideTab = (t: TabId) => {
		if (t !== opens) setLayout({ hidden: flipped(view.hidden, t) });
	};

	// ---- the Lights tab ----
	const blocks = $derived(blocksOf(full.lights, view.columns));
	const blockKeys = $derived(blocks.map((b) => b.key));
	const blockOf = (key: string) => {
		const b = blocks.find((x) => x.key === key)!;
		if (b.kind === 'column') {
			const c = full.lights.columns[b.index]!;
			return { brand: c.brand, title: c.title, items: c.lights, note: '' };
		}
		if (b.kind === 'switches')
			return { brand: '', title: 'Switches', items: full.lights.switches, note: '' };
		if (b.kind === 'keypad') {
			const k = full.lights.keypads[b.index]!;
			return { brand: brandOf(k.plugin_id), title: short(k), items: [], note: 'keypad' };
		}
		return {
			brand: '',
			title: 'Scenes',
			items: [],
			note: `${full.lights.scenes.length} scenes`
		};
	};

	// ---- reordering: dragged as a draft, kept when let go ----
	type Which = 'favs' | 'tabs' | 'cols';
	let draft = $state<{ which: Which; list: string[] } | null>(null);
	const shown = <T extends string>(which: Which, base: T[]): T[] =>
		draft?.which === which ? (draft.list as T[]) : base;
	function dragging(which: Which, base: string[], keep: (next: string[]) => void): Reorder {
		return {
			axis: 'x',
			move: (from, to) => {
				draft = { which, list: moved(shown(which, base), from, to) };
			},
			drop: () => {
				const next = draft?.which === which ? draft.list : undefined;
				draft = null;
				if (next && next.join() !== base.join()) keep(next);
			}
		};
	}
	const keepFavs = (next: string[]) => setFavs(next);
	const keepTabs = (next: string[]) => setLayout({ tabs: next });
	const keepCols = (next: string[]) => setLayout({ columns: next });
	/** The arrow keys on a thing move it, and the keyboard stays on it. */
	async function arrows(e: KeyboardEvent, which: Which, key: string, nudge: (by: -1 | 1) => void) {
		const by = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
		if (by === 0) return;
		e.preventDefault();
		nudge(by);
		await tick();
		document.querySelector<HTMLElement>(`[data-grip="${which}:${key}"]`)?.focus();
	}
	const nudgeFav = (r: string, by: number) => {
		const next = nudged(favKeys, r, by);
		if (next.join() !== favKeys.join()) setFavs(next);
	};
	const nudgeTab = (t: TabId, by: number) => {
		const next = nudged(tabKeys, t, by);
		if (next.join() !== tabKeys.join()) setLayout({ tabs: next });
	};
	const nudgeCol = (k: string, by: number) => {
		const next = nudged(blockKeys, k, by);
		if (next.join() !== blockKeys.join()) setLayout({ columns: next });
	};

	// ---- pinning a favorite: anything in the room ----
	let picking = $state(false);
	let pinButton = $state<HTMLElement>();
	let pickBox = $state<HTMLElement>();
	const candidates = $derived.by(() => {
		const seen = new Set<string>();
		const out: CoreDevice[] = [];
		for (const t of tabKeys)
			for (const d of full.byTab[t])
				if (!seen.has(d.device_id)) {
					seen.add(d.device_id);
					out.push(d);
				}
		return out;
	});
	async function openPicker() {
		picking = true;
		await tick();
		pickBox?.querySelector<HTMLElement>('.cand')?.focus();
	}
	function closePicker() {
		picking = false;
		pinButton?.focus();
	}

	// ---- the room's audio: everyone's, or the person's own ----
	const choices = $derived(audioChoices(full.byTab.media, devices.byId));
	const audio = $derived(
		roomAudioOf(
			id,
			full.byTab.media,
			devices.byId,
			household.doc.roomAudio,
			forAll ? undefined : personal.doc.roomAudio
		)
	);
	const audioValue = $derived(audio.chosen ? (audio.device?.device_id ?? '') : 'auto');
	function playThrough(v: string) {
		const choice = v === 'auto' ? undefined : v;
		const edit = <D extends { roomAudio?: Record<string, string> }>(d: D) =>
			withRoomAudio(d, id, choice);
		if (forAll) toHouse(edit);
		else toMe(edit);
	}

	// ---- the household's alone: the picture and the header pills ----
	const pillPrefs = $derived(pillPrefsOf(household.doc.console?.pills));
	const pillsHere = $derived(!pillPrefs.off.includes(id));
	const guards = $derived([...full.locks, ...full.openings]);
	const hasCams = $derived(
		full.byTab.cameras.some((d) => ['camera', 'doorbell'].includes(kindOf(d)))
	);
	function setPills(patch: Partial<{ kinds: EventKind[]; home: boolean; off: string[] }>) {
		toHouse((d) => withConsoleOf(d, withHousePills(d.console, patch)));
	}
	const onlyAll = $derived(
		forAll
			? undefined
			: mayAll
				? 'For everyone: switch to Everyone to change it.'
				: 'The household chooses this for everyone.'
	);

	// ---- the room's photo (photo.ts): the household's ----
	const photo = $derived(household.photoOf(id));
	const showPhoto = $derived(view.picture === 'photo' && photo !== undefined);
	let choosingPhoto = $state(false);
	/** A photo picked: the room's from now on, shown. */
	function setPhoto(p: { url: string; focus?: number; dim?: number } | null) {
		toHouse((d) => {
			const { [id]: _was, ...rest } = d.photos ?? {};
			const photos = p ? { ...rest, [id]: { src: p.url, focus: p.focus, dim: p.dim } } : rest;
			const { photos: _all, ...doc } = d;
			return withConsoleOf(
				Object.keys(photos).length > 0 ? { ...doc, photos } : doc,
				withRoomLayout(d.console, id, { picture: p ? 'photo' : undefined })
			);
		});
	}
	function pickPicture(v: string) {
		if (v === 'photo' && !photo) choosingPhoto = true;
		else setLayout({ picture: v === 'drawn' ? undefined : v });
	}

	// Its spots: the household's, else seeded from the drawing's.
	const spots = $derived(photoSpots(view.spots, lit.picture, lit.spots));
	let preview = $state<'live' | 'off'>('live');
	const glow = $derived(
		photoGlow(spots, devices.byId, clock.now).map((g) =>
			preview === 'off' ? { ...g, opacity: 0, lit: false } : g
		)
	);
	let sel = $state(0);
	const at = $derived(Math.min(sel, Math.max(0, spots.length - 1)));
	const spot = $derived(spots[at]);
	const setSpots = (next: PhotoSpot[]) => setLayout({ spots: next });
	const changeSpot = (patch: Partial<PhotoSpot>) =>
		setSpots(spots.map((s, i) => (i === at ? { ...s, ...patch } : s)));
	// What a spot can show: the room's lights, screens, fans, doors, locks and heaters.
	const glowers = $derived(
		list
			.filter((d) => kindFor(d) !== undefined)
			.sort((a, b) => short(a).localeCompare(short(b), undefined, { numeric: true }))
	);
	const deviceOf = (s: PhotoSpot | undefined) =>
		s?.device ? here.get(ref.device(s.device)) : undefined;
	function spotNote(s: PhotoSpot): { text: string; warn: boolean } {
		if (!s.device) return { text: 'Pick a device, or it never glows', warn: true };
		const d = deviceOf(s);
		if (!d) return { text: 'Not in the room any more', warn: true };
		return { text: `${kindWord(d)} · ${cardFor(d, clock.now).stateLine}`, warn: false };
	}
	function addSpot() {
		if (spots.length >= MAX_SPOTS) return;
		setSpots([...spots, { x: 50, y: 50 }]);
		sel = spots.length;
	}
	function removeSpot() {
		setSpots(spots.filter((_, i) => i !== at));
		sel = Math.max(0, at - 1);
	}
	let photoBox = $state<HTMLElement>();
	/** A click on the photo moves the spot picked to it. */
	function placeAt(e: MouseEvent) {
		if (!photoBox || !spot) return;
		const r = photoBox.getBoundingClientRect();
		const x = Math.round(((e.clientX - r.left) / r.width) * 1000) / 10;
		const y = Math.round(((e.clientY - r.top) / r.height) * 1000) / 10;
		changeSpot(nudgeSpot({ ...spot, x, y }, 0, 0));
	}
	const STEP: Record<string, [number, number]> = {
		ArrowLeft: [-1, 0],
		ArrowRight: [1, 0],
		ArrowUp: [0, -1],
		ArrowDown: [0, 1]
	};
	/** The arrow keys on a spot nudge it, further with Shift. */
	function nudgeKey(e: KeyboardEvent, i: number) {
		const step = STEP[e.key];
		if (!step) return;
		e.preventDefault();
		const by = e.shiftKey ? 5 : 1;
		sel = i;
		setSpots(spots.map((s, j) => (j === i ? nudgeSpot(s, step[0] * by, step[1] * by) : s)));
	}
	// The photo's own shape, so the editor shows it whole.
	let ratio = $state(16 / 9);

	// ---- a drawing's spots, fixed by hand ----
	const drawnSpots = $derived(PICTURES[lit.picture].spots);
	const linkValue = (spotId: string) =>
		spotId in view.links ? view.links[spotId] || 'none' : 'auto';
	function link(spotId: string, v: string) {
		const { [spotId]: _was, ...rest } = view.links;
		setLayout({ links: v === 'auto' ? rest : { ...rest, [spotId]: v === 'none' ? '' : v } });
	}
	const matched = (spotId: string) =>
		(lit.spots.get(spotId) ?? []).map(short).join(', ') || 'nothing';

	// ---- the person's own controls ----
	const fader = $derived(faderStyle(personal.doc.console, household.doc.console));
	const sw = $derived(switchStyle(personal.doc.console, household.doc.console));
	const together = $derived(switchesAs(personal.doc.console));
	const choose = (patch: Partial<Record<Choice, string | undefined>>) =>
		toMe((d) => withConsole(d, patch));

	function done() {
		const url = new URL(page.url.href);
		url.searchParams.delete('customize');
		void goto(url.pathname + url.search, { replace: true, reset: false });
	}
</script>

<svelte:window
	onkeydown={(e) => {
		if (e.key === 'Escape' && picking) {
			e.preventDefault();
			closePicker();
		}
	}}
/>

{#snippet seg(
	label: string,
	options: readonly { id: string; name: string }[],
	current: string,
	pick: (id: string) => void,
	off = false
)}
	<div class="seg" style:--n={options.length} role="radiogroup" aria-label={label}>
		{#each options as o (o.id)}
			<button
				type="button"
				role="radio"
				aria-checked={current === o.id}
				disabled={off}
				onclick={() => pick(o.id)}>{o.name}</button
			>
		{/each}
	</div>
{/snippet}

{#snippet toggle(label: string, on: boolean, flip: () => void, off = false)}
	<button
		type="button"
		class="tg"
		class:on
		role="switch"
		aria-checked={on}
		aria-label={label}
		disabled={off}
		onclick={flip}><span class="k"></span></button
	>
{/snippet}

{#snippet order(what: string, prev: () => void, next: () => void, first: boolean, last: boolean)}
	<button type="button" aria-label={`Move ${what} left`} disabled={first} onclick={prev}
		><ChevronLeft size={14} strokeWidth={2.4} aria-hidden="true" /></button
	>
	<button type="button" aria-label={`Move ${what} right`} disabled={last} onclick={next}
		><ChevronRight size={14} strokeWidth={2.4} aria-hidden="true" /></button
	>
{/snippet}

<div class="cz">
	<header class="czbar">
		<LayoutGrid size={18} strokeWidth={2} aria-hidden="true" />
		<div class="czh">
			<h1>Customizing the {name}</h1>
			<p>
				{forAll
					? 'Everyone in the household sees these changes.'
					: 'Only you see these changes; the household’s layout stays as it is.'}
			</p>
		</div>
		{#if mayAll}
			{@render seg(
				'Who sees the changes',
				[
					{ id: 'me', name: 'Just me' },
					{ id: 'all', name: 'Everyone' }
				],
				layer,
				(v) => (layer = v as 'me' | 'all')
			)}
		{/if}
		<button type="button" class="tbtn ghost" disabled={history.length === 0} onclick={undo}
			>Undo</button
		>
		<button type="button" class="tbtn lit" onclick={done}>Done</button>
	</header>

	<div class="czbody">
		<main class="stage">
			<section class="hero zone" aria-label="Room picture">
				{#if showPhoto && photo}<RoomPhoto
						src={photo.src}
						focus={photo.focus}
						{glow}
					/>{:else if view.picture !== 'plain'}<RoomPicture picture={lit.picture} g={lit.g} />{/if}
				<div class="band" aria-hidden="true"></div>
				<span class="ztag">Picture · {view.picture}</span>
				<div class="hc">
					<h2 class="title">{name}</h2>
					<div class="chips">
						{#each guards.filter((d) => !view.pillsOff.includes(d.device_id)) as d (d.device_id)}
							<span class="chip">{pillName(d)}</span>
						{/each}
					</div>
				</div>
			</section>

			{#if showPhoto && photo && forAll}
				<section class="zone" aria-label="The photo’s light spots">
					<span class="ztag">Photo · light spots</span>
					<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
					<div
						class="ped"
						bind:this={photoBox}
						style:aspect-ratio={ratio}
						style:max-width={`${Math.round(340 * ratio)}px`}
						onclick={placeAt}
					>
						<img
							src={sized(photo.src, 'screen')}
							alt=""
							onload={(e) => {
								const i = e.currentTarget as HTMLImageElement;
								ratio = i.naturalWidth / i.naturalHeight || ratio;
							}}
						/>
						<RoomPhoto src={photo.src} focus={4} {glow} />
						{#each spots as p, i (i)}
							{@const d = deviceOf(p)}
							<button
								type="button"
								class="spot"
								class:sel={i === at}
								class:warn={!d}
								style:left={`${p.x}%`}
								style:top={`${p.y}%`}
								aria-label={`Spot ${i + 1}: ${d ? short(d) : 'no device'}. Arrow keys move it.`}
								aria-pressed={i === at}
								onclick={(e) => {
									e.stopPropagation();
									sel = i;
								}}
								onkeydown={(e) => nudgeKey(e, i)}>{i + 1}</button
							>
							<span class="slbl" style:left={`${p.x}%`} style:top={`${p.y}%`}
								>{d ? short(d) : 'No device'}</span
							>
						{/each}
					</div>
					<div class="pfoot">
						<p class="znote">
							{view.spots
								? 'Pick a spot, then click the photo to move it.'
								: 'Spots were first placed from the drawing. Move any that sit wrong on your photo.'}
						</p>
						<span class="pv">Preview</span>
						{@render seg(
							'Preview',
							[
								{ id: 'live', name: 'As the lights are' },
								{ id: 'off', name: 'All off' }
							],
							preview,
							(v) => (preview = v as 'live' | 'off')
						)}
					</div>
				</section>
			{/if}

			<div class="zone favs" role="group" aria-label="Favorites, being arranged">
				<span class="ztag">Favorites · drag to reorder</span>
				<div class="row" use:reorder={dragging('favs', favKeys, keepFavs)}>
					{#each shown('favs', favKeys) as r, i (r)}
						{@const d = here.get(r)!}
						{@const c = cardFor(d, clock.now)}
						<div class="fav" data-item>
							<button
								type="button"
								class="grip"
								data-grip={`favs:${r}`}
								aria-label={`${short(d)}: drag, or use the arrow keys to move it`}
								onkeydown={(e) => arrows(e, 'favs', r, (by) => nudgeFav(r, by))}
							>
								<span class="fi"><Icon name={c.icon} size={15} /></span>
								<span class="ft">{short(d)}<small>{kindWord(d)}</small></span>
							</button>
							<span class="ord">
								{@render order(
									short(d),
									() => nudgeFav(r, -1),
									() => nudgeFav(r, 1),
									i === 0,
									i === favKeys.length - 1
								)}
								<button
									type="button"
									aria-label={`Unpin ${short(d)}`}
									onclick={() => setFavs(favKeys.filter((x) => x !== r))}
									><X size={13} strokeWidth={2.4} aria-hidden="true" /></button
								>
							</span>
						</div>
					{/each}
					<button type="button" class="pin" bind:this={pinButton} onclick={openPicker}
						><Plus size={14} strokeWidth={2.4} aria-hidden="true" />Pin a favorite</button
					>
				</div>
				{#if forAll && favKeys.length === 0 && house.favs === undefined}
					<p class="znote">None for everyone yet: each person sees their own stars here.</p>
				{/if}
			</div>

			{#if tabKeys.length > 0}
				<div class="zone" role="group" aria-label="Tabs, being arranged">
					<span class="ztag">Tabs · order, hide, and which one the room opens on</span>
					<div class="row tabs" use:reorder={dragging('tabs', tabKeys, keepTabs)}>
						{#each shown('tabs', tabKeys) as t, i (t)}
							{@const nm = tabNames.get(t) ?? t}
							<div class="tab" class:home={t === opens} class:off={isHidden(t)} data-item>
								<button
									type="button"
									class="star"
									aria-pressed={t === opens}
									aria-label={t === opens ? `The room opens on ${nm}` : `Open the room on ${nm}`}
									onclick={() => star(t)}
									><Star
										size={15}
										strokeWidth={2}
										fill={t === opens ? 'currentColor' : 'none'}
										aria-hidden="true"
									/></button
								>
								<button
									type="button"
									class="grip tn"
									data-grip={`tabs:${t}`}
									aria-label={`${nm} tab: drag, or use the arrow keys to move it`}
									onkeydown={(e) => arrows(e, 'tabs', t, (by) => nudgeTab(t, by))}>{nm}</button
								>
								<span class="ord">
									{@render order(
										`the ${nm} tab`,
										() => nudgeTab(t, -1),
										() => nudgeTab(t, 1),
										i === 0,
										i === tabKeys.length - 1
									)}
									<button
										type="button"
										aria-label={isHidden(t) ? `Show the ${nm} tab` : `Hide the ${nm} tab`}
										aria-pressed={isHidden(t)}
										disabled={t === opens}
										title={t === opens ? 'The tab the room opens on stays shown' : undefined}
										onclick={() => hideTab(t)}
										>{#if isHidden(t)}<EyeOff
												size={13}
												strokeWidth={2.2}
												aria-hidden="true"
											/>{:else}<Eye size={13} strokeWidth={2.2} aria-hidden="true" />{/if}</button
									>
								</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			{#if blocks.length > 0}
				<section class="zone panel" aria-label="Lights tab, being arranged">
					<span class="ztag">Lights tab · columns and what’s in them</span>
					<div class="row desk" use:reorder={dragging('cols', blockKeys, keepCols)}>
						{#each shown('cols', blockKeys) as k, i (k)}
							{@const b = blockOf(k)}
							<div class="col" data-item>
								<div class="ch">
									<button
										type="button"
										class="grip cht"
										data-grip={`cols:${k}`}
										aria-label={`${b.title} column: drag, or use the arrow keys to move it`}
										onkeydown={(e) => arrows(e, 'cols', k, (by) => nudgeCol(k, by))}
										>{#if b.brand}<span class="tag">{b.brand}</span>{/if}<span class="ctt"
											>{b.title}</span
										></button
									>
									<span class="ord">
										{@render order(
											`the ${b.title} column`,
											() => nudgeCol(k, -1),
											() => nudgeCol(k, 1),
											i === 0,
											i === blockKeys.length - 1
										)}
									</span>
								</div>
								{#if b.note}<p class="cn">{b.note}</p>{/if}
								{#each b.items as d (d.device_id)}
									{@const hid = view.off.includes(d.device_id)}
									<div class="item" class:off={hid}>
										<span class="in">{short(d)}</span>
										<button
											type="button"
											class="eye"
											aria-label={hid ? `Show ${short(d)}` : `Hide ${short(d)}`}
											aria-pressed={hid}
											onclick={() => setLayout({ off: flipped(view.off, d.device_id) })}
											>{#if hid}<EyeOff size={13} strokeWidth={2.2} aria-hidden="true" />{:else}<Eye
													size={13}
													strokeWidth={2.2}
													aria-hidden="true"
												/>{/if}</button
										>
									</div>
								{/each}
							</div>
						{/each}
					</div>
				</section>
			{/if}
		</main>

		<aside class="side" aria-label="Room settings">
			{#if choices.length > 0}
				<div class="sec">
					<p class="sh">ROOM AUDIO <span class="scope">{forAll ? 'everyone' : 'just you'}</span></p>
					<label class="via"
						><small>Plays through</small>
						<select
							aria-label={`${name}'s audio device`}
							value={audioValue}
							onchange={(e) => playThrough(e.currentTarget.value)}
						>
							<option value="auto">Automatic: the room’s first screen or speaker</option>
							{#each choices.filter((c) => c.here) as c (c.id)}
								<option value={c.id}>{c.label}</option>
							{/each}
							<option value="">None</option>
							{#if choices.some((c) => !c.here)}
								<optgroup label="Elsewhere in the house">
									{#each choices.filter((c) => !c.here) as c (c.id)}
										<option value={c.id}>{c.label}</option>
									{/each}
								</optgroup>
							{/if}
						</select></label
					>
					<p class="note">Room volume, mute and the bottom bar follow this device.</p>
				</div>
			{/if}

			<div class="sec">
				<p class="sh">ROOM PICTURE <span class="scope">everyone</span></p>
				<div class="seg" style:--n={3} role="radiogroup" aria-label="Room picture">
					{#each PICTURE_CHOICES as o (o.id)}
						<button
							type="button"
							role="radio"
							aria-checked={view.picture === o.id}
							disabled={!forAll}
							onclick={() => pickPicture(o.id)}>{o.name}</button
						>
					{/each}
				</div>
				{#if forAll && (photo || view.picture === 'photo')}
					<div class="btns">
						<button type="button" class="tbtn" onclick={() => (choosingPhoto = true)}
							>{photo ? 'Replace photo…' : 'Choose a photo…'}</button
						>
						{#if photo}<button type="button" class="tbtn" onclick={() => setPhoto(null)}
								>Remove photo</button
							>{/if}
					</div>
				{/if}
				<p class="note">
					{onlyAll ??
						(view.picture === 'photo'
							? 'A wide photo works best. It fills the room’s header and Home tile, cropped to fit.'
							: view.picture === 'drawn'
								? 'A drawing of the room that lights up with its lights.'
								: 'Just the room’s name and status, no picture.')}
				</p>
			</div>

			{#if forAll && showPhoto}
				<div class="sec">
					<div class="trow">
						<p class="sh nm">LIGHT SPOTS</p>
						<button
							type="button"
							class="tbtn"
							disabled={spots.length >= MAX_SPOTS}
							onclick={addSpot}>Add a spot</button
						>
					</div>
					<p class="note">Each spot glows when its device is on.</p>
					<div class="spots" role="listbox" aria-label="Light spots">
						{#each spots as p, i (i)}
							{@const n = spotNote(p)}
							{@const d = deviceOf(p)}
							<button
								type="button"
								role="option"
								class="srow"
								aria-selected={i === at}
								onclick={() => (sel = i)}
								><span class="sn" class:warn={n.warn}>{i + 1}</span><span class="nm"
									>{d ? short(d) : 'No device'}<small class:warn={n.warn}>{n.text}</small></span
								></button
							>
						{/each}
					</div>
					{#if spot}
						<label class="via"
							><small>Spot {at + 1}: device</small>
							<select
								value={spot.device ?? ''}
								onchange={(e) => changeSpot({ device: e.currentTarget.value || undefined })}
							>
								<option value="">No device</option>
								{#each glowers as d (d.device_id)}
									<option value={d.device_id}>{short(d)} · {kindWord(d)}</option>
								{/each}
							</select></label
						>
						<p class="note">Glow</p>
						{@render seg('Glow size', GLOW_SIZES, spot.size ?? 'm', (v) =>
							changeSpot({ size: v === 'm' ? undefined : (v as 's' | 'l') })
						)}
						<button type="button" class="tbtn ghost" onclick={removeSpot}>Remove spot</button>
					{/if}
				</div>
			{:else if forAll && view.picture !== 'plain'}
				<div class="sec">
					<p class="sh">DRAWING SPOTS <span class="scope">everyone</span></p>
					<p class="note">What each part of the drawing lights up with.</p>
					{#each drawnSpots as p (p.id)}
						{@const v = linkValue(p.id)}
						<label class="via"
							><small>{p.name}</small>
							<select value={v} onchange={(e) => link(p.id, e.currentTarget.value)}>
								<option value="auto"
									>Matched by name{v === 'auto' ? `: ${matched(p.id)}` : ''}</option
								>
								<option value="none">Nothing</option>
								{#each list.filter((d) => fits(p.kind, d)) as d (d.device_id)}
									<option value={d.device_id}>{short(d)}</option>
								{/each}
							</select></label
						>
					{/each}
				</div>
			{/if}

			{#if guards.length > 0 || hasCams}
				<div class="sec">
					<p class="sh">HEADER PILLS <span class="scope">everyone</span></p>
					{#each guards as d (d.device_id)}
						{@const on = !view.pillsOff.includes(d.device_id)}
						<div class="trow">
							<span class="nm">{pillName(d)}<small>{kindWord(d)}</small></span>
							{@render toggle(
								`${pillName(d)} pill`,
								on,
								() => setLayout({ pillsOff: flipped(view.pillsOff, d.device_id) }),
								!forAll
							)}
						</div>
					{/each}
					{#if hasCams}
						<div class="trow">
							<span class="nm">Camera events<small>For 30 minutes after each</small></span>
							{@render toggle(
								'Camera events in this header',
								pillsHere,
								() =>
									setPills({
										off: pillsHere ? [...pillPrefs.off, id] : pillPrefs.off.filter((x) => x !== id)
									}),
								!forAll
							)}
						</div>
						<div class="kinds" role="group" aria-label="Which camera events">
							{#each KINDS as k (k.id)}
								<button
									type="button"
									aria-pressed={pillPrefs.kinds.includes(k.id)}
									disabled={!forAll}
									onclick={() =>
										setPills({
											kinds: pillPrefs.kinds.includes(k.id)
												? pillPrefs.kinds.filter((x) => x !== k.id)
												: [...pillPrefs.kinds, k.id]
										})}>{k.name}</button
								>
							{/each}
						</div>
						<div class="trow">
							<span class="nm">On Home too<small>For the whole house</small></span>
							{@render toggle(
								'Camera events on Home',
								pillPrefs.home,
								() => setPills({ home: !pillPrefs.home }),
								!forAll
							)}
						</div>
					{/if}
					{#if onlyAll}<p class="note">{onlyAll}</p>{/if}
				</div>
			{/if}

			<div class="sec">
				<p class="sh">CONTROLS <span class="scope">just you</span></p>
				<p class="note">Faders</p>
				{@render seg('Fader style', FADER_STYLES, fader, (v) => choose({ fader: v }))}
				<p class="note">Switches</p>
				{@render seg('Switch style', SWITCH_STYLES, sw, (v) => choose({ switch: v }))}
				<p class="note">Switches and timers as</p>
				{@render seg('Switches and timers as', SET_LOOKS, together, (v) =>
					choose({ switchesAs: v })
				)}
			</div>

			<div class="sec last">
				<button type="button" class="tbtn ghost wide" onclick={reset}
					>{forAll ? 'Go back to the starting layout' : 'Go back to the household’s layout'}</button
				>
				<p class="note">
					{forAll
						? 'Clears what the household changed in this room. You can undo it.'
						: 'Clears your own changes to this room. You can undo it.'}
				</p>
			</div>
		</aside>
	</div>

	{#if choosingPhoto}
		<PicturePicker
			title={`A photo for the ${name}`}
			value={photo ? { url: photo.src, focus: photo.focus, dim: photo.dim } : undefined}
			shared
			videos={false}
			over
			pick={(p) => setPhoto(p)}
			clear={photo ? () => setPhoto(null) : undefined}
			close={() => (choosingPhoto = false)}
		/>
	{/if}

	{#if picking}
		<div class="shade" aria-hidden="true"></div>
		<div class="pick" role="dialog" aria-label="Pin a favorite" tabindex="-1" bind:this={pickBox}>
			<div class="ph">
				<b>Pin a favorite</b>
				<button type="button" class="x" aria-label="Close" onclick={closePicker}
					><X size={16} strokeWidth={2.2} aria-hidden="true" /></button
				>
			</div>
			<p class="note">
				Anything in the {name}: a light, a scene, a switch, the TV, the floor heat.
			</p>
			<div class="cands">
				{#each candidates as d (d.device_id)}
					{@const r = ref.device(d.device_id)}
					{@const pinned = favKeys.includes(r)}
					<button
						type="button"
						class="cand"
						class:pinned
						aria-pressed={pinned}
						onclick={() => setFavs(pinned ? favKeys.filter((x) => x !== r) : [...favKeys, r])}
					>
						<span class="fi"><Icon name={cardFor(d, clock.now).icon} size={14} /></span>
						<span class="ft">{short(d)}<small>{kindWord(d)}</small></span>
						<b>{pinned ? 'Pinned' : 'Pin'}</b>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.cz {
		--cz: #ffc46b;
		--cz-line: color-mix(in srgb, var(--cz) 45%, transparent);
		display: flex;
		flex-direction: column;
		min-height: calc(100dvh - var(--header-h, 52px));
	}
	:global(:root[data-theme='light']) .cz {
		--cz: #b06d08;
	}

	/* ---- the bar across the top ---- */
	.czbar {
		position: sticky;
		top: var(--header-h, 52px);
		z-index: 10;
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 56px;
		padding: 8px 18px;
		box-sizing: border-box;
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--cz) 16%, var(--surface)),
			color-mix(in srgb, var(--surface) 92%, transparent) 60%
		);
		backdrop-filter: blur(20px);
		box-shadow: inset 0 -1px 0 var(--cz-line);
		color: var(--cz);
	}
	.czh {
		flex: 1;
		min-width: 0;
	}
	.czh h1 {
		margin: 0;
		font-size: 14px;
		font-weight: 700;
		color: color-mix(in srgb, var(--cz) 60%, var(--ink));
	}
	.czh p {
		margin: 2px 0 0;
		font-size: 11.5px;
		color: var(--ink-muted);
	}
	.czbar .seg {
		width: 210px;
		flex: none;
	}
	.tbtn {
		flex: none;
		height: 32px;
		padding: 0 14px;
		border: 0;
		border-radius: 9px;
		background: color-mix(in srgb, var(--ink) 7%, transparent);
		color: var(--ink);
		font: 600 13px var(--font);
		cursor: pointer;
	}
	.tbtn.ghost {
		background: transparent;
		color: var(--ink-muted);
	}
	.tbtn.ghost:hover:not(:disabled) {
		color: var(--ink);
		background: color-mix(in srgb, var(--ink) 6%, transparent);
	}
	.tbtn:disabled {
		opacity: 0.45;
		cursor: default;
	}
	.tbtn.lit {
		background: linear-gradient(140deg, #ffc46b, #ff8a5b);
		color: #1d1006;
	}
	.tbtn.wide {
		width: 100%;
		box-shadow: inset 0 0 0 1px var(--con-edge);
	}

	/* ---- the room, with what can change outlined ---- */
	.czbody {
		flex: 1;
		display: flex;
		min-height: 0;
	}
	.stage {
		flex: 1 1 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 14px 18px 18px;
	}
	.zone {
		position: relative;
		padding: 30px 14px 14px;
		border-radius: 14px;
		outline: 1.5px dashed var(--cz-line);
		outline-offset: -1px;
	}
	.ztag {
		position: absolute;
		left: 12px;
		top: 8px;
		z-index: 2;
		padding: 2px 8px;
		border-radius: 6px;
		background: color-mix(in srgb, var(--cz) 18%, transparent);
		color: color-mix(in srgb, var(--cz) 70%, var(--ink));
		font-size: 10.5px;
		font-weight: 600;
		letter-spacing: 0.03em;
	}
	.znote {
		margin: 10px 0 0;
		font-size: 11.5px;
		color: var(--ink-muted);
	}
	.hero {
		height: 150px;
		padding: 0;
		overflow: hidden;
		background: #0c0d12;
		display: flex;
		align-items: flex-end;
	}
	.band {
		position: absolute;
		inset: 0;
		background:
			linear-gradient(90deg, rgba(7, 8, 11, 0.92), rgba(7, 8, 11, 0.4) 50%, rgba(7, 8, 11, 0) 75%),
			linear-gradient(0deg, rgba(7, 8, 11, 0.9), rgba(7, 8, 11, 0) 50%);
	}
	.hc {
		position: relative;
		padding: 0 22px 16px;
		color: #f3f4f7;
	}
	.title {
		margin: 0;
		font-size: 32px;
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1.05;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 8px;
	}
	.chips:empty {
		display: none;
	}
	.chip {
		height: 24px;
		display: inline-flex;
		align-items: center;
		padding: 0 10px;
		border-radius: 999px;
		background: rgba(79, 224, 160, 0.16);
		color: #b8f5d8;
		font-size: 11.5px;
		font-weight: 600;
	}

	/* ---- things in a row, to drag ---- */
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
	}
	.grip {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
		padding: 0;
		border: 0;
		background: none;
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: grab;
		touch-action: none;
	}
	.grip:focus-visible,
	.ord button:focus-visible,
	.star:focus-visible,
	.eye:focus-visible,
	.pin:focus-visible,
	.cand:focus-visible,
	.tbtn:focus-visible,
	.seg button:focus-visible,
	.tg:focus-visible,
	.kinds button:focus-visible,
	.x:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	:global([data-item].lifted) {
		opacity: 0.75;
		box-shadow: 0 10px 24px -8px rgba(0, 0, 0, 0.7);
	}
	.ord {
		display: inline-flex;
		gap: 2px;
		flex: none;
	}
	.ord button,
	.eye {
		width: 24px;
		height: 24px;
		display: grid;
		place-items: center;
		padding: 0;
		border: 0;
		border-radius: 7px;
		background: color-mix(in srgb, var(--ink) 8%, transparent);
		color: var(--ink);
		cursor: pointer;
	}
	.ord button:hover:not(:disabled),
	.eye:hover {
		background: color-mix(in srgb, var(--cz) 30%, transparent);
	}
	.ord button:disabled {
		opacity: 0.3;
		cursor: default;
	}

	/* ---- favorites ---- */
	.fav {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 48px;
		padding: 0 6px 0 8px;
		box-sizing: border-box;
		border-radius: 14px;
		background: color-mix(in srgb, var(--ink) 7%, transparent);
		box-shadow: inset 0 0 0 1px var(--cz-line);
		font-size: 12.5px;
		font-weight: 600;
	}
	.fi {
		flex: none;
		width: 30px;
		height: 30px;
		border-radius: 9px;
		display: grid;
		place-items: center;
		background: color-mix(in srgb, var(--ink) 9%, transparent);
	}
	.ft {
		min-width: 0;
	}
	.ft small {
		display: block;
		max-width: 160px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 11px;
		font-weight: 500;
		color: var(--ink-muted);
	}
	.pin {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 48px;
		padding: 0 14px;
		border: 0;
		border-radius: 14px;
		background: transparent;
		box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--cz) 60%, transparent);
		color: color-mix(in srgb, var(--cz) 70%, var(--ink));
		font: 600 12.5px var(--font);
		cursor: pointer;
	}

	/* ---- tabs ---- */
	.tab {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 40px;
		padding: 0 6px 0 4px;
		border-radius: 11px;
		background: color-mix(in srgb, var(--ink) 6%, transparent);
		font-size: 13px;
		font-weight: 600;
	}
	.tab.home {
		background: color-mix(in srgb, var(--cz) 14%, transparent);
	}
	.tab.off {
		opacity: 0.5;
	}
	.tab.off .tn {
		text-decoration: line-through;
	}
	.star {
		width: 28px;
		height: 28px;
		display: grid;
		place-items: center;
		padding: 0;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--cz);
		cursor: pointer;
	}
	.tn {
		padding: 0 4px;
	}

	/* ---- the Lights tab's columns ---- */
	.desk {
		align-items: flex-start;
		gap: 12px;
	}
	.col {
		width: 230px;
		box-sizing: border-box;
		padding: 10px;
		border-radius: 10px;
		outline: 1px dashed color-mix(in srgb, var(--ink) 14%, transparent);
		background: var(--bg);
	}
	.ch {
		display: flex;
		align-items: center;
		gap: 6px;
		margin-bottom: 8px;
	}
	.cht {
		flex: 1;
		gap: 7px;
		font-size: 12.5px;
		font-weight: 700;
	}
	.ctt {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.tag {
		flex: none;
		padding: 2px 6px;
		border-radius: 5px;
		background: color-mix(in srgb, var(--ink) 10%, transparent);
		font-size: 9.5px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	.cn {
		margin: 0;
		font-size: 11.5px;
		color: var(--ink-muted);
	}
	.item {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 32px;
		padding: 0 4px 0 10px;
		margin-bottom: 4px;
		border-radius: 8px;
		background: color-mix(in srgb, var(--ink) 4%, transparent);
		font-size: 12.5px;
	}
	.in {
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.item.off {
		opacity: 0.5;
	}
	.item.off .in {
		text-decoration: line-through;
	}

	/* ---- down the side ---- */
	.side {
		flex: 0 0 300px;
		min-width: 0;
		box-sizing: border-box;
		padding: 6px 16px 16px;
		background: color-mix(in srgb, var(--side, var(--surface)) 82%, transparent);
		box-shadow: inset 1px 0 0 var(--con-edge);
	}
	.sec {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 12px 0;
		border-bottom: 1px solid var(--con-edge);
	}
	.sec.last {
		border: 0;
	}
	.sh {
		margin: 0;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.06em;
		color: var(--ink-muted);
	}
	.scope {
		margin-left: 6px;
		padding: 1px 6px;
		border-radius: 5px;
		background: color-mix(in srgb, var(--ink) 8%, transparent);
		font-weight: 600;
		letter-spacing: 0;
	}
	.note {
		margin: 0;
		font-size: 11.5px;
		line-height: 1.4;
		color: var(--ink-muted);
	}
	.via {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.via small {
		font-size: 10.5px;
		font-weight: 600;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.via select {
		width: 100%;
		min-width: 0;
		height: 32px;
		padding: 0 8px;
		border: 0;
		border-radius: 8px;
		background: color-mix(in srgb, var(--ink) 9%, transparent);
		color: var(--ink);
		font: 500 12.5px var(--font);
	}
	.via option,
	.via optgroup {
		background: var(--surface);
		color: var(--ink);
	}
	.seg {
		display: grid;
		grid-template-columns: repeat(var(--n), minmax(0, 1fr));
		padding: 3px;
		border-radius: 10px;
		background: color-mix(in srgb, var(--ink) 6%, transparent);
	}
	.seg button {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		min-height: 30px;
		padding: 2px 4px;
		border: 0;
		border-radius: 8px;
		background: transparent;
		color: var(--ink-muted);
		font: 600 12px var(--font);
		line-height: 1.15;
		cursor: pointer;
	}
	.seg button[aria-checked='true'] {
		background: linear-gradient(140deg, #ffc46b, #ff8a5b);
		color: #1d1006;
	}
	.seg button:disabled {
		cursor: default;
	}
	.seg button:disabled:not([aria-checked='true']) {
		opacity: 0.5;
	}
	.btns {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	/* ---- the photo's spots ---- */
	.ped {
		position: relative;
		width: 100%;
		margin: 0 auto;
		border-radius: 10px;
		overflow: hidden;
		cursor: crosshair;
		background: #0c0d12;
	}
	.ped > img {
		display: block;
		width: 100%;
		height: 100%;
		visibility: hidden;
	}
	.spot {
		position: absolute;
		z-index: 2;
		width: 30px;
		height: 30px;
		margin: -15px 0 0 -15px;
		padding: 0;
		border: 2px dashed rgba(255, 255, 255, 0.75);
		border-radius: 50%;
		background: rgba(10, 12, 16, 0.55);
		color: #fff;
		font: 700 11px var(--font);
		cursor: pointer;
	}
	.spot.warn {
		border-color: #ffb35c;
	}
	.spot.sel {
		border-style: solid;
		border-color: #7fb8ff;
		box-shadow: 0 0 0 4px rgba(127, 184, 255, 0.3);
	}
	.slbl {
		position: absolute;
		z-index: 1;
		transform: translate(-50%, 18px);
		padding: 2px 7px;
		border-radius: 6px;
		background: rgba(0, 0, 0, 0.55);
		color: #e9ecf2;
		font-size: 11px;
		font-weight: 600;
		white-space: nowrap;
		pointer-events: none;
	}
	.pfoot {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.pfoot .znote {
		flex: 1;
		margin: 0;
	}
	.pv {
		font-size: 11px;
		font-weight: 600;
		color: var(--ink-muted);
	}
	.pfoot .seg {
		width: 250px;
		flex: none;
	}
	.spots {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.srow {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		border: 0;
		border-radius: 9px;
		background: transparent;
		color: var(--ink);
		font: 600 12.5px var(--font);
		text-align: left;
		cursor: pointer;
	}
	.srow[aria-selected='true'] {
		background: color-mix(in srgb, #7fb8ff 14%, transparent);
	}
	.sn {
		flex: none;
		width: 22px;
		height: 22px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: color-mix(in srgb, var(--ink) 9%, transparent);
		font-size: 10.5px;
		font-weight: 700;
	}
	.sn.warn {
		box-shadow: inset 0 0 0 1.5px #ffb35c;
	}
	small.warn {
		color: #e8913a;
	}

	.trow {
		display: flex;
		align-items: center;
		gap: 12px;
		font-size: 12.5px;
	}
	.nm {
		flex: 1;
		min-width: 0;
	}
	.nm small {
		display: block;
		font-size: 11px;
		color: var(--ink-muted);
	}
	.tg {
		position: relative;
		flex: none;
		width: 44px;
		height: 26px;
		padding: 0;
		border: 0;
		border-radius: 999px;
		background: color-mix(in srgb, var(--ink) 14%, transparent);
		cursor: pointer;
	}
	.tg .k {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #fff;
		transition: left 0.2s;
	}
	.tg.on {
		background: #ffb347;
	}
	.tg.on .k {
		left: 21px;
	}
	.tg:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.kinds {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}
	.kinds button {
		height: 26px;
		padding: 0 10px;
		border: 0;
		border-radius: 8px;
		background: color-mix(in srgb, var(--ink) 7%, transparent);
		color: var(--ink-muted);
		font: 600 11.5px var(--font);
		cursor: pointer;
	}
	.kinds button[aria-pressed='true'] {
		background: #a9cdff;
		color: #08162b;
	}
	.kinds button:disabled {
		opacity: 0.5;
		cursor: default;
	}

	/* ---- pinning a favorite ---- */
	.shade {
		position: fixed;
		inset: 0;
		z-index: 30;
		background: rgba(0, 0, 0, 0.55);
	}
	.pick {
		position: fixed;
		left: 50%;
		top: 90px;
		z-index: 31;
		transform: translateX(-50%);
		width: min(440px, calc(100vw - 32px));
		max-height: calc(100dvh - 120px);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 18px;
		border-radius: 18px;
		background: var(--surface);
		box-shadow:
			0 40px 80px -10px rgba(0, 0, 0, 0.9),
			0 0 0 1px var(--con-edge);
	}
	.ph {
		display: flex;
		align-items: center;
	}
	.ph b {
		flex: 1;
		font-size: 16px;
	}
	.x {
		width: 32px;
		height: 32px;
		display: grid;
		place-items: center;
		border: 0;
		border-radius: 50%;
		background: color-mix(in srgb, var(--ink) 8%, transparent);
		color: var(--ink);
		cursor: pointer;
	}
	.cands {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-height: 0;
		overflow: auto;
	}
	.cand {
		flex: none;
		display: flex;
		align-items: center;
		gap: 10px;
		height: 44px;
		padding: 0 12px 0 8px;
		border: 0;
		border-radius: 10px;
		background: color-mix(in srgb, var(--ink) 4%, transparent);
		color: var(--ink);
		font: 600 13px var(--font);
		text-align: left;
		cursor: pointer;
	}
	.cand:hover {
		background: color-mix(in srgb, var(--ink) 8%, transparent);
	}
	.cand .ft {
		flex: 1;
	}
	.cand b {
		font-size: 11.5px;
		color: var(--cz);
	}
	.cand.pinned b {
		color: var(--ink-muted);
	}

	@media (prefers-reduced-motion: reduce) {
		.tg .k {
			transition: none;
		}
	}
</style>
