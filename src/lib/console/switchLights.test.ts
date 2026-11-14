import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CoreDevice } from '../devices.js';
import type { Room } from '../house.js';

// What homeCore's Room on and Room off answer, and the commands sent: stand-ins.
const fake = vi.hoisted(() => ({
	said: {} as Record<string, { error: string | null; lights: string[] }>,
	byId: {} as Record<string, unknown>,
	commands: { pending: {}, set: vi.fn(), expect: vi.fn() },
	roomPower: vi.fn()
}));
vi.mock('#lib/admin.js', () => ({ roomPower: fake.roomPower }));
vi.mock('#lib/commands.svelte.js', () => ({ commands: fake.commands }));
vi.mock('#lib/devices.svelte.js', () => ({ devices: { byId: fake.byId } }));

const { everyLightOff, setLights } = await import('./switchLights.js');

const light = (id: string, on: boolean, more: Partial<CoreDevice> = {}): CoreDevice => ({
	device_id: id,
	name: id,
	device_type: 'light',
	available: true,
	attributes: { on },
	...more
});
const den = { id: 'r-den', name: 'Den' } as Room;

beforeEach(() => {
	vi.clearAllMocks();
	fake.roomPower.mockImplementation(
		async (id: string) => fake.said[id] ?? { error: null, lights: [] }
	);
});

describe('a room’s lights on or off', () => {
	it('is Room off, then a command for each light on that Room off didn’t cover', async () => {
		const lamp = light('lamp', true);
		const named = light('holiday', true, { device_type: 'switch' });
		const gone = light('gone', true, { available: false });
		const off = light('off', false);
		Object.assign(fake.byId, { lamp });
		fake.said['r-den'] = { error: null, lights: ['lamp'] };
		const note = await setLights(
			{ room: den, name: 'Den', lights: [lamp, named, gone, off] },
			false
		);
		expect(note).toBeNull();
		expect(fake.roomPower).toHaveBeenCalledWith('r-den', false);
		// The lamp Room off sent waits for its answer; only the switch gets its own command.
		expect(fake.commands.expect.mock.calls.map((c) => c[0])).toEqual(['lamp']);
		expect(fake.commands.set.mock.calls.map((c) => [c[0], c[2]])).toEqual([
			['holiday', { on: false }]
		]);
	});

	it('says what went wrong, by the room’s name', async () => {
		fake.said['r-den'] = { error: 'homeCore is not answering.', lights: [] };
		expect(await setLights({ room: den, name: 'Den', lights: [] }, true)).toBe(
			'Den: homeCore is not answering.'
		);
	});

	it('in no room, a command for each light not already so', async () => {
		const a = light('a', true);
		const b = light('b', false);
		await setLights({ name: 'No room', lights: [a, b] }, false);
		expect(fake.roomPower).not.toHaveBeenCalled();
		expect(fake.commands.set.mock.calls.map((c) => c[0])).toEqual(['a']);
	});
});

describe('every light off', () => {
	it('turns off only the rooms with a light on, and says the first trouble', async () => {
		const kitchen = { id: 'r-kitchen', name: 'Kitchen' } as Room;
		fake.said['r-kitchen'] = { error: 'Not allowed.', lights: [] };
		const note = await everyLightOff([
			{ room: den, name: 'Den', lights: [light('x', false)] },
			{ room: kitchen, name: 'Kitchen', lights: [light('y', true)] }
		]);
		expect(fake.roomPower.mock.calls).toEqual([['r-kitchen', false]]);
		expect(note).toBe('Kitchen: Not allowed.');
	});
});
