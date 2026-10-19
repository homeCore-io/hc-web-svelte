<!--
	Plugins' own cards added to a page (`card:` refs), on the grid with this
	page's layers — order, hidden, size, name and settings — and, while
	arranging, their tools.
-->
<script lang="ts">
	import { apply, cardRef, type Form } from '#lib/layers.js';
	import { pluginUis } from '#lib/pluginUi/uis.svelte.js';
	import { view } from '#lib/view.svelte.js';
	import Arrange from './Arrange.svelte';
	import PluginCard from './PluginCard.svelte';

	let { refs, page }: { refs: string[]; page: string } = $props();

	pluginUis.ensure();
	const layered = $derived(apply(refs, (r) => r, view.changes(page)));
	const arranging = $derived(view.mode(page) !== null);
	const list = $derived(arranging ? [...layered.shown, ...layered.hidden] : layered.shown);
	const found = (r: string) => {
		const c = cardRef(r);
		return c ? pluginUis.card(c.pluginId, c.element) : undefined;
	};
	const formOf = (r: string): Form => {
		const forms = found(r)?.slot.forms ?? [];
		// A card's first size is its own choice of default.
		const f = layered.form(r) ?? forms[0] ?? 'standard';
		return forms.length && !forms.includes(f) ? forms[0]! : f;
	};
</script>

<div class="grid">
	{#each list as r (r)}
		{@const form = formOf(r)}
		<Arrange
			{page}
			ref={r}
			name={layered.name(r) ?? found(r)?.slot.label ?? 'A plugin’s card'}
			shown={layered.shown}
			hidden={layered.hidden.includes(r)}
			star={false}
			{form}
			wide={form === 'large'}
			added
			renamed={layered.name(r) !== undefined}
		>
			<PluginCard cardId={r} {form} config={layered.config(r)} />
		</Arrange>
	{/each}
</div>

<style>
	.grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
		align-items: start;
	}
	@media (min-width: 700px) {
		.grid {
			grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
		}
	}
</style>
