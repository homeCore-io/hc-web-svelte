import { describe, expect, it } from 'vitest';
import {
	advice,
	cellsOf,
	keyGroups,
	keyWords,
	lastAdmin,
	levelOf,
	ordered,
	roleName,
	scopesFor,
	type ApiKey,
	type Person
} from './people.js';

// Scopes as homeCore A5 grants them (crates/hc-auth/src/user.rs).
const READ = [
	'devices:read',
	'automations:read',
	'dashboards:read',
	'scenes:read',
	'areas:read',
	'skins:read',
	'content:read'
];
const AUTHOR = [
	'automations:write',
	'dashboards:write',
	'scenes:write',
	'areas:write',
	'skins:write',
	'content:write'
];
const MEMBER = [...READ, 'devices:command', 'scenes:run'];
const USER = [...READ, 'devices:write', 'devices:command', 'scenes:run', ...AUTHOR];
const ADMIN = [
	...USER,
	'users:read',
	'users:write',
	'plugins:read',
	'plugins:write',
	'audit:read',
	'api_keys:admin'
];
const OPERATOR = [...READ, 'devices:write', 'devices:command', 'plugins:read', 'audit:read'];

const person = (id: string, role: string): Person => ({
	id,
	username: id,
	role,
	created_at: '2026-07-31T00:00:00Z'
});

describe('what each role allows', () => {
	it('reads it from the scopes', () => {
		expect(cellsOf(MEMBER)).toEqual(['yes', 'yes', '—', '—', '—', '—', '—', '—']);
		expect(cellsOf(ADMIN)).toEqual(['yes', 'yes', 'yes', 'yes', 'yes', 'yes', 'yes', 'see']);
		// The device operator uses devices but can't run scenes — said, not hidden.
		expect(cellsOf(OPERATOR).slice(0, 3)).toEqual(['yes', 'no', 'yes']);
		expect(cellsOf(READ).every((c) => c === '—')).toBe(true);
	});

	it('names roles, known or not', () => {
		expect(roleName('household_member')).toBe('Household member');
		expect(roleName('night_watch')).toBe('Night watch');
		expect(
			ordered([
				{ role: 'read_only', scopes: [] },
				{ role: 'admin', scopes: [] },
				{ role: 'household_member', scopes: [] }
			]).map((r) => r.role)
		).toEqual(['admin', 'household_member', 'read_only']);
	});
});

describe('the list', () => {
	it('says when everyone is an admin, and what to do about it', () => {
		const both = [person('a', 'admin'), person('j', 'admin')];
		expect(advice(both, [{ role: 'household_member', scopes: MEMBER }])).toMatch(
			/^Both people are admins.*Household member/
		);
		expect(advice(both, [])).toMatch(/no household-member role yet/);
		expect(advice([...both, person('k', 'household_member')], [])).toBeNull();
		expect(advice([person('a', 'admin')], [])).toBeNull();
	});

	it('keeps an admin', () => {
		const a = person('a', 'admin');
		const j = person('j', 'admin');
		const k = person('k', 'user');
		expect(lastAdmin([a, k], a, 'user')).toBe(true);
		expect(lastAdmin([a, k], a)).toBe(true);
		expect(lastAdmin([a, j, k], a, 'user')).toBe(false);
		expect(lastAdmin([a, k], k)).toBe(false);
		expect(lastAdmin([a, k], a, 'admin')).toBe(false);
	});
});

describe('keys', () => {
	it('gives a level within what the maker holds', () => {
		expect(scopesFor('read', ADMIN)).toEqual(READ);
		expect(scopesFor('use', ADMIN)).toEqual([...READ, 'devices:command', 'scenes:run']);
		expect(scopesFor('use', MEMBER)).toEqual(MEMBER);
		// An older homeCore: no devices:command, no scenes:run on anyone.
		const old = [...READ, 'devices:write', ...AUTHOR];
		expect(scopesFor('use', old)).toEqual([...READ, 'devices:write']);
		expect(scopesFor('admin', ADMIN)).toEqual(ADMIN);
	});

	it('knows which level a key is', () => {
		expect(levelOf(scopesFor('use', ADMIN), ADMIN)).toBe('use');
		expect(levelOf(['devices:read'], ADMIN)).toBe('custom');
		expect(levelOf([...READ].reverse(), ADMIN)).toBe('read');
	});

	it('says what a key can do', () => {
		expect(keyWords(scopesFor('use', ADMIN))).toBe('see devices, use them, run scenes');
		expect(keyWords(['content:read'])).toBe('read pages');
		expect(keyWords([])).toBe('nothing');
	});

	it('leaves displays to Displays, and puts stopped keys apart', () => {
		const key = (id: string, more: Partial<ApiKey>): ApiKey => ({
			id,
			label: id,
			prefix: 'abc',
			owner_uid: 'a',
			scopes: READ,
			created_at: `2026-10-0${id.length}T00:00:00Z`,
			last_used_at: null,
			expires_at: null,
			allowed_cidrs: [],
			revoked_at: null,
			...more
		});
		const now = Date.parse('2026-10-17T00:00:00Z');
		const g = keyGroups(
			[
				key('a', {}),
				key('bb', { display: true }),
				key('ccc', { revoked_at: '2026-10-05T00:00:00Z' }),
				key('dddd', { expires_at: '2026-10-10T00:00:00Z' }),
				key('eeeee', { expires_at: '2027-01-01T00:00:00Z' })
			],
			now
		);
		expect(g.live.map((k) => k.id)).toEqual(['eeeee', 'a']);
		expect(g.stopped.map((k) => k.id)).toEqual(['dddd', 'ccc']);
	});
});
