<!-- The house's modes, as chips (Home's scenes and modes). -->
<script lang="ts">
	import type { KindProps } from '#lib/kinds.js';
	import ModeChips from '../ModeChips.svelte';

	let {}: KindProps<'modes'> = $props();
</script>

<ModeChips />
