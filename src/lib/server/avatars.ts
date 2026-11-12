/**
 * Everyone's pictures (the PhotoAvatar board): how each person shows,
 * for anyone in the household to see. A person's own document is theirs
 * alone, so this hands out only their picture from it: their choice
 * (`#lib/avatar.ts`) and their name, and their photo by an address of its
 * own (`/ui/avatars/{id}`), served whatever the library says about who else
 * may see the picture.
 *
 * Only a picture they could choose themselves is served: one of their own or
 * one of everyone's, never a video, never someone else's they named.
 */
import { choiceOf, type AvatarChoice } from '#lib/avatar.js';
import { parseFile, sees, type Item } from './library.js';

/** One person's picture, as everyone gets it. */
export interface AvatarEntry {
	id: string;
	/** Their sign-in name when they last saved, so history naming them finds them. */
	username?: string;
	avatar: AvatarChoice;
	/** Their photo's address, which changes with the photo. */
	photo?: string;
}

/** homeCore's user ids are UUIDs; the store's own check is the backstop. */
export const personIdOf = (id: string) => id.toLowerCase().replace(/[^0-9a-f-]/g, '');

/** The library picture a person's document shows them by, if one they may: theirs or everyone's. */
export function avatarPicture(
	owner: string,
	doc: unknown,
	items: Record<string, Item>
): Item | undefined {
	const url = (doc as { photo?: unknown } | undefined)?.photo;
	if (typeof url !== 'string' || !url.startsWith('/ui/pictures/')) return undefined;
	const f = parseFile(url.slice('/ui/pictures/'.length).split('?')[0] ?? '');
	const it = f && !f.size ? items[f.id] : undefined;
	if (!it || it.ext !== f!.ext || it.kind !== 'picture') return undefined;
	return sees(it, { id: owner, username: '', scopes: [] }) ? it : undefined;
}

/** A person's picture for everyone, from their document. */
export function avatarEntry(id: string, doc: unknown, items: Record<string, Item>): AvatarEntry {
	const d = (doc ?? {}) as { avatar?: unknown; username?: unknown };
	const it = avatarPicture(id, doc, items);
	return {
		id,
		...(typeof d.username === 'string' && d.username ? { username: d.username } : {}),
		avatar: choiceOf(d.avatar),
		...(it ? { photo: `/ui/avatars/${id}?v=${it.id}` } : {})
	};
}

/** The file to send for a person's photo: its tile-sized copy if the app made one. */
export const avatarFile = (it: Item) => it.sizes.tile ?? `${it.id}.${it.ext}`;
