/**
 * A Rive file playing on a canvas (13 §12.4): what RiveDrawing draws with,
 * and what `host.rive.play` hands a plugin's or an extension's own code.
 *
 * It fills the file's view model by property name, and the motion decides how
 * it runs. Still settles each state at once and draws one frame, as it does
 * for anyone whose device asks for less motion. Gentle plays a change and
 * stops once settled. Lively keeps running, so the file's loops play. Off
 * screen, nothing is drawn.
 */
import type { Motion } from '../looks/model.js';
import type { RiveValues } from './values.js';

export interface PlayOptions {
	/** The `.riv` file's address. */
	src: string;
	artboard?: string;
	/** The state machine to run; the artboard's first when left out. */
	stateMachine?: string;
	values?: RiveValues;
	motion?: Motion;
	/** The size to draw at in CSS pixels; the canvas's own size when left out. */
	width?: number;
	height?: number;
}

export interface RivePlayer {
	/** New values for the view model; the change plays as the motion allows. */
	set(values: RiveValues): void;
	/** A different motion, from now on. */
	motion(m: Motion): void;
	/** The names and types of the view model's properties. */
	readonly properties: { name: string; type: string }[];
	/** Stops it and frees what it holds. */
	destroy(): void;
}

const reduced = () =>
	typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Plays `src` on `canvas`. Rejects if the file can't be read or has no state machine. */
export async function play(canvas: HTMLCanvasElement, o: PlayOptions): Promise<RivePlayer> {
	const { runtime, riveBytes } = await import('./runtime.js');
	const [rive, bytes] = await Promise.all([runtime(), riveBytes(o.src)]);
	const file = await rive.load(bytes, undefined, false);
	const art = o.artboard ? file.artboardByName(o.artboard) : file.defaultArtboard();
	const machine = o.stateMachine
		? art.stateMachineByName(o.stateMachine)
		: art.stateMachineCount()
			? art.stateMachineByIndex(0)
			: null;
	if (!machine) {
		art.delete();
		file.unref?.();
		throw new Error('No state machine.');
	}
	const sm = new rive.StateMachineInstance(machine, art);
	const vmi = file.defaultArtboardViewModel(art)?.defaultInstance() ?? null;
	if (vmi) sm.bindViewModelInstance(vmi);
	const properties = (vmi?.getProperties() ?? []).map((p) => ({ name: p.name, type: p.type }));
	const kinds = new Map(properties.map((p) => [p.name, p.type]));
	const renderer = rive.makeRenderer(canvas);

	const dpr = Math.min(window.devicePixelRatio || 1, 3);
	canvas.width = Math.round((o.width ?? canvas.clientWidth ?? 240) * dpr);
	canvas.height = Math.round((o.height ?? canvas.clientHeight ?? 240) * dpr);
	const frame = { minX: 0, minY: 0, maxX: canvas.width, maxY: canvas.height };
	const draw = () => {
		renderer.clear();
		renderer.save();
		renderer.align(rive.Fit.contain, rive.Alignment.center, frame, art.bounds);
		art.draw(renderer);
		renderer.restore();
	};

	let motion: Motion = o.motion ?? 'gentle';
	let raf = 0;
	let last = 0;
	let visible = true;
	let running = false;
	let gone = false;
	const still = () => motion === 'still' || reduced();
	const tick = (at: number) => {
		const dt = last ? Math.min((at - last) / 1000, 0.1) : 0;
		last = at;
		const more = sm.advanceAndApply(dt);
		draw();
		// Gentle stops once settled; Lively keeps going for its loops.
		if (visible && !gone && (more || motion === 'lively')) raf = rive.requestAnimationFrame(tick);
		else running = false;
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
	const run = () => {
		if (gone) return;
		if (still()) return settle();
		if (running || !visible) return;
		running = true;
		last = 0;
		raf = rive.requestAnimationFrame(tick);
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
		else run();
	});
	seen.observe(canvas);

	if (o.values) set(o.values);
	run();
	return {
		properties,
		set(v) {
			set(v);
			run();
		},
		motion(m) {
			motion = m;
			run();
		},
		destroy() {
			if (gone) return;
			gone = true;
			seen.disconnect();
			stop();
			sm.delete();
			art.delete();
			vmi?.delete?.();
			file.unref?.();
		}
	};
}
