<!-- One of homeCore's scenes: a button that runs it (C2); in the Lit look (12), its swatch. -->
<script lang="ts">
	import { scenes } from '#lib/scenes.svelte.js';
	import type { KindProps } from '#lib/kinds.js';
	import SceneCard from '../SceneCard.svelte';
	import { look } from '#lib/look.svelte.js';
	import { devices } from '#lib/devices.svelte.js';

	let { card, label }: KindProps<'scene'> = $props();
</script>

{#if look.draws('scenes') === 'lit'}
	{#await import('#lib/lit/room.js') then { houseScene }}
		{#await import('#lib/lit/LitScene.svelte') then { default: LitScene }}
			<LitScene
				s={{
					card,
					name: label ?? card.name,
					...houseScene(
						(scenes.list.find((x) => x.id === card.id)?.states ?? {}) as Record<string, unknown>,
						devices.byId
					)
				}}
				form="chip"
				run={() => scenes.run(card.id)}
			/>
		{/await}
	{/await}
{:else}
	<SceneCard name={label ?? card.name} run={() => scenes.run(card.id)} />
{/if}
