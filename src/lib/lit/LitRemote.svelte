<!--
	A player's remote pad (13 §13.1, Firemote): opened from its card (H2), so
	a room isn't all buttons. Its buttons are what the player's plugin
	declares (remote.ts); one it doesn't have isn't drawn.
-->
<script lang="ts">
	import type { CoreDevice } from '#lib/devices.js';
	import { commands } from '#lib/commands.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { remoteOf, type PadButton } from '#lib/remote.js';

	let {
		device,
		name,
		dark = false
	}: { device: CoreDevice; name: string; dark?: boolean } = $props();

	const pad = $derived(remoteOf(device.schema));
	let open = $state(false);
	let said = $state('');
	function press(b: PadButton) {
		const p = pad?.[b];
		if (!p || !session.mayUse) return;
		void commands.act(device.device_id, p.action, p.params);
		said = `${p.label}, to ${name}`;
	}
	const ROW_TOP: [PadButton, string][] = [
		['back', '↩'],
		['home', '⌂'],
		['options', '✱']
	];
	const ROW_BOTTOM: [PadButton, string][] = [
		['replay', '↺'],
		['play', '⏯'],
		['volumeDown', '−'],
		['mute', '🔇'],
		['volumeUp', '+']
	];
</script>

{#if pad}
	<div class="remote" class:dark>
		<button class="open" aria-expanded={open} onclick={() => (open = !open)}
			>{open ? 'Hide the remote' : 'Remote'}</button
		>
		{#if open}
			<div class="pad" role="group" aria-label={`${name}'s remote`}>
				<div class="keys">
					{#each ROW_TOP.filter(([b]) => pad[b]) as [b, icon] (b)}
						<button aria-label={pad[b]!.label} onclick={() => press(b)}>{icon}</button>
					{/each}
				</div>
				<div class="ring">
					<button class="up" aria-label="Up" onclick={() => press('up')}>▲</button>
					<button class="down" aria-label="Down" onclick={() => press('down')}>▼</button>
					<button class="left" aria-label="Left" onclick={() => press('left')}>◀</button>
					<button class="right" aria-label="Right" onclick={() => press('right')}>▶</button>
					<button class="ok" aria-label="OK" onclick={() => press('ok')}>OK</button>
				</div>
				<div class="keys">
					{#each ROW_BOTTOM.filter(([b]) => pad[b]) as [b, icon] (b)}
						<button aria-label={pad[b]!.label} onclick={() => press(b)}>{icon}</button>
					{/each}
				</div>
				<span class="said" role="status">{said}</span>
			</div>
		{/if}
	</div>
{/if}

<style>
	.remote {
		display: flex;
		flex-direction: column;
		align-items: stretch;
		gap: 10px;
		margin-top: 8px;
	}
	.open {
		align-self: flex-start;
		height: 30px;
		padding: 0 12px;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font-size: 12.5px;
	}
	.pad {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		padding: 12px 0 4px;
		border-radius: var(--feel-card-radius);
		border: 1px solid var(--card-line);
		background: var(--surface);
	}
	.keys {
		display: flex;
		gap: 10px;
	}
	.keys button {
		min-width: 46px;
		height: 36px;
		border-radius: 12px;
		border: 1px solid var(--line);
		background: var(--bg);
		color: var(--ink);
		font-size: 14px;
	}
	.ring {
		position: relative;
		width: 180px;
		height: 180px;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--bg);
	}
	.ring button {
		position: absolute;
		border: none;
		background: transparent;
		color: var(--ink);
		font-size: 17px;
	}
	.up,
	.down {
		left: 60px;
		width: 60px;
		height: 50px;
	}
	.up {
		top: 4px;
	}
	.down {
		bottom: 4px;
	}
	.left,
	.right {
		top: 60px;
		width: 50px;
		height: 60px;
	}
	.left {
		left: 4px;
	}
	.right {
		right: 4px;
	}
	.ring .ok {
		left: 50px;
		top: 50px;
		width: 80px;
		height: 80px;
		border-radius: 999px;
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 700;
		font-size: 15px;
	}
	.pad button:active {
		transform: scale(0.94);
	}
	.said {
		min-height: 16px;
		font-size: 12px;
		color: var(--ink-muted);
	}
	@media (prefers-reduced-motion: reduce) {
		.pad button:active {
			transform: none;
		}
	}
</style>
