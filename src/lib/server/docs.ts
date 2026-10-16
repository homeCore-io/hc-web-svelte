/**
 * The UI server's document store, for its routes.
 */
import { dataDir } from '#server/config.js';
import { storeAt } from '#server/store.js';

export const docs = () => storeAt(dataDir());

/** The largest document a client may write — a person's layers are a few KB. */
export const MAX_DOC_BYTES = 256 * 1024;
