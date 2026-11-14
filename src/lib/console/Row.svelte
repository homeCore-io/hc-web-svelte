<!--
	A row of a console list (the Garage board's "Other doors" and "Watching"):
	a light for its state, the thing's name with where it's from under it,
	and its state or a button at the end. The name opens the thing's page.
	In a room, `place` adds its "⋯" (Place), and "moved here" under the name.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { CoreDevice } from '#lib/devices.js';
	import Place from './Place.svelte';
	import Moved from './Moved.svelte';

	let {
		name,
		sub,
		dot = 'quiet',
		word,
		onopen,
		place,
		children
	}: {
		name: string;
		sub?: string;
		/** Its light: quiet when nothing's happening, busy when something is, alert when wrong. */
		dot?: 'quiet' | 'busy' | 'alert' | 'ok';
		/** Its state at the end, when there's no button there. */
		word?: string;
		onopen?: () => void;
		/** The device, for its "⋯". */
		place?: CoreDevice;
		children?: Snippet;
	} = $props();
</script>

<div class="row">
	<span class="dot {dot}" aria-hidden="true"></span>
	{#if onopen}
		<button type="button" class="nm" title={name} onclick={onopen}
			>{name}{#if sub}<small>{sub}</small>{/if}{#if place}<Moved d={place} />{/if}</button
		>
	{:else}<span class="nm" title={name}
			>{name}{#if sub}<small>{sub}</small>{/if}{#if place}<Moved d={place} />{/if}</span
		>{/if}
	{#if word}<b class="word {dot}">{word}</b>{/if}
	{@render children?.()}
	{#if place}<Place d={place} tag={false} />{/if}
</div>

<style>
	.row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: calc(4px + 5px * var(--k, 1)) 0;
		min-width: 0;
	}
	.row:not(:first-child) {
		border-top: 1px solid var(--con-edge);
	}
	.dot {
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: color-mix(in srgb, var(--ink) 22%, transparent);
	}
	.dot.busy {
		background: #ffc46b;
		box-shadow: 0 0 8px #ffc46b;
	}
	.dot.alert {
		background: var(--alert);
		box-shadow: 0 0 8px var(--alert);
	}
	.dot.ok {
		background: var(--good, #4fe0a0);
		box-shadow: 0 0 8px var(--good, #4fe0a0);
	}
	.nm {
		flex: 1 1 55%;
		min-width: 0;
		border: 0;
		padding: 0;
		background: none;
		color: var(--ink);
		font: inherit;
		font-size: 13px;
		font-weight: 500;
		text-align: left;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	button.nm {
		cursor: pointer;
	}
	button.nm:hover {
		text-decoration: underline;
	}
	button.nm:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	small {
		display: block;
		font-size: 11px;
		color: var(--ink-muted);
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.word {
		/* The name gives way, never the state: "Vacant for 27 d" is read whole. */
		flex: 0 0 auto;
		max-width: 60%;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 12.5px;
		font-weight: 600;
		color: var(--ink-muted);
	}
	.word.busy {
		color: #ffd9a0;
	}
	.word.alert {
		color: var(--alert);
	}
	:global(:root[data-theme='light']) .word.busy {
		color: #8a5a10;
	}
</style>
