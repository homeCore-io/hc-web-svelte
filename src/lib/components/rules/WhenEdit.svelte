<!--
	A rule's When (A3): the moment it starts — a device's own moments in its
	own words ("opens", "button 1 is pressed"), a time, the sun, a mode,
	homeCore starting — or anything else homeCore's vocabulary has.
-->
<script lang="ts">
	import { displayName } from '#lib/devices.js';
	import { whenPhrase } from '#lib/ruleWords.js';
	import {
		WHEN_KINDS,
		CHANGE_KIND,
		keepExtras,
		momentful,
		momentOf,
		momentsOf,
		newWhen,
		webhookAddress,
		webhookName,
		webhookProblem,
		whenKindOf,
		type WhenKind
	} from '#lib/ruleEdit.js';
	import { tagOf } from '#lib/ruleWords.js';
	import { editor } from './context.js';
	import Row from './Row.svelte';
	import Pick from './Pick.svelte';
	import FieldInput from './FieldInput.svelte';
	import Other from './Other.svelte';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type Json = any;
	let {
		value,
		onchange,
		onremove,
		open = $bindable(false)
	}: { value: Json; onchange: (v: Json) => void; onremove?: () => void; open?: boolean } = $props();

	const ctx = editor();
	const kind = $derived(whenKindOf(value));
	const f = $derived(tagOf(value)[1]);

	// ---- a device's moment ----
	const now = $derived(momentOf(value));
	const ids = $derived(now?.ids ?? (typeof f.device_id === 'string' ? [f.device_id] : ['']));
	const device = $derived(ctx.house.device(ids[0] ?? ''));
	const moments = $derived(device ? momentsOf(device) : []);
	const moment = $derived(moments.find((m) => m.key === now?.key) ?? undefined);
	function setMoment(key: string, extra: { ids?: string[]; for?: number; value?: number } = {}) {
		const m = moments.find((x) => x.key === key) ?? moments[0];
		if (!m) return onchange({ DeviceStateChanged: { device_id: (extra.ids ?? ids)[0] ?? '' } });
		const next = m.build(extra.ids ?? ids, {
			for: 'for' in extra ? extra.for : now?.for,
			value: 'value' in extra ? extra.value : (now?.value ?? 0)
		});
		onchange(keepExtras(value, next));
	}
	function setDevice(id: string) {
		const d = ctx.house.device(id);
		const next = d ? momentsOf(d) : [];
		// Keep the moment when the new device has it too ("opens" → another door).
		const k = next.some((m) => m.key === now?.key) ? now!.key : next[0]?.key;
		const m = next.find((x) => x.key === k);
		onchange(
			m
				? keepExtras(value, m.build([id, ...ids.slice(1)], { for: now?.for, value: now?.value }))
				: { DeviceStateChanged: { device_id: id } }
		);
	}
	const canAddDevices = $derived(tagOf(value)[0] === 'DeviceStateChanged' && ids[0] !== '');

	// ---- the sun ----
	const SUN = [
		{ value: 'Sunrise', label: 'sunrise' },
		{ value: 'Sunset', label: 'sunset' },
		{ value: 'CivilDawn', label: 'dawn' },
		{ value: 'CivilDusk', label: 'dusk' },
		{ value: 'SolarNoon', label: 'solar noon' }
	];
	const set = (field: string, v: unknown) => onchange({ [tagOf(value)[0]]: { ...f, [field]: v } });

	// ---- a webhook ----
	const origin = typeof location === 'undefined' ? '' : location.origin;
	const hookName = $derived(typeof f.path === 'string' ? f.path : '');
	const hookProblem = $derived(webhookProblem(hookName));
	const hookAddress = $derived(webhookAddress(origin, hookName));
	let copied = $state(false);
	async function copy() {
		try {
			await navigator.clipboard.writeText(hookAddress);
			copied = true;
			setTimeout(() => (copied = false), 1500);
		} catch {
			copied = false;
		}
	}
</script>

