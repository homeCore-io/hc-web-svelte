<!--
	Modes (A1): states the whole house is in, for rules to check. A mode that
	follows the sun has its offsets moved here; one people and rules turn on
	and off is switched here and can be made new.

	What homeCore can't yet do through its API is said, not hidden: give a
	new mode sun events (only modes.toml can), rename a mode, or describe the
	condition a mode is on while (that arrives with the rule editor, A3).
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import { devices } from '#lib/devices.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { wide } from '#lib/wide.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import {
		builtIn,
		howOf,
		minutes,
		modeIdFor,
		offsetText,
		spans,
		sunWords,
		type CoreMode
	} from '#lib/modes.js';
	import { loadRules, rulesNaming, type RuleRef } from '#lib/uses.js';
	import { deviceCall } from '#lib/deviceAdmin.js';
	import ListDetail from '#lib/components/admin/ListDetail.svelte';
	import Toggle from '#lib/components/Toggle.svelte';

	let modes = $state<CoreMode[] | null>(null);
	let rules = $state<RuleRef[]>([]);
	let trouble = $state<string | null>(null);
	async function load() {
		const res = await fetch('/api/v1/modes').catch(() => null);
		if (res?.ok) modes = (await res.json()) as CoreMode[];
		else trouble = 'homeCore wouldn’t list its modes.';
	}
	onMount(async () => {
		await load();
		rules = (await loadRules()) ?? [];
	});

	// The mode's device carries what changes live: on, and today's times.
	const live = (id: string) => devices.byId[id]?.attributes ?? {};

	const asked = $derived(page.url.searchParams.get('m'));
	const making = $derived(page.url.searchParams.has('new'));
	const mode = $derived(
		modes?.find((m) => m.config.id === asked) ?? (wide.current && !making ? modes?.[0] : undefined)
	);
	const chosen = $derived(asked !== null || making);
	const open = (q: string) =>
		goto(`/settings/modes${q}`, { replace: wide.current, reset: !wide.current });
	$effect(() =>
		!wide.current && chosen
			? heading.show(making ? 'New mode' : (mode?.config.name ?? 'Mode'), {
					href: '/settings/modes',
					label: 'Modes'
				})
			: undefined
	);

	const a = $derived(mode ? live(mode.config.id) : {});
	// Offsets as last asked for, ahead of homeCore's reload of modes.toml.
	let pending = $state<Record<string, number>>({});
	const offsetOf = (key: 'on_offset_minutes' | 'off_offset_minutes') =>
		mode ? (pending[`${mode.config.id}.${key}`] ?? mode.config[key] ?? 0) : 0;
	// Today's times from the sun and the offset: homeCore doesn't refresh the
	// mode's own `effective_on` when an offset moves.
	const sunAt = (e: string | undefined) =>
		e === 'Sunrise' ? minutes(a.sunrise_today) : e === 'Sunset' ? minutes(a.sunset_today) : null;
	const at = (e: string | undefined, off: number) => {
		const base = sunAt(e);
		return base === null ? null : (((base + off) % 1440) + 1440) % 1440;
	};
	const onAt = $derived(at(mode?.config.on_event, offsetOf('on_offset_minutes')));
	const offAt = $derived(at(mode?.config.off_event, offsetOf('off_offset_minutes')));
	const today = $derived(onAt !== null && offAt !== null ? spans(onAt, offAt) : []);
	const using = $derived(mode ? rulesNaming(rules, mode.config.id) : []);

	const command = async (body: Record<string, unknown>) => {
		if (!mode) return;
		trouble = await deviceCall(
			'PATCH',
			`/devices/${encodeURIComponent(mode.config.id)}/state`,
			body
		);
		// homeCore rewrites modes.toml and reloads; read the config again.
		if (!trouble && ('on_offset_minutes' in body || 'off_offset_minutes' in body))
			setTimeout(load, 800);
	};
	function nudge(key: 'on_offset_minutes' | 'off_offset_minutes', by: number) {
		if (!mode) return;
		const next = offsetOf(key) + by;
		pending = { ...pending, [`${mode.config.id}.${key}`]: next };
		void command({ [key]: next });
	}

	// ---- a new manual mode ----
	let name = $state('');
	const newId = $derived(modeIdFor(name));
	async function make() {
		const id = newId;
		trouble = await deviceCall('POST', '/modes', { id, name: name.trim(), kind: 'manual' });
		if (trouble) return;
		name = '';
		await load();
		void open(`?m=${encodeURIComponent(id)}`);
	}

	async function remove() {
		if (!mode) return;
		const yes = await ask({
			title: `Delete ${mode.config.name}?`,
			lost:
				using.length > 0
					? [
							`${using.length === 1 ? 'One rule checks' : `${using.length} rules check`} it and won’t find it: ${using.map((r) => r.name).join(', ')}.`
						]
					: ['No rules check it.'],
			go: 'Delete',
			danger: true
		});
		if (!yes) return;
		trouble = await deviceCall('DELETE', `/modes/${encodeURIComponent(mode.config.id)}`);
		if (!trouble) {
			await load();
			void open('');
		}
	}

	const hh = (m: number) =>
		`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
</script>

{#if !session.can('devices:write')}
	<p class="quiet">Modes are for people who may change the house.</p>
{:else}
	<p class="intro">States the whole house is in, for rules to check.</p>
	{#if trouble}<p class="trouble" role="alert">{trouble}</p>{/if}
	<ListDetail {chosen} label="Modes">
		{#snippet list()}
			<ul class="items">
				{#each modes ?? [] as m (m.config.id)}
					{@const on = live(m.config.id).on === true}
					<li>
						<a
							href={`?m=${encodeURIComponent(m.config.id)}`}
							aria-current={mode === m && !making ? 'page' : undefined}
							onclick={(e) => {
								e.preventDefault();
								void open(`?m=${encodeURIComponent(m.config.id)}`);
							}}
						>
							<span class="text"
								><strong>{m.config.name}</strong><span class="sub">{howOf(m)}</span></span
							>
							<span class="pill" class:on>{on ? 'On' : 'Off'}</span>
						</a>
					</li>
				{/each}
			</ul>
			<button type="button" class="new" onclick={() => open('?new')}
				><Plus size={16} aria-hidden="true" />New mode</button
			>
		{/snippet}
		{#snippet detail()}
			{#if making}
				<section class="card">
					{#if wide.current}<h2>New mode</h2>{/if}
					<div class="kinds">
						<div class="kind on">
							<strong>On or off by hand and by rules</strong>
							<span>Guests, Vacation, Movie — people and rules switch it.</span>
							<label class="name">
								<span>Name</span>
								<input bind:value={name} placeholder="Guests" />
							</label>
							<span class="sub"
								>Rules will call it <code>{name.trim() ? newId : 'mode_…'}</code></span
							>
							<button
								type="button"
								class="go"
								disabled={name.trim() === '' || modes?.some((m) => m.config.id === newId)}
								onclick={make}>Make it</button
							>
						</div>
						<div class="kind">
							<strong>Follows the sun</strong>
							<span>On between two sun events, each with an offset.</span>
							<span class="gap"
								>homeCore can’t yet give a new mode its sun events from here — only by editing
								modes.toml. Night and Day already follow the sun, and their offsets can be moved.</span
							>
						</div>
						<div class="kind">
							<strong>On while something is true</strong>
							<span>Everyone’s away, it’s raining — checked as it changes.</span>
							<span class="gap">Arrives with the rule editor (A3), which writes the condition.</span
							>
						</div>
					</div>
				</section>
			{:else if mode}
				{@const c = mode.config}
				<section class="card">
					<div class="head">
						{#if wide.current}<h2>{c.name}</h2>{/if}
						<span class="pill" class:on={a.on === true}>{a.on === true ? 'On now' : 'Off now'}</span
						>
						{#if c.kind === 'manual'}
							<Toggle on={a.on === true} label={c.name} onchange={(on) => command({ on })} />
						{/if}
					</div>
					<p class="sub">{howOf(mode)}</p>

					{#if c.kind === 'solar' && c.on_event && c.off_event}
						{#each [{ title: 'Turns on', event: c.on_event, key: 'on_offset_minutes' as const, at: onAt }, { title: 'Turns off', event: c.off_event, key: 'off_offset_minutes' as const, at: offAt }] as e (e.key)}
							<div class="edge">
								<span class="t">{e.title}</span>
								<span class="ev">At {sunWords(e.event)}</span>
								<span class="nudge">
									<button
										type="button"
										aria-label="5 minutes earlier"
										onclick={() => nudge(e.key, -5)}><Minus size={16} /></button
									>
									<span class="off">{offsetText(offsetOf(e.key))}</span>
									<button type="button" aria-label="5 minutes later" onclick={() => nudge(e.key, 5)}
										><Plus size={16} /></button
									>
								</span>
								<span class="at">{e.at !== null ? hh(e.at) : '—'} today</span>
							</div>
						{/each}
						{#if today.length > 0}
							<div class="day" aria-label="Today">
								<div class="bar">
									{#each today as s (s.from)}
										<span
											style:left={`${(s.from / 1440) * 100}%`}
											style:width={`${((s.to - s.from) / 1440) * 100}%`}
										></span>
									{/each}
								</div>
								<div class="ticks">
									<span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span
										>24:00</span
									>
								</div>
								<span class="sub"
									>Shaded: {c.name} on today. Sunrise {String(a.sunrise_today ?? '—')}, sunset {String(
										a.sunset_today ?? '—'
									)}.</span
								>
							</div>
						{/if}
						<p class="sub">
							Which sun event it follows is set in modes.toml; homeCore can’t change it from here
							yet.
						</p>
					{:else if c.kind === 'manual' && mode.definition}
						<p class="sub">
							homeCore turns it on and off by a condition. Reading and changing that condition
							arrives with the rule editor (A3).
						</p>
					{/if}

					<div class="uses">
						<h3>Rules that check it</h3>
						{#if using.length === 0}
							<p class="sub">None. Rules call it <code>{c.id}</code>.</p>
						{:else}
							<ul>
								{#each using as r (r.id)}<li>
										<a href={`/settings/automations/${encodeURIComponent(r.id)}`}>{r.name}</a>
									</li>{/each}
							</ul>
						{/if}
					</div>
					{#if !builtIn(c.id)}
						<div class="foot">
							<button type="button" class="danger" onclick={remove}>Delete…</button>
							<span class="sub">homeCore can’t rename a mode yet.</span>
						</div>
					{/if}
				</section>
			{/if}
		{/snippet}
	</ListDetail>
{/if}

<style>
	.intro {
		margin: 0 0 var(--space-3);
		color: var(--ink-muted);
	}
	.items {
		list-style: none;
		margin: 0 0 var(--space-3);
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.items a {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 56px;
		padding: 6px var(--space-3);
		border-radius: 12px;
		border: 1px solid var(--line);
		color: var(--ink);
		text-decoration: none;
	}
	.items a[aria-current='page'] {
		background: var(--surface);
		border-color: var(--accent);
	}
	.text {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-width: 0;
	}
	.sub {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
		line-height: 1.5;
	}
	.pill {
		padding: 3px 10px;
		border-radius: 11px;
		background: var(--surface-2);
		color: var(--ink-muted);
		font-size: 12px;
		font-weight: 700;
	}
	.pill.on {
		background: var(--lit-bg);
		color: var(--lit-ink);
	}
	.new,
	.go {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 40px;
		padding: 0 16px;
		border-radius: 20px;
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
		font: inherit;
		font-weight: 700;
	}
	.go {
		align-self: flex-start;
	}
	.go:disabled {
		opacity: 0.5;
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: var(--space-3);
		padding: var(--space-4) var(--space-5);
		border-radius: var(--radius);
		background: var(--surface);
		border: 1px solid var(--card-line);
	}
	h2 {
		margin: 0;
		font-size: 20px;
		flex: 1;
	}
	.head {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.kinds {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: var(--space-3);
	}
	.kind {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: var(--space-3);
		border-radius: 12px;
		border: 1px solid var(--line);
		font-size: 14px;
	}
	.kind.on {
		border-color: var(--accent);
	}
	.kind > span:not(.sub) {
		color: var(--ink-muted);
		font-size: 13px;
	}
	.gap {
		padding: 8px 10px;
		border-radius: 8px;
		background: var(--surface-2);
		line-height: 1.45;
	}
	.name {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-weight: 600;
	}
	input {
		height: 40px;
		padding: 0 12px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--bg);
		color: var(--ink);
		font: inherit;
		font-weight: 400;
	}
	.edge {
		display: grid;
		grid-template-columns: 90px minmax(0, 1fr) auto auto;
		align-items: center;
		gap: var(--space-3);
		padding: var(--space-2) 0;
		border-top: 1px solid var(--line);
	}
	.t {
		font-weight: 700;
	}
	@media (max-width: 600px) {
		.edge {
			grid-template-columns: minmax(0, 1fr) auto;
			row-gap: 6px;
		}
		.at {
			text-align: right;
		}
	}
	.nudge {
		display: flex;
		align-items: center;
		gap: 6px;
	}
	.nudge button {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: 17px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
	}
	.off {
		min-width: 70px;
		text-align: center;
		font-family: var(--font-num);
		font-size: 13px;
	}
	.at {
		font-family: var(--font-num);
		font-weight: 600;
	}
	.day {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.bar {
		position: relative;
		height: 22px;
		border-radius: 6px;
		background: var(--surface-2);
		overflow: hidden;
	}
	.bar span {
		position: absolute;
		top: 0;
		bottom: 0;
		background: var(--track-on);
		opacity: 0.75;
	}
	.ticks {
		display: flex;
		justify-content: space-between;
		font-family: var(--font-num);
		font-size: 11px;
		color: var(--ink-muted);
	}
	h3 {
		margin: 0 0 6px;
		font-size: 15px;
	}
	.uses ul {
		margin: 0;
		padding-left: 1.2em;
		line-height: 1.6;
	}
	.uses,
	.foot {
		padding-top: var(--space-3);
		border-top: 1px solid var(--line);
	}
	.foot {
		display: flex;
		align-items: center;
		gap: var(--space-3);
	}
	.danger {
		height: 40px;
		padding: 0 16px;
		border-radius: 20px;
		border: 1px solid var(--alert-line);
		background: none;
		color: var(--alert);
		font: inherit;
		font-weight: 700;
	}
	code {
		font-family: var(--font-num);
	}
	.quiet {
		color: var(--ink-muted);
	}
	.trouble {
		margin: 0 0 var(--space-3);
		padding: var(--space-3);
		border-radius: 10px;
		background: var(--alert-bg);
		color: var(--alert);
		font-weight: 600;
	}
</style>
