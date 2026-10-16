/**
 * The UI server's documents (S2, M1): one JSON file per document, in the data
 * directory — readable, diffable, and backed up by copying a folder.
 *
 * - **Written atomically**: to a temporary file, then renamed over the old
 *   one, so a crash mid-write leaves the previous document, never half of one.
 * - **Versioned**: every write bumps `version`. A writer says which version it
 *   started from; if someone else wrote since, the write is refused with the
 *   current document, and the writer reapplies its change to that. Nothing is
 *   lost silently between a phone and a laptop editing at once.
 * - **Announced**: every write is reported to listeners, which the change
 *   stream (`/ui/events`) passes on to the screens it concerns.
 *
 * Writes to one document are queued, so two arriving together are judged one
 * after the other against what the first actually left.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const KIND = /^[a-z][a-z-]{0,31}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

/**
 * @typedef {{ version: number, [key: string]: unknown }} Doc
 * @typedef {{ kind: string, id: string, version: number }} Change
 * @typedef {{ ok: true, doc: Doc } | { ok: false, current: Doc | undefined }} Written
 */

export class DocStore {
	/** @param {string} root */
	constructor(root) {
		this.root = root;
		/** @type {Map<string, Promise<unknown>>} */
		this.queues = new Map();
		/** @type {Set<(change: Change) => void>} */
		this.listeners = new Set();
	}

	/**
	 * The file for a document. Kinds and ids are checked against a strict
	 * pattern, so nothing a caller passes can reach outside the data directory.
	 * @param {string} kind
	 * @param {string} id
	 */
	file(kind, id) {
		if (!KIND.test(kind) || !ID.test(id)) throw new Error(`bad document name: ${kind}/${id}`);
		return path.join(this.root, kind, `${id}.json`);
	}

	/**
	 * @param {string} kind
	 * @param {string} id
	 * @returns {Promise<Doc | undefined>}
	 */
	async read(kind, id) {
		try {
			return JSON.parse(await readFile(this.file(kind, id), 'utf8'));
		} catch (e) {
			if (/** @type {NodeJS.ErrnoException} */ (e).code === 'ENOENT') return undefined;
			throw e;
		}
	}

	/**
	 * Write a document, if nobody has since `expected`. `expected` 0 means "I
	 * believe there is none yet".
	 * @param {string} kind
	 * @param {string} id
	 * @param {Record<string, unknown>} body
	 * @param {number} expected
	 * @returns {Promise<Written>}
	 */
	write(kind, id, body, expected) {
		const key = `${kind}/${id}`;
		const before = this.queues.get(key) ?? Promise.resolve();
		const run = before.then(() => this.#write(kind, id, body, expected));
		const settled = run.catch(() => {});
		this.queues.set(key, settled);
		void settled.then(() => {
			if (this.queues.get(key) === settled) this.queues.delete(key);
		});
		return run;
	}

	/**
	 * @param {string} kind
	 * @param {string} id
	 * @param {Record<string, unknown>} body
	 * @param {number} expected
	 * @returns {Promise<Written>}
	 */
	async #write(kind, id, body, expected) {
		const file = this.file(kind, id);
		const current = await this.read(kind, id);
		if ((current?.version ?? 0) !== expected) return { ok: false, current };
		/** @type {Doc} */
		const doc = { ...body, version: expected + 1, updated_at: new Date().toISOString() };
		await mkdir(path.dirname(file), { recursive: true });
		const tmp = `${file}.${randomUUID()}.tmp`;
		await writeFile(tmp, JSON.stringify(doc, null, '\t') + '\n', 'utf8');
		await rename(tmp, file);
		for (const listener of this.listeners) {
			try {
				listener({ kind, id, version: doc.version });
			} catch {
				// One broken listener must not stop the others hearing.
			}
		}
		return { ok: true, doc };
	}

	/**
	 * Hear about every write from now on. Returns the way to stop.
	 * @param {(change: Change) => void} listener
	 */
	listen(listener) {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}
}

/** @type {DocStore | undefined} */
let shared;

/**
 * The one store for this process, in the given directory.
 * @param {string} root
 */
export function storeAt(root) {
	if (shared === undefined || shared.root !== root) shared = new DocStore(root);
	return shared;
}
