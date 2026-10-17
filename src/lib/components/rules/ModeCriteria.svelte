<!--
	A mode that turns itself on and off (A7 coverage pass): homeCore's
	criteria for a manual mode — the checks that turn it on, and either "off
	when that stops being true" or checks of its own that turn it off; how
	often it looks again. Edited with the rule editor's own check rows.
	homeCore makes rules from it and keeps them in step; they are shown, not
	edited, here.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { checkPhrase, type Rule } from '#lib/ruleWords.js';
	import { newCheck } from '#lib/ruleEdit.js';
	import { ask } from '#lib/confirm.svelte.js';
	import {
		criteriaOf,
		criteriaProblems,
		draftOf,
		type CriteriaDraft,
		type Definition
	} from '#lib/modes.js';
	import { provideHouse } from './house.svelte.js';
	import CheckEdit from './CheckEdit.svelte';
	import Words from './Words.svelte';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type Json = any;
	let {
		modeId,
		modeName,
		definition,
		rules = [],
		onsaved
	}: {
		modeId: string;
		modeName: string;
		definition: Definition | null;
		rules?: Rule[];
		onsaved: () => void;
	} = $props();

	const ctx = provideHouse(() => rules);

	let editing = $state(false);
	let draft = $state<CriteriaDraft>(untrack(() => draftOf(definition)));
	$effect(() => {
		void modeId;
		void definition;
		if (!editing) draft = draftOf(definition);
	});
	const problems = $derived(criteriaProblems(modeId, draft));
	let note = $state<string | null>(null);
	let busy = $state(false);

	const path = $derived(`/api/v1/modes/${encodeURIComponent(modeId)}/definition`);
	async function said(res: Response | null): Promise<string | null> {
		if (!res) return 'homeCore is not answering.';
		if (res.ok) return null;
		const body = (await res.json().catch(() => ({}))) as { error?: string };
		return body.error ?? `homeCore said no (${res.status}).`;
	}
	async function save() {
		busy = true;
		note = await said(
			await fetch(path, {
				method: 'PUT',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(criteriaOf($state.snapshot(draft)))
			}).catch(() => null)
		);
		busy = false;
		if (note) return;
		editing = false;
		onsaved();
	}
	async function stop() {
		const yes = await ask({
			title: `Stop ${modeName} turning itself on and off?`,
			body: 'It stays as it is now, and from then on people and rules switch it.',
			lost: ['The rules homeCore made for it'],
			go: 'Stop',
			danger: true
		});
		if (!yes) return;
		note = await said(await fetch(path, { method: 'DELETE' }).catch(() => null));
		if (!note) {
			editing = false;
			onsaved();
		}
	}
	function cancel() {
		editing = false;
		note = null;
		draft = draftOf(definition);
	}

	const set = (part: 'on' | 'off', list: Json[]) => (draft = { ...draft, [part]: list });
	const made = $derived(
		(definition?.generated_rule_ids ?? [])
			.map((id) => rules.find((r) => r.id === id))
			.filter((r): r is Rule => !!r)
	);
</script>

