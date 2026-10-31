<!--
	A card drawn by its kind (G2): the kind's component, or — for the app's
	own cards — the one it loads the first time it's drawn (G-c), so they
	aren't part of Home's first download.
-->
<script lang="ts">
	import { kindOf, type KindProps } from '#lib/kinds.js';

	let props: KindProps = $props();
	const kind = $derived(kindOf(props.card));
</script>

{#if kind.component}
	{@const Draw = kind.component}
	<Draw {...props} />
{:else if kind.load}
	{#await kind.load() then { default: Draw }}
		<Draw {...props} />
	{/await}
{/if}
