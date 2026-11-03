<!--
	A drawing made in Rive (13 §6): its file drawn on a canvas, its view model
	filled from the thing (rive/values.ts). It never commands anything; taps go
	to whatever holds it.

	The look's motion decides how it moves. Still draws each state's settled
	pose, at once and without moving, as it does for anyone whose device asks
	for less motion. Gentle plays the changes and stops once settled. Lively
	keeps playing, so a file's loops run. Off screen, nothing is drawn.

	Until the file is drawn, and if it can't be, `children` is shown instead.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { Motion } from '#lib/looks/model.js';
	import type { RiveValues } from './values.js';

	let {
		src,
		artboard,
		stateMachine,
		values,
		motion,
		label,
		width,
		height,
		children
	}: {
		src: string;
		artboard?: string;
		stateMachine?: string;
		values: RiveValues;
		motion: Motion;
		label: string;
		/** Its largest size; it shrinks to fit narrower. */
		width: number;
		height: number;
		children?: Snippet;
	} = $props();

	let canvas = $state<HTMLCanvasElement>();
	let drawn = $state(false);
	let failed = $state(false);

	// What the running drawing exposes to the effects below.
	let scene:
		| {
				set(v: RiveValues): void;
				run(): void;
				stop(): void;
				still: boolean;
		  }
		| undefined = $state();

	const reduced = () =>
		typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

	$effect(() => {
		const el = canvas;
		if (!el) return;
		let gone = false;
		let cleanup = () => {};
		void (async () => {
			try {
				const { runtime, riveBytes } = await import('./runtime.js');
				const [rive, bytes] = await Promise.all([runtime(), riveBytes(src)]);
				if (gone) return;
				const file = await rive.load(bytes, undefined, false);
				if (gone) return;
				const art = artboard ? file.artboardByName(artboard) : file.defaultArtboard();
				const machine = stateMachine
					? art.stateMachineByName(stateMachine)
					: art.stateMachineCount()
						? art.stateMachineByIndex(0)
						: null;
				if (!machine) throw new Error('No state machine.');
				const sm = new rive.StateMachineInstance(machine, art);
				const vm = file.defaultArtboardViewModel(art);
				const vmi = vm?.defaultInstance() ?? null;
				if (vmi) sm.bindViewModelInstance(vmi);
				const kinds = new Map((vmi?.getProperties() ?? []).map((p) => [p.name, p.type]));
				const renderer = rive.makeRenderer(el);

				const dpr = Math.min(window.devicePixelRatio || 1, 3);
				el.width = Math.round(width * dpr);
				el.height = Math.round(height * dpr);
				const frame = { minX: 0, minY: 0, maxX: el.width, maxY: el.height };
				const draw = () => {
					renderer.clear();
					renderer.save();
					renderer.align(rive.Fit.contain, rive.Alignment.center, frame, art.bounds);
					art.draw(renderer);
					renderer.restore();
				};

				let raf = 0;
				let last = 0;
				let visible = true;
				let running = false;
				const tick = (at: number) => {
					const dt = last ? Math.min((at - last) / 1000, 0.1) : 0;
					last = at;
					const more = sm.advanceAndApply(dt);
					draw();
					// Gentle stops once settled; Lively keeps going for its loops.
					if (visible && (more || motion === 'lively')) raf = rive.requestAnimationFrame(tick);
					else running = false;
				};
				const run = () => {
					if (running || !visible || gone) return;
					running = true;
					last = 0;
					raf = rive.requestAnimationFrame(tick);
				};
				const stop = () => {
					rive.cancelAnimationFrame(raf);
					running = false;
				};
				// Still: past every blend and ease at once, then one frame.
				const settle = () => {
					stop();
					for (let i = 0; i < 180; i++) sm.advanceAndApply(1 / 60);
					draw();
					rive.resolveAnimationFrame();
				};
				const set = (v: RiveValues) => {
					if (!vmi) return;
					for (const [k, x] of Object.entries(v)) {
						const kind = kinds.get(k);
						if (kind === 'boolean' && typeof x === 'boolean') vmi.boolean(k).value = x;
						else if (kind === 'number' && typeof x === 'number') vmi.number(k).value = x;
						else if (kind === 'string' && typeof x === 'string') vmi.string(k).value = x;
					}
				};

				const seen = new IntersectionObserver(([e]) => {
					visible = !!e?.isIntersecting;
					if (!visible) stop();
					else if (scene && !scene.still) run();
				});
				seen.observe(el);

				scene = {
					set,
					still: false,
					run() {
						if (this.still) settle();
						else run();
					},
					stop
				};
				cleanup = () => {
					seen.disconnect();
					stop();
					sm.delete();
					art.delete();
					vmi?.delete?.();
					file.unref?.();
				};
				drawn = true;
			} catch (e) {
				console.warn('[rive]', src, e);
				failed = true;
			}
		})();
		return () => {
			gone = true;
			cleanup();
			scene = undefined;
		};
	});

	// Each change of the thing's values, or of the motion, is played (or settled) once.
	$effect(() => {
		const s = scene;
		if (!s) return;
		s.still = motion === 'still' || reduced();
		s.set($state.snapshot(values) as RiveValues);
		s.run();
	});
</script>

<div
	class="rive"
	role="img"
	aria-label={label}
	style:max-width={`${width}px`}
	style:aspect-ratio={`${width} / ${height}`}
>
	{#if !drawn && children}<div class="instead">{@render children()}</div>{/if}
	{#if !failed}
		<canvas bind:this={canvas} class:hidden={!drawn} aria-hidden="true"></canvas>
	{/if}
</div>

<style>
	.rive {
		position: relative;
		width: 100%;
	}
	canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
	.hidden {
		visibility: hidden;
	}
	.instead {
		position: absolute;
		inset: 0;
	}
</style>
