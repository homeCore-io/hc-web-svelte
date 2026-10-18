<!--
	Helpers (A1): devices homeCore provides for rules to use — timers,
	switches, counters, groups and more. Make one, run it by hand, change its
	settings, see which rules use it, delete it.
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { liveRules } from '#lib/rules.svelte.js';
	import { core } from '#lib/core.svelte.js';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import Plus from '@lucide/svelte/icons/plus';
	import Minus from '@lucide/svelte/icons/minus';
	import { devices } from '#lib/devices.svelte.js';
	import { displayName, type CoreDevice } from '#lib/devices.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { wide } from '#lib/wide.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import { clock as now } from '#lib/clock.svelte.js';
	import { cardFor } from '#lib/card.js';
	import { roomOf } from '#lib/summary.js';
	import { FormState } from '#lib/form.svelte.js';
	import { describe, valuesOf } from '#lib/descriptor.js';
	import {
		clock,
		configFrom,
		createBody,
		descriptorOf,
		helperKinds,
		idFor,
		isHelper,
		remaining,
		valuesFrom,
		type HelperType
	} from '#lib/helpers.js';
	import { rulesNaming, type RuleRef } from '#lib/uses.js';
	import { deleteDevices, deviceCall, patchDevice } from '#lib/deviceAdmin.js';
	import ListDetail from '#lib/components/admin/ListDetail.svelte';
	import SaveBar from '#lib/components/admin/SaveBar.svelte';
	import SectionForm from '#lib/components/form/SectionForm.svelte';
	import Toggle from '#lib/components/Toggle.svelte';

	// A second's tick while a timer is shown running.
	let tick = $state(Date.now());
	onMount(() => {
		const t = setInterval(() => (tick = Date.now()), 1000);
		return () => clearInterval(t);
	});

	const rules: RuleRef[] = $derived(liveRules.list);
	onMount(() => liveRules.start());

	const helpers = $derived(
		Object.values(devices.byId)
			.filter(isHelper)
			.sort((a, b) => displayName(a).localeCompare(displayName(b)))
	);
	// ---- which: ?h=id, ?new, ?new=type ----
	const asked = $derived(page.url.searchParams.get('h'));
	const newType = $derived(page.url.searchParams.get('new'));
	const making = $derived(page.url.searchParams.has('new'));
	const choices = $derived(
		Object.values(devices.byId)
			.filter((d) => d.device_type !== 'scene' && d.device_id !== asked)
			.map((d) => ({
				value: d.device_id,
				label: `${displayName(d)} · ${roomOf(d, rooms.list)?.name ?? 'no room'}`
			}))
			.sort((a, b) => a.label.localeCompare(b.label))
	);
	const kinds = $derived(helperKinds(choices, core.since('0.1.82')));
	const groups = $derived(
		kinds
			.map((k) => ({ kind: k, items: helpers.filter((h) => (h.device_type ?? '') === k.type) }))
			.filter((g) => g.items.length > 0)
	);

	const helper = $derived<CoreDevice | undefined>(
		(asked ? devices.byId[asked] : undefined) ??
			(wide.current && !making && !asked ? helpers[0] : undefined)
	);
	const kind = $derived(kinds.find((k) => k.type === (making ? newType : helper?.device_type)));
	const chosen = $derived(asked !== null || making);
	const open = (q: string) =>
		goto(`/settings/helpers${q}`, { replace: wide.current, reset: !wide.current });
	$effect(() =>
		!wide.current && chosen
			? heading.show(
					making
						? kind
							? `New ${kind.label.toLowerCase()}`
							: 'New helper'
						: helper
							? displayName(helper)
							: 'Helper',
					making && kind
						? { href: '/settings/helpers?new', label: 'Kinds' }
						: { href: '/settings/helpers', label: 'Helpers' }
				)
			: undefined
	);

	// ---- the form: settings when editing; name, room and settings when making ----
	const form = new FormState();
	let name = $state('');
	let roomId = $state('');
	let trouble = $state<string | null>(null);
	let saving = $state(false);
	// Keyed on the kind and the helper's id only: a device arriving elsewhere
	// in the house must not reset what's being typed.
	const kindType = $derived(kind?.type);
	const helperId = $derived(helper?.device_id);
	$effect.pre(() => {
		void kindType;
		void helperId;
		const isNew = making;
		untrack(() => {
			const k = kind;
			const h = helper;
			trouble = null;
			if (!k) return;
			form.descriptor = descriptorOf(isNew ? k.create : k.edit);
			form.load(isNew ? {} : valuesOf(form.descriptor, valuesFrom(k.type, h?.attributes ?? {})));
			name = isNew ? '' : h ? displayName(h) : '';
			roomId = isNew ? '' : (h && roomOf(h, rooms.list)?.id) || '';
		});
	});
	// The settings' choices (devices for groups and thresholds) follow the
	// house; what's been typed stays.
	$effect(() => {
		if (kind) form.descriptor = descriptorOf(making ? kind.create : kind.edit);
	});
	const room = $derived(helper ? roomOf(helper, rooms.list) : undefined);
	const identityChanged = $derived(
		!!helper && !making && (name.trim() !== displayName(helper) || roomId !== (room?.id ?? ''))
	);
	const dirty = $derived(making || form.dirty || identityChanged);
	const newId = $derived(kind && name.trim() ? idFor(kind.type, name) : '');
	const blocked = $derived(
		making && name.trim() === ''
			? 'Give it a name.'
			: making && devices.byId[newId]
				? `There is already a ${kind?.label.toLowerCase()} called that.`
				: form.blocked
					? 'Fill in or fix the settings marked in red first.'
					: null
	);
	const summary = $derived(
		making
			? `Rules will call it ${newId || '…'}`
			: [
					...(identityChanged ? ['Name or room'] : []),
					...form.changes.map((c) => `${c.field.label}: ${describe(c.field, c.now)}`)
				].join(' · ')
	);

	async function save() {
		if (!kind) return;
		saving = true;
		const roomName = rooms.list.find((r) => r.id === roomId)?.name ?? null;
		if (making) {
			const body = createBody(kind.type, name, form.draft);
			const id = idFor(kind.type, name);
			const k = kind;
			const draft = $state.snapshot(form.draft);
			trouble = await deviceCall('POST', '/glue', body);
			// homeCore takes a timer's settings only after it exists.
			if (!trouble && kind.type === 'timer') {
				const config = configFrom('timer', k.edit, draft);
				if (Object.keys(config).length)
					trouble = await deviceCall('PATCH', `/glue/${id}`, { config });
			}
			if (!trouble && roomName) trouble = await patchDevice(id, { area: roomName });
			saving = false;
			if (!trouble) {
				await devices.refresh(id);
				void open(`?h=${encodeURIComponent(id)}`);
			}
			return;
		}
		if (!helper) return;
		const id = helper.device_id;
		if (identityChanged) trouble = await patchDevice(id, { name: name.trim(), area: roomName });
		if (!trouble && form.dirty) {
			const config = configFrom(kind.type, kind.edit, form.draft);
			trouble = await deviceCall('PATCH', `/glue/${id}`, { config });
		}
		saving = false;
		// homeCore doesn't announce a helper's new settings; read it again.
		if (!trouble) {
			await devices.refresh(id);
			const fresh = devices.byId[id];
			if (fresh) form.load(valuesOf(form.descriptor, valuesFrom(kind.type, fresh.attributes)));
		}
	}
	function discard() {
		if (making) return void open('');
		form.discard();
		if (helper) {
			name = displayName(helper);
			roomId = room?.id ?? '';
		}
	}

	// ---- running it by hand ----
	const command = async (body: Record<string, unknown>) => {
		if (!helper) return;
		trouble = await deviceCall(
			'PATCH',
			`/devices/${encodeURIComponent(helper.device_id)}/state`,
			body
		);
	};
	const a = $derived(helper?.attributes ?? {});
	const left = $derived(helper ? remaining(a, tick) : null);
	let setTo = $state('');

	// ---- uses and delete ----
	const using = $derived(helper ? rulesNaming(rules, helper.device_id, helper.canonical_name) : []);
	async function remove() {
		if (!helper) return;
		const label = displayName(helper);
		const yes = await ask({
			title: `Delete ${label}?`,
			lost:
				using.length > 0
					? [
							`${using.length === 1 ? 'One rule uses' : `${using.length} rules use`} it, and ${using.length === 1 ? 'is' : 'are'} turned off until changed: ${using.map((r) => r.name).join(', ')}.`
						]
					: ['No rules use it.'],
			go: 'Delete',
			danger: true
		});
		if (!yes) return;
		const done = await deleteDevices([helper.device_id]);
		if (done.error) return void (trouble = done.error);
		void open('');
	}
