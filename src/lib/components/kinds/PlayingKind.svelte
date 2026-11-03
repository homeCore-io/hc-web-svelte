<!--
	Every speaker and TV playing now (G-c), as mockup A draws it: its artwork
	or icon, what's playing, its room, and a pause button. The row opens the
	player; the button only pauses it.
-->
<script lang="ts">
	import Pause from '@lucide/svelte/icons/pause';
	import { page } from '$app/state';
	import { cardFor } from '#lib/card.js';
	import { clock } from '#lib/clock.svelte.js';
	import { commands } from '#lib/commands.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import type { KindProps } from '#lib/kinds.js';
	import { playingNow } from '#lib/pieces.js';
	import { deviceHref, openDevice } from '#lib/popup.js';
	import Art from '../Art.svelte';

	let { label, place }: KindProps<'playing'> = $props();
	const title = $derived(label ?? 'Playing');
	const items = $derived(
		playingNow(
			Object.values(devices.byId).map((d) => cardFor(d, clock.now)),
			devices.byId,
			rooms.list
		)
	);
</script>

<article class="piece" class:plain={place === 'side'} aria-label={title}>
	{#if place !== 'side'}<h3>{title}</h3>{/if}
	{#if items.length === 0}
		<p class="quiet">Nothing playing.</p>
	{:else}
		<ul>
			{#each items as i (i.id)}
				<li>
					<a
						href={deviceHref(i.id, page.url)}
						onclick={(e) => {
							e.preventDefault();
							openDevice(i.id, page.url);
						}}
					>
						<span class="art"><Art src={i.art} icon={i.icon} size={18} logo={i.artLogo} /></span>
						<span class="words">
							<span class="title">{i.title}</span>
							{#if i.where}<span class="where">{i.where}</span>{/if}
						</span>
					</a>
					{#if i.pause}
						<button
							class="pause"
							aria-label={`Pause ${i.title}`}
							onclick={() => commands.act(i.id, i.pause!)}
							><Pause size={14} fill="currentColor" stroke="none" /></button
						>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</article>

<style>
	.piece {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 14px 16px;
		border: 1px solid var(--card-line);
		border-radius: var(--radius);
		background: var(--surface);
		min-width: 0;
	}
	.plain {
		padding: 0;
		border: none;
		background: none;
	}
	h3 {
		margin: 0;
		font-size: 14px;
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	li {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	a {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: var(--target);
		color: inherit;
		text-decoration: none;
	}
	a:hover .title {
		text-decoration: underline;
	}
	.art {
		width: 40px;
		height: 40px;
		flex: none;
		border-radius: 9px;
		background: var(--surface-2);
		color: var(--ink-muted);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
	}
	.words {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.title,
	.where {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.title {
		font-size: 13px;
		font-weight: 600;
	}
	.where {
		font-size: 12px;
		color: var(--ink-muted);
	}
	.pause {
		position: relative;
		width: 36px;
		height: 36px;
		flex: none;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	/* A 44px target around the 36px button. */
	.pause::before {
		content: '';
		position: absolute;
		inset: -4px;
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
	}
</style>
