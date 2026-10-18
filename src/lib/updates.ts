/** Comparing release versions — shared by the UI server and the System page. */

/** `0.1.83` > `0.1.9`; a leading `v` and any `-pre` are ignored. */
export function newer(a: string, b: string): boolean {
	const parts = (v: string) =>
		v
			.replace(/^v/, '')
			.split('-')[0]!
			.split('.')
			.map((n) => Number(n) || 0);
	const [x, y] = [parts(a), parts(b)];
	for (let i = 0; i < Math.max(x.length, y.length); i++) {
		if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) > (y[i] ?? 0);
	}
	return false;
}

export interface Latest {
	version: string;
	url: string;
}
