import { describe, expect, it } from 'vitest';
import { addsCode } from './lookCode.js';

const doc = (code?: string) => ({
	version: 1,
	looks: [{ id: 'evening', made: [{ id: 'orb', ...(code ? { code } : {}) }] }]
});

describe('code in a look takes someone who may install plugins (13 §6.4)', () => {
	it('notices code added or changed', () => {
		expect(addsCode(doc(), doc('return "x"'))).toBe(true);
		expect(addsCode(doc('return "x"'), doc('return "y"'))).toBe(true);
		expect(addsCode(null, doc('return "x"'))).toBe(true);
	});

	it('lets anyone keep an admin’s code unchanged, drop it, or change the rest', () => {
		expect(addsCode(doc('return "x"'), doc('return "x"'))).toBe(false);
		expect(addsCode(doc('return "x"'), doc())).toBe(false);
		expect(addsCode(doc(), { version: 2, looks: [] })).toBe(false);
		expect(
			addsCode({ looks: 'nonsense' }, { looks: [{ id: 'a', made: [{ id: 'b', code: '  ' }] }] })
		).toBe(false);
	});
});
