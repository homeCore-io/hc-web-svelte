<!--
	A sensor that needs only a glance, in a Watching box (13 §6.3): a dot for
	how it is, its name, its state. A tap opens it.
-->
<script lang="ts">
	import { page as here } from '$app/state';
	import type { CardView } from '#lib/card.js';
	import { openDevice } from '#lib/popup.js';

	let { id, view: v, name }: { id: string; view: CardView; name: string } = $props();
	const tone = $derived(
		!v.available || v.alarm || v.tone === 'alert' ? 'bad' : v.tone === 'on' ? 'on' : 'ok'
	);
</script>

<button class="line" onclick={() => openDevice(id, here.url)}>
	<span class="dot {tone}" aria-hidden="true"></span>
	<span class="name">{name}</span>
	<small>{v.stateLine}</small>
</button>

<style>
	.line {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 11px 16px;
		border: none;
		background: var(--surface);
		color: var(--ink);
		text-align: left;
	}
	.name {
		flex: 1;
		font-size: 14px;
	}
	small {
		color: var(--ink-muted);
		font-size: 12.5px;
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 999px;
		background: #6fd39a;
	}
	.dot.on {
		background: var(--accent);
	}
	.dot.bad {
		background: var(--alert);
	}
</style>
