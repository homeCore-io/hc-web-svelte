<!--
	The top of a phone page (the PhonePlan board): its title, large, and the
	person's picture at the right, which opens their own settings. Under
	it, what the page says about itself.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { session } from '#lib/me.svelte.js';
	import Avatar from '#lib/components/Avatar.svelte';
	import { openYou } from './phone.svelte.js';

	let { title, children }: { title: string; children?: Snippet } = $props();

	const open = openYou();
</script>

<header class="ptop">
	<div class="row">
		<h1>{title}</h1>
		{#if open}
			<button
				type="button"
				class="av"
				aria-label="You: your own settings"
				aria-haspopup="dialog"
				onclick={(e) => open(e.currentTarget)}
				><Avatar person={session.me?.id} name={session.me?.username ?? ''} size={34} /></button
			>
		{/if}
	</div>
	{#if children}{@render children()}{/if}
</header>

<style>
	.ptop {
		position: relative;
		padding: 10px 16px 0;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	h1 {
		flex: 1;
		min-width: 0;
		margin: 0;
		font-size: 28px;
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1.15;
	}
	.av {
		flex: none;
		width: 44px;
		height: 44px;
		margin-right: -5px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: none;
	}
</style>
