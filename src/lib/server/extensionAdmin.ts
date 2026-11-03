/**
 * Who may install and remove UI extensions: whoever may install plugins
 * (homeCore's `plugins:write`), since an extension draws for everyone who
 * sees a look that uses it (13 S4).
 */
import type { RequestEvent } from '@sveltejs/kit';
import { json } from './http.js';
import { whoIs } from './identity.js';
import { CODE_SCOPE } from './lookCode.js';

export async function admin(event: RequestEvent) {
	const who = await whoIs(event);
	if (!who.ok) return { fail: json({ error: who.error }, who.status, who.setCookies) };
	if (!who.person.scopes.includes(CODE_SCOPE))
		return {
			fail: json(
				{ error: 'Only people who may install plugins can add or remove extensions.' },
				403,
				who.setCookies
			)
		};
	return { who };
}
