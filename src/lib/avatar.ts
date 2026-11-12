/**
 * A person's picture wherever homeCore shows or names them (the PhotoAvatar
 * board): their photo cropped to a circle, their initials on a color (the
 * default), or an icon on a color. Each person chooses their own, kept in
 * their own document (`PersonDoc.avatar`); a photo comes from the pictures
 * library on the app server (`PersonDoc.photo`), never from homeCore.
 *
 * Everyone in the household sees everyone's: the app server hands out each
 * person's choice, and their photo, to anyone signed in (`/ui/avatars`).
 *
 * Read from documents anyone could have written, so anything this app
 * doesn't know is left out. Pure: `Avatar.svelte` draws what this decides.
 */

export const AVATAR_COLORS = [
	'#3d7be0',
	'#1f9d74',
	'#c9542e',
	'#9b59d0',
	'#d4a020',
	'#d0457f',
	'#4b5566',
	'#0e8fa8'
] as const;

/** The board's eight icons, drawn on a 24-unit square in the current color. */
export const AVATAR_ICONS = {
	leaf: '<path d="M5 19c8 0 14-6 14-14-8 0-14 6-14 14zm0 0l7-7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
	star: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" fill="currentColor"/>',
	moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" fill="currentColor"/>',
	paw: '<circle cx="7" cy="9" r="2" fill="currentColor"/><circle cx="12" cy="6.5" r="2" fill="currentColor"/><circle cx="17" cy="9" r="2" fill="currentColor"/><path d="M12 11c-3 0-5.5 4-5.5 6s2 2.5 5.5 2.5 5.5-.5 5.5-2.5-2.5-6-5.5-6z" fill="currentColor"/>',
	bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z" fill="currentColor"/>',
	music:
		'<path d="M9 18V5l11-2v13" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="7" cy="18" r="2.5" fill="currentColor"/><circle cx="18" cy="16" r="2.5" fill="currentColor"/>',
	sun: '<circle cx="12" cy="12" r="4.5" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
	coffee:
		'<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5z" fill="currentColor"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17" fill="none" stroke="currentColor" stroke-width="2"/>'
} as const;

export type IconId = keyof typeof AVATAR_ICONS;
export const ICON_IDS = Object.keys(AVATAR_ICONS) as IconId[];

export type AvatarKind = 'photo' | 'initials' | 'icon';

/** What a person chose. Unsaid, their initials on their own color. */
export interface AvatarChoice {
	kind?: AvatarKind;
	/** One or two letters or digits, over those of their name. */
	initials?: string;
	color?: string;
	icon?: IconId;
}

/** A person's picture as it's drawn. */
export interface AvatarView {
	kind: AvatarKind;
	initials: string;
	color: string;
	icon: IconId;
	/** The photo's address, for a photo. */
	photo?: string;
}

/** Up to two letters or digits, in capitals. */
const cleanInitials = (s: string) =>
	[...s.normalize('NFC').replace(/[^\p{L}\p{N}]/gu, '')].slice(0, 2).join('').toLocaleUpperCase();

/**
 * Initials from a name: the first letters of its first two words ("Alex Lee"
 * is AL), else the first two of its one ("alex" is AL, "j.doe" is JD).
 */
export function initialsOf(name: string): string {
	const words = name
		.trim()
		.split(/[\s._-]+/)
		.filter(Boolean);
	if (words.length >= 2) return cleanInitials(`${[...words[0]!][0]}${[...words[1]!][0]}`) || '?';
	return cleanInitials(words[0] ?? '') || '?';
}

/** A person's own color until they pick one: the same each time, spread across the eight. */
export function colorFor(id: string): string {
	let h = 0;
	for (const c of id) h = (h * 31 + c.codePointAt(0)!) >>> 0;
	return AVATAR_COLORS[h % AVATAR_COLORS.length]!;
}

/** A person's choice, from a document anyone could have written. */
export function choiceOf(v: unknown): AvatarChoice {
	if (typeof v !== 'object' || v === null || Array.isArray(v)) return {};
	const o = v as Record<string, unknown>;
	const out: AvatarChoice = {};
	if (o.kind === 'photo' || o.kind === 'initials' || o.kind === 'icon') out.kind = o.kind;
	const initials = typeof o.initials === 'string' ? cleanInitials(o.initials) : '';
	if (initials) out.initials = initials;
	if ((AVATAR_COLORS as readonly unknown[]).includes(o.color)) out.color = o.color as string;
	if (typeof o.icon === 'string' && o.icon in AVATAR_ICONS) out.icon = o.icon as IconId;
	return out;
}

/**
 * How a person's picture is drawn: their choice, with their photo's address
 * if they have one. A photo chosen and since gone is their initials; a photo
 * from before there was a choice is their photo.
 */
export function avatarView(
	choice: unknown,
	photo: string | undefined,
	who: { id?: string; name: string }
): AvatarView {
	const c = choiceOf(choice);
	const wants = c.kind ?? (photo ? 'photo' : 'initials');
	const kind: AvatarKind = wants === 'photo' && !photo ? 'initials' : wants;
	return {
		kind,
		initials: c.initials ?? initialsOf(who.name),
		color: c.color ?? colorFor(who.id || who.name),
		icon: c.icon ?? 'leaf',
		...(kind === 'photo' ? { photo } : {})
	};
}
