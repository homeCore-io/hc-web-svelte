<!--
	Settings (A0, 08 §3): the house and the system that runs it, each item
	saying how it stands now, what needs attention first, and a search that
	reaches into homecore.toml's sections too.
-->
<script lang="ts">
	import type { Component } from 'svelte';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Search from '@lucide/svelte/icons/search';
	import Cpu from '@lucide/svelte/icons/cpu';
	import DoorOpen from '@lucide/svelte/icons/door-open';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import SunMoon from '@lucide/svelte/icons/sun-moon';
	import Timer from '@lucide/svelte/icons/timer';
	import Workflow from '@lucide/svelte/icons/workflow';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Monitor from '@lucide/svelte/icons/monitor';
	import MessageCircleQuestion from '@lucide/svelte/icons/message-circle-question';
	import Palette from '@lucide/svelte/icons/palette';
	import Plug from '@lucide/svelte/icons/plug';
	import Users from '@lucide/svelte/icons/users';
	import SlidersHorizontal from '@lucide/svelte/icons/sliders-horizontal';
	import Send from '@lucide/svelte/icons/send';
	import Archive from '@lucide/svelte/icons/archive';
	import ScrollText from '@lucide/svelte/icons/scroll-text';
	import Activity from '@lucide/svelte/icons/activity';
	import ClipboardList from '@lucide/svelte/icons/clipboard-list';
	import Server from '@lucide/svelte/icons/server';
	import { session } from '#lib/me.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { scenes } from '#lib/scenes.svelte.js';
	import { alerts } from '#lib/alerts.svelte.js';
	import { houseDevices, pluginSceneCount } from '#lib/inventory.js';
	import { isRunning, type PluginRecord } from '#lib/plugins.js';
	import {
		mayOpen,
		SETTINGS,
		backupDue,
		daysAgo,
		found,
		matches,
		size,
		uptime,
		type SettingsItem
	} from '#lib/settings.js';
	import { searchText, type Descriptor } from '#lib/descriptor.js';

	const ICONS: Record<string, Component> = {
		devices: Cpu,
		rooms: DoorOpen,
		scenes: Sparkles,
		modes: SunMoon,
		helpers: Timer,
		automations: Workflow,
		alerts: TriangleAlert,
		displays: Monitor,
		asking: MessageCircleQuestion,
		look: Palette,
		plugins: Plug,
		people: Users,
		configuration: SlidersHorizontal,
		notifications: Send,
		data: Archive,
		logs: ScrollText,
		events: Activity,
		audit: ClipboardList,
		system: Server
	};

	// ---- what each can see ----
	const allowed = (item: SettingsItem) => mayOpen(item, (s) => session.can(s), session.isAdmin);

	// ---- how things stand (admin only: these read homeCore's system API) ----
	interface Status {
		version: string;
		uptime_seconds: number;
		last_backup_at: string | null;
		plugins_active: number;
		rules_total: number;
		rules_enabled: number;
		history_db_bytes: number;
		state_db_bytes: number;
	}
	let status = $state<Status | null>(null);
	let people = $state<{ role: string }[] | null>(null);
	let running = $state<number | null>(null);
	let displays = $state<number | null>(null);
	let modes = $state<{ name: string; on: boolean }[] | null>(null);
	let descriptor = $state<Descriptor | null>(null);

	const get = async <T,>(path: string): Promise<T | null> => {
		const res = await fetch(`/api/v1${path}`).catch(() => null);
		return res?.ok ? ((await res.json()) as T) : null;
	};
	$effect(() => {
		if (!session.isAdmin) return;
		void get<Status>('/system/status').then((s) => (status = s));
		void get<{ role: string }[]>('/auth/users').then((u) => (people = u));
		void get<PluginRecord[]>('/plugins').then(
			(p) => (running = p ? p.filter(isRunning).length : null)
		);
		void get<{ revoked: boolean }[]>('/displays').then(
			(d) => (displays = d ? d.filter((x) => !x.revoked).length : null)
		);
		void get<{ config: { name: string }; state: { attributes: { on?: boolean } } }[]>(
			'/modes'
		).then(
			(m) =>
				(modes = m ? m.map((x) => ({ name: x.config.name, on: !!x.state.attributes.on })) : null)
		);
	});

	// Counted as the Devices page counts them: plugin scenes go with scenes.
	const deviceList = $derived(houseDevices(devices.byId));
	const pluginScenes = $derived(pluginSceneCount(devices.byId));
	const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

	const live = $derived<Record<string, string | undefined>>({
		devices: devices.loaded
			? `${plural(deviceList.length, 'device')} · ${
					deviceList.filter((d) => !d.available).length || 'none'
				} offline`
			: undefined,
		rooms: rooms.list.length ? plural(rooms.list.length, 'room') : undefined,
		scenes:
			scenes.list.length || pluginScenes
				? [
						scenes.list.length ? plural(scenes.list.length, 'scene') : '',
						pluginScenes ? `${pluginScenes} from plugins` : ''
					]
						.filter(Boolean)
						.join(' · ')
				: undefined,
		modes: modes?.length
			? modes.map((m) => `${m.name} ${m.on ? 'on' : 'off'}`).join(' · ')
			: undefined,
		automations: status
			? `${plural(status.rules_total, 'rule')} · ${status.rules_enabled} on`
			: undefined,
		alerts: alerts.list.length ? `${plural(alerts.list.length, 'alert')} now` : undefined,
		displays:
			displays === null ? undefined : displays === 0 ? 'None yet' : plural(displays, 'display'),
		plugins: running !== null ? `${running} running` : undefined,
		people: people
			? `${plural(people.length, 'person', 'people')} · ${plural(
					people.filter((p) => p.role === 'admin').length,
					'admin'
				)}`
			: undefined,
		configuration: descriptor
			? `homecore.toml · ${plural(descriptor.sections.length, 'section')}`
			: undefined,
		data: status
			? status.last_backup_at
				? `Last backup ${daysAgo(status.last_backup_at)}`
				: 'Never backed up'
			: undefined,
		system: status
			? `v${status.version} · up ${uptime(status.uptime_seconds)} · ${size(status.history_db_bytes)} of history`
			: undefined
	});
	const warn = $derived<Record<string, boolean>>({
		alerts: alerts.list.length > 0,
		data: status !== null && backupDue(status.last_backup_at)
	});

	// ---- what needs attention ----
	const attention = $derived.by(() => {
		const out: { title: string; detail: string; href?: string; action?: string; bad: boolean }[] =
			[];
		if (status && backupDue(status.last_backup_at))
			out.push({
				title: status.last_backup_at
					? `The last backup was ${daysAgo(status.last_backup_at)}`
					: 'No backup is recorded',
				detail:
					'One file with the house’s state, rules, settings and calendars. Keep it somewhere else.',
				href: '/settings/data',
				action: 'Back up now',
				bad: true
			});
		if (people && people.length > 1 && people.every((p) => p.role === 'admin'))
			out.push({
				title: `All ${people.length} people are admins`,
				detail: 'Give family members “Household member”: they use the house, and can’t change it.',
				href: '/settings/people/add',
				action: 'Add a person',
				bad: false
			});
		return out;
	});

	// ---- search ----
	let query = $state('');
	const status_ = (item: SettingsItem) => live[item.slug] ?? item.detail;
	// Not built yet: what homeCore says now, if anything, and when it arrives.
	const shownStatus = (item: SettingsItem) => {
		if (!item.coming) return status_(item);
		const when = `arrives in ${item.coming.when.split(',')[0]}`;
		const now = live[item.slug];
		return now ? `${now} · ${when}` : when[0]!.toUpperCase() + when.slice(1);
	};
	const groups = $derived(
		(['house', 'system'] as const).map((g) => ({
			id: g,
			title: g === 'house' ? 'House' : 'System',
			items: SETTINGS.filter((i) => i.group === g && allowed(i) && matches(i, query, status_(i)))
		}))
	);
	// homecore.toml's sections, found by their settings (admin only).
	$effect(() => {
		if (!session.isAdmin || descriptor) return;
		void get<{ descriptor: Descriptor }>('/system/config/descriptor').then(
			(d) => (descriptor = d?.descriptor ?? null)
		);
	});
	const configHits = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (q.length < 2 || !descriptor) return [];
		return descriptor.sections.filter((s) => !s.hidden && found(searchText(s), q)).slice(0, 8);
	});
