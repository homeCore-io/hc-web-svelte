<!--
	Making a rotation: a device, what to choose among (its favorites, playlists,
	presets, as it has them now), in what order, and how often it moves on.
	Saved, it can be tried here, and played by a rule with Play from a rotation.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import ChevronUp from '@lucide/svelte/icons/chevron-up';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import X from '@lucide/svelte/icons/x';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import { rotations } from '#lib/rotations.svelte.js';
	import {
		ORDERS,
		WEEKDAYS,
		fullTime,
		hhmm,
		tidyWhen,
		whenWords,
		type ChoiceWhen,
		choiceKind,
		choiceName,
		choiceSources,
		commandFor,
		cronLooksRight,
		isChoice,
		rotatable,
		type ChoiceSource,
		type PeriodUnit,
		type RotationAdvance,
		type RotationChoice,
		type RotationOrder
	} from '#lib/rotations.js';
	import { devices } from '#lib/devices.svelte.js';
	import { displayName } from '#lib/devices.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { roomOf } from '#lib/summary.js';
	import { session } from '#lib/me.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { ask } from '#lib/confirm.svelte.js';
	import type { Option } from '#lib/details.js';

	const id = $derived(page.params.id ?? 'new');
	const isNew = $derived(id === 'new');
	const saved = $derived(isNew ? undefined : rotations.byId(id));

	let name = $state('');
	let deviceId = $state('');
	let choices = $state<RotationChoice[]>([]);
	let order = $state<RotationOrder>('in_turn');
	type Pace = 'each_use' | 'every' | 'schedule';
	let pace = $state<Pace>('each_use');
	let everyN = $state(1);
	let everyUnit = $state<PeriodUnit>('day');
	let cron = $state('0 0 */2 * * *');
	let note = $state<string | null>(null);
	let busy = $state(false);
	let filled = $state<string | null>(null);

	$effect(() => {
		if (session.can('automations:read')) void rotations.load();
	});

	// Fill the form once per rotation opened, when it has arrived.
	$effect(() => {
		const key = id;
		const r = saved;
		untrack(() => {
			if (filled === key) return;
			if (isNew) {
				name = '';
				deviceId = page.url.searchParams.get('for') ?? '';
				choices = [];
				order = 'in_turn';
				pace = 'each_use';
				filled = key;
			} else if (r) {
				name = r.name;
				deviceId = r.device_id;
				choices = r.choices.map((c) => ({ ...c, command: { ...c.command } }));
				order = r.order;
				const a = r.advance;
				if (a === 'each_use') pace = 'each_use';
				else if ('every' in a) {
					pace = 'every';
					everyN = a.every.n;
					everyUnit = a.every.unit;
				} else {
					pace = 'schedule';
					cron = a.schedule.cron;
				}
				filled = key;
			}
		});
	});

	const title = $derived(isNew ? 'New rotation' : (saved?.name ?? 'Rotation'));
	$effect(() => heading.show(title, { href: '/settings/rotations', label: 'Rotations' }));

	// ---- the device and what it offers ----
	const candidates = $derived(
		Object.values(devices.byId)
			.filter(rotatable)
			.map((d) => ({ d, name: displayName(d), room: roomOf(d, rooms.list)?.name }))
			.sort((a, b) => a.name.localeCompare(b.name))
	);
	const device = $derived(devices.byId[deviceId]);
	const sources = $derived<ChoiceSource[]>(device ? choiceSources(device) : []);

	const chosenIndex = (s: ChoiceSource, o: Option) => choices.findIndex((c) => isChoice(c, s, o));
	function toggle(s: ChoiceSource, o: Option) {
		const i = chosenIndex(s, o);
		choices =
			i >= 0 ? choices.filter((_, j) => j !== i) : [...choices, { command: commandFor(s, o) }];
	}
	function move(i: number, by: number) {
		const j = i + by;
		if (j < 0 || j >= choices.length) return;
		const next = [...choices];
		[next[i], next[j]] = [next[j]!, next[i]!];
		choices = next;
	}
	/** Whether the device still lists it (else it is skipped when it comes round). */
	const stillThere = (c: RotationChoice) =>
		!sources.some((s) => s.action.id === c.command.action) ||
		sources.some((s) => s.options.some((o) => isChoice(c, s, o)));

	async function changeDevice(next: string) {
		if (choices.length && next !== deviceId) {
			const yes = await ask({
				title: 'Choose for another device?',
				body: 'Its choices are for this one, so they go.',
				go: 'Change device'
			});
			if (!yes) return;
			choices = [];
		}
		deviceId = next;
	}

	// ---- when each choice may play ----
	const modes = $derived(
		Object.values(devices.byId)
			.filter((d) => d.plugin_id === 'core.mode')
			.map((d) => ({ id: d.device_id, name: displayName(d) }))
			.sort((a, b) => a.name.localeCompare(b.name))
	);
	const modeName = (id: string) => modes.find((m) => m.id === id)?.name ?? id;
	let openWhen = $state<number | null>(null);
	function setWhen(i: number, change: (w: ChoiceWhen) => ChoiceWhen) {
		const next = [...choices];
		const c = next[i]!;
		const only_when = tidyWhen(change({ ...(c.only_when ?? {}) }));
		next[i] = only_when ? { ...c, only_when } : { label: c.label, command: c.command };
		choices = next;
	}
	const flip = <T,>(list: T[] | undefined, x: T) =>
		(list ?? []).includes(x) ? (list ?? []).filter((y) => y !== x) : [...(list ?? []), x];

	// ---- saving ----
	const advance = $derived<RotationAdvance>(
		pace === 'each_use'
			? 'each_use'
			: pace === 'every'
				? { every: { n: Math.max(1, Math.round(everyN) || 1), unit: everyUnit } }
				: { schedule: { cron: cron.trim() } }
	);
	const problem = $derived(
		!name.trim()
			? 'Give it a name.'
			: !deviceId
				? 'Choose a device.'
				: choices.length === 0
					? 'Choose at least one thing for it to play.'
					: pace === 'schedule' && !cronLooksRight(cron)
						? 'A schedule has six parts, seconds first: 0 0 */2 * * * is every two hours.'
						: null
	);

	async function save() {
		if (problem) return void (note = problem);
		busy = true;
		const r = await rotations.save(isNew ? null : id, {
			name: name.trim(),
			device_id: deviceId,
			choices,
			order,
			advance
		});
		busy = false;
		if (typeof r === 'string') return void (note = r);
		note = 'Saved.';
		if (isNew) {
			filled = r.id;
			void goto(`/settings/rotations/${r.id}`, { replace: true });
		}
	}

	async function tryIt() {
		busy = true;
		const r = await rotations.play(id);
		busy = false;
		note = typeof r === 'string' ? r : `Playing ${r.played}.`;
	}

	async function remove() {
		const yes = await ask({
			title: `Delete ${saved?.name ?? 'this rotation'}?`,
			body: 'Rules that play from it will play nothing.',
			go: 'Delete',
			danger: true
		});
		if (!yes) return;
		const r = await rotations.remove(id);
		if (r === true) void goto('/settings/rotations');
		else note = r;
	}
