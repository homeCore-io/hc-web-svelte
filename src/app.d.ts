// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
	namespace App {}
	/** The app's version, set at build (vite.config.ts). */
	const __APP_VERSION__: string;
}

export {};
