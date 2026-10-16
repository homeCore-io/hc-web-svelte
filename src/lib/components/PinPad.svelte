<!--
	Unlock a display with your PIN (H5, N9): the full app, as you, for a few
	minutes; then the display is itself again. Big keys, for a finger at a
	wall panel; typing works too.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import Delete from '@lucide/svelte/icons/delete';
	import { session } from '#lib/me.svelte.js';

	let { close }: { close: () => void } = $props();

	let dialog = $state<HTMLDialogElement>();
	let pin = $state('');
	let trouble = $state<string | null>(null);
	let busy = $state(false);
	onMount(() => dialog?.showModal());

	function press(d: string) {
		trouble = null;
		if (pin.length < 8) pin += d;
	}
	async function unlock() {
		if (pin.length < 4 || busy) return;
		busy = true;
		const res = await fetch('/ui/display/unlock', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ pin })
		}).catch(() => null);
		busy = false;
		pin = '';
		if (res?.ok) {
			dialog?.close();
			await session.load();
			return;
		}
		const said = (await res?.json().catch(() => ({}))) as { error?: string; retry_after?: number };
		trouble =
			res?.status === 429
				? `Too many tries. Wait ${Math.ceil((said.retry_after ?? 60) / 60)} min.`
				: (said.error ?? 'That didn’t work.');
	}
	function keys(e: KeyboardEvent) {
		if (/^[0-9]$/.test(e.key)) press(e.key);
		else if (e.key === 'Backspace') pin = pin.slice(0, -1);
		else if (e.key === 'Enter') void unlock();
	}
</script>

<dialog
	bind:this={dialog}
	aria-label="Unlock with your PIN"
	onclose={close}
	onkeydown={keys}
	onclick={(e) => {
		if (e.target === dialog) dialog?.close();
	}}
>
	<div class="pad">
		<p class="title">Your PIN</p>
		<p class="dots" aria-live="polite" aria-label={`${pin.length} digits`}>
			{#each { length: Math.max(4, pin.length) } as _, i (i)}<span class:on={i < pin.length}
				></span>{/each}
		</p>
		{#if trouble}<p class="trouble" role="alert">{trouble}</p>{/if}
		<div class="keys">
			{#each ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as d (d)}
				<button onclick={() => press(d)}>{d}</button>
			{/each}
			<button aria-label="Delete a digit" onclick={() => (pin = pin.slice(0, -1))}
				><Delete size={24} /></button
			>
			<button onclick={() => press('0')}>0</button>
			<button class="go" disabled={pin.length < 4 || busy} onclick={unlock}>Unlock</button>
		</div>
		<p class="note">Only for a few minutes, then this screen locks again.</p>
	</div>
</dialog>

<style>
	dialog {
		margin: auto;
		padding: 0;
		border: none;
		border-radius: var(--radius-sheet);
		background: var(--sheet);
		color: var(--ink);
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	}
	dialog::backdrop {
		background: var(--scrim);
	}
	.pad {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		padding: 24px;
	}
	.title {
		margin: 0;
		font-size: 18px;
		font-weight: 700;
	}
	.dots {
		display: flex;
		gap: 12px;
		margin: 0;
		min-height: 16px;
	}
	.dots span {
		width: 14px;
		height: 14px;
		border-radius: 50%;
		border: 2px solid var(--ink-muted);
	}
	.dots span.on {
		background: var(--ink);
		border-color: var(--ink);
	}
	.keys {
		display: grid;
		grid-template-columns: repeat(3, 76px);
		gap: 12px;
	}
	.keys button {
		height: 76px;
		border-radius: 38px;
		border: 1px solid var(--line);
		background: var(--surface);
		font-size: 26px;
		font-weight: 600;
		font-family: var(--font-num);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.keys .go {
		font-family: var(--font);
		font-size: 15px;
		background: var(--accent);
		border-color: var(--accent);
		color: var(--accent-ink);
	}
	.keys .go:disabled {
		opacity: 0.4;
	}
	.trouble {
		margin: 0;
		color: var(--alert);
		font-weight: 600;
	}
	.note {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
</style>
