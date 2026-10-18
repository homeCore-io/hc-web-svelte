<!--
	An `import` field (Caséta's, Lutron's integration report): pasted text is
	handed to the plugin's own action, which knows the format, and what it
	returns is added to the tables it names (`targets`) — unsaved, so it can
	be looked over first. Rows already there (by their key) are left as they are.
-->
<script lang="ts">
	import type { Field } from '#lib/descriptor.js';
	import type { FormState } from '#lib/form.svelte.js';
	import { follow, runAction } from '#lib/pluginAdmin.js';

	let { field, form, pluginId }: { field: Field; form: FormState; pluginId: string | undefined } =
		$props();

	let text = $state('');
	let busy = $state(false);
	let note = $state<{ ok: boolean; text: string } | null>(null);

	/** The table fields it may add to, by their key. */
	const tableFor = (key: string) =>
		form.descriptor.sections.flatMap((s) => s.fields).find((f) => f.key === key);

	function add(data: unknown) {
		const out = (data ?? {}) as Record<string, unknown>;
		const counts: string[] = [];
		for (const key of field.targets ?? []) {
			const rows = out[key];
			if (!Array.isArray(rows)) continue;
			const table = tableFor(key);
			const by = table?.key_by;
			const have = Array.isArray(form.draft[key])
				? (form.draft[key] as Record<string, unknown>[])
				: [];
			const fresh = rows.filter(
				(r) =>
					r &&
					typeof r === 'object' &&
					(!by ||
						!have.some(
							(h) => JSON.stringify(h[by]) === JSON.stringify((r as Record<string, unknown>)[by])
						))
			) as Record<string, unknown>[];
			if (fresh.length) form.set(key, [...have, ...fresh]);
			counts.push(`${fresh.length} ${(table?.label ?? key).toLowerCase()}`);
		}
		const summary = typeof out.summary === 'string' ? ` ${out.summary}` : '';
		note = {
			ok: true,
			text: `Added ${counts.join(' and ') || 'nothing'} — look them over, then save.${summary}`
		};
	}

	async function read() {
		if (!pluginId || !field.action || text.trim() === '') return;
		busy = true;
		note = null;
		const r = await runAction(pluginId, field.action, { text });
		if (!r.ok) {
			busy = false;
			note = { ok: false, text: r.error };
			return;
		}
		if (r.data.kind === 'reply') {
			busy = false;
			add((r.data.reply as { data?: unknown }).data ?? r.data.reply);
			return;
		}
		if (r.data.kind === 'busy' || !r.data.request_id) {
			busy = false;
			note = { ok: false, text: 'The plugin is busy with another one; try again in a moment.' };
			return;
		}
		follow(
			pluginId,
			r.data.request_id,
			(e) => {
				if (e.stage === 'complete') add(e.data);
				else if (e.stage === 'error') note = { ok: false, text: e.message };
			},
			() => (busy = false)
		);
	}
</script>

<div class="import">
	<textarea
		bind:value={text}
		rows="5"
		placeholder={field.placeholder ?? 'Paste it here'}
		aria-label={field.label ?? 'Import'}></textarea>
	<div class="acts">
		<button type="button" disabled={busy || text.trim() === '' || !pluginId} onclick={read}
			>{busy ? 'Reading…' : 'Read it'}</button
		>
		{#if note}<span class="note" class:bad={!note.ok} role="status">{note.text}</span>{/if}
	</div>
</div>

<style>
	.import {
		display: flex;
		flex-direction: column;
		gap: 6px;
		width: 100%;
	}
	textarea {
		width: 100%;
		padding: 8px 10px;
		border-radius: 8px;
		border: 1px solid var(--line);
		background: var(--bg);
		color: var(--ink);
		font-family: var(--font-num);
		font-size: 12px;
	}
	.acts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	button {
		height: 34px;
		padding: 0 14px;
		border-radius: 17px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 600;
	}
	button:disabled {
		opacity: 0.5;
	}
	.note {
		font-size: 13px;
		color: var(--ink-muted);
	}
	.note.bad {
		color: var(--alert);
	}
</style>
