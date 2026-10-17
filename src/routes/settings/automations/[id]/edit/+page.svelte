<!--
	Changing a rule (A3): the editor on a draft of it. The draft is kept
	until saved or discarded; if someone else changes the rule meanwhile,
	this says so before anything is overwritten.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { session } from '#lib/me.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { live } from '#lib/live.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import type { Rule } from '#lib/ruleWords.js';
	import { loadRules, modeMade, saveRule } from '#lib/ruleAdmin.js';
	import { dropDraft, keepDraft, readDraft, same } from '#lib/ruleDraft.js';
	import RuleEditor from '#lib/components/rules/RuleEditor.svelte';

	const id = $derived(page.params.id ?? '');
	const back = $derived(`/settings/automations/${encodeURIComponent(id)}`);

	let rules = $state<Rule[]>([]);
	let saved = $state<Rule | null>(null);
	let draft = $state<Rule | null>(null);
	let failed = $state<string | null>(null);
	let madeBy = $state<string | undefined>(undefined);
	let restored = $state(false);
	let theirs = $state<Rule | null>(null);
	let gone = $state(false);
	let busy = $state(false);
	let note = $state<string | null>(null);

	onMount(() => {
		void (async () => {
			const [res, made] = await Promise.all([loadRules(), modeMade()]);
			if (!res.ok) return void (failed = res.error);
			rules = res.data;
			saved = res.data.find((r) => r.id === id) ?? null;
			madeBy = made[id];
			if (!saved) return;
			const kept = readDraft(id);
			if (kept && same(kept.base, saved) && !same(kept.draft, saved)) {
				draft = kept.draft;
				restored = true;
			} else draft = $state.snapshot(saved) as Rule;
		})();
		return live.listen((frame) => {
			const f = frame as { type: string; rule?: Rule; rule_id?: string };
			if (f.type === 'rule_changed' && f.rule?.id === id && saved && !same(f.rule, saved))
				theirs = f.rule;
			if (f.type === 'rule_removed' && f.rule_id === id) gone = true;
		});
	});

	$effect(() =>
		heading.show(draft?.name ? `Change “${draft.name}”` : 'Change a rule', {
			href: back,
			label: saved?.name ?? 'Automation'
		})
	);

	// Keep the draft while it differs from what's saved.
	$effect(() => {
		if (!draft || !saved) return;
		const snap = $state.snapshot(draft) as Rule;
		if (same(snap, saved)) dropDraft(id);
		else keepDraft(id, { base: saved, draft: snap });
	});

	async function save() {
		if (!draft) return;
		if (theirs || gone) {
			const yes = await ask({
				title: gone ? 'Save it again?' : 'Replace their change?',
				body: gone
					? 'Someone deleted this rule while you were changing it. Saving puts it back as you have it.'
					: 'Someone else saved this rule while you were changing it. Saving replaces their version with yours.',
				go: gone ? 'Save it' : 'Replace theirs',
				danger: !gone
			});
			if (!yes) return;
		}
		busy = true;
		const res = await saveRule($state.snapshot(draft) as Rule);
		busy = false;
		if (!res.ok) return void (note = res.error);
		dropDraft(id);
		void goto(back);
	}

	async function discard() {
		if (draft && saved && !same($state.snapshot(draft), saved)) {
			const yes = await ask({
				title: 'Discard your changes?',
				lost: ['Everything changed since it was last saved.'],
				go: 'Discard',
				danger: true
			});
			if (!yes) return;
		}
		dropDraft(id);
		void goto(back);
	}

	function takeTheirs() {
		if (!theirs) return;
		saved = theirs;
		draft = $state.snapshot(theirs) as Rule;
		theirs = null;
		restored = false;
	}
</script>

{#if !session.can('automations:write')}
	<p class="quiet">Settings are for people who may change the house.</p>
{:else if failed}
	<p class="quiet">{failed}</p>
{:else if saved === null && draft === null && rules.length > 0}
	<p class="quiet">There’s no such rule. <a href="/settings/automations">All automations</a></p>
{:else if madeBy}
	<p class="quiet">
		{madeBy}’s definition made this rule and changes it. Change it in
		<a href="/settings/modes">Modes</a>.
	</p>
{:else if draft}
	<RuleEditor bind:draft {saved} {rules} {busy} {note} onsave={save} ondiscard={discard}>
		{#snippet banner()}
			{#if restored}
				<p class="banner lit">
					This is the draft you left. <button
						type="button"
						onclick={() => ((draft = $state.snapshot(saved!) as Rule), (restored = false))}
						>Start again from the saved rule</button
					>
				</p>
			{/if}
			{#if theirs}
				<p class="banner bad">
					Someone else just saved a change to this rule. Saving yours replaces it.
					<button type="button" onclick={takeTheirs}>Take theirs instead</button>
				</p>
			{/if}
			{#if gone}<p class="banner bad">Someone deleted this rule while you were changing it.</p>{/if}
		{/snippet}
	</RuleEditor>
{:else}
	<p class="quiet">Loading…</p>
{/if}

<style>
	.quiet {
		color: var(--ink-muted);
	}
	.banner {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		margin: 0;
		padding: 10px 14px;
		border-radius: 12px;
		font-weight: 600;
	}
	.banner.lit {
		background: var(--lit-bg);
		color: var(--lit-ink);
	}
	.banner.bad {
		background: var(--alert-bg);
		color: var(--alert);
	}
	.banner button {
		border: none;
		background: none;
		padding: 0;
		color: inherit;
		font: inherit;
		text-decoration: underline;
	}
</style>
