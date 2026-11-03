<!--
	One of homeCore's scenes: a button that runs it (C2); in the Lit look (12),
	its swatch; in a look with a drawing of its own for scenes (13 §6.4), that.
-->
<script lang="ts">
	import { scenes } from '#lib/scenes.svelte.js';
	import type { KindProps } from '#lib/kinds.js';
	import SceneCard from '../SceneCard.svelte';
	import { lookHere } from '#lib/look.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { pluginUis } from '#lib/pluginUi/uis.svelte.js';
	import { extensions } from '#lib/extensions.svelte.js';
	import { optionValues } from '#lib/drawingOptions.js';

	const look = lookHere();

	let { card, label }: KindProps<'scene'> = $props();
	const drawing = $derived(look.draws('scenes'));
	const made = $derived(look.def.made.find((m) => m.id === drawing && m.family === 'scenes'));
	// A plugin's drawing for scenes (13 §12.1), while its plugin offers it.
	const plugin = $derived.by(() => {
		if (!drawing.startsWith('plugin:')) return undefined;
		const found = pluginUis.look(drawing);
		return found?.slot.slot === 'look.drawing' && found.slot.draws?.includes('scenes')
			? found
			: undefined;
	});
	let pluginFailed = $state(false);
	// A UI extension's code drawing for scenes (13 §12.6).
	extensions.ensure();
	const code = $derived(extensions.code(drawing, 'scenes'));
	let codeFailed = $state(false);
	const states = $derived(
		(scenes.list.find((x) => x.id === card.id)?.states ?? {}) as Record<string, unknown>
	);
	const run = () => scenes.run(card.id);
</script>

{#snippet plain()}
	<SceneCard name={label ?? card.name} {run} />
{/snippet}

{#if made}
	{#await import('#lib/lit/room.js') then { houseScene }}
		{#await import('#lib/looks/thing.js') then { sceneThing }}
			{#await import('../looks/MadeDrawing.svelte') then { default: MadeDrawing }}
				<MadeDrawing
					{made}
					thing={sceneThing(
						label ?? card.name,
						houseScene(states, devices.byId).colours,
						false,
						''
					)}
					ownColors={look.def.ownColors}
					words="Ready"
					icon="scene"
					act={run}
					open={run}
					preview={look.preview}>{@render plain()}</MadeDrawing
				>
			{/await}
		{/await}
	{/await}
{:else if plugin && !pluginFailed}
	{#await import('#lib/lit/room.js') then { houseScene }}
		{#await import('#lib/looks/thing.js') then { sceneThing }}
			{#await import('#lib/pluginUi/PluginSlot.svelte') then { default: PluginSlot }}
				<PluginSlot
					pluginId={plugin.pluginId}
					ui={plugin.ui}
					slot={plugin.slot}
					props={{
						thing: sceneThing(
							label ?? card.name,
							houseScene(states, devices.byId).colours,
							false,
							''
						),
						options: optionValues(look.def, drawing)
					}}
					on={{ act: () => !look.preview && run() }}
					onfail={() => (pluginFailed = true)}
				/>
			{/await}
		{/await}
	{/await}
{:else if code && !codeFailed}
	{#await import('#lib/lit/room.js') then { houseScene }}
		{#await import('#lib/looks/thing.js') then { sceneThing }}
			{#await import('../ExtensionSlot.svelte') then { default: ExtensionSlot }}
				<ExtensionSlot
					ext={code}
					props={{
						thing: sceneThing(
							label ?? card.name,
							houseScene(states, devices.byId).colours,
							false,
							''
						),
						options: optionValues(look.def, drawing)
					}}
					on={{ act: () => !look.preview && run() }}
					onfail={() => (codeFailed = true)}
				/>
			{/await}
		{/await}
	{/await}
{:else if drawing === 'lit'}
	{#await import('#lib/lit/room.js') then { houseScene }}
		{#await import('#lib/lit/LitScene.svelte') then { default: LitScene }}
			<LitScene
				s={{ card, name: label ?? card.name, ...houseScene(states, devices.byId) }}
				form="chip"
				{run}
			/>
		{/await}
	{/await}
{:else}
	{@render plain()}
{/if}
