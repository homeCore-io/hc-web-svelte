<!--
	A plugin action (A4): what it asks for, then — for one that talks back —
	what it's doing, what it found, a question when it has one, and Cancel.
	Leaving the page doesn't stop it; coming back picks it up again.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { ask } from '#lib/confirm.svelte.js';
	import {
		resultLines,
		dangerous,
		finished,
		paramDefaults,
		paramFields,
		runAfter,
		startRun,
		type PluginAction,
		type Run
	} from '#lib/plugins.js';
	import { answerAction, cancelAction, follow, runAction } from '#lib/pluginAdmin.js';
	import FieldInput from '#lib/components/rules/FieldInput.svelte';

	let {
		pluginId,
		pluginName,
		action
	}: { pluginId: string; pluginName: string; action: PluginAction } = $props();

	const fields = $derived(paramFields(action));
	let values = $state<Record<string, unknown>>(untrack(() => paramDefaults(action)));
	let run = $state<Run | null>(null);
	let requestId = $state<string | null>(null);
	let reply = $state<string | null>(null);
	let trouble = $state<string | null>(null);
	let busy = $state(false);
	let answer = $state<Record<string, unknown>>({});
	let stop: (() => void) | null = null;

	// A run in flight is remembered for this tab, so coming back follows it.
	const memo = $derived(`hc.pluginRun.${pluginId}.${action.id}`);
	const remember = (id: string | null) => {
		try {
			if (id) sessionStorage.setItem(memo, id);
			else sessionStorage.removeItem(memo);
		} catch {
			// The run still shows while the page is open.
		}
	};
	onMount(() => {
		let kept: string | null = null;
		try {
			kept = sessionStorage.getItem(memo);
		} catch {
			kept = null;
		}
		if (kept) listen(kept);
		return () => stop?.();
	});

	function listen(id: string) {
		requestId = id;
		run = startRun();
		stop?.();
		stop = follow(
			pluginId,
			id,
			(e) => (run = runAfter(run ?? startRun(), e, action.item_key ?? 'id')),
			() => {
				if (run && finished(run)) remember(null);
			}
		);
	}

	async function start() {
		trouble = null;
		reply = null;
		if (dangerous(action)) {
			const yes = await ask({
				title: `${action.label}?`,
				body: action.description,
				go: action.label,
				danger: true
			});
			if (!yes) return;
		}
		busy = true;
		const res = await runAction(pluginId, action.id, $state.snapshot(values));
		busy = false;
		if (!res.ok) return void (trouble = res.error);
		const d = res.data;
		if (d.kind === 'busy') {
			trouble = `${pluginName} is already doing this.`;
			if (d.request_id) listen(d.request_id);
			return;
		}
		if (d.kind === 'reply') {
			reply = summary(d.reply);
			return;
		}
		remember(d.request_id);
		listen(d.request_id);
	}

	function summary(r: Record<string, unknown>): string {
		const { request_id: _r, status: _s, ...rest } = r;
		const msg = rest.message ?? rest.result;
		if (typeof msg === 'string') return msg;
		return Object.keys(rest).length ? JSON.stringify(rest.data ?? rest, null, 1) : 'Done.';
	}

	async function cancel() {
		if (!requestId) return;
		const res = await cancelAction(pluginId, requestId);
		if (!res.ok) trouble = res.error;
	}

	async function send() {
		if (!requestId) return;
		// An unticked box is an answer: no.
		const bools = (run?.prompt?.fields ?? [])
			.filter((f) => f.kind === 'bool')
			.map((f) => [f.name, false]);
		const res = await answerAction(pluginId, requestId, {
			...Object.fromEntries(bools),
			...$state.snapshot(answer)
		});
		if (!res.ok) trouble = res.error;
		else answer = {};
	}

	const again = () => {
		run = null;
		requestId = null;
		remember(null);
	};
	const items = $derived(run ? Object.entries(run.items) : []);
	const STATE: Record<Run['state'], string> = {
		running: 'Working…',
		waiting: 'Waiting for you',
		done: 'Done',
		failed: 'Didn’t work',
		canceled: 'Cancelled',
		'timed out': 'Took too long'
	};
</script>

