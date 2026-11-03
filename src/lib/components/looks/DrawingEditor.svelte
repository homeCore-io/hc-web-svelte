<script lang="ts" module>
	const DEFAULT_CODE = `// thing: name, on, level, color, room, state, …
// Return HTML. Its CSS goes in the box below.
return \`
  <div class="orb \${thing.on ? 'on' : ''}"
       style="--c: \${thing.color}; --l: \${(thing.level ?? 100) / 100}">
    <span class="ring"></span>
    <b>\${thing.name}</b>
    <small>\${thing.on ? (thing.level ?? 'On') + (thing.level == null ? '' : '%') : 'Off'}</small>
  </div>\`;`;

	const DEFAULT_CSS = `.orb { display: grid; justify-items: center; gap: 4px;
  padding: 14px; border-radius: var(--feel-card-radius);
  background: var(--surface); border: 1px solid var(--card-line); color: var(--ink); }
.ring { width: 54px; height: 54px; border-radius: 50%;
  background: var(--surface-2); transition: box-shadow .4s; }
.on .ring { background: var(--c);
  box-shadow: 0 0 calc(30px * var(--l)) var(--c); }
small { color: var(--ink-muted); }`;
</script>

<!--
	Making a drawing in the look editor (13 §6.4, D1, D2): its parts, any
	expressions, and, for an admin, code; beside them the drawing on the
	house's own things, at each size. It starts from the drawing the look
	used, so there is no blank one.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { cardFor } from '#lib/card.js';
	import { clock } from '#lib/clock.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { roomOf } from '#lib/summary.js';
	import type { Card } from '#lib/page.js';
	import { evaluate } from '#lib/looks/expr.js';
	import { drawWithCode } from '#lib/looks/codeRunner.js';
	import { thingOf, THING_NAMES } from '#lib/looks/thing.js';
	import type { Expressions, Look, MadeDrawing, Parts } from '#lib/looks/model.js';
	import DrawingSample from './DrawingSample.svelte';

	let {
		start,
		look,
		samples,
		admin,
		keep,
		cancel
	}: {
		start: MadeDrawing;
		look: Look;
		/** The house's own things of this family, to draw it with. */
		samples: Card[];
		admin: boolean;
		keep: (m: MadeDrawing) => void;
		cancel: () => void;
	} = $props();

	// A copy to change, taken once as it opens.
	let m = $state<MadeDrawing>(
		untrack(() => structuredClone($state.snapshot(start) as MadeDrawing))
	);
	let tab = $state<'parts' | 'code'>('parts');
	// Code is kept while it's turned off, so turning it back on finds it.
	let code = $state(untrack(() => start.code ?? DEFAULT_CODE));
	let useCode = $state(untrack(() => !!start.code));
	const mayCode = $derived(admin);
	const codeLocked = $derived(!admin && !!start.code);

	const DRAFT = 'draft-drawing';
	const drawn = $derived<MadeDrawing>({
		...m,
		id: DRAFT,
		...(useCode && (admin || start.code) ? { code } : { code: undefined })
	});
	const shown = $derived<Look>({
		...look,
		made: [...look.made.filter((x) => x.id !== m.id), drawn],
		drawings: { ...look.drawings, [m.family]: DRAFT }
	});

	// The first of the house's things, as the drawing reads it: for the errors under each field.
	const first = $derived.by(() => {
		const c = samples[0];
		if (!c || c.kind !== 'device') return null;
		const view = cardFor(c.device, clock.now);
		return thingOf(c.device, view, view.name, roomOf(c.device, rooms.list)?.name ?? '');
	});

	const SHAPES = [
		['card', 'Card'],
		['tile', 'Tile'],
		['disc', 'Disc'],
		['line', 'Line']
	] as const;
	const FILLS = [
		['none', 'None'],
		['level', 'Its level'],
		['color', 'Its own color']
	] as const;
	const SHOWS = [
		['icon', 'Icon'],
		['name', 'Name'],
		['state', 'State'],
		['level', 'Level'],
		['bar', 'Level bar']
	] as const;
	const TAPS = [
		['switch', 'Switch it'],
		['open', 'Open it'],
		['none', 'Nothing']
	] as const;
	const INKS = [
		['own', 'Its own color'],
		['theme', 'The theme’s']
	] as const;
	const set = <K extends keyof Parts>(k: K, v: Parts[K]) => (m.parts = { ...m.parts, [k]: v });

	const EXPRS: { key: keyof Expressions; label: string; plain: string; example: string }[] = [
		{
			key: 'label',
			label: 'State line',
			plain: 'Plain: its state in words',
			example: 'on ? (level > 60 ? "Bright" : "Low") : "Off"'
		},
		{
			key: 'color',
			label: 'Color',
			plain: 'Plain: its own color, or the theme’s',
			example: 'level > 60 ? "#ffb35a" : "#ffd59a"'
		},
		{
			key: 'icon',
			label: 'Icon',
			plain: 'Plain: its kind’s icon',
			example: 'on ? "light" : "moon"'
		}
	];
	const errorOf = (src: string | undefined) => {
		if (!src || !first) return '';
		const r = evaluate(src, first);
		return 'error' in r ? r.error : '';
	};
	const valueOf = (src: string | undefined) => {
		if (!src || !first) return '';
		const r = evaluate(src, first);
		return 'value' in r ? JSON.stringify(r.value) : '';
	};
	function toggleExpr(k: keyof Expressions, example: string) {
		const e = { ...m.expr };
		if (e[k] !== undefined) delete e[k];
		else e[k] = example;
		m.expr = e;
	}

	// Code's errors, from the first thing, as it's typed.
	let codeError = $state('');
	$effect(() => {
		if (!useCode || !first) return void (codeError = '');
		const t = $state.snapshot(first);
		const c = code;
		let gone = false;
		const timer = setTimeout(() => {
			void drawWithCode(c, t).then((d) => {
				if (!gone) codeError = 'error' in d ? d.error : '';
			});
		}, 250);
		return () => {
			gone = true;
			clearTimeout(timer);
		};
	});

	function done() {
		keep({
			...$state.snapshot(m),
			...(useCode && (admin || start.code) ? { code } : { code: undefined })
		} as MadeDrawing);
	}
