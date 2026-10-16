/**
 * Where things are, from the environment. One place, read by the dev server,
 * the production server and the app's own server routes alike.
 */
import path from 'node:path';

/** homeCore's address, without a trailing slash. */
export function coreUrl() {
	return (process.env.HC_CORE_URL ?? 'http://10.0.10.150:8080').replace(/\/+$/, '');
}

/** Where the UI server keeps its own data (S2, M1): one directory, a volume. */
export function dataDir() {
	return path.resolve(process.env.HC_DATA_DIR ?? './data');
}
