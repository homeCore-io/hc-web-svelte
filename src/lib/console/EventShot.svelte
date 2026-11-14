<!--
	An event's still (cameras.ts): the picture the plugin took as it began,
	from its files, 16:9. The plugin keeps only its newest few per camera, so
	an older event's may be gone: then it says so, without asking for it.

	A still is a full-size picture, so it is asked for only once it comes
	near the screen, a few at a time for the whole page (queue.ts), and let
	go of if the page is left first.
-->
<script module lang="ts">
	import { Queue, isAbort } from './queue.js';

	/** Stills asked for at once, for every tile on the page together. */
	const loading = new Queue(3);
</script>

<script lang="ts">
	import { fileUrl } from './cameras.js';
	import { camEvents } from './camEvents.svelte.js';

	let { plugin, path, cam }: { plugin: string | undefined; path: string | undefined; cam: string } =
		$props();

	const src = $derived(path ? fileUrl(plugin, path) : undefined);
	const kept = $derived(path ? camEvents.kept(cam, path) : false);
	let gone = $state<string | undefined>(undefined);
	let shown = $state<{ src: string; url: string } | undefined>(undefined);

	let box = $state<HTMLElement>();
	let near = $state(false);
	$effect(() => {
		if (!box) return;
		const io = new IntersectionObserver((es) => (near = !!es[es.length - 1]?.isIntersecting), {
			rootMargin: '200px'
		});
		io.observe(box);
		return () => io.disconnect();
	});

	$effect(() => {
		const want = src;
		const p = path;
		if (!want || !p || !kept || !near || gone === want || shown?.src === want) return;
		const stop = new AbortController();
		loading
			.run(async () => {
				const res = await fetch(want, { signal: stop.signal });
				if (!res.ok) {
					if (res.status === 404) camEvents.lost(cam, p);
					gone = want;
					return;
				}
				const url = URL.createObjectURL(await res.blob());
				if (stop.signal.aborted) return URL.revokeObjectURL(url);
				if (shown) URL.revokeObjectURL(shown.url);
				shown = { src: want, url };
			}, stop.signal)
			.catch((e) => {
				if (!isAbort(e)) gone = want;
			});
		return () => stop.abort();
	});
	// The picture let go of with the tile.
	$effect(() => () => {
		if (shown) URL.revokeObjectURL(shown.url);
	});
</script>

<span class="shot" bind:this={box}>
	{#if src && kept && gone !== src}
		{#if shown?.src === src}<img src={shown.url} alt="" decoding="async" />{/if}
	{:else}
		<small>{src ? 'Still not kept' : 'No still'}</small>
	{/if}
</span>

<style>
	.shot {
		position: relative;
		display: grid;
		place-items: center;
		width: 100%;
		aspect-ratio: 16 / 9;
		background: #05060a;
		overflow: hidden;
	}
	img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	small {
		font-size: 10.5px;
		color: #7d8594;
	}
</style>
