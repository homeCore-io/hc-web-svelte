<!--
	A column of a console tab, as the Lights and Media tabs draw theirs: a
	heading with the system's tag (Hue, Lutron, YoLink), the thing's name and
	a short note, then what's in it. Columns sit side by side with a rule
	between; on a phone (phone.svelte.ts), one under another, each as wide as
	the phone. The Climate, Doors, Water and Sensors tabs share it. A column of
	one device has its "⋯" (`place`) in the gutter at the heading's end, so
	its note keeps the room it had, and "moved here" after the note.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { CoreDevice } from '#lib/devices.js';
	import Place from './Place.svelte';
	import Moved from './Moved.svelte';
	import { brandOf } from './room.js';
	import { stacked } from './phone/phone.svelte.js';

	let {
		title,
		plugin,
		note,
		alert = false,
		width,
		grow = false,
		flex,
		onopen,
		place,
		children
	}: {
		title: string;
		/** The plugin it comes from, for its tag; none for a column of several. */
		plugin?: string;
		note?: string;
		/** The note is a warning: open, wet, offline. */
		alert?: boolean;
		/** A set width, written against the tab's `--k` where it shrinks with the window. */
		width?: string;
		/** Takes the room the others leave. */
		grow?: boolean;
		/** Its own share of the row, as CSS `flex` says it. */
		flex?: string;
		/** Its name opens the thing's page. */
		onopen?: () => void;
		/** The one device it shows, for its "⋯". */
		place?: CoreDevice;
		children: Snippet;
	} = $props();

	const brand = $derived(plugin === undefined ? undefined : brandOf(plugin));
	const tagOf = $derived((plugin ?? '').split('.').pop());
	const stack = stacked();
</script>

<section
	class="col"
	class:grow
	class:stack
	class:placed={!!place}
	style:width={stack ? undefined : width}
	style:flex={stack ? undefined : flex}
	aria-label={title}
>
	<div class="ch">
		{#if brand}<span class="tag" data-brand={tagOf}>{brand}</span>{/if}
		{#if onopen}
			<button type="button" class="ttl" onclick={onopen}>{title}</button>
		{:else}<span class="ttl">{title}</span>{/if}
		{#if note}<span class="cn" class:alert>{note}</span>{/if}
		{#if place}<Moved d={place} /><span class="pl"><Place d={place} tag={false} /></span>{/if}
	</div>
	{@render children()}
</section>

<style>
	.col {
		display: flex;
		flex-direction: column;
		gap: calc(8px + 4px * var(--k, 1));
		padding: 0 20px;
		border-left: 1px solid var(--con-edge-strong);
		flex: none;
		min-width: 0;
	}
	.col:first-child {
		border-left: 0;
	}
	.col.stack {
		flex: none;
		width: 100%;
		box-sizing: border-box;
		padding: 0;
		border-left: 0;
	}
	.col.stack:not(:first-child) {
		margin-top: 4px;
		padding-top: 18px;
		border-top: 1px solid var(--con-edge-strong);
	}
	/* As wide as its rows need, at least: past that, the columns wrap. */
	.col.grow {
		flex: 1 1 200px;
		min-width: 240px;
	}
	.ch {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 22px;
		font-size: 12.5px;
		font-weight: 700;
		min-width: 0;
	}
	.ttl {
		border: 0;
		padding: 0;
		background: none;
		color: var(--ink);
		font: inherit;
		text-align: left;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		min-width: 0;
	}
	button.ttl {
		cursor: pointer;
	}
	button.ttl:hover {
		text-decoration: underline;
	}
	button.ttl:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	/* The note gives way before the name does. */
	.cn {
		flex: 0 1000 auto;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		font-size: 11.5px;
		font-weight: 500;
		color: var(--ink-muted);
		white-space: nowrap;
	}
	.col.placed {
		position: relative;
	}
	/* In the column's right padding. */
	.pl {
		position: absolute;
		top: 0;
		right: 0;
		width: 20px;
		display: flex;
		justify-content: center;
	}
	.pl :global(.dots) {
		width: 20px;
	}
	.cn.alert {
		color: var(--alert);
	}
	.tag {
		flex: none;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		padding: 3px 7px;
		border-radius: 6px;
		background: color-mix(in srgb, var(--ink) 10%, transparent);
		color: color-mix(in srgb, var(--ink) 85%, transparent);
	}
	.tag[data-brand='hue'],
	.tag[data-brand='zwave'] {
		background: rgba(127, 184, 255, 0.18);
		color: #a9cdff;
	}
	.tag[data-brand='lutron'],
	.tag[data-brand='caseta'],
	.tag[data-brand='thermostat'] {
		background: rgba(255, 196, 107, 0.16);
		color: #ffd9a0;
	}
	.tag[data-brand='yolink'] {
		background: rgba(79, 224, 160, 0.16);
		color: #9ff0c9;
	}
	.tag[data-brand='nuheat'],
	.tag[data-brand='mysa'] {
		background: rgba(255, 138, 61, 0.18);
		color: #ffc49a;
	}
	:global(:root[data-theme='light']) .tag[data-brand='hue'],
	:global(:root[data-theme='light']) .tag[data-brand='zwave'] {
		color: #1f5fae;
	}
	:global(:root[data-theme='light']) .tag[data-brand='lutron'],
	:global(:root[data-theme='light']) .tag[data-brand='caseta'],
	:global(:root[data-theme='light']) .tag[data-brand='thermostat'] {
		color: #8a5a10;
	}
	:global(:root[data-theme='light']) .tag[data-brand='yolink'] {
		color: #157a4f;
	}
	:global(:root[data-theme='light']) .tag[data-brand='nuheat'],
	:global(:root[data-theme='light']) .tag[data-brand='mysa'] {
		color: #a24a12;
	}
</style>
