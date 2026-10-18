<!-- What doesn't fit in the phone bar (N2). -->
<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { hasSettings } from '#lib/settings.js';
	import { session } from '#lib/me.svelte.js';

	const items = $derived([
		{ href: '/alerts', label: 'Alerts' },
		...(hasSettings((s) => session.can(s), session.isAdmin)
			? [{ href: '/settings', label: 'Settings' }]
			: []),
		{ href: '/me', label: 'Me' }
	]);
</script>

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

<style>
	ul {
		list-style: none;
		margin: var(--space-2) 0 0;
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
	a :global(svg) {
		color: var(--ink-muted);
	}
</style>
