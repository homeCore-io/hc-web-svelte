import { describe, expect, it } from 'vitest';
import type { CoreDevice } from '../devices.js';
import { blankName, buttonName, keypadButtons, renames } from './keypad.js';

const keypad = (
	attributes: Record<string, unknown>,
	more: Partial<CoreDevice> = {}
): CoreDevice => ({
	device_id: 'kp',
	name: 'Den Keypad',
	device_type: 'keypad',
	plugin_id: 'plugin.lutron',
	available: true,
	attributes,
	...more
});

describe('buttonName', () => {
	it('shows the plugin’s button_names first', () => {
		const d = keypad({ button_names: { '1': 'Movie' } }, { button_names: { '1': 'Old' } });
		expect(buttonName(d, 1, 'Scene 1')).toBe('Movie');
	});
	it('falls back to homeCore’s name, then the engraving, then Button n', () => {
		const d = keypad(
			{ button_names: { '2': 'Button 2', '3': '' } },
			{ button_names: { '2': 'Evening' } }
		);
		expect(buttonName(d, 2, 'On')).toBe('Evening');
		expect(buttonName(d, 3, 'Off')).toBe('Off');
		expect(buttonName(d, 4)).toBe('Button 4');
		expect(buttonName(keypad({}), 5, 'Button 5')).toBe('Button 5');
	});
	it('ignores a button_names that isn’t a map', () => {
		expect(buttonName(keypad({ button_names: ['Movie'] }), 1, 'On')).toBe('On');
	});
});

describe('keypadButtons', () => {
	it('reads numbers or numbered buttons, with names and engravings', () => {
		const d = keypad({
			available_buttons: [{ number: 1, name: 'Button 1' }, { number: 2, name: 'Dinner' }, 3, 'x'],
			button_names: { '1': 'Movie', '2': 'Dinner', '3': 'Button 3' }
		});
		expect(keypadButtons(d)).toEqual([
			{ n: 1, name: 'Movie', engraved: 'Button 1' },
			{ n: 2, name: 'Dinner', engraved: 'Dinner' },
			{ n: 3, name: 'Button 3', engraved: undefined }
		]);
	});
});

describe('renames and blankName', () => {
	it('needs set_button_name in the schema', () => {
		expect(renames(keypad({}))).toBe(false);
		expect(
			renames(
				keypad(
					{},
					{
						schema: { actions: [{ id: 'set_button_name', label: 'Name' }] } as CoreDevice['schema']
					}
				)
			)
		).toBe(true);
	});
	it('knows a placeholder name', () => {
		expect(blankName('Button 12')).toBe(true);
		expect(blankName('Movie')).toBe(false);
	});
});
