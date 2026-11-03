<!--
	Look (D9a, N2, 13 §11): the house's look, its own looks, its theme, and
	the phone bar for anyone who hasn't chosen their own. Each person may
	still choose differently on Me.
-->
<script lang="ts">
	import { household } from '#lib/household.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { BAR_SIZE, PALETTES, houseBar, lookOf, looksOf, paletteOf } from '#lib/layers.js';
	import { BUILT_IN, allLooks } from '#lib/looks/model.js';
	import BarChooser from '#lib/components/BarChooser.svelte';
	import LookPicker from '#lib/components/LookPicker.svelte';
	import LookShelf from '#lib/components/LookShelf.svelte';

	// The house's looks: built in and its own, not anyone's personal ones.
	const looks = $derived(looksOf(undefined, household.doc));
	const ours = $derived(allLooks(household.doc.looks).slice(BUILT_IN.length));
	const chosen = $derived(lookOf(undefined, household.doc, looks));
	const pickLook = (id: string | undefined) => household.change((d) => ({ ...d, look: id }));

	const current = $derived(paletteOf(undefined, household.doc));
	const bar = $derived(
		houseBar(
			household.doc,
			rooms.list.map((r) => r.id)
		)
	);
	const setBar = (next: string[]) => household.change((d) => ({ ...d, bar: next }));
</script>

{#if !session.can('content:write')}
	<p class="quiet">Settings are for people who may change the house.</p>
{:else}
	<div class="stack">
		<section>
			<h2 class="section-label">The house's look</h2>
			<p class="quiet">
				How rooms, Home and displays are drawn, for everyone who hasn't chosen their own on Me.
			</p>
			<LookPicker label="The house's look" {looks} current={chosen.id} pick={pickLook} />
			<LookShelf
				label="The house's own looks"
				own={ours}
				all={looks}
				{chosen}
				save={(next) => household.change((d) => ({ ...d, looks: next }))}
				pick={pickLook}
			/>
		</section>

		<section>
			<h2 class="section-label" id="palette">The house's theme</h2>
			<p class="quiet">What everyone sees, unless they choose another on Me.</p>
			<div class="swatches" role="radiogroup" aria-labelledby="palette">
				{#each PALETTES as p (p.id)}
					<button
						role="radio"
						aria-checked={current === p.id}
						onclick={() => household.change((d) => ({ ...d, palette: p.id }))}
					>
						<span class="swatch" style:background={p.swatch}></span>
						{p.name}
					</button>
				{/each}
			</div>
		</section>

		<section>
			<h2 class="section-label" id="bar">The household's phone bar</h2>
			<p class="quiet">
				Up to {BAR_SIZE} places, then More — for everyone who hasn't chosen their own.
			</p>
			<BarChooser
				{bar}
				label="The household's phone bar"
				set={setBar}
				pages={household.doc.built ?? []}
			/>
		</section>
		{#if household.trouble}<p class="trouble" role="alert">{household.trouble}</p>{/if}
	</div>
{/if}

<style>
	.stack {
		max-width: 520px;
		display: flex;
		flex-direction: column;
		gap: var(--space-5);
		margin-top: var(--space-2);
	}
	section {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}
	.swatches {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
	}
	.swatches button {
		display: flex;
		align-items: center;
		gap: 8px;
		height: 40px;
		padding: 0 14px 0 10px;
		border-radius: 20px;
		border: 1px solid var(--line);
		background: var(--surface);
		font-weight: 600;
	}
	.swatches button[aria-checked='true'] {
		border-color: var(--ink);
		box-shadow: inset 0 0 0 1px var(--ink);
	}
	.swatch {
		width: 18px;
		height: 18px;
		border-radius: 50%;
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 13px;
	}
	.trouble {
		margin: 0;
		color: var(--alert);
	}
</style>
