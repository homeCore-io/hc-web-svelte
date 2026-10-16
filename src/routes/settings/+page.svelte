<!--
	Settings (N1): round one's part of it — rooms, devices' names and rooms,
	asking before commands, and how the house looks. The rest stays in
	hc-web-flutter until it is built here.
-->
<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { session } from '#lib/me.svelte.js';

	const items = [
		{ href: '/settings/rooms', label: 'Rooms', detail: 'Names, order and icons; new rooms' },
		{ href: '/settings/devices', label: 'Devices', detail: 'Names, and which room each is in' },
		{
			href: '/settings/asking',
			label: 'Asking first',
			detail: 'Which commands ask before they go'
		},
		{ href: '/settings/alerts', label: 'Alerts', detail: 'Time rules: a door open at night' },
		{ href: '/settings/look', label: 'Look', detail: 'The house’s theme and phone bar' }
	];
</script>

{#if !session.can('content:write')}
	<p class="quiet">Settings are for people who may change the house.</p>
{:else}
	<ul>
		{#each items as item (item.href)}
			<li>
				<a href={item.href}>
					<span class="text">
						<span class="label">{item.label}</span>
						<span class="detail">{item.detail}</span>
					</span>
					<ChevronRight size={18} aria-hidden="true" />
				</a>
			</li>
		{/each}
	</ul>
	<p class="quiet">Everything else is still in the admin console.</p>
{/if}

<style>
	ul {
		list-style: none;
		max-width: 640px;
		margin: var(--space-2) 0 var(--space-4);
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
		gap: var(--space-3);
		min-height: 60px;
		padding: var(--space-2) var(--space-4);
		text-decoration: none;
		color: var(--ink);
	}
	a :global(svg) {
		color: var(--ink-muted);
		flex: none;
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.label {
		font-size: 15px;
		font-weight: 600;
	}
	.detail,
	.quiet {
		color: var(--ink-muted);
		font-size: 13px;
	}
</style>
