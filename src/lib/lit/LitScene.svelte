<!--
	A scene in the Lit look (12): a round swatch. A light scene shows its
	colours; a house scene the light it leaves (night blue when it leaves the
	room dark), a badge for each other kind of thing it changes, and a line
	saying what it does; a keypad's scene, a keypad.
-->
<script lang="ts">
	import { session } from '#lib/me.svelte.js';
	import type { SceneDisc } from './room.js';

	let { s, run }: { s: SceneDisc; run: () => void } = $props();

	const disc = $derived(
		s.colours.length > 0
			? `conic-gradient(from 210deg, ${[...s.colours, s.colours[0]].join(', ')})`
			: s.dark
				? 'radial-gradient(circle at 35% 30%, #34407a, #141a3a 70%)'
				: undefined
	);
	const house = $derived(s.shape === 'house');
</script>

<button
	class="scene"
	class:wide={house}
	disabled={!session.mayRunScenes && !session.mayUse}
	title={s.does}
	aria-label={house ? `Run ${s.name}: ${s.does}` : `Run ${s.name}`}
	onclick={run}
>
	<span class="disc" style:background={disc} aria-hidden="true">
		{#if house && s.dark}
			<svg
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"
				stroke-linejoin="round"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"></path></svg
			>
		{:else if house && s.colours.length === 0}
			<svg
				width="24"
				height="24"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="1.8"
				stroke-linecap="round"
				><path d="M3 21V9l9-6 9 6v12"></path><path d="M9 21v-6h6v6"></path></svg
			>
		{:else if s.shape === 'keypad'}
			<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"
				><circle cx="7" cy="7" r="2"></circle><circle cx="17" cy="7" r="2"></circle><circle
					cx="7"
					cy="17"
					r="2"
				></circle><circle cx="17" cy="17" r="2"></circle></svg
			>
		{/if}
	</span>
	{#if s.badges.length}
		<span class="badges" aria-hidden="true">
			{#each s.badges as b (b)}<span class="badge {b}"></span>{/each}
		</span>
	{/if}
	<span class="name">{s.name}</span>
	{#if house}<span class="does">{s.does}</span>{/if}
</button>

<style>
	.scene {
		position: relative;
		width: 70px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 7px;
		padding: 0;
		border: none;
		background: none;
		color: var(--ink);
	}
	.scene.wide {
		width: 108px;
	}
	.disc {
		display: grid;
		place-items: center;
		width: 52px;
		height: 52px;
		border-radius: 999px;
		box-shadow: 0 0 0 1px var(--line);
		color: #e9edf5;
		background: radial-gradient(circle at 35% 30%, #4a5566, #1f252e 70%);
	}
	.scene:hover .disc,
	.scene:focus-visible .disc {
		box-shadow:
			0 0 0 3px var(--bg),
			0 0 0 5px var(--accent);
	}
	.badges {
		position: absolute;
		top: 34px;
		left: 50%;
		margin-left: 14px;
		display: flex;
		gap: 2px;
	}
	.badge {
		width: 20px;
		height: 20px;
		border-radius: 999px;
		border: 2px solid var(--bg);
		background: var(--surface-2) center / 12px no-repeat;
	}
	/* Each kind of thing a house scene changes, as a small sign on its disc. */
	.badge.lock {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23e9edf5' stroke-width='2.4' stroke-linecap='round'%3E%3Crect x='5' y='11' width='14' height='10' rx='2'/%3E%3Cpath d='M8 11V7a4 4 0 0 1 8 0v4'/%3E%3C/svg%3E");
	}
	.badge.heat {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23e9edf5' stroke-width='2.4' stroke-linecap='round'%3E%3Cpath d='M10 13V5a2 2 0 0 1 4 0v8a4 4 0 1 1-4 0z'/%3E%3C/svg%3E");
	}
	.badge.media {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23e9edf5' stroke-width='2.4' stroke-linecap='round'%3E%3Crect x='3' y='5' width='18' height='12' rx='2'/%3E%3Cpath d='M8 21h8'/%3E%3C/svg%3E");
	}
	.badge.other {
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23e9edf5'%3E%3Ccircle cx='12' cy='12' r='3'/%3E%3C/svg%3E");
	}
	.name {
		font-size: 12px;
		font-weight: 600;
		text-align: center;
		line-height: 1.2;
	}
	.does {
		font-size: 11px;
		color: var(--ink-muted);
		text-align: center;
		line-height: 1.3;
	}
</style>
