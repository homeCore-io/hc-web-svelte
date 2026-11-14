<!--
	You › Picture (the PhotoAvatar board): how a person shows wherever
	homeCore shows or names them. Their photo, cropped to a circle; their
	initials on a color, the default; or an icon on a color. Just theirs,
	kept in their own document; a photo comes from the pictures library on
	the app server, never homeCore. Everyone in the household sees it.
-->
<script lang="ts">
	import Upload from '@lucide/svelte/icons/upload';
	import { personal } from '#lib/personal.svelte.js';
	import { session } from '#lib/me.svelte.js';
	import { heading } from '#lib/heading.svelte.js';
	import { isLibrary, sized } from '#lib/pictures.svelte.js';
	import { roleName } from '#lib/people.js';
	import { radioKeys, radioTab } from '#lib/radios.js';
	import {
		AVATAR_COLORS,
		AVATAR_ICONS,
		avatarView,
		choiceOf,
		ICON_IDS,
		initialsOf,
		type AvatarChoice,
		type AvatarKind,
		type IconId
	} from '#lib/avatar.js';
	import Avatar from '#lib/components/Avatar.svelte';
	import PicturePicker from '#lib/components/PicturePicker.svelte';

	$effect(() => heading.show('Your picture', { href: '/me', label: 'Me' }));

	const name = $derived(session.me?.username ?? '');
	const choice = $derived(choiceOf(personal.doc.avatar));
	const photo = $derived(isLibrary(personal.doc.photo) ? personal.doc.photo : undefined);
	const view = $derived(
		avatarView(personal.doc.avatar, photo ? sized(photo, 'tile') : undefined, {
			id: session.me?.id,
			name
		})
	);

	/** A change to their choice; a field set to undefined goes back to its default. */
	function choose(patch: Partial<AvatarChoice>) {
		void personal.change((d) => {
			const next: Record<string, unknown> = { ...choiceOf(d.avatar), ...patch };
			for (const k of Object.keys(next)) if (next[k] === undefined) delete next[k];
			const { avatar: _was, ...rest } = d;
			return Object.keys(next).length > 0 ? { ...rest, avatar: next as AvatarChoice } : rest;
		});
	}
	let choosingPhoto = $state(false);
	function pick(kind: AvatarKind) {
		if (kind === 'photo' && !photo) choosingPhoto = true;
		else choose({ kind });
	}
	/** A photo picked is their picture from now on; with none, their initials again. */
	function setPhoto(url: string | undefined) {
		void personal.change((d) => {
			const { photo: _was, avatar: _choice, ...rest } = d;
			const avatar = choiceOf(d.avatar);
			if (url) avatar.kind = 'photo';
			else if (avatar.kind === 'photo') delete avatar.kind;
			return {
				...rest,
				...(url ? { photo: url } : {}),
				...(Object.keys(avatar).length > 0 ? { avatar } : {})
			};
		});
	}

	let typed = $state<string | null>(null);
	const initials = $derived(typed ?? choice.initials ?? initialsOf(name));
	function setInitials(v: string) {
		typed = v;
		const own = v.trim() === '' || v.toUpperCase() === initialsOf(name) ? undefined : v;
		choose({ initials: own });
	}

	const OPTIONS: { id: AvatarKind; name: string; note: string }[] = [
		{
			id: 'photo',
			name: 'Photo',
			note: 'Kept on the app server, never in homeCore. Cropped to a circle.'
		},
		{ id: 'initials', name: 'Initials', note: 'The default. Your initials on a color you pick.' },
		{ id: 'icon', name: 'Icon', note: 'A symbol on your color.' }
	];
	const ICON_NAMES: Record<IconId, string> = {
		leaf: 'Leaf',
		star: 'Star',
		moon: 'Moon',
		paw: 'Paw',
		bolt: 'Bolt',
		music: 'Music',
		sun: 'Sun',
		coffee: 'Coffee'
	};
	const COLOR_NAMES = ['Blue', 'Green', 'Rust', 'Violet', 'Gold', 'Pink', 'Slate', 'Teal'];
</script>

