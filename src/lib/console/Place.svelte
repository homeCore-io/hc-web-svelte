<!--
	A device's "⋯" in a room's tab (the Garage board): it opens the picker of
	where the device shows (Placer.svelte), for people who may change the
	house's console. Beside it, "moved here" (Moved) when the household chose
	this tab for it, unless its row shows that under the name (`tag`).
	`corner` sits them over a tile, fader or keypad instead: the "⋯" at its
	top right, the tag at its bottom right. `chip` sits it over a scene
	chip's swatch, seen while the chip is hovered or the "⋯" has the
	keyboard, so the chip is no wider. Nothing outside a room, where there's
	no picker.
-->
<script lang="ts">
	import type { CoreDevice } from '#lib/devices.js';
	import { session } from '#lib/me.svelte.js';
	import Moved from './Moved.svelte';
	import { placer } from './placer.svelte.js';

	let {
		d,
		corner = false,
		chip = false,
		tag = true
	}: {
		d: CoreDevice;
		corner?: boolean;
		/** Over a chip's swatch: its parent is positioned, and the swatch at its left. */
		chip?: boolean;
		/** Shows "moved here" beside it; false where the row shows it under the name. */
		tag?: boolean;
	} = $props();

	const p = placer();
	const may = $derived(session.can('content:write'));
	const name = $derived(d.name_override ?? d.name);
	const open = $derived(p?.open?.id === d.device_id);
</script>

{#if p}
	<span class="place" class:corner class:chip>
		{#if tag && !chip}<span class="tg"><Moved {d} /></span>{/if}
		{#if may}
			<button
				type="button"
				class="dots"
				class:open
				aria-label={`Where ${name} shows`}
				aria-haspopup="dialog"
				aria-expanded={open}
				data-placer={d.device_id}
				onclick={(e) => p.toggle(d.device_id, e.currentTarget)}
				><svg viewBox="0 0 16 4" aria-hidden="true"
					><circle cx="2" cy="2" r="1.6" /><circle cx="8" cy="2" r="1.6" /><circle
						cx="14"
						cy="2"
						r="1.6"
					/></svg
				></button
			>
		{/if}
	</span>
{/if}

<style>
	.place {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.place:empty {
		display: none;
	}
	.tg {
		display: flex;
	}
	.tg:empty {
		display: none;
	}
	.place.corner {
		position: absolute;
		inset: 4px;
		z-index: 1;
		pointer-events: none;
	}
	.corner > * {
		position: absolute;
		right: 0;
		pointer-events: auto;
	}
	.corner .dots {
		top: 0;
	}
	.corner .tg {
		bottom: 2px;
	}
	.place.chip {
		position: absolute;
		left: 4px;
		top: 50%;
		margin-top: -9px;
		opacity: 0;
	}
	.chip .dots {
		width: 18px;
		height: 18px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--surface) 92%, transparent);
		color: var(--ink);
	}
	.chip .dots svg {
		width: 10px;
	}
	:global(:hover) > .place.chip,
	.place.chip:focus-within,
	.place.chip:has(.open) {
		opacity: 1;
	}
	.dots {
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		padding: 0;
		border: 0;
		border-radius: 7px;
		background: transparent;
		color: var(--ink-muted);
		cursor: pointer;
	}
	.dots svg {
		width: 13px;
		height: 4px;
		fill: currentColor;
	}
	.dots:hover,
	.dots.open {
		background: color-mix(in srgb, var(--ink) 10%, transparent);
		color: var(--ink);
	}
	.dots:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
</style>
