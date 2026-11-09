/**
 * The most a request to the UI server's own routes may carry, except the two
 * that take files and bound them themselves as they arrive: a picture or
 * video added (`POST /ui/pictures`) and a backup put back (`POST /ui/backup`).
 * The server's own limit (`BODY_SIZE_LIMIT`) is lifted for those, so this is
 * the limit for everything else.
 */
export const MAX_BODY_BYTES = 8 * 1024 * 1024;
const STREAMED = new Set(['/ui/pictures', '/ui/backup']);

/** Why a request's body is refused before it's read, if it is. */
export function bodyRefused(
	method: string,
	pathname: string,
	headers: Headers
): { status: number; error: string } | undefined {
	if (method === 'GET' || method === 'HEAD' || STREAMED.has(pathname)) return undefined;
	const length = headers.get('content-length');
	if (length === null)
		return headers.get('transfer-encoding')
			? { status: 411, error: 'Send its length.' }
			: undefined;
	return Number(length) > MAX_BODY_BYTES ? { status: 413, error: 'That’s too large.' } : undefined;
}