<div class="pic">
	<p class="lead">How you show wherever homeCore shows or names a person. Just you.</p>

	<div class="opts" role="radiogroup" aria-label="Your picture" tabindex="-1" onkeydown={radioKeys}>
		{#each OPTIONS as o, i (o.id)}
			<button
				type="button"
				class="opt"
				role="radio"
				aria-checked={view.kind === o.id}
				tabindex={radioTab(
					view.kind === o.id,
					i === 0,
					OPTIONS.some((x) => x.id === view.kind)
				)}
				onclick={() => pick(o.id)}
			>
				<span class="face" style:background={o.id === 'photo' ? undefined : view.color}>
					{#if o.id === 'photo'}{#if photo}<img src={sized(photo, 'tile')} alt="" />{:else}<Upload
								size={22}
								aria-hidden="true"
							/>{/if}{:else if o.id === 'icon'}<svg viewBox="0 0 24 24" aria-hidden="true"
							><!-- The app's own drawings (avatar.ts). -->{@html AVATAR_ICONS[view.icon]}</svg
						>{:else}{initials || '?'}{/if}
				</span>
				<b>{o.name}</b>
				<small>{o.note}</small>
			</button>
		{/each}
	</div>

	<section class="card">
		{#if view.kind === 'photo'}
			<h2>Photo</h2>
			<div class="btns">
				<button type="button" class="btn" onclick={() => (choosingPhoto = true)}
					>{photo ? 'Choose another photo…' : 'Choose a photo…'}</button
				>
				{#if photo}<button type="button" class="btn ghost" onclick={() => setPhoto(undefined)}
						>No photo</button
					>{/if}
			</div>
			<p class="note">It’s shown centered, filling the circle.</p>
		{:else}
			{#if view.kind === 'initials'}
				<h2><label for="initials">Initials</label></h2>
				<input
					id="initials"
					class="in"
					value={initials}
					maxlength="2"
					autocomplete="off"
					oninput={(e) => setInitials(e.currentTarget.value)}
				/>
			{:else}
				<h2>Icon</h2>
				<div class="icons" role="radiogroup" aria-label="Icon" tabindex="-1" onkeydown={radioKeys}>
					{#each ICON_IDS as k, i (k)}
						<button
							type="button"
							role="radio"
							aria-checked={view.icon === k}
							tabindex={radioTab(view.icon === k, i === 0, ICON_IDS.includes(view.icon))}
							aria-label={ICON_NAMES[k]}
							onclick={() => choose({ icon: k })}
							><svg viewBox="0 0 24 24" aria-hidden="true"
								><!-- The app's own drawings (avatar.ts). -->{@html AVATAR_ICONS[k]}</svg
							></button
						>
					{/each}
				</div>
			{/if}
			<h2 class="next">Color</h2>
			<div class="sw" role="radiogroup" aria-label="Color" tabindex="-1" onkeydown={radioKeys}>
				{#each AVATAR_COLORS as c, i (c)}
					<button
						type="button"
						role="radio"
						aria-checked={view.color === c}
						tabindex={radioTab(
							view.color === c,
							i === 0,
							(AVATAR_COLORS as readonly string[]).includes(view.color)
						)}
						aria-label={COLOR_NAMES[i]}
						style:background={c}
						onclick={() => choose({ color: c })}
					></button>
				{/each}
			</div>
		{/if}
	</section>

	<section class="where" aria-label="Where it shows">
		<h2 class="k">WHERE IT SHOWS</h2>
		<div class="wrow">
			<span class="k">TOOLBAR</span><span class="grow"></span><Avatar
				person={session.me?.id}
				{name}
				size={32}
			/>
		</div>
		<div class="wrow">
			<span class="k">SIDEBAR</span><Avatar person={session.me?.id} {name} size={22} /><b>You</b>
		</div>
		<div class="wrow">
			<span class="k">PEOPLE</span><Avatar person={session.me?.id} {name} size={36} /><span
				><b>{name}</b><small>{session.me ? roleName(session.me.role) : ''}</small></span
			>
		</div>
		<div class="wrow">
			<span class="k">JUST ME</span><Avatar person={session.me?.id} {name} size={16} /><span
				>Only you see these changes</span
			>
		</div>
		<div class="wrow">
			<span class="k">HISTORY</span><span>Run now by</span><Avatar
				person={session.me?.id}
				{name}
				size={16}
			/><b>{name}</b>
		</div>
	</section>
</div>

{#if choosingPhoto}
	<PicturePicker
		title="Your photo"
		value={photo ? { url: photo } : undefined}
		videos={false}
		pick={(p) => setPhoto(p.url)}
		clear={photo ? () => setPhoto(undefined) : undefined}
		close={() => (choosingPhoto = false)}
	/>
{/if}

<style>
	.pic {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 340px);
		grid-template-areas: 'lead where' 'opts where' 'card where';
		align-items: start;
		gap: 14px 22px;
		max-width: 1040px;
	}
	.lead {
		grid-area: lead;
		margin: 0;
		color: var(--ink-muted);
	}
	.opts {
		grid-area: opts;
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
	}
	.opt {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		padding: 16px 12px;
		border: 0;
		border-radius: 14px;
		background: color-mix(in srgb, var(--ink) 4%, transparent);
		box-shadow: inset 0 0 0 1px var(--line);
		color: var(--ink);
		font: inherit;
		text-align: center;
		cursor: pointer;
	}
	.opt[aria-checked='true'] {
		background: color-mix(in srgb, var(--accent) 8%, transparent);
		box-shadow: inset 0 0 0 2px var(--accent);
	}
	.opt b {
		font-size: 14px;
	}
	.opt small {
		color: var(--ink-muted);
		font-size: 12px;
		line-height: 1.4;
	}
	.face {
		width: 64px;
		height: 64px;
		display: grid;
		place-items: center;
		overflow: hidden;
		border-radius: 50%;
		background: color-mix(in srgb, var(--ink) 10%, transparent);
		color: #fff;
		font-size: 24px;
		font-weight: 700;
	}
	.face img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.face svg {
		width: 58%;
		height: 58%;
	}
	.card {
		grid-area: card;
		padding: 16px;
		border-radius: 14px;
		background: color-mix(in srgb, var(--ink) 4%, transparent);
		box-shadow: inset 0 0 0 1px var(--line);
	}
	.card h2 {
		margin: 0 0 8px;
		font-size: 13px;
		font-weight: 700;
	}
	.card h2.next {
		margin-top: 14px;
	}
	.note {
		margin: 8px 0 0;
		color: var(--ink-muted);
		font-size: 12px;
	}
	.btns {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.btn {
		height: 34px;
		padding: 0 14px;
		border: 0;
		border-radius: 9px;
		background: var(--accent);
		color: var(--accent-ink, #fff);
		font: 600 13px var(--font);
		cursor: pointer;
	}
	.btn.ghost {
		background: color-mix(in srgb, var(--ink) 8%, transparent);
		color: var(--ink);
	}
	.in {
		width: 90px;
		height: 34px;
		box-sizing: border-box;
		padding: 0 10px;
		border: 1px solid var(--line);
		border-radius: 9px;
		background: var(--surface);
		color: var(--ink);
		font: 600 15px var(--font);
		text-transform: uppercase;
	}
	.icons {
		display: grid;
		grid-template-columns: repeat(8, minmax(0, 40px));
		gap: 6px;
	}
	.icons button {
		aspect-ratio: 1;
		display: grid;
		place-items: center;
		padding: 0;
		border: 1px solid var(--line);
		border-radius: 10px;
		background: transparent;
		color: var(--ink-muted);
		cursor: pointer;
	}
	.icons button[aria-checked='true'] {
		border-color: var(--accent);
		background: color-mix(in srgb, var(--accent) 14%, transparent);
		color: var(--accent);
	}
	.icons svg {
		width: 18px;
		height: 18px;
	}
	.sw {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}
	.sw button {
		width: 28px;
		height: 28px;
		padding: 0;
		border: 0;
		border-radius: 50%;
		cursor: pointer;
	}
	.sw button[aria-checked='true'] {
		box-shadow:
			0 0 0 2px var(--bg, var(--surface)),
			0 0 0 4px var(--ink);
	}
	.where {
		grid-area: where;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.k {
		width: 84px;
		flex: none;
		margin: 0;
		color: var(--ink-muted);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.05em;
	}
	.where > h2.k {
		width: auto;
	}
	.wrow {
		display: flex;
		align-items: center;
		gap: 10px;
		min-height: 44px;
		padding: 6px 12px;
		box-sizing: border-box;
		border-radius: 12px;
		background: color-mix(in srgb, var(--ink) 4%, transparent);
		box-shadow: inset 0 0 0 1px var(--line);
		font-size: 13px;
	}
	.wrow small {
		display: block;
		color: var(--ink-muted);
		font-size: 11.5px;
	}
	.grow {
		flex: 1;
	}
	@media (max-width: 760px) {
		.pic {
			grid-template-columns: minmax(0, 1fr);
			grid-template-areas: 'lead' 'opts' 'card' 'where';
		}
		.opts {
			grid-template-columns: minmax(0, 1fr);
		}
		.opt {
			flex-direction: row;
			text-align: left;
		}
	}
</style>
