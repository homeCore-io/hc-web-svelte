<!--
	Home's scenes row (homeScenes.ts): the scenes the house chose, or the ones
	the person chose for themselves, in their order. One tap runs one. A scene
	that can tell lights up while it's active, like a keypad's LED, and says
	so under its name; the others say their room, or who provides them.

	On the desktop it sits in Home's strip after Every light off; on the phone,
	under it, two across. Edit opens the row's editor, loaded only then. With
	no scenes chosen there is no row, only a small way to add some (`add`).
-->
<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Plus from '@lucide/svelte/icons/plus';
	import type { Component } from 'svelte';
	import Icon from '#lib/components/Icon.svelte';
	import type { HomeScene } from '#lib/homeScenes.js';
	import type { HomeNow } from './homeNow.svelte.js';

	let {
		h,
		phone = false,
		add = false
	}: {
		h: HomeNow;
		/** The phone's: a block of its own, two across. */
		phone?: boolean;
		/** Only the way to add scenes, and only while there are none. */
		add?: boolean;
	} = $props();

	const row = $derived(h.sceneRow);

	// A run says so for a moment, since most scenes report nothing back.
	let running = $state<Record<string, 'running' | 'done'>>({});
	async function run(s: HomeScene) {
		if (running[s.ref] === 'running') return;
		running = { ...running, [s.ref]: 'running' };
		await h.runHomeScene(s);
		running = { ...running, [s.ref]: 'done' };
		setTimeout(() => {
			const { [s.ref]: _, ...rest } = running;
			running = rest;
		}, 1600);
	}

	let Editor = $state<Component<{ onclose: () => void }> | null>(null);
	let editing = $state(false);
	function edit() {
		editing = true;
		if (!Editor) void import('./HomeScenesEdit.svelte').then((m) => (Editor = m.default));
	}
</script>

{#if add}
	{#if row.length === 0}
		<button type="button" class="addsc" onclick={edit}
			><Plus size={14} strokeWidth={2.4} aria-hidden="true" />Scenes</button
		>
	{/if}
{:else if row.length > 0}
	<div class="hsc" class:phone role="group" aria-labelledby="hsc-label">
		<div class="lbl">
			<span id="hsc-label">Scenes</span>
			<button type="button" class="edit" onclick={edit}>Edit</button>
		</div>
		<div class="btns">
			{#each row as s (s.ref)}
				{@const st = running[s.ref]}
				<button
					type="button"
					class="sc"
					class:lit={s.active}
					disabled={!h.mayRun}
					aria-busy={st === 'running' || undefined}
					title={h.mayRun ? s.name : `${s.name}: you may look, not run scenes`}
					onclick={() => run(s)}
				>
					<span class="fi"
						>{#if st === 'done'}<Check size={16} aria-hidden="true" />{:else}<Icon
								name="scene"
								size={16}
							/>{/if}</span
					>
					<span class="ft"
						>{s.name}<small>{st === 'running' ? 'Running…' : st === 'done' ? 'Sent' : s.sub}</small
						></span
					>
				</button>
			{/each}
		</div>
	</div>
{/if}
{#if editing && Editor}<Editor onclose={() => (editing = false)} />{/if}

<style>
	.hsc {
		flex: none;
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.lbl {
		flex: none;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 2px;
		padding-left: 6px;
		font-size: 10.5px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.edit,
	.addsc {
		border: 0;
		background: none;
		padding: 0;
		color: var(--accent);
		font: inherit;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0;
		text-transform: none;
		text-align: left;
		cursor: pointer;
	}
	.addsc {
		flex: none;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 36px;
		padding: 0 12px;
		border-radius: 12px;
		box-shadow: inset 0 0 0 1.5px color-mix(in srgb, var(--ink) 14%, transparent);
		color: var(--ink-muted);
	}
	.btns {
		display: contents;
	}
	/* Where Home's row wraps (a mouse or trackpad), each scene wraps on its own. */
	@media (pointer: fine) {
		.hsc:not(.phone) {
			display: contents;
		}
	}
	.sc {
		flex: none;
		display: flex;
		align-items: center;
		gap: 10px;
		height: 48px;
		padding: 0 14px 0 8px;
		border: 0;
		border-radius: 14px;
		background: color-mix(in srgb, var(--ink) 6%, transparent);
		color: var(--ink);
		font-size: 12.5px;
		font-weight: 600;
		text-align: left;
		cursor: pointer;
	}
	.sc:hover:not(:disabled) {
		background: color-mix(in srgb, var(--ink) 10%, transparent);
	}
	.sc:disabled {
		cursor: default;
		opacity: 0.7;
	}
	.fi {
		flex: none;
		width: 32px;
		height: 32px;
		border-radius: 10px;
		display: grid;
		place-items: center;
		background: color-mix(in srgb, var(--ink) 8%, transparent);
	}
	.ft {
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.ft small {
		max-width: 160px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 11px;
		font-weight: 500;
		color: var(--ink-muted);
	}
	/* Active, like a keypad's LED: lit edge and glow, the symbol lit. */
	.sc.lit {
		background: color-mix(in srgb, var(--track-on) 12%, transparent);
		box-shadow:
			inset 0 0 0 1px color-mix(in srgb, var(--track-on) 60%, transparent),
			0 10px 24px -14px var(--track-on);
	}
	.sc.lit .fi {
		background: var(--track-on);
		color: #2a1704;
		box-shadow: 0 0 10px color-mix(in srgb, var(--track-on) 70%, transparent);
	}
	.sc.lit small {
		color: color-mix(in srgb, var(--track-on) 70%, var(--ink));
		font-weight: 600;
	}

	/* ---- the phone's: under the strip, two across ---- */
	.hsc.phone {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 8px;
		padding: 14px 16px 0;
	}
	.phone .lbl {
		flex-direction: row;
		align-items: baseline;
		justify-content: space-between;
		padding: 0;
		font-size: 11px;
	}
	.phone .edit {
		font-size: 13px;
		min-height: 32px;
		padding: 0 4px;
	}
	.phone .btns {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
	}
	.phone .sc {
		height: auto;
		min-height: 60px;
		padding: 8px 12px;
		border-radius: 16px;
		background: color-mix(in srgb, var(--ink) 5%, transparent);
		font-size: 13px;
		min-width: 0;
	}
	.phone .sc.lit {
		background: color-mix(in srgb, var(--track-on) 12%, transparent);
	}
	.phone .ft small {
		max-width: none;
	}
	.phone .ft {
		overflow: hidden;
	}
</style>
