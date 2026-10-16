<!--
	Asking first (D2): whether a command asks "are you sure?" before it goes.
	By default the device decides — it asks where it declared a prompt, and
	unlocking doesn't ask (C4). An admin can say always or never for a kind of
	device, and for one device, which wins over its kind.
-->
<script lang="ts">
	import X from '@lucide/svelte/icons/x';
	import { devices } from '#lib/devices.svelte.js';
	import { displayName, type CoreDevice } from '#lib/devices.js';
	import { kindOf } from '#lib/card.js';
	import { household } from '#lib/household.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { withAsk, type Ask } from '#lib/layers.js';

	const all = $derived(Object.values(devices.byId));
	const commandable = (d: CoreDevice) =>
		(d.schema?.actions?.length ?? 0) > 0 ||
		Object.values(d.schema?.attributes ?? {}).some((a) => a.writable);
	const kinds = $derived.by(() => {
		const n = new Map<string, number>();
		// Only kinds something can be asked of: sensors take no commands.
		for (const d of all.filter(commandable)) n.set(kindOf(d), (n.get(kindOf(d)) ?? 0) + 1);
		return [...n.entries()].sort((a, b) => a[0].localeCompare(b[0]));
	});
	const byKind = $derived(household.doc.confirm?.kinds ?? {});
	const byDevice = $derived(household.doc.confirm?.devices ?? {});
	const overridden = $derived(
		Object.keys(byDevice)
			.map((id) => devices.byId[id])
			.filter((d) => d !== undefined)
			.sort((a, b) => displayName(a).localeCompare(displayName(b)))
	);
	const addable = $derived(
		all
			.filter((d) => commandable(d) && !(d.device_id in byDevice))
			.sort((a, b) => displayName(a).localeCompare(displayName(b)))
	);

	const set = (by: 'devices' | 'kinds', key: string, ask: Ask | undefined) =>
		household.change((d) => withAsk(d, by, key, ask));

	const label = (k: string) => k.replace(/_/g, ' ');
	const CHOICES: { value: Ask | undefined; label: string }[] = [
		{ value: undefined, label: 'Device decides' },
		{ value: 'always', label: 'Always ask' },
		{ value: 'never', label: 'Never ask' }
	];
</script>

{#snippet choice(
	current: Ask | undefined,
	name: string,
	pick: (a: Ask | undefined) => void,
	options = CHOICES
)}
	<div class="segmented" role="radiogroup" aria-label={name}>
		{#each options as c (c.label)}
			<button role="radio" aria-checked={current === c.value} onclick={() => pick(c.value)}
				>{c.label}</button
			>
		{/each}
	</div>
{/snippet}

{#if !session.can('content:write')}
	<p class="quiet">Settings are for people who may change the house.</p>
{:else}
	<div class="stack">
		<p class="quiet">
			Unless you say otherwise, a device asks where it says it should, and unlocking doesn't ask.
		</p>

		<section>
			<h2 class="section-label">By kind</h2>
			<ul>
				{#each kinds as [k, n] (k)}
					<li>
						<span class="name">{label(k)} <span class="count">{n}</span></span>
						{@render choice(byKind[k], `Asking for ${label(k)}`, (a) => set('kinds', k, a))}
					</li>
				{/each}
			</ul>
		</section>

		<section>
			<h2 class="section-label">For one device</h2>
			<p class="quiet">Wins over its kind — always ask before unlocking the front door, say.</p>
			{#if overridden.length > 0}
				<ul>
					{#each overridden as d (d.device_id)}
						<li>
							<span class="name">{displayName(d)}</span>
							<div class="row">
								{@render choice(
									byDevice[d.device_id],
									`Asking for ${displayName(d)}`,
									(a) => set('devices', d.device_id, a),
									CHOICES.slice(1)
								)}
								<button
									class="clear"
									aria-label={`${displayName(d)}: back to its kind`}
									onclick={() => set('devices', d.device_id, undefined)}><X size={16} /></button
								>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
			<label class="add">
				<span>Add</span>
				<select
					value=""
					onchange={(e) => {
						const v = e.currentTarget.value;
						if (v) void set('devices', v, 'always');
						e.currentTarget.value = '';
					}}
				>
					<option value="" disabled>Choose a device…</option>
					{#each addable as d (d.device_id)}<option value={d.device_id}>{displayName(d)}</option
						>{/each}
				</select>
			</label>
		</section>
		{#if household.trouble}<p class="trouble" role="alert">{household.trouble}</p>{/if}
	</div>
{/if}

<style>
	.stack {
		max-width: 680px;
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
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 6px 12px;
		padding: 6px 6px 6px 12px;
		border-radius: 12px;
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.name {
		font-weight: 600;
		text-transform: capitalize;
	}
	.count {
		font-family: var(--font-num);
		font-size: 12px;
		font-weight: 400;
		color: var(--ink-muted);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.segmented {
		display: flex;
		gap: 2px;
		padding: 3px;
		border-radius: 20px;
		background: var(--surface-2);
	}
	.segmented button {
		height: 34px;
		padding: 0 12px;
		border: none;
		border-radius: 17px;
		background: none;
		font-size: 13px;
		font-weight: 600;
		color: var(--ink-muted);
	}
	.segmented button[aria-checked='true'] {
		background: var(--surface);
		color: var(--ink);
		box-shadow: var(--shadow);
	}
	.clear {
		width: 36px;
		height: 36px;
		border: none;
		background: none;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.add {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.add select {
		flex: 1;
		min-height: var(--target);
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		padding: 0 10px;
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
	}
	.trouble {
		margin: 0;
		color: var(--alert);
	}
</style>
