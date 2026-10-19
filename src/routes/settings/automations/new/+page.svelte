<!--
	A new automation (A3, E5): start from what you want to happen — one of
	the patterns drawn from the house's own rules — or from nothing; or
	combine a family of rules into one (E4). Then the editor.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { session } from '#lib/me.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { scenes } from '#lib/scenes.svelte.js';
	import { plain, sentence, type Rule } from '#lib/ruleWords.js';
	import { familiesOf, houseOf } from '#lib/ruleList.js';
	import { describeStep } from '#lib/pluginUi/describe.js';
	import { blankRule, featuresOf, type Features } from '#lib/ruleEdit.js';
	import { PATTERNS, combine } from '#lib/ruleCombine.js';
	import { createRule, loadRules, loadVocabulary, setManyEnabled } from '#lib/ruleAdmin.js';
	import { dropDraft, keepDraft, readDraft } from '#lib/ruleDraft.js';
	import RuleEditor from '#lib/components/rules/RuleEditor.svelte';

	const params = $derived(page.url.searchParams);
	const pattern = $derived(params.get('pattern'));
	const combineIds = $derived(params.get('combine')?.split(',').filter(Boolean) ?? []);
	const keepKey = $derived(combineIds.length ? `combine:${combineIds.join(',')}` : 'new');

	let rules = $state<Rule[]>([]);
	let features = $state<Features | null>(null);
	let draft = $state<Rule | null>(null);
	let members = $state<Rule[]>([]);
	let why = $state<string | null>(null);
	let busy = $state(false);
	let note = $state<string | null>(null);

	onMount(async () => {
		const [res, vocab] = await Promise.all([loadRules(), loadVocabulary()]);
		if (res.ok) rules = res.data;
		features = featuresOf(vocab);
	});

	// What to start from, once the rules and homeCore's features are known.
	$effect(() => {
		if (!features || draft) return;
		const kept = readDraft(keepKey);
		if (combineIds.length) {
			const chosen = rules.filter((r) => combineIds.includes(r.id));
			if (chosen.length < 2) return;
			const family = familiesOf(rules).get(chosen[0]!.id);
			const done = combine(chosen, family?.label ?? chosen[0]!.name, features);
			if ('reason' in done) return void (why = done.reason);
			members = done.members;
			draft = kept?.draft ?? done.rule;
		} else if (pattern !== null) {
			draft = kept?.draft ?? PATTERNS.find((p) => p.id === pattern)?.draft() ?? blankRule();
		}
	});

	$effect(() => {
		if (draft) keepDraft(keepKey, { base: null, draft: $state.snapshot(draft) as Rule });
	});

	$effect(() =>
		heading.show(combineIds.length ? 'Combine rules' : draft?.name || 'New automation', {
			href: '/settings/automations',
			label: 'Automations'
		})
	);

	const house = $derived(houseOf(devices.byId, scenes.list, rules, [], describeStep));
	const kept = $derived(readDraft('new'));

	async function save() {
		if (!draft) return;
		busy = true;
		const res = await createRule($state.snapshot(draft) as Rule);
		if (!res.ok) {
			busy = false;
			return void (note = res.error);
		}
		if (members.length) {
			const off = await setManyEnabled(
				members.map((m) => m.id),
				false
			);
			if (!off.ok) note = `Saved, but the rules it replaces are still on: ${off.error}`;
		}
		busy = false;
		dropDraft(keepKey);
		void goto(`/settings/automations/${encodeURIComponent(res.data.id)}`);
	}

	async function discard() {
		const yes = await ask({
			title: 'Discard this automation?',
			lost: ['Everything in it — it was never saved.'],
			go: 'Discard',
			danger: true
		});
		if (!yes) return;
		dropDraft(keepKey);
		void goto(combineIds.length ? '/settings/automations?show=families' : '/settings/automations');
	}
</script>

{#if !session.can('automations:write')}
	<p class="quiet">Settings are for people who may change the house.</p>
{:else if why}
	<div class="page">
		<p class="banner bad">{why}</p>
		<a href="/settings/automations?show=families">Back to the families</a>
	</div>
{:else if draft}
	<RuleEditor bind:draft saved={null} {rules} {busy} {note} onsave={save} ondiscard={discard}>
		{#snippet banner()}
			{#if members.length}
				<div class="banner lit">
					<strong>Combines {members.length} rules into one.</strong>
					<span
						>They keep running until you save. Saving turns them off and keeps them, so you can go
						back.</span
					>
					<ul>
						{#each members as m (m.id)}<li>
								<a href={`/settings/automations/${encodeURIComponent(m.id)}`}>{m.name}</a> — {plain(
									sentence(house, m)
								)}
							</li>{/each}
					</ul>
				</div>
			{/if}
		{/snippet}
	</RuleEditor>
{:else if combineIds.length || pattern !== null}
	<p class="quiet">Loading…</p>
{:else}
	<div class="page">
		<p class="lead">
			Start from what you want to happen. Each fills in an automation you can change.
		</p>
		{#if kept}
			<a class="resume" href="/settings/automations/new?pattern="
				>Carry on with “{kept.draft.name || 'the automation you started'}”</a
			>
		{/if}
		<div class="patterns">
			{#each PATTERNS as p (p.id)}
				{@const like = rules.filter((r) => p.like.test(r.name)).length}
				<a href={`/settings/automations/new?pattern=${p.id}`} onclick={() => dropDraft('new')}>
					<strong>{p.name}</strong>
					<span>{p.what}</span>
					<em>{p.example}</em>
					{#if like > 1}<small>Like {like} of your rules</small>{/if}
				</a>
			{/each}
			<a
				href="/settings/automations/new?pattern=blank"
				class="blank"
				onclick={() => dropDraft('new')}
			>
				<strong>Start from nothing</strong>
				<span>When, only if, do — built step by step</span>
			</a>
		</div>
	</div>
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		max-width: 980px;
	}
	.lead {
		margin: 0;
		font-size: 16px;
	}
	.quiet {
		color: var(--ink-muted);
	}
	.resume {
		align-self: flex-start;
		color: var(--accent);
		font-weight: 700;
	}
	.patterns {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
		gap: var(--space-3);
	}
	.patterns a {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: var(--space-4);
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		color: var(--ink);
		text-decoration: none;
	}
	.patterns a:hover {
		border-color: var(--accent);
	}
	.patterns strong {
		font-size: 16px;
	}
	.patterns span {
		color: var(--ink-muted);
		line-height: 1.45;
	}
	.patterns em {
		font-style: normal;
		font-size: 13px;
	}
	.patterns small {
		color: var(--lit-ink);
		font-weight: 700;
	}
	.patterns .blank {
		border-style: dashed;
		background: none;
	}
	.banner {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin: 0;
		padding: 10px 14px;
		border-radius: 12px;
	}
	.banner.lit {
		background: var(--lit-bg);
		color: var(--lit-ink);
	}
	.banner.bad {
		background: var(--alert-bg);
		color: var(--alert);
		font-weight: 600;
	}
	.banner ul {
		margin: 4px 0 0;
		padding-left: 18px;
		color: var(--ink);
		font-size: 13px;
	}
	.banner a {
		color: inherit;
		font-weight: 700;
	}
</style>
