<!--
	A card's tools in Customise mode (N6): star for Home's favourites, hide or
	show, move up or down, and — for device cards — its form (C1). Shown
	under the card, which goes quiet while arranging (`Arrange`) so nothing can
	be switched by accident.
-->
<script lang="ts">
	import Star from '@lucide/svelte/icons/star';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Eye from '@lucide/svelte/icons/eye';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import { nudge, nudgeFavourite, toggleFavourite, type Form } from '#lib/layers.js';
	import { personal } from '#lib/personal.svelte.js';

	let {
		page,
		ref,
		name,
		shown,
		hidden = false,
		star = true,
		form,
		list = 'page'
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
	} = $props();

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
		if (change) void personal.changePage(page, change);
	}
	const FORMS: [Form, string][] = [
		['compact', 'S'],
		['standard', 'M'],
		['large', 'L']
	];
</script>

<div class="tools" role="group" aria-label={`Arrange ${name}`}>
	{#if star}
		<button
			aria-pressed={fav}
			aria-label={fav ? `Remove ${name} from favourites` : `Add ${name} to favourites`}
			onclick={() =>
				personal.change((d) => ({ ...d, favourites: toggleFavourite(d.favourites, ref) }))}
		>
			<Star size={18} fill={fav ? 'currentColor' : 'none'} />
		</button>
	{/if}
	{#if !favs}
		<button
			aria-label={hidden ? `Show ${name}` : `Hide ${name}`}
			onclick={() => personal.changePage(page, { op: hidden ? 'show' : 'hide', ref })}
		>
			{#if hidden}<Eye size={18} />{:else}<EyeOff size={18} />{/if}
		</button>
	{/if}
	{#if !hidden}
		<button aria-label={`Move ${name} up`} disabled={!up} onclick={() => move(-1)}
			><ArrowUp size={18} /></button
		>
		<button aria-label={`Move ${name} down`} disabled={!down} onclick={() => move(1)}
			><ArrowDown size={18} /></button
		>
		{#if form}
			<span class="forms" role="radiogroup" aria-label={`${name} size`}>
				{#each FORMS as [f, letter] (f)}
					<button
						role="radio"
						aria-checked={form === f}
						aria-label={f}
						onclick={() => personal.changePage(page, { op: 'form', ref, form: f })}>{letter}</button
					>
				{/each}
			</span>
		{/if}
	{/if}
</div>

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
	button {
		min-width: 34px;
		height: 34px;
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
</style>
