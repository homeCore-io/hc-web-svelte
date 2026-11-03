<!--
	What in a room needs someone, a frame piece (13 §7): an unlocked lock, an
	open door, a device that isn't answering, a leak, each with its fix where
	there is one. Nothing at all when nothing does.
-->
<script lang="ts">
	import type { KindProps } from '#lib/kinds.js';
	import { cardFor, type CardView } from '#lib/card.js';
	import { clock } from '#lib/clock.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { commands } from '#lib/commands.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { ref } from '#lib/layers.js';
	import { view } from '#lib/view.svelte.js';
	import type { Card } from '#lib/page.js';
	import { litRoom } from './room.js';

	let { card, page }: KindProps<'needs'> = $props();

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
		Object.fromEntries(cards.map((c): [string, CardView] => [c.ref, cardFor(c.device, clock.now)]))
	);
	const problems = $derived(litRoom(cards, views).problems);
	const arranging = $derived(view.mode(page) !== null);
	function fix(f: { device: string; want: Record<string, unknown> }) {
		const d = devices.byId[f.device];
		if (d)
			void commands.set(f.device, views[ref.device(f.device)]?.kind ?? '', f.want, d.attributes);
	}
</script>

{#if problems.length}
	<section class="needs span-all" aria-label="Needs you">
		{#each problems as p (p.key)}
			<div class="need">
				<span class="words"
					><b>{p.title}</b>{#if p.detail}<small>{p.detail}</small>{/if}</span
				>
				{#if p.fix && session.mayUse}<button class="go" onclick={() => fix(p.fix!)}
						>{p.fix.label}</button
					>{/if}
			</div>
		{/each}
	</section>
{:else if arranging}
	<p class="quiet span-all">Nothing needs anyone now. What does shows here.</p>
{/if}

<style>
	.needs {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.need {
		flex: 1 1 320px;
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 12px 12px 12px 16px;
		border-radius: 16px;
		border: 1px solid color-mix(in srgb, var(--alert) 45%, transparent);
		background: color-mix(in srgb, var(--alert) 10%, var(--surface));
	}
	.words {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	small {
		color: var(--ink-muted);
		font-size: 12.5px;
	}
	.go {
		height: 40px;
		padding: 0 20px;
		border: none;
		border-radius: 999px;
		background: var(--accent);
		color: var(--accent-ink);
		font-weight: 700;
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
	}
</style>