</script>

{#if !session.can('devices:write')}
	<p class="quiet">Helpers are for people who may change the house.</p>
{:else}
	<p class="intro">Devices homeCore provides, for rules to use.</p>
	<ListDetail {chosen} label="Helpers">
		{#snippet list()}
			<button type="button" class="new" onclick={() => open('?new')}
				><Plus size={16} aria-hidden="true" />New helper</button
			>
			{#if groups.length === 0}
				<p class="quiet">No helpers yet.</p>
			{/if}
			{#each groups as g (g.kind.type)}
				<h2>{g.kind.plural}</h2>
				<ul class="items">
					{#each g.items as h (h.device_id)}
						{@const r = roomOf(h, rooms.list)}
						<li>
							<a
								href={`?h=${encodeURIComponent(h.device_id)}`}
								aria-current={helper === h && !making ? 'page' : undefined}
								onclick={(e) => {
									e.preventDefault();
									void open(`?h=${encodeURIComponent(h.device_id)}`);
								}}
							>
								<span class="text">
									<strong>{displayName(h)}</strong>
									<span class="sub">{r?.name ?? 'No room'}</span>
								</span>
								<span class="state">{cardFor(h, now.now).stateLine}</span>
							</a>
						</li>
					{/each}
				</ul>
			{/each}
		{/snippet}
		{#snippet detail()}
			{#if making && !kind}
				<section class="card">
					{#if wide.current}<h2 class="title">New helper</h2>{/if}
					<p class="quiet">What should it be?</p>
					<div class="kinds">
						{#each kinds as k (k.type)}
							<button type="button" onclick={() => open(`?new=${k.type}`)}>
								<strong>{k.label}</strong>
								<span>{k.what}</span>
							</button>
						{/each}
					</div>
				</section>
			{:else if kind && (making || helper)}
				<section class="card">
					{#if wide.current}
						<h2 class="title">
							{making ? `New ${kind.label.toLowerCase()}` : displayName(helper!)}
						</h2>
					{/if}
					{#if making}<p class="quiet">{kind.what}</p>{/if}
					{#if trouble}<p class="trouble" role="alert">{trouble}</p>{/if}

					{#if helper && !making}
						<div
							class="live"
							class:on={a.on === true ||
								a.state === 'running' ||
								a.active === true ||
								a.above === true}
						>
							{#if kind.type === 'timer'}
								<span class="big"
									>{left !== null ? clock(left) : clock(Number(a.duration_secs) || 0)}</span
								>
								<span class="what">{cardFor(helper, now.now).stateLine}</span>
								{#if a.state === 'running'}
									<button type="button" onclick={() => command({ command: 'pause' })}>Pause</button>
									<button type="button" onclick={() => command({ command: 'cancel' })}
										>Cancel</button
									>
								{:else if a.state === 'paused'}
									<button type="button" onclick={() => command({ command: 'resume' })}
										>Resume</button
									>
									<button type="button" onclick={() => command({ command: 'cancel' })}
										>Cancel</button
									>
								{:else}
									<button
										type="button"
										disabled={!(Number(a.default_secs ?? a.duration_secs) > 0)}
										title={Number(a.default_secs ?? a.duration_secs) > 0
											? undefined
											: 'Set how long it runs for first'}
										onclick={() =>
											command({
												command: 'start',
												duration_secs: Number(a.default_secs ?? a.duration_secs)
											})}>Start</button
									>
								{/if}
							{:else if kind.type === 'switch'}
								<span class="what">{a.on ? 'On' : 'Off'}</span>
								<Toggle
									on={a.on === true}
									label={displayName(helper)}
									onchange={(on) => command({ on })}
								/>
							{:else if kind.type === 'counter'}
								<span class="big">{String(a.count ?? 0)}</span>
								<button
									type="button"
									aria-label="Count down"
									onclick={() => command({ command: 'decrement' })}><Minus size={16} /></button
								>
								<button
									type="button"
									aria-label="Count up"
									onclick={() => command({ command: 'increment' })}><Plus size={16} /></button
								>
								<button type="button" onclick={() => command({ command: 'reset' })}>Reset</button>
							{:else if kind.type === 'button'}
								<span class="what">{cardFor(helper, now.now).stateLine}</span>
								<button type="button" onclick={() => command({ command: 'press' })}>Press</button>
							{:else if kind.type === 'select'}
								<span class="what">Now</span>
								<select
									value={String(a.selected ?? '')}
									onchange={(e) => command({ command: 'select', option: e.currentTarget.value })}
								>
									{#each Array.isArray(a.options) ? a.options : [] as o (String(o))}<option
											value={String(o)}>{String(o)}</option
										>{/each}
								</select>
							{:else if kind.type === 'number' || kind.type === 'text' || kind.type === 'datetime'}
								<span class="big"
									>{String(a.value ?? '') || '—'}{kind.type === 'number' && a.unit
										? ` ${a.unit}`
										: ''}</span
								>
								<input
									bind:value={setTo}
									aria-label="Set to"
									placeholder={kind.type === 'datetime' ? '2026-10-17T07:00' : 'Set to'}
								/>
								<button
									type="button"
									disabled={setTo.trim() === ''}
									onclick={() => {
										const v = kind.type === 'number' ? Number(setTo) : setTo;
										void command({ command: 'set', value: v });
										setTo = '';
									}}>Set</button
								>
								{#if kind.type === 'number'}
									<button
										type="button"
										aria-label="Down a step"
										onclick={() => command({ command: 'decrement' })}><Minus size={16} /></button
									>
									<button
										type="button"
										aria-label="Up a step"
										onclick={() => command({ command: 'increment' })}><Plus size={16} /></button
									>
								{:else if a.value !== undefined && a.value !== ''}
									<button type="button" onclick={() => command({ command: 'clear' })}>Clear</button>
								{/if}
							{:else}
								<span class="what">{cardFor(helper, now.now).stateLine}</span>
							{/if}
						</div>
					{/if}

					<div class="identity">
						<label>
							<span>Name</span>
							<input
								bind:value={name}
								placeholder={kind.type === 'counter' ? 'Deck Door Opens' : 'Name'}
							/>
						</label>
						<label>
							<span>Room</span>
							<select bind:value={roomId}>
								<option value="">No room</option>
								{#each [...rooms.list].sort((x, y) => x.name.localeCompare(y.name)) as r (r.id)}
									<option value={r.id}>{r.name}</option>
								{/each}
							</select>
						</label>
					</div>
					{#if form.descriptor.sections[0]?.fields.length}
						<SectionForm {form} section={form.descriptor.sections[0]} showKeys={false} />
					{/if}
					{#if kind.type === 'schedule' && !making && !core.since('0.1.82')}
						<p class="quiet">
							homeCore can’t change a schedule’s times once it’s made: delete it and make it again.
						</p>
					{/if}

					{#if helper && !making}
						<div class="uses">
							<h3>Rules that use it</h3>
							{#if using.length === 0}
								<p class="quiet">None yet. Rules call it <code>{helper.device_id}</code>.</p>
							{:else}
								<ul>
									{#each using as r (r.id)}<li>
											<a href={`/settings/automations/${encodeURIComponent(r.id)}`}>{r.name}</a>
										</li>{/each}
								</ul>
							{/if}
						</div>
						<div class="foot">
							<button type="button" class="danger" onclick={remove}>Delete…</button>
							{#if using.length > 0}
								<span class="quiet"
									>Deleting it turns off the {using.length === 1 ? 'rule' : `${using.length} rules`} above
									until they’re changed.</span
								>
							{/if}
						</div>
					{/if}
				</section>
			{/if}
		{/snippet}
	</ListDetail>
	{#if dirty && kind}
		<SaveBar
			count={making ? 1 : form.changes.length + (identityChanged ? 1 : 0)}
			{summary}
			{saving}
			{blocked}
			{save}
			{discard}
			saveLabel={making ? 'Make it' : 'Save'}
		/>
	{/if}
{/if}

<style>
	.intro {
		margin: 0 0 var(--space-3);
		color: var(--ink-muted);
	}
	.new {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 40px;
		padding: 0 16px;
		margin-bottom: var(--space-3);
		border-radius: 20px;
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
		font: inherit;
		font-weight: 700;
	}
	h2 {
		margin: var(--space-3) 0 6px;
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	h2.title {
		margin: 0;
		font-size: 20px;
		letter-spacing: 0;
		text-transform: none;
		color: var(--ink);
	}
	.items {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.items a {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		min-height: 54px;
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
	.sub,
	.state {
		color: var(--ink-muted);
		font-size: 13px;
	}
	.state {
		text-align: right;
		max-width: 45%;
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
	.kinds {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
		gap: var(--space-2);
	}
	.kinds button {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 4px;
		padding: var(--space-3);
		border-radius: 12px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		text-align: left;
	}
	.kinds span {
		color: var(--ink-muted);
		font-size: 13px;
		line-height: 1.4;
	}
	.live {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		padding: var(--space-3) var(--space-4);
		border-radius: 12px;
		background: var(--bg);
		border: 1px solid var(--card-line);
	}
	.live.on {
		background: var(--lit-bg);
		color: var(--lit-ink);
		border-color: var(--lit-card-line);
	}
	.big {
		font-family: var(--font-num);
		font-size: 28px;
		font-weight: 600;
	}
	.what {
		flex: 1;
		font-weight: 600;
	}
	.live button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 40px;
		height: 38px;
		padding: 0 14px;
		border-radius: 19px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 700;
	}
	.live button:disabled {
		opacity: 0.5;
	}
	.identity {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: var(--space-3);
	}
	.identity label {
		display: flex;
		flex-direction: column;
		gap: 4px;
		font-weight: 600;
		font-size: 14px;
	}
	input,
	select {
		height: 40px;
		box-sizing: border-box;
		padding: 0 12px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--bg);
		color: var(--ink);
		font: inherit;
		font-weight: 400;
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
		flex-wrap: wrap;
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
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
		line-height: 1.5;
	}
	code {
		font-family: var(--font-num);
	}
	.trouble {
		margin: 0;
		padding: var(--space-3);
		border-radius: 10px;
		background: var(--alert-bg);
		color: var(--alert);
		font-weight: 600;
	}
</style>
