<!--
	The header of an Everywhere view (the Everywhere board): EVERYWHERE over
	the view's name, a line on how the house is now, and the view's
	house-wide action on the right; a glow of the view's color behind.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		summary,
		glow,
		trouble,
		children
	}: {
		title: string;
		summary: string;
		/** The glow's color, as CSS. */
		glow: string;
		/** What went wrong with the last house-wide action. */
		trouble?: string | null;
		/** The house-wide action's button. */
		children?: Snippet;
	} = $props();
</script>

<section class="evhead" aria-label={title} style:--glow={glow}>
	<div class="glow" aria-hidden="true"></div>
	<div class="who">
		<p class="kick">Everywhere</p>
		<h1>{title}</h1>
		<p class="sum">{summary}</p>
	</div>
	<div class="side">
		{#if trouble}<p class="trouble" role="alert">{trouble}</p>{/if}
		{#if children}<div class="acts">{@render children()}</div>{/if}
	</div>
</section>

<style>
	.evhead {
		position: relative;
		flex: none;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 16px;
		padding: 26px 28px 20px;
	}
	.glow {
		position: absolute;
		z-index: -1;
		top: 0;
		left: 0;
		right: 0;
		height: 340px;
		pointer-events: none;
		background: radial-gradient(
			900px 300px at 20% 0%,
			color-mix(in srgb, var(--glow) 30%, transparent),
			transparent 75%
		);
	}
	.who {
		flex: 1 1 360px;
		min-width: 0;
	}
	.kick {
		margin: 0;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-muted);
	}
	h1 {
		margin: 6px 0 0;
		font-size: 46px;
		font-weight: 800;
		letter-spacing: -0.02em;
		line-height: 1;
	}
	.sum {
		margin: 10px 0 0;
		font-size: 13.5px;
		color: color-mix(in srgb, var(--ink) 80%, transparent);
	}
	.side {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 8px;
	}
	.acts {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.trouble {
		margin: 0;
		max-width: 340px;
		font-size: 12px;
		color: var(--alert);
		text-align: right;
	}
	/* The house-wide action: lit, as the board has it. */
	.acts :global(.hbtn) {
		height: 34px;
		padding: 0 14px;
		border: 0;
		border-radius: 10px;
		background: linear-gradient(140deg, #ffc46b, #ff8a4c);
		color: #2a1300;
		font: 700 13px var(--font);
		cursor: pointer;
		white-space: nowrap;
	}
	.acts :global(.hbtn.plain) {
		background: color-mix(in srgb, var(--ink) 9%, transparent);
		color: var(--ink);
	}
	.acts :global(.hbtn:hover:not(:disabled)) {
		filter: brightness(1.08);
	}
	.acts :global(.hbtn:disabled) {
		cursor: default;
		opacity: 0.5;
	}
	@media (max-width: 1100px) {
		.evhead {
			padding: 22px 16px 16px;
		}
		h1 {
			font-size: 36px;
		}
	}
	/* A shorter window: a slimmer header, so the list below keeps its room. */
	@media (max-height: 820px) {
		.evhead {
			padding-top: 16px;
			padding-bottom: 14px;
		}
		h1 {
			font-size: 32px;
		}
		.sum {
			margin-top: 6px;
		}
	}
</style>
