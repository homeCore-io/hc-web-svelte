<!--
	A room's box in the room field (mockup A). Big: its name and up to three
	marks, its big number, lights then humidity, one note, and "All off".
	Small: its name, one mark and one short line. It glows as warm as the
	share of its lights that are on; what's wrong always shows, in the alert
	colour (G6). On a phone's four columns it says less: the number and
	"4/7 on". The box opens the room; "All off" is its own control.
-->
<script lang="ts">
	import { allOff } from '#lib/allOff.js';
	import type { CoreDevice } from '#lib/devices.js';
	import { fieldText, type Box } from '#lib/roomBox.js';
	import Icon from './Icon.svelte';

	let {
		href,
		name,
		box,
		devices,
		big = false
	}: {
		href?: string;
		name: string;
		box: Box;
		devices: CoreDevice[];
		big?: boolean;
	} = $props();

	const t = $derived(fieldText(box));
	const glow = $derived(box.glow > 0 ? Math.round(18 + 62 * box.glow) : 0);
	const marks = $derived(box.marks.slice(0, big ? 3 : 1));
	const wrong = $derived(
		box.lines.some((l) => l.alert) || box.marks.some((m) => m.tone === 'alert')
	);
</script>

<div class="box" class:big class:alarm={box.alarm} class:wrong style={`--glow: ${glow}%`}>
	{#if href}<a {href} class="cover" aria-label={`Open ${name}`}></a>{/if}
	<div class="top">
		<span class="name">{name}</span>
		{#if marks.length > 0}
			<span class="marks">
				{#each marks as m, i (i)}
					<span class={`mark ${m.tone}`} title={m.label}
						><Icon name={m.icon} size={13} /><span class="sr">{m.label}</span></span
					>
				{/each}
			</span>
		{/if}
	</div>
	<div class="foot">
		<div class="says">
			{#if big}
				{#if box.big !== undefined}<span class="num">{box.big}</span>{/if}
				{#if t.line}<span class="line wide" class:lit={t.lit}>{t.line}</span>{/if}
				{#if t.brief}<span class="line phone" class:lit={t.lit}>{t.brief}</span>{/if}
				{#if t.note}<span class="note" class:bad={t.note.alert}>{t.note.text}</span>{/if}
			{:else if t.wrong}
				<span class="line bad">{t.wrong.text}</span>
			{:else}
				<span class="line wide" class:lit={t.lit}>{t.short}</span>
				<span class="line phone" class:lit={t.lit}>{t.brief || t.short}</span>
			{/if}
		</div>
		{#if big && t.lit && box.allOff.length > 0}
			<button
				class="off"
				aria-label={`All off in ${name}`}
				onclick={() => allOff(box.allOff, devices)}>All off</button
			>
		{/if}
	</div>
</div>

<style>
	.box {
		position: relative;
		height: 100%;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 6px;
		padding: 11px 12px;
		border-radius: 14px;
		border: 1px solid var(--card-line);
		background:
			radial-gradient(
				120% 110% at 50% 115%,
				color-mix(in srgb, var(--fill) var(--glow), transparent) 0%,
				transparent 72%
			),
			var(--surface);
		overflow: hidden;
		min-width: 0;
	}
	.wrong {
		border-color: var(--alert-line);
	}
	.alarm {
		background: var(--alert-bg);
	}
	.cover {
		position: absolute;
		inset: 0;
		border-radius: 14px;
		z-index: 1;
	}
	.top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 6px;
	}
	.name {
		font-size: 13px;
		font-weight: 600;
		line-height: 1.2;
		min-width: 0;
		overflow: hidden;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		line-clamp: 2;
	}
	.big .name {
		font-size: 15px;
	}
	.marks {
		display: flex;
		gap: 4px;
		flex: none;
	}
	.mark {
		width: 22px;
		height: 22px;
		border-radius: 7px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--surface-2);
		color: var(--ink-muted);
	}
	.mark.alert {
		background: var(--alert-bg);
		color: var(--alert);
	}
	.mark.warn {
		background: var(--lit-bg);
		color: var(--lit-ink);
	}
	.sr {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
	}
	.foot {
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		gap: 8px;
		min-width: 0;
	}
	.says {
		display: flex;
		flex-direction: column;
		gap: 2px;
		min-width: 0;
	}
	.num {
		font-family: var(--font-num);
		font-size: 30px;
		line-height: 1;
		font-weight: 500;
	}
	.line {
		font-family: var(--font-num);
		font-size: 12px;
		color: var(--ink-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.line.lit {
		color: var(--lit-ink);
	}
	.note {
		font-size: 12px;
		color: var(--ink-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.bad {
		color: var(--alert);
	}
	.phone {
		display: none;
	}
	.off {
		position: relative;
		z-index: 2;
		flex: none;
		height: 28px;
		padding: 0 11px;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
		font-size: 12px;
		font-weight: 600;
	}
	/* A 44px target around the 28px button. */
	.off::before {
		content: '';
		position: absolute;
		inset: -8px;
	}
	/* A phone's four columns (Phone board): less to say, set smaller. */
	@container field (max-width: 559px) {
		.box {
			padding: 9px 10px;
			border-radius: 13px;
			gap: 4px;
		}
		.name {
			font-size: 12px;
			line-height: 1.15;
		}
		.big .name {
			font-size: 14px;
		}
		.foot {
			align-items: baseline;
		}
		.big .says {
			flex-direction: row;
			align-items: baseline;
			justify-content: space-between;
			width: 100%;
			gap: 4px;
		}
		.num {
			font-size: 22px;
		}
		.line {
			font-size: 11px;
		}
		.wide,
		.note,
		.off {
			display: none;
		}
		.phone {
			display: inline;
		}
		/* A small box's mark is its drawing alone, so the name keeps its room. */
		.box:not(.big) .mark {
			width: auto;
			height: auto;
			background: none;
		}
	}
</style>
