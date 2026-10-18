<!--
	The generated home (D1): what needs attention and what's on, as chips; this
	person's favourites; the house's modes and the scenes that belong to no
	room; then every room, with its summary and "All off" (C5).

	The household's changes apply, then the person's own on top (M2, M3):
	order, what was hidden, names, and cards the household pinned. Customise
	arranges it for one person; Edit, for everyone (N6).
-->
<script lang="ts">
	import { cardFor, kindOf } from '#lib/card.js';
	import { displayName, type CoreDevice } from '#lib/devices.js';
	import { byRoom, houseChips } from '#lib/summary.js';
	import { added, apply, ref } from '#lib/layers.js';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { scenes } from '#lib/scenes.svelte.js';
	import { commands } from '#lib/commands.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { household } from '#lib/household.svelte.js';
	import { editing } from '#lib/edit.svelte.js';
	import { view } from '#lib/view.svelte.js';
	import { alerts } from '#lib/alerts.svelte.js';
	import AlertList from '#lib/components/AlertList.svelte';
	import { clock } from '#lib/clock.svelte.js';
	import { page } from '$app/state';
	import { openDevice } from '#lib/popup.js';
	import Icon from '#lib/components/Icon.svelte';
	import RoomRow from '#lib/components/RoomRow.svelte';
	import SceneCard from '#lib/components/SceneCard.svelte';
	import ModeChips from '#lib/components/ModeChips.svelte';
	import DeviceCard from '#lib/components/DeviceCard.svelte';
	import Arrange from '#lib/components/Arrange.svelte';
	import CustomiseBar from '#lib/components/CustomiseBar.svelte';
	import CustomiseButton from '#lib/components/CustomiseButton.svelte';

	const HOME = 'home';
	const mode = $derived(view.mode(HOME));
	const arranging = $derived(mode !== null);
	const changes = $derived(view.changes(HOME));

	const list = $derived(Object.values(devices.byId));
	const cards = $derived(new Map(list.map((d) => [d.device_id, cardFor(d, clock.now)])));
	const grouped = $derived(byRoom(devices.byId, rooms.list));
	const chips = $derived(houseChips([...cards.values()]));
	const loose = $derived(grouped.get('') ?? []);
	const cardsOf = (ids: { device_id: string }[]) => ids.map((d) => cards.get(d.device_id)!);
	const isScene = (d: CoreDevice) => kindOf(d) === 'scene';

	// ---- favourites ----
	type Fav =
		| { ref: string; kind: 'device'; device: CoreDevice }
		| { ref: string; kind: 'scene'; id: string; name: string };
	const favourites = $derived(
		(personal.doc.favourites ?? [])
			.map((r): Fav | undefined => {
				if (r.startsWith('device:')) {
					const d = devices.byId[r.slice(7)];
					return d ? { ref: r, kind: 'device', device: d } : undefined;
				}
				if (r.startsWith('scene:')) {
					const s = scenes.list.find((x) => x.id === r.slice(6));
					return s ? { ref: r, kind: 'scene', id: s.id, name: s.name } : undefined;
				}
				return undefined;
			})
			.filter((f): f is Fav => f !== undefined)
	);
	const favRefs = $derived(favourites.map((f) => f.ref));
	const favLayer = $derived(apply(favourites, (f) => f.ref, personal.changes(HOME)));
	const favForm = (r: string) => favLayer.form(r) ?? 'standard';

	// ---- cards the household pinned to Home (M2 `add`) ----
	type Pin =
		| { ref: string; kind: 'device'; device: CoreDevice }
		| { ref: string; kind: 'scene'; id: string; name: string };
	const pins = $derived(
		added(changes)
			.map((r): Pin | undefined => {
				if (r.startsWith('device:')) {
					const d = devices.byId[r.slice(7)];
					return d ? { ref: r, kind: 'device', device: d } : undefined;
				}
				if (r.startsWith('scene:')) {
					const s = scenes.list.find((x) => x.id === r.slice(6));
					return s ? { ref: r, kind: 'scene', id: s.id, name: s.name } : undefined;
				}
				return undefined;
			})
			.filter((p): p is Pin => p !== undefined)
	);
	const pinLayer = $derived(apply(pins, (p) => p.ref, changes));
	const pinList = $derived(arranging ? [...pinLayer.shown, ...pinLayer.hidden] : pinLayer.shown);
	const pinRefs = $derived(pinLayer.shown.map((p) => p.ref));
	const pinName = (p: Pin) =>
		pinLayer.name(p.ref) ?? (p.kind === 'device' ? displayName(p.device) : p.name);

	// ---- scenes in no room, homeCore's and plugins' alike ----
	type SceneItem = {
		ref: string;
		name: string;
		run: () => Promise<boolean | string>;
		details?: () => void;
	};
	const sceneItems = $derived(
		[
			...scenes.list.map((s): SceneItem => ({
				ref: ref.scene(s.id),
				name: s.name,
				run: () => scenes.run(s.id)
			})),
			...loose.filter(isScene).map((d): SceneItem => ({
				ref: ref.device(d.device_id),
				name: displayName(d),
				run: () => commands.act(d.device_id, 'activate'),
				details: () => openDevice(d.device_id, page.url)
			}))
		].sort((a, b) => a.name.localeCompare(b.name))
	);
	const sceneLayer = $derived(apply(sceneItems, (s) => s.ref, changes));
	const sceneList = $derived(
		arranging ? [...sceneLayer.shown, ...sceneLayer.hidden] : sceneLayer.shown
	);
	const sceneRefs = $derived(sceneLayer.shown.map((s) => s.ref));

	// ---- rooms ----
	type RoomItem = { ref: string; href: string; name: string; devices: CoreDevice[] };
	const roomItems = $derived([
		...rooms.list
			.map((r): RoomItem => ({
				ref: ref.room(r.id),
				href: `/rooms/${r.id}`,
				name: r.name,
				devices: grouped.get(r.id) ?? []
			}))
			.filter((r) => r.devices.length > 0),
		...(loose.some((d) => !isScene(d) && kindOf(d) !== 'mode')
			? [
					{
						ref: 'room:none',
						href: '/rooms/none',
						name: 'Not in a room',
						devices: loose.filter((d) => !isScene(d) && kindOf(d) !== 'mode')
					}
				]
			: [])
	]);
	const roomLayer = $derived(apply(roomItems, (r) => r.ref, changes));
	const roomList = $derived(
		arranging ? [...roomLayer.shown, ...roomLayer.hidden] : roomLayer.shown
	);
	const roomRefs = $derived(roomLayer.shown.map((r) => r.ref));

	$effect(() => {
		if (editing.on(HOME))
			editing.present = new Set([
				...pins.map((p) => p.ref),
				...sceneItems.map((s) => s.ref),
				...roomItems.map((r) => r.ref)
			]);
	});
