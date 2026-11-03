<!-- A heading the household or a person put in a section (G-c): it spans the section. -->
<script lang="ts">
	import { kindOptions } from '#lib/kindOptions.svelte.js';
	import type { KindProps } from '#lib/kinds.js';
	import { HEADING_BUILT_IN } from '#lib/options.js';

	let { card, page, options }: KindProps<'heading'> = $props();
	const o = $derived(options ?? kindOptions.of(page, 'heading', card.ref, HEADING_BUILT_IN));
	const text = $derived(String(o.text ?? '').trim() || 'Heading');
</script>

<h3 class="span-all">{text}</h3>

<style>
	h3 {
		margin: 6px 0 0;
		font-size: 17px;
		font-weight: 700;
	}
</style>
