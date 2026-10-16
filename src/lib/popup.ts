/**
 * The open device popup lives in the address (N5): `?device={id}` over
 * whatever page it opened on — so the phone's back gesture closes it, a
 * popup can be linked to, and a reload keeps it open.
 */
import { goto } from '$app/navigation';

/** Whether the popup now open was opened from inside the app, so back closes it. */
let openedHere = false;

/** The page the popup opens over — `page.url` will do. */
type From = { readonly href: string };

export function deviceHref(id: string, from: From): string {
	const url = new URL(from.href);
	url.searchParams.set('device', id);
	return url.pathname + url.search;
}

export function openDevice(id: string, from: From): void {
	openedHere = true;
	// Over the page as it is: no scroll to the top, focus left where it was.
	void goto(deviceHref(id, from), { reset: false });
}

export function closeDevice(from: From): void {
	if (openedHere) {
		openedHere = false;
		history.back();
		return;
	}
	const url = new URL(from.href);
	url.searchParams.delete('device');
	void goto(url.pathname + url.search, { replace: true, reset: false });
}
