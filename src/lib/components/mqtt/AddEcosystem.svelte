<!--
	Add an ecosystem of your own (Devices over MQTT, screen 7): drafted from a
	topic the broker carries, from a commented template, or from a profile
	someone shared. It opens in the editor, and takes effect when saved there.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { draft } from '#lib/mqttDraft.svelte.js';
	import { deviceOf, draftProfile, guessPattern, slug, type HeardTopic } from '#lib/mqttDevices.js';

	let {
		heard,
		topic: startTopic = null,
		close
	}: {
		/** Topics no ecosystem takes in, to draft from. */
		heard: HeardTopic[];
		/** One to start from. */
		topic?: string | null;
		close: () => void;
	} = $props();

	let dialog = $state<HTMLDialogElement>();
	onMount(() => dialog?.showModal());

	// Read once, when the dialog opens.
	const first = (() => startTopic ?? heard[0]?.topic ?? null)();
	let from = $state<'topic' | 'blank' | 'file'>((() => (first ? 'topic' : 'blank'))());
	let topic = $state(first ?? '');
	let name = $state(first ? slug(first.split('/')[0] ?? '') : '');
	let prefix = $state(first ? `${slug(first.split('/')[0] ?? '').replace(/-/g, '_')}_` : '');
	let pattern = $state(first ? guessPattern(first) : '');
	let shared = $state<{ file: string; text: string } | null>(null);
	let error = $state<string | null>(null);

	const heardOne = $derived(heard.find((h) => h.topic === topic) ?? null);
	const matches = $derived(
		pattern ? heard.map((h) => deviceOf(pattern, h.topic)).filter((d): d is string => !!d) : []
	);

	function pick(t: string) {
		topic = t;
		const root = slug(t.split('/')[0] ?? '');
		name = root;
		prefix = `${root.replace(/-/g, '_')}_`;
		pattern = guessPattern(t);
	}

	async function readFile(e: Event) {
		const f = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!f) return;
		shared = { file: f.name.endsWith('.toml') ? f.name : `${f.name}.toml`, text: await f.text() };
	}

	function draftIt() {
		error = null;
		if (from === 'file') {
			if (!shared) return void (error = 'Choose a profile file first.');
			draft.file = slug(shared.file.replace(/\.toml$/, '')) + '.toml';
			draft.text = shared.text;
		} else {
			const n = slug(name);
			if (!n) return void (error = 'Give it a name.');
			if (!prefix.trim()) return void (error = 'Say what its devices’ IDs start with.');
			if (!pattern.includes('{'))
				return void (error = 'Put {device} where the topic names the device.');
			draft.file = `${n}.toml`;
			draft.text = draftProfile({
				name: n,
				prefix: prefix.trim(),
				pattern: from === 'topic' ? pattern.trim() : pattern.trim() || `${n}/{device}/state`,
				payload: from === 'topic' ? heardOne?.last_payload : undefined
			});
		}
		dialog?.close();
		void goto('/settings/mqtt/files/new');
	}
</script>

<dialog
	bind:this={dialog}
	aria-labelledby="add-eco-title"
	onclose={close}
	onclick={(e) => {
		if (e.target === dialog) dialog?.close();
	}}
