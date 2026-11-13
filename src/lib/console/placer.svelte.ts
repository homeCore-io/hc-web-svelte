/**
 * The "⋯" picker's state, for a room in the console: which device's picker
 * is open, and by which button. ConsoleRoom provides it and draws the one
 * popover (Placer.svelte); each device's "⋯" (Place.svelte) opens it. Outside
 * a room (Everywhere, Home) there is none, and no "⋯".
 */
import { getContext, setContext } from 'svelte';

const KEY = Symbol('placer');

export interface Placing {
	id: string;
	/** The "⋯" that opened it, to sit by and to go back to. */
	from: HTMLElement;
	/** Where that was when it opened. */
	rect: DOMRect;
}

export class Placer {
	open = $state.raw<Placing | null>(null);
	/** The Lights tab's width, as the room lays it out (room.ts), for the tab it is on now. */
	width: () => number;
	constructor(width: () => number) {
		this.width = width;
	}
	toggle(id: string, from: HTMLElement): void {
		this.open = this.open?.id === id ? null : { id, from, rect: from.getBoundingClientRect() };
	}
	/** Closes it; `back` puts the keyboard on its "⋯" again, or the room's tab when that's gone. */
	close(back = false): void {
		const was = this.open;
		this.open = null;
		if (!back || !was) return;
		if (was.from.isConnected) was.from.focus();
		else document.querySelector<HTMLElement>('[role=tab][aria-selected=true]')?.focus();
	}
}

export const providePlacer = (p: Placer): Placer => setContext(KEY, p);
export const placer = (): Placer | undefined => getContext<Placer | undefined>(KEY);
