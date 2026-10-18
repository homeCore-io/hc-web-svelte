<!--
	Alerts as a list (N7): most serious first, each with where it is and how
	long it has been so. Tapping one opens the device's details (N5).

	With `act`, each can be marked seen (it stays, dimmed, until it clears)
	or ignored — just this, every one like it, or the whole device; for good
	or a while (homeCore 0.1.81).
-->
<script lang="ts">
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

	let { list, act = false }: { list: Alert[]; act?: boolean } = $props();

	const can = $derived(act && core.since('0.1.81'));
	const canSee = $derived(can && session.can('devices:command'));
	const canIgnore = $derived(can && session.can('automations:write'));
	const name = (a: Alert) => {
		const d = devices.byId[a.device_id];
		return d ? displayName(d) : a.device_id;
	};

	let note = $state<string | null>(null);
	async function seen(a: Alert) {
		note = await acknowledgeAlert(a.id);
	}

	// ---- ignoring: one alert's choices open at a time ----
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
		a.kind === 'rule'
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
		return d ? (roomOf(d, rooms.list)?.name ?? 'Not in a room') : '';
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
		rule: 'alert'
	} as const;
</script>

{#if note}<p class="note" role="alert">{note}</p>{/if}
<ul>
	{#each list as a (a.id)}
		<li class:critical={a.severity === 'critical'} class:seen={!!a.acknowledged}>
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
			{#if canSee || canIgnore}
				<div class="acts">
					{#if canSee && !a.acknowledged}
						<button type="button" onclick={() => seen(a)}>Seen</button>
					{/if}
					{#if canIgnore}
						<button type="button" aria-expanded={ignoring === a.id} onclick={() => open(a)}
							>Ignore…</button
						>
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
	li {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.seen a {
		opacity: 0.6;
	}
	.acts {
		display: flex;
		justify-content: flex-end;
		gap: 6px;
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
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
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
