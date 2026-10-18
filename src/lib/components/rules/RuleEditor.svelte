<!--
	The rule editor (A3, doc 09 §3): When · Only if · Do, each a list of
	sentences built with pickers that speak the house; More for what most
	rules never use (E7); the rule as JSON beside it, round-tripping (D13).
	Everything is a draft until Save (E6); Test asks the house as it is now
	without doing anything.
-->
<script lang="ts">
	import { moreOf, sentence, tagOf, type Rule } from '#lib/ruleWords.js';
	import { tested, type Tested } from '#lib/ruleRuns.js';
	import { newCheck, newWhen, problemsOf, whensOf, withWhens } from '#lib/ruleEdit.js';
	import { testDraft, testRule } from '#lib/ruleAdmin.js';
	import { same } from '#lib/ruleDraft.js';
	import { provideHouse } from './house.svelte.js';
	import Words from './Words.svelte';
	import WhenEdit from './WhenEdit.svelte';
	import CheckEdit from './CheckEdit.svelte';
	import StepList from './StepList.svelte';
	import FieldInput from './FieldInput.svelte';

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	type Json = any;
	let {
		draft = $bindable(),
		saved,
		rules = [],
		busy = false,
		note = null,
		onsave,
		ondiscard,
		banner
	}: {
		draft: Rule;
		/** The rule as homeCore has it; none for a new one. */
		saved: Rule | null;
		/** The house's other rules: channels they use, names for "do the steps of". */
		rules?: Rule[];
		busy?: boolean;
		note?: string | null;
		onsave: () => void;
		ondiscard: () => void;
		banner?: import('svelte').Snippet;
	} = $props();

	// ---- what the parts read ----
	const ctx = provideHouse(() => rules);
	const house = $derived(ctx.house);
	const features = $derived(ctx.features);

	// ---- the draft ----
	const changed = $derived(!saved || !same($state.snapshot(draft), saved));
	const problems = $derived(problemsOf(draft, (id) => !!house.device(id)));
	const whens = $derived(whensOf(draft));
	const setWhens = (list: Json[]) => (draft = withWhens(draft, list));
	const words = $derived(sentence(house, draft));
	const steps = $derived((draft.actions ?? []).map((a) => a.action));
	const enabled = $derived((draft.actions ?? []).map((a) => a.enabled !== false));
	function setSteps(list: Json[]) {
		const before = draft.actions ?? [];
		// A step keeps its on/off as it moves; a new one is on.
		draft = {
			...draft,
			actions: list.map((action, i) => ({
				enabled:
					before.find((b) => b.action === action)?.enabled ??
					(list.length === before.length ? before[i]?.enabled : undefined) ??
					true,
				action
			}))
		};
	}
	const setEnabled = (i: number, on: boolean) =>
		(draft = {
			...draft,
			actions: (draft.actions ?? []).map((a, j) => (j === i ? { ...a, enabled: on } : a))
		});
	const setField = (name: string, v: unknown) => {
		const next = { ...draft } as Json;
		if (v === undefined || v === '' || v === null) delete next[name];
		else next[name] = v;
		draft = next;
	};

	// ---- tabs ----
	let tab = $state<'visual' | 'json'>('visual');
	let jsonText = $state('');
	let jsonError = $state<string | null>(null);
	function showJson() {
		const { id: _id, ...rest } = $state.snapshot(draft) as Json;
		jsonText = JSON.stringify(rest, null, 2);
		jsonError = null;
		tab = 'json';
	}
	function readJson(): boolean {
		try {
			const parsed = JSON.parse(jsonText);
			if (!parsed || typeof parsed !== 'object' || !('trigger' in parsed)) {
				jsonError = 'A rule needs at least a name and a trigger.';
				return false;
			}
			draft = { ...parsed, id: draft.id };
			jsonError = null;
			return true;
		} catch (e) {
			jsonError = `That isn’t JSON yet: ${(e as Error).message}`;
			return false;
		}
	}
	const showVisual = () => readJson() && (tab = 'visual');

	// ---- More (E7) ----
	let moreOpen = $state(false);
	$effect(() => {
		if (moreOf(draft).length > 0) moreOpen = true;
	});
	const runMode = $derived(tagOf(draft.run_mode ?? 'Parallel'));

	// ---- test ----
	let test = $state<Tested | null>(null);
	let testNote = $state<string | null>(null);
	let testing = $state(false);
	async function runTest() {
		if (tab === 'json' && !readJson()) return;
		testing = true;
		testNote = null;
		const snap = $state.snapshot(draft) as Rule;
		const res = features.testDraft
			? await testDraft(snap)
			: saved && !changed
				? await testRule(saved.id)
				: null;
		testing = false;
		if (res === null) {
			test = null;
			testNote =
				'This homeCore tests only saved rules: save first, or test the saved version from its page.';
		} else if (!res.ok) {
			test = null;
			testNote = res.error;
		} else test = tested(house, snap, res.data);
	}
	function save() {
		if (tab === 'json' && !readJson()) return;
		onsave();
	}
