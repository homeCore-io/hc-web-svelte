/**
 * Where a picture is used, said (design 15, P4): "Garage: its photo", "A
 * Picture card on Home". The server finds the places (`library.ts`); the app
 * knows what they're called.
 */
import type { Picture, Use } from './pictures.svelte.js';

export interface Names {
	room: (id: string) => string | undefined;
	page: (id: string) => string | undefined;
	display: (id: string) => string | undefined;
}

/** A page's key ("home", "room:…", "lit|room:…", "page:…") as its name. */
export function pageName(key: string, n: Names): string {
	const k = key.includes('|') ? key.slice(key.indexOf('|') + 1) : key;
	if (k === 'home') return 'Home';
	if (k.startsWith('room:')) return n.room(k.slice(5)) ?? 'a room';
	if (k.startsWith('page:')) return n.page(k.slice(5)) ?? 'a page';
	return 'a page';
}

export function useName(u: Use, n: Names): string {
	const [first, second] = u.path;
	if (u.in === 'display') {
		const d = n.display(u.id) ?? 'A display';
		return first === 'rest' ? `${d}: its picture frame` : `${d}: its pages`;
	}
	if (first === 'photos' && typeof second === 'string')
		return `${n.room(second) ?? 'A room'}: its photo`;
	if (first === 'photo' && u.in === 'person') return 'Your picture';
	if (first === 'pages' && typeof second === 'string') {
		const where = pageName(second, n);
		return u.in === 'person' ? `A Picture card on your ${where}` : `A Picture card on ${where}`;
	}
	return u.in === 'person' ? 'Your own settings' : 'The household’s settings';
}

/** Every use of a picture, said once each, and how many are in others' own pages. */
export function usesSaid(p: Picture, n: Names): string[] {
	const out = [...new Set(p.uses.map((u) => useName(u, n)))];
	if (p.elsewhere > 0)
		out.push(
			p.elsewhere === 1 ? 'Someone’s own page' : `${p.elsewhere} places on others’ own pages`
		);
	return out;
}
