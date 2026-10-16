import { describe, expect, it } from 'vitest';
import {
	channelOf,
	channelsOf,
	descriptorFor,
	nameProblem,
	rulesSendingTo,
	summary,
	valuesOfChannel
} from './notify.js';
import { changes, problems, valuesOf } from './descriptor.js';

const parsed = {
	notify: {
		channels: [
			{ name: 'pushover', type: 'pushover', user_key: 'u', api_token: 't' },
			{
				name: 'mail',
				type: 'email',
				smtp_host: 'smtp.x',
				username: 'a',
				password: 'p',
				from: 'a@x',
				to: ['b@x']
			}
		]
	}
};

describe('notification channels', () => {
	it('reads them from homecore.toml, and none when there are none', () => {
		expect(channelsOf(parsed).map((c) => c.name)).toEqual(['pushover', 'mail']);
		expect(channelsOf({})).toEqual([]);
		expect(channelsOf(null)).toEqual([]);
	});

	it('round-trips a channel through the form engine', () => {
		const c = channelsOf(parsed)[1]!;
		const d = descriptorFor(c.type);
		const values = valuesOf(d, valuesOfChannel(c));
		expect(problems(d, values)).toEqual({});
		const draft = { ...values, smtp_port: 465, starttls: false };
		expect(changes(d, values, draft).map((x) => x.key)).toEqual(['smtp_port', 'starttls']);
		expect(channelOf(c.type, draft)).toEqual({ ...c, smtp_port: 465, starttls: false });
	});

	it('a new channel needs its required fields', () => {
		const d = descriptorFor('telegram');
		expect(Object.keys(problems(d, { name: 'family' }))).toEqual(['bot_token', 'chat_id']);
	});

	it('names are unique and "all" is taken', () => {
		const others = channelsOf(parsed);
		expect(nameProblem('ALL', [])).toMatch(/every channel/);
		expect(nameProblem('mail', others)).toMatch(/Another/);
		expect(nameProblem(' ', others)).toMatch(/needs/);
		expect(nameProblem('family', others)).toBeNull();
	});

	it('says who a channel reaches', () => {
		const [p, m] = channelsOf(parsed);
		expect(summary(p!)).toBe('every device on the account');
		expect(summary(m!)).toBe('to b@x');
	});

	it('finds the rules that send to a channel, nested or by "all"', () => {
		const rules = [
			{
				id: '1',
				name: 'Direct',
				actions: [{ enabled: true, action: { Notify: { channel: 'mail', message: 'x' } } }]
			},
			{
				id: '2',
				name: 'Nested',
				actions: [
					{
						action: {
							Conditional: {
								then_actions: [{ action: { Notify: { channel: 'all', message: 'y' } } }]
							}
						}
					}
				]
			},
			{
				id: '3',
				name: 'Other',
				actions: [{ action: { Notify: { channel: 'pushover', message: 'z' } } }]
			}
		];
		expect(rulesSendingTo(rules, 'mail').map((r) => r.name)).toEqual(['Direct', 'Nested']);
	});
});
