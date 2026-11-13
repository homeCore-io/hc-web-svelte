import { session } from './me.svelte.js';

/** An admin's sign-in that homeCore won't treat as one: a key without `users:write`. */
export const adminKeyOnly = () => session.me?.role === 'admin' && !session.isAdmin;

/**
 * Why an admin page isn't shown: `plain` for someone who isn't an admin, and
 * for an admin's limited key, that this sign-in can't `verb` and why.
 */
export function notAdmin(plain: string, verb: string): string {
	return adminKeyOnly()
		? `This sign-in can’t ${verb}. It uses a key without admin rights; sign in with your password, or use a key that has the users:write scope.`
		: plain;
}
