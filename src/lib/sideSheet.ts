/**
 * A sheet beside the page (Add, a stack's settings) leaves the page in reach:
 * while one is open the page makes room for it, narrower on a wide screen and
 * with room to scroll above it on a phone (app.css, `data-side-sheet`).
 */
let open = 0;

/** Say a sheet is open; returns how to say it closed. */
export function sideSheet(): () => void {
	open += 1;
	document.documentElement.dataset.sideSheet = '';
	let done = false;
	return () => {
		if (done) return;
		done = true;
		open -= 1;
		if (open === 0) delete document.documentElement.dataset.sideSheet;
	};
}
