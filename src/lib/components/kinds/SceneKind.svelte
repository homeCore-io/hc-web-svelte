<!-- One of homeCore's scenes: a button that runs it (C2). -->
<script lang="ts">
	import { scenes } from '#lib/scenes.svelte.js';
	import type { KindProps } from '#lib/kinds.js';
	import SceneCard from '../SceneCard.svelte';

	let { card, label }: KindProps<'scene'> = $props();
</script>

<SceneCard name={label ?? card.name} run={() => scenes.run(card.id)} />
