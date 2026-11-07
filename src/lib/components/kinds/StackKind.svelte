<!--
	A stack (13 §13.2): several things in one tall card, a line or a tile
	each, drawn as its settings say: a list, pills, rockers, a keypad, or
	what's busy with the rest folded. Things of any kind mix, each with its own
	control: a switch to flip, a scene to run, a lock to lock (asking where it
	should before unlocking), or only its state. Its name opens a device.

	One card wide or two (its size); as tall as its things need, or two or
	three cards tall, scrolling inside.
-->
<script lang="ts">
	import { page as here } from '$app/state';
	import Layers from '@lucide/svelte/icons/layers';
	import { goAhead } from '#lib/ask.js';
	import { cardFor, isOpen, kindOf as typeOf, type CardView, type Control } from '#lib/card.js';
	import { clock } from '#lib/clock.svelte.js';
	import { commands } from '#lib/commands.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { displayName, type CoreDevice } from '#lib/devices.js';
	import type { KindProps } from '#lib/kinds.js';
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { withPending } from '#lib/pending.js';
	import { openDevice } from '#lib/popup.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { scenes } from '#lib/scenes.svelte.js';
	import { across, readStack, STACK_BUILT_IN, stackHeight, stackRows } from '#lib/stack.js';

	let { card, page, label, form, options }: KindProps<'stack'> = $props();
	const s = $derived(readStack(options ?? kindOptions.of(page, 'stack', card.ref, STACK_BUILT_IN)));
	const wide = $derived(form === 'large');

	// On a room's page its things go by their names without the room's.
	const roomName = $derived(
		page.startsWith('room:') ? (rooms.list.find((r) => r.id === page.slice(5))?.name ?? '') : ''
	);
	const short = (n: string) =>
		roomName && n.startsWith(`${roomName} `) && n.length > roomName.length + 1
			? n.slice(roomName.length + 1)
			: n;

	interface Row {
		ref: string;
		name: string;
		device?: CoreDevice;
		view?: CardView;
		/** One of homeCore's scenes, or a plugin's scene device: run on a press. */
		scene?: { id: string; plugin: boolean };
		switchOn?: boolean;
		state: string;
		busy: boolean;
		alert: boolean;
	}

	const rows = $derived.by(() => {
		const out: Row[] = [];
		for (const r of s.things) {
			if (r.startsWith('scene:')) {
				const sc = scenes.list.find((x) => x.id === r.slice(6));
				if (sc)
					out.push({
						ref: r,
						name: short(sc.name),
						scene: { id: sc.id, plugin: false },
						state: 'Scene',
						busy: false,
						alert: false
					});
				continue;
			}
			// Gone, or not this person's to see: no line.
			const d = devices.byId[r.slice(7)];
			if (!d) continue;
			const v = withPending(cardFor(d, clock.now), commands.pending[d.device_id]);
			const isScene =
				typeOf(d) === 'scene' && (d.schema?.actions?.some((a) => a.id === 'activate') ?? false);
			const sw = v.control?.kind === 'switch' ? v.control : undefined;
			const alert = !!v.alarm || v.tone === 'alert';
			out.push({
				ref: r,
				name: short(displayName(d)),
				device: d,
				view: v,
				scene: isScene ? { id: d.device_id, plugin: true } : undefined,
				switchOn: sw?.on,
				// Its state's first part: "Closed", not "Closed · 8 d ago", so the name has room.
				state: isScene ? 'Scene' : (v.stateLine.split(' · ')[0] ?? v.stateLine),
				busy: sw ? sw.on : alert || isOpen(v),
				alert
			});
		}
		return s.busyFirst || s.style === 'folded'
			? [...out.filter((x) => x.busy), ...out.filter((x) => !x.busy)]
			: out;
	});

	let unfolded = $state(false);
	const quiet = $derived(rows.filter((r) => !r.busy).length);
	const folds = $derived(s.style === 'folded' && quiet > 0);
	const shown = $derived(folds && !unfolded ? rows.filter((r) => r.busy) : rows);

	const switches = $derived(rows.filter((r) => r.switchOn !== undefined));
	const onCount = $derived(switches.filter((r) => r.switchOn).length);
	const open = $derived(rows.filter((r) => r.view && isOpen(r.view)).length);
	const alerts = $derived(rows.filter((r) => r.alert).length);
	const summary = $derived.by(() => {
		if (rows.length === 0) return 'Nothing in it yet';
		const parts = [
			...(switches.length ? [`${onCount} of ${switches.length} on`] : []),
			...(open ? [`${open} open`] : []),
			...(alerts ? [`${alerts} ${alerts === 1 ? 'needs' : 'need'} a look`] : [])
		];
		return parts.join(' · ') || 'All quiet';
	});
	const lit = $derived(onCount > 0 || open > 0 || alerts > 0);

	const span = $derived(stackRows(s, wide, shown.length, folds));
	const fixed = $derived(s.height === 'fit' ? undefined : stackHeight(span));

	// Pressed: what a tap does, the way the thing's own card does it.
	let ran = $state<Record<string, boolean>>({});
	async function flip(r: Row) {
		const sw = r.view?.control;
		if (!r.device || sw?.kind !== 'switch') return;
		if (
			!(await goAhead(r.device.device_id, r.view!.kind, `Turn ${r.name} ${sw.on ? 'off' : 'on'}?`))
		)
			return;
		void commands.set(r.device.device_id, r.view!.kind, { [sw.attr]: !sw.on }, r.device.attributes);
	}
	async function control(r: Row, c: Control) {
		const id = r.device!.device_id;
		const kind = r.view!.kind;
		switch (c.kind) {
			case 'switch':
				return flip(r);
			case 'lock':
				// Unlocking asks where someone said it should (C4); locking never does.
				if (c.locked && !(await goAhead(id, kind, `Unlock ${r.name}?`))) return;
				return void commands.set(id, kind, { locked: !c.locked }, r.device!.attributes);
			case 'play':
				return void commands.act(id, c.action);
			case 'timer':
				if (!(await goAhead(id, kind, `${c.running ? 'Cancel' : 'Start'} ${r.name}?`))) return;
				return void commands.timer(
					id,
					c.running ? { command: 'cancel' } : { command: 'start', duration_secs: c.durationSecs }
				);
			case 'button':
				if (!(await goAhead(id, kind, `${c.label} — ${r.name}?`, c.confirm))) return;
				return void commands.act(id, c.action);
		}
	}
	async function run(r: Row) {
		if (!r.scene) return;
		const ok = r.scene.plugin
			? await commands.act(r.scene.id, 'activate')
			: (await scenes.run(r.scene.id)) === true;
		if (!ok) return;
		ran = { ...ran, [r.ref]: true };
		setTimeout(() => (ran = { ...ran, [r.ref]: false }), 3000);
	}
	/** A press on the whole line or tile: its control, a scene's run, or its page. */
	function press(r: Row) {
		if (r.scene) return void (session.mayRunScenes && run(r));
		if (r.view?.control && session.mayUse) return void control(r, r.view.control);
		details(r);
	}
	const details = (r: Row) => r.device && openDevice(r.device.device_id, here.url);
	const may = (r: Row) => (r.scene ? session.mayRunScenes : session.mayUse);

	const actionOf = (r: Row): string | undefined => {
		if (r.scene) return ran[r.ref] ? 'Ran' : 'Run';
		const c = r.view?.control;
		if (!c || c.kind === 'switch') return undefined;
		if (c.kind === 'lock') return c.locked ? 'Unlock…' : 'Lock';
		if (c.kind === 'play') return c.playing ? 'Pause' : 'Play';
		if (c.kind === 'timer') return c.running ? 'Cancel' : 'Start';
		return c.label;
	};
	const pressLabel = (r: Row) =>
		r.switchOn !== undefined
			? `Turn ${r.name} ${r.switchOn ? 'off' : 'on'}`
			: r.scene
				? `Run ${r.name}`
				: (actionOf(r) ?? r.name).replace('…', '') + (actionOf(r) ? ` ${r.name}` : '');

	function allOff() {
		for (const r of switches)
			if (r.switchOn && r.device && r.view?.control?.kind === 'switch')
				void commands.set(
					r.device.device_id,
					r.view.kind,
					{ [r.view.control.attr]: false },
					r.device.attributes
				);
	}
