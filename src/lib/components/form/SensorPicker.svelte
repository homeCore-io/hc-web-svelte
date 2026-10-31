<!--
	Choosing a sensor (G-b): any device in the house that reads it — one, or
	an average of several. The room the setting is for comes first; search
	finds a sensor by its name, its room or its plugin. Nothing is kept until
	"Use this".
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import X from '@lucide/svelte/icons/x';
	import Check from '@lucide/svelte/icons/check';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { displayName, type CoreDevice } from '#lib/devices.js';
	import { byRoom } from '#lib/summary.js';
	import { pluginLabel } from '#lib/inventory.js';
	import { degrees, percent, readingOf, reads } from '#lib/roomBox.js';

	let {
		attr,
		label,
		value,
		near,
		onpick,
		close
	}: {
		/** What it reads: `temperature`, `humidity`. */
		attr: string;
		label: string;
		value: string[];
		/** The room this is for: its sensors first. */
		near?: string;
		onpick: (ids: string[]) => void;
		close: () => void;
	} = $props();

	let dialog = $state<HTMLDialogElement>();
	onMount(() => dialog?.showModal());

	// Picked afresh each time it opens, from what was set.
	let mode = $state<'one' | 'average'>(untrack(() => (value.length > 1 ? 'average' : 'one')));
	let chosen = $state<string[]>(untrack(() => [...value]));
	let search = $state('');

	const text = (n: number | undefined) => (attr === 'humidity' ? percent(n) : degrees(n)) ?? '—';
	const groups = $derived.by(() => {
		const grouped = byRoom(devices.byId, rooms.list);
		const q = search.trim().toLowerCase();
		const out: { name: string; items: CoreDevice[] }[] = [];
		const ordered = [
			...rooms.list.filter((r) => r.id === near),
			...[...rooms.list].filter((r) => r.id !== near).sort((a, b) => a.name.localeCompare(b.name))
		];
		for (const [name, list] of [
			...ordered.map(
				(r) => [r.id === near ? `In ${r.name}` : r.name, grouped.get(r.id) ?? []] as const
			),
			['Not in a room', grouped.get('') ?? []] as const
		]) {
			const items = list
				.filter((d) => reads(d, attr))
				.filter(
					(d) =>
						q === '' ||
						`${displayName(d)} ${name} ${pluginLabel(d.plugin_id)}`.toLowerCase().includes(q)
				)
				.sort((a, b) => displayName(a).localeCompare(displayName(b)));
			if (items.length > 0) out.push({ name, items });
		}
		return out;
	});

	function pick(id: string) {
		if (mode === 'one') chosen = [id];
		else chosen = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
	}
	function setMode(m: 'one' | 'average') {
		mode = m;
		if (m === 'one') chosen = chosen.slice(0, 1);
	}
	const result = $derived.by(() => {
		const xs = chosen.flatMap((id) => {
			const d = devices.byId[id];
			return d ? (readingOf(d, attr) ?? []) : [];
		});
		return xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : undefined;
	});
	const summary = $derived(
		chosen.length === 0
			? mode === 'one'
				? 'Choose a sensor'
				: 'Choose at least one'
			: chosen.length === 1
				? displayName(devices.byId[chosen[0]!] ?? ({ name: 'A sensor that’s gone' } as CoreDevice))
				: `Average of ${chosen.length} sensors`
	);
</script>

<dialog
	bind:this={dialog}
	aria-label={label}
	onclose={close}
	onclick={(e) => {
		if (e.target === dialog) dialog?.close();
	}}
