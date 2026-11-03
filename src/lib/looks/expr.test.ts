import { describe, expect, it } from 'vitest';
import { evaluate, parse } from './expr.js';

const thing = { on: true, level: 80, name: 'Garage ceiling', room: 'Garage', temperature: 21.46 };
const val = (src: string, vars = thing) => {
	const r = evaluate(src, vars);
	if ('error' in r) throw new Error(r.error);
	return r.value;
};

describe('the expression language (13 §6.4)', () => {
	it('reads the thing, compares, picks and joins', () => {
		expect(val('on ? (level > 60 ? "Bright" : "Low") + " · " + room : "Off"')).toBe(
			'Bright · Garage'
		);
		expect(val('on ? "x" : "y"', { ...thing, on: false })).toBe('y');
		expect(val('level >= 80 && on')).toBe(true);
		expect(val('!on || level < 10')).toBe(false);
	});

	it('does arithmetic, with the usual order', () => {
		expect(val('1 + 2 * 3')).toBe(7);
		expect(val('(1 + 2) * 3')).toBe(9);
		expect(val('-level / 4')).toBe(-20);
		expect(val('level % 7')).toBe(3);
		expect(val('level / 0')).toBeNull();
	});

	it('formats with its own functions', () => {
		expect(val('round(temperature, 1) + "°"')).toBe('21.5°');
		expect(val('fixed(temperature, 2)')).toBe('21.46');
		expect(val('upper(room)')).toBe('GARAGE');
		expect(val('max(level, 90, 3)')).toBe(90);
	});

	it('reaches nothing but the thing and its functions', () => {
		for (const bad of [
			'window',
			'constructor',
			'name.length',
			'fetch("x")',
			'alert(1)',
			'level = 1',
			'[1]',
			'`x`',
			'a; b'
		])
			expect('error' in evaluate(bad, thing), bad).toBe(true);
		expect(evaluate('toString', thing)).toEqual({ error: "There's no “toString” here" });
	});

	it('says why it can’t read something', () => {
		expect(evaluate('on ? 1', thing)).toEqual({ error: 'Expected “:” at the end' });
		expect(evaluate('1 +', thing)).toEqual({ error: 'Ends too soon' });
		expect(evaluate('nope(1)', thing)).toEqual({ error: "There's no “nope()”" });
		expect(() => parse('x'.repeat(301))).toThrow(/Longer/);
		expect(() => parse('('.repeat(40) + '1' + ')'.repeat(40))).toThrow(/deeply/);
	});
});