<Row words={whenPhrase(ctx.house, value)} bind:open {onremove}>
	<label class="kind">
		<span>When</span>
		<select value={kind} onchange={(e) => onchange(newWhen(e.currentTarget.value as WhenKind))}>
			{#each WHEN_KINDS as k (k.kind)}<option value={k.kind}>{k.label}</option>{/each}
		</select>
	</label>

	{#if kind === 'device' || (kind === 'other' && tagOf(value)[0] === 'DeviceStateChanged' && f.device_id === '')}
		<Pick value={ids[0] ?? ''} only={momentful} onchange={setDevice} />
		{#if device}
			<label class="kind">
				<span>{displayName(device)}…</span>
				<select value={now?.key ?? ''} onchange={(e) => setMoment(e.currentTarget.value)}>
					{#if !moment}<option value={now?.key ?? ''} disabled>Choose what happens…</option>{/if}
					{#each moments as m (m.key)}<option value={m.key}>{m.label}</option>{/each}
				</select>
			</label>
			{#if moment?.number}
				<FieldInput
					field={{
						kind: 'number',
						name: 'value',
						label: moment.number.label,
						unit: moment.number.unit
					}}
					value={now?.value ?? 0}
					onchange={(v) => setMoment(moment.key, { value: Number(v) })}
				/>
			{/if}
			{#if moment?.lasting || moment?.number}
				<FieldInput
					field={{ kind: 'duration', name: 'for', label: 'And stays so for', optional: true }}
					value={now?.for}
					onchange={(v) => setMoment(moment!.key, { for: (v as number) || undefined })}
				/>
			{/if}
			{#if tagOf(value)[0] === 'DeviceStateChanged'}
				<FieldInput
					field={{
						kind: 'choice',
						name: 'change_kind',
						label: 'Changed by',
						options: CHANGE_KIND,
						optional: true
					}}
					value={f.change_kind}
					onchange={(v) => {
						const { change_kind: _, ...rest } = f;
						onchange({ DeviceStateChanged: v === undefined ? rest : { ...rest, change_kind: v } });
					}}
				/>
			{/if}
			{#if canAddDevices}
				<div class="more">
					{#each ids.slice(1) as other, i (other + i)}
						<Pick
							value={other}
							label="Or"
							only={momentful}
							optional
							onchange={(v) =>
								setMoment(now?.key ?? '', {
									ids:
										v === ''
											? ids.filter((_, j) => j !== i + 1)
											: ids.map((x, j) => (j === i + 1 ? v : x))
								})}
						/>
					{/each}
					<Pick
						value=""
						label={ids.length > 1 ? 'Or another' : 'Or any of these too'}
						only={momentful}
						optional
						onchange={(v) => v && setMoment(now?.key ?? '', { ids: [...ids, v] })}
					/>
				</div>
			{/if}
		{/if}
	{:else if kind === 'time'}
		<FieldInput
			field={{ kind: 'time', name: 'time', label: 'At' }}
			value={f.time}
			onchange={(v) => set('time', v)}
		/>
		<FieldInput
			field={{ kind: 'days', name: 'days', label: 'On' }}
			value={f.days}
			onchange={(v) => set('days', v)}
		/>
	{:else if kind === 'sun'}
		<FieldInput
			field={{ kind: 'number', name: 'off', label: 'Minutes', min: 0 }}
			value={Math.abs(f.offset_minutes ?? 0)}
			onchange={(v) => set('offset_minutes', (f.offset_minutes < 0 ? -1 : 1) * Number(v))}
		/>
		<FieldInput
			field={{
				kind: 'choice',
				name: 'side',
				label: 'Before or after',
				options: [
					{ value: 'before', label: 'before' },
					{ value: 'after', label: 'after' }
				]
			}}
			value={f.offset_minutes < 0 ? 'before' : 'after'}
			onchange={(v) =>
				set('offset_minutes', (v === 'before' ? -1 : 1) * Math.abs(f.offset_minutes ?? 0))}
		/>
		<FieldInput
			field={{ kind: 'choice', name: 'event', label: 'The sun event', options: SUN }}
			value={f.event}
			onchange={(v) => set('event', v)}
		/>
	{:else if kind === 'mode'}
		<FieldInput
			field={{
				kind: 'choice',
				name: 'mode_id',
				label: 'Mode',
				// Left out, the moment is any mode changing.
				optional: true,
				blank: 'Any mode',
				options: ctx.modes.map((m) => ({ value: m.device_id, label: displayName(m) }))
			}}
			value={f.mode_id}
			onchange={(v) => set('mode_id', v)}
		/>
		<FieldInput
			field={{
				kind: 'choice',
				name: 'to',
				label: 'When it',
				options: [
					{ value: 'true', label: 'turns on' },
					{ value: 'false', label: 'turns off' },
					{ value: '', label: 'turns on or off' }
				]
			}}
			value={f.to === undefined || f.to === null ? '' : String(f.to)}
			onchange={(v) => {
				const next = { ...f };
				if (v === '') delete next.to;
				else next.to = v === 'true';
				onchange({ ModeChanged: next });
			}}
		/>
	{:else if kind === 'every'}
		<FieldInput
			field={{ kind: 'number', name: 'every_n', label: 'Every', min: 1 }}
			value={f.every_n}
			onchange={(v) => set('every_n', Math.max(1, Number(v)))}
		/>
		<FieldInput
			field={{
				kind: 'choice',
				name: 'unit',
				label: 'Unit',
				options: ['Minutes', 'Hours', 'Days', 'Weeks'].map((u) => ({
					value: u,
					label: u.toLowerCase()
				}))
			}}
			value={f.unit}
			onchange={(v) => set('unit', v)}
		/>
	{:else if kind === 'webhook'}
		<div class="hook">
			<label class="kind name">
				<span>Its name — the end of the address</span>
				<span class="row">
					<input
						class="mono"
						value={hookName}
						spellcheck="false"
						oninput={(e) => set('path', e.currentTarget.value.trim())}
					/>
					<button type="button" class="plain" onclick={() => set('path', webhookName())}
						>New name</button
					>
				</span>
			</label>
			{#if hookProblem}<p class="warn" role="alert">{hookProblem}</p>{/if}
			<div class="address">
				<span>The address to call</span>
				<code>{hookAddress}</code>
				<button type="button" class="plain" onclick={copy} disabled={!!hookProblem && !hookName}
					>{copied ? 'Copied' : 'Copy'}</button
				>
			</div>
			<p class="quiet">
				Anyone who can reach this address can start the rule — it asks for no password, so the name
				is its secret. Give it only to the service that calls it; a new name stops the old address
				working once you save.
			</p>
			<details>
				<summary>How a service calls it</summary>
				<pre class="mono">curl -X POST '{hookAddress}?who=doorbell' \
  -H 'content-type: application/json' \
  -d '&#123;"pressed": true&#125;'</pre>
				<p class="quiet">
					It must be a POST. What’s sent arrives as the trigger’s value, and anything after “?” as
					its extras, for the rule’s steps to use.
				</p>
			</details>
		</div>
	{:else if kind === 'other'}
		{#if ctx.vocab}
			<Other {value} {onchange} specs={ctx.vocab.triggers} />
		{:else}
			<p class="quiet">homeCore didn’t say what else it has. Change it in the JSON tab.</p>
		{/if}
	{/if}
</Row>

<style>
	.kind {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
		font-size: 12px;
		font-weight: 600;
		color: var(--ink-muted);
	}
	select {
		height: 40px;
		max-width: 100%;
		padding: 0 8px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: 14px;
		font-weight: 500;
	}
	.more {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-3);
		flex-basis: 100%;
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
	}
	.hook {
		flex-basis: 100%;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		min-width: 0;
	}
	.row {
		display: flex;
		gap: 8px;
		align-items: center;
		min-width: 0;
	}
	.name input {
		flex: 1 1 auto;
		min-width: 0;
		height: 40px;
		padding: 0 10px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font-size: 14px;
	}
	.address {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px 10px;
		font-size: 12px;
		font-weight: 600;
		color: var(--ink-muted);
	}
	.address span {
		flex-basis: 100%;
	}
	.address code {
		flex: 1 1 260px;
		min-width: 0;
		overflow-wrap: anywhere;
		padding: 8px 10px;
		border-radius: 10px;
		background: var(--surface-2);
		color: var(--ink);
		font-family: var(--font-num);
		font-size: 13px;
		font-weight: 500;
	}
	.plain {
		height: 36px;
		padding: 0 14px;
		border-radius: 18px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: 13px;
		font-weight: 700;
		white-space: nowrap;
	}
	.warn {
		margin: 0;
		color: var(--alert);
		font-size: 13px;
		font-weight: 600;
	}
	details summary {
		cursor: pointer;
		font-size: 13px;
		font-weight: 600;
		color: var(--accent);
	}
	pre {
		margin: 6px 0;
		padding: 10px;
		border-radius: 10px;
		background: var(--surface-2);
		font-size: 12px;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.mono {
		font-family: var(--font-num);
	}
</style>
