// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {
		interface PageState {
			/** A room open over Home as a sheet (13 §7, G1); Back closes it (G2). */
			sheet?: string;
			/** A glass sheet open on the phone (phone/Sheet.svelte); Back closes it. */
			phoneSheet?: number;
		}
	}
	/** The app's version, set at build (vite.config.ts). */
	const __APP_VERSION__: string;
}

export {};
