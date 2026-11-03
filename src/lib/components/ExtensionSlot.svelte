<!--
	A UI extension's code drawing (13 §12.6, U1): loads its module (once),
	creates its custom element, and hands it an extension's `host` (only what
	drawing needs) and whatever its family gives it (`thing`, a thermostat's
	`values`). Its events reach the caller by name (`act`). If it doesn't load,
	or doesn't define its element in time, the caller draws something else.
-->
<script lang="ts" module>
	const loading = new Map<string, Promise<unknown>>();
	/** Each module, imported once per address for every card; a failed one may be tried again. */
	function load(src: string) {
		let p = loading.get(src);
		if (!p) {
			p = import(/* @vite-ignore */ src);
			p.catch(() => loading.delete(src));
			loading.set(src, p);
		}
		return p;
	}
</script>

<script lang="ts">
	import { untrack } from 'svelte';
	import { createExtensionHost } from '#lib/pluginUi/host.svelte.js';
	import { fileUrl, type ExtElement } from '#lib/extensions.svelte.js';

	let {
		ext,
		props,
		on,
		onfail
	}: {
		ext: ExtElement & { element: { kind: 'code' } };
		props?: Record<string, unknown>;
		on?: Record<string, (detail: Record<string, unknown>) => void>;
		onfail?: (why: string) => void;
	} = $props();

	let box = $state<HTMLDivElement>();
	let el = $state<HTMLElement>();

	const defined = (tag: string) =>
		Promise.race([
			customElements.whenDefined(tag),
			new Promise((_, no) => setTimeout(() => no(new Error(`${tag} was never defined`)), 10_000))
		]);

	const src = $derived(ext.src);
	const tag = $derived(ext.element.element);
	$effect(() => {
		if (!box) return;
		void [src, tag];
		return untrack(() => mount());
	});

	function heard(e: Event) {
		on?.[e.type]?.((e as CustomEvent<Record<string, unknown>>).detail ?? {});
	}
	function mount() {
		let gone = false;
		const x = ext;
		load(x.src)
			.then(() => defined(x.element.element))
			.then(() => {
				if (gone || !box) return;
				const made = document.createElement(x.element.element) as HTMLElement & {
					host?: unknown;
				};
				made.host = createExtensionHost(x.extension.id, (p) => fileUrl(x.extension, p));
				for (const [k, v] of Object.entries(untrack(() => props) ?? {}))
					(made as unknown as Record<string, unknown>)[k] = v;
				for (const name of Object.keys(untrack(() => on) ?? {})) made.addEventListener(name, heard);
				box.replaceChildren(made);
				el = made;
			})
			.catch((e: unknown) => {
				if (gone) return;
				console.warn('[extension]', x.id, e);
				onfail?.(String((e as Error)?.message ?? e));
			});
		return () => {
			gone = true;
			for (const name of Object.keys(untrack(() => on) ?? {})) el?.removeEventListener(name, heard);
			box?.replaceChildren();
			el = undefined;
		};
	}
	// New values are told to the element, not made again.
	$effect(() => {
		if (!el || !props) return;
		const it = el as unknown as Record<string, unknown>;
		for (const [k, v] of Object.entries(props)) if (it[k] !== v) it[k] = v;
	});
</script>

<div class="slot" bind:this={box}></div>

<style>
	.slot {
		min-width: 0;
	}
</style>