>
	<div class="box">
		<header>
			<h2 id="add-eco-title">Add an ecosystem</h2>
			<p>Devices that talk MQTT in a way homeCore doesn’t know yet.</p>
		</header>

		<fieldset class="from">
			<legend>Start from</legend>
			<label class:on={from === 'topic'}>
				<input type="radio" bind:group={from} value="topic" disabled={heard.length === 0} />
				<span><b>A topic it heard</b><span>homeCore drafts it from a real message</span></span>
			</label>
			<label class:on={from === 'blank'}>
				<input type="radio" bind:group={from} value="blank" />
				<span><b>Blank</b><span>A commented template</span></span>
			</label>
			<label class:on={from === 'file'}>
				<input type="radio" bind:group={from} value="file" />
				<span><b>A file</b><span>A profile someone shared</span></span>
			</label>
		</fieldset>

		{#if from === 'topic'}
			<div class="heard">
				<p class="over">Heard on the broker</p>
				{#each heard.slice(0, 8) as h (h.topic)}
					<label
						><input
							type="radio"
							name="topic"
							checked={topic === h.topic}
							onchange={() => pick(h.topic)}
						/><span class="mono">{h.topic}</span><span class="quiet">· {h.count}</span></label
					>
				{/each}
				{#if heardOne}<p class="mono last">last message: {heardOne.last_payload}</p>{/if}
			</div>
		{/if}

		{#if from === 'file'}
			<label class="field"
				>Profile file
				<input type="file" accept=".toml,text/plain" onchange={readFile} />
				{#if shared}<span class="hint">{shared.file}, ready to open in the editor</span>{/if}
			</label>
		{:else}
			<div class="grid">
				<label class="field"
					>Name<input type="text" bind:value={name} /><span class="hint"
						>One word; also the file’s name</span
					></label
				>
				<label class="field"
					>Device IDs start with<input type="text" bind:value={prefix} /><span class="hint mono"
						>{prefix}{matches[0] ?? 'kitchen'}</span
					></label
				>
				<label class="field wide"
					>Topic pattern<input
						type="text"
						bind:value={pattern}
						placeholder="myfw/{'{device}'}/status"
					/><span class="hint"
						>The part in braces names the device.{#if from === 'topic'}
							{matches.length === 1
								? `1 device matches now: ${matches[0]}`
								: `${matches.length} devices match now`}{/if}</span
					></label
				>
			</div>
		{/if}

		{#if error}<p class="error" role="alert">{error}</p>{/if}

		<div class="actions">
			<span class="quiet">Opens in the editor; it takes effect when you save it.</span>
			<button type="button" class="plain" onclick={() => dialog?.close()}>Cancel</button>
			<button type="button" class="done" onclick={draftIt}>Draft it</button>
		</div>
	</div>
</dialog>

<style>
	dialog {
		width: min(640px, calc(100vw - 32px));
		max-height: calc(100vh - 64px);
		padding: 0;
		border: none;
		border-radius: var(--radius);
		background: var(--sheet);
		color: var(--ink);
	}
	dialog::backdrop {
		background: var(--scrim);
	}
	.box {
		display: flex;
		flex-direction: column;
		gap: 18px;
		padding: 22px;
	}
	h2 {
		margin: 0;
		font-size: 22px;
	}
	header p {
		margin: 6px 0 0;
		color: var(--ink-muted);
	}
	.from {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 8px;
		margin: 0;
		padding: 0;
		border: none;
	}
	.from legend {
		margin-bottom: 8px;
		font-weight: 700;
	}
	.from label {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		padding: 12px;
		border: 1px solid var(--line);
		border-radius: 12px;
		background: var(--surface);
		cursor: pointer;
	}
	.from label.on {
		border-color: var(--accent);
		box-shadow: inset 0 0 0 1px var(--accent);
	}
	.from input {
		accent-color: var(--accent);
		margin-top: 3px;
	}
	.from span {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.from span span {
		font-size: 13px;
		color: var(--ink-muted);
	}
	.heard {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 12px 14px;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.heard label {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 32px;
	}
	.over {
		margin: 0;
		font-size: 13px;
		font-weight: 700;
		color: var(--ink-muted);
	}
	.mono {
		font-family: var(--font-num);
		font-size: 13px;
		overflow-wrap: anywhere;
	}
	.last {
		margin: 4px 0 0;
		padding: 6px 8px;
		border-radius: 8px;
		background: var(--bg);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 14px;
	}
	.wide {
		grid-column: 1 / -1;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-weight: 700;
		font-size: 14px;
	}
	.field input[type='text'] {
		min-height: var(--target);
		padding: 0 12px;
		border-radius: 11px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font-family: var(--font-num);
		font-size: 14px;
	}
	.hint {
		font-weight: 400;
		font-size: 13px;
		color: var(--ink-muted);
	}
	.quiet {
		font-size: 13px;
		color: var(--ink-muted);
	}
	.error {
		margin: 0;
		padding: 10px 12px;
		border-radius: 10px;
		background: var(--alert-bg);
		color: var(--alert);
		font-weight: 600;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: flex-end;
		gap: 10px;
	}
	.actions .quiet {
		flex: 1 1 200px;
	}
	.actions button {
		min-height: var(--target);
		padding: 0 18px;
		border-radius: 11px;
		font: inherit;
		font-weight: 700;
	}
	.plain {
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
	}
	.done {
		border: 1px solid var(--accent);
		background: var(--accent);
		color: var(--accent-ink);
	}
</style>