>
	<div class="box">
		<header>
			<div>
				<p class="over">{label}</p>
				<h2>Choose a sensor</h2>
			</div>
			<button class="x" aria-label="Close" onclick={() => dialog?.close()}><X size={20} /></button>
		</header>
		<div class="segmented" role="radiogroup" aria-label="How many">
			<button role="radio" aria-checked={mode === 'one'} onclick={() => setMode('one')}
				>One sensor</button
			>
			<button role="radio" aria-checked={mode === 'average'} onclick={() => setMode('average')}
				>Average of several</button
			>
		</div>
		<label class="search"
			>Find a sensor
			<input type="search" bind:value={search} placeholder="Name, room or plugin" />
		</label>
		<div class="groups">
			{#each groups as g (g.name)}
				<div class="group" role={mode === 'one' ? 'radiogroup' : 'group'} aria-label={g.name}>
					<p class="over">{g.name}</p>
					{#each g.items as d (d.device_id)}
						{@const on = chosen.includes(d.device_id)}
						<button
							class="item"
							class:on
							role={mode === 'one' ? 'radio' : 'checkbox'}
							aria-checked={on}
							onclick={() => pick(d.device_id)}
						>
							<span class="mark" class:square={mode === 'average'} aria-hidden="true"
								>{#if on && mode === 'average'}<Check size={12} strokeWidth={3} />{/if}</span
							>
							<span class="what">
								<span class="name">{displayName(d)}</span>
								<span class="sub">{pluginLabel(d.plugin_id)}</span>
							</span>
							<span class="mono">{text(readingOf(d, attr))}</span>
						</button>
					{/each}
				</div>
			{:else}
				<p class="sub">Nothing in the house reads that{search ? ' by that name' : ''}.</p>
			{/each}
		</div>
		<div class="result" aria-live="polite">
			<span><span class="sub">It will show</span><strong>{summary}</strong></span>
			<span class="mono big">{chosen.length > 0 ? text(result) : ''}</span>
		</div>
		<button
			class="use"
			disabled={chosen.length === 0}
			onclick={() => {
				onpick(chosen);
				dialog?.close();
			}}>Use this</button
		>
	</div>
</dialog>

<style>
	dialog {
		width: min(480px, calc(100vw - 32px));
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
		gap: 12px;
		padding: 16px;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
	}
	h2 {
		margin: 0;
		font-size: 17px;
	}
	.over {
		margin: 0;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.x {
		border: none;
		background: none;
		color: var(--ink-muted);
		padding: 4px;
	}
	.segmented {
		display: flex;
		gap: 2px;
		padding: 3px;
		border-radius: 12px;
		background: var(--surface-2);
	}
	.segmented button {
		flex: 1;
		height: 34px;
		border: none;
		border-radius: 9px;
		background: transparent;
		color: var(--ink-muted);
		font: inherit;
		font-weight: 600;
	}
	.segmented button[aria-checked='true'] {
		background: var(--surface);
		color: var(--ink);
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.12);
	}
	.search {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 13px;
		font-weight: 600;
	}
	.search input {
		height: 40px;
		padding: 0 12px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 400;
	}
	.groups {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.group {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.item {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 46px;
		padding: 6px 12px;
		border-radius: 12px;
		border: 1px solid transparent;
		background: transparent;
		color: var(--ink);
		font: inherit;
		text-align: left;
	}
	.item.on {
		background: var(--surface);
		border-color: var(--accent);
	}
	.mark {
		width: 16px;
		height: 16px;
		flex: none;
		box-sizing: border-box;
		border-radius: 50%;
		border: 2px solid var(--line);
		background: var(--surface);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--accent-ink);
	}
	.mark.square {
		border-radius: 4px;
	}
	.on .mark {
		border: 5px solid var(--accent);
	}
	.on .mark.square {
		border: none;
		background: var(--accent);
	}
	.what {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.name {
		font-size: 14px;
		font-weight: 600;
	}
	.sub {
		font-size: 12px;
		color: var(--ink-muted);
	}
	.mono {
		font-family: var(--font-num);
		font-size: 14px;
	}
	.result {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 10px;
		padding: 12px 14px;
		border-radius: 12px;
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.result > span:first-child {
		display: flex;
		flex-direction: column;
	}
	.big {
		font-size: 26px;
	}
	.use {
		height: 42px;
		border-radius: 21px;
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
		font: inherit;
		font-weight: 700;
	}
	.use:disabled {
		opacity: 0.5;
	}
</style>
