/**
 * Rive's web runtime, loaded once and only where a Rive drawing is on screen.
 * Its WebAssembly is served by the app itself, never fetched from Rive's CDN,
 * so a house without the internet still draws.
 */
import Rive, { type RiveCanvas } from '@rive-app/canvas-advanced';
import wasm from '@rive-app/canvas-advanced/rive.wasm?url';

let loading: Promise<RiveCanvas> | undefined;

export const runtime = (): Promise<RiveCanvas> =>
	(loading ??= Rive({ locateFile: () => wasm }).catch((e) => {
		loading = undefined;
		throw e;
	}));

const files = new Map<string, Promise<Uint8Array>>();

/** A file's bytes, read once per address while the app is open. */
export function riveBytes(src: string): Promise<Uint8Array> {
	let got = files.get(src);
	if (!got) {
		got = fetch(src).then(async (r) => {
			if (!r.ok) throw new Error(`${src}: ${r.status}`);
			return new Uint8Array(await r.arrayBuffer());
		});
		got.catch(() => files.delete(src));
		files.set(src, got);
	}
	return got;
}
