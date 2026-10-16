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
	import { session } from '#lib/me.svelte.js';
	import { rooms } from '#lib/rooms.svelte.js';
	import { live } from '#lib/live.svelte.js';
	import { devices } from '#lib/devices.svelte.js';
	import { scenes } from '#lib/scenes.svelte.js';
	import { clock } from '#lib/clock.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { theme } from '#lib/theme.svelte.js';

	let { children }: { children: Snippet } = $props();

	const onLogin = $derived(page.url.pathname === '/login');

	// Ask homeCore who this is once; send anyone who isn't signed in to sign in.
	$effect(() => {
		if (!session.known) void session.load();
	});
	$effect(() => {
		if (session.known && session.me === null && !onLogin) void goto('/login');
	});
	// Signed in: connect to the house.
	$effect(() => {
		if (session.me === null) return;
		void rooms.load();
		void devices.load();
		void scenes.load();
		const unhear = personal.onLoad((doc) => theme.adopt(doc.theme));
		void personal.load();
		clock.start();
		live.start();
		return () => {
			unhear();
			live.stop();
		};
	});
</script>

{#if onLogin}
	{@render children()}
{:else if session.me !== null}
	<Shell>{@render children()}</Shell>
{/if}
