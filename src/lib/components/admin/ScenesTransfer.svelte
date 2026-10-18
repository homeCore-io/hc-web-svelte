<!--
	Scenes in and out as JSON (A6): export them all; import a file, choosing
	which to bring — homeCore adds each as a new scene, so one already here by
	name starts unticked. On Data & backups and on Scenes.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { exportScenes, importScenes } from '#lib/systemAdmin.js';

	let { children, onadded }: { children?: Snippet; onadded?: () => void } = $props();

	let note = $state<string | null>(null);
	async function out() {
		const r = await exportScenes();
		if (!r.ok) return void (note = r.error);
		const blob = new Blob([JSON.stringify(r.data, null, '\t')], { type: 'application/json' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `homecore-scenes-${new Date().toISOString().slice(0, 10)}.json`;
		a.click();
	}

	let incoming = $state<{ scene: { name?: string }; take: boolean; here: boolean }[] | null>(null);
	async function choose(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const f = input.files?.[0];
		input.value = '';
		if (!f) return;
		let list: unknown;
		try {
			list = JSON.parse(await f.text());
		} catch {
			return void (note = 'That isn’t a scenes file.');
		}
		if (!Array.isArray(list) || !list.every((x) => x && typeof x === 'object' && 'name' in x))
			return void (note = 'That isn’t a scenes file.');
		const here = await exportScenes();
		const names = new Set(
			here.ok ? (here.data as { name: string }[]).map((x) => x.name.trim().toLowerCase()) : []
		);
		incoming = (list as { name: string }[]).map((scene) => {
			const dup = names.has(String(scene.name).trim().toLowerCase());
			return { scene, take: !dup, here: dup };
		});
		note = null;
	}
	async function bring() {
		if (!incoming) return;
		const r = await importScenes(incoming.filter((x) => x.take).map((x) => x.scene));
		note = r.ok ? `Added ${r.data.imported} scenes.` : r.error;
		if (r.ok) {
			incoming = null;
			onadded?.();
		}
	}
</script>

<div class="acts">
	{@render children?.()}
	<button class="plain" onclick={out}>Export scenes</button>
	<label class="plain file"
		>Import scenes…<input type="file" accept=".json,application/json" onchange={choose} /></label
	>
</div>
{#if incoming}
	<div class="plan">
		<strong>{incoming.length} scenes in the file</strong>
		{#each incoming as x, i (i)}
			<label class="pick"
				><input type="checkbox" bind:checked={x.take} />
				{x.scene.name}{#if x.here}<span class="sub">
						— one by this name is here already</span
					>{/if}</label
			>
		{/each}
	</div>
	<div class="acts">
		<button class="go" onclick={bring} disabled={!incoming.some((x) => x.take)}
			>Add {incoming.filter((x) => x.take).length}</button
		>
		<button class="plain" onclick={() => (incoming = null)}>Cancel</button>
	</div>
{/if}
{#if note}<p class="sub" role="status">{note}</p>{/if}

<style>
	.acts {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.go,
	.plain,
	.acts :global(a.plain) {
		min-height: 40px;
		padding: 0 16px;
		border-radius: 20px;
		display: inline-flex;
		align-items: center;
		font: inherit;
		font-weight: 700;
		text-decoration: none;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
	}
	.go {
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.go:disabled {
		opacity: 0.5;
	}
	.file {
		position: relative;
		cursor: pointer;
	}
	.file input {
		position: absolute;
		width: 1px;
		height: 1px;
		opacity: 0;
	}
	.file:focus-within {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.plan {
		align-self: stretch;
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 12px 14px;
		border-radius: 12px;
		background: var(--surface-2);
	}
	.pick {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 32px;
	}
	.sub {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
</style>