<section class="crit">
	<h3>Turns itself on and off</h3>
	{#if !editing}
		{#if definition}
			<div class="said">
				<p>
					<strong>On when</strong>
					{#each draft.on as c, i (i)}{#if i > 0}<span class="and"> and </span>{/if}<Words
							words={checkPhrase(ctx.house, c)}
						/>{/each}.
				</p>
				<p>
					<strong>Off when</strong>
					{#if draft.explicit}
						{#each draft.off as c, i (i)}{#if i > 0}<span class="and"> and </span>{/if}<Words
								words={checkPhrase(ctx.house, c)}
							/>{/each}.
					{:else}
						that stops being true.
					{/if}
				</p>
				<p class="sub">
					homeCore looks again whenever something it names changes, when it starts, and every
					{draft.every === 1 ? 'minute' : `${draft.every} minutes`}.
					{#if made.length}It does this with {made.length} rules of its own, which it keeps in step.{/if}
				</p>
			</div>
			<div class="acts">
				<button type="button" class="plain" onclick={() => (editing = true)}>Change…</button>
				<button type="button" class="plain bad" onclick={stop}>Stop…</button>
			</div>
		{:else}
			<p class="sub">
				People and rules switch it. It can switch itself instead — on while something is true:
				everyone’s away, it’s raining, the TV is on after dark.
			</p>
			<button
				type="button"
				class="plain"
				onclick={() => {
					draft = { on: [newCheck('device')], explicit: false, off: [], every: 1 };
					editing = true;
				}}>Make it switch itself…</button
			>
		{/if}
	{:else}
		<div class="part">
			<h4>On when <span>— all of these</span></h4>
			{#each draft.on as c, i (i)}
				<CheckEdit
					value={c}
					open={i === draft.on.length - 1}
					onchange={(v) =>
						set(
							'on',
							draft.on.map((x, j) => (j === i ? v : x))
						)}
					onremove={() =>
						set(
							'on',
							draft.on.filter((_, j) => j !== i)
						)}
				/>
			{/each}
			<button type="button" class="add" onclick={() => set('on', [...draft.on, newCheck('device')])}
				>+ And…</button
			>
		</div>

		<div class="part">
			<h4>Off when</h4>
			<label class="radio"
				><input
					type="radio"
					name="off"
					checked={!draft.explicit}
					onchange={() => (draft = { ...draft, explicit: false })}
				/>
				That stops being true</label
			>
			<label class="radio"
				><input
					type="radio"
					name="off"
					checked={draft.explicit}
					onchange={() =>
						(draft = {
							...draft,
							explicit: true,
							off: draft.off.length ? draft.off : [newCheck('device')]
						})}
				/>
				Something else is true — it stays on until then</label
			>
			{#if draft.explicit}
				{#each draft.off as c, i (i)}
					<CheckEdit
						value={c}
						onchange={(v) =>
							set(
								'off',
								draft.off.map((x, j) => (j === i ? v : x))
							)}
						onremove={() =>
							set(
								'off',
								draft.off.filter((_, j) => j !== i)
							)}
					/>
				{/each}
				<button
					type="button"
					class="add"
					onclick={() => set('off', [...draft.off, newCheck('device')])}>+ And…</button
				>
			{/if}
		</div>

		<label class="every"
			>Also look again every <input
				type="number"
				min="1"
				value={draft.every}
				oninput={(e) => (draft = { ...draft, every: Number(e.currentTarget.value) })}
			/> minutes</label
		>
		<p class="sub">
			It looks whenever something it names changes; this catches the rest, like a time window
			opening.
		</p>

		{#if problems.length}
			<ul class="problems">
				{#each problems as p (p)}<li>{p}</li>{/each}
			</ul>
		{/if}
		<div class="acts">
			<button type="button" class="go" disabled={busy || problems.length > 0} onclick={save}
				>{busy ? 'Saving…' : 'Save'}</button
			>
			<button type="button" class="plain" onclick={cancel}>Cancel</button>
		</div>
	{/if}
	{#if note}<p class="note" role="alert">{note}</p>{/if}
</section>

<style>
	.crit {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	h3 {
		margin: 0;
		font-size: 15px;
	}
	h4 {
		margin: 0 0 4px;
		font-size: 13px;
		font-weight: 700;
	}
	h4 span {
		font-weight: 400;
		color: var(--ink-muted);
	}
	.said p {
		margin: 0 0 4px;
		line-height: 1.5;
	}
	.and {
		color: var(--ink-muted);
	}
	.sub {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
		line-height: 1.45;
	}
	.part {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 10px 12px;
		border-radius: 12px;
		background: var(--surface-2);
	}
	.radio,
	.every {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
	}
	.every input {
		width: 64px;
		min-height: 34px;
		border-radius: 8px;
		border: 1px solid var(--line);
		background: var(--sheet);
		padding: 0 8px;
	}
	.add {
		align-self: flex-start;
		border: none;
		background: none;
		padding: 4px 0;
		color: var(--accent);
		font-weight: 600;
	}
	.acts {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.go,
	.plain {
		min-height: 38px;
		padding: 0 14px;
		border-radius: 19px;
		font-weight: 700;
		border: 1px solid var(--line);
		background: var(--surface);
	}
	.go {
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.go:disabled {
		opacity: 0.5;
	}
	.plain.bad {
		color: var(--alert);
		border-color: var(--alert-line);
	}
	.problems {
		margin: 0;
		padding-left: 18px;
		color: var(--alert);
		font-size: 13px;
	}
	.note {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: 10px;
		background: var(--alert-bg);
		color: var(--alert);
		font-weight: 600;
	}
</style>
