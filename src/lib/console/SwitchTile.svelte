<!--
	A switch as a tile the size of a timer's clock (TimerTile), for a person
	who has switches and timers as tiles: On or Off in large letters, green
	when on; its name under it; and a small toggle. The name opens its page.
-->
<script lang="ts">
	let {
		name,
		sub,
		on,
		disabled = false,
		waiting = false,
		onchange,
		onopen
	}: {
		name: string;
		/** Under the name: what a plug draws, or Offline. */
		sub?: string;
		on: boolean;
		disabled?: boolean;
		waiting?: boolean;
		onchange: (on: boolean) => void;
		onopen?: () => void;
	} = $props();
</script>

<div class="tile" class:on>
	<b class="fig">{on ? 'On' : 'Off'}</b>
	<button type="button" class="nm" onclick={onopen}
		>{name}{#if sub}<small>{sub}</small>{/if}</button
	>
	<button
		type="button"
		class="tg"
		class:on
		class:waiting
		role="switch"
		aria-checked={on}
		aria-label={name}
		aria-busy={waiting || undefined}
		{disabled}
		onclick={() => onchange(!on)}><i aria-hidden="true"></i></button
	>
</div>

<style>
	.tile {
		box-sizing: border-box;
		width: calc(140px + 8px * var(--k, 1));
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: calc(2px + 3px * var(--k, 1));
		padding: calc(8px + 4px * var(--k, 1)) 12px;
		border-radius: 14px;
		background: var(--con-raise, color-mix(in srgb, var(--ink) 7%, transparent));
		box-shadow: inset 0 0 0 1px var(--con-edge);
	}
	.tile.on {
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--good, #4fe0a0) 40%, transparent);
	}
	.fig {
		font-family: var(--font-num);
		font-size: calc(22px + 6px * var(--k, 1));
		font-weight: 600;
		line-height: 1.1;
		color: var(--ink-muted);
	}
	.on .fig {
		color: var(--good, #4fe0a0);
	}
	:global(:root[data-theme='light']) .on .fig {
		color: #1f8a5a;
	}
	.nm {
		max-width: 100%;
		border: 0;
		padding: 0;
		background: none;
		color: var(--ink);
		font: 500 12px var(--font);
		text-align: left;
		cursor: pointer;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.nm:hover {
		text-decoration: underline;
	}
	.nm small {
		display: block;
		font-size: 11px;
		color: var(--ink-muted);
	}
	.tg {
		position: relative;
		margin-top: 2px;
		width: 44px;
		height: 26px;
		padding: 0;
		border: 0;
		border-radius: 13px;
		background: color-mix(in srgb, var(--ink) 16%, transparent);
		cursor: pointer;
		transition: background 0.2s;
	}
	.tg i {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
		transition: transform 0.2s;
	}
	.tg.on {
		background: var(--good, #4fe0a0);
	}
	.tg.on i {
		transform: translateX(18px);
	}
	.tg.waiting {
		opacity: 0.6;
	}
	.tg:disabled {
		cursor: default;
		opacity: 0.45;
	}
	.nm:focus-visible,
	.tg:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	@media (prefers-reduced-motion: reduce) {
		.tg,
		.tg i {
			transition: none;
		}
	}
</style>
