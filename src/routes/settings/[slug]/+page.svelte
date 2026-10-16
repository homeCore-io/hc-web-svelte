<!--
	A setting that has its place in Settings but isn't built yet: says what it
	will be and which milestone builds it.
-->
<script lang="ts">
	import { page } from '$app/state';
	import Coming from '#lib/components/Coming.svelte';
	import { settingsItem } from '#lib/settings.js';

	const item = $derived(settingsItem(page.params.slug ?? ''));
</script>

{#if item?.coming}
	<Coming what={item.coming.what} when={item.coming.when} />
{:else}
	<p>There is no setting called “{page.params.slug}”.</p>
{/if}
