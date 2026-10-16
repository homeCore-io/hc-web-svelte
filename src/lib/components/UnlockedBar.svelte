<!--
	A person unlocked on a display (H5): whose app this is, on which display,
	for how much longer — and Lock, to give the display back now. When the
	time is up the server has already ended the session; this just notices.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { session } from '#lib/me.svelte.js';

	const on = $derived(session.me?.unlocked_on);
	let now = $state(Date.now());
	$effect(() => {
		if (!on) return;
		const t = setInterval(() => (now = Date.now()), 1000);
		return () => clearInterval(t);
	});
	const left = $derived(on?.until ? Math.max(0, on.until - now) : null);
	$effect(() => {
		if (left === 0) void back();
	});
	const mmss = (ms: number) => {
		const s = Math.ceil(ms / 1000);
		return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
	};

	async function back() {
		await fetch('/ui/display/lock', { method: 'POST' }).catch(() => null);
		await session.load();
		void goto('/', { replace: true });
	}
</script>

{#if on}
	<div class="bar" role="status">
		<span
			><strong>{session.me?.username}</strong> on {on.name}{#if left !== null}
				· {mmss(left)} left{/if}</span
		>
		<button onclick={back}>Lock</button>
	</div>
{/if}

<style>
	.bar {
		position: sticky;
		top: 0;
		z-index: 5;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: calc(env(safe-area-inset-top) + 8px) var(--space-4) 8px;
		background: var(--ink);
		color: var(--bg);
		font-size: 14px;
	}
	button {
		height: 36px;
		padding: 0 18px;
		border-radius: 18px;
		border: none;
		background: var(--bg);
		color: var(--ink);
		font-weight: 700;
	}
</style>
