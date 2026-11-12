import { describe, expect, it } from 'vitest';
import type { CoreDevice } from '../devices.js';
import { timerView } from './timer.js';

const timer = (
	attributes: Record<string, unknown>,
	more: Partial<CoreDevice> = {}
): CoreDevice => ({
	device_id: 't',
	name: 'Garage Close',
	device_type: 'timer',
	plugin_id: 'core.glue',
	available: true,
	attributes,
	...more
});
const at = Date.parse('2026-11-12T12:00:00Z');
const started = (secsAgo: number) => new Date(at - secsAgo * 1000).toISOString();

describe('a timer’s clock', () => {
	it('counts down each second from when it started', () => {
		const d = timer({ state: 'running', duration_secs: 600, started_at: started(348) });
		expect(timerView(d, at)).toMatchObject({ running: true, figure: '4:12', dim: false });
		expect(timerView(d, at + 1000).figure).toBe('4:11');
		expect(timerView(d, at + 0.4 * 1000).figure).toBe('4:12');
	});

	it('stops at none left, and reads the hour when there is one', () => {
		const d = timer({ state: 'running', duration_secs: 60, started_at: started(90) });
		expect(timerView(d, at).figure).toBe('0:00');
		const long = timer({ state: 'running', duration_secs: 7200, started_at: started(0) });
		expect(timerView(long, at).figure).toBe('2:00:00');
	});

	it('takes what it says is left when it says nothing of its start', () => {
		const d = timer({ state: 'running', remaining_secs: 95 });
		expect(timerView(d, at).figure).toBe('1:35');
	});

	it('shows a paused one’s time dimmed, and an idle or finished one as a word', () => {
		expect(timerView(timer({ state: 'paused', remaining_secs: 30 }), at)).toMatchObject({
			figure: '0:30',
			dim: true,
			note: 'Paused'
		});
		expect(timerView(timer({ state: 'idle' }), at)).toMatchObject({ figure: 'idle', dim: true });
		expect(timerView(timer({ state: 'cancelled', remaining_secs: 600 }), at).figure).toBe('idle');
		expect(timerView(timer({ state: 'finished' }), at).figure).toBe('done');
	});
});

describe('a timer’s button', () => {
	it('starts homeCore’s for its own length, and cancels it while it runs', () => {
		expect(
			timerView(timer({ state: 'idle', default_secs: 120, duration_secs: 600 }), at).press
		).toEqual({ label: 'Start', command: { command: 'start', duration_secs: 120 } });
		expect(
			timerView(timer({ state: 'cancelled', default_secs: 0, duration_secs: 600 }), at).press
		).toEqual({ label: 'Start', command: { command: 'start', duration_secs: 600 } });
		expect(timerView(timer({ state: 'idle', duration_secs: 0 }), at).press).toEqual({
			label: 'Start',
			command: { command: 'start', duration_secs: 300 }
		});
		const on = timer({ state: 'running', duration_secs: 600, started_at: started(10) });
		expect(timerView(on, at).press).toEqual({ label: 'Cancel', command: { command: 'cancel' } });
	});

	it('presses a plugin’s by the actions it declares, else has none', () => {
		const schema = {
			attributes: {},
			actions: [
				{ id: 'start', label: 'Start' },
				{ id: 'cancel', label: 'Cancel' }
			]
		} as unknown as CoreDevice['schema'];
		expect(
			timerView(timer({ state: 'idle' }, { plugin_id: 'plugin.x', schema }), at).press
		).toEqual({
			label: 'Start',
			action: 'start'
		});
		expect(
			timerView(timer({ state: 'idle' }, { plugin_id: 'plugin.x' }), at).press
		).toBeUndefined();
	});
});
