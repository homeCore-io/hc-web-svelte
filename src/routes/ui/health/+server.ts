import type { RequestHandler } from './$types';
import { json } from '#lib/server/http.js';

/** For the container's health check: the UI server is up. */
export const GET: RequestHandler = async () => json({ ok: true });
