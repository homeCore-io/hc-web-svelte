<!--
	Home's style (G3, G-b): the room list as Home began, the room field, the
	room tiles, or rooms in the sidebar. Choosing one writes what it is made
	of — the Rooms section's layout, the big numbers shown or not, the
	sidebar's rooms — in the layer being changed, so it can still be moved
	about afterwards.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import X from '@lucide/svelte/icons/x';
	import { apply } from '#lib/layers.js';
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import { STYLES, styleOf, type Style } from '#lib/styles.js';
	import { view } from '#lib/view.svelte.js';

	let { page, close }: { page: string; close: () => void } = $props();

	let dialog = $state<HTMLDialogElement>();
	onMount(() => dialog?.showModal());
	const layout = $derived(
		apply(['section:rooms'], (r) => r, view.changes(page)).config('section:rooms')?.layout
	);
	const current = $derived(
		styleOf(typeof layout === 'string' ? layout : 'list', kindOptions.shellRooms(page))
	);
	const who = $derived(
		view.mode(page) === 'edit'
			? 'For everyone — unless they chose their own.'
			: 'Only you see this, on top of the house’s Home.'
	);
	// Each style's little drawing: which cells glow, and how many columns.
	const DRAW: Record<Style, { side: boolean; cols: number; cells: string[] }> = {
		list: { side: false, cols: 2, cells: ['lit', 'dim', 'soft', 'dim', 'dim', 'dim'] },
		field: { side: false, cols: 4, cells: ['lit wide', 'soft wide', 'soft', 'dim', 'lit', 'dim'] },
		tiles: { side: false, cols: 3, cells: ['lit', 'lit', 'soft', 'soft', 'dim', 'dim'] },
		side: { side: true, cols: 2, cells: ['dim', 'dim', 'dim', 'dim'] }
	};
	function pick(style: Style) {
		if (style !== current) kindOptions.chooseStyle(page, style);
		dialog?.close();
	}
</script>

<dialog
	bind:this={dialog}
	aria-label="Home’s style"
	onclose={close}
	onclick={(e) => {
		if (e.target === dialog) dialog?.close();
	}}
>
	<div class="box">
		<header>
			<div>
				<h2>Home’s style</h2>
				<p class="who">{who}</p>
			</div>
			<button class="x" aria-label="Close" onclick={() => dialog?.close()}><X size={20} /></button>
		</header>
		<div class="styles" role="radiogroup" aria-label="Style">
			{#each STYLES as s (s.id)}
				{@const d = DRAW[s.id]}
				<button role="radio" aria-checked={s.id === current} onclick={() => pick(s.id)}>
					<span class="draw" aria-hidden="true">
						{#if d.side}<span class="side"
								><span class="lit"></span><span class="soft"></span><span class="dim"></span><span
									class="soft"
								></span></span
							>{/if}
						<span class="cells" style={`grid-template-columns: repeat(${d.cols}, 1fr)`}>
							{#each d.cells as c, i (i)}<span class={c}></span>{/each}
						</span>
					</span>
					<span class="name">{s.name}</span>
					<span class="sub">{s.sub}</span>
				</button>
			{/each}
		</div>
		<p class="note">
			The big numbers show with every style but the list. Sections, rooms and boxes can still be
			moved, hidden and set afterwards.
		</p>
	</div>
</dialog>

<style>
	dialog {
		width: min(560px, calc(100vw - 32px));
		max-height: calc(100vh - 64px);
		padding: 0;
		border: none;
		border-radius: var(--radius);
		background: var(--sheet);
		color: var(--ink);
	}
	dialog::backdrop {
		background: rgb(0 0 0 / 0.35);
	}
	.box {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 16px;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}
	h2 {
		margin: 0;
		font-size: 19px;
	}
	.who,
	.note {
		margin: 2px 0 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
	.x {
		border: none;
		background: none;
		color: var(--ink-muted);
		padding: 4px;
	}
	.styles {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
	}
	.styles button {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 10px;
		border-radius: 16px;
		border: 2px solid var(--card-line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		text-align: left;
	}
	.styles button[aria-checked='true'] {
		border-color: var(--accent);
	}
	.draw {
		display: flex;
		gap: 4px;
		height: 70px;
		padding: 6px;
		margin-bottom: 4px;
		box-sizing: border-box;
		border-radius: 10px;
		background: var(--bg);
	}
	.side {
		width: 32%;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}
	.side span {
		height: 8px;
	}
	.cells {
		flex: 1;
		display: grid;
		grid-auto-rows: 1fr;
		gap: 3px;
	}
	.draw span span,
	.cells span {
		border-radius: 3px;
	}
	.lit {
		background: var(--fill);
	}
	.soft {
		background: color-mix(in srgb, var(--fill) 45%, transparent);
	}
	.dim {
		background: var(--track-off);
	}
	.wide {
		grid-column: span 2;
		grid-row: span 2;
	}
	.name {
		font-size: 14px;
		font-weight: 700;
	}
	.sub {
		font-size: 12px;
		color: var(--ink-muted);
	}
</style>
