<!--
	A page that isn't there, or went wrong: said in words under its own
	heading, with the way home, inside the app's frame.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { heading } from '#lib/heading.svelte.js';

	const missing = $derived(page.status === 404);
	$effect(() => heading.show(missing ? 'Not found' : 'Something went wrong'));
</script>

<p class="quiet">
	{missing
		? 'There is no page at this address.'
		: (page.error?.message ?? 'This page couldn’t be shown.')}
	<a href="/">Back to Home</a>
</p>