</script>

{#if !session.can('content:write') && !session.isAdmin}
	<p class="quiet">Settings are for people who may change the house.</p>
{:else}
	<div class="page">
		<label class="search">
			<Search size={18} aria-hidden="true" />
			<input
				type="search"
				bind:value={query}
				placeholder="Find a setting — “backup”, “port”, “pushover”"
				aria-label="Find a setting"
			/>
		</label>

		{#if attention.length > 0 && query === ''}
			<section class="attention" aria-label="Needs attention">
				{#each attention as a (a.title)}
					<div class="notice" class:bad={a.bad}>
						<span class="text">
							<strong>{a.title}</strong>
							<span>{a.detail}</span>
						</span>
						{#if a.href}<a class="act" href={a.href}>{a.action}</a>{/if}
					</div>
				{/each}
			</section>
		{/if}

		<div class="groups">
			{#each groups as g (g.id)}
				{#if g.items.length > 0 || query !== ''}
					<section>
						<h2>{g.title}</h2>
						{#if g.items.length > 0}
							<ul>
								{#each g.items as item (item.slug)}
									{@const Icon = ICONS[item.slug]}
									<li>
										<a href={`/settings/${item.slug}`}>
											<span class="icon"
												>{#if Icon}<Icon
														size={18}
														strokeWidth={1.8}
														aria-hidden="true"
													/>{/if}</span
											>
											<span class="text">
												<span class="label">{item.label}</span>
												<span class="detail" class:warn={warn[item.slug]}>
													{shownStatus(item)}
												</span>
											</span>
											<ChevronRight size={18} aria-hidden="true" />
										</a>
									</li>
								{/each}
							</ul>
						{:else}
							<p class="quiet">Nothing here matches “{query}”.</p>
						{/if}
					</section>
				{/if}
			{/each}
		</div>

		{#if configHits.length > 0}
			<section>
				<h2>In homecore.toml</h2>
				<ul>
					{#each configHits as s (s.id)}
						<li>
							<a href={`/settings/configuration?s=${encodeURIComponent(s.id)}`}>
								<span class="icon"
									><SlidersHorizontal size={18} strokeWidth={1.8} aria-hidden="true" /></span
								>
								<span class="text">
									<span class="label">{s.title}</span>
									<span class="detail">{s.help ?? 'Configuration'}</span>
								</span>
								<ChevronRight size={18} aria-hidden="true" />
							</a>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		max-width: 1100px;
	}
	.search {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		max-width: 520px;
		height: 44px;
		padding: 0 var(--space-3);
		border-radius: 22px;
		background: var(--surface);
		border: 1px solid var(--line);
		color: var(--ink-muted);
	}
	.search input {
		flex: 1;
		min-width: 0;
		border: none;
		background: none;
		outline: none;
		color: var(--ink);
		font: inherit;
	}
	.attention {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.notice {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-radius: var(--radius);
		background: var(--lit-bg);
		color: var(--lit-ink);
		border: 1px solid var(--lit-card-line);
	}
	.notice.bad {
		background: var(--alert-bg);
		color: var(--alert);
		border-color: var(--alert-line);
	}
	.notice .text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		line-height: 1.4;
	}
	.notice .text span {
		color: var(--ink);
		font-size: 13px;
	}
	.act {
		height: 36px;
		padding: 0 14px;
		display: flex;
		align-items: center;
		border-radius: 18px;
		background: var(--surface);
		color: var(--ink);
		font-weight: 700;
		text-decoration: none;
	}
	.groups {
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		gap: var(--space-4);
		align-items: start;
	}
	@media (min-width: 1000px) {
		.groups {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: var(--space-5);
		}
	}
	h2 {
		margin: 0 0 var(--space-2);
		font-size: 13px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	ul {
		list-style: none;
		margin: 0;
		padding: 0;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		overflow: hidden;
	}
	li + li {
		border-top: 1px solid var(--line);
	}
	a {
		display: flex;
		align-items: center;
		gap: var(--space-3);
		min-height: 60px;
		padding: var(--space-2) var(--space-3) var(--space-2) var(--space-4);
		text-decoration: none;
		color: var(--ink);
	}
	a > :global(svg) {
		color: var(--ink-muted);
		flex: none;
	}
	.icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: 10px;
		background: var(--surface-2);
		flex: none;
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}
	.label {
		font-size: 15px;
		font-weight: 600;
	}
	.detail,
	.quiet {
		color: var(--ink-muted);
		font-size: 13px;
	}
	.detail.warn {
		color: var(--alert);
		font-weight: 600;
	}
	.quiet {
		margin: 0;
	}
</style>
