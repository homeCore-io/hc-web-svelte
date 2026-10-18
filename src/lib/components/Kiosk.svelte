<!--
	A display's frame (D7, N9): no menus, no Settings, no Me — only the pages
	its admin chose, with tabs along the bottom when there are several and a
	swipe between them. It keeps the screen awake, goes dark while the house's
	Night Mode is on if asked to, and reloads once a day. A person can unlock
	the full app with their PIN for a few minutes.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Lock from '@lucide/svelte/icons/lock-keyhole';
	import Bell from '@lucide/svelte/icons/bell';
	import { allowedOn, nextTab, reloadDue, tabsFor, type DisplayDoc } from '#lib/display.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { alerts } from '#lib/alerts.svelte.js';
	import { theme } from '#lib/theme.svelte.js';
	import { live } from '#lib/live.svelte.js';
	import DetailsHost from './DetailsHost.svelte';
	import PinPad from './PinPad.svelte';

	let { children }: { children: Snippet } = $props();

	// ---- its settings, as the admin set them; looked at again now and then ----
	let doc = $state<DisplayDoc & { name?: string }>();
	let gone = $state(false);
	async function load() {
		const res = await fetch('/ui/display').catch(() => null);
		if (res?.status === 401) gone = true;
		if (res?.ok) doc = (await res.json()) as DisplayDoc & { name?: string };
	}
	$effect(() => {
		void load();
		// Often enough that a display removed in Settings says so soon.
		const t = setInterval(load, 30_000);
		return () => clearInterval(t);
	});

	const tabs = $derived(tabsFor(doc, rooms.list));
	const pathname = $derived(page.url.pathname);

	// Only its own pages: anywhere else goes to its first.
	$effect(() => {
		if (doc === undefined || rooms.list.length === 0) return;
		if (!allowedOn(tabs, pathname)) void goto(tabs[0]!.href, { replace: true });
	});

	// ---- swipe between pages ----
	let start: { x: number; y: number } | null = null;
	function down(e: PointerEvent) {
		start = e.pointerType === 'mouse' ? null : { x: e.clientX, y: e.clientY };
	}
	function up(e: PointerEvent) {
		if (start === null) return;
		const dx = e.clientX - start.x;
		const dy = e.clientY - start.y;
		start = null;
		if (Math.abs(dx) < 80 || Math.abs(dx) < Math.abs(dy) * 2) return;
		const to = nextTab(tabs, pathname, dx < 0 ? 1 : -1);
		if (to) void goto(to.href);
	}

	// ---- stays awake ----
	$effect(() => {
		if (doc?.kiosk?.awake === false || !('wakeLock' in navigator)) return;
		let lock: WakeLockSentinel | null = null;
		const ask = async () => {
			try {
				lock = await navigator.wakeLock.request('screen');
			} catch {
				// Refused (battery saver, say): the screen sleeps as it would.
			}
		};
		const again = () => document.visibilityState === 'visible' && void ask();
		void ask();
		document.addEventListener('visibilitychange', again);
		return () => {
			document.removeEventListener('visibilitychange', again);
			void lock?.release();
		};
	});

	// ---- dark while Night Mode is on ----
	const night = $derived(
		Object.values(devices.byId).find(
			(d) => d.device_id === 'mode_night' || (d.device_type === 'mode' && /night/i.test(d.name))
		)?.attributes.on === true
	);
	$effect(() => {
		if (doc?.kiosk?.night) theme.show(night ? 'dark' : 'light');
	});

	// ---- the clock, and the daily reload ----
	let now = $state(new Date());
	$effect(() => {
		const t = setInterval(() => {
			now = new Date();
			if (reloadDue(doc?.kiosk?.reload, now) && now.getSeconds() < 30) location.reload();
		}, 20_000);
		return () => clearInterval(t);
	});
	const time = $derived(now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));

	let unlocking = $state(false);
</script>

{#if gone}
	<div class="gone">
		<p>This display was removed in Settings.</p>
		<a href="/display">Set it up again</a>
	</div>
{:else}
	<div class="kiosk">
		<header>
			<span class="time">{time}</span>
			<span class="title">{tabs.find((t) => t.href === pathname)?.label ?? ''}</span>
			<span class="live" data-state={live.state} aria-hidden="true"></span>
			{#if alerts.list.length > 0}
				<a class="bell" href="/alerts" aria-label={`Alerts — ${alerts.list.length}`}>
					<Bell size={20} aria-hidden="true" />
					{alerts.list.length}
				</a>
			{/if}
			<button class="unlock" aria-label="Unlock with your PIN" onclick={() => (unlocking = true)}>
				<Lock size={20} aria-hidden="true" />
			</button>
		</header>
		<main onpointerdown={down} onpointerup={up}>
			{@render children()}
		</main>
		{#if tabs.length > 1}
			<nav class="tabs" aria-label="Pages">
				{#each tabs as t (t.key)}
					<a href={t.href} aria-current={t.href === pathname ? 'page' : undefined}>{t.label}</a>
				{/each}
			</nav>
		{/if}
		<DetailsHost />
	</div>
	{#if unlocking}<PinPad close={() => (unlocking = false)} />{/if}
{/if}

<style>
	.kiosk {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		user-select: none;
		-webkit-user-select: none;
	}
	header {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: calc(env(safe-area-inset-top) + 12px) var(--space-5) var(--space-2);
	}
	.time {
		font-family: var(--font-num);
		font-size: 26px;
		font-weight: 500;
	}
	.title {
		flex: 1;
		font-size: 18px;
		font-weight: 700;
		color: var(--ink-muted);
	}
	.live {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--track-off);
	}
	.live[data-state='live'] {
		background: var(--track-on);
	}
	.live[data-state='offline'] {
		background: var(--alert);
	}
	.bell {
		display: flex;
		align-items: center;
		gap: 6px;
		height: 40px;
		padding: 0 14px;
		border-radius: 20px;
		background: var(--alert-bg);
		color: var(--alert);
		font-weight: 700;
		text-decoration: none;
	}
	.unlock {
		width: var(--target);
		height: var(--target);
		border-radius: 50%;
		border: 1px solid var(--line);
		background: var(--surface);
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--ink-muted);
	}
	main {
		flex: 1;
		padding: var(--space-2) var(--space-5) var(--space-6);
		touch-action: pan-y;
	}
	.tabs {
		position: sticky;
		bottom: 0;
		display: flex;
		justify-content: center;
		gap: 6px;
		padding: 8px var(--space-4) calc(8px + env(safe-area-inset-bottom));
		background: var(--sheet);
		border-top: 1px solid var(--line);
	}
	.tabs a {
		min-width: 96px;
		height: 44px;
		padding: 0 18px;
		border-radius: 22px;
		display: flex;
		align-items: center;
		justify-content: center;
		text-decoration: none;
		font-weight: 600;
		color: var(--ink-muted);
	}
	.tabs a[aria-current='page'] {
		background: var(--accent);
		color: var(--accent-ink);
	}
	.gone {
		min-height: 100dvh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		color: var(--ink-muted);
	}
	.gone a {
		color: var(--accent);
		font-weight: 600;
	}
</style>