</script>

{#if !devices.loaded}
	<p class="quiet">Loading the house…</p>
{:else}
	<div class="home">
		<CustomiseButton page={HOME} />
		<CustomiseBar page={HOME} home />

		{#if alerts.list.length > 0 && mode !== 'edit'}
			<section aria-label="Needs attention">
				<AlertList list={alerts.list.slice(0, 3)} />
				{#if alerts.list.length > 3}
					<a class="more" href="/alerts">All {alerts.list.length} alerts</a>
				{/if}
			</section>
		{/if}

		{#if chips.length > 0}
			<nav class="chips" aria-label="What's going on">
				{#each chips as c (c.key)}
					<a class="chip" class:alert={c.alert} href={`/on/${c.key}`}>
						<Icon name={c.icon} size={16} />
						{c.text}
					</a>
				{/each}
			</nav>
		{/if}

		{#if pinList.length > 0}
			<section>
				<h2 class="section-label">Pinned</h2>
				<div class="grid">
					{#each pinList as p (p.ref)}
						{@const form = pinLayer.form(p.ref) ?? 'standard'}
						<Arrange
							page={HOME}
							ref={p.ref}
							name={pinName(p)}
							shown={pinRefs}
							hidden={pinLayer.hidden.includes(p)}
							form={p.kind === 'device' && !isScene(p.device) ? form : undefined}
							wide={form === 'large'}
							added
							renamed={pinLayer.name(p.ref) !== undefined}
						>
							{#if p.kind === 'scene'}
								<SceneCard name={pinName(p)} run={() => scenes.run(p.id)} />
							{:else if isScene(p.device)}
								<SceneCard
									name={pinName(p)}
									run={() => commands.act(p.device.device_id, 'activate')}
									details={() => openDevice(p.device.device_id, page.url)}
								/>
							{:else}
								<DeviceCard device={p.device} {form} label={pinLayer.name(p.ref)} />
							{/if}
						</Arrange>
					{/each}
				</div>
			</section>
		{/if}

		{#if mode === 'edit'}
			<!-- Favourites are each person's own; the shared page has none. -->
		{:else if favourites.length > 0}
			<section>
				<h2 class="section-label">Favourites</h2>
				<div class="grid">
					{#each favourites as f (f.ref)}
						{@const form = favForm(f.ref)}
						<Arrange
							page={HOME}
							ref={f.ref}
							name={f.kind === 'device' ? displayName(f.device) : f.name}
							shown={favRefs}
							list="favourites"
							form={f.kind === 'device' && !isScene(f.device) ? form : undefined}
							wide={form === 'large'}
						>
							{#if f.kind === 'scene'}
								<SceneCard name={f.name} run={() => scenes.run(f.id)} />
							{:else if isScene(f.device)}
								<SceneCard
									name={displayName(f.device)}
									run={() => commands.act(f.device.device_id, 'activate')}
									details={() => openDevice(f.device.device_id, page.url)}
								/>
							{:else}
								<DeviceCard device={f.device} {form} />
							{/if}
						</Arrange>
					{/each}
				</div>
			</section>
		{:else if mode === 'customise'}
			<p class="hint">
				Star anything — here or in a room — and it appears in Favourites at the top of Home.
			</p>
		{/if}

		{#if sceneList.length > 0 || list.some((d) => kindOf(d) === 'mode')}
			<section>
				<h2 class="section-label">Scenes &amp; modes</h2>
				<ModeChips />
				<div class="scenes">
					{#each sceneList as s (s.ref)}
						<Arrange
							page={HOME}
							ref={s.ref}
							name={sceneLayer.name(s.ref) ?? s.name}
							shown={sceneRefs}
							hidden={sceneLayer.hidden.includes(s)}
							renamed={sceneLayer.name(s.ref) !== undefined}
						>
							<SceneCard name={sceneLayer.name(s.ref) ?? s.name} run={s.run} details={s.details} />
						</Arrange>
					{/each}
				</div>
			</section>
		{/if}

		<section>
			<h2 class="section-label">Rooms</h2>
			<div class="rooms">
				{#each roomList as r (r.ref)}
					<Arrange
						page={HOME}
						ref={r.ref}
						name={roomLayer.name(r.ref) ?? r.name}
						shown={roomRefs}
						hidden={roomLayer.hidden.includes(r)}
						star={false}
						renamed={roomLayer.name(r.ref) !== undefined}
					>
						<RoomRow
							href={r.href}
							name={roomLayer.name(r.ref) ?? r.name}
							icon={household.iconOf(r.ref.slice(5))}
							devices={r.devices}
							cards={cardsOf(r.devices)}
						/>
					</Arrange>
				{/each}
			</div>
		</section>
	</div>
{/if}

<style>
	.home {
		display: flex;
		flex-direction: column;
		gap: 22px;
		max-width: 1100px;
	}
	section {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.more {
		align-self: flex-start;
		color: var(--accent);
		font-weight: 600;
		text-decoration: none;
	}
	.quiet,
	.hint {
		color: var(--ink-muted);
		margin: 0;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.chip {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 36px;
		padding: 0 12px 0 10px;
		border-radius: 18px;
		border: 1px solid var(--lit-card-line);
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-size: 13px;
		font-weight: 600;
		text-decoration: none;
	}
	.chip.alert {
		border-color: var(--alert-line);
		background: var(--alert-bg);
		color: var(--alert);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
		align-items: start;
	}
	.scenes {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
	}
	.rooms {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	@media (min-width: 700px) {
		.grid {
			grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
		}
		.scenes {
			grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
		}
		.rooms {
			display: grid;
			grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		}
	}
</style>
