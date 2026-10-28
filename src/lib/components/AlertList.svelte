<!--
	Alerts as a list (N7): most serious first, each with where it is and how
	long it has been so. Tapping one opens the device's details (N5).

	With `act`, each can be marked seen (it stays, dimmed, until it clears)
	or ignored — just this, every one like it, or the whole device; for good
	or a while (homeCore 0.1.81) — and "Do something…" makes an automation
	that starts when it (or one like it) happens. What each already starts is
	said under it.
-->
<script lang="ts">
	import { pluginLabel } from '#lib/inventory.js';
	import { page } from '$app/state';
	import { KIND_WORDS, ignoreFor, type Alert, type IgnoreScope } from '#lib/alerts.js';
	import { acknowledgeAlert, ignoreAlerts } from '#lib/admin.js';
	import { session } from '#lib/me.svelte.js';
	import { core } from '#lib/core.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { displayName } from '#lib/devices.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { roomOf } from '#lib/summary.js';
	import { clock } from '#lib/clock.svelte.js';
	import { deviceHref, openDevice } from '#lib/popup.js';
	import Icon from './Icon.svelte';
	import { alertKinds } from '#lib/alertKinds.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { onMount } from 'svelte';
	import { alertLinks } from '#lib/alertLinks.svelte.js';
	import { houseNames } from '#lib/alertNames.svelte.js';
	import { alertRules } from '#lib/admin.js';
	import {
		placeOf,
		scopesForAlert,
		startedBy,
		startsText,
		tieOf,
		type Scope
	} from '#lib/alertStarts.js';
	import type { AlertRule } from '#lib/alerts.js';
	import DoSomething from './DoSomething.svelte';

	let { list, act = false }: { list: Alert[]; act?: boolean } = $props();

	const can = $derived(act && core.since('0.1.81'));
	const canSee = $derived(can && session.can('devices:command'));
	const canIgnore = $derived(can && session.can('automations:write'));
	const name = (a: Alert) => {
		const d = devices.byId[a.device_id];
		return d ? displayName(d) : a.device_id;
	};

	// ---- what each starts, and "Do something…" ----
	const canDo = $derived(act && alertLinks.known && session.can('automations:write'));
	onMount(() => {
		if (act) alertKinds.ensure();
		if (act && session.can('automations:read')) void alertLinks.load();
	});
	let rulesOfAlerts = $state<AlertRule[]>([]);
	let doing = $state<{ a: Alert; scopes: Scope[] } | null>(null);
	async function doSomething(a: Alert) {
		if (a.kind === 'rule') rulesOfAlerts = (await alertRules()) ?? [];
		doing = { a, scopes: scopesForAlert(a, houseNames(rulesOfAlerts)) };
	}

	let note = $state<string | null>(null);
	async function seen(a: Alert) {
		note = await acknowledgeAlert(a.id);
	}

	// ---- ignoring: one alert's choices open at a time ----
	// The quieter choices — skip, stop these, ignore — wait behind "⋯".
	let menu = $state<string | null>(null);
	const pick = (f: () => unknown) => {
		menu = null;
		void f();
	};

	let ignoring = $state<string | null>(null);
	let scope = $state<IgnoreScope>('this');
	let span = $state('');
	const SPANS = [
		{ value: '', label: 'for good' },
		{ value: '1', label: 'for a day' },
		{ value: '7', label: 'for a week' },
		{ value: '30', label: 'for a month' }
	];
	function open(a: Alert) {
		ignoring = ignoring === a.id ? null : a.id;
		scope = 'this';
		span = '';
	}
	const scopes = (a: Alert): { id: IgnoreScope; label: string }[] =>
		a.kind === 'plugin'
			? [
					{ id: 'this', label: `${cap(kindLabel(a))} on ${name(a)}` },
					{ id: 'kind', label: `Every “${kindLabel(a)}”` },
					{ id: 'device', label: `Everything about ${name(a)}` }
				]
			: a.kind === 'rule'
				? [
						{ id: 'this', label: `This rule on ${name(a)}` },
						{ id: 'kind', label: 'This rule, on every device' },
						{ id: 'device', label: `Everything about ${name(a)}` }
					]
				: [
						{ id: 'this', label: `${cap(KIND_WORDS[a.kind])} on ${name(a)}` },
						{ id: 'kind', label: `Every ${KIND_WORDS[a.kind]}` },
						{ id: 'device', label: `Everything about ${name(a)}` }
					];
	const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
	async function ignore(a: Alert) {
		const until = span ? new Date(clock.now + Number(span) * 86_400_000).toISOString() : undefined;
		note = await ignoreAlerts(ignoreFor(a, scope, until));
		if (note === null) ignoring = null;
	}

	const where = (a: Alert) => {
		const d = devices.byId[a.device_id];
		// Its room; with none, where it comes from — never "Not in a room" on every alert.
		return d ? (roomOf(d, rooms.list)?.name ?? (d.plugin_id ? pluginLabel(d.plugin_id) : '')) : '';
	};
	function since(at: string): string {
		const mins = Math.max(0, Math.round((clock.now - Date.parse(at)) / 60_000));
		if (mins < 1) return 'just now';
		if (mins < 60) return `${mins} min`;
		const h = Math.floor(mins / 60);
		return h < 48 ? `${h} h` : `${Math.floor(h / 24)} d`;
	}
	const seenAgo = (at: string) => {
		const s = since(at);
		return s === 'just now' ? s : `${s} ago`;
	};
	const ICON = {
		wet: 'water',
		smoke: 'alert',
		offline: 'router',
		jammed: 'lock',
		low_battery: 'alert',
		rule: 'alert',
		plugin: 'alert'
	} as const;

	// ---- a plugin's alerts (homeCore 0.1.85): its button, skipping this one ----
	const kindLabel = (a: Alert) =>
		(a.plugin_id && a.topic && alertKinds.label(a.plugin_id, a.topic)) ||
		(a.topic ?? '').replace(/_/g, ' ');
	async function press(a: Alert) {
		if (!a.action) return;
		if (
			a.action.confirm &&
			!(await ask({
				title: `${a.action.label.replace(/…$/, '')} — ${a.message}?`,
				go: a.action.label.replace(/…$/, ''),
				stay: 'Not now'
			}))
		)
			return;
		try {
			const r = await fetch(`/api/v1/alerts/${encodeURIComponent(a.id)}/press`, { method: 'POST' });
			note = r.ok
				? null
				: r.status === 403
					? "You aren't allowed to do this."
					: `homeCore said ${r.status}.`;
		} catch {
			note = 'homeCore is not answering.';
		}
	}
	async function skip(a: Alert) {
		note = await ignoreAlerts(ignoreFor(a, 'key'));
	}
	async function quiet(a: Alert) {
		if (!a.plugin_id || !a.topic) return;
		if (
			!(await ask({
				title: `Stop alerting about “${kindLabel(a)}”? It stays on the device's own page; turn it back on in Settings › Alerts.`,
				go: 'Stop',
				stay: 'Keep them'
			}))
		)
			return;
		note = await alertKinds.put(a.plugin_id, a.topic, { enabled: false });
	}
