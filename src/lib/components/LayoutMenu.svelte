<!--
	A room's Layout menu, while arranging (14 §8, L3): back to the look's
	layout, this room's layout copied to others, or this room started from
	another's. Rooms hold different things, so a copy takes the headings,
	widgets and stacks (layoutCopy.ts); each room's devices fill in under them.
	In Edit it changes the household's rooms; in Customise, this person's own.
-->
<script lang="ts">
	import { editing } from '#lib/edit.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { layoutOf, withLayout, withoutPlaces } from '#lib/layoutCopy.js';
	import type { Change } from '#lib/layers.js';

	let {
		page,
		edit,
		rooms,
		said
	}: {
		page: string;
		/** Edit: the household's; else this person's. */
		edit: boolean;
		/** The other rooms, as `room:<id>` and their names. */
		rooms: { key: string; name: string }[];
		/** What just happened, to read out. */
		said: (words: string) => void;
	} = $props();

	let open = $state(false);
	let doing = $state<'copy' | 'from' | null>(null);
	let picked = $state<Record<string, boolean>>({});

	const changesOf = (key: string) => (edit ? editing.changes(key) : personal.changes(key));
	const editPage = (key: string, fn: (c: Change[]) => Change[]) =>
		edit ? editing.editPage(key, fn) : void personal.editPage(key, fn);

	function close() {
		open = false;
		doing = null;
		picked = {};
	}
	function back() {
		editPage(page, withoutPlaces);
		said('Back to the look’s layout.');
		close();
	}
	function copy() {
		const layout = layoutOf(changesOf(page));
		const to = rooms.filter((r) => picked[r.key]);
		for (const r of to) editPage(r.key, (c) => withLayout(c, layout));
		said(
			to.length === 1
				? `${to[0]!.name} starts from this layout now.`
				: `${to.length} rooms start from this layout now.`
		);
		close();
	}
	function startFrom(r: { key: string; name: string }) {
		const layout = layoutOf(changesOf(r.key));
		editPage(page, (c) => withLayout(c, layout));
		said(`This room starts from ${r.name}’s layout now.`);
		close();
	}
	const count = $derived(rooms.filter((r) => picked[r.key]).length);
</script>

<div class="layout-menu">
	<button
		class="new-section"
		aria-expanded={open}
		aria-haspopup="true"
		onclick={() => (open ? close() : (open = true))}>Layout</button
	>
	{#if open}
		<div class="menu" role="group" aria-label="This room’s layout">
			<button class="item" onclick={back}>
				<b>Back to the look’s layout</b>
				<span>Where you placed things here goes; names, sizes and hidden things stay.</span>
			</button>
			<button
				class="item"
				aria-pressed={doing === 'copy'}
				onclick={() => (doing = doing === 'copy' ? null : 'copy')}
			>
				<b>Copy this layout to other rooms…</b>
				<span
					>Its headings, widgets and stacks go to the same places there; each room’s own things fill
					in under them.</span
				>
			</button>
			<button
				class="item"
				aria-pressed={doing === 'from'}
				onclick={() => (doing = doing === 'from' ? null : 'from')}
			>
				<b>Start from another room’s layout…</b>
				<span>The same the other way: this room takes the one you pick.</span>
			</button>
			{#if doing === 'copy'}
				<fieldset>
					<legend>Copy to</legend>
					{#each rooms as r (r.key)}
						<label
							><input
								type="checkbox"
								checked={!!picked[r.key]}
								onchange={(e) => (picked = { ...picked, [r.key]: e.currentTarget.checked })}
							/>{r.name}</label
						>
					{/each}
					<button class="go" disabled={count === 0} onclick={copy}
						>Copy to {count === 1 ? '1 room' : `${count} rooms`}</button
					>
				</fieldset>
			{:else if doing === 'from'}
				<fieldset>
					<legend>Start from</legend>
					{#each rooms as r (r.key)}
						<button class="room" onclick={() => startFrom(r)}>{r.name}</button>
					{/each}
				</fieldset>
			{/if}
		</div>
	{/if}
</div>

<style>
	.layout-menu {
		position: relative;
	}
	.new-section {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 44px;
		padding: 0 16px;
		border: 1px dashed var(--accent);
		border-radius: 999px;
		background: none;
		color: var(--accent);
		font-weight: 700;
	}
	.menu {
		position: absolute;
		left: 0;
		bottom: 52px;
		z-index: 20;
		width: min(360px, calc(100vw - 32px));
		max-height: 60vh;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px;
		border: 1px solid var(--line);
		border-radius: 14px;
		background: var(--sheet);
		box-shadow: 0 16px 40px rgba(0, 0, 0, 0.35);
	}
	.item {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 10px 12px;
		border: none;
		border-radius: 10px;
		background: none;
		color: var(--ink);
		text-align: left;
	}
	.item:hover,
	.item[aria-pressed='true'] {
		background: color-mix(in srgb, var(--accent) 10%, transparent);
	}
	.item span {
		color: var(--ink-muted);
		font-size: 12.5px;
	}
	fieldset {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin: 4px 0 0;
		padding: 10px 12px;
		border: none;
		border-top: 1px solid var(--line);
	}
	legend {
		padding: 0;
		font-size: 12px;
		font-weight: 700;
		color: var(--ink-muted);
	}
	label {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 32px;
	}
	.go {
		margin-top: 4px;
		height: 40px;
		border: none;
		border-radius: 999px;
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 700;
	}
	.go:disabled {
		opacity: 0.5;
	}
	.room {
		height: 36px;
		padding: 0 12px;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: var(--surface);
		color: var(--ink);
		text-align: left;
	}
</style>
