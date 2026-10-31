<!--
	A card's tools while arranging (N6), under the card, which goes quiet
	meanwhile (`Arrange`) so nothing can be switched by accident.

	In Customise, for this person: star for Home's favourites, hide or show,
	move up or down, and — for device cards — their form (C1).
	In Edit, for the household: the same, without the star, plus rename.
	In either, a card this layer added can be taken off the page (G18), and a
	card can be moved into another section that takes cards (G22).
-->
<script lang="ts">
	import Star from '@lucide/svelte/icons/star';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Eye from '@lucide/svelte/icons/eye';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import Pencil from '@lucide/svelte/icons/pencil';
	import X from '@lucide/svelte/icons/x';
	import Settings from '@lucide/svelte/icons/settings-2';
	import FolderInput from '@lucide/svelte/icons/folder-input';
	import { apply, cardRef } from '#lib/layers.js';
	import { pluginUis } from '#lib/pluginUi/uis.svelte.js';
	import CardSettings from './CardSettings.svelte';
	import { nudge, nudgeFavourite, toggleFavourite, type Form } from '#lib/layers.js';
	import { personal } from '#lib/personal.svelte.js';
	import { view } from '#lib/view.svelte.js';

	let {
		page,
		ref,
		name,
		shown,
		hidden = false,
		star = true,
		form,
		list = 'page',
		added = false,
		renamed = false,
		settings,
		moveTo = []
	}: {
		page: string;
		ref: string;
		name: string;
		/** The refs shown in this list, in order — for up and down. */
		shown: string[];
		hidden?: boolean;
		star?: boolean;
		/** The card's current form, if it is a device card. */
		form?: Form;
		/** Favourites are ordered in their own list, and leave it by unstarring. */
		list?: 'page' | 'favourites';
		/** Added to this page by the household, rather than generated here. */
		added?: boolean;
		/** Whether `name` is a label given on this page. */
		renamed?: boolean;
		/** Opens its kind's settings sheet (G2). */
		settings?: () => void;
		/** The other sections it can be moved into, as headed on the page (G22). */
		moveTo?: { id: string; title: string }[];
	} = $props();

	let moving = $state(false);
	/** Into another section, at its end; up and down place it from there. */
	function moveInto(id: string) {
		moving = false;
		view.change(page, { op: 'move', ref, before: null, into: id });
	}

	const shared = $derived(view.mode(page) === 'edit');
	const fav = $derived(personal.isFavourite(ref));
	const up = $derived(nudge(shown, ref, -1));
	const down = $derived(nudge(shown, ref, 1));
	const favs = $derived(list === 'favourites');
	function move(by: -1 | 1) {
		if (favs) {
			void personal.change((d) => ({
				...d,
				favourites: nudgeFavourite(d.favourites ?? [], ref, by)
			}));
			return;
		}
		const change = by === -1 ? up : down;
		if (change) view.change(page, change);
	}
	const ALL_FORMS: [Form, string][] = [
		['compact', 'S'],
		['standard', 'M'],
		['large', 'L']
	];
	// A plugin's own card: only the sizes it can be, and its settings.
	const card = $derived.by(() => {
		const parts = cardRef(ref);
		const found = parts ? pluginUis.card(parts.pluginId, parts.element) : undefined;
		return parts && found ? { ...parts, ...found } : undefined;
	});
	const FORMS = $derived(
		card?.slot.forms?.length ? ALL_FORMS.filter(([f]) => card.slot.forms!.includes(f)) : ALL_FORMS
	);
	const config = $derived(apply([ref], (r) => r, view.changes(page)).config(ref) ?? {});
	let setting = $state(false);

	let naming = $state(false);
	let draft = $state('');
	function startNaming() {
		draft = name;
		naming = true;
	}
	function finishNaming(keep: boolean) {
		naming = false;
		if (!keep) return;
		const next = draft.trim();
		if (next === name) return;
		view.change(page, { op: 'rename', ref, name: next });
	}
</script>

