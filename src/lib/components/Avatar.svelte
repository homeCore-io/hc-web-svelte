<!--
	A person's picture (avatar.ts): their photo cropped to a circle, or their
	initials or an icon on their color. Theirs as they choose it, for the
	person signed in; everyone else's as the app server hands them out. Found
	by their id, or by their name where that's all history gives.

	Until whose picture it is has been read, a quiet circle, and a photo
	fades in as it arrives, so nobody sees the wrong picture first.
-->
<script lang="ts">
	import { AVATAR_ICONS, avatarView } from '#lib/avatar.js';
	import { avatars } from '#lib/avatars.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { personal } from '#lib/personal.svelte.js';
	import { isLibrary, sized } from '#lib/pictures.svelte.js';

	let { person, name, size = 22 }: { person?: string; name: string; size?: number } = $props();

	const me = $derived(
		session.me !== null && (person ? person === session.me.id : name === session.me.username)
	);
	$effect(() => {
		if (!me) avatars.want();
	});
	const ready = $derived(me ? personal.loaded : avatars.loaded);
	let shown = $state<string | undefined>(undefined);
	const view = $derived.by(() => {
		if (me) {
			const photo = personal.doc.photo;
			return avatarView(
				personal.doc.avatar,
				isLibrary(photo) ? sized(photo, size > 120 ? 'screen' : 'tile') : undefined,
				{ id: session.me?.id, name }
			);
		}
		const e = avatars.of(person, name);
		return avatarView(e?.avatar, e?.photo, { id: person ?? e?.id, name });
	});
</script>

<span
	class="avatar"
	class:wait={!ready}
	aria-hidden="true"
	style:--size={`${size}px`}
	style:background={!ready || view.kind === 'photo' ? undefined : view.color}
>
	{#if !ready}{:else if view.kind === 'photo'}<img
			src={view.photo}
			alt=""
			class:in={shown === view.photo}
			onload={() => (shown = view.photo)}
		/>{:else if view.kind === 'icon'}<svg viewBox="0 0 24 24"
			><!-- The app's own drawings (avatar.ts), never a person's words. -->{@html AVATAR_ICONS[
				view.icon
			]}</svg
		>{:else}{view.initials}{/if}
</span>

<style>
	.avatar {
		width: var(--size);
		height: var(--size);
		flex: none;
		border-radius: 50%;
		overflow: hidden;
		background: var(--surface);
		color: #fff;
		font-size: calc(var(--size) * 0.4);
		font-weight: 700;
		line-height: 1;
		letter-spacing: -0.02em;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	/* Not known yet, or a photo on its way: a quiet circle. */
	.wait,
	.avatar:has(img) {
		background: color-mix(in srgb, var(--ink) 12%, transparent);
	}
	img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		opacity: 0;
		transition: opacity 0.2s;
	}
	img.in {
		opacity: 1;
	}
	svg {
		width: 58%;
		height: 58%;
	}
</style>
