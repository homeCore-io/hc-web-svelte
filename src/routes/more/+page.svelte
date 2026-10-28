<!--
	What doesn't fit in the phone bar (N2): the places, then the rooms — in
	the order Home shows them — so a room is never only reachable by
	scrolling Home.
-->
<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { hasSettings } from '#lib/settings.js';
	import { session } from '#lib/me.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { household } from '#lib/household.svelte.js';
	import { apply, ref } from '#lib/layers.js';
	import { view } from '#lib/view.svelte.js';
	import RoomIcon from '#lib/components/RoomIcon.svelte';

	const items = $derived([
		{ href: '/scenes', label: 'Scenes' },
		{ href: '/alerts', label: 'Alerts' },
		...(hasSettings((s) => session.can(s), session.isAdmin)
			? [{ href: '/settings', label: 'Settings' }]
			: []),
		{ href: '/me', label: 'Me' }
	]);
	const roomsInOrder = $derived(
		apply(rooms.list, (r) => ref.room(r.id), view.changes('home')).shown
	);
</script>

<div class="page">
	<ul>
		{#each items as item (item.href)}
			<li>
				<a href={item.href}>
					<span>{item.label}</span>
					<ChevronRight size={18} aria-hidden="true" />
				</a>
			</li>
		{/each}
	</ul>

	{#if roomsInOrder.length > 0}
		<h2>Rooms</h2>
		<ul>
			{#each roomsInOrder as r (r.id)}
				<li>
					<a href={`/rooms/${r.id}`}>
						<span class="room"><RoomIcon name={household.iconOf(r.id)} size={18} />{r.name}</span>
						<ChevronRight size={18} aria-hidden="true" />
					</a>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.page {
		max-width: 720px;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin-top: var(--space-2);
	}
	h2 {
		margin: var(--space-3) 0 0;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		overflow: hidden;
	}
	li + li {
		border-top: 1px solid var(--line);
	}
	a {
		display: flex;
		align-items: center;
		justify-content: space-between;
		min-height: 52px;
		padding: 0 var(--space-4);
		text-decoration: none;
		font-size: 15px;
		font-weight: 600;
		color: var(--ink);
	}
	.room {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	a :global(svg) {
		color: var(--ink-muted);
	}
</style>
