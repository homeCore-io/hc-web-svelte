<!--
	A page someone made (G27): the house's, arranged in Edit by people who may
	edit the house's pages — and by each person for themselves in Customise,
	as Home is — or a person's own, arranged in Customise. Nothing on it is
	generated: what its layer added, in the sections it made, drawn by
	`PageView`. An empty page says how to start.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Plus from '@lucide/svelte/icons/plus';
	import Info from '@lucide/svelte/icons/info';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { scenes } from '#lib/scenes.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { household } from '#lib/household.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { customise } from '#lib/customise.svelte.js';
	import { adding } from '#lib/adding.svelte.js';
	import { cardRef } from '#lib/layers.js';
	import { builtPage } from '#lib/page.js';
	import { findPage, mayChange, pageKeyOf } from '#lib/built.js';
	import { pluginUis } from '#lib/pluginUi/uis.svelte.js';
	import { view } from '#lib/view.svelte.js';
	import CustomiseBar from '#lib/components/CustomiseBar.svelte';
	import PageView from '#lib/components/PageView.svelte';

	const id = $derived(page.params.id ?? '');
	const key = $derived(pageKeyOf(id));
	const found = $derived(findPage(id, household.doc, personal.doc));
	const loaded = $derived(household.loaded && personal.loaded);

	$effect(() => heading.show(found?.name ?? null));

	const doc = $derived(
		builtPage(id, {
			devices: devices.byId,
			rooms: rooms.list,
			scenes: scenes.list,
			added: view.added(key),
			pluginCard: (r) => {
				const c = cardRef(r);
				const got = c ? pluginUis.card(c.pluginId, c.element) : undefined;
				return got
					? { label: got.slot.label ?? 'A plugin’s card', forms: got.slot.forms }
					: undefined;
			}
		})
	);
	const arranging = $derived(view.mode(key) !== null);
	const empty = $derived(view.added(key).length === 0);
	const canChange = $derived(
		found !== undefined && !session.isDisplay && mayChange(found, session.can('content:write'))
	);

	/** Start arranging — Edit for the house's page, Customise for one's own — and open Add or New section. */
	async function start(then: 'add' | 'section') {
		if (found?.whose === 'house') await goto(`${page.url.pathname}?edit=1`);
		else customise.page = key;
		if (then === 'add') adding.open(key);
		else making = true;
	}
	let making = $state(false);
	let about = $state(false);

	// Made just now and empty (NewPage): open ready to add to, in Customise.
	$effect(() => {
		if (!page.url.searchParams.has('customise') || found === undefined) return;
		customise.page = key;
		void goto(page.url.pathname, { replaceState: true });
	});
</script>

{#if !devices.loaded || !loaded}
	<p class="quiet">Loading the house…</p>
{:else if found === undefined}
	<p class="quiet">This page isn’t here any more.</p>
{:else}
	<div class="built">
		<CustomiseBar page={key} own={found.whose === 'mine'} />
		<div class="top">
			<span class="whose">{found.whose === 'house' ? 'Everyone' : 'Just you'}</span>
			<button class="about" onclick={() => (about = true)}
				><Info size={16} aria-hidden="true" />This page</button
			>
		</div>
		{#if empty && !arranging}
			<div class="empty">
				<b>Nothing on this page yet.</b>
				{#if canChange}
					<p>
						Add a card — a device, a scene, a room’s box, weather, a chart, a note — or make a
						section first. It’s the same Add as on Home.
					</p>
					<span class="go">
						<button class="add" onclick={() => start('add')}
							><Plus size={16} aria-hidden="true" />Add</button
						>
						<button class="section" onclick={() => start('section')}
							><Plus size={16} aria-hidden="true" />New section</button
						>
					</span>
				{/if}
			</div>
		{/if}
		<PageView page={doc} bind:making />
	</div>
{/if}
{#if about && found}
	{#await import('#lib/components/PageAbout.svelte') then { default: PageAbout }}
		<PageAbout p={found} close={() => (about = false)} />
	{/await}
{/if}

<style>
	.built {
		display: flex;
		flex-direction: column;
		gap: 22px;
		max-width: 1100px;
	}
	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		margin-bottom: -8px;
	}
	.whose {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.about {
		height: 36px;
		padding: 0 14px;
		display: flex;
		align-items: center;
		gap: 6px;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: 13px;
		font-weight: 600;
	}
	.quiet {
		color: var(--ink-muted);
		margin: 0;
	}
	.empty {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 12px;
		padding: 28px;
		border-radius: var(--radius);
		border: 1px dashed var(--line);
		background: var(--surface);
	}
	.empty p {
		margin: 0;
		max-width: 520px;
		font-size: 14px;
		color: var(--ink-muted);
	}
	.go {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.go button {
		height: 44px;
		padding: 0 18px;
		border-radius: 999px;
		display: flex;
		align-items: center;
		gap: 6px;
		font: inherit;
		font-size: 14px;
		font-weight: 700;
	}
	.add {
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.section {
		border: 1px dashed var(--accent);
		background: none;
		color: var(--accent);
	}
</style>
