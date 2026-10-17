<!--
	One field of a rule's part (A3): a number, words, a choice, a time, days,
	a device, or JSON for what has no better control.
-->
<script lang="ts">
	import type { Field } from '#lib/ruleEdit.js';
	import Pick from './Pick.svelte';

	let { field, value, onchange }: { field: Field; value: unknown; onchange: (v: unknown) => void } =
		$props();

	const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
	const UNITS = [
		{ secs: 3600, label: 'h' },
		{ secs: 60, label: 'min' },
		{ secs: 1, label: 's' }
	];
	const unitOf = (secs: number) =>
		UNITS.find((u) => secs % u.secs === 0 && secs >= u.secs) ?? UNITS[2]!;
	const secs = $derived(typeof value === 'number' ? value : 0);
	let unit = $state<number | null>(null);
	const shownUnit = $derived(unit ?? unitOf(secs).secs);

	let jsonText = $state<string | null>(null);
	let jsonError = $state<string | null>(null);
	const id = `f-${Math.random().toString(36).slice(2, 8)}`;
</script>

{#if field.kind === 'device'}
	<Pick
		value={typeof value === 'string' ? value : ''}
		label={field.label}
		optional={field.optional}
		onchange={(v) => onchange(v === '' && field.optional ? undefined : v)}
	/>
{:else if field.kind === 'bool'}
	<label class="check"
		><input
			type="checkbox"
			checked={value === true}
			onchange={(e) => onchange(e.currentTarget.checked)}
		/>
		{field.label}</label
	>
{:else}
	<label class="field" class:wide={field.kind === 'json' || (field.kind === 'text' && field.long)}>
		<span>{field.label}{'optional' in field && field.optional ? ' (optional)' : ''}</span>
		{#if field.kind === 'number'}
			<span class="row">
				<input
					type="number"
					value={typeof value === 'number' ? value : ''}
					min={field.min}
					max={field.max}
					step={field.step ?? 'any'}
					oninput={(e) =>
						onchange(
							e.currentTarget.value === ''
								? field.optional
									? undefined
									: 0
								: Number(e.currentTarget.value)
						)}
				/>
				{#if field.unit}<em>{field.unit}</em>{/if}
			</span>
		{:else if field.kind === 'duration'}
			<span class="row">
				<input
					type="number"
					min="0"
					value={value === undefined || value === null ? '' : secs / shownUnit}
					oninput={(e) =>
						onchange(
							e.currentTarget.value === ''
								? field.optional
									? undefined
									: 0
								: Math.round(Number(e.currentTarget.value) * shownUnit)
						)}
				/>
				<select
					aria-label="Unit"
					value={String(shownUnit)}
					onchange={(e) => {
						const next = Number(e.currentTarget.value);
						const n = secs / shownUnit;
						unit = next;
						if (value !== undefined && value !== null) onchange(Math.round(n * next));
					}}
				>
					{#each UNITS as u (u.secs)}<option value={String(u.secs)}>{u.label}</option>{/each}
				</select>
			</span>
		{:else if field.kind === 'choice'}
			<select
				value={value === undefined || value === null ? '' : String(value)}
				onchange={(e) =>
					onchange(field.numeric ? Number(e.currentTarget.value) : e.currentTarget.value)}
			>
				{#if value === undefined || value === null || !field.options.some((o) => o.value === String(value))}
					<option
						value={value === undefined || value === null ? '' : String(value)}
						disabled={value === undefined || value === null}
						>{value === undefined || value === null ? 'Choose…' : String(value)}</option
					>
				{/if}
				{#each field.options as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
			</select>
		{:else if field.kind === 'time'}
			<input
				type="time"
				value={typeof value === 'string' ? value.slice(0, 5) : ''}
				onchange={(e) => onchange(`${e.currentTarget.value}:00`)}
			/>
		{:else if field.kind === 'days'}
			{@const days = Array.isArray(value) ? (value as string[]) : []}
			<span class="days" role="group" aria-label={field.label}>
				{#each DAYS as d (d)}
					<button
						type="button"
						aria-pressed={days.includes(d)}
						onclick={() =>
							onchange(
								days.includes(d)
									? days.filter((x) => x !== d)
									: DAYS.filter((x) => x === d || days.includes(x))
							)}>{d}</button
					>
				{/each}
				<em>{days.length === 0 ? 'every day' : ''}</em>
			</span>
		{:else if field.kind === 'json'}
			<textarea
				rows="3"
				class="mono"
				class:bad={jsonError}
				value={jsonText ?? (value === undefined ? '' : JSON.stringify(value))}
				oninput={(e) => (jsonText = e.currentTarget.value)}
				onblur={() => {
					if (jsonText === null) return;
					if (jsonText.trim() === '' && field.optional) {
						jsonError = null;
						jsonText = null;
						onchange(undefined);
						return;
					}
					try {
						onchange(JSON.parse(jsonText));
						jsonError = null;
						jsonText = null;
					} catch {
						jsonError = 'That isn’t JSON yet.';
					}
				}}></textarea>
			{#if jsonError}<em class="bad">{jsonError}</em>{/if}
		{:else if field.kind === 'text' && field.long}
			<textarea
				rows="2"
				value={typeof value === 'string' ? value : ''}
				oninput={(e) => onchange(e.currentTarget.value)}></textarea>
		{:else if field.kind === 'text'}
			<input
				list={field.suggest ? id : undefined}
				value={typeof value === 'string' ? value : ''}
				oninput={(e) =>
					onchange(
						e.currentTarget.value === '' && field.optional ? undefined : e.currentTarget.value
					)}
			/>
			{#if field.suggest}<datalist {id}
					>{#each field.suggest as s (s)}<option value={s}></option>{/each}</datalist
				>{/if}
		{/if}
	</label>
{/if}

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
		font-size: 12px;
		font-weight: 600;
		color: var(--ink-muted);
	}
	.field.wide {
		flex-basis: 100%;
	}
	.row {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	input,
	select,
	textarea {
		height: 40px;
		min-width: 0;
		padding: 0 10px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: 14px;
		font-weight: 500;
	}
	input[type='number'] {
		width: 96px;
	}
	textarea {
		height: auto;
		padding: 8px 10px;
		line-height: 1.4;
		resize: vertical;
	}
	.mono {
		font-family: var(--font-num);
		font-size: 12.5px;
	}
	em {
		font-style: normal;
		color: var(--ink-muted);
		font-weight: 500;
	}
	.bad {
		border-color: var(--alert);
		color: var(--alert);
	}
	.check {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 40px;
		font-size: 14px;
	}
	.days {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
	}
	.days button {
		height: 34px;
		min-width: 44px;
		padding: 0 8px;
		border-radius: 17px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: 13px;
		font-weight: 600;
	}
	.days button[aria-pressed='true'] {
		background: var(--ink);
		color: var(--bg);
		border-color: var(--ink);
	}
</style>
