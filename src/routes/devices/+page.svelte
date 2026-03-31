<script lang="ts">
	import { listDevices } from '$lib/api/devices';
	import { deviceDisplayName, type DeviceState } from '$lib/models/device';

	let devices = $state<DeviceState[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);
	let search = $state('');
	let availability = $state<'all' | 'online' | 'offline'>('all');

	$effect(() => {
		void refresh();
	});

	async function refresh() {
		loading = true;
		error = null;
		try {
			devices = await listDevices();
		} catch (value) {
			error = value instanceof Error ? value.message : 'Unable to load devices';
		} finally {
			loading = false;
		}
	}

	const filtered = $derived.by(() => {
		const query = search.trim().toLowerCase();
		return devices.filter((device) => {
			if (availability === 'online' && !device.available) return false;
			if (availability === 'offline' && device.available) return false;
			if (!query) return true;
			return [
				deviceDisplayName(device),
				device.device_id,
				device.canonical_name,
				device.area,
				device.device_type,
				device.plugin_id
			]
				.filter(Boolean)
				.join(' ')
				.toLowerCase()
				.includes(query);
		});
	});

	const grouped = $derived.by(() => {
		const map = new Map<string, DeviceState[]>();
		for (const device of filtered) {
			const area = device.area?.trim() || 'Unassigned';
			const group = map.get(area) ?? [];
			group.push(device);
			map.set(area, group);
		}
		return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
	});
</script>

<section class="page">
	<div class="heading">
		<div>
			<h1>Devices</h1>
			<p>Read-only device inventory grouped by area.</p>
		</div>
		<button type="button" onclick={refresh} disabled={loading}>
			{loading ? 'Refreshing…' : 'Refresh'}
		</button>
	</div>

	<div class="filters">
		<input bind:value={search} placeholder="Search name, area, type, plugin, canonical name" />
		<select bind:value={availability}>
			<option value="all">All devices</option>
			<option value="online">Online only</option>
			<option value="offline">Offline only</option>
		</select>
	</div>

	{#if error}
		<p class="error">{error}</p>
	{:else if loading && devices.length === 0}
		<p>Loading devices…</p>
	{:else if grouped.length === 0}
		<p>No devices match the current filters.</p>
	{:else}
		<div class="groups">
			{#each grouped as [area, items]}
				<section class="panel">
					<h2>{area}</h2>
					<div class="grid">
						{#each items as device}
							<article class="card">
								<div class="card-top">
									<a class="device-link" href={`/devices/${device.device_id}`}>
										<strong>{deviceDisplayName(device)}</strong>
									</a>
									<span class:offline={!device.available}>
										{device.available ? 'Online' : 'Offline'}
									</span>
								</div>
								<p>{device.device_type ?? 'device'}</p>
								<dl>
									<div>
										<dt>ID</dt>
										<dd>{device.device_id}</dd>
									</div>
									<div>
										<dt>Plugin</dt>
										<dd>{device.plugin_id}</dd>
									</div>
									{#if device.canonical_name}
										<div>
											<dt>Canonical</dt>
											<dd>{device.canonical_name}</dd>
										</div>
									{/if}
								</dl>
							</article>
						{/each}
					</div>
				</section>
			{/each}
		</div>
	{/if}
</section>

<style>
	.page, .groups { display: grid; gap: 1rem; }
	.heading, .filters, .card-top { display: flex; gap: 1rem; justify-content: space-between; align-items: center; }
	.filters { justify-content: start; flex-wrap: wrap; }
	input, select {
		padding: 0.75rem 0.9rem;
		border-radius: 0.8rem;
		border: 1px solid #cfdae6;
		background: white;
		font: inherit;
	}
	input { min-width: min(480px, 100%); flex: 1; }
	button {
		border: 0;
		border-radius: 999px;
		padding: 0.65rem 1rem;
		background: #153a63;
		color: white;
		cursor: pointer;
	}
	.panel {
		background: rgba(255,255,255,0.75);
		border: 1px solid #d7e0ea;
		border-radius: 1rem;
		padding: 1rem;
	}
	h1, h2, p, dl { margin: 0; }
	.grid {
		margin-top: 1rem;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
		gap: 0.85rem;
	}
	.card {
		background: white;
		border: 1px solid #dbe5ef;
		border-radius: 0.95rem;
		padding: 1rem;
		display: grid;
		gap: 0.6rem;
	}
	.device-link { color: inherit; text-decoration: none; }
	.device-link:hover { text-decoration: underline; }
	.card p { color: #627488; }
	span {
		padding: 0.25rem 0.6rem;
		border-radius: 999px;
		background: #dff4e7;
		color: #14633a;
		font-size: 0.8rem;
	}
	.offline {
		background: #f4dfdf;
		color: #8b2a2a;
	}
	dl { display: grid; gap: 0.45rem; }
	dl div { display: grid; gap: 0.12rem; }
	dt { font-size: 0.78rem; color: #6a7b8d; text-transform: uppercase; }
	dd { margin: 0; font-size: 0.95rem; color: #203242; word-break: break-word; }
	.error { color: #b53622; }
</style>
