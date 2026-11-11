<!--
	The household's settings, from the console's gear (the HomeConsole
	board): the settings pages that are for everyone, each one this person
	may open, and the rest under All settings.
-->
<script lang="ts" module>
	import { mayOpen, settingsItem } from '#lib/settings.js';

	/** One way into the household's settings. */
	export interface HouseItem {
		label: string;
		sub: string;
		href: string;
		slug: string;
	}

	const ITEMS: HouseItem[] = [
		{ slug: 'rooms', label: 'Rooms', sub: 'Names, order and icons', href: '/settings/rooms' },
		{
			slug: 'devices',
			label: 'Devices',
			sub: 'Names, and which room each is in',
			href: '/settings/devices'
		},
		{ slug: 'plugins', label: 'Plugins', sub: 'Install, set up, logs', href: '/settings/plugins' },
		{
			slug: 'automations',
			label: 'Automations',
			sub: 'Rules, in words',
			href: '/settings/automations'
		},
		{
			slug: 'people',
			label: 'People',
			sub: 'Who can sign in, and what they may do',
			href: '/settings/people'
		},
		{
			slug: 'system',
			label: 'Units and region',
			sub: 'The household’s temperature unit',
			href: '/settings/system#units'
		},
		{ slug: 'system', label: 'System', sub: 'Version, health, storage', href: '/settings/system' }
	];

	/** The items this person may open. */
	export function houseItems(can: (scope: string) => boolean, admin: boolean): HouseItem[] {
		return ITEMS.filter((i) => {
			const item = settingsItem(i.slug);
			return item !== undefined && mayOpen(item, can, admin);
		});
	}
</script>

<script lang="ts">
	import House from '@lucide/svelte/icons/house';
	import Cpu from '@lucide/svelte/icons/cpu';
	import Puzzle from '@lucide/svelte/icons/puzzle';
	import Workflow from '@lucide/svelte/icons/workflow';
	import Users from '@lucide/svelte/icons/users';
	import Thermometer from '@lucide/svelte/icons/thermometer';
	import Server from '@lucide/svelte/icons/server';
	import Settings from '@lucide/svelte/icons/settings';
	import type { Component } from 'svelte';

	let { items }: { items: HouseItem[] } = $props();

	const ICONS: Record<string, Component> = {
		Rooms: House,
		Devices: Cpu,
		Plugins: Puzzle,
		Automations: Workflow,
		People: Users,
		'Units and region': Thermometer,
		System: Server
	};
</script>

<div class="mh">Household settings<span class="cn">For everyone in the house</span></div>
{#each items as m (m.label)}
	{@const Icon = ICONS[m.label] ?? Settings}
	<a class="mi" href={m.href}
		><span class="mic"><Icon size={15} strokeWidth={1.9} aria-hidden="true" /></span><span
			class="mt">{m.label}<small>{m.sub}</small></span
		></a
	>
{/each}
<a class="mi all" href="/settings"
	><span class="mic"><Settings size={15} strokeWidth={1.9} aria-hidden="true" /></span><span
		class="mt">All settings</span
	></a
>

<style>
	.mh {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px 10px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.cn {
		letter-spacing: 0;
		text-transform: none;
		font-weight: 500;
	}
	.mi {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		padding: 4px 10px;
		border-radius: 10px;
		color: var(--ink);
		font-size: 13px;
		font-weight: 600;
		text-decoration: none;
	}
	.mi:hover,
	.mi:focus-visible {
		background: color-mix(in srgb, var(--ink) 6%, transparent);
	}
	.mi small {
		display: block;
		color: var(--ink-muted);
		font-weight: 500;
		font-size: 11px;
	}
	.mt {
		flex: 1;
		min-width: 0;
	}
	.mic {
		width: 28px;
		height: 28px;
		flex: none;
		border-radius: 8px;
		display: grid;
		place-items: center;
		background: color-mix(in srgb, var(--ink) 7%, transparent);
		color: var(--ink-muted);
	}
	.all {
		margin-top: 4px;
		border-top: 1px solid color-mix(in srgb, var(--ink) 7%, transparent);
		border-radius: 0 0 10px 10px;
	}
</style>
