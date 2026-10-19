<!--
	The alert parts of a rule, each in a few choices: when one is raised,
	clears, is seen or has lasted (When); whether one is active, none is, or
	the one that started the rule still is (Only if); and pressing its button,
	waiting for it to clear, marking it seen, skipping it, ignoring alerts
	like it, or doing steps for each one (Do).
-->
<script lang="ts">
	import { tagOf } from '#lib/ruleWords.js';
	import AlertFilterEdit from './AlertFilterEdit.svelte';
	import StepList from './StepList.svelte';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type Json = any;
	let {
		part,
		value,
		onchange
	}: { part: 'when' | 'check' | 'step'; value: Json; onchange: (v: Json) => void } = $props();

	const [tag, f] = $derived(tagOf(value));
	const filter = $derived(f.filter ?? {});

	const WHENS = [
		['AlertRaised', 'is raised'],
		['AlertCleared', 'clears'],
		['AlertAcknowledged', 'is marked seen'],
		['AlertActiveFor', 'has been active for…']
	];
	const CHECKS = [
		['AlertActive', 'One like this is active'],
		['NoAlertActive', 'None like this is active'],
		['TriggerAlertActive', 'The alert that started it is still active']
	];
	const STEPS = [
		['PressAlert', 'Press its button'],
		['WaitAlertCleared', 'Wait until it clears'],
		['AcknowledgeAlert', 'Mark it seen'],
		['SkipAlert', 'Skip this one'],
		['IgnoreAlerts', 'Ignore alerts like…'],
		['ForEachAlert', 'For each alert like…']
	];
	const choices = $derived(part === 'when' ? WHENS : part === 'check' ? CHECKS : STEPS);

	/** A new part of the chosen kind, keeping its filter. */
	function choose(next: string) {
		const keep = Object.keys(filter).length ? { filter } : { filter: {} };
		switch (next) {
			case 'AlertActiveFor':
				return onchange({ AlertActiveFor: { ...keep, minutes: f.minutes ?? 10 } });
			case 'AlertActive':
				return onchange({ AlertActive: keep });
			case 'TriggerAlertActive':
				return onchange('TriggerAlertActive');
			case 'PressAlert':
			case 'AcknowledgeAlert':
			case 'SkipAlert':
				return onchange({ [next]: {} });
			case 'WaitAlertCleared':
				return onchange({ WaitAlertCleared: { timeout_secs: 600, otherwise: [] } });
			case 'IgnoreAlerts':
				return onchange({ IgnoreAlerts: { ...keep, minutes: 60 } });
			case 'ForEachAlert':
				return onchange({ ForEachAlert: { ...keep, actions: [{ PressAlert: {} }] } });
			default:
				return onchange({ [next]: keep });
		}
	}
	const set = (field: string, v: Json) => onchange({ [tag]: { ...f, [field]: v } });
	const usesFilter = $derived(
		![
			'PressAlert',
			'AcknowledgeAlert',
			'SkipAlert',
			'WaitAlertCleared',
			'TriggerAlertActive'
		].includes(tag)
	);
</script>

<div class="part">
	<label class="kind">
		<span
			>{part === 'when' ? 'An alert like the one below' : part === 'check' ? 'Check' : 'Do'}</span
		>
		<select value={tag} onchange={(e) => choose(e.currentTarget.value)}>
			{#each choices as [k, label] (k)}<option value={k}>{label}</option>{/each}
		</select>
	</label>

	{#if tag === 'AlertActiveFor'}
		<label class="kind">
			<span>For (minutes)</span>
			<input
				type="number"
				min="1"
				value={f.minutes ?? 10}
				onchange={(e) => set('minutes', Number(e.currentTarget.value))}
			/>
		</label>
	{/if}
	{#if tag === 'AlertActive'}
		<label class="kind">
			<span>At least this many</span>
			<input
				type="number"
				min="1"
				value={f.at_least ?? 1}
				onchange={(e) => set('at_least', Math.max(1, Number(e.currentTarget.value)))}
			/>
		</label>
	{/if}

	{#if usesFilter}
		<AlertFilterEdit value={filter} onchange={(v) => set('filter', v)} />
	{:else if part === 'step'}
		<p class="quiet">
			Acts on the alert this rule is on: the one “For each” is on, else the one that started it.
		</p>
	{/if}

	{#if tag === 'WaitAlertCleared'}
		<label class="kind">
			<span>At most (minutes)</span>
			<input
				type="number"
				min="1"
				value={Math.round((f.timeout_secs ?? 600) / 60)}
				onchange={(e) => set('timeout_secs', Math.max(1, Number(e.currentTarget.value)) * 60)}
			/>
		</label>
		<div class="branch">
			<strong>If it hasn’t cleared by then</strong>
			<StepList
				steps={f.otherwise ?? []}
				onchange={(l) => set('otherwise', l)}
				addLabel="+ Add a step for then"
			/>
		</div>
	{:else if tag === 'IgnoreAlerts'}
		<label class="kind">
			<span>For (minutes; empty for good)</span>
			<input
				type="number"
				min="1"
				value={f.minutes ?? ''}
				onchange={(e) =>
					set('minutes', e.currentTarget.value === '' ? undefined : Number(e.currentTarget.value))}
			/>
		</label>
	{:else if tag === 'ForEachAlert'}
		<div class="branch">
			<strong>For each one, one at a time</strong>
			<StepList
				steps={f.actions ?? []}
				onchange={(l) => set('actions', l)}
				addLabel="+ Add a step for each"
			/>
		</div>
	{/if}
	{#if part === 'step'}
		<p class="quiet">
			In a message, <code>{'{alert.message}'}</code>, <code>{'{alert.device}'}</code> and
			<code>{'{alert.key}'}</code> fill in from that alert.
		</p>
	{/if}
</div>

<style>
	.part {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.kind {
		display: flex;
		flex-direction: column;
		gap: 4px;
		min-width: 0;
		font-size: 12px;
		font-weight: 600;
		color: var(--ink-muted);
	}
	select,
	input {
		height: 40px;
		max-width: 100%;
		padding: 0 8px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: 15px;
		font-weight: 400;
	}
	.branch {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding-left: 12px;
		border-left: 3px solid var(--line);
	}
	.quiet {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
	code {
		font-family: var(--font-num);
		font-size: 12px;
	}
</style>
