<!--
	The look editor's live preview (13 §11): a room of the house, Home, or a
	display at rest, drawn in the look being made, with the house's own
	devices. It shows the page as the look starts it, before anyone arranges
	it, and does nothing when touched.
-->
<script lang="ts">
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { cardRef } from '#lib/layers.js';
	import { roomPage, type RoomInput } from '#lib/page.js';
	import { pluginUis } from '#lib/pluginUi/uis.svelte.js';
	import { previewIn } from '#lib/look.svelte.js';
	import { drawingOf, feelVars, type Look } from '#lib/looks/model.js';
	import { homeChanges } from '#lib/looks/home.js';
	import { homeDocument } from '#lib/homeDoc.js';
	import PageView from '../PageView.svelte';

	let {
		draft,
		show,
		room
	}: {
		draft: Look;
		show: 'room' | 'home' | 'display';
		room: string;
	} = $props();

	previewIn(() => draft);

	const style = $derived(
		Object.entries(feelVars(draft.feel))
			.map(([k, v]) => `${k}: ${v}`)
			.join('; ')
	);

	let grouping = $state<typeof import('#lib/looks/grouping.js') | null>(null);
	$effect(() => {
		if (draft.grouping.room && !grouping)
			void import('#lib/looks/grouping.js').then((m) => (grouping = m));
	});
	const input = $derived<RoomInput>({
		devices: devices.byId,
		rooms: rooms.list,
		added: [],
		pluginCard: (r) => {
			const c = cardRef(r);
			const found = c ? pluginUis.card(c.pluginId, c.element) : undefined;
			return found
				? { label: found.slot.label ?? 'A plugin’s card', forms: found.slot.forms }
				: undefined;
		},
		now: clock.now
	});
	const roomDoc = $derived.by(() => {
		const rules = draft.grouping.room;
		const doc =
			rules && grouping
				? grouping.groupRoom(
						room,
						input,
						rules,
						draft.frame,
						drawingOf(draft, 'lights') === 'lit',
						draft.drawings
					)
				: roomPage(room, input);
		// Its own key, so no one's arranging of the real room shows here.
		return { ...doc, id: `preview|${doc.id}` };
	});
	const homeDoc = $derived({ ...homeDocument(), id: 'preview|home' });
	const base = $derived(homeChanges(draft.grouping.home));
	const name = $derived(rooms.list.find((r) => r.id === room)?.name ?? '');
	// A grouped room as a wide screen draws it, made smaller to fit (N2): its
	// areas side by side, as the author draws them, not a narrower screen's order.
	const WIDE = 1120;
	let across = $state(WIDE);
	const zoom = $derived(Math.min(1, across / WIDE));
</script>

<div class="preview" {style} data-motion={draft.feel.motion} inert aria-label="Preview">
	{#if show === 'room'}
		{#if !draft.grouping.room}<h2 class="title">{name}</h2>{/if}
		{#if !draft.grouping.room}<PageView page={roomDoc} />
		{:else if grouping}
			<div class="fit" bind:clientWidth={across}>
				<div class="wide" style={`width: ${WIDE}px; zoom: ${zoom}`}>
					<PageView page={roomDoc} />
				</div>
			</div>
		{/if}
	{:else if show === 'home'}
		<h2 class="title">Home</h2>
		<PageView page={homeDoc} {base} />
	{:else if draft.frame.rest.on}
		<div class="rest">
			{#snippet lit()}
				{#await import('#lib/lit/LitRest.svelte') then { default: LitRest }}
					<LitRest now={new Date(clock.now)} wake={() => {}} />
				{/await}
			{/snippet}
			{#if draft.frame.rest.piece}
				{#await import('./PluginRest.svelte') then { default: PluginRest }}
					<PluginRest id={draft.frame.rest.piece} wake={() => {}} fallback={lit} />
				{/await}
			{:else}
				{@render lit()}
			{/if}
		</div>
		<p class="note">After {draft.frame.rest.after} seconds untouched. A touch wakes it.</p>
	{:else}
		<p class="note">No rest view: a display stays on its page.</p>
	{/if}
</div>

<style>
	.preview {
		padding: 16px;
		border-radius: 22px;
		border: 1px solid var(--line);
		background: var(--bg);
		font-size: calc(16px * var(--feel-type, 1));
		min-width: 0;
	}
	.fit {
		min-width: 0;
		overflow: hidden;
	}
	.title {
		margin: 0 0 12px;
		font-size: 28px;
	}
	/* A display at rest fills its screen; here, this box. */
	.rest {
		position: relative;
		height: 520px;
		border-radius: 16px;
		overflow: hidden;
		transform: translateZ(0);
	}
	.note {
		color: var(--ink-muted);
		font-size: 14px;
	}
</style>
