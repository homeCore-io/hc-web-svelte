<script lang="ts">
	import '@fontsource/figtree/400.css';
	import '@fontsource/figtree/500.css';
	import '@fontsource/figtree/600.css';
	import '@fontsource/figtree/700.css';
	import '@fontsource/ibm-plex-mono/400.css';
	import '@fontsource/ibm-plex-mono/500.css';
	import '../app.css';
	import { tick, type Component, type Snippet } from 'svelte';
	import { afterNavigate, goto } from '$app/navigation';
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
	import { houseUnits } from '#lib/houseUnits.svelte.js';
	import { alerts } from '#lib/alerts.svelte.js';
	import { lookOf, looksOf, paletteOf } from '#lib/layers.js';
	import { consoleHere, findLook, phoneOwnPage, reachesHere, shellOf } from '#lib/looks/model.js';
	import { look } from '#lib/look.svelte.js';
	import { phone } from '#lib/console/phone/phone.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { docTitle, focusMain } from '#lib/nav.js';

	let { children }: { children: Snippet } = $props();

	// The browser tab's title names the page, so tabs, history and a screen
	// reader's announcement of the new page say where this is.
	const title = $derived(docTitle(page.url.pathname, heading.text));
	// Arriving at another page puts the keyboard at the start of its content,
	// where SvelteKit would leave it on the whole document; staying on the page
	// (a tab, a device's panel, Customize) leaves it where it was.
	afterNavigate((nav) => {
		if (nav.type === 'enter' || !nav.from || nav.from.url.pathname === nav.to?.url.pathname) return;
		// After the page has drawn and anything over the old one (search) has closed.
		void tick().then(() =>
			setTimeout(() => {
				const at = document.activeElement;
				if (!at || at === document.body || !document.getElementById('main')?.contains(at))
					focusMain(undefined, false);
			})
		);
	});

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
		void houseUnits.load();
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
	// Until the documents load, the look this browser last showed.
	const framed = $derived(personal.loaded && household.loaded ? shown.look : look.def);
	// On a phone, Me and the person's picture stay in the console's phone frame.
	const ownOnPhone = $derived(
		phone.current && shellOf(framed) === 'console' && phoneOwnPage(page.url.pathname)
	);
	// Settings and the admin screens keep Classic's feel, unless the look reaches them (S9).
	const reaches = $derived(reachesHere(shown.look, page.url.pathname) || ownOnPhone);
	$effect(() => {
		if (personal.loaded && household.loaded) look.show(shown.look, shown.all, reaches);
	});
	// The console's look is dark unless the person chose light.
	$effect(() => {
		if (personal.loaded && household.loaded) theme.lean(shellOf(shown.look) === 'console');
	});
	// The frame: the console's where a look that puts the app in it reaches,
	// the standard one elsewhere. Until the documents load, the look this
	// browser last showed decides, so the frame doesn't change as they arrive.
	// The console's code is loaded only for those who see it: on a phone's
	// screen, its phone layout (PhonePlan), and only that.
	const desk = $derived(consoleHere(framed, page.url.pathname));
	const small = $derived((desk && phone.current) || ownOnPhone);
	let ConsoleShell = $state<Component<{ children: Snippet }> | null>(null);
	let PhoneShell = $state<Component<{ children: Snippet }> | null>(null);
	$effect(() => {
		if (desk && !small && ConsoleShell === null)
			void import('#lib/console/ConsoleShell.svelte').then((m) => (ConsoleShell = m.default));
		if (small && PhoneShell === null)
			void import('#lib/console/phone/PhoneShell.svelte').then((m) => (PhoneShell = m.default));
	});
	// The page app.html shows while the app starts stays until there's a frame
	// to see: signing in, a display, or the person's frame once it's loaded.
	const drawn = $derived(
		onLogin ||
			session.isDisplay ||
			(session.me !== null && (small ? PhoneShell !== null : desk ? ConsoleShell !== null : true))
	);
	$effect(() => {
		if (drawn) document.getElementById('hc-boot')?.remove();
	});
	// The theme: the person's own, else the house's, else the look's where it reaches (D9a).
	$effect(() => {
		if (personal.loaded && household.loaded)
			theme.paint(paletteOf(personal.doc, household.doc, reaches ? shown.look : undefined));
	});
</script>

<svelte:head>
	{#if !onLogin}<title>{title}</title>{/if}
</svelte:head>

{#if onLogin}
	{@render children()}
{:else if session.isDisplay}
	<Kiosk>{@render children()}</Kiosk>
{:else if session.me !== null}
	{#if small}
		{#if PhoneShell}<PhoneShell>{@render children()}</PhoneShell>{/if}
	{:else if desk}
		{#if ConsoleShell}<ConsoleShell>{@render children()}</ConsoleShell>{/if}
	{:else}
		<Shell>{@render children()}</Shell>
	{/if}
{/if}
<Confirm />
