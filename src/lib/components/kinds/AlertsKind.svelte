<!--
	What needs attention (N7): the first three alerts, and the way to the rest.
	In the room field (mockup A): beside the rooms, one short line each; on a
	phone, one line after the big numbers: the most serious alert, else the
	doors open ("2 doors open · 3 alerts").
-->
<script lang="ts">
	import { page } from '$app/state';
	import { alerts } from '#lib/alerts.svelte.js';
	import { cardFor } from '#lib/card.js';
	import { clock } from '#lib/clock.svelte.js';
	import { displayName } from '#lib/devices.js';
	import { devices } from '#lib/devices.svelte.js';
	import type { KindProps } from '#lib/kinds.js';
	import { deviceHref, openDevice } from '#lib/popup.js';
	import Icon from '../Icon.svelte';

	// Reads the alerts itself: the card only marks where they go.
	let { place }: KindProps<'alerts'> = $props();

	const ICON = {
		wet: 'water',
		smoke: 'alert',
		offline: 'router',
		jammed: 'lock',
		low_battery: 'alert',
		rule: 'alert',
		plugin: 'alert'
	} as const;
	// Counted as the big numbers' Open is.
	const open = $derived(
		place === 'brief'
			? Object.values(devices.byId)
					.map((d) => cardFor(d, clock.now))
					.filter((c) => c.available && c.icon === 'door-open').length
			: 0
	);
	// The full list (its seen and ignore tools come with it) is fetched as this
	// loads, not with Home: the alerts come from the network after it anyway.
	const full = $derived(place === undefined ? import('../AlertList.svelte') : undefined);
	// The phone's line leads with the most serious alert, when one is an error
	// (a weather warning, a leak), and with the doors open otherwise.
	const serious = $derived(
		place === 'brief'
			? alerts.list.find((a) => a.severity === 'critical' || a.severity === 'error')
			: undefined
	);
	const many = (n: number, one: string, more: string) => `${n} ${n === 1 ? one : more}`;
	const name = (id: string) => {
		const d = devices.byId[id];
		return d ? displayName(d) : id;
	};
</script>

{#if place === 'brief'}
	<a class="brief" href="/alerts">
		<Icon name="alert" size={16} />
		{#if serious || open > 0}<b class="lead"
				>{serious
					? serious.message || `${name(serious.device_id)}: ${serious.reason}`
					: many(open, 'door open', 'doors open')}</b
			>{/if}
		<span class="count"
			>{#if serious || open > 0}{'· '}{/if}{many(alerts.list.length, 'alert', 'alerts')}</span
		>
	</a>
{:else if place === 'side'}
	<ul class="side">
		{#each alerts.list.slice(0, 5) as a (a.id)}
			<li>
				<a
					href={deviceHref(a.device_id, page.url)}
					onclick={(e) => {
						if (e.metaKey || e.ctrlKey || e.shiftKey) return;
						e.preventDefault();
						openDevice(a.device_id, page.url);
					}}
					><span class="tile"><Icon name={ICON[a.kind]} size={14} /></span><span class="text"
						>{a.message || `${name(a.device_id)}: ${a.reason}`}</span
					></a
				>
			</li>
		{/each}
	</ul>
	{#if alerts.list.length > 5}
		<a class="more" href="/alerts">All {alerts.list.length} alerts</a>
	{/if}
{:else if full}
	{#await full then { default: AlertList }}<AlertList list={alerts.list.slice(0, 3)} />{/await}
	{#if alerts.list.length > 3}
		<a class="more" href="/alerts">All {alerts.list.length} alerts</a>
	{/if}
{/if}

<style>
	.more {
		align-self: flex-start;
		color: var(--accent);
		font-weight: 600;
		text-decoration: none;
	}
	.brief {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border-radius: 14px;
		background: var(--alert-bg);
		border: 1px solid var(--alert-line);
		color: var(--ink);
		font-size: 13px;
		text-decoration: none;
	}
	.brief > :global(svg) {
		color: var(--alert);
		flex: none;
	}
	/* The alert shortens; the count always shows. */
	.lead {
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.count {
		flex: none;
		margin-right: auto;
		white-space: nowrap;
	}
	.side {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.side a {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 36px;
		color: var(--ink);
		font-size: 13px;
		text-decoration: none;
	}
	.side a:hover .text {
		text-decoration: underline;
	}
	.tile {
		width: 26px;
		height: 26px;
		flex: none;
		border-radius: 8px;
		background: var(--alert-bg);
		color: var(--alert);
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.text {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}
</style>
