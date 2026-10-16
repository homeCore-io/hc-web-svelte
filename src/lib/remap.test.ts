import { expect, it } from 'vitest';
import { remapRoom } from './remap.js';

const A = '11111111-1111-1111-1111-111111111111';
const B = '22222222-2222-2222-2222-222222222222';

it('points everything about the merged room at the one it went into', () => {
	const doc = {
		version: 3,
		icons: { [A]: 'bath', [B]: 'sofa' },
		pages: {
			home: { order: [`room:${A}`, `room:${B}`, 'scene:x'] },
			[`room:${A}`]: { hidden: ['d1'] }
		},
		bar: ['home', `room:${A}`],
		note: `room:${A}x`
	};
	expect(remapRoom(doc, A, B)).toEqual({
		version: 3,
		icons: { [B]: 'sofa' },
		pages: { home: { order: [`room:${B}`, 'scene:x'] }, [`room:${B}`]: { hidden: ['d1'] } },
		bar: ['home', `room:${B}`],
		note: `room:${A}x`
	});
});
