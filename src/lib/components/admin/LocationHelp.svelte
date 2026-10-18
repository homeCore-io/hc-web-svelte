<!--
	Beside the Location settings: fill them from this device, and see what
	homeCore makes of them now — today's sunrise and sunset, which every rule
	and mode that follows the sun runs on. A wrong one shows here first.
-->
<script lang="ts">
	import type { FormState } from '#lib/form.svelte.js';
	import { devices } from '#lib/devices.svelte.js';

	let { form }: { form: FormState } = $props();

	let note = $state<string | null>(null);
	function here() {
		note = null;
		if (!('geolocation' in navigator)) return void (note = 'This device can’t say where it is.');
		navigator.geolocation.getCurrentPosition(
			(p) => {
				form.set('location.latitude', Number(p.coords.latitude.toFixed(4)));
				form.set('location.longitude', Number(p.coords.longitude.toFixed(4)));
				note = 'Filled in from this device — save to keep it.';
			},
			() => (note = 'This device wouldn’t say where it is.'),
			{ timeout: 10_000 }
		);
	}
	const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const sun = $derived(devices.byId['mode_day']?.attributes ?? {});
</script>

<div class="help">
	<div class="acts">
		<button type="button" onclick={here}>Use this device’s location</button>
		{#if zone && form.get('location.timezone') !== zone}
			<button type="button" onclick={() => form.set('location.timezone', zone)}
				>Use its time zone, {zone}</button
			>
		{/if}
	</div>
	{#if note}<p role="status">{note}</p>{/if}
	{#if sun.sunrise_today || sun.sunset_today}
		<p>
			homeCore has today’s sunrise at <strong>{String(sun.sunrise_today ?? '—')}</strong> and sunset
			at <strong>{String(sun.sunset_today ?? '—')}</strong>. If those are wrong for the house, so is
			its location — and every rule that follows the sun.
		</p>
	{/if}
</div>

<style>
	.help {
		display: flex;
		flex-direction: column;
		gap: 8px;
		margin-top: var(--space-3);
		padding: 12px 14px;
		border-radius: 12px;
		background: var(--surface-2);
		font-size: 13px;
	}
	.acts {
		display: flex;
		flex-wrap: wrap;
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
	p {
		margin: 0;
	}
</style>
