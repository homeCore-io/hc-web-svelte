import { afterEach, describe, expect, test } from 'vitest';
import { session } from './me.svelte.js';
import { adminKeyOnly, notAdmin } from './notAdmin.js';

const as = (role: string, scopes: string[]) => {
	session.me = { username: 'x', role, scopes };
};

describe('admin, as homeCore judges it', () => {
	afterEach(() => {
		session.me = null;
	});
	test('an admin signed in with a password', () => {
		as('admin', ['devices:read', 'users:write']);
		expect(session.isAdmin).toBe(true);
		expect(adminKeyOnly()).toBe(false);
		expect(notAdmin('People are for admins.', 'manage people')).toBe('People are for admins.');
	});
	test('an admin’s key without users:write is not an admin', () => {
		as('admin', ['devices:read', 'users:read', 'plugins:read']);
		expect(session.isAdmin).toBe(false);
		expect(adminKeyOnly()).toBe(true);
		expect(notAdmin('People are for admins.', 'manage people')).toMatch(
			/^This sign-in can’t manage people\./
		);
	});
	test('someone who isn’t an admin', () => {
		as('user', ['devices:read']);
		expect(session.isAdmin).toBe(false);
		expect(adminKeyOnly()).toBe(false);
		expect(notAdmin('People are for admins.', 'manage people')).toBe('People are for admins.');
	});
});
