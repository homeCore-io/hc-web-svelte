/**
 * Putting things into a stack and taking them out (13 §13.2), from its
 * settings, Move to, or dragging. Each writes the stack's `things` in the
 * layer being arranged, as its settings sheet does.
 */
import { kindOptions } from './kindOptions.svelte.js';
import { readStack, stackBase } from './stack.js';

/** What a look's grouping put in each stack on screen (`Card.things`), set by the page drawing them. */
export const grouped = new Map<string, string[]>();

const base = (stack: string) => stackBase({ things: grouped.get(stack) });

/** The things in a stack on this screen. */
export const thingsIn = (page: string, stack: string): string[] =>
	readStack(kindOptions.of(page, 'stack', stack, base(stack))).things;

function write(page: string, stack: string, things: string[]): void {
	const sheet = kindOptions.card(page, 'stack', stack, base(stack));
	sheet.save({ ...sheet.mine, things });
}

/**
 * Puts a thing in a stack, at the end or before another of its things; out
 * of `from`, another stack, first, so it's on the page once.
 */
export function putIn(
	page: string,
	stack: string,
	thing: string,
	o: { from?: string; before?: string | null } = {}
): void {
	if (o.from && o.from !== stack) takeOut(page, o.from, thing);
	const now = thingsIn(page, stack).filter((t) => t !== thing);
	const at = o.before ? now.indexOf(o.before) : -1;
	write(page, stack, at < 0 ? [...now, thing] : [...now.slice(0, at), thing, ...now.slice(at)]);
}

/** Takes a thing out of a stack; its own card comes back where the page has one. */
export function takeOut(page: string, stack: string, thing: string): void {
	write(
		page,
		stack,
		thingsIn(page, stack).filter((t) => t !== thing)
	);
}
