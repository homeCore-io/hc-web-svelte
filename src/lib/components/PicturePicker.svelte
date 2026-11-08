<!--
	The one picker every place uses (design 15, P3): a picture from the library
	or a new one, and for a place with words over it, which part stays in view
	and how dark it goes behind them. A place everyone sees (a room, a display,
	a household page) takes only everyone's pictures: choosing one's own there
	says so, and shares it (P5).
-->
<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import X from '@lucide/svelte/icons/x';
	import Upload from '@lucide/svelte/icons/upload';
	import Play from '@lucide/svelte/icons/play';
	import {
		ACCEPT,
		FOCUS,
		isVideo,
		pictures,
		sized,
		type Picked,
		type Picture
	} from '#lib/pictures.svelte.js';

	let {
		title,
		value,
		shared = false,
		videos = true,
		over = false,
		pick,
		clear,
		close
	}: {
		title: string;
		value?: Picked;
		/** A place everyone sees. */
		shared?: boolean;
		/** Whether a video may go here. */
		videos?: boolean;
		/** Words go over it: offer where it sits and how dark. */
		over?: boolean;
		pick: (p: Picked) => void;
		/** "No picture": take it off. */
		clear?: () => void;
		close: () => void;
	} = $props();

	let dialog = $state<HTMLDialogElement>();
	let input = $state<HTMLInputElement>();
	// What it has now, to start from; the picker's own from then on.
	const start = untrack(() => value);
	let chosen = $state(start?.url.split('?')[0] ?? '');
	let focus = $state(start?.focus ?? 4);
	let dim = $state(start?.dim ?? 35);
	let problem = $state('');
	let busy = $state(false);

	onMount(() => {
		dialog?.showModal();
		if (!pictures.loaded) void pictures.load();
	});

	const choices = $derived(pictures.items.filter((p) => videos || p.kind !== 'video'));
	const picked = $derived(pictures.items.find((p) => p.url === chosen));
	const theirs = $derived(shared && picked !== undefined && !picked.shared);
	const POS = FOCUS;
	const SPOT = [
		'Top left',
		'Top',
		'Top right',
		'Left',
		'Middle',
		'Right',
		'Bottom left',
		'Bottom',
		'Bottom right'
	];

	async function send(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (input) input.value = '';
		if (!file) return;
		problem = '';
		const sent = await pictures.upload(file, { shared });
		if (sent.ok) chosen = sent.picture.url;
		else problem = sent.error;
	}

	async function use() {
		if (!picked) return;
		busy = true;
		if (theirs) {
			const why = await pictures.share(picked.url);
			if (why) {
				problem = why;
				busy = false;
				return;
			}
		}
		pick({ url: picked.url, ...(over ? { focus, dim } : {}) });
		dialog?.close();
	}

	const tile = (p: Picture) => sized(p.url, 'tile');
</script>

<dialog
	bind:this={dialog}
	aria-labelledby="picker-h"
	onclose={close}
	onclick={(e) => {
		if (e.target === dialog) dialog?.close();
	}}
