<!--
	The assistant's panel (`app.assistant`): the plugin's element at the right
	of the frame, beside the page on a wide screen and over it on a narrower
	one. The element draws everything inside, its header and close button
	too; the panel gives it room, closes on its `close` event or on Escape
	pressed inside it, and puts the keyboard in it when the Ask button opens
	it (and back on the button when it closes; assistant.svelte.ts).
-->
<script lang="ts">
	import { tick } from 'svelte';
	import PluginSlot from './PluginSlot.svelte';
	import { assistant } from './assistant.svelte.js';

	let {
		top = '0px',
		overTop = top
	}: {
		/** What sits above it in the frame (the console's toolbar), so it starts below. */
		top?: string;
		/** The same when it is over the page: the standard frame's header stays in sight. */
		overTop?: string;
	} = $props();

	let box = $state<HTMLElement>();
	const offer = $derived(assistant.offer);
	const given = { mode: 'panel' };
	const on = { close: () => assistant.close() };

	// Opened by the button: the keyboard goes in, to whatever the element
	// focuses itself (its question box), else the element, else the panel.
	$effect(() => {
		if (!box || !assistant.takeFocus()) return;
		const panel = box;
		let gone = false;
		void (async () => {
			await tick();
			for (let i = 0; i < 60 && !gone; i++) {
				const el = panel.querySelector('.slot > *') as HTMLElement | null;
				if (el) {
					await new Promise((r) => requestAnimationFrame(r));
					if (gone || panel.contains(document.activeElement)) return;
					el.focus();
					if (!panel.contains(document.activeElement)) panel.focus();
					return;
				}
				await new Promise((r) => setTimeout(r, 50));
			}
			if (!gone && !panel.contains(document.activeElement)) panel.focus();
		})();
		return () => (gone = true);
	});

	function keys(e: KeyboardEvent) {
		if (e.key !== 'Escape' || e.defaultPrevented) return;
		e.preventDefault();
		e.stopPropagation();
		assistant.close();
	}
</script>

{#if assistant.open && offer}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<aside
		id="hc-ask"
		bind:this={box}
		class:over={!assistant.beside}
		style:--ask-top={top}
		style:--ask-over-top={overTop}
		aria-label="Ask homeCore"
		tabindex="-1"
		onkeydown={keys}
	>
		<PluginSlot pluginId={offer.pluginId} ui={offer.ui} slot={offer.slot} props={given} {on} />
	</aside>
{/if}

<style>
	aside {
		position: sticky;
		top: var(--ask-top);
		z-index: 15;
		flex: none;
		box-sizing: border-box;
		width: 440px;
		height: calc(100dvh - var(--ask-top));
		display: flex;
		flex-direction: column;
		overflow: hidden;
		background: var(--sheet);
		color: var(--ink);
		border-left: 1px solid var(--line);
		box-shadow: -8px 0 30px color-mix(in srgb, var(--ink) 8%, transparent);
		outline: none;
	}
	/* A screen too narrow to share: over the page, at the right. */
	aside.over {
		position: fixed;
		top: var(--ask-over-top);
		right: 0;
		bottom: 0;
		z-index: 30;
		width: min(440px, 100vw);
		height: auto;
		box-shadow: -12px 0 40px color-mix(in srgb, var(--ink) 18%, transparent);
	}
	/* The element fills the panel and scrolls inside itself. */
	aside > :global(.slot) {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}
	aside > :global(.slot > *) {
		flex: 1;
		min-height: 0;
	}
	aside > :global(p) {
		margin: 16px 20px;
	}
</style>
