<!--
	Changing a look of one's own (13 §11, E1): the same editor as the house's,
	every tab, kept in the person's own document.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { household } from '#lib/household.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { look } from '#lib/look.svelte.js';
	import { looksOf, paletteOf } from '#lib/layers.js';
	import { allLooks, type Look } from '#lib/looks/model.js';
	import LookEditor from '#lib/components/looks/LookEditor.svelte';

	const id = $derived(page.params.id ?? '');
	const all = $derived(looksOf(personal.doc, household.doc));
	// Their own: those after the built-in ones and the house's.
	const mine = $derived(all.slice(allLooks(household.doc.looks).length).find((l) => l.id === id));
	const palette = paletteOf(personal.doc, household.doc, look.def);

	async function save(next: Look): Promise<string | null> {
		await personal.change((d) => ({
			...d,
			looks: (d.looks ?? []).map((l) => ((l as { id?: unknown })?.id === next.id ? next : l))
		}));
		return personal.trouble;
	}
</script>

{#if !personal.loaded || !household.loaded}
	<p class="quiet">Loading…</p>
{:else if !mine}
	<p class="quiet">This look isn't one of your own. <a href="/me">Back to Me</a></p>
{:else}
	{#key mine.id}
		<LookEditor
			initial={mine}
			{all}
			{palette}
			admin={session.isAdmin || session.can('plugins:write')}
			{save}
			back={() => goto('/me')}
		/>
	{/key}
{/if}
