<!--
	A drawing made in the look editor (13 §6.4), drawing one thing (a device,
	or a scene): from its parts, with any expressions, or from an admin's code
	run in a worker. If the code fails, the card is drawn as Classic draws it
	(`children`). What a tap does comes from whoever draws it.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { CardSymbol } from '#lib/card.js';
	import { evaluate } from '#lib/looks/expr.js';
	import { drawWithCode, safeCss } from '#lib/looks/codeRunner.js';
	import type { MadeDrawing } from '#lib/looks/model.js';
	import type { Vars } from '#lib/looks/expr.js';
	import Icon, { drawn as isIcon } from '../Icon.svelte';

	let {
		made,
		thing,
		ownColors,
		words,
		icon,
		available = true,
		act,
		open,
		preview = false,
		children
	}: {
		made: MadeDrawing;
		thing: Vars;
		ownColors: boolean;
		/** Its state in words, when no expression says otherwise. */
		words: string;
		/** Its kind's icon, when no expression says otherwise. */
		icon: CardSymbol;
		available?: boolean;
		/** A tap that switches it, or runs it. */
		act: () => void;
		/** A tap that opens it. */
		open: () => void;
		/** In the editor's preview: shows, never acts. */
		preview?: boolean;
		children: Snippet;
	} = $props();

	const p = $derived(made.parts);
	const by = (src: string | undefined) => {
		if (!src) return null;
		const r = evaluate(src, thing);
		return 'value' in r ? r.value : null;
	};
	const on = $derived(thing.on === true);
	const level = $derived(typeof thing.level === 'number' ? thing.level : on ? 100 : 0);
	const label = $derived(String(by(made.expr.label) ?? words));
	const own = $derived(
		typeof thing.color === 'string' && ownColors && p.onInk === 'own' ? thing.color : null
	);
	const ink = $derived(String(by(made.expr.color) ?? own ?? 'var(--accent)'));
	const iconName = $derived.by(() => {
		const v = by(made.expr.icon);
		return typeof v === 'string' && isIcon(v) ? v : icon;
	});
	// A scene shows its colors whether or not it's the one on now.
	const fill = $derived(
		p.fill === 'color' && (on || thing.kind === 'scene')
			? 100
			: on && p.fill === 'level'
				? level
				: 0
	);

	// ---- code ----
	let html = $state<string | null>(null);
	let broke = $state(false);
	$effect(() => {
		const code = made.code;
		if (!code) return;
		const t = $state.snapshot(thing) as Vars;
		let gone = false;
		void drawWithCode(code, t).then((d) => {
			if (gone) return;
			if ('html' in d) {
				html = d.html;
				broke = false;
			} else {
				broke = true;
			}
		});
		return () => (gone = true);
	});
	let box = $state<HTMLElement>();
	$effect(() => {
		if (!box || html === null || broke) return;
		const root = box.shadowRoot ?? box.attachShadow({ mode: 'open' });
		root.innerHTML = `<style>${safeCss(made.css ?? '')}</style>${html}`;
	});

	function tap() {
		if (preview || p.tap === 'none') return;
		if (p.tap === 'open') open();
		else act();
	}
</script>

{#if made.code && broke}
	{@render children()}
{:else if made.code}
	<button class="code" onclick={tap} aria-label={`${thing.name}, ${label}`}
		><span class="host" bind:this={box}></span></button
	>
{:else}
	<button
		class="made {p.shape}"
		class:on
		class:gone={!available}
		style:--made={ink}
		onclick={tap}
		aria-label={`${thing.name}, ${label}`}
	>
		<span class="fill" style:width={`${fill}%`}></span>
		<span class="inner">
			{#if p.shows.icon}<span class="icon"><Icon name={iconName} size={18} /></span>{/if}
			<span class="words">
				{#if p.shows.name && p.shape !== 'disc'}<b>{thing.name}</b>{/if}
				{#if p.shows.state}<small>{label}</small>{/if}
			</span>
			{#if p.shows.level && p.shape !== 'disc' && p.shape !== 'tile'}
				<span class="level">{on ? `${level}%` : 'Off'}</span>
			{/if}
		</span>
		{#if p.shows.bar && p.shape !== 'disc'}
			<span class="bar"><span style:width={`${on ? level : 0}%`}></span></span>
		{/if}
	</button>
{/if}

<style>
	.host {
		display: block;
	}
	.code {
		display: block;
		padding: 0;
		border: none;
		background: none;
		color: inherit;
		text-align: inherit;
		font: inherit;
	}
	.made {
		position: relative;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		width: 100%;
		min-height: 64px;
		padding: 0;
		border-radius: var(--feel-card-radius);
		border: 1px solid var(--card-line);
		background: var(--surface);
		color: var(--ink);
		text-align: left;
		font: inherit;
		transition: border-color var(--feel-slow);
	}
	.made.on {
		border-color: color-mix(in srgb, var(--made) 55%, transparent);
	}
	.made.gone {
		opacity: 0.55;
	}
	.fill {
		position: absolute;
		inset: 0 auto 0 0;
		background: linear-gradient(
			90deg,
			color-mix(in srgb, var(--made) 14%, transparent),
			color-mix(in srgb, var(--made) 38%, transparent)
		);
		transition: width var(--feel-slow);
	}
	.inner {
		position: relative;
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		flex: 1;
	}
	.words {
		display: flex;
		flex-direction: column;
		min-width: 0;
		flex: 1;
	}
	.words b {
		font-size: 14px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	small {
		font-size: 12px;
		color: var(--ink-muted);
	}
	.on small {
		color: var(--ink);
	}
	.icon {
		display: grid;
		place-items: center;
		width: 30px;
		height: 30px;
		flex: none;
		border-radius: 999px;
		background: var(--surface-2);
		color: var(--ink-muted);
	}
	.on .icon {
		background: color-mix(in srgb, var(--made) 30%, transparent);
		color: var(--ink);
	}
	.level {
		font-family: var(--font-num);
		font-size: 15px;
	}
	.bar {
		position: relative;
		height: 4px;
		margin: 0 12px 10px;
		border-radius: 4px;
		background: var(--surface-2);
	}
	.bar span {
		display: block;
		height: 4px;
		border-radius: 4px;
		background: var(--made);
	}
	.tile .inner,
	.disc .inner {
		flex-direction: column;
		justify-content: center;
		text-align: center;
	}
	.tile {
		max-width: 150px;
		aspect-ratio: 1;
	}
	.disc {
		width: 96px;
		height: 96px;
		min-height: 0;
		border-radius: 999px;
	}
	.line {
		min-height: 0;
		border-radius: 10px;
	}
	.line .inner {
		padding: 8px 12px;
	}
</style>
