<!--
	A room's header, a frame piece (13 §7): its name, its readings, and a glow
	from each light that's on, in its own color, with the room in chips: lights
	on, and what needs someone, which a tap fixes, when the look doesn't show
	that under the header (NeedsKind). While it's drawn, the shell's header
	shows no title (the room's name is here).
-->
<script lang="ts">
	import { houseNow } from '#lib/houseNow.svelte.js';
	import { isLamp, isLit } from '#lib/lights.js';
	import type { KindProps } from '#lib/kinds.js';
	import { cardFor, type CardView } from '#lib/card.js';
	import { withPending } from '#lib/pending.js';
	import { clock } from '#lib/clock.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { commands } from '#lib/commands.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { roomBox } from '#lib/roomBox.js';
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import { ROOM_BUILT_IN } from '#lib/options.js';
	import { ref } from '#lib/layers.js';
	import { heading, inSheet } from '#lib/heading.svelte.js';
	import type { Card } from '#lib/page.js';
	import { litRoom } from './room.js';
	import { lookHere } from '#lib/look.svelte.js';
	import { pluginUis } from '#lib/pluginUi/uis.svelte.js';
	import PluginSlot from '#lib/pluginUi/PluginSlot.svelte';
	import { thingOf } from '#lib/looks/thing.js';
	import { household } from '#lib/household.svelte.js';
	import Backdrop from '#lib/components/Backdrop.svelte';

	const here = lookHere();

	let { card, label }: KindProps<'roomhead'> = $props();
	// In a preview or a sheet over Home, the page under it keeps its title.
	const sheet = inSheet();
	$effect(() => {
		if (!here.preview && !sheet) heading.ownTitle();
	});

	const live = $derived(card.devices.map((d) => devices.byId[d.device_id] ?? d));
	const cards = $derived(
		live.map((d): Card & { kind: 'device' } => ({
			ref: ref.device(d.device_id),
			kind: 'device',
			device: d,
			scene: false
		}))
	);
	const views = $derived(
		Object.fromEntries(
			cards.map((c): [string, CardView] => [
				c.ref,
				withPending(cardFor(c.device, clock.now), commands.pending[c.device.device_id])
			])
		)
	);
	const lit = $derived(litRoom(cards, views, {}, {}, devices.byId));
	const box = $derived(
		roomBox(
			live,
			Object.values(views),
			devices.byId,
			kindOptions.of('home', 'room', ref.room(card.id), ROOM_BUILT_IN),
			houseNow.lightIds
		)
	);
	// The room's lights on, as Home, the sidebar and Everywhere count them (lights.ts).
	const lightsOn = $derived(
		live.filter(
			(d) =>
				(houseNow.lightIds ? houseNow.lightIds.has(d.device_id) : isLamp(d)) &&
				isLit(d, commands.pending)
		).length
	);
	// What needs someone, as chips, unless the look shows it under the header
	// (NeedsKind), so each shows once.
	const problems = $derived(
		here.def.frame.needs && (here.def.grouping.room ?? []).some((r) => r.takes.includes('needs'))
			? []
			: lit.problems
	);
	// Glowing, or plain where the look says so (13 §7).
	const plain = $derived(here.def.frame.header === 'plain');
	// A plugin's header (13 §12.2), while its plugin offers one; else the glowing one.
	const plugin = $derived.by(() => {
		const h = here.def.frame.header;
		if (!h.startsWith('plugin:')) return undefined;
		const found = pluginUis.look(h);
		return found?.slot.slot === 'look.piece' && found.slot.draws?.includes('header')
			? found
			: undefined;
	});
	let pluginFailed = $state(false);
	const roomGiven = $derived(
		plugin
			? {
					id: card.id,
					name: label ?? card.name,
					things: cards.map((c) =>
						thingOf(c.device, views[c.ref]!, views[c.ref]!.name, label ?? card.name)
					)
				}
			: undefined
	);
	// The room's own photo (design 15), behind the words in place of the glow.
	const photo = $derived(plain ? undefined : household.photoOf(card.id));
	const glow = $derived(
		plain || lit.glow.length === 0
			? 'var(--surface)'
			: lit.glow
					.map(
						(g) =>
							`radial-gradient(ellipse 38% 95% at ${g.at.toFixed(0)}% 112%, color-mix(in srgb, ${here.def.ownColors ? `rgb(${g.rgb})` : 'var(--accent)'} ${(50 * g.level) / 100}%, transparent), transparent 70%)`
					)
					.join(', ') + ', var(--surface)'
	);
	function fix(f: { device: string; want: Record<string, unknown> }) {
		const d = devices.byId[f.device];
		if (d)
			void commands.set(f.device, views[ref.device(f.device)]?.kind ?? '', f.want, d.attributes);
	}
</script>

{#if plugin && roomGiven && !pluginFailed}
	<div class="span-all">
		<PluginSlot
			pluginId={plugin.pluginId}
			ui={plugin.ui}
			slot={plugin.slot}
			props={{ room: roomGiven }}
			onfail={() => (pluginFailed = true)}
		/>
	</div>
{:else}
	<header class="hero span-all" class:plain class:photo style:background={glow}>
		{#if photo}<Backdrop {photo} play />{/if}
		<div class="top-line">
			<h1>{label ?? card.name}</h1>
			<div class="numbers">
				{#if box.temperature}<span class="big">{box.temperature}</span>{/if}
				{#if box.humidity}<span class="small">{box.humidity} humidity</span>{/if}
			</div>
		</div>
		{#if here.def.frame.chips}<div class="chips">
				<span class="chip"
					><span class="dot" class:warm={lightsOn > 0}></span>{lightsOn === 0
						? 'Lights off'
						: `${lightsOn} light${lightsOn === 1 ? '' : 's'} on`}</span
				>
				{#each problems as p (p.key)}
					{#if p.fix && session.mayUse}
						<button class="chip bad" onclick={() => fix(p.fix!)}
							><span class="dot bad"></span>{p.title} · {p.fix.label}</button
						>
					{:else}
						<span class="chip bad"><span class="dot bad"></span>{p.title}</span>
					{/if}
				{/each}
			</div>{/if}
	</header>
{/if}

<style>
	.hero {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		gap: 16px;
		min-height: 132px;
		padding: 20px 22px 16px;
		box-sizing: border-box;
		border-radius: 24px;
		border: 1px solid var(--line);
		color: var(--ink);
		transition: background var(--feel-slow);
	}
	/* A plain title (13 §7): the room's name and numbers, without the box and glow. */
	/* Over a photo: light words, above it. */
	.hero.photo {
		position: relative;
		overflow: hidden;
		--ink: #fff;
		--ink-muted: rgba(255, 255, 255, 0.82);
		color: #fff;
		isolation: isolate;
	}
	.hero.plain {
		min-height: 0;
		padding: 4px 2px 0;
		border-color: transparent;
		background: transparent !important;
	}
	.top-line {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 16px;
		flex-wrap: wrap;
	}
	h1 {
		margin: 0;
		font-size: 34px;
		font-weight: 700;
		letter-spacing: -0.01em;
		line-height: 1.1;
	}
	.numbers {
		display: flex;
		flex-direction: row-reverse;
		align-items: baseline;
		gap: 14px;
	}
	.big {
		font-family: var(--font-num);
		font-size: 48px;
		line-height: 1;
	}
	.small {
		color: var(--ink-muted);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 36px;
		padding: 0 14px;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: color-mix(in srgb, var(--bg) 55%, transparent);
		color: var(--ink);
		font-size: 14px;
		font-weight: 600;
	}
	.chip.bad {
		border-color: color-mix(in srgb, var(--alert) 45%, transparent);
		background: color-mix(in srgb, var(--alert) 14%, var(--bg));
	}
	.dot {
		width: 8px;
		height: 8px;
		border-radius: 999px;
		background: var(--line);
	}
	.dot.warm {
		background: var(--accent);
	}
	.dot.bad {
		background: var(--alert);
	}
	@media (max-width: 599px) {
		.hero {
			min-height: 120px;
			padding: 16px 16px 14px;
			gap: 12px;
			border-radius: var(--feel-box-radius);
		}
		h1 {
			font-size: 26px;
		}
		.big {
			font-size: 40px;
		}
	}
</style>
