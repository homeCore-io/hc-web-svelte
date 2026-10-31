<!-- A plugin's own card, added to the page, with its settings here (D9b). -->
<script lang="ts">
	import type { KindProps } from '#lib/kinds.js';
	import PluginCard from '../PluginCard.svelte';

	let { card, form, config }: KindProps<'plugin'> = $props();
</script>

<PluginCard cardId={card.ref} {form} {config} />
