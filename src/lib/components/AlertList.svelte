<!--
	Alerts as a list (N7): most serious first, each with where it is and how
	long it has been so. Tapping one opens the device's details (N5).
-->
<script lang="ts">
	import { page } from '$app/state';
	import type { Alert } from '#lib/alerts.js';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { roomOf } from '#lib/summary.js';
	import { clock } from '#lib/clock.svelte.js';
	import { deviceHref, openDevice } from '#lib/popup.js';
	import Icon from './Icon.svelte';

	let { list }: { list: Alert[] } = $props();

	const where = (a: Alert) => {
		const d = devices.byId[a.device_id];
		return d ? (roomOf(d, rooms.list)?.name ?? 'Not in a room') : '';
	};
	function since(at: string): string {
		const mins = Math.max(0, Math.round((clock.now - Date.parse(at)) / 60_000));
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins} min`;
		const h = Math.floor(mins / 60);
		return h < 48 ? `${h} h` : `${Math.floor(h / 24)} d`;
	}
	const ICON = {
		wet: 'water',
		smoke: 'alert',
		offline: 'router',
		jammed: 'lock',
		low_battery: 'alert',
		rule: 'alert'
	} as const;
</script>

<ul>
	{#each list as a (a.id)}
		<li class:critical={a.severity === 'critical'}>
			<a
				href={deviceHref(a.device_id, page.url)}
				onclick={(e) => {
					if (e.metaKey || e.ctrlKey || e.shiftKey) return;
					e.preventDefault();
					openDevice(a.device_id, page.url);
				}}
			>
				<span class="icon"><Icon name={ICON[a.kind]} size={18} /></span>
				<span class="text">
					<span class="message">{a.message}</span>
					<span class="where">{where(a)}</span>
				</span>
				<span class="since">{since(a.raised_at)}</span>
			</a>
		</li>
	{/each}
</ul>

<style>
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	a {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 60px;
		padding: 8px 14px 8px 10px;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		text-decoration: none;
		color: var(--ink);
	}
	.critical a {
		background: var(--alert-bg);
		border-color: var(--alert-line);
	}
	.icon {
		width: 36px;
		height: 36px;
		flex: none;
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--alert-bg);
		color: var(--alert);
	}
	.critical .icon {
		background: var(--alert);
		color: var(--alert-ink);
	}
	.text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.message {
		font-weight: 600;
	}
	.where,
	.since {
		font-size: 13px;
		color: var(--ink-muted);
	}
	.since {
		font-family: var(--font-num);
		font-size: 12px;
		flex: none;
	}
</style>
