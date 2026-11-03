<!--
	Settings › Extensions (13 U9): the UI extensions installed, where each came
	from (the Catalog, a file, or by hand), and the drawings plugins bring, which
	come and go with their plugin. Removing one draws what used its drawings
	as Classic does (U5). New ones come from the Catalog.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { session } from '#lib/me.svelte.js';
	import { extensions, fileUrl } from '#lib/extensions.svelte.js';
	import ExtensionPreview from '#lib/components/ExtensionPreview.svelte';
	import { pluginUis } from '#lib/pluginUi/uis.svelte.js';
	import { isRiveSlot } from '#lib/rive/source.js';

	const mayChange = $derived(session.isAdmin || session.can('plugins:write'));
	onMount(() => {
		pluginUis.ensure();
		void extensions.load();
	});

	const FAMILY: Record<string, string> = {
		climate: 'Thermostats',
		lights: 'Lights',
		switches: 'Switches',
		scenes: 'Scenes',
		doors: 'Doors and locks',
		readings: 'Readings',
		watching: 'Watching',
		media: 'Players'
	};
	const draws = (fams: string[]) => [...new Set(fams.map((f) => FAMILY[f] ?? f))].join(', ');
	const FROM = { catalog: 'From the Catalog', file: 'From a file' } as const;

	const fromPlugins = $derived(
		pluginUis
			.looks('look.drawing')
			.filter(isRiveSlot)
			.map((s) => ({
				id: s.id,
				name: s.slot.label ?? s.slot.element,
				plugin: s.pluginId.replace(/^plugin\./, ''),
				draws: draws(s.slot.draws ?? [])
			}))
	);

	let busy = $state<string | null>(null);
	let note = $state<string | null>(null);
	async function drop(id: string, name: string) {
		busy = id;
		note = null;
		const r = await fetch(`/ui/extensions/${encodeURIComponent(id)}`, { method: 'DELETE' });
		busy = null;
		if (!r.ok) {
			note =
				((await r.json().catch(() => ({}))) as { error?: string }).error ??
				'It couldn’t be removed.';
			return;
		}
		note = `${name} removed. Looks that used it draw those things as Classic does.`;
		await extensions.load();
	}
</script>

<div class="page">
	<div class="tools">
		<span class="sum">
			Drawings and cards the looks can choose. They never command anything; a look picks them in its
			Drawings.
		</span>
		{#if mayChange}<a class="go" href="/settings/plugins/add?kind=extensions">Catalog</a>{/if}
	</div>

	{#if note}<p class="note" role="status">{note}</p>{/if}

	<section>
		<h2>Installed</h2>
		{#if !extensions.loaded}
			<p class="quiet">Loading…</p>
		{:else if extensions.list.length === 0}
			<p class="quiet">
				None yet. The Catalog has some; an admin can also add one from a file there.
			</p>
		{:else}
			<ul class="list">
				{#each extensions.list as x (x.id)}
					<li>
						{#if x.preview}
							<ExtensionPreview src={fileUrl(x, x.preview)} name={x.preview} label={x.name} small />
						{/if}
						<span class="text">
							<strong>{x.name}</strong>
							<span class="sub"
								>{draws(x.elements.map((e) => e.draws))} · {x.version} · {x.installed
									? FROM[x.installed.from]
									: 'Copied in by hand'}</span
							>
						</span>
						{#if mayChange}
							<button
								type="button"
								class="plain"
								disabled={busy === x.id}
								onclick={() => drop(x.id, x.name)}>{busy === x.id ? 'Removing…' : 'Remove'}</button
							>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	<section>
		<h2>Brought by plugins</h2>
		{#if fromPlugins.length === 0}
			<p class="quiet">None of the plugins brings one.</p>
		{:else}
			<ul class="list">
				{#each fromPlugins as p (p.id)}
					<li>
						<span class="text">
							<strong>{p.name}</strong>
							<span class="sub">{p.draws} · with {p.plugin}</span>
						</span>
					</li>
				{/each}
			</ul>
			<p class="quiet">These come and go with their plugin, and update with it.</p>
		{/if}
	</section>
</div>

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
	}
	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
	}
	.sum {
		flex: 1;
		min-width: 0;
		color: var(--ink-muted);
	}
	h2 {
		margin: 0 0 var(--space-2);
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--ink-muted);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.list li {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: 10px var(--space-4);
	}
	.list li + li {
		border-top: 1px solid var(--line);
	}
	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.sub {
		color: var(--ink-muted);
		font-size: 13px;
	}
	.plain,
	.go {
		height: 36px;
		padding: 0 14px;
		border-radius: 18px;
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 700;
		font-size: 13px;
		text-decoration: none;
		cursor: pointer;
	}
	.go {
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.quiet {
		color: var(--ink-muted);
		margin: 0;
	}
	.note {
		margin: 0;
	}
</style>
