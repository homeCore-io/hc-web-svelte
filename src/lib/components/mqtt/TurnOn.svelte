<!--
	Turn an ecosystem on (Devices over MQTT, screen 4): what's ready, and the
	devices it would take in from what the broker carries now, before
	anything changes.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import Check from '@lucide/svelte/icons/check';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import { loadPreview, turnOn, typeLabel, type PreviewDevice } from '#lib/mqttDevices.js';

	let {
		file,
		label,
		description,
		brokerOpen,
		catalog,
		close,
		done
	}: {
		file: string;
		label: string;
		description: string | null;
		/** Whether devices elsewhere can reach the broker. */
		brokerOpen: boolean | null;
		/** Whether the type catalog is there (it comes with the ecosystem if not). */
		catalog: boolean;
		close: () => void;
		done: (note: string) => void;
	} = $props();

	let dialog = $state<HTMLDialogElement>();
	let devices = $state<PreviewDevice[] | null>(null);
	let error = $state<string | null>(null);
	let busy = $state(false);

	onMount(() => {
		dialog?.showModal();
		void loadPreview(file).then((r) => {
			if (r.ok) devices = r.data.devices;
			else error = r.error;
		});
	});

	async function go() {
		busy = true;
		const r = await turnOn(file);
		busy = false;
		if (!r.ok) return void (error = r.error);
		done(`${label} is on.`);
		dialog?.close();
	}
</script>

<dialog
	bind:this={dialog}
	aria-labelledby="turn-on-title"
	onclose={close}
	onclick={(e) => {
		if (e.target === dialog) dialog?.close();
	}}
>
	<div class="box">
		<header>
			<h2 id="turn-on-title">Turn on {label}?</h2>
			<p>
				{description ?? 'Its devices, taken in from MQTT.'} homeCore copies its profile into your profiles
				folder, where you can change it.
			</p>
		</header>

		<ul class="ready">
			<li class:bad={brokerOpen === false}>
				{#if brokerOpen === false}<CircleAlert size={18} aria-hidden="true" />{:else}<Check
						size={18}
						aria-hidden="true"
					/>{/if}
				{brokerOpen === false
					? 'The broker is only on this machine: devices elsewhere can’t reach it yet'
					: 'The broker is open to the network'}
			</li>
			<li>
				<Check size={18} aria-hidden="true" />
				{catalog ? 'The device types are there' : 'The device types come with it'}
			</li>
			<li><Check size={18} aria-hidden="true" /> It starts at once. Nothing restarts.</li>
		</ul>

		<section>
			<p class="over">It will take in what the broker carries now</p>
			{#if devices === null && !error}
				<p class="quiet">Looking…</p>
			{:else if devices && devices.length === 0}
				<p class="quiet">
					Nothing yet: none of its devices has reported on the broker in the last hour. They appear
					when they do.
				</p>
			{:else if devices}
				<ul class="list">
					{#each devices as d (d.device_id)}
						<li>
							<span class="text"
								><span class="name">{d.name ?? d.device_id}</span><span class="id"
									>{d.device_id}</span
								></span
							>
							{#if d.device_type}<span class="chip">{typeLabel(d.device_type)}</span>{:else}<span
									class="chip bad">Needs a type</span
								>{/if}
						</li>
					{/each}
				</ul>
				<p class="quiet">Rename them, and put them in rooms, afterwards.</p>
			{/if}
		</section>

		{#if error}<p class="error" role="alert">{error}</p>{/if}

		<div class="actions">
			<button type="button" class="plain" onclick={() => dialog?.close()}>Cancel</button>
			<button type="button" class="done" disabled={busy} onclick={go}
				>{busy ? 'Turning on…' : 'Turn on'}</button
			>
		</div>
	</div>
</dialog>

<style>
	dialog {
		width: min(560px, calc(100vw - 32px));
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
		margin: 8px 0 0;
		color: var(--ink-muted);
	}
	.ready {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.ready li {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.ready li :global(svg) {
		flex: none;
		color: var(--good-ink, var(--ink));
	}
	.ready li.bad,
	.ready li.bad :global(svg) {
		color: var(--alert);
	}
	section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.over {
		margin: 0;
		font-weight: 700;
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		overflow: hidden;
	}
	.list li {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 14px;
	}
	.list li + li {
		border-top: 1px solid var(--line);
	}
	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.name {
		font-weight: 700;
	}
	.id {
		font-family: var(--font-num);
		font-size: 12px;
		color: var(--ink-muted);
		overflow-wrap: anywhere;
	}
	.chip {
		flex: none;
		padding: 3px 10px;
		border-radius: 999px;
		border: 1px solid var(--line);
		font-size: 12px;
		font-weight: 700;
	}
	.chip.bad {
		border: none;
		background: var(--alert-bg);
		color: var(--alert);
	}
	.quiet {
		margin: 0;
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
		justify-content: flex-end;
		gap: 10px;
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
	.done:disabled {
		opacity: 0.6;
	}
</style>
