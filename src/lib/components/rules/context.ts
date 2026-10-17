/**
 * What every part of the rule editor reads (A3): the house, its names, and
 * what this homeCore can do. Set once by the editor, read by each row.
 */
import { getContext, setContext } from 'svelte';
import type { CoreDevice } from '../../devices.js';
import type { House } from '../../ruleWords.js';
import type { Features, Lists, Vocabulary } from '../../ruleEdit.js';

export interface EditorContext {
	readonly house: House;
	readonly devices: CoreDevice[];
	readonly roomOf: (d: CoreDevice) => string | undefined;
	readonly scenes: { id: string; name: string }[];
	readonly modes: CoreDevice[];
	readonly vocab: Vocabulary | null;
	readonly features: Features;
	/** Notification channels known: from settings when readable, and from rules. */
	readonly channels: string[];
	/** What a field naming a rule, calendar, mode or variable chooses from. */
	readonly lists: Lists;
}

const KEY = Symbol('rule-editor');
export const provideEditor = (ctx: EditorContext) => setContext(KEY, ctx);
export const editor = () => getContext<EditorContext>(KEY);