</script>

{#if !session.can('automations:write')}
	<p class="quiet">Making rotations is for those who may change automations.</p>
{:else if !isNew && rotations.loaded && !saved}
	<p class="quiet">This rotation is gone. <a href="/settings/rotations">All rotations</a></p>
{:else}
	<div class="page">
		<label class="field">
			<span>Name</span>
			<input type="text" bind:value={name} placeholder="Bathroom music" />
		</label>

		<label class="field">
			<span>Device</span>
			<select value={deviceId} onchange={(e) => changeDevice(e.currentTarget.value)}>
				<option value="" disabled>Choose a device…</option>
				{#each candidates as c (c.d.device_id)}
					<option value={c.d.device_id}>{c.name}{c.room ? ` · ${c.room}` : ''}</option>
				{/each}
				{#if deviceId && !device}<option value={deviceId}>{deviceId} (gone)</option>{/if}
			</select>
		</label>

		{#if device}
			<section>
				<h2>What it plays from</h2>
				{#if sources.every((s) => s.options.length === 0)}
					<p class="quiet">
						{displayName(device)} doesn't list any yet. Its plugin fills these in once it has looked.
					</p>
				{/if}
				{#each sources as s (s.action.id)}
					{#if s.options.length}
						<fieldset class="source">
							<legend>{s.action.label}</legend>
							<div class="opts">
								{#each s.options as o (o.value)}
									{@const n = chosenIndex(s, o)}
									<label class="opt" class:on={n >= 0}>
										<input type="checkbox" checked={n >= 0} onchange={() => toggle(s, o)} />
										<span>{o.label}</span>
										{#if n >= 0}<span class="num">{n + 1}</span>{/if}
									</label>
								{/each}
							</div>
						</fieldset>
					{/if}
				{/each}
			</section>
		{/if}

		{#if choices.length}
			<section>
				<h2>In this order</h2>
				<ol class="chosen">
					{#each choices as c, i (i)}
						<li>
							<span class="text">
								<span class="nm">{choiceName(c, sources)}</span>
								<span class="sub">{choiceKind(c, sources) ?? String(c.command.action ?? '')}</span>
								{#if !stillThere(c)}
									<span class="warn"
										><CircleAlert size={14} aria-hidden="true" />Gone from the device; skipped when
										it comes round</span
									>
								{/if}
								<button
									type="button"
									class="when"
									class:limited={!!c.only_when}
									aria-expanded={openWhen === i}
									onclick={() => (openWhen = openWhen === i ? null : i)}
									>{c.only_when ? whenWords(c.only_when, modeName) : 'Any time · limit it…'}</button
								>
							</span>
							<button
								type="button"
								class="icon"
								aria-label={`Move ${choiceName(c, sources)} up`}
								disabled={i === 0}
								onclick={() => move(i, -1)}><ChevronUp size={18} /></button
							>
							<button
								type="button"
								class="icon"
								aria-label={`Move ${choiceName(c, sources)} down`}
								disabled={i === choices.length - 1}
								onclick={() => move(i, 1)}><ChevronDown size={18} /></button
							>
							<button
								type="button"
								class="icon"
								aria-label={`Take ${choiceName(c, sources)} out`}
								onclick={() => (choices = choices.filter((_, j) => j !== i))}
								><X size={18} /></button
							>
							{#if openWhen === i}
								{@const w = c.only_when ?? {}}
								<div class="whenedit">
									{#if modes.length}
										<div class="wrow">
											<span class="wk">When</span>
											<div class="chips">
												{#each modes as m (m.id)}
													<button
														type="button"
														aria-pressed={w.modes?.includes(m.id) ?? false}
														onclick={() =>
															setWhen(i, (x) => ({ ...x, modes: flip(x.modes, m.id) }))}
														>{m.name} is on</button
													>
												{/each}
											</div>
										</div>
									{/if}
									<div class="wrow">
										<label class="wk"
											><input
												type="checkbox"
												checked={!!w.between}
												onchange={(e) =>
													setWhen(i, (x) => ({
														...x,
														between: e.currentTarget.checked
															? { start: '22:00:00', end: '06:00:00' }
															: undefined
													}))}
											/> Between</label
										>
										{#if w.between}
											<input
												type="time"
												aria-label="From"
												value={hhmm(w.between.start)}
												onchange={(e) =>
													setWhen(i, (x) => ({
														...x,
														between: { start: fullTime(e.currentTarget.value), end: x.between!.end }
													}))}
											/>
											<span>and</span>
											<input
												type="time"
												aria-label="Until"
												value={hhmm(w.between.end)}
												onchange={(e) =>
													setWhen(i, (x) => ({
														...x,
														between: {
															start: x.between!.start,
															end: fullTime(e.currentTarget.value)
														}
													}))}
											/>
										{/if}
									</div>
									<div class="wrow">
										<span class="wk">On</span>
										<div class="chips">
											{#each WEEKDAYS as d (d)}
												<button
													type="button"
													aria-pressed={w.days?.includes(d) ?? false}
													onclick={() => setWhen(i, (x) => ({ ...x, days: flip(x.days, d) }))}
													>{d}</button
												>
											{/each}
										</div>
									</div>
									<p class="quiet">
										Outside this it is passed over, and one playing gives way to the next that is
										for now. No days ticked means every day.
									</p>
								</div>
							{/if}
						</li>
					{/each}
				</ol>
			</section>
		{/if}

		<section>
			<h2>Order</h2>
			<div class="seg" role="radiogroup" aria-label="Order">
				{#each ORDERS as o (o.value)}
					<button
						type="button"
						role="radio"
						aria-checked={order === o.value}
						onclick={() => (order = o.value)}>{o.label}</button
					>
				{/each}
			</div>
			<p class="quiet">{ORDERS.find((o) => o.value === order)?.hint}</p>
		</section>

		<section>
			<h2>Moves on</h2>
			<div class="seg" role="radiogroup" aria-label="Moves on">
				<button
					type="button"
					role="radio"
					aria-checked={pace === 'each_use'}
					onclick={() => (pace = 'each_use')}>Each time</button
				>
				<button
					type="button"
					role="radio"
					aria-checked={pace === 'every'}
					onclick={() => (pace = 'every')}>Every so often</button
				>
				<button
					type="button"
					role="radio"
					aria-checked={pace === 'schedule'}
					onclick={() => (pace = 'schedule')}>On a schedule</button
				>
			</div>
			{#if pace === 'each_use'}
				<p class="quiet">Every time a rule plays it, the next one.</p>
			{:else if pace === 'every'}
				<div class="row">
					<span>Every</span>
					<input type="number" min="1" class="n" bind:value={everyN} aria-label="How many" />
					<select bind:value={everyUnit} aria-label="Hours, days or weeks">
						<option value="hour">{everyN === 1 ? 'hour' : 'hours'}</option>
						<option value="day">{everyN === 1 ? 'day' : 'days'}</option>
						<option value="week">{everyN === 1 ? 'week' : 'weeks'}</option>
					</select>
				</div>
				<p class="quiet">
					Until then, every time it plays it plays the same one: one playlist all morning, however
					often someone walks in.
				</p>
			{:else}
				<label class="field">
					<span>Schedule</span>
					<input type="text" class="mono" bind:value={cron} />
				</label>
				<p class="quiet">
					A new one each time this comes round, in the scheduler's form, seconds first:
					<code>0 0 */2 * * *</code> every two hours, <code>0 0 8 * * Mon-Fri</code> weekday mornings.
				</p>
			{/if}
		</section>

		{#if note}<p class="note" role="status">{note}</p>{/if}

		<div class="actions">
			<button type="button" class="primary" disabled={busy} onclick={save}>Save</button>
			{#if !isNew && session.mayUse}
				<button type="button" class="btn" disabled={busy} onclick={tryIt}>Play now</button>
			{/if}
			{#if !isNew}
				<button type="button" class="btn danger" disabled={busy} onclick={remove}>Delete</button>
			{/if}
		</div>
		{#if !isNew}
			<p class="quiet">
				A rule plays it with the step <b>Play from a rotation</b>, and moves it on without playing
				with <b>Move a rotation on</b>.
			</p>
		{/if}
	</div>
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: var(--space-4);
		max-width: 760px;
	}
	section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	h2 {
		margin: 0;
		font-size: 15px;
	}
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
		font-weight: 600;
		font-size: 14px;
	}
	input[type='text'],
	input[type='number'],
	select {
		height: 42px;
		padding: 0 12px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 400;
	}
	.mono {
		font-family: var(--mono, ui-monospace, monospace);
	}
	.source {
		margin: 0;
		padding: var(--space-2) var(--space-3) var(--space-3);
		border: 1px solid var(--card-line);
		border-radius: var(--radius);
		background: var(--surface);
	}
	legend {
		padding: 0 6px;
		font-weight: 600;
		font-size: 14px;
	}
	.opts {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.opt {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		min-height: 40px;
		padding: 0 12px;
		border-radius: 20px;
		border: 1px solid var(--line);
		background: var(--bg);
		cursor: pointer;
	}
	.opt.on {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 12%, var(--bg));
	}
	.opt input {
		margin: 0;
	}
	.num {
		display: grid;
		place-items: center;
		min-width: 22px;
		height: 22px;
		border-radius: 11px;
		background: var(--accent);
		color: var(--accent-ink);
		font-size: 12px;
		font-weight: 700;
	}
	.chosen {
		list-style: none;
		margin: 0;
		padding: 0;
		border-radius: var(--radius);
		border: 1px solid var(--card-line);
		background: var(--surface);
		overflow: hidden;
	}
	.chosen li {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px;
		padding: 6px var(--space-2) 6px var(--space-3);
		min-height: 56px;
	}
	.chosen li + li {
		border-top: 1px solid var(--line);
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: 2px;
		flex: 1;
		min-width: 0;
	}
	.nm {
		font-weight: 600;
	}
	.sub {
		color: var(--ink-muted);
		font-size: 13px;
	}
	.warn {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		color: var(--alert);
		font-size: 13px;
	}
	.icon {
		flex: none;
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border-radius: 20px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
	}
	.icon:disabled {
		opacity: 0.4;
	}
	.seg {
		display: inline-flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.seg button {
		height: 38px;
		padding: 0 14px;
		border-radius: 19px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 600;
		font-size: 14px;
	}
	.seg button[aria-checked='true'] {
		background: var(--ink);
		color: var(--bg);
		border-color: var(--ink);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.n {
		width: 80px;
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
		line-height: 1.45;
	}
	.note {
		margin: 0;
		padding: var(--space-2) var(--space-3);
		border-radius: 10px;
		background: var(--lit-bg);
		color: var(--lit-ink);
		font-weight: 600;
	}
	.actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--space-2);
	}
	.primary,
	.btn {
		height: 42px;
		padding: 0 18px;
		border-radius: 21px;
		font: inherit;
		font-weight: 700;
	}
	.primary {
		border: none;
		background: var(--accent);
		color: var(--accent-ink);
	}
	.btn {
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
	}
	.btn.danger {
		color: var(--alert);
	}
	.primary:disabled,
	.btn:disabled {
		opacity: 0.6;
	}
	.when {
		align-self: flex-start;
		padding: 0;
		border: none;
		background: none;
		color: var(--accent);
		font: inherit;
		font-size: 13px;
		font-weight: 600;
		text-align: left;
	}
	.when:not(.limited) {
		color: var(--ink-muted);
		font-weight: 500;
	}
	.whenedit {
		flex-basis: 100%;
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
		margin: 4px 0 6px;
		padding: var(--space-3);
		border-radius: 12px;
		background: var(--bg);
		border: 1px solid var(--line);
	}
	.wrow {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 8px;
	}
	.wk {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-width: 70px;
		font-weight: 600;
		font-size: 14px;
	}
	input[type='time'] {
		height: 38px;
		padding: 0 8px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.chips button {
		height: 34px;
		padding: 0 12px;
		border-radius: 17px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font: inherit;
		font-weight: 600;
		font-size: 13px;
	}
	.chips button[aria-pressed='true'] {
		background: var(--ink);
		color: var(--bg);
		border-color: var(--ink);
	}
</style>
