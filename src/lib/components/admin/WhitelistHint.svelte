<!--
	Beside the no-sign-in address list: where homeCore sees this app coming
	from. The app reaches homeCore through its own server, so that address is
	the server's — listing it would let anyone using the app in unsigned.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { loadConnections } from '#lib/systemAdmin.js';

	let ip = $state<string | null>(null);
	onMount(async () => {
		const r = await loadConnections();
		if (!r.ok) return;
		let mine: string | null = null;
		try {
			mine = sessionStorage.getItem('hc-tab');
		} catch {
			// No tab id: the newest of the house's own connections will do.
		}
		const c =
			r.data.connections.find((x) => mine && x.client_id === mine) ??
			r.data.connections.find((x) => x.endpoint === 'events_stream');
		ip = c?.ip ?? null;
	});
</script>

{#if ip}
	<p class="hint">
		homeCore sees this app at <strong>{ip}</strong> — its own server, not your device. Don’t list that
		address (or a network holding it): everyone using the app would be let in without signing in.
	</p>
{/if}

<style>
	.hint {
		margin: var(--space-3) 0 0;
		padding: 12px 14px;
		border-radius: 12px;
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-size: 13px;
	}
</style>
