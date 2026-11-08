/**
 * The pictures library in the app (design 15): what this person may see,
 * adding one with its smaller copies, naming and sharing it, and deleting it.
 * The UI server keeps them (P1); this only asks it.
 *
 * The copies (P7) are made here, in the browser, when a picture is added: a
 * tile for the library, one a screen wide, and a video's first frame. The
 * server keeps them beside the original and serves them by `?size=`.
 */

export interface Use {
	in: 'house' | 'display' | 'person';
	id: string;
	path: (string | number)[];
}

export interface Picture {
	id: string;
	ext: string;
	url: string;
	name: string;
	kind: 'picture' | 'video';
	bytes: number;
	owner: string | null;
	by: string;
	at: string;
	shared: boolean;
	albums: string[];
	sizes: Partial<Record<'tile' | 'screen' | 'poster', string>>;
	mine: boolean;
	mayChange: boolean;
	uses: Use[];
	/** Uses in other people's own pages: counted, never shown. */
	elsewhere: number;
}

/** What a place keeps of the picture chosen for it (P3). */
export interface Picked {
	url: string;
	/** Which part stays in view: 0 to 8, left to right, top to bottom. */
	focus?: number;
	/** How dark behind words, 0 to 70 (percent). */
	dim?: number;
}

export const MAX_PICTURE_MB = 20;
export const MAX_VIDEO_MB = 200;
export const ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm';

/** A picture's address at a size: its own copy if it has one, else the original. */
export function sized(url: string, size: 'tile' | 'screen' | 'poster'): string {
	if (!url.startsWith('/ui/pictures/')) return url;
	return `${url.split('?')[0]}?size=${size}`;
}

/** Whether an address is one of the library's (and not some other image). */
export const isLibrary = (url: unknown): url is string =>
	typeof url === 'string' && /^\/ui\/pictures\/[a-f0-9]{24}\.\w+(\?.*)?$/.test(url);

/** Is the address a video's? */
export const isVideo = (url: string) => /\.(mp4|webm)(\?|$)/.test(url);

type Sent = { ok: true; picture: Picture } | { ok: false; error: string };

class Pictures {
	items = $state<Picture[]>([]);
	albums = $state<string[]>([]);
	loaded = $state(false);
	trouble = $state<string | null>(null);
	/** Being sent now, by a temporary id: how far along. */
	sending = $state<{ id: string; name: string; pct: number }[]>([]);

	async load(): Promise<void> {
		const res = await fetch('/ui/pictures').catch(() => null);
		if (!res?.ok) {
			this.trouble = 'The pictures couldn’t be loaded.';
			return;
		}
		const body = (await res.json()) as { items: Picture[]; albums: string[] };
		this.items = body.items;
		this.albums = body.albums;
		this.loaded = true;
		this.trouble = null;
	}

	byUrl(url: string): Picture | undefined {
		const base = url.split('?')[0];
		return this.items.find((p) => p.url === base);
	}

	/** Add a file: sent with its progress shown, then its copies made and sent. */
	async upload(file: File, o: { shared?: boolean } = {}): Promise<Sent> {
		const video = file.type.startsWith('video/');
		const max = (video ? MAX_VIDEO_MB : MAX_PICTURE_MB) * 1024 * 1024;
		if (file.size > max)
			return { ok: false, error: `It’s larger than ${video ? MAX_VIDEO_MB : MAX_PICTURE_MB} MB.` };
		const temp = `sending-${Math.random().toString(36).slice(2)}`;
		const name = file.name.replace(/\.[^.]+$/, '').slice(0, 80);
		this.sending = [...this.sending, { id: temp, name, pct: 0 }];
		const q = new URLSearchParams({ name });
		if (o.shared) q.set('shared', '1');
		const sent = await new Promise<Sent>((resolve) => {
			const xhr = new XMLHttpRequest();
			xhr.open('POST', `/ui/pictures?${q}`);
			xhr.setRequestHeader('content-type', file.type || 'application/octet-stream');
			xhr.upload.onprogress = (e) => {
				if (e.lengthComputable)
					this.sending = this.sending.map((s) =>
						s.id === temp ? { ...s, pct: Math.round((e.loaded / e.total) * 100) } : s
					);
			};
			xhr.onload = () => {
				let body: { error?: string } & Partial<Picture> = {};
				try {
					body = JSON.parse(xhr.responseText);
				} catch {
					// Said below.
				}
				if (xhr.status === 200 && body.url) resolve({ ok: true, picture: body as Picture });
				else resolve({ ok: false, error: body.error ?? 'It couldn’t be sent.' });
			};
			xhr.onerror = () => resolve({ ok: false, error: 'It couldn’t be sent.' });
			xhr.send(file);
		});
		this.sending = this.sending.filter((s) => s.id !== temp);
		if (!sent.ok) return sent;
		this.items = [sent.picture, ...this.items];
		// Its copies: best done, never in the way. Without them the original serves.
		void copiesOf(file, video).then(async (copies) => {
			for (const [size, blob] of Object.entries(copies)) {
				if (!blob) continue;
				await fetch(`${sent.picture.url}/${size}`, {
					method: 'PUT',
					headers: { 'content-type': blob.type },
					body: blob
				}).catch(() => null);
			}
			await this.load();
		});
		return sent;
	}

