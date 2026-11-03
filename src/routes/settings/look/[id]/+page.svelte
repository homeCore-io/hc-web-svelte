<!--
	Changing one of the house's own looks (13 §11): the look editor, for
	people who may edit the house's pages. Classic and Lit aren't changed;
	they are copied first.
-->
<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { household } from '#lib/household.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { look } from '#lib/look.svelte.js';
	import { looksOf, paletteOf } from '#lib/layers.js';
	import { BUILT_IN, allLooks, type Look } from '#lib/looks/model.js';
	import LookEditor from '#lib/components/looks/LookEditor.svelte';

	const id = $derived(page.params.id ?? '');
	const all = $derived(looksOf(undefined, household.doc));
	const mine = $derived(
		allLooks(household.doc.looks)
			.slice(BUILT_IN.length)
			.find((l) => l.id === id)
	);
	// The theme on screen before the editor shows the look's.
	const palette = paletteOf(personal.doc, household.doc, look.def);

	async function save(next: Look): Promise<string | null> {
		await household.change((d) => ({
			...d,
			looks: (d.looks ?? []).map((l) => ((l as { id?: unknown })?.id === next.id ? next : l))
		}));
		return household.trouble;
	}
</script>

{#if !session.can('content:write')}
	<p class="quiet">Settings are for people who may change the house.</p>
{:else if !household.loaded}
	<p class="quiet">Loading…</p>
{:else if !mine}
	<p class="quiet">
		This look isn't one of the house's own. <a href="/settings/look">Back to Look</a>
	</p>
{:else}
	{#key mine.id}
		<LookEditor
			initial={mine}
			{all}
			{palette}
			admin={session.isAdmin || session.can('plugins:write')}
			{save}
			back={() => goto('/settings/look')}
		/>
	{/key}
{/if}
