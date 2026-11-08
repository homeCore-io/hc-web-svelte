/**
 * Tar, as much of it as the app's backup needs (ustar, no compression: the
 * pictures in it are compressed already). Written and read as a stream, so a
 * library of videos never sits whole in memory, and with no 4 GB limit on
 * the whole, as a zip without ZIP64 would have.
 */

const BLOCK = 512;
const enc = new TextEncoder();

function octal(n: number, width: number): string {
	return n.toString(8).padStart(width - 1, '0') + '\0';
}

/** A file's header block: its name (ASCII, under 100 bytes), size and time. */
export function header(name: string, size: number, mtime = new Date()): Uint8Array {
	if (enc.encode(name).length >= 100) throw new Error(`name too long for tar: ${name}`);
	const h = new Uint8Array(BLOCK);
	const put = (s: string, at: number) => h.set(enc.encode(s), at);
	put(name, 0);
	put(octal(0o644, 8), 100);
	put(octal(0, 8), 108);
	put(octal(0, 8), 116);
	put(octal(size, 12), 124);
	put(octal(Math.floor(mtime.getTime() / 1000), 12), 136);
	put('        ', 148);
	put('0', 156);
	put('ustar\u000000', 257);
	let sum = 0;
	for (const b of h) sum += b;
	put(octal(sum, 7) + ' ', 148);
	return h;
}

/** Zeros to the end of a file's last block. */
export const padding = (size: number) => new Uint8Array((BLOCK - (size % BLOCK)) % BLOCK);

/** The two empty blocks a tar ends with. */
export const end = () => new Uint8Array(BLOCK * 2);

/** One file in a tar being read: its body is read, or skipped, before the next. */
export interface Entry {
	name: string;
	size: number;
	/** Its bytes, as they arrive. */
	body(): AsyncIterable<Uint8Array>;
}

/** Bytes from a stream, as many as asked for at a time. */
class Bytes {
	#buf = new Uint8Array(0);
	#reader: ReadableStreamDefaultReader<Uint8Array>;
	#done = false;
	constructor(stream: ReadableStream<Uint8Array>) {
		this.#reader = stream.getReader();
	}
	async #fill(n: number) {
		while (this.#buf.length < n && !this.#done) {
			const { done, value } = await this.#reader.read();
			if (done) this.#done = true;
			else {
				const next = new Uint8Array(this.#buf.length + value.length);
				next.set(this.#buf);
				next.set(value, this.#buf.length);
				this.#buf = next;
			}
		}
	}
	/** Exactly `n` bytes, or fewer at the end. */
	async take(n: number): Promise<Uint8Array> {
		await this.#fill(n);
		const out = this.#buf.subarray(0, n);
		this.#buf = this.#buf.subarray(out.length);
		return out;
	}
	/** Up to `n` bytes, whatever has arrived: for a large body, a piece at a time. */
	async some(n: number): Promise<Uint8Array> {
		await this.#fill(1);
		const out = this.#buf.subarray(0, n);
		this.#buf = this.#buf.subarray(out.length);
		return out;
	}
	cancel() {
		return this.#reader.cancel().catch(() => {});
	}
	/** The rest, read and dropped: a sender cut off before it finished sees its request fail. */
	async drain() {
		this.#buf = new Uint8Array(0);
		while (!this.#done) {
			const { done } = await this.#reader.read();
			if (done) this.#done = true;
		}
	}
}

const text = (b: Uint8Array) => new TextDecoder().decode(b).replace(/\0.*$/s, '');

/**
 * Each file in a tar, in order. Throws if it isn't one (a bad checksum, or
 * cut short). Directories and links are passed over.
 */
export async function* entries(stream: ReadableStream<Uint8Array>): AsyncGenerator<Entry> {
	const bytes = new Bytes(stream);
	try {
		for (;;) {
			const h = await bytes.take(BLOCK);
			if (h.length < BLOCK) throw new Error('cut short');
			if (h.every((b) => b === 0)) {
				await bytes.drain();
				return;
			}
			let sum = 0;
			for (let i = 0; i < BLOCK; i++) sum += i >= 148 && i < 156 ? 32 : h[i]!;
			if (parseInt(text(h.subarray(148, 156)).trim(), 8) !== sum) throw new Error('not a tar');
			const prefix = text(h.subarray(345, 500));
			const base = text(h.subarray(0, 100));
			const name = prefix ? `${prefix}/${base}` : base;
			const size = parseInt(text(h.subarray(124, 136)).trim() || '0', 8);
			const type = String.fromCharCode(h[156]!);
			let left = size;
			const entry: Entry = {
				name,
				size,
				async *body() {
					while (left > 0) {
						const piece = await bytes.some(Math.min(left, 64 * 1024));
						if (piece.length === 0) throw new Error('cut short');
						left -= piece.length;
						yield piece;
					}
				}
			};
			if (type === '0' || type === '\0') yield entry;
			// Whatever of it wasn't read, then its padding.
			for await (const _ of entry.body());
			await bytes.take(padding(size).length);
		}
	} finally {
		// Even refused, read to the end: a browser told no before it finished sending sees no answer.
		await bytes.drain().catch(() => bytes.cancel());
	}
}
