/**
 * Edit mode (N6), in the address (N5), as every frame of the app follows it:
 * the standard one (Shell) and the console's. Started and ended by `?edit`
 * on a page that can be edited; leaving a page mid-edit asks first.
 *
 * Call it while a frame starts, as `beforeNavigate` needs.
 */
import { untrack } from 'svelte';
import { page } from '$app/state';
import { beforeNavigate, goto } from '$app/navigation';
import { pageKey } from './nav.js';
import { personal } from './personal.svelte.js';
import { session } from './me.svelte.js';
import { editing, LEAVE } from './edit.svelte.js';
import { ask } from './confirm.svelte.js';
import { customise } from './customise.svelte.js';

export function followEdit(): { readonly key: string | null; readonly here: boolean } {
	const pathname = $derived(page.url.pathname);
	const key = $derived(pageKey(pathname));
	// A page of one's own is changed in Customise only (G28).
	const own = $derived(personal.doc.built?.some((p) => `page:${p.id}` === key) ?? false);
	const canEdit = $derived(session.can('content:write') && !own);
	const here = $derived(key !== null && editing.on(key));
	// Follows the address only: Done and Cancel leave the mode before they
	// change the address, and must not be started again on the way out.
	$effect(() => {
		const want = page.url.searchParams.has('edit') && key !== null && canEdit;
		untrack(() => {
			if (want && !editing.on(key!)) {
				customise.page = null;
				editing.start(key!);
			} else if (!want && editing.page !== null) editing.cancel();
		});
	});
	beforeNavigate((nav) => {
		if (editing.count === 0 || nav.to === null) return;
		const staying = nav.to.url.pathname === pathname && nav.to.url.searchParams.has('edit');
		if (staying) return;
		nav.cancel();
		// Closing the tab: the browser asks; a page can't.
		if (nav.type === 'leave') return;
		const to = nav.to.url;
		void ask(LEAVE).then((yes) => {
			if (!yes) return;
			editing.cancel();
			void goto(`${to.pathname}${to.search}${to.hash}`);
		});
	});
	return {
		get key() {
			return key;
		},
		get here() {
			return here;
		}
	};
}