{#if naming}
	<form
		class="tools naming"
		onsubmit={(e) => {
			e.preventDefault();
			finishNaming(true);
		}}
	>
		<!-- svelte-ignore a11y_autofocus -->
		<input
			bind:value={draft}
			aria-label={`Name for ${name} on this page`}
			placeholder="Its own name"
			autofocus
			onkeydown={(e) => e.key === 'Escape' && finishNaming(false)}
		/>
		<button type="submit" class="text">Save</button>
	</form>
{:else}
	<div class="tools" class:shared role="group" aria-label={`Arrange ${name}`}>
		{#if star && !shared}
			<button
				aria-pressed={fav}
				aria-label={fav ? `Remove ${name} from favourites` : `Add ${name} to favourites`}
				onclick={() =>
					personal.change((d) => ({ ...d, favourites: toggleFavourite(d.favourites, ref) }))}
			>
				<Star size={18} fill={fav ? 'currentColor' : 'none'} />
			</button>
		{/if}
		{#if added && view.addedHere(page, ref)}
			<button
				aria-label={`Take ${name} off this page`}
				onclick={() => view.change(page, { op: 'remove', ref })}><X size={18} /></button
			>
		{:else if !favs}
			<button
				aria-label={hidden ? `Show ${name}` : `Hide ${name}`}
				onclick={() => view.change(page, { op: hidden ? 'show' : 'hide', ref })}
			>
				{#if hidden}<Eye size={18} />{:else}<EyeOff size={18} />{/if}
			</button>
		{/if}
		{#if !hidden}
			{#if shared}
				<button
					aria-label={`Rename ${name} on this page`}
					aria-pressed={renamed}
					onclick={startNaming}><Pencil size={17} /></button
				>
			{/if}
			<button aria-label={`Move ${name} up`} disabled={!up} onclick={() => move(-1)}
				><ArrowUp size={18} /></button
			>
			<button aria-label={`Move ${name} down`} disabled={!down} onclick={() => move(1)}
				><ArrowDown size={18} /></button
			>
			{#if moveTo.length > 0}
				<button
					aria-label={`Move ${name} to another section`}
					aria-expanded={moving}
					onclick={() => (moving = !moving)}><FolderInput size={18} /></button
				>
			{/if}
			{#if settings}
				<button aria-label={`${name}: settings`} onclick={settings}><Settings size={18} /></button>
			{:else if card?.slot.settings}
				<button aria-label={`${name}: settings`} onclick={() => (setting = true)}
					><Settings size={18} /></button
				>
			{/if}
			{#if form && FORMS.length > 1}
				<span class="forms" role="radiogroup" aria-label={`${name} size`}>
					{#each FORMS as [f, letter] (f)}
						<button
							role="radio"
							aria-checked={form === f}
							aria-label={f}
							onclick={() => view.change(page, { op: 'form', ref, form: f })}>{letter}</button
						>
					{/each}
				</span>
			{/if}
		{/if}
		{#if moving && !hidden}
			<div class="move-to" role="group" aria-label={`Move ${name} to`}>
				<span class="move-label">Move to</span>
				{#each moveTo as s (s.id)}
					<button class="text-plain" onclick={() => moveInto(s.id)}>{s.title}</button>
				{/each}
			</div>
		{/if}
	</div>
{/if}
{#if setting && card}
	<CardSettings
		{page}
		cardId={ref}
		pluginId={card.pluginId}
		ui={card.ui}
		slot={card.slot}
		{config}
		{name}
		close={() => (setting = false)}
	/>
{/if}

<style>
	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 2px;
		padding: 3px;
		border-radius: 12px;
		background: var(--sheet);
		border: 1px solid var(--line);
	}
	.tools.shared {
		border-color: var(--accent);
	}
	button {
		min-width: 34px;
		height: 40px;
		border: none;
		border-radius: 9px;
		background: none;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 13px;
		font-weight: 700;
		color: var(--ink);
	}
	/* The icons share the row: 40px each where there's room, narrower on a
	   half-width card on a phone, so star to Move to stays one tidy row. */
	.tools > button {
		/* A small basis, so they fit a row before it wraps; then up to 40px. */
		flex: 1 1 28px;
		min-width: 28px;
		max-width: 40px;
	}
	button:disabled {
		opacity: 0.3;
	}
	button[aria-pressed='true'] {
		color: var(--accent);
	}
	.forms {
		display: flex;
		margin-left: auto;
	}
	.forms button[aria-checked='true'] {
		background: var(--accent);
		color: var(--accent-ink);
	}
	.move-to {
		flex-basis: 100%;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		padding: 4px 2px 2px;
		border-top: 1px solid var(--line);
	}
	.move-label {
		font-size: 12px;
		color: var(--ink-muted);
		padding: 0 6px;
	}
	.text-plain {
		padding: 0 12px;
		height: 40px;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--surface);
		font-weight: 600;
	}
	.naming {
		flex-wrap: nowrap;
	}
	.naming input {
		flex: 1;
		min-width: 0;
		height: 34px;
		border: none;
		background: none;
		padding: 0 8px;
		outline: none;
	}
	.text {
		padding: 0 12px;
		background: var(--accent);
		color: var(--accent-ink);
	}
</style>
