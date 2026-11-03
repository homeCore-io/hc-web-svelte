/**
 * A card's options as this screen sees them, and the layer a sheet changes
 * (G4, G13, N6). Normally and in Customise: the person's card setting, the
 * household's, the person's every-room setting, the household's, then the
 * kind's own. In Edit, the household's alone — the page as everyone sees it.
 *
 * A sheet changes one layer: the person's in Customise, the household's
 * draft in Edit. It's shown what applies without that layer, so it can keep
 * only what differs (`prune`).
 */
import { apply, type Change, type HouseDoc, type PersonDoc } from './layers.js';
import { household } from './household.svelte.js';
import { personal } from './personal.svelte.js';
import { editing } from './edit.svelte.js';
import { view } from './view.svelte.js';
import { prune, resolve, type Options } from './options.js';
import { styleChanges, shellRooms, type ShellRooms, type Style } from './styles.js';

const cardConfig = (changes: Change[], ref: string): Options | undefined =>
	apply([ref], (r) => r, changes).config(ref);

type Doc = HouseDoc | PersonDoc;
const defaultsOf = (doc: Doc, kind: string): Options | undefined => doc.defaults?.[kind];

/** The layers for a card on `page`, most particular first; `mine` is the one a sheet changes. */
function layers(page: string, kind: string, ref: string) {
	if (editing.on(page)) {
		const card = cardConfig(editing.changes(page), ref);
		const kindDefault = defaultsOf(editing.draft, kind);
		return { card: [card], kind: [kindDefault], mineCard: 0, mineKind: 0 };
	}
	const card = [cardConfig(personal.changes(page), ref), cardConfig(household.changes(page), ref)];
	const kindDefault = [defaultsOf(personal.doc, kind), defaultsOf(household.doc, kind)];
	return { card, kind: kindDefault, mineCard: 0, mineKind: 0 };
}

export const kindOptions = {
	/** What applies to a card on this screen. */
	of(page: string, kind: string, ref: string, builtIn: Options): Options {
		const l = layers(page, kind, ref);
		return resolve([...l.card, ...l.kind], builtIn);
	},

	/** A card's own settings in the layer being changed, and what applies without them. */
	card(page: string, kind: string, ref: string, builtIn: Options) {
		const l = layers(page, kind, ref);
		const mine = l.card[l.mineCard] ?? {};
		const without = resolve([...l.card.filter((_, i) => i !== l.mineCard), ...l.kind], builtIn);
		return {
			mine,
			without,
			save: (next: Options) =>
				view.change(page, { op: 'config', ref, config: prune(next, without) })
		};
	},

	/** Every card of a kind (the every-room box): this layer's defaults, and what applies without them. */
	kind(page: string, kind: string, builtIn: Options) {
		const l = layers(page, kind, '');
		const mine = l.kind[l.mineKind] ?? {};
		const without = resolve(
			l.kind.filter((_, i) => i !== l.mineKind),
			builtIn
		);
		return {
			mine,
			without,
			save: (next: Options) => setDefaults(page, kind, prune(next, without))
		};
	},

	/** Cards of this kind with settings of their own: in the layer being changed, and — in Customise — the household's. */
	setOnTheirOwn(page: string, refs: string[]): { ref: string; mine: boolean }[] {
		const own = (changes: Change[], r: string) =>
			Object.keys(cardConfig(changes, r) ?? {}).length > 0;
		if (editing.on(page))
			return refs.filter((r) => own(editing.changes(page), r)).map((ref) => ({ ref, mine: true }));
		return refs.flatMap((ref): { ref: string; mine: boolean }[] =>
			own(personal.changes(page), ref)
				? [{ ref, mine: true }]
				: own(household.changes(page), ref)
					? [{ ref, mine: false }]
					: []
		);
	},

	/** The sidebar's rooms on this screen (G3). */
	shellRooms(page: string): ShellRooms {
		return editing.on(page)
			? shellRooms(editing.draft, undefined)
			: shellRooms(personal.doc, household.doc);
	},

	/** Choose a style for Home, in the layer being changed (G3, G11). */
	chooseStyle(page: string, style: Style): void {
		const { changes, rooms } = styleChanges(style);
		for (const c of changes) view.change(page, c);
		const shell = <D extends Doc>(d: D): D => ({ ...d, shell: { ...d.shell, rooms } });
		if (editing.on(page)) editing.changeDoc(shell);
		else void personal.change(shell);
	}
};

function setDefaults(page: string, kind: string, options: Options): void {
	const set = <D extends Doc>(d: D): D => {
		const defaults = { ...d.defaults };
		if (Object.keys(options).length > 0) defaults[kind] = options;
		else delete defaults[kind];
		return { ...d, defaults };
	};
	if (editing.on(page)) editing.changeDoc(set);
	else void personal.change(set);
}
