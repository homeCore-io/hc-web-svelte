<!--
	Say what a device is (Devices over MQTT, screen 3): what it reports, the
	types it is likely to be (its ecosystem's suggestion first), any other
	type, and the name homeCore shows. What the type gives it in the app is
	said under the choice. Saving writes the profile and applies at once.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import X from '@lucide/svelte/icons/x';
	import {
		givesOf,
		likelyTypes,
		typeLabel,
		type DeviceChange,
		type DeviceType,
		type ProfileDevice
	} from '#lib/mqttDevices.js';

	let {
		device,
		ecosystem,
		types,
		save,
		close
	}: {
		device: ProfileDevice;
		/** The ecosystem's name, as people know it. */
		ecosystem: string;
		types: DeviceType[];
		/** Keep the change; an error comes back to show. */
		save: (change: DeviceChange) => Promise<string | null>;
		close: () => void;
	} = $props();

	let dialog = $state<HTMLDialogElement>();
	onMount(() => dialog?.showModal());

	const known = $derived(types.map((t) => t.name));
	const byName = $derived(new Map(types.map((t) => [t.name, t])));
	// Read once, when the sheet opens.
	const start = (() =>
		device.device_type ?? device.configured?.device_type ?? device.suggestion ?? '')();
	let chosen = $state(start);
	// The name shown is the device's, which may be one given in the app; it
	// goes into the profile only when changed here.
	const startName = (() => device.configured?.name ?? device.name)();
	let name = $state(startName);
	let error = $state<string | null>(null);
	let busy = $state(false);
	/** Whether the click now ending began on the backdrop. */
	let downOnBackdrop = false;

	/** The quick choices: the suggestion, what it is now, then what its readings point to. */
	const choices = $derived(
		[device.suggestion, device.device_type, ...likelyTypes(device.readings, known)]
			.filter((t): t is string => !!t && known.includes(t))
			.filter((t, i, all) => all.indexOf(t) === i)
			.slice(0, 4)
	);
	const others = $derived(known.filter((t) => !choices.includes(t)));
	const gives = $derived(chosen ? byName.get(chosen) : undefined);
	const readings = $derived(
		Object.entries(device.readings).filter(([, v]) => v !== null && typeof v !== 'object')
	);

	async function keep() {
		busy = true;
		error = await save({
			device_id: device.device_id,
			device_type: chosen || null,
			name:
				name.trim() === startName.trim()
					? (device.configured?.name ?? null)
					: name.trim() && name.trim() !== device.device_id
						? name.trim()
						: null
		});
		busy = false;
		if (!error) dialog?.close();
	}
</script>

<dialog
	bind:this={dialog}
	aria-labelledby="type-sheet-title"
	onclose={close}
	onpointerdown={(e) => (downOnBackdrop = e.target === dialog)}
	onclick={(e) => {
		if (e.target === dialog && downOnBackdrop && !busy) dialog?.close();
	}}
>
	<div class="box">
		<header>
			<div>
				<p class="over">{ecosystem}</p>
				<h2 id="type-sheet-title">{device.name}</h2>
				<p class="id">{device.device_id}</p>
			</div>
			<button class="x" aria-label="Close without saving" onclick={() => dialog?.close()}
				><X size={20} aria-hidden="true" /></button
			>
		</header>

		{#if readings.length > 0}
			<section class="reports">
				<p class="over">It reports</p>
				<div class="chips">
					{#each readings.slice(0, 8) as [k, v] (k)}<span>{k}: {String(v)}</span>{/each}
				</div>
			</section>
		{/if}

		<fieldset>
			<legend>What is it?</legend>
			{#each choices as t (t)}
				<label class="opt" class:on={chosen === t}>
					<input type="radio" name="type" value={t} bind:group={chosen} />
					<span>
						<span class="what"
							>{typeLabel(t)}{#if t === device.suggestion}<span class="said">
									· {ecosystem} says so</span
								>{/if}</span
						>
						<span class="gives">{byName.get(t) ? givesOf(byName.get(t)!) : ''}</span>
					</span>
				</label>
			{/each}
			<label class="other"
				>{choices.length ? 'Another type' : 'Type'}
				<select
					value={choices.includes(chosen) ? '' : chosen}
					onchange={(e) => (chosen = e.currentTarget.value)}
				>
					<option value=""
						>{choices.length ? `All ${known.length} types…` : 'Choose a type…'}</option
					>
					{#each others as t (t)}<option value={t}>{typeLabel(t)}</option>{/each}
				</select>
			</label>
			{#if gives && !choices.includes(chosen)}
				<p class="gives">{givesOf(gives)}</p>
			{/if}
			{#if device.device_type || device.configured?.device_type}
				<label class="opt" class:on={chosen === ''}>
					<input type="radio" name="type" value="" bind:group={chosen} />
					<span
						><span class="what">Nothing</span><span class="gives"
							>Its readings, and no controls</span
						></span
					>
				</label>
			{/if}
		</fieldset>

		<label class="name"
			>Name
			<input type="text" bind:value={name} />
			<span class="hint">A name you give it in the app still wins over this.</span>
		</label>

		{#if error}<p class="error" role="alert">{error}</p>{/if}

		<div class="actions">
			<button type="button" class="plain" onclick={() => dialog?.close()}>Cancel</button>
			<button type="button" class="done" disabled={busy} onclick={keep}
				>{busy ? 'Saving…' : 'Save'}</button
			>
		</div>
	</div>
</dialog>

<style>
	dialog {
		width: min(520px, calc(100vw - 32px));
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
		padding: 20px;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 12px;
	}
	h2 {
		margin: 2px 0 0;
		font-size: 22px;
	}
	.id {
		margin: 4px 0 0;
		font-family: var(--font-num);
		font-size: 12px;
		color: var(--ink-muted);
		overflow-wrap: anywhere;
	}
	.over {
		margin: 0;
		font-size: 12px;
		font-weight: 700;
		color: var(--ink-muted);
	}
	.x {
		width: var(--target);
		height: var(--target);
		border: none;
		background: none;
		color: var(--ink-muted);
	}
	.reports {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.chips span {
		padding: 3px 8px;
		border-radius: 8px;
		background: var(--surface);
		border: 1px solid var(--card-line);
		font-family: var(--font-num);
		font-size: 12px;
	}
	fieldset {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin: 0;
		padding: 0;
		border: none;
	}
	legend {
		margin-bottom: 8px;
		font-weight: 700;
		font-size: 16px;
	}
	.opt {
		display: flex;
		gap: 12px;
		align-items: flex-start;
		min-height: var(--target);
		padding: 10px 12px;
		border: 1px solid var(--line);
		border-radius: 12px;
		background: var(--surface);
		cursor: pointer;
	}
	.opt.on {
		border-color: var(--accent);
		box-shadow: inset 0 0 0 1px var(--accent);
	}
	.opt input {
		margin-top: 3px;
		accent-color: var(--accent);
	}
	.opt > span {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.what {
		font-weight: 700;
	}
	.said {
		font-weight: 600;
		font-size: 13px;
		color: var(--lit-ink);
	}
	.gives {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
	.other,
	.name {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-size: 14px;
		font-weight: 700;
	}
	select,
	input[type='text'] {
		min-height: var(--target);
		padding: 0 12px;
		border-radius: 11px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 500;
	}
	.hint {
		font-weight: 400;
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
