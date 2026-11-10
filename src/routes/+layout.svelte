<script lang="ts">
	import '@fontsource/figtree/400.css';
	import '@fontsource/figtree/500.css';
	import '@fontsource/figtree/600.css';
	import '@fontsource/figtree/700.css';
	import '@fontsource/ibm-plex-mono/400.css';
	import '@fontsource/ibm-plex-mono/500.css';
	import '../app.css';
	import type { Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Shell from '#lib/components/Shell.svelte';
	import Kiosk from '#lib/components/Kiosk.svelte';
	import Confirm from '#lib/components/Confirm.svelte';
	import { session } from '#lib/me.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { live } from '#lib/live.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { scenes } from '#lib/scenes.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { theme } from '#lib/theme.svelte.js';
	import { household } from '#lib/household.svelte.js';
	import { alerts } from '#lib/alerts.svelte.js';
	import { lookOf, looksOf, paletteOf } from '#lib/layers.js';
	import { findLook, reachesHere } from '#lib/looks/model.js';
	import { look } from '#lib/look.svelte.js';

	let { children }: { children: Snippet } = $props();

	// Pages that stand alone: signing in, and making this screen a display.
	const onLogin = $derived(page.url.pathname === '/login' || page.url.pathname === '/display');

	// Ask homeCore who this is once; send anyone who isn't signed in to sign in.
	$effect(() => {
		if (!session.known) void session.load();
	});
	$effect(() => {
		if (session.known && session.me === null && !onLogin) void goto('/login');
	});
	// A tab left open across an upgrade still runs the old app, whose code-split
	// pieces (the Style picker, Add's sheet) are gone from the new server: the
	// buttons would do nothing. Load the new app instead, once a minute at most.
	$effect(() => {
		const stale = (e: Event) => {
			try {
				if (Date.now() - Number(sessionStorage.getItem('hc-reloaded') ?? 0) < 60_000) return;
				sessionStorage.setItem('hc-reloaded', String(Date.now()));
			} catch {
				/* no storage: reload anyway */
			}
			e.preventDefault();
			location.reload();
		};
		addEventListener('vite:preloadError', stale);
		return () => removeEventListener('vite:preloadError', stale);
	});
	// Signed in: connect to the house.
	$effect(() => {
		if (session.me === null) return;
		void rooms.load();
		void devices.load();
		void scenes.load();
		void alerts.load();
		const unhear = personal.onLoad((doc) => theme.adopt(doc.theme));
		void personal.load();
		void household.load();
		clock.start();
		live.start();
		return () => {
			unhear();
			live.stop();
		};
	});
	// The look (13 §3.1): a display's own, else the person's, else the house's, else Classic.
	const shown = $derived.by(() => {
		const all = looksOf(personal.doc, household.doc);
		const own = look.display;
		return {
			all,
			look:
				own && all.some((l) => l.id === own)
					? findLook(all, own)
					: lookOf(personal.doc, household.doc, all)
		};
	});
	// Settings and the admin screens keep Classic's feel, unless the look reaches them (S9).
	const reaches = $derived(reachesHere(shown.look, page.url.pathname));
	$effect(() => {
		if (personal.loaded && household.loaded) look.show(shown.look, shown.all, reaches);
	});
	// The theme: the person's own, else the house's, else the look's where it reaches (D9a).
	$effect(() => {
		if (personal.loaded && household.loaded)
			theme.paint(paletteOf(personal.doc, household.doc, reaches ? shown.look : undefined));
	});
</script>

{#if onLogin}
	{@render children()}
{:else if session.isDisplay}
	<Kiosk>{@render children()}</Kiosk>
{:else if session.me !== null}
	<Shell>{@render children()}</Shell>
{/if}
<Confirm />
