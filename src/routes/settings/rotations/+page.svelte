<!--
	Rotations: shared lists of presets, playlists and favorites that rules play
	one at a time, so what plays changes on its own. Each shows what plays now
	and next, and any choice its device no longer offers; Play and Skip try it.
-->
<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import Play from '@lucide/svelte/icons/play';
	import SkipForward from '@lucide/svelte/icons/skip-forward';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import { rotations } from '#lib/rotations.svelte.js';
	import { summary } from '#lib/rotations.js';
	import { devices } from '#lib/devices.svelte.js';
	import { displayName } from '#lib/devices.js';
	import { session } from '#lib/me.svelte.js';
	import { heading } from '#lib/heading.svelte.js';

	$effect(() => heading.show('Rotations', { href: '/settings', label: 'Settings' }));
	$effect(() => {
		if (session.can('automations:read')) void rotations.load();
	});

	const mayEdit = $derived(session.can('automations:write'));
	const mayPlay = $derived(session.mayUse);

	let note = $state<string | null>(null);
	let busy = $state<string | null>(null);

	const deviceName = (id: string) => {
		const d = devices.byId[id];
		return d ? displayName(d) : id;
	};

	async function play(id: string) {
		busy = id;
		const r = await rotations.play(id);
		busy = null;
		note =
			typeof r === 'string'
				? r
				: `Playing ${r.played}.${r.missing.length ? ' Skipped what its device no longer has.' : ''}`;
	}
	async function skip(id: string) {
		busy = id;
		const r = await rotations.advance(id);
		busy = null;
		note = typeof r === 'string' ? r : `Next time it plays ${r.current_name}.`;
	}
</script>

{#if !session.can('automations:read')}
	<p class="quiet">Rotations are for those who may see automations.</p>
{:else}
	<div class="page">
		<div class="top">
			<p class="lead">
				Presets, playlists and favorites a rule plays one at a time: a new one each time, each hour,
				each day, or on a schedule of its own.
			</p>
			{#if mayEdit}
				<a class="new" href="/settings/rotations/new"
					><Plus size={16} aria-hidden="true" />New rotation</a
				>
			{/if}
		</div>

		{#if note}<p class="note" role="status">{note}</p>{/if}

		{#if !rotations.loaded}
			<p class="quiet">Loading rotations…</p>
		{:else if rotations.failed}
			<p class="quiet">{rotations.failed}</p>
		{:else if rotations.list.length === 0}
			<p class="empty">
				No rotations yet. Make one for a WLED's presets or a speaker's playlists and favorites, then
				have a rule play from it — at sunset, when someone walks in — with the step
				<b>Play from a rotation</b>.
			</p>
		{:else}
			<ul class="list">
				{#each rotations.list as r (r.id)}
					{@const now = r.now}
					<li>
						<a href={`/settings/rotations/${r.id}`} class="open">
							<span class="text">
								<span class="nm">{r.name}</span>
								<span class="sub">{deviceName(r.device_id)} · {summary(r)}</span>
								{#if now?.current_name || now?.next_name}
									<span class="sub">
										{#if now?.current_name}Now <b>{now.current_name}</b>{/if}
										{#if now?.current_name && now?.next_name}<span aria-hidden="true">·</span>{/if}
										{#if now?.next_name}Next {now.next_name}{/if}
									</span>
								{/if}
								{#if now?.missing_names.length}
									<span class="warn"
										><CircleAlert size={14} aria-hidden="true" />
										{now.missing_names.join(', ')}
										{now.missing_names.length === 1 ? 'is' : 'are'} gone from the device; skipped</span
									>
								{/if}
							</span>
							<ChevronRight size={18} aria-hidden="true" />
						</a>
						{#if mayPlay}
							<button
								type="button"
								class="icon"
								aria-label={`Play ${r.name} now`}
								title="Play now"
								disabled={busy === r.id}
								onclick={() => play(r.id)}><Play size={18} /></button
							>
							<button
								type="button"
								class="icon"
								aria-label={`Skip to the next in ${r.name}`}
								title="Skip to the next"
								disabled={busy === r.id}
								onclick={() => skip(r.id)}><SkipForward size={18} /></button
							>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		max-width: 860px;
	}
	.top {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: var(--space-2) var(--space-3);
	}
	.lead {
		margin: 0;
		flex: 1 1 320px;
		color: var(--ink-muted);
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
	.note {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: 10px;
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-weight: 600;
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
	}
	.empty {
		margin: 0;
		padding: var(--space-4);
		border-radius: var(--radius);
		border: 1px dashed var(--line);
		color: var(--ink-muted);
		line-height: 1.5;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		overflow: hidden;
	}
	.list li {
		display: flex;
		align-items: center;
		gap: 4px;
		padding-right: var(--space-2);
	}
	.list li + li {
		border-top: 1px solid var(--line);
	}
	.open {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 64px;
		padding: 8px var(--space-2) 8px var(--space-4);
		color: var(--ink);
		text-decoration: none;
	}
	.open :global(svg) {
		flex: none;
		color: var(--ink-muted);
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}
	.nm {
		font-weight: 600;
	}
	.sub {
		color: var(--ink-muted);
		font-size: 13px;
	}
	.sub b {
		color: var(--ink);
		font-weight: 600;
	}
	.warn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--alert);
		font-size: 13px;
	}
	.icon {
		flex: none;
		display: grid;
		place-items: center;
		width: 44px;
		height: 44px;
		border-radius: 22px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
	}
	.icon:disabled {
		opacity: 0.5;
	}
</style>
