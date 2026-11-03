<!--
	One of the house's own things, drawn as a look would draw it: the look
	editor's choice of drawings (13 §11.3) shows each one this way.
-->
<script lang="ts">
	import { previewIn } from '#lib/look.svelte.js';
	import type { Look } from '#lib/looks/model.js';
	import type { Card, Layout } from '#lib/page.js';
	import KindView from '../KindView.svelte';

	let { look, card, layout }: { look: Look; card: Card; layout?: Layout } = $props();

	previewIn(() => look);
</script>

<div class="sample" inert>
	<KindView {card} page="preview|sample" cardTools={false} {layout} />
</div>

<style>
	.sample {
		min-width: 0;
		pointer-events: none;
	}
</style>