<div class="action">
	{#if !run}
		{#if fields.length}
			<div class="fields">
				{#each fields as f (f.name)}
					<FieldInput
						field={f}
						value={values[f.name]}
						onchange={(v) => (values = { ...values, [f.name]: v })}
					/>
				{/each}
			</div>
		{/if}
		<button
			type="button"
			class="go"
			class:danger={dangerous(action)}
			disabled={busy}
			onclick={start}>{busy ? 'Starting…' : action.stream ? 'Start' : 'Run'}</button
		>
	{:else}
		<div class="state" role="status">
			<strong
				class:live={!finished(run)}
				class:bad={run.state === 'failed' || run.state === 'timed out'}>{STATE[run.state]}</strong
			>
			{#if run.percent !== undefined && !finished(run)}
				<span class="bar" aria-label={`${Math.round(run.percent)} %`}
					><span style={`width:${Math.max(2, Math.min(100, run.percent))}%`}></span></span
				>
			{/if}
			{#if !finished(run) && action.cancelable}<button type="button" class="plain" onclick={cancel}
					>Cancel</button
				>{/if}
			{#if finished(run)}<button type="button" class="plain" onclick={again}>Again</button>{/if}
		</div>
		{#if run.lines.length}
			<ol class="log">
				{#each run.lines as l, i (i)}<li class={l.tone}>
						<span class="at">{l.at}</span>{l.text}
					</li>{/each}
			</ol>
		{/if}
		{#if run.prompt}
			<div class="prompt">
				<strong>{run.prompt.text}</strong>
				<div class="fields">
					{#each run.prompt.fields as f (f.name)}
						<FieldInput
							field={f}
							value={answer[f.name]}
							onchange={(v) => (answer = { ...answer, [f.name]: v })}
						/>
					{/each}
				</div>
				<button
					type="button"
					class="go"
					disabled={run.prompt.required.some(
						(r) =>
							run?.prompt?.fields.find((f) => f.name === r)?.kind !== 'bool' &&
							(answer[r] === undefined || answer[r] === '')
					)}
					onclick={send}>Send</button
				>
			</div>
		{/if}
		{#if items.length}
			<div class="items">
				<strong>{run.state === 'running' ? 'So far' : 'Found'}</strong>
				<ul>
					{#each items as [k, it] (k)}
						<li>
							{typeof it.name === 'string'
								? it.name
								: typeof it.label === 'string'
									? it.label
									: k}{#if typeof it.status === 'string'}<span> · {it.status}</span>{/if}
						</li>
					{/each}
				</ul>
			</div>
		{/if}
		{#if finished(run) && resultLines(run.result).length}
			<dl class="result">
				{#each resultLines(run.result) as l (l.label)}<dt>{l.label}</dt>
					<dd>{l.value}</dd>{/each}
			</dl>
		{/if}
		{#if !finished(run)}<p class="quiet">
				You can leave this page: it keeps going, and comes back here when you do.
			</p>{/if}
	{/if}
	{#if reply}<pre class="reply">{reply}</pre>{/if}
	{#if trouble}<p class="trouble" role="alert">{trouble}</p>{/if}
</div>

<style>
	.action {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--space-2);
		width: 100%;
	}
	.fields {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--space-3);
	}
	.go,
	.plain {
		height: 36px;
		padding: 0 16px;
		border-radius: 18px;
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
		font: inherit;
		font-weight: 700;
	}
	.go.danger {
		background: var(--alert);
		color: var(--alert-ink);
	}
	.plain {
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
	}
	button:disabled {
		opacity: 0.5;
	}
	.state {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: var(--space-3);
		width: 100%;
	}
	.state strong.bad {
		color: var(--alert);
	}
	.live {
		animation: pulse 1.4s ease-in-out infinite;
	}
	@keyframes pulse {
		50% {
			opacity: 0.45;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.live {
			animation: none;
		}
	}
	.bar {
		flex: 1 1 160px;
		max-width: 320px;
		height: 6px;
		border-radius: 3px;
		background: var(--surface-2);
		overflow: hidden;
	}
	.bar span {
		display: block;
		height: 100%;
		background: var(--accent);
		transition: width var(--quick);
	}
	.log {
		list-style: none;
		margin: 0;
		padding: var(--space-2) var(--space-3);
		width: 100%;
		max-height: 260px;
		overflow: auto;
		border-radius: 10px;
		background: var(--surface-2);
		font-size: 13.5px;
		line-height: 1.6;
	}
	.at {
		display: inline-block;
		width: 70px;
		color: var(--ink-muted);
		font-family: var(--font-num);
		font-size: 12px;
	}
	.log .warn {
		color: var(--lit-ink);
	}
	.log .bad {
		color: var(--alert);
		font-weight: 600;
	}
	.log .good {
		font-weight: 600;
	}
	.prompt,
	.items {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		width: 100%;
		padding: var(--space-3);
		border-radius: 10px;
		border: 1px solid var(--accent);
	}
	.items {
		border-color: var(--card-line);
	}
	.items ul {
		margin: 0;
		padding-left: 18px;
	}
	.items span {
		color: var(--ink-muted);
	}
	.reply {
		margin: 0;
		max-width: 100%;
		white-space: pre-wrap;
		overflow-wrap: anywhere;
		font-family: var(--font-num);
		font-size: 12.5px;
	}
	.quiet {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
	.trouble {
		margin: 0;
		color: var(--alert);
		font-weight: 600;
	}
	.result {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: 4px 12px;
		margin: 0;
		padding: 10px 12px;
		border-radius: 10px;
		background: var(--surface-2);
		font-size: 13px;
	}
	.result dt {
		color: var(--ink-muted);
	}
	.result dd {
		margin: 0;
		overflow-wrap: anywhere;
	}
</style>
