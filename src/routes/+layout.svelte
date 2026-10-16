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
		live.start();
		return () => live.stop();
	});
</script>

{#if onLogin}
	{@render children()}
{:else if session.me !== null}
	<Shell>{@render children()}</Shell>
{/if}
