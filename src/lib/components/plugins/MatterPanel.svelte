<!--
	Matter (A4): the devices the Matter controller has commissioned, and
	adding one with its setup passcode. homeCore passes these to the plugin;
	what it does next shows as devices, and in its log.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { ask } from '#lib/confirm.svelte.js';
	import {
		commission,
		matterNodes,
		reinterview,
		removeNode,
		type MatterNode
	} from '#lib/pluginAdmin.js';

	let nodes = $state<MatterNode[] | null>(null);
	let note = $state<string | null>(null);
	let passcode = $state('');
	let discriminator = $state('');
	const load = async () => {
		const r = await matterNodes();
		nodes = r.ok ? (Array.isArray(r.data.nodes) ? r.data.nodes : []) : [];
		if (!r.ok) note = r.error;
	};
	onMount(load);

	const code = $derived(Number(passcode.replace(/\D/g, '')));
	async function add() {
		const d = discriminator.trim() === '' ? undefined : Number(discriminator);
		const r = await commission(code, d);
		note = r.ok
			? 'Sent. Put the device in pairing mode; it appears in Devices when it’s added.'
			: r.error;
		passcode = '';
		discriminator = '';
		setTimeout(load, 5000);
	}
	async function drop(n: MatterNode) {
		const yes = await ask({
			title: `Remove ${n.name ?? `node ${n.node_id}`} from Matter?`,
			lost: ['It leaves the house’s Matter network; adding it again needs its setup code.'],
			go: 'Remove',
			danger: true
		});
		if (!yes) return;
		const r = await removeNode(n.node_id);
		note = r.ok ? 'Sent.' : r.error;
		setTimeout(load, 3000);
	}
	async function again(n: MatterNode) {
		const r = await reinterview(n.node_id);
		note = r.ok ? `Asking ${n.name ?? `node ${n.node_id}`} again what it is.` : r.error;
	}
</script>

<section class="card">
	<h2>Matter</h2>
	{#if nodes === null}<p class="quiet">Loading…</p>
	{:else if nodes.length === 0}<p class="quiet">No Matter devices yet.</p>
	{:else}
		<ul>
			{#each nodes as n (n.node_id)}
				<li>
					<span
						><strong>{n.name ?? `Node ${n.node_id}`}</strong>
						{[n.vendor, n.product].filter(Boolean).join(' · ')}</span
					>
					<button type="button" class="plain" onclick={() => again(n)}>Ask again</button>
					<button type="button" class="plain danger" onclick={() => drop(n)}>Remove…</button>
				</li>
			{/each}
		</ul>
	{/if}
	<div class="add">
		<label
			>Setup passcode<input
				inputmode="numeric"
				bind:value={passcode}
				placeholder="8 digits, on the device or its box"
			/></label
		>
		<label
			>Discriminator<input
				inputmode="numeric"
				bind:value={discriminator}
				placeholder="Optional"
			/></label
		>
		<button type="button" class="go" disabled={!(code > 0)} onclick={add}>Add a device</button>
	</div>
	{#if note}<p class="note" role="status">{note}</p>{/if}
</section>

<style>
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4);
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	h2 {
		margin: 0;
		font-size: 12px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2);
		padding: 6px 0;
	}
	li + li {
		border-top: 1px solid var(--line);
	}
	li span {
		flex: 1 1 200px;
		color: var(--ink-muted);
	}
	li strong {
		color: var(--ink);
	}
	.add {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--space-3);
	}
	label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-size: 12px;
		font-weight: 600;
		color: var(--ink-muted);
	}
	input {
		height: 38px;
		padding: 0 10px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
	}
	.go,
	.plain {
		height: 36px;
		padding: 0 14px;
		border-radius: 18px;
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
	.go:disabled {
		opacity: 0.5;
	}
	.danger {
		color: var(--alert);
	}
	.note {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: 10px;
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-weight: 600;
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
	}
</style>
