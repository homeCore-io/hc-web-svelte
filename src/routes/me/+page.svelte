<script lang="ts">
	import { goto } from '$app/navigation';
	import { session } from '#lib/me.svelte.js';
	import { theme, type ThemeChoice } from '#lib/theme.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { BAR_CHOICES, BAR_SIZE, DEFAULT_BAR, barOf, nudgeFavourite } from '#lib/layers.js';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import X from '@lucide/svelte/icons/x';

	// ---- the phone bar (N2) ----
	const NAMES: Record<string, string> = {
		home: 'Home',
		pages: 'Pages',
		scenes: 'Scenes',
		alerts: 'Alerts',
		search: 'Search'
	};
	const bar = $derived(
		barOf(
			personal.doc,
			rooms.list.map((r) => r.id)
		)
	);
	const nameOf = (d: string) =>
		d.startsWith('room:')
			? (rooms.list.find((r) => `room:${r.id}` === d)?.name ?? 'Room')
			: NAMES[d]!;
	const addable = $derived([
		...BAR_CHOICES.filter((d) => !bar.includes(d)),
		...rooms.list.map((r) => `room:${r.id}`).filter((d) => !bar.includes(d))
	]);
	const setBar = (next: string[]) => personal.change((d) => ({ ...d, bar: next }));

	const choices: { value: ThemeChoice; label: string }[] = [
		{ value: 'system', label: 'Like this device' },
		{ value: 'light', label: 'Light' },
		{ value: 'dark', label: 'Dark' }
	];

	async function signOut() {
		await session.signOut();
		void goto('/login');
	}
</script>

<div class="stack">
	<section>
		<p class="who">{session.me?.username}</p>
		<p class="role">{session.me?.role}</p>
	</section>

	<section>
		<h2 class="section-label" id="appearance">Appearance</h2>
		<div class="segmented" role="radiogroup" aria-labelledby="appearance">
			{#each choices as c (c.value)}
				<button
					role="radio"
					aria-checked={theme.choice === c.value}
					onclick={() => theme.set(c.value)}>{c.label}</button
				>
			{/each}
		</div>
	</section>

	<section>
		<h2 class="section-label" id="bar">Phone bar</h2>
		<p class="note">Up to {BAR_SIZE} places at the bottom of your phone, then More. Only yours.</p>
		<ol class="bar" aria-labelledby="bar">
			{#each bar as d, i (d)}
				<li>
					<span>{nameOf(d)}</span>
					<button
						aria-label={`Move ${nameOf(d)} left`}
						disabled={i === 0}
						onclick={() => setBar(nudgeFavourite(bar, d, -1))}><ArrowUp size={16} /></button
					>
					<button
						aria-label={`Move ${nameOf(d)} right`}
						disabled={i === bar.length - 1}
						onclick={() => setBar(nudgeFavourite(bar, d, 1))}><ArrowDown size={16} /></button
					>
					<button
						aria-label={`Take ${nameOf(d)} off the bar`}
						disabled={bar.length === 1}
						onclick={() => setBar(bar.filter((x) => x !== d))}><X size={16} /></button
					>
				</li>
			{/each}
			<li class="more"><span>More</span></li>
		</ol>
		{#if bar.length < BAR_SIZE}
			<label class="add">
				<span>Add</span>
				<select
					value=""
					onchange={(e) => {
						const v = e.currentTarget.value;
						if (v) void setBar([...bar, v]);
						e.currentTarget.value = '';
					}}
				>
					<option value="" disabled>Choose a place…</option>
					{#each addable as d (d)}<option value={d}>{nameOf(d)}</option>{/each}
				</select>
			</label>
		{/if}
		{#if personal.doc.bar !== undefined}
			<button class="link" onclick={() => setBar(DEFAULT_BAR)}>Back to the usual bar</button>
		{/if}
	</section>

	<button class="out" onclick={signOut}>Sign out</button>
</div>

<style>
	.stack {
		max-width: 520px;
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		margin-top: var(--space-2);
	}
	section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.note {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
	.bar {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.bar li {
		display: flex;
		align-items: center;
		gap: 4px;
		min-height: var(--target);
		padding: 0 6px 0 12px;
		border-radius: 12px;
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.bar li span {
		flex: 1;
		font-weight: 600;
	}
	.bar li button {
		width: 36px;
		height: 36px;
		border: none;
		background: none;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.bar li button:disabled {
		opacity: 0.3;
	}
	.bar .more {
		color: var(--ink-muted);
		background: none;
		border-style: dashed;
	}
	.add {
		display: flex;
		align-items: center;
		gap: 10px;
		font-size: 14px;
	}
	.add select {
		flex: 1;
		min-height: var(--target);
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		padding: 0 10px;
	}
	.link {
		align-self: flex-start;
		border: none;
		background: none;
		color: var(--accent);
		font-weight: 600;
		padding: 0;
		min-height: var(--target);
	}
	.who {
		margin: 0;
		font-size: 19px;
		font-weight: 700;
	}
	.role {
		margin: 0;
		color: var(--ink-muted);
		text-transform: capitalize;
	}
	.segmented {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 4px;
		padding: 4px;
		border-radius: 26px;
		background: var(--surface-2);
	}
	.segmented button {
		height: 40px;
		border: none;
		border-radius: 20px;
		background: none;
		font-weight: 600;
		color: var(--ink-muted);
	}
	.segmented button[aria-checked='true'] {
		background: var(--surface);
		color: var(--ink);
		box-shadow: var(--shadow);
	}
	.out {
		align-self: flex-start;
		height: var(--target);
		padding: 0 var(--space-5);
		border-radius: 22px;
		border: 1px solid var(--line);
		background: var(--surface);
		font-weight: 600;
	}
</style>
