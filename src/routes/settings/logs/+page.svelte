<!--
	Logs (A6): homeCore's and its plugins' log, live — by how serious, by
	where it came from, searchable; a line opens to say where in the code
	and what else it carried. Pausing holds the page still.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { session } from '#lib/me.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { wide } from '#lib/wide.svelte.js';
	import { LOG_LEVELS, atLeast, detailOf, sourceOf, type LogLine } from '#lib/system.js';
	import { loadLogs } from '#lib/systemAdmin.js';

	$effect(() => heading.show('Logs', { href: '/settings/system', label: 'System' }));

	const KEEP = 2000;
	let lines = $state<LogLine[]>([]);
	let failed = $state<string | null>(null);
	let paused = $state(false);
	let min = $state<string>('info');
	let from = $state('');
	let query = $state('');
	let open = $state<number | null>(null);

	let last: string | undefined;
	async function poll() {
		if (paused) return;
		const r = await loadLogs({ since: last, limit: last ? 1000 : 500 });
		if (!r.ok) return void (failed = r.error);
		failed = null;
		if (!r.data.lines.length) return;
		last = r.data.lines[r.data.lines.length - 1]!.timestamp;
		lines = [...lines, ...r.data.lines].slice(-KEEP);
	}
	onMount(() => {
		void poll();
		const every = setInterval(poll, 2000);
		return () => clearInterval(every);
	});

	const sources = $derived([...new Set(lines.map((l) => sourceOf(l)))].sort());
	const shown = $derived.by(() => {
		const q = query.trim().toLowerCase();
		return lines
			.map((l, i) => ({ l, i, src: sourceOf(l) }))
			.filter(
				({ l, src }) =>
					atLeast(l.level, min) &&
					(!from || src === from) &&
					(!q || `${l.message} ${src} ${l.target}`.toLowerCase().includes(q))
			)
			.reverse()
			.slice(0, 400);
	});
	const at = (ts: string) =>
		new Date(ts).toLocaleTimeString(undefined, {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		});
</script>

{#if !session.isAdmin}
	<p class="quiet">Logs are for the house’s admins.</p>
{:else}
	<div class="page">
		<div class="tools">
			<span class="live" class:paused>{paused ? 'Paused' : failed ? 'Not answering' : 'Live'}</span>
			<div class="chips" role="radiogroup" aria-label="How serious">
				{#each LOG_LEVELS as l (l.id)}
					<button role="radio" aria-checked={min === l.id} onclick={() => (min = l.id)}
						>{l.label}</button
					>
				{/each}
			</div>
			<label class="from"
				>From
				<select bind:value={from}>
					<option value="">everything</option>
					{#each sources as s (s)}<option value={s}>{s}</option>{/each}
				</select>
			</label>
			<input
				type="search"
				placeholder="Search the log"
				aria-label="Search the log"
				bind:value={query}
			/>
			<button class="plain" onclick={() => (paused = !paused)}>{paused ? 'Resume' : 'Pause'}</button
			>
		</div>
		{#if failed}<p class="note bad" role="alert">{failed}</p>{/if}

		{#if shown.length === 0}
			<p class="empty">{lines.length ? 'Nothing matches.' : 'Nothing logged yet.'}</p>
		{:else}
			<ol class="log" class:narrow={!wide.current}>
				{#each shown as { l, i, src } (i)}
					<li>
						<button
							aria-expanded={open === i}
							onclick={() => (open = open === i ? null : i)}
							class:on={open === i}
						>
							<span class="at">{at(l.timestamp)}</span>
							<span class="lvl {l.level.toLowerCase()}">{l.level.toLowerCase()}</span>
							<span class="src">{src}</span>
							<span class="msg">{l.message}</span>
						</button>
						{#if open === i}<div class="detail">{detailOf(l)}</div>{/if}
					</li>
				{/each}
			</ol>
		{/if}
		<p class="quiet">
			homeCore keeps its last few hundred lines here; older ones are in its log files.
		</p>
	</div>
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
	}
	.tools {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
	}
	.live {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-weight: 700;
		color: var(--ink);
	}
	.live::before {
		content: '';
		width: 8px;
		height: 8px;
		border-radius: 4px;
		background: var(--track-on);
	}
	.live.paused::before {
		background: var(--ink-muted);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.chips button {
		height: 32px;
		padding: 0 12px;
		border-radius: 16px;
		border: 1px solid var(--line);
		background: var(--surface);
		font-weight: 600;
		font-size: 13px;
	}
	.chips button[aria-checked='true'] {
		background: var(--ink);
		color: var(--bg);
		border-color: var(--ink);
	}
	.from {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--ink-muted);
		font-size: 13px;
	}
	select,
	input[type='search'] {
		height: 34px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		padding: 0 10px;
	}
	input[type='search'] {
		flex: 1 1 200px;
		border-radius: 17px;
	}
	.plain {
		height: 34px;
		padding: 0 14px;
		border-radius: 17px;
		border: 1px solid var(--line);
		background: var(--surface);
		font-weight: 700;
	}
	.log {
		list-style: none;
		margin: 0;
		padding: 4px 0;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.log li + li {
		border-top: 1px solid var(--line);
	}
	.log button {
		width: 100%;
		display: grid;
		grid-template-columns: max-content 44px 120px minmax(0, 1fr);
		gap: 12px;
		align-items: baseline;
		padding: 6px 16px;
		border: none;
		background: none;
		text-align: left;
	}
	.log button.on {
		background: color-mix(in srgb, var(--lit-bg) 50%, var(--surface));
	}
	.narrow button {
		grid-template-columns: auto auto minmax(0, 1fr);
		gap: 2px 8px;
		padding: 8px 14px;
	}
	.narrow .msg {
		grid-column: 1 / -1;
	}
	.at,
	.lvl {
		white-space: nowrap;
		font-family: var(--font-num);
		font-size: 12.5px;
		color: var(--ink-muted);
	}
	.lvl.warn {
		color: var(--lit-ink);
		font-weight: 600;
	}
	.lvl.error {
		color: var(--alert);
		font-weight: 700;
	}
	.src {
		font-size: 13px;
		color: var(--ink-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.msg {
		overflow-wrap: anywhere;
	}
	.detail {
		padding: 2px 16px 10px;
		font-family: var(--font-num);
		font-size: 12.5px;
		color: var(--ink-muted);
		overflow-wrap: anywhere;
	}
	.empty {
		margin: 0;
		padding: 14px 16px;
		border-radius: var(--radius);
		border: 1px dashed var(--line);
		color: var(--ink-muted);
	}
	.note {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: 10px;
		background: var(--alert-bg);
		font-weight: 600;
	}
	.bad {
		color: var(--alert);
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
	}
</style>
