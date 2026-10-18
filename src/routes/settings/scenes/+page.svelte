<!--
	Scenes (A1): homeCore's own scenes — a set of devices and what to set each
	to, run from Scenes or by rules. Plugins' scenes (a Hue or Lutron scene)
	live in their own apps and are only run from here.
-->
<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import ScenesTransfer from '#lib/components/admin/ScenesTransfer.svelte';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { scenes } from '#lib/scenes.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { pluginLabel } from '#lib/inventory.js';

	const pluginScenes = $derived(
		Object.values(devices.byId).filter((d) => d.device_type === 'scene')
	);
	const byPlugin = $derived(
		[...new Set(pluginScenes.map((d) => pluginLabel(d.plugin_id)))].sort().join(', ')
	);
</script>

{#if !session.can('scenes:write')}
	<p class="quiet">Scenes are for people who may change the house.</p>
{:else}
	<div class="page">
		<a class="new" href="/settings/scenes/new"><Plus size={16} aria-hidden="true" />New scene</a>
		{#if scenes.list.length === 0}
			<p class="empty">
				homeCore has no scenes of its own yet. A scene sets several devices at once — Movie night,
				Bedtime — and can be run from Scenes or by a rule.
			</p>
		{:else}
			<ul>
				{#each scenes.list as s (s.id)}
					{@const n = Object.keys(s.states ?? {}).length}
					<li>
						<a href={`/settings/scenes/${encodeURIComponent(s.id)}`}>
							<span class="text">
								<span class="name">{s.name}</span>
								<span class="sub">{n === 1 ? 'One device' : `${n} devices`}</span>
							</span>
							<ChevronRight size={18} aria-hidden="true" />
						</a>
					</li>
				{/each}
			</ul>
		{/if}
		{#if pluginScenes.length > 0}
			<p class="quiet">
				{pluginScenes.length} more scenes come from plugins ({byPlugin}). They run from Scenes, and
				are changed in their own apps.
			</p>
		{/if}
		<ScenesTransfer onadded={() => void scenes.load()} />
	</div>
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-3);
		max-width: 720px;
	}
	.new {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 40px;
		padding: 0 16px;
		border-radius: 20px;
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 700;
		text-decoration: none;
	}
	ul {
		align-self: stretch;
		list-style: none;
		margin: 0;
		padding: 0;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		overflow: hidden;
	}
	li + li {
		border-top: 1px solid var(--line);
	}
	ul a {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 58px;
		padding: 6px var(--space-3) 6px var(--space-4);
		color: var(--ink);
		text-decoration: none;
	}
	ul a :global(svg) {
		color: var(--ink-muted);
	}
	.text {
		display: flex;
		flex-direction: column;
		flex: 1;
	}
	.name {
		font-weight: 600;
	}
	.sub,
	.quiet {
		color: var(--ink-muted);
		font-size: 13px;
	}
	.quiet {
		margin: 0;
	}
	.empty {
		margin: 0;
		padding: var(--space-4);
		border-radius: var(--radius);
		border: 1px dashed var(--line);
		color: var(--ink-muted);
		line-height: 1.5;
	}
</style>