</script>

<div class="maker">
	<div class="bar">
		<button class="plain" onclick={cancel}>‹ Back to the look</button>
		<input class="name" aria-label="The drawing's name" bind:value={m.name} maxlength="60" />
		<span class="quiet"
			>for {m.family}, started from {m.from === 'lit' ? 'Lit’s' : 'Classic’s'} drawing</span
		>
		{#if useCode}<span class="has-code">Has code · admin</span>{/if}
		<span class="grow"></span>
		<button class="primary" onclick={done}>Use in {look.name}</button>
	</div>

	<div class="split">
		<div class="choices">
			<div class="tabs" role="tablist">
				<button role="tab" aria-selected={tab === 'parts'} onclick={() => (tab = 'parts')}
					>Parts</button
				>
				<button role="tab" aria-selected={tab === 'code'} onclick={() => (tab = 'code')}
					>Code</button
				>
			</div>
			<div class="panel">
				{#if tab === 'parts'}
					{#if useCode}<p class="quiet">
							Drawn with code now; parts are used again if code is turned off.
						</p>{/if}
					<fieldset>
						<legend>Shape</legend>
						<div class="seg">
							{#each SHAPES as [id, name] (id)}<button
									aria-pressed={m.parts.shape === id}
									onclick={() => set('shape', id)}>{name}</button
								>{/each}
						</div>
					</fieldset>
					<fieldset>
						<legend>Fill</legend>
						<div class="seg">
							{#each FILLS as [id, name] (id)}<button
									aria-pressed={m.parts.fill === id}
									onclick={() => set('fill', id)}>{name}</button
								>{/each}
						</div>
					</fieldset>
					<fieldset>
						<legend>Shows</legend>
						<div class="seg wrap">
							{#each SHOWS as [id, name] (id)}
								<button
									aria-pressed={m.parts.shows[id]}
									onclick={() => set('shows', { ...m.parts.shows, [id]: !m.parts.shows[id] })}
									>{name}</button
								>
							{/each}
						</div>
					</fieldset>
					<fieldset>
						<legend>A tap</legend>
						<div class="seg">
							{#each TAPS as [id, name] (id)}<button
									aria-pressed={m.parts.tap === id}
									onclick={() => set('tap', id)}>{name}</button
								>{/each}
						</div>
					</fieldset>
					<fieldset>
						<legend>When on</legend>
						<div class="seg">
							{#each INKS as [id, name] (id)}<button
									aria-pressed={m.parts.onInk === id}
									onclick={() => set('onInk', id)}>{name}</button
								>{/each}
						</div>
					</fieldset>

					<div class="exprs">
						<span class="label">Expressions</span>
						<p class="quiet">
							Any of these can follow the thing. A small language made for this, reading only:
							{Object.keys(THING_NAMES).join(', ')}.
						</p>
						{#each EXPRS as x (x.key)}
							{@const src = m.expr[x.key]}
							<div class="expr">
								<span class="expr-top"
									><span>{x.label}</span><button
										class="fx"
										aria-pressed={src !== undefined}
										onclick={() => toggleExpr(x.key, x.example)}
										>ƒ {src !== undefined ? 'expression' : 'fixed'}</button
									></span
								>
								{#if src !== undefined}
									<input
										class="code-line"
										class:bad={!!errorOf(src)}
										spellcheck="false"
										aria-label={`${x.label} expression`}
										value={src}
										oninput={(e) => (m.expr = { ...m.expr, [x.key]: e.currentTarget.value })}
									/>
									{#if errorOf(src)}<span class="error">{errorOf(src)}</span>
									{:else if first}<span class="quiet small">For {first.name}: {valueOf(src)}</span
										>{/if}
								{:else}
									<span class="quiet small">{x.plain}</span>
								{/if}
							</div>
						{/each}
					</div>
				{:else}
					{#if !mayCode}
						<div class="locked">
							<b>Code is for admins</b>
							<span
								>Code runs in the browser of everyone who sees this look, signed in as them. Parts,
								expressions and CSS are yours to use; an admin can add code.</span
							>
						</div>
					{/if}
					<label class="check" class:off={!mayCode}
						><input
							type="checkbox"
							checked={useCode}
							onchange={(e) => {
								useCode = e.currentTarget.checked;
								// Code's own starting style, if there's none yet.
								if (useCode && !m.css && code === DEFAULT_CODE) m.css = DEFAULT_CSS;
							}}
							disabled={!mayCode && !codeLocked}
						/> Draw it with code instead of its parts</label
					>
					<label class="field"
						><span
							>JavaScript: the body of <code>draw(thing)</code>, returning HTML.
							<span class="quiet small"
								>It runs apart from the page, and is stopped after 300 ms.</span
							></span
						>
						<textarea rows="12" spellcheck="false" bind:value={code} disabled={!mayCode}></textarea>
					</label>
					<label class="field"
						><span
							>CSS <span class="quiet small">(anyone; url() and @import are taken out)</span></span
						>
						<textarea
							rows="8"
							spellcheck="false"
							value={m.css ?? ''}
							oninput={(e) => (m.css = e.currentTarget.value || undefined)}></textarea>
					</label>
					{#if codeError}<p class="error box" role="alert">draw(): {codeError}</p>{/if}
					<p class="quiet">
						If it throws or takes too long, the card is drawn as Classic draws it, and this says
						why.
					</p>
				{/if}
			</div>
		</div>

		<div class="preview-side">
			<span class="label">On this house's own {m.family}</span>
			<div class="preview">
				{#each samples as c (c.ref)}
					<div class="sample"><DrawingSample look={shown} card={c} /></div>
				{:else}
					<p class="quiet">The house has none of these to draw yet.</p>
				{/each}
			</div>
			<p class="quiet">
				Not responding, turning on, and needing someone are drawn for it, whatever the drawing.
			</p>
		</div>
	</div>
</div>

<style>
	.maker {
		display: flex;
		flex-direction: column;
		gap: 14px;
	}
	.bar {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 10px;
		padding: 10px 12px;
		border-radius: 14px;
		background: var(--surface);
		border: 1px solid var(--line);
	}
	.name {
		width: 200px;
		font-weight: 700;
	}
	.grow {
		flex: 1;
	}
	.has-code {
		padding: 3px 10px;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 700;
		background: var(--surface-2);
		border: 1px solid var(--line);
	}
	.split {
		display: flex;
		flex-wrap: wrap;
		gap: 20px;
		align-items: flex-start;
	}
	.choices {
		flex: 1 1 380px;
		max-width: 520px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.preview-side {
		flex: 999 1 420px;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.preview {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 12px;
		padding: 16px;
		border-radius: 22px;
		border: 1px solid var(--line);
		background: var(--bg);
	}
	.sample {
		min-width: 0;
	}
	.label {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	.tabs {
		display: flex;
		gap: 6px;
	}
	.tabs button,
	.seg button,
	.fx {
		padding: 6px 12px;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font-size: 13px;
		font-weight: 600;
	}
	.tabs button[aria-selected='true'],
	.seg button[aria-pressed='true'],
	.fx[aria-pressed='true'] {
		border-color: var(--accent);
		background: var(--lit-bg);
		color: var(--lit-ink);
	}
	.fx {
		padding: 2px 8px;
		font-family: var(--font-num);
		font-size: 12px;
	}
	.panel {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 16px;
		border-radius: 18px;
		background: var(--surface);
		border: 1px solid var(--line);
	}
	fieldset {
		border: none;
		margin: 0;
		padding: 0;
	}
	legend {
		font-size: 14px;
		margin-bottom: 6px;
	}
	.seg {
		display: flex;
		gap: 6px;
	}
	.seg.wrap {
		flex-wrap: wrap;
	}
	.exprs,
	.expr,
	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.exprs {
		padding-top: 10px;
		border-top: 1px solid var(--line);
	}
	.expr-top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 14px;
	}
	.code-line,
	textarea {
		font-family: var(--font-num);
		font-size: 12.5px;
	}
	textarea {
		padding: 10px;
		border-radius: 10px;
		border: 1px solid var(--line);
		background: var(--bg);
		color: var(--ink);
		resize: vertical;
	}
	.bad {
		border-color: var(--alert-line);
	}
	.error {
		font-size: 12.5px;
		color: var(--alert);
	}
	.error.box {
		margin: 0;
		padding: 8px 12px;
		border-radius: 10px;
		background: var(--alert-bg);
		border: 1px solid var(--alert-line);
		font-family: var(--font-num);
	}
	.locked {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 12px;
		border-radius: 12px;
		background: var(--surface-2);
		font-size: 13px;
	}
	.check {
		display: flex;
		gap: 10px;
		align-items: center;
		font-size: 14px;
	}
	.off {
		opacity: 0.5;
	}
	.quiet {
		margin: 0;
		font-size: 13px;
		color: var(--ink-muted);
	}
	.small {
		font-size: 12px;
	}

	/* On a phone, the preview is above, and the choices scroll under it (13 §11). */
	@media (max-width: 899px) {
		.preview-side {
			order: -1;
			position: sticky;
			top: var(--header-h, 64px);
			z-index: 2;
			max-height: 42dvh;
			overflow: auto;
			padding-bottom: 6px;
			background: var(--bg);
		}
		.choices {
			max-width: none;
		}
	}
</style>
