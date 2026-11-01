<!--
	Pages (D4, G27–G28): the house's own pages, then this person's, each with
	its symbol, whose it is and what's on it — and New page. A page opens at
	/pages/<id>, drawn and arranged like Home.
-->
<script lang="ts">
	import Plus from '@lucide/svelte/icons/plus';
	import PanelsTopLeft from '@lucide/svelte/icons/panels-top-left';
	import { household } from '#lib/household.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { listPages } from '#lib/built.js';
	import RoomIcon from '#lib/components/RoomIcon.svelte';

	const pages = $derived(listPages(household.doc, personal.doc));
	let making = $state(false);

	const sub = (p: { whose: string; cards: number }) =>
		`${p.whose === 'house' ? 'Everyone' : 'Just you'} · ${
			p.cards === 0 ? 'empty' : p.cards === 1 ? '1 card' : `${p.cards} cards`
		}`;
</script>

<div class="page">
	<p class="lead">
		{pages.length === 0
			? 'Pages you make — a kitchen panel, the garden, movie night — with what you choose on them.'
			: 'The house’s pages, then yours. Tap one to open it.'}
	</p>
	<div class="grid">
		{#each pages as p (p.id)}
			<a class="tile" href={`/pages/${p.id}`}>
				<span class="icon"
					>{#if p.icon}<RoomIcon name={p.icon} size={18} />{:else}<PanelsTopLeft
							size={18}
							strokeWidth={1.8}
							aria-hidden="true"
						/>{/if}</span
				>
				<span class="text"><b>{p.name}</b><small>{sub(p)}</small></span>
			</a>
		{/each}
		{#if !session.isDisplay}
			<button class="new" onclick={() => (making = true)}
				><Plus size={16} aria-hidden="true" />New page</button
			>
		{/if}
	</div>
</div>

{#if making}
	{#await import('#lib/components/NewPage.svelte') then { default: NewPage }}
		<NewPage close={() => (making = false)} />
	{/await}
{/if}

<style>
	.page {
		display: flex;
		flex-direction: column;
		gap: 14px;
		max-width: 1100px;
	}
	.lead {
		margin: 0;
		font-size: 14px;
		color: var(--ink-muted);
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
		gap: 10px;
	}
	.tile,
	.new {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 64px;
		padding: 12px 14px;
		box-sizing: border-box;
		border-radius: 14px;
		text-decoration: none;
	}
	.tile {
		border: 1px solid var(--card-line);
		background: var(--surface);
		color: var(--ink);
		box-shadow: var(--shadow);
	}
	.icon {
		flex: none;
		width: 36px;
		height: 36px;
		border-radius: 10px;
		background: var(--surface-2);
		color: var(--ink-muted);
		display: grid;
		place-items: center;
	}
	.text {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	b {
		font-size: 15px;
		font-weight: 600;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	small {
		font-size: 12px;
		color: var(--ink-muted);
	}
	.new {
		border: 1px dashed var(--accent);
		background: none;
		color: var(--accent);
		font: inherit;
		font-size: 14px;
		font-weight: 700;
	}
</style>
