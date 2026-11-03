<!--
	One of homeCore's scenes: a button that runs it (C2); in the Lit look (12),
	its swatch; in a look with a drawing of its own for scenes (13 §6.4), that.
-->
<script lang="ts">
	import { scenes } from '#lib/scenes.svelte.js';
	import type { KindProps } from '#lib/kinds.js';
	import SceneCard from '../SceneCard.svelte';
	import { lookHere } from '#lib/look.svelte.js';
	import { devices } from '#lib/devices.svelte.js';

	const look = lookHere();

	let { card, label }: KindProps<'scene'> = $props();
	const drawing = $derived(look.draws('scenes'));
	const made = $derived(look.def.made.find((m) => m.id === drawing && m.family === 'scenes'));
	const states = $derived(
		(scenes.list.find((x) => x.id === card.id)?.states ?? {}) as Record<string, unknown>
	);
	const run = () => scenes.run(card.id);
</script>

{#snippet plain()}
	<SceneCard name={label ?? card.name} {run} />
{/snippet}

{#if made}
	{#await import('#lib/lit/room.js') then { houseScene }}
		{#await import('#lib/looks/thing.js') then { sceneThing }}
			{#await import('../looks/MadeDrawing.svelte') then { default: MadeDrawing }}
				<MadeDrawing
					{made}
					thing={sceneThing(
						label ?? card.name,
						houseScene(states, devices.byId).colours,
						false,
						''
					)}
					ownColors={look.def.ownColors}
					words="Ready"
					icon="scene"
					act={run}
					open={run}
					preview={look.preview}>{@render plain()}</MadeDrawing
				>
			{/await}
		{/await}
	{/await}
{:else if drawing === 'lit'}
	{#await import('#lib/lit/room.js') then { houseScene }}
		{#await import('#lib/lit/LitScene.svelte') then { default: LitScene }}
			<LitScene
				s={{ card, name: label ?? card.name, ...houseScene(states, devices.byId) }}
				form="chip"
				{run}
			/>
		{/await}
	{/await}
{:else}
	{@render plain()}
{/if}
