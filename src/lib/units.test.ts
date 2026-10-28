import { describe, expect, it } from 'vitest';
import {
	fromShown,
	isTemperature,
	localeUnits,
	readingText,
	shown,
	shownRange,
	shownUnit,
	toShown,
	unitsOf,
	type Units
} from './units.js';

const US: Units = { temperature: 'F', measures: 'us' };
const METRIC: Units = { temperature: 'C', measures: 'metric' };

describe('the units a person reads in', () => {
	it('come from the browser until they choose', () => {
		expect(localeUnits('en-US')).toEqual(US);
		expect(localeUnits('en')).toEqual(US);
		expect(localeUnits('es-PR')).toEqual(US);
		expect(localeUnits('en-GB')).toEqual(METRIC);
		expect(localeUnits('fr-CA')).toEqual(METRIC);
		expect(localeUnits('de')).toEqual(METRIC);
		expect(localeUnits('not a locale')).toEqual(METRIC);
	});

	it('a choice of one keeps the browser’s other', () => {
		expect(unitsOf({ temperature: 'C' }, 'en-US')).toEqual({ temperature: 'C', measures: 'us' });
		expect(unitsOf({ measures: 'us' }, 'en-GB')).toEqual({ temperature: 'C', measures: 'us' });
		expect(unitsOf(undefined, 'en-GB')).toEqual(METRIC);
	});
});

describe('a reading in the person’s units', () => {
	it('temperatures go to °F and back', () => {
		expect(shown(21.5, '°C', US)).toEqual({ value: 70.7, unit: '°F', converted: true });
		expect(shown(21.5, 'C', US).unit).toBe('°F');
		expect(shown(21.5, '°C', METRIC)).toEqual({ value: 21.5, unit: '°C', converted: false });
		// Kept from 70 °F, read in °C: to a tenth, as a °C reading reads.
		expect(shown(21.111, '°C', METRIC).value).toBe(21.1);
		// An old device that reports °F reads in °C for someone who chose it.
		expect(shown(70.52, '°F', METRIC).value).toBe(21.4);
		expect(isTemperature('°C')).toBe(true);
		expect(isTemperature('hPa')).toBe(false);
	});

	it('the rest go to US measures', () => {
		expect(readingText(1013.2, 'hPa', undefined, US)).toBe('29.92 inHg');
		expect(readingText(4.47, 'm/s', undefined, US)).toBe('10 mph');
		expect(readingText(25.4, 'mm', undefined, US)).toBe('1 in');
		expect(readingText(3.3, 'mm/h', undefined, US)).toBe('0.13 in/h');
		expect(readingText(16, 'km', undefined, US)).toBe('9.9 mi');
		expect(readingText(1013.2, 'hPa', undefined, METRIC)).toBe('1013.2 hPa');
	});

	it('anything else is as it was', () => {
		expect(shown(45, '%', US)).toEqual({ value: 45, unit: '%', converted: false });
		expect(readingText(45, '%', undefined, US)).toBe('45%');
		expect(readingText(1.2, 'kPa', undefined, US)).toBe('1.2 kPa');
		expect(readingText(3000, 'K', undefined, US)).toBe('3000 K');
		expect(readingText(3, undefined, undefined, US)).toBe('3');
		expect(shownUnit('lux', US)).toBe('lux');
	});

	it('the caller’s own rounding stands when nothing changed', () => {
		expect(readingText(21.25, '°C', (n) => n.toFixed(1), METRIC)).toBe('21.3°C');
	});
});

describe('what the person types, back in the schema’s unit', () => {
	it('round-trips: 70 °F is stored so it shows as 70 again', () => {
		const c = fromShown(70, '°C', US);
		expect(c).toBe(21.111);
		expect(shown(c, '°C', US).value).toBe(70);
		for (let f = -20; f <= 120; f += 0.5)
			expect(shown(fromShown(f, '°C', US), '°C', US).value).toBe(f);
		for (let i = 2800; i <= 3100; i++)
			expect(shown(fromShown(i / 100, 'hPa', US), 'hPa', US).value).toBe(i / 100);
		for (let i = 0; i <= 300; i++)
			expect(shown(fromShown(i / 100, 'mm', US), 'mm', US).value).toBe(i / 100);
	});

	it('is untouched when nothing was converted', () => {
		expect(fromShown(21.5, '°C', METRIC)).toBe(21.5);
		expect(fromShown(45, '%', US)).toBe(45);
		expect(toShown(45, '%', US)).toBe(45);
	});
});

describe('a range in the shown unit', () => {
	it('converts the ends and keeps a round step', () => {
		expect(shownRange({ min: 5, max: 35, step: 0.5 }, '°C', US)).toEqual({
			min: 41,
			max: 95,
			step: 1
		});
		expect(shownRange({ min: 5, max: 35, step: 1 }, '°C', US).step).toBe(1);
		expect(shownRange({ min: 5, max: 35, step: 0.1 }, '°C', US).step).toBe(0.1);
		expect(shownRange({ min: 0, max: 100, step: 1 }, '%', US)).toEqual({
			min: 0,
			max: 100,
			step: 1
		});
		expect(shownRange({ min: 5 }, '°C', US)).toEqual({ min: 41, max: undefined, step: undefined });
	});
});
