<!--
	The house's assistant as a page of its own (`app.assistant`): how a phone
	opens it, the whole screen, with none of the frame around it. The plugin's
	element draws all of it, its way back included; its `close` event, or
	Escape, goes back to where the person was (Home, if they came straight here).
-->
<script lang="ts">
	import { afterNavigate, goto } from '$app/navigation';
	import PluginSlot from '#lib/pluginUi/PluginSlot.svelte';
	import { pluginUis } from '#lib/pluginUi/uis.svelte.js';
	import { assistant } from '#lib/pluginUi/assistant.svelte.js';

	pluginUis.ensure();
	const offer = $derived(assistant.offer);

	let inApp = false;
	afterNavigate((nav) => {
		if (nav.from) inApp = true;
	});
	function close() {
		if (inApp) history.back();
		else void goto('/', { replaceState: true });
	}
	const given = { mode: 'page' };
	const on = { close };

	function keys(e: KeyboardEvent) {
		if (e.key !== 'Escape' || e.defaultPrevented) return;
		e.preventDefault();
		close();
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<main id="main" class="ask" tabindex="-1" aria-label="Ask homeCore" onkeydown={keys}>
	{#if offer}
		<PluginSlot pluginId={offer.pluginId} ui={offer.ui} slot={offer.slot} props={given} {on} />
	{:else if pluginUis.loaded}
		<div class="none">
			<h1>Ask homeCore</h1>
			<p>No assistant is running in this house. An admin can add one in Settings › Plugins.</p>
			<a href="/">Go to Home</a>
		</div>
	{/if}
</main>

<style>
	.ask {
		box-sizing: border-box;
		height: 100dvh;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		padding: env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom)
			env(safe-area-inset-left);
		background: var(--sheet);
		color: var(--ink);
		outline: none;
	}
	.ask > :global(.slot) {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
	.ask > :global(.slot > *) {
		flex: 1;
		min-height: 0;
	}
	.ask > :global(p) {
		margin: 16px;
	}
	.none {
		padding: 24px 16px;
	}
	.none h1 {
		margin: 0 0 8px;
		font-size: 24px;
		font-weight: 800;
	}
	.none p {
		margin: 0 0 16px;
		color: var(--ink-muted);
	}
	.none a {
		color: var(--accent);
		font-weight: 600;
	}
</style>