>
	<div class="box">
		<header>
			<h2 id="picker-h">{title}</h2>
			<button type="button" class="x" aria-label="Close" onclick={() => dialog?.close()}
				><X size={20} /></button
			>
		</header>
		<div class="body">
			<div class="grid" role="radiogroup" aria-label="Pictures">
				<input
					bind:this={input}
					type="file"
					accept={videos ? ACCEPT : ACCEPT.replace(/,video\/[a-z0-9]+/g, '')}
					onchange={send}
					hidden
				/>
				<button type="button" class="new" onclick={() => input?.click()}
					><Upload size={18} aria-hidden="true" />Upload new</button
				>
				{#each pictures.sending as s (s.id)}
					<div class="tile sending" aria-label={`Sending ${s.name}`}>
						<span>Sending… {s.pct}%</span>
						<span class="bar"><span style:width={`${s.pct}%`}></span></span>
					</div>
				{/each}
				{#each choices as p (p.id)}
					<button
						type="button"
						class="tile"
						role="radio"
						aria-checked={chosen === p.url}
						aria-label={p.name}
						onclick={() => (chosen = p.url)}
					>
						<img src={tile(p)} alt="" loading="lazy" />
						{#if p.kind === 'video'}<span class="badge"><Play size={11} aria-hidden="true" /></span
							>{/if}
						<span class="name"
							>{p.name}{#if !p.shared}<em>{' · just me'}</em>{/if}</span
						>
					</button>
				{/each}
				{#if pictures.loaded && choices.length === 0 && pictures.sending.length === 0}
					<p class="quiet none">No pictures yet. Upload one.</p>
				{/if}
			</div>
			<div class="side">
				{#if picked}
					<div class="look" style:--pos={POS[focus]} style:--dim={dim / 100}>
						{#if isVideo(picked.url)}
							<img src={sized(picked.url, 'poster')} alt="" />
						{:else}
							<img src={sized(picked.url, 'screen')} alt="" />
						{/if}
						{#if over}<span class="words">Words over it</span>{/if}
					</div>
					{#if over}
						<div class="spot">
							<div class="dots" role="radiogroup" aria-label="Where it sits">
								{#each POS as _, i (i)}
									<button
										type="button"
										role="radio"
										aria-checked={focus === i}
										aria-label={SPOT[i]}
										onclick={() => (focus = i)}
									></button>
								{/each}
							</div>
							<span class="quiet"
								>Where it sits: the part kept in view when the place is short or wide.</span
							>
						</div>
						<label class="quiet range"
							>Darken it, so the words stay easy to read
							<input type="range" min="0" max="70" bind:value={dim} /></label
						>
					{/if}
					{#if theirs}
						<p class="note">
							This one is yours alone. Everyone sees this place, so using it here shares it with
							everyone in the house.
						</p>
					{/if}
				{:else}
					<p class="quiet">Choose a picture, or upload one.</p>
				{/if}
				{#if problem}<p class="problem" role="alert">{problem}</p>{/if}
				<div class="acts">
					<button type="button" class="use" disabled={!picked || busy} onclick={use}
						>{theirs ? 'Share it and use it' : 'Use this'}</button
					>
					{#if clear && value?.url}
						<button
							type="button"
							class="plain"
							onclick={() => {
								clear();
								dialog?.close();
							}}>No picture</button
						>
					{/if}
				</div>
			</div>
		</div>
	</div>
</dialog>

<style>
	dialog {
		margin: 6vh auto auto;
		padding: 0;
		width: min(980px, calc(100vw - 24px));
		border: none;
		border-radius: var(--radius-sheet);
		background: var(--sheet);
		color: var(--ink);
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
	}
	dialog::backdrop {
		background: var(--scrim);
	}
	.box {
		display: flex;
		flex-direction: column;
		gap: 14px;
		padding: 16px 18px 20px;
	}
	header {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	h2 {
		margin: 0;
		font-size: 20px;
	}
	.x {
		display: grid;
		place-items: center;
		width: 40px;
		height: 40px;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: var(--surface);
		color: var(--ink-muted);
	}
	.body {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 300px;
		gap: 18px;
	}
	@media (max-width: 720px) {
		.body {
			grid-template-columns: 1fr;
		}
	}
	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 8px;
		align-content: start;
		max-height: 60vh;
		overflow: auto;
	}
	.tile,
	.new {
		position: relative;
		height: 104px;
		padding: 0;
		border-radius: 12px;
		border: 1px solid var(--line);
		background: var(--surface-2);
		color: var(--ink);
		overflow: hidden;
	}
	.new {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 6px;
		border-style: dashed;
		color: var(--accent);
		font-weight: 600;
		font-size: 13px;
	}
	.tile img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		display: block;
	}
	.tile[aria-checked='true'] {
		outline: 3px solid var(--accent);
		outline-offset: -3px;
	}
	.tile .name {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		padding: 14px 8px 5px;
		background: linear-gradient(transparent, rgba(0, 0, 0, 0.75));
		color: #fff;
		font-size: 11.5px;
		text-align: left;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.tile .name em {
		font-style: normal;
		color: #f7c866;
	}
	.badge {
		position: absolute;
		left: 6px;
		top: 6px;
		display: grid;
		place-items: center;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: rgba(0, 0, 0, 0.6);
		color: #fff;
	}
	.sending {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 8px;
		font-size: 12px;
		color: var(--ink-muted);
	}
	.bar {
		width: 70%;
		height: 5px;
		border-radius: 3px;
		background: var(--line);
	}
	.bar span {
		display: block;
		height: 5px;
		border-radius: 3px;
		background: var(--accent);
	}
	.side {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.look {
		position: relative;
		height: 150px;
		border-radius: 14px;
		overflow: hidden;
		background: var(--surface-2);
	}
	.look img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: var(--pos);
		display: block;
	}
	.look::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			90deg,
			rgba(10, 12, 16, var(--dim)),
			rgba(10, 12, 16, calc(var(--dim) / 2.5))
		);
	}
	.words {
		position: absolute;
		left: 14px;
		top: 12px;
		z-index: 1;
		color: #fff;
		font-size: 20px;
		font-weight: 700;
	}
	.spot {
		display: flex;
		gap: 12px;
		align-items: center;
	}
	.dots {
		display: grid;
		grid-template-columns: repeat(3, 22px);
		gap: 4px;
		flex: none;
	}
	.dots button {
		width: 22px;
		height: 22px;
		padding: 0;
		border-radius: 6px;
		border: 1px solid var(--line);
		background: var(--surface);
	}
	.dots button[aria-checked='true'] {
		background: var(--accent);
		border-color: var(--accent);
	}
	.range {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.quiet {
		margin: 0;
		color: var(--ink-muted);
		font-size: 12.5px;
		line-height: 1.4;
	}
	.none {
		grid-column: 1 / -1;
	}
	.note {
		margin: 0;
		padding: 10px 12px;
		border-radius: 12px;
		border: 1px solid color-mix(in srgb, var(--accent) 40%, transparent);
		background: color-mix(in srgb, var(--accent) 12%, transparent);
		font-size: 12.5px;
		line-height: 1.45;
	}
	.problem {
		margin: 0;
		color: var(--alert);
		font-size: 13px;
	}
	.acts {
		display: flex;
		gap: 8px;
		margin-top: auto;
	}
	.use {
		flex: 1;
		height: 42px;
		border: none;
		border-radius: 999px;
		background: var(--accent);
		color: var(--accent-ink, #1a1406);
		font-weight: 700;
	}
	.use:disabled {
		opacity: 0.5;
	}
	.plain {
		height: 42px;
		padding: 0 16px;
		border-radius: 999px;
		border: 1px solid var(--line);
		background: var(--surface);
		color: var(--ink);
	}
</style>
