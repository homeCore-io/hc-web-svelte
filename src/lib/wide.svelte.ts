/**
 * Whether the screen is wide enough for list and detail side by side (08 §3).
 * Below it, the detail is its own page.
 */
import { MediaQuery } from 'svelte/reactivity';

export const WIDE = '(min-width: 900px)';
export const wide = new MediaQuery(WIDE, true);
