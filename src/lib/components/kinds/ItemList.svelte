<!--
	What worth knowing lists: a name, its room, what it's doing.
	`plain`: under its section's own heading, beside the rooms (mockup A).
-->
<script lang="ts">
	import { page } from '$app/state';
	import type { Item } from '#lib/pieces.js';
	import { deviceHref, openDevice } from '#lib/popup.js';

	let {
		title,
		items,
		none,
		plain = false
	}: { title: string; items: Item[]; none: string; plain?: boolean } = $props();
</script>

<article class="piece" class:plain aria-label={title}>
	{#if !plain}<h3>{title}</h3>{/if}
	{#if items.length === 0}
		<p class="quiet">{none}</p>
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
						<span class="name">{i.name}</span>
						<span class="what" class:alert={i.alert}
							>{i.what}{#if i.room}<span class="room">{' · '}{i.room}</span>{/if}</span
						>
					</a>
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
	.plain a {
		min-height: 40px;
	}
	.plain .name {
		font-size: 13px;
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
		gap: 2px;
	}
	a {
		display: flex;
		flex-direction: column;
		min-height: var(--target);
		justify-content: center;
		color: inherit;
		text-decoration: none;
		border-radius: 8px;
	}
	a:hover .name {
		text-decoration: underline;
	}
	.name {
		font-weight: 600;
		font-size: 14px;
	}
	.what {
		font-size: 12.5px;
		color: var(--ink-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.what.alert {
		color: var(--alert);
		font-weight: 600;
	}
	.room {
		font-weight: 400;
		color: var(--ink-muted);
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
	}
</style>
