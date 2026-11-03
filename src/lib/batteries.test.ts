import { describe, expect, it } from 'vitest';
import { batteriesOf } from './batteries.js';
import { judgeBatteriesBy } from './card.js';
import type { CoreDevice } from './devices.js';

const dev = (id: string, attributes: Record<string, unknown>): CoreDevice =>
	({ device_id: id, name: id, attributes }) as unknown as CoreDevice;

describe('batteries, lowest first (F2)', () => {
	it('lists those with a level, low ones first, as homeCore judges low', () => {
		judgeBatteriesBy((id) => (id === 'lock' ? true : id === 'leak' ? false : undefined));
		const list = batteriesOf([
			dev('lamp', { on: true }),
			dev('leak', { battery_pct: 9 }),
			dev('lock', { battery_pct: 40 }),
			dev('door', { battery: 15 }),
			dev('temp', { battery_pct: 88 })
		]);
		expect(list.map((b) => [b.id, b.low])).toEqual([
			['door', true],
			['lock', true],
			['leak', false],
			['temp', false]
		]);
		judgeBatteriesBy(null);
	});
});
