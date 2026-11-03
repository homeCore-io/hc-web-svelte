/**
 * "What changed from Lit" (13 §11): how a look differs from the one it was
 * made from, in the editor's own words, so a person can always find their
 * way back.
 */
import { DRAWINGS, drawingOf, FAMILIES, type Look } from './model.js';

const FEEL_WORDS = {
	density: { roomy: 'roomy', standard: 'standard', compact: 'compact' },
	corners: { square: 'square', soft: 'soft', round: 'round' },
	motion: { still: 'still', gentle: 'gentle', lively: 'lively' }
} as const;
const FAMILY_WORDS = {
	lights: 'Lights',
	switches: 'Switches',
	scenes: 'Scenes',
	doors: 'Doors and locks',
	readings: 'Readings',
	watching: 'Watching'
} as const;
/** How the built-in drawings beyond Classic's and Lit's read in a sentence. */
const PHRASES: Record<string, string> = {
	chip: 'as chips',
	row: 'as rows',
	band: 'with their usual range'
};
const on = (b: boolean) => (b ? 'on' : 'off');
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export function changesFrom(l: Look, base: Look): string[] {
	const out: string[] = [];
	if (l.theme !== base.theme) out.push(`Theme: ${l.theme ?? 'none of its own'}`);
	if (l.ownColors !== base.ownColors) out.push(`Lights in their own colors: ${on(l.ownColors)}`);
	if (l.feel.density !== base.feel.density)
		out.push(`Spacing: ${FEEL_WORDS.density[l.feel.density]}`);
	if (l.feel.corners !== base.feel.corners)
		out.push(`Corners: ${FEEL_WORDS.corners[l.feel.corners]}`);
	if (l.feel.type !== base.feel.type) out.push(`Type size: ${Math.round(l.feel.type * 100)}%`);
	if (l.feel.motion !== base.feel.motion) out.push(`Motion: ${FEEL_WORDS.motion[l.feel.motion]}`);
	for (const f of FAMILIES) {
		const d = drawingOf(l, f);
		if (d === drawingOf(base, f)) continue;
		const made = l.made.find((m) => m.id === d);
		out.push(
			`${FAMILY_WORDS[f]} drawn ${made ? `as “${made.name}”` : d === 'lit' ? 'the Lit way' : d === 'classic' ? 'the Classic way' : d.startsWith('plugin:') ? 'by a plugin' : (PHRASES[d] ?? `as “${DRAWINGS[f].find((x) => x.id === d)?.name ?? d}”`)}`
		);
	}
	for (const m of l.made) {
		const was = base.made.find((x) => x.id === m.id);
		if (was && !same(was, m)) out.push(`“${m.name}” changed`);
	}
	const fr = l.frame;
	const bf = base.frame;
	if (fr.header !== bf.header)
		out.push(
			`Header: ${fr.header === 'glow' ? 'glowing' : fr.header === 'plain' ? 'plain' : 'a plugin’s'}`
		);
	if (fr.rest.piece !== bf.rest.piece)
		out.push(fr.rest.piece ? 'Rest view: a plugin’s' : 'Rest view: Lit’s');
	if (fr.chips !== bf.chips) out.push(`Status chips: ${on(fr.chips)}`);
	if (fr.needs !== bf.needs) out.push(`Needs you first: ${on(fr.needs)}`);
	if (fr.more !== bf.more) out.push(`More folded: ${on(fr.more)}`);
	if (fr.rest.on !== bf.rest.on) out.push(`Rest view on displays: ${on(fr.rest.on)}`);
	else if (fr.rest.on && fr.rest.after !== bf.rest.after)
		out.push(`Rest view after ${fr.rest.after} seconds`);
	if (!same(l.grouping.room, base.grouping.room))
		out.push(
			l.grouping.room
				? `A room’s sections: ${l.grouping.room.map((r) => r.title).join(', ')}`
				: 'Rooms grouped as Classic groups them'
		);
	if (!same(l.grouping.home, base.grouping.home)) out.push('How Home starts');
	if (l.reaches !== base.reaches)
		out.push(l.reaches === 'everywhere' ? 'Reaches every screen' : 'Reaches household pages only');
	return out;
}
