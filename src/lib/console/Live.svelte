<!--
	A camera's live video (mse.ts), played only while it's on screen and the
	page is showing: the NVR allows only a few sessions, so a view scrolled
	away or a tab in the background lets its stream go. Until it plays, and
	whenever it isn't, its snapshot shows in its place.
-->
<script lang="ts">
	import { Live, type Playing } from './mse.js';

	let {
		stream,
		poster,
		onstate
	}: {
		/** go2rtc's name for the stream; none, and only the snapshot shows. */
		stream: string | undefined;
		/** The camera's snapshot, shown until the video plays. */
		poster?: string;
		onstate?: (s: Playing) => void;
	} = $props();

	let box = $state<HTMLElement>();
	let video = $state<HTMLVideoElement>();
	let seen = $state(false);
	let showing = $state(typeof document === 'undefined' || !document.hidden);
	let playing = $state<Playing>('paused');

	$effect(() => {
		if (!box) return;
		const io = new IntersectionObserver(
			(es) => {
				const e = es[es.length - 1];
				seen = !!e && e.isIntersecting && e.intersectionRatio >= 0.15;
			},
			{ threshold: [0, 0.15, 0.5] }
		);
		io.observe(box);
		return () => io.disconnect();
	});
	$effect(() => {
		const f = () => (showing = !document.hidden);
		document.addEventListener('visibilitychange', f);
		return () => document.removeEventListener('visibilitychange', f);
	});
	$effect(() => {
		const v = video;
		if (!v || !stream || !seen || !showing) {
			playing = 'paused';
			return;
		}
		const l = new Live(v, stream, (s) => (playing = s));
		return () => l.stop();
	});
	$effect(() => onstate?.(playing));
</script>

<div class="live" bind:this={box}>
	{#if poster}<img class="poster" class:gone={playing === 'live'} src={poster} alt="" />{/if}
	<video bind:this={video} class:on={playing === 'live'} muted autoplay playsinline></video>
</div>

<style>
	.live {
		position: absolute;
		inset: 0;
		background: #05060a;
	}
	video,
	.poster {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	video {
		opacity: 0;
		transition: opacity 0.3s;
	}
	video.on {
		opacity: 1;
	}
	.poster.gone {
		visibility: hidden;
	}
</style>
