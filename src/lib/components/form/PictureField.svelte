<!--
	A picture for a Picture card (14 §6): chosen with the one picker (design 15,
	P3), from the pictures library or a new one. Chosen while editing the
	household’s page, it’s shared with everyone (P5).
-->
<script lang="ts">
	import PicturePicker from '../PicturePicker.svelte';
	import { editing } from '#lib/edit.svelte.js';
	import { isLibrary, isVideo, sized } from '#lib/pictures.svelte.js';

	let {
		value,
		id,
		disabled = false,
		onchange
	}: {
		value: unknown;
		id: string;
		disabled?: boolean;
		onchange: (v: unknown) => void;
	} = $props();

	const src = $derived(isLibrary(value) ? value : '');
	let choosing = $state(false);
</script>

<div class="picture-field">
	{#if src}<img src={sized(src, isVideo(src) ? 'poster' : 'tile')} alt="" />{/if}
	<div class="row">
		<button type="button" {id} {disabled} onclick={() => (choosing = true)}>
			{src ? 'Choose another' : 'Choose a picture'}
		</button>
		{#if src && !disabled}<button type="button" class="plain" onclick={() => onchange('')}
				>Take it off</button
			>{/if}
	</div>
	<small>From your pictures, or a new one. Settings › Pictures keeps them all.</small>
</div>
{#if choosing}
	<PicturePicker
		title="A picture for this card"
		value={src ? { url: src } : undefined}
		shared={editing.page !== null}
		pick={(p) => onchange(p.url)}
		close={() => (choosing = false)}
	/>
{/if}

<style>
	.picture-field {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	img {
		max-width: 100%;
		max-height: 160px;
		object-fit: contain;
		align-self: flex-start;
		border-radius: 8px;
		border: 1px solid var(--line);
	}
	.row {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	button {
		height: 40px;
		padding: 0 14px;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--surface);
		color: var(--ink);
		font-weight: 600;
	}
	.plain {
		border-color: transparent;
		background: none;
		color: var(--ink-muted);
	}
	small {
		color: var(--ink-muted);
	}
</style>
