<!--
	A section of one's own (G17): a name, a layout that suits cards, and where
	it goes. Made in the layer being changed — the household's in Edit, this
	person's in Customise — then Add opens into it.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import X from '@lucide/svelte/icons/x';
	import { newId } from '#lib/layers.js';
	import { CARD_LAYOUTS, type Layout } from '#lib/page.js';
	import { view } from '#lib/view.svelte.js';
	import { adding } from '#lib/adding.svelte.js';

	let {
		page,
		order,
		close
	}: {
		page: string;
		/** The sections it can go after, as shown, in order. */
		order: { ref: string; title: string }[];
		close: () => void;
	} = $props();

	let dialog = $state<HTMLDialogElement>();
	onMount(() => dialog?.showModal());
	let name = $state('');
	let layout = $state<Layout>('grid');
	let after = $state(untrack(() => order.at(-1)?.ref ?? ''));

	const LAYOUTS: Record<string, { name: string; sub: string; cells: number; cols: number }> = {
		grid: { name: 'Grid', sub: 'Cards in rows', cells: 6, cols: 3 },
		row: { name: 'Row', sub: 'Side by side', cells: 4, cols: 4 },
		list: { name: 'List', sub: 'One to a line', cells: 3, cols: 1 }
	};

	function make() {
		const title = name.trim();
		if (!title) return;
		const id = `own-${newId()}`;
		const ref = `section:${id}`;
		view.change(page, { op: 'section', ref, title, layout });
		// After the one chosen: before whatever follows it; at the end it's already there.
		const at = order.findIndex((o) => o.ref === after);
		const next = order[at + 1];
		if (next) view.change(page, { op: 'move', ref, before: next.ref });
		dialog?.close();
		adding.open(page, id);
	}
</script>

<dialog
	bind:this={dialog}
	aria-labelledby="new-section-h"
	onclose={close}
	onclick={(e) => {
		if (e.target === dialog) dialog?.close();
	}}
>
	<form
		class="box"
		onsubmit={(e) => {
			e.preventDefault();
			make();
		}}
	>
		<header>
			<h2 id="new-section-h">New section</h2>
			<button type="button" class="x" aria-label="Close" onclick={() => dialog?.close()}
				><X size={20} /></button
			>
		</header>
		<label class="field"
			>Name
			<!-- svelte-ignore a11y_autofocus -->
			<input bind:value={name} placeholder="Evening" autofocus autocomplete="off" />
		</label>
		<fieldset>
			<legend>Layout</legend>
			<div class="layouts">
				{#each CARD_LAYOUTS as l (l)}
					{@const d = LAYOUTS[l]!}
					<button
						type="button"
						class="layout"
						aria-pressed={layout === l}
						onclick={() => (layout = l)}
					>
						<span class="mini" aria-hidden="true" style:--cols={d.cols}>
							{#each { length: d.cells } as _, i (i)}<span></span>{/each}
						</span>
						<b>{d.name}</b>
						<small>{d.sub}</small>
					</button>
				{/each}
			</div>
		</fieldset>
		{#if order.length > 0}
			<label class="field"
				>Goes after
				<select bind:value={after}>
					{#each order as o (o.ref)}<option value={o.ref}>{o.title}</option>{/each}
				</select>
			</label>
		{/if}
		<p class="who">
			{view.mode(page) === 'edit' ? 'Everyone sees it — unless they hide it.' : 'Only you see it.'}
		</p>
		<button type="submit" class="make" disabled={!name.trim()}>Make the section</button>
	</form>
</dialog>

<style>
	dialog {
		margin: 10vh auto auto;
		padding: 0;
		width: min(460px, calc(100vw - 24px));
		border: none;
		border-radius: var(--radius-sheet);
		background: var(--sheet);
		color: var(--ink);
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	}
	dialog::backdrop {
		background: var(--scrim);
	}
	.box {
		display: flex;
		flex-direction: column;
		gap: 16px;
		padding: 16px 18px 20px;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	h2 {
		margin: 0;
		font-size: 20px;
	}
	.x {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--surface);
		color: var(--ink-muted);
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 13px;
		font-weight: 600;
	}
	input,
	select {
		height: 42px;
		padding: 0 12px;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: 15px;
		font-weight: 400;
	}
	fieldset {
		border: none;
		margin: 0;
		padding: 0;
	}
	legend {
		padding: 0;
		margin-bottom: 8px;
		font-size: 13px;
		font-weight: 600;
	}
	.layouts {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 8px;
	}
	.layout {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		padding: 10px;
		border: 2px solid var(--card-line);
		border-radius: 14px;
		background: var(--surface);
		color: var(--ink);
		text-align: left;
	}
	.layout[aria-pressed='true'] {
		border-color: var(--accent);
	}
	.mini {
		display: grid;
		grid-template-columns: repeat(var(--cols), minmax(0, 1fr));
		grid-auto-rows: 10px;
		gap: 3px;
		width: 100%;
		height: 44px;
		padding: 5px;
		box-sizing: border-box;
		border-radius: 8px;
		background: var(--bg);
		margin-bottom: 4px;
	}
	.mini span {
		border-radius: 3px;
		background: var(--line);
	}
	small {
		color: var(--ink-muted);
		font-size: 12px;
	}
	.who {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
	.make {
		height: 44px;
		border: none;
		border-radius: 999px;
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 700;
	}
	.make:disabled {
		opacity: 0.5;
	}
</style>
