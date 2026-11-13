/**
 * Whether this screen is a phone's, for the console's look (width.ts): the
 * root layout draws the phone's frame (PhoneShell) in place of the desktop's
 * while it is. Small on purpose: everything else of the phone's is loaded
 * only when it's needed.
 *
 * And the frame's services to its pages: opening the person's own
 * settings from their picture, at the top of a page; and telling a room's
 * tabs to stack their columns, each as wide as the phone.
 */
import { getContext, setContext } from 'svelte';
import { MediaQuery } from 'svelte/reactivity';
import { PHONE_QUERY } from './width.js';

export const phone = new MediaQuery(PHONE_QUERY, false);

const KEY = Symbol('phone-you');

/** Opens the person's own settings, from the picture `from` (focus goes back to it). */
export type OpenYou = (from: HTMLElement) => void;

export const provideYou = (open: OpenYou): OpenYou => setContext(KEY, open);
export const openYou = (): OpenYou | undefined => getContext<OpenYou | undefined>(KEY);

const STACKED = Symbol('phone-stacked');

/** A room's tabs below here stack their columns (Col), each as wide as the phone. */
export const provideStacked = (): boolean => setContext(STACKED, true);
export const stacked = (): boolean => getContext<boolean | undefined>(STACKED) === true;
