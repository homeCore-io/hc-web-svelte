<script lang="ts">
	import { listModes } from '$lib/api/modes';
	import { modeDisplayName, type ModeState } from '$lib/models/mode';

	let modes = $state<ModeState[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	$effect(() => {
		void refresh();
	});

	async function refresh() {
		loading = true;
		error = null;
		try {
			modes = await listModes();
		} catch (value) {
			error = value instanceof Error ? value.message : 'Unable to load modes';
		} finally {
			loading = false;
		}
	}
</script>

<section class="page">
	<div class="heading">
		<div>
			<h1>Modes</h1>
			<p>Read-only current mode status from HomeCore.</p>
		</div>
		<button type="button" onclick={refresh} disabled={loading}>
			{loading ? 'Refreshing…' : 'Refresh'}
		</button>
	</div>

	{#if error}
		<p class="error">{error}</p>
	{:else if loading && modes.length === 0}
		<p>Loading modes…</p>
	{:else if modes.length === 0}
		<p>No modes found.</p>
	{:else}
		<div class="grid">
			{#each modes as mode}
				<article class="card">
					<div class="card-top">
						<strong>{modeDisplayName(mode)}</strong>
						<span class:off={!mode.on}>{mode.on ? 'On' : 'Off'}</span>
					</div>
					<p>{mode.kind ?? 'manual'} mode</p>
					<dl>
						<div>
							<dt>Device ID</dt>
							<dd>{mode.device_id}</dd>
						</div>
						<div>
							<dt>On offset</dt>
							<dd>{mode.on_offset_minutes ?? 0} min</dd>
						</div>
						<div>
							<dt>Off offset</dt>
							<dd>{mode.off_offset_minutes ?? 0} min</dd>
						</div>
						{#if mode.sunrise_today}
							<div>
								<dt>Sunrise</dt>
								<dd>{mode.sunrise_today}</dd>
							</div>
						{/if}
						{#if mode.sunset_today}
							<div>
								<dt>Sunset</dt>
								<dd>{mode.sunset_today}</dd>
							</div>
						{/if}
						{#if mode.effective_on}
							<div>
								<dt>Effective on</dt>
								<dd>{mode.effective_on}</dd>
							</div>
						{/if}
						{#if mode.effective_off}
							<div>
								<dt>Effective off</dt>
								<dd>{mode.effective_off}</dd>
							</div>
						{/if}
					</dl>
				</article>
			{/each}
		</div>
	{/if}
</section>

<style>
	.page { display: grid; gap: 1rem; }
	.heading, .card-top { display: flex; gap: 1rem; justify-content: space-between; align-items: center; }
	.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 0.85rem; }
	.card {
		background: white;
		border: 1px solid #dbe5ef;
		border-radius: 0.95rem;
		padding: 1rem;
		display: grid;
		gap: 0.6rem;
	}
	button {
		border: 0;
		border-radius: 999px;
		padding: 0.65rem 1rem;
		background: #153a63;
		color: white;
		cursor: pointer;
	}
	h1, p, dl { margin: 0; }
	p { color: #627488; }
	span {
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		background: #dff4e7;
		color: #14633a;
		font-size: 0.8rem;
	}
	.off {
		background: #f4dfdf;
		color: #8b2a2a;
	}
	dl { display: grid; gap: 0.45rem; }
	dl div { display: grid; gap: 0.12rem; }
	dt { font-size: 0.78rem; color: #6a7b8d; text-transform: uppercase; }
	dd { margin: 0; font-size: 0.95rem; color: #203242; word-break: break-word; }
	.error { color: #b53622; }
</style>