	async change(
		p: Picture,
		to: { name?: string; shared?: boolean; albums?: string[] }
	): Promise<string | null> {
		const res = await fetch(p.url, {
			method: 'PATCH',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(to)
		}).catch(() => null);
		if (!res?.ok) {
			const body = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
			return body?.error ?? 'It couldn’t be changed.';
		}
		const next = (await res.json()) as Picture;
		this.items = this.items.map((x) =>
			x.id === p.id ? { ...x, ...next, uses: x.uses, elsewhere: x.elsewhere } : x
		);
		this.albums = [...new Set(this.items.flatMap((x) => x.albums))].sort();
		return null;
	}

	/** Make it everyone's before it goes somewhere everyone sees (P5). */
	async share(url: string): Promise<string | null> {
		const p = this.byUrl(url);
		return p && !p.shared ? this.change(p, { shared: true }) : null;
	}

	async remove(p: Picture): Promise<string | null> {
		const res = await fetch(p.url, { method: 'DELETE' }).catch(() => null);
		if (!res?.ok) {
			const body = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
			return body?.error ?? 'It couldn’t be deleted.';
		}
		this.items = this.items.filter((x) => x.id !== p.id);
		return null;
	}
}

export const pictures = new Pictures();

// ---- the copies (P7) ----

const TILE = 480;
const SCREEN = 1920;

function canvasOf(src: CanvasImageSource, w: number, h: number, most: number): HTMLCanvasElement {
	const k = Math.min(1, most / Math.max(w, h));
	const c = document.createElement('canvas');
	c.width = Math.max(1, Math.round(w * k));
	c.height = Math.max(1, Math.round(h * k));
	c.getContext('2d')?.drawImage(src, 0, 0, c.width, c.height);
	return c;
}

const blobOf = (c: HTMLCanvasElement) =>
	new Promise<Blob | null>((r) => c.toBlob((b) => r(b), 'image/webp', 0.82));

/** A video's frame a moment in, once it can be drawn. */
function frameOf(file: File): Promise<HTMLVideoElement | null> {
	return new Promise((resolve) => {
		const v = document.createElement('video');
		v.muted = true;
		v.playsInline = true;
		v.preload = 'auto';
		const url = URL.createObjectURL(file);
		const done = (ok: boolean) => {
			resolve(ok ? v : null);
			setTimeout(() => URL.revokeObjectURL(url), 1000);
		};
		v.onloadeddata = () => {
			v.currentTime = Math.min(0.5, (v.duration || 1) / 2);
		};
		v.onseeked = () => done(true);
		v.onerror = () => done(false);
		setTimeout(() => done(false), 15000);
		v.src = url;
	});
}

/** The smaller copies of a file: a GIF keeps moving, so only its tile is made. */
async function copiesOf(
	file: File,
	video: boolean
): Promise<Partial<Record<'tile' | 'screen' | 'poster', Blob | null>>> {
	try {
		if (video) {
			const v = await frameOf(file);
			if (!v || !v.videoWidth) return {};
			return {
				tile: await blobOf(canvasOf(v, v.videoWidth, v.videoHeight, TILE)),
				poster: await blobOf(canvasOf(v, v.videoWidth, v.videoHeight, SCREEN))
			};
		}
		const img = await createImageBitmap(file);
		const out: Partial<Record<'tile' | 'screen', Blob | null>> = {
			tile: await blobOf(canvasOf(img, img.width, img.height, TILE))
		};
		if (file.type !== 'image/gif' && Math.max(img.width, img.height) > SCREEN)
			out.screen = await blobOf(canvasOf(img, img.width, img.height, SCREEN));
		img.close();
		return out;
	} catch {
		return {};
	}
}
