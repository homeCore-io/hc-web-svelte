<!--
	A scene is a button: tapping runs it (C2). It says so for a moment, since
	most scenes report nothing back to confirm. Long-press — or right-click —
	opens its details, where there are any.
-->
<script lang="ts">
	import Check from '@lucide/svelte/icons/check';
	import Icon from './Icon.svelte';

	let { name, run, details }: { name: string; run: () => Promise<boolean>; details?: () => void } =
		$props();

	// Long-press: held this long without moving away, it's details, not a run.
	const HOLD_MS = 500;
	let hold: ReturnType<typeof setTimeout> | undefined;
	let held = false;
	function press() {
		held = false;
		if (!details) return;
		hold = setTimeout(() => {
			held = true;
			details?.();
		}, HOLD_MS);
	}
	const release = () => clearTimeout(hold);
	let status = $state<'idle' | 'running' | 'done' | 'failed'>('idle');
	let timer: ReturnType<typeof setTimeout> | undefined;

	async function go() {
		if (held) {
			held = false;
			return;
		}
		if (status === 'running') return;
		status = 'running';
		status = (await run()) ? 'done' : 'failed';
		clearTimeout(timer);
		timer = setTimeout(() => (status = 'idle'), 1800);
	}
</script>

<button
	class="scene"
	class:done={status === 'done'}
	class:failed={status === 'failed'}
	onclick={go}
	onpointerdown={press}
	onpointerup={release}
	onpointerleave={release}
	onpointercancel={release}
	oncontextmenu={(e) => {
		if (!details) return;
		e.preventDefault();
		release();
		details();
	}}
>
	<span class="orb">
		{#if status === 'done'}<Check size={16} />{:else}<Icon name="scene" size={16} />{/if}
	</span>
	<span class="name">{status === 'failed' ? `${name} — didn't run` : name}</span>
</button>

<style>
	.scene {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 52px;
		padding: 0 12px;
		border-radius: var(--radius);
		border: 1px solid var(--card-line);
		background: var(--surface);
		box-shadow: var(--shadow);
		font-size: 14px;
		font-weight: 600;
		text-align: left;
		min-width: 0;
		-webkit-touch-callout: none;
		user-select: none;
	}
	.orb {
		width: 30px;
		height: 30px;
		flex: none;
		border-radius: 15px;
		background: var(--surface-2);
		color: var(--ink-muted);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.done {
		background: var(--lit-bg);
		border-color: var(--lit-card-line);
	}
	.done .orb {
		background: var(--fill);
		color: var(--lit-ink);
	}
	.failed {
		color: var(--alert);
	}
</style>