</script>

<svelte:window
	onclick={(e) => {
		if (menu && !(e.target as Element).closest?.('.more')) menu = null;
	}}
/>
{#if note}<p class="note" role="alert">{note}</p>{/if}
{#if doing}
	<DoSomething
		title={doing.a.message}
		scopes={doing.scopes}
		tie={tieOf(doing.a.kind)}
		href={placeOf(doing.a)}
		onclose={() => (doing = null)}
	/>
{/if}
<ul>
	{#each list as a (a.id)}
		<li
			class:critical={a.severity === 'critical'}
			class:info={a.severity === 'info'}
			class:seen={!!a.acknowledged}
		>
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
					<span class="where"
						>{where(
							a
						)}{#if a.acknowledged}{` · seen by ${a.acknowledged.by}, ${seenAgo(a.acknowledged.at)}`}{/if}</span
					>
				</span>
				<span class="since">{since(a.raised_at)}</span>
			</a>
			{#if canSee || canIgnore || canDo}
				<div class="acts">
					{#if act && alertLinks.known}
						{@const starts = startedBy(a, alertLinks.list)}
						{#if starts.length}
							<a
								class="starts"
								href={starts.length === 1
									? `/settings/automations/${encodeURIComponent(starts[0]!.id)}`
									: '/settings/automations?show=alerts'}>{startsText(starts)}</a
							>
						{/if}
					{/if}
					{#if canDo}
						<button type="button" class="do" onclick={() => doSomething(a)}>Do something…</button>
					{/if}
					{#if a.action && canSee}
						<button type="button" class="go" onclick={() => press(a)}>{a.action.label}</button>
					{/if}
					{#if canSee && !a.acknowledged}
						<button type="button" class="seen-wide" onclick={() => seen(a)}>Seen</button>
					{/if}
					{#if (canSee && !a.acknowledged) || canIgnore}
						<span class="more">
							<button
								type="button"
								class="dots"
								aria-label={`More for ${a.message}`}
								aria-expanded={menu === a.id}
								onclick={() => (menu = menu === a.id ? null : a.id)}>⋯</button
							>
							{#if menu === a.id}
								<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
								<div
									class="menu"
									role="menu"
									tabindex="-1"
									onkeydown={(e) => e.key === 'Escape' && (menu = null)}
								>
									{#if canSee && !a.acknowledged}
										<button
											type="button"
											role="menuitem"
											class="seen-narrow"
											onclick={() => pick(() => seen(a))}>Seen</button
										>
									{/if}
									{#if a.kind === 'plugin' && a.key && canIgnore}
										<button type="button" role="menuitem" onclick={() => pick(() => skip(a))}
											>Skip this one</button
										>
									{/if}
									{#if a.kind === 'plugin' && a.topic && canIgnore && session.can('automations:write')}
										<button type="button" role="menuitem" onclick={() => pick(() => quiet(a))}
											>Don’t tell me about these</button
										>
									{/if}
									{#if canIgnore}
										<button type="button" role="menuitem" onclick={() => pick(() => open(a))}
											>Ignore…</button
										>
									{/if}
								</div>
							{/if}
						</span>
					{/if}
				</div>
				{#if ignoring === a.id}
					<form
						class="ignore"
						onsubmit={(e) => {
							e.preventDefault();
							void ignore(a);
						}}
					>
						<fieldset>
							<legend>Stop showing</legend>
							{#each scopes(a) as o (o.id)}
								<label><input type="radio" bind:group={scope} value={o.id} /> {o.label}</label>
							{/each}
						</fieldset>
						<label class="span"
							>How long
							<select bind:value={span}>
								{#each SPANS as o (o.value)}<option value={o.value}>{o.label}</option>{/each}
							</select>
						</label>
						<p class="quiet">
							It goes from every screen, and isn’t sent anywhere. Settings › Alerts lists what’s
							ignored, to show it again.
						</p>
						<div class="buttons">
							<button type="submit" class="go">Ignore</button>
							<button type="button" onclick={() => (ignoring = null)}>Cancel</button>
						</div>
					</form>
				{/if}
			{/if}
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
	/* One card per alert: what it is, then what can be done, inside it. */
	li {
		display: flex;
		flex-direction: column;
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
		container-type: inline-size;
	}
	li > a {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 60px;
		padding: 8px 14px 8px 10px;
		border-radius: var(--radius);
		text-decoration: none;
		color: var(--ink);
	}
	.seen > a {
		opacity: 0.6;
	}
	.acts {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 8px 10px;
		border-top: 1px solid var(--card-line);
	}
	.acts > :first-child:not(.starts) {
		margin-left: auto;
	}
	.more {
		position: relative;
	}
	.acts .dots {
		width: 34px;
		padding: 0;
		font-size: 16px;
		line-height: 1;
	}
	.menu {
		position: absolute;
		right: 0;
		top: calc(100% + 4px);
		z-index: 5;
		display: flex;
		flex-direction: column;
		min-width: 220px;
		padding: 4px;
		border-radius: 12px;
		background: var(--surface);
		border: 1px solid var(--line);
		box-shadow: 0 6px 20px rgb(0 0 0 / 0.12);
	}
	.acts .menu button {
		height: 36px;
		border: none;
		border-radius: 8px;
		text-align: left;
		background: none;
		font-weight: 500;
	}
	.acts .menu button:hover {
		background: var(--surface-2);
	}
	.seen-narrow {
		display: none;
	}
	/* On a phone, Seen goes behind "⋯" too, so the row never wraps. */
	@container (max-width: 480px) {
		.acts .seen-wide {
			display: none;
		}
		.acts .menu .seen-narrow {
			display: block;
		}
	}
	.acts .starts {
		display: inline;
		margin-right: auto;
		min-height: 0;
		padding: 0 0 0 4px;
		border: none;
		border-radius: 0;
		background: none;
		font-size: 13px;
		color: var(--accent);
	}
	.acts .do {
		border-color: color-mix(in srgb, var(--lit-ink) 40%, transparent);
		background: var(--lit-bg);
		color: var(--lit-ink);
	}
	.acts button,
	.ignore button {
		height: 30px;
		padding: 0 12px;
		border-radius: 15px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-size: 13px;
		font-weight: 600;
	}
	.ignore .go {
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.ignore {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		padding: var(--space-3);
		border-top: 1px solid var(--card-line);
	}
	.ignore fieldset {
		margin: 0;
		padding: 0;
		border: none;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.ignore legend {
		font-weight: 600;
		margin-bottom: 4px;
	}
	.ignore .span {
		display: flex;
		align-items: center;
		gap: var(--space-2);
	}
	.ignore select {
		height: 34px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--bg);
		color: var(--ink);
		font: inherit;
	}
	.ignore .buttons {
		display: flex;
		gap: 6px;
	}
	.quiet {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
	.note {
		margin: 0 0 var(--space-2);
		color: var(--alert);
		font-weight: 600;
	}
	.critical {
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
	/* News, not a problem: never red. */
	.info .icon {
		background: var(--lit-bg);
		color: var(--lit-ink);
	}
	.acts .go {
		background: var(--accent);
		color: var(--accent-ink);
		border-color: var(--accent);
		font-weight: 600;
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
		font-variant-numeric: tabular-nums;
		font-size: 12px;
		flex: none;
	}
</style>
