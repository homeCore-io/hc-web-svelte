<!--
	Everywhere on the phone (the PhonePlan board): Lights, Media, Climate,
	Security and Water as a segmented control, each a view of every room at
	once from the console's (everywhere.ts), a row a room, with its
	house-wide action, which asks first.
-->
<script lang="ts">
	import Everywhere from '../Everywhere.svelte';
	import { VIEWS, type ViewId } from '../everywhere.js';
	import PhoneTop from './PhoneTop.svelte';

	let { view }: { view: ViewId } = $props();
</script>

<PhoneTop title="Everywhere">
	<nav class="seg" aria-label="Everywhere views">
		{#each VIEWS as v (v.id)}
			<a
				href={`/everywhere/${v.id}`}
				class:on={v.id === view}
				aria-current={v.id === view ? 'page' : undefined}
				data-sveltekit-replacestate
				data-sveltekit-noscroll>{v.name}</a
			>
		{/each}
	</nav>
</PhoneTop>
<Everywhere {view} phone />

<style>
	.seg {
		display: flex;
		gap: 4px;
		margin-top: 12px;
		padding: 4px;
		border-radius: 14px;
		background: color-mix(in srgb, var(--ink) 5%, transparent);
	}
	.seg a {
		flex: 1 1 0;
		min-width: 0;
		min-height: 44px;
		display: grid;
		place-items: center;
		padding: 0 2px;
		border-radius: 10px;
		color: var(--ink-muted);
		font-size: 12.5px;
		font-weight: 600;
		text-decoration: none;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.seg a.on {
		background: var(--ink);
		color: var(--bg);
	}
</style>