</script>

<div class="editor">
	<div class="bar">
		<div class="tabs" role="tablist" aria-label="Show the rule">
			<button type="button" role="tab" aria-selected={tab === 'visual'} onclick={showVisual}
				>Visual</button
			>
			<button
				type="button"
				role="tab"
				class="mono"
				aria-selected={tab === 'json'}
				onclick={showJson}>JSON</button
			>
		</div>
		<span class="state">{changed ? 'Draft — not saved yet.' : 'Saved.'}</span>
		<button type="button" class="plain" disabled={testing} onclick={runTest}
			>{testing ? 'Testing…' : 'Test'}</button
		>
		<button type="button" class="plain" disabled={busy} onclick={ondiscard}
			>{changed ? 'Discard' : 'Close'}</button
		>
		<button
			type="button"
			class="go"
			disabled={busy || !changed || problems.length > 0}
			onclick={save}>{busy ? 'Saving…' : 'Save'}</button
		>
	</div>

	{#if banner}{@render banner()}{/if}
	{#if note}<p class="note bad" role="alert">{note}</p>{/if}
	{#if problems.length > 0 && changed}
		<ul class="problems">
			{#each problems as p (p)}<li>{p}</li>{/each}
		</ul>
	{/if}

	{#if test || testNote}
		<div class="result" class:yes={test?.yes} role="status">
			{#if test}
				<strong>{test.headline}</strong>
				<ol>
					{#each test.lines as l, j (j)}
						<li>
							<span><Words words={l.words} /></span>{#if l.mark}<span class="mark {l.tone}"
									>{l.mark}</span
								>{/if}
						</li>
					{/each}
				</ol>
			{:else}<span>{testNote}</span>{/if}
			<button type="button" class="link" onclick={() => ((test = null), (testNote = null))}
				>Close</button
			>
		</div>
	{/if}

	{#if tab === 'json'}
		<label class="json">
			<span
				>The rule as homeCore stores it. Anything the visual editor can’t draw is kept as written.</span
			>
			<textarea rows="24" spellcheck="false" bind:value={jsonText}></textarea>
			{#if jsonError}<em class="bad">{jsonError}</em>{/if}
		</label>
	{:else}
		<label class="name">
			<span>Name</span>
			<input
				value={draft.name}
				placeholder="What it’s for"
				oninput={(e) => (draft = { ...draft, name: e.currentTarget.value })}
			/>
		</label>
		<p class="sentence"><Words {words} /></p>

		<section class="part">
			<h2>When</h2>
			{#each whens as w, i (i)}
				<WhenEdit
					value={w}
					open={i === whens.length - 1 && tagOf(w)[1].device_id === ''}
					onchange={(v) => setWhens(whens.map((x, j) => (j === i ? v : x)))}
					onremove={whens.length > 1 ? () => setWhens(whens.filter((_, j) => j !== i)) : undefined}
				/>
			{/each}
			{#if features.triggers}
				<button type="button" class="add" onclick={() => setWhens([...whens, newWhen('device')])}
					>+ Or when…</button
				>
			{/if}
		</section>

		<section class="part">
			<h2>Only if <span>— checked at that moment</span></h2>
			{#each draft.conditions ?? [] as c, i (i)}
				<CheckEdit
					value={c}
					open={tagOf(c)[1].device_id === ''}
					onchange={(v) =>
						(draft = {
							...draft,
							conditions: (draft.conditions ?? []).map((x, j) => (j === i ? v : x))
						})}
					onremove={() =>
						(draft = { ...draft, conditions: (draft.conditions ?? []).filter((_, j) => j !== i) })}
				/>
			{/each}
			<button
				type="button"
				class="add"
				onclick={() =>
					(draft = { ...draft, conditions: [...(draft.conditions ?? []), newCheck('device')] })}
				>+ Add a check</button
			>
		</section>

		<section class="part">
			<h2>Do</h2>
			<StepList {steps} {enabled} onchange={setSteps} onenabled={setEnabled} />
		</section>

		<details class="more" bind:open={moreOpen}>
			<summary>More — if it runs again while running, rests, priority, logging, expressions</summary
			>
			{#if moreOf(draft).length === 0}<p class="quiet">
					None set. A rule that uses any of these opens with this section open.
				</p>{/if}
			<div class="fields">
				<FieldInput
					field={{
						kind: 'choice',
						name: 'run',
						label: 'If it starts again while running',
						options: [
							{ value: 'Parallel', label: 'run both' },
							{ value: 'Single', label: 'skip the new one' },
							{ value: 'Restart', label: 'start over' },
							{ value: 'Queued', label: 'queue it' }
						]
					}}
					value={runMode[0]}
					onchange={(v) =>
						setField(
							'run_mode',
							v === 'Parallel' ? undefined : v === 'Queued' ? { Queued: { max_queue: 10 } } : v
						)}
				/>
				{#if runMode[0] === 'Queued'}
					<FieldInput
						field={{ kind: 'number', name: 'q', label: 'Queue at most', min: 1 }}
						value={runMode[1].max_queue ?? 10}
						onchange={(v) => setField('run_mode', { Queued: { max_queue: Number(v) } })}
					/>
				{/if}
				<FieldInput
					field={{
						kind: 'duration',
						name: 'cooldown_secs',
						label: 'Rest after running',
						optional: true
					}}
					value={draft.cooldown_secs}
					onchange={(v) => setField('cooldown_secs', v || undefined)}
				/>
				<FieldInput
					field={{
						kind: 'number',
						name: 'priority',
						label: 'Priority (higher first)',
						min: -1000,
						max: 1000
					}}
					value={draft.priority ?? 0}
					onchange={(v) => setField('priority', Number(v) || 0)}
				/>
				<FieldInput
					field={{ kind: 'text', name: 'tags', label: 'Tags, with commas', optional: true }}
					value={(draft.tags ?? []).join(', ')}
					onchange={(v) =>
						(draft = {
							...draft,
							tags: String(v ?? '')
								.split(',')
								.map((t) => t.trim().toLowerCase())
								.filter(Boolean)
						})}
				/>
				<FieldInput
					field={{ kind: 'bool', name: 'log_events', label: 'Log when its moment comes' }}
					value={draft.log_events}
					onchange={(v) => setField('log_events', v || undefined)}
				/>
				<FieldInput
					field={{ kind: 'bool', name: 'log_triggers', label: 'Log each time it starts' }}
					value={draft.log_triggers}
					onchange={(v) => setField('log_triggers', v || undefined)}
				/>
				<FieldInput
					field={{ kind: 'bool', name: 'log_actions', label: 'Log what it does' }}
					value={draft.log_actions}
					onchange={(v) => setField('log_actions', v || undefined)}
				/>
				<FieldInput
					field={{
						kind: 'text',
						name: 'required_expression',
						label: 'Only while (a script)',
						optional: true,
						long: true
					}}
					value={draft.required_expression}
					onchange={(v) => setField('required_expression', v)}
				/>
				{#if draft.required_expression}
					<FieldInput
						field={{
							kind: 'bool',
							name: 'cancel_on_false',
							label: 'Stop what it’s doing when that stops being true'
						}}
						value={draft.cancel_on_false}
						onchange={(v) => setField('cancel_on_false', v || undefined)}
					/>
				{/if}
				<FieldInput
					field={{
						kind: 'text',
						name: 'trigger_condition',
						label: 'Only when its moment also has (a script)',
						optional: true,
						long: true
					}}
					value={draft.trigger_condition}
					onchange={(v) => setField('trigger_condition', v)}
				/>
				<FieldInput
					field={{
						kind: 'text',
						name: 'trigger_label',
						label: 'Name for its moment, read by scripts as trigger_label()',
						optional: true
					}}
					value={draft.trigger_label}
					onchange={(v) => setField('trigger_label', v)}
				/>
				<FieldInput
					field={{
						kind: 'json',
						name: 'variables',
						label: 'Its own values (JSON)',
						optional: true
					}}
					value={draft.variables && Object.keys(draft.variables).length
						? draft.variables
						: undefined}
					onchange={(v) => setField('variables', v)}
				/>
			</div>
		</details>
	{/if}
</div>

<style>
	.editor {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		max-width: 980px;
	}
	.bar {
		position: sticky;
		top: 0;
		z-index: 3;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		padding: var(--space-2) 0;
		background: var(--bg);
	}
	.tabs {
		display: flex;
		gap: 2px;
		padding: 3px;
		border-radius: 19px;
		background: var(--surface-2);
	}
	.tabs button {
		height: 32px;
		padding: 0 14px;
		border: none;
		border-radius: 16px;
		background: none;
		color: var(--ink-muted);
		font: inherit;
		font-weight: 600;
		font-size: 14px;
	}
	.tabs button[aria-selected='true'] {
		background: var(--surface);
		color: var(--ink);
		box-shadow: var(--shadow);
	}
	.mono {
		font-family: var(--font-num) !important;
		font-size: 13px !important;
	}
	.state {
		flex: 1;
		color: var(--ink-muted);
		font-size: 13px;
	}
	@media (max-width: 499px) {
		.state {
			font-size: 0;
		}
		.plain,
		.go {
			padding: 0 12px;
		}
	}
	.plain,
	.go {
		height: 38px;
		padding: 0 16px;
		border-radius: 19px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 700;
	}
	.go {
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
	button:disabled {
		opacity: 0.5;
	}
	.note {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: 10px;
		background: var(--alert-bg);
		color: var(--alert);
		font-weight: 600;
	}
	.problems {
		margin: 0;
		padding: var(--space-2) var(--space-3) var(--space-2) 30px;
		border-radius: 10px;
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-size: 13.5px;
		font-weight: 600;
	}
	.result {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: var(--space-3) var(--space-4);
		border-radius: 12px;
		background: var(--surface-2);
	}
	.result ol {
		margin: 0;
		padding-left: 18px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		font-size: 14px;
	}
	.result li span + span {
		margin-left: 8px;
	}
	.mark {
		font-weight: 700;
	}
	.mark.good {
		color: light-dark(#2f6b3a, #8fd19e);
	}
	.mark.bad {
		color: var(--alert);
	}
	.link {
		align-self: flex-start;
		border: none;
		background: none;
		padding: 0;
		color: var(--accent);
		font: inherit;
		font-weight: 700;
		font-size: 13px;
	}
	.name {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 12px;
		font-weight: 600;
		color: var(--ink-muted);
	}
	.name input {
		height: 44px;
		padding: 0 12px;
		border-radius: 12px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: 17px;
		font-weight: 600;
	}
	.sentence {
		margin: 0;
		font-size: 16px;
		line-height: 1.5;
		color: var(--ink);
	}
	.part {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	h2 {
		margin: 0 0 2px;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	h2 span {
		text-transform: none;
		letter-spacing: 0;
		font-weight: 500;
	}
	.add {
		align-self: flex-start;
		height: 34px;
		padding: 0 12px;
		border-radius: 17px;
		border: 1px dashed var(--line);
		background: none;
		color: var(--ink-muted);
		font: inherit;
		font-weight: 600;
		font-size: 13px;
	}
	.more {
		padding: var(--space-3) var(--space-4);
		border-radius: 12px;
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	summary {
		cursor: pointer;
		font-weight: 600;
	}
	.fields {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--space-3);
		margin-top: var(--space-3);
	}
	.quiet {
		margin: var(--space-2) 0 0;
		color: var(--ink-muted);
		font-size: 13px;
	}
	.json {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 13px;
		color: var(--ink-muted);
	}
	.json textarea {
		min-height: 420px;
		padding: var(--space-3);
		border-radius: 12px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font-family: var(--font-num);
		font-size: 12.5px;
		line-height: 1.5;
		tab-size: 2;
	}
	em.bad {
		font-style: normal;
		color: var(--alert);
		font-weight: 600;
	}
</style>
