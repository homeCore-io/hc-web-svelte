<!--
	A profile itself (Devices over MQTT, screen 6): its text, checked as it is
	typed (a profile that doesn't load says where), tried on a message before
	it is saved, and saved only when it loads. `new` opens a draft from Add an
	ecosystem. Saving applies at once.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { session } from '#lib/me.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { draft } from '#lib/mqttDraft.svelte.js';
	import EcoTabs from '#lib/components/mqtt/EcoTabs.svelte';
	import {
		deleteFile,
		takeShipped,
		ecosystemName,
		loadFile,
		loadOverview,
		saveFile,
		slug,
		tryMessage,
		type HeardTopic,
		type ProfileStatus,
		type TryResult
	} from '#lib/mqttDevices.js';

	const param = $derived(page.params.file ?? '');
	const isNew = $derived(param === 'new');

	let file = $state('');
	let text = $state('');
	let saved = $state('');
	let on = $state(false);
	let status = $state<ProfileStatus | null>(null);
	let failed = $state<string | null>(null);
	let note = $state<string | null>(null);
	let busy = $state(false);
	let heard = $state<HeardTopic[]>([]);
	/** homeCore's profile of this name, to compare a copy with. */
	let shippedText = $state<string | null>(null);
	let comparing = $state(false);

	let topic = $state('');
	let payload = $state('');
	/** Whether the text loads; null while it is being checked. */
	let problem = $state<string | null>(null);
	let result = $state<TryResult | null>(null);

	const name = $derived(status?.name ?? null);
	$effect(() =>
		heading.show(isNew ? 'New ecosystem' : name ? `${ecosystemName(name)} profile` : file, {
			href: name ? `/settings/mqtt/${encodeURIComponent(name)}` : '/settings/mqtt',
			label: name ? ecosystemName(name) : 'Devices over MQTT'
		})
	);

	onMount(() => {
		void (async () => {
			if (isNew) {
				if (!draft.text) return void goto('/settings/mqtt');
				file = draft.file;
				text = draft.text;
				saved = '';
			} else {
				const r = await loadFile(param);
				if (!r.ok) return void (failed = r.error);
				file = r.data.file;
				text = r.data.text;
				saved = r.data.text;
				on = r.data.on;
				status = r.data.status;
				shippedText = r.data.shipped_text ?? null;
			}
			const o = await loadOverview();
			if (o.ok) {
				heard = o.data.heard;
				if (heard[0] && !topic) {
					topic = heard[0].topic;
					payload = heard[0].last_payload;
				}
			}
		})();
	});

	// Check the text, and try it on the message, a moment after each change.
	$effect(() => {
		const t = text;
		const tp = topic;
		const pl = payload;
		if (!t) return;
		const timer = setTimeout(async () => {
			const r = await tryMessage(t, tp, pl);
			if (!r.ok) {
				problem = r.error;
				result = null;
			} else {
				problem = null;
				result = r.data;
			}
		}, 500);
		return () => clearTimeout(timer);
	});

	const changed = $derived(text !== saved);
	const lines = $derived(text.split('\n').length);

	async function save() {
		const target = isNew ? `${slug(file.replace(/\.toml$/, ''))}.toml` : file;
		busy = true;
		const r = await saveFile(target, text);
		busy = false;
		if (!r.ok) return void (note = r.error);
		saved = text;
		note = isNew
			? 'Saved and on.'
			: on
				? 'Saved. It applies now.'
				: 'Saved. It’s off; turn it on to use it.';
		// What it is now: on, its name, as homeCore read it back.
		const back = await loadFile(target);
		if (back.ok) {
			file = back.data.file;
			on = back.data.on;
			shippedText = back.data.shipped_text ?? null;
			status = back.data.status;
		}
		if (isNew) {
			draft.text = '';
			void goto(`/settings/mqtt/files/${encodeURIComponent(target)}`, { replace: true });
		}
	}

	async function takeTheirs() {
		const yes = await ask({
			title: `Take homeCore's ${file}?`,
			body: 'Your copy is replaced with the one this homeCore ships. The devices it names keep their types and names; any other change made to it goes.',
			go: 'Take homeCore\u2019s'
		});
		if (!yes) return;
		busy = true;
		const r = await takeShipped(file);
		busy = false;
		if (!r.ok) return void (note = r.error);
		const back = await loadFile(file);
		if (back.ok) {
			text = back.data.text;
			saved = back.data.text;
			status = back.data.status;
			shippedText = back.data.shipped_text ?? null;
		}
		comparing = false;
		note = 'Now homeCore\u2019s, with your devices. It applies now.';
	}

	async function remove() {
		const yes = await ask({
			title: `Delete ${file}?`,
			body: 'Its devices stay, and stop being updated. A shipped profile can be turned on again from the list; one of your own is gone.',
			go: 'Delete',
			danger: true,
			typed: status?.shipped ? undefined : 'delete'
		});
		if (!yes) return;
		const r = await deleteFile(file);
		if (!r.ok) return void (note = r.error);
		void goto('/settings/mqtt');
	}

	function download() {
		const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
		const a = document.createElement('a');
		a.href = url;
		a.download = isNew ? `${slug(file.replace(/\.toml$/, ''))}.toml` : file;
		a.click();
		URL.revokeObjectURL(url);
	}

	function useHeard(t: string) {
		const h = heard.find((x) => x.topic === t);
		topic = t;
		payload = h?.last_payload ?? '';
	}
</script>

{#if !session.isAdmin}
	<p class="quiet">Devices over MQTT are for the house’s admins.</p>
{:else if failed}
	<p class="quiet">{failed} <a href="/settings/mqtt">All ecosystems</a></p>
{:else if !text && !isNew}
	<p class="quiet">Loading…</p>
{:else}
	<div class="page">
		{#if name && on}<EcoTabs {name} {file} current="profile" />{/if}
		<div class="split">
			{#if isNew}
				<label class="filename"
					>File <input type="text" class="mono" bind:value={file} /><span class="quiet"
						>in the profiles folder</span
					></label
				>
			{:else}
				<p class="lead">
					{status?.shipped ? 'Comes with homeCore, your copy' : 'Yours'} ·
					<span class="mono">{file}</span>{on ? '' : ' · off'}
				</p>
			{/if}
			<div class="row">
				<button type="button" class="btn" onclick={download}>Download</button>
				{#if !isNew}<button type="button" class="btn" onclick={remove}>Delete</button>{/if}
			</div>
		</div>

		{#if status?.differs_from_shipped && shippedText && !isNew}
			<div class="differs">
				<span
					>Your copy differs from the one this homeCore ships, apart from the devices it names:
					homeCore's may have been fixed since it was copied, or it was changed here.</span
				>
				<div class="row">
					<button type="button" class="btn" onclick={() => (comparing = !comparing)}
						>{comparing ? 'Try it' : 'Compare'}</button
					>
					<button type="button" class="done" disabled={busy} onclick={takeTheirs}
						>Take homeCore's, keeping your devices</button
					>
				</div>
			</div>
		{/if}
		{#if problem}
			<div class="problem" role="alert">
				<b>It doesn’t load:</b>
				<span class="mono">{problem}</span>
			</div>
		{/if}
		{#if note}<p class="note" role="status">{note}</p>{/if}

		<div class="work">
			<div class="editor">
				<pre class="gutter" aria-hidden="true">{Array.from({ length: lines }, (_, i) => i + 1).join(
						'\n'
					)}</pre>
				<textarea
					bind:value={text}
					spellcheck="false"
					aria-label="The profile"
					rows={Math.max(18, lines + 1)}></textarea>
			</div>

			{#if comparing && shippedText}
				<section class="theirs" aria-labelledby="theirs-h">
					<h2 id="theirs-h">homeCore's</h2>
					<pre class="mono">{shippedText}</pre>
				</section>
			{:else}
				<section class="try" aria-labelledby="try-h">
					<h2 id="try-h">Try it</h2>
					{#if heard.length > 0}
						<label
							>A topic it heard
							<select value={topic} onchange={(e) => useHeard(e.currentTarget.value)}>
								{#each heard as h (h.topic)}<option value={h.topic}>{h.topic}</option>{/each}
								{#if !heard.some((h) => h.topic === topic)}<option value={topic}
										>{topic || '—'}</option
									>{/if}
							</select>
						</label>
					{/if}
					<label>A topic<input type="text" class="mono" bind:value={topic} /></label>
					<label>Its message<textarea class="mono" rows="3" bind:value={payload}></textarea></label>
					<div class="out" aria-live="polite">
						<p class="over">homeCore would make</p>
						{#if problem}
							<p class="quiet">Nothing until the profile loads.</p>
						{:else if !result}
							<p class="quiet">…</p>
						{:else if result.kind === 'state'}
							<p>
								<span class="mono">{result.device_id}</span>{#if result.device_type}, a {result.device_type.replace(
										/_/g,
										' '
									)}{:else}, with no type (no controls){/if}{#if result.name}
									called “{result.name}”{/if}
							</p>
							<pre class="mono state">{JSON.stringify(result.state, null, 1)}</pre>
							{#if result.partial}<p class="quiet">Merged into what it already reports.</p>{/if}
						{:else if result.kind === 'availability'}
							<p>
								<span class="mono">{result.device_id}</span>
								{result.available ? 'online' : 'offline'}
							</p>
						{:else if result.kind === 'no_match'}
							<p class="quiet">Nothing: no topic in the profile matches this one.</p>
						{:else}
							<p class="error">{result.error}</p>
						{/if}
					</div>
				</section>
			{/if}
		</div>

		<div class="split">
			<span class="quiet">Saving checks it first, and applies it at once. Nothing restarts.</span>
			<div class="row">
				{#if !isNew}<button
						type="button"
						class="btn"
						disabled={!changed}
						onclick={() => (text = saved)}>Discard changes</button
					>{/if}
				<button
					type="button"
					class="done"
					disabled={busy || !!problem || (!changed && !isNew)}
					onclick={save}>{busy ? 'Saving…' : 'Save'}</button
				>
			</div>
		</div>
	</div>
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		max-width: 1100px;
	}
	.lead {
		margin: 0;
		color: var(--ink-muted);
	}
	.split {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 8px 12px;
	}
	.row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.filename {
		display: flex;
		align-items: center;
		gap: 8px;
		font-weight: 700;
	}
	.filename input {
		min-height: 40px;
		padding: 0 10px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
	}
	.mono {
		font-family: var(--font-num);
		font-size: 13px;
	}
	.differs {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 10px 16px;
		padding: 12px 16px;
		border-radius: var(--radius);
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-weight: 600;
	}
	.differs > span {
		flex: 1 1 360px;
	}
	.theirs {
		flex: 1 1 360px;
		min-width: 0;
		padding: 16px;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.theirs h2 {
		margin: 0 0 8px;
		font-size: 17px;
	}
	.theirs pre {
		margin: 0;
		max-height: 640px;
		overflow: auto;
		white-space: pre;
		line-height: 20px;
	}
	.problem {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 12px 16px;
		border-radius: var(--radius);
		background: var(--alert-bg);
		border: 1px solid var(--alert-line);
		color: var(--alert);
	}
	.problem .mono {
		white-space: pre-wrap;
		color: var(--ink);
	}
	.note {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: 10px;
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-weight: 600;
	}
	.work {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		align-items: flex-start;
	}
	.editor {
		flex: 999 1 480px;
		min-width: 0;
		display: flex;
		border-radius: var(--radius);
		background: #12161c;
		overflow: auto;
	}
	.gutter {
		margin: 0;
		padding: 14px 10px 14px 14px;
		color: #6b7480;
		text-align: right;
		user-select: none;
		font-family: var(--font-num);
		font-size: 13px;
		line-height: 20px;
	}
	.editor textarea {
		flex: 1;
		min-width: 0;
		padding: 14px 14px 14px 4px;
		border: none;
		outline: none;
		resize: none;
		background: transparent;
		color: #e9edf2;
		font-family: var(--font-num);
		font-size: 13px;
		line-height: 20px;
		white-space: pre;
		overflow: hidden;
	}
	.try {
		flex: 1 1 300px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding: 16px;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	.try h2 {
		margin: 0;
		font-size: 17px;
	}
	.try label {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 13px;
		font-weight: 700;
	}
	.try input,
	.try select,
	.try textarea {
		padding: 8px 10px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font-weight: 400;
	}
	.out {
		border-top: 1px solid var(--line);
		padding-top: 10px;
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 14px;
	}
	.out p {
		margin: 0;
	}
	.over {
		font-weight: 700;
	}
	.state {
		margin: 0;
		padding: 8px 10px;
		border-radius: 8px;
		background: var(--bg);
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}
	.error {
		color: var(--alert);
	}
	.btn,
	.done {
		min-height: 40px;
		padding: 0 16px;
		border-radius: 10px;
		font: inherit;
		font-weight: 700;
		font-size: 14px;
		cursor: pointer;
	}
	.btn {
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
	}
	.done {
		border: 1px solid var(--accent);
		background: var(--accent);
		color: var(--accent-ink);
	}
	button:disabled {
		opacity: 0.55;
		cursor: default;
	}
	.quiet {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
</style>