</script>

{#snippet sw(r: Row)}
	<button
		class="switch"
		role="switch"
		aria-checked={r.switchOn}
		aria-label={`${r.name}`}
		disabled={!session.mayUse}
		onclick={() => flip(r)}><span class="track" class:on={r.switchOn}><span></span></span></button
	>
{/snippet}

{#snippet act(r: Row)}
	{@const a = actionOf(r)}
	{#if a}<button class="act" disabled={!may(r)} onclick={() => press(r)}>{a}</button>{/if}
{/snippet}

<article
	class="stack {s.style}"
	class:wide
	class:lit
	style:grid-row={`span ${span}`}
	style:height={fixed ? `${fixed}px` : undefined}
	aria-label={label ?? (s.name || 'Stack')}
>
	<header>
		<span class="mark" aria-hidden="true"><Layers size={17} /></span>
		<span class="names">
			<h3>{label ?? (s.name || 'Stack')}</h3>
			<span class="sum" class:alert={alerts > 0}>{summary}</span>
		</span>
		{#if onCount > 0 && session.mayUse}<button class="act" onclick={allOff}>All off</button>{/if}
	</header>

	{#if rows.length === 0}
		<p class="empty">Nothing in it yet. Choose things in its settings.</p>
	{:else}
		<div class="body" style:--across={across(s.style, wide)}>
			{#each shown as r (r.ref)}
				{@const busy = r.busy || ran[r.ref]}
				{#if s.style === 'list' || s.style === 'folded'}
					<div class="line" class:busy={r.switchOn}>
						<button class="name" onclick={() => (r.device ? details(r) : press(r))}>
							<span>{r.name}</span>
							{#if r.switchOn === undefined && !r.scene}<span
									class="state"
									class:alert={r.alert}
									class:open={r.busy && !r.alert}>{r.state}</span
								>{/if}
						</button>
						{#if r.switchOn !== undefined}{@render sw(r)}{:else}{@render act(r)}{/if}
					</div>
				{:else if s.style === 'pills'}
					<button
						class="pill"
						class:busy
						class:alert={r.alert}
						aria-label={pressLabel(r)}
						aria-pressed={r.switchOn}
						disabled={(r.view?.control || r.scene) && !may(r) ? true : undefined}
						onclick={() => press(r)}
					>
						<span class="dot" aria-hidden="true"></span>
						<span class="pname">{r.name}</span>
						<span class="pstate">{r.scene ? (ran[r.ref] ? 'Ran' : 'Run') : r.state}</span>
					</button>
				{:else if s.style === 'rockers'}
					{#if r.switchOn !== undefined}
						<button
							class="tile"
							class:busy
							role="switch"
							aria-checked={r.switchOn}
							aria-label={r.name}
							disabled={!session.mayUse}
							onclick={() => flip(r)}
						>
							<span class="paddle" class:on={r.switchOn} aria-hidden="true"><span></span></span>
							<span class="tname">{r.name}</span>
						</button>
					{:else}
						<button
							class="tile"
							class:busy
							class:alert={r.alert}
							aria-label={pressLabel(r)}
							onclick={() => press(r)}
						>
							<span class="tstate">{r.scene ? (ran[r.ref] ? 'Ran' : 'Run') : r.state}</span>
							<span class="tname">{r.name}</span>
						</button>
					{/if}
				{:else}
					<button
						class="key"
						class:busy
						class:alert={r.alert}
						aria-label={pressLabel(r)}
						aria-pressed={r.switchOn}
						disabled={(r.view?.control || r.scene) && !may(r) ? true : undefined}
						onclick={() => press(r)}
					>
						<span class="led" aria-hidden="true"></span>
						<span class="kname">{r.name}</span>
						{#if r.switchOn === undefined && !r.scene}<span class="kstate">{r.state}</span>{/if}
					</button>
				{/if}
			{/each}
		</div>
		{#if folds}
			<button class="fold" aria-expanded={unfolded} onclick={() => (unfolded = !unfolded)}
				>{unfolded ? 'Fold the quiet ones' : `${quiet} more, all quiet`}</button
			>
		{/if}
	{/if}
</article>

<style>
	.stack {
		display: flex;
		flex-direction: column;
		min-width: 0;
		min-height: 0;
		overflow: hidden;
		border: 1px solid var(--card-line);
		border-radius: var(--feel-card-radius, var(--radius));
		background: var(--surface);
		box-shadow: var(--shadow);
	}
	.stack.wide {
		grid-column: span 2;
	}
	.stack.lit {
		border-color: color-mix(in srgb, var(--accent) 35%, var(--card-line));
	}
	header {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 12px 12px 8px 14px;
	}
	.mark {
		width: 32px;
		height: 32px;
		flex: none;
		display: grid;
		place-items: center;
		border-radius: 10px;
		background: var(--surface-2);
		color: var(--ink-muted);
	}
	.lit .mark {
		background: var(--track-on);
		color: var(--accent-ink);
	}
	.names {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	h3 {
		margin: 0;
		font-size: 15px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.sum {
		font-size: 12px;
		color: var(--ink-muted);
	}
	.lit .sum {
		color: var(--accent);
	}
	.sum.alert,
	.state.alert {
		color: var(--alert);
	}
	.empty {
		flex: 1;
		margin: 0 12px 12px;
		padding: 12px;
		display: grid;
		place-items: center;
		text-align: center;
		border: 1px dashed var(--line);
		border-radius: 12px;
		color: var(--ink-muted);
		font-size: 13px;
	}
	.body {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		display: grid;
		grid-template-columns: repeat(var(--across), minmax(0, 1fr));
		align-content: start;
		gap: 6px;
		padding: 0 10px 10px;
	}
	.list .body,
	.folded .body {
		gap: 0 8px;
		padding: 0 6px 6px;
	}
	button {
		font: inherit;
		color: inherit;
	}
	button:disabled {
		cursor: default;
	}
	.act {
		flex: none;
		height: 28px;
		padding: 0 10px;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--surface-2);
		font-size: 12px;
	}

	/* List: a name and its control on each line. */
	.line {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 44px;
		padding: 0 6px 0 8px;
		border-radius: 10px;
	}
	.line.busy {
		background: color-mix(in srgb, var(--accent) 8%, transparent);
	}
	.name {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 8px;
		border: none;
		background: none;
		padding: 0;
		text-align: left;
		font-size: 13.5px;
		font-weight: 600;
	}
	.name > span:first-child,
	.pname,
	.tname,
	.kname {
		min-width: 0;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.state {
		flex: none;
		font-weight: 400;
		font-size: 12.5px;
		color: var(--ink-muted);
	}
	.state.open {
		color: var(--accent);
	}
	.switch {
		flex: none;
		width: 48px;
		height: var(--target);
		display: grid;
		place-items: center;
		border: none;
		background: none;
		padding: 0;
	}
	.track {
		position: relative;
		width: 40px;
		height: 24px;
		border-radius: 999px;
		background: var(--track-off);
		transition: background var(--quick);
	}
	.track > span {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 18px;
		height: 18px;
		border-radius: 999px;
		background: #fff;
		transition: transform var(--quick);
	}
	.track.on {
		background: var(--track-on);
	}
	.track.on > span {
		transform: translateX(16px);
	}

	/* Pills: the whole pill is the control. */
	.pill {
		display: flex;
		align-items: center;
		gap: 8px;
		min-height: 36px;
		padding: 0 12px;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--bg);
		font-size: 13px;
		text-align: left;
	}
	.pill .pname {
		flex: 1;
		font-weight: 600;
	}
	.pstate {
		flex: none;
		font-size: 11.5px;
		opacity: 0.8;
	}
	.dot,
	.led {
		flex: none;
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: var(--track-off);
	}
	.busy .dot,
	.busy .led {
		background: var(--track-on);
		box-shadow: 0 0 8px color-mix(in srgb, var(--track-on) 80%, transparent);
	}
	.alert .dot,
	.alert .led {
		background: var(--alert);
		box-shadow: 0 0 8px color-mix(in srgb, var(--alert) 70%, transparent);
	}
	.pill.busy {
		border-color: color-mix(in srgb, var(--accent) 55%, transparent);
		background: var(--lit-bg);
		color: var(--lit-ink);
	}
	.pill.alert {
		border-color: var(--alert-line);
		background: var(--alert-bg);
		color: var(--alert);
	}

	/* Rockers: wall switches, two to a card's width. */
	.tile {
		min-height: 66px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 5px;
		padding: 6px 4px;
		border: 1px solid var(--line);
		border-radius: 12px;
		background: var(--bg);
	}
	.tile.busy {
		border-color: color-mix(in srgb, var(--accent) 55%, transparent);
	}
	.tile.alert {
		border-color: var(--alert-line);
	}
	.tname {
		max-width: 100%;
		font-size: 11.5px;
		font-weight: 600;
	}
	.tstate {
		font-size: 12px;
		color: var(--ink-muted);
	}
	.tile.alert .tstate {
		color: var(--alert);
	}
	.paddle {
		position: relative;
		width: 18px;
		height: 30px;
		border: 1px solid var(--line);
		border-radius: 6px;
		background: var(--surface-2);
	}
	.paddle > span {
		position: absolute;
		left: 2px;
		right: 2px;
		bottom: 2px;
		height: 13px;
		border-radius: 4px;
		background: var(--track-off);
		transition:
			bottom var(--quick),
			background var(--quick);
	}
	.paddle.on > span {
		bottom: 13px;
		background: var(--track-on);
	}

	/* Keypad: engraved buttons on a plate, a light beside each. */
	.keypad .body {
		margin: 0 12px 12px;
		padding: 8px;
		gap: 6px;
		border: 1px solid var(--line);
		border-radius: 14px;
		background: var(--surface-2);
	}
	.key {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 34px;
		padding: 0 10px;
		border: 1px solid var(--line);
		border-radius: 8px;
		background: var(--surface);
		box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.05);
	}
	.kname {
		flex: 1;
		text-align: left;
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.kstate {
		flex: none;
		font-size: 11.5px;
		color: var(--ink-muted);
	}
	.key.alert .kstate {
		color: var(--alert);
	}

	.fold {
		margin: 0 10px 10px;
		min-height: 34px;
		border: 1px dashed var(--line);
		border-radius: 10px;
		background: none;
		color: var(--ink-muted);
		font-size: 12.5px;
	}
</style>
