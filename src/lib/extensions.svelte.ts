/**
 * The UI extensions in the app's data directory (`GET /ui/extensions`): their
 * elements, by their ids in a look (`ext:{extension}/{element}`). Read once
 * while the app is open.
 */

export interface ExtensionElement {
	id: string;
	kind: 'rive';
	label: string;
	/** The look family it draws. */
	draws: string;
	file: string;
	artboard?: string;
	stateMachine?: string;
}

export interface Extension {
	id: string;
	name: string;
	version: string;
	elements: ExtensionElement[];
}

/** One element, with its id in a look and where its file is. */
export interface ExtElement {
	id: string;
	extension: Extension;
	element: ExtensionElement;
	src: string;
}

export const extId = (ext: string, element: string) => `ext:${ext}/${element}`;

const withSrc = (extension: Extension, element: ExtensionElement): ExtElement => ({
	id: extId(extension.id, element.id),
	extension,
	element,
	// The version, so a new one isn't read from the cache.
	src: `/ui/extensions/${encodeURIComponent(extension.id)}/${encodeURIComponent(element.file)}?v=${encodeURIComponent(extension.version)}`
});

class Extensions {
	list = $state<Extension[]>([]);
	loaded = $state(false);
	#started = false;

	ensure(): void {
		if (this.#started) return;
		this.#started = true;
		void this.load();
	}

	async load(): Promise<void> {
		try {
			const r = await fetch('/ui/extensions');
			this.list = r.ok ? ((await r.json()) as { extensions: Extension[] }).extensions : [];
		} catch {
			this.list = [];
		}
		this.loaded = true;
	}

	/** Every element that draws a family. */
	drawing(family: string): ExtElement[] {
		return this.list.flatMap((x) =>
			x.elements.filter((e) => e.draws === family).map((e) => withSrc(x, e))
		);
	}

	/** An element by its id in a look, if its extension is still there. */
	find(id: string): ExtElement | undefined {
		const m = /^ext:([^/]+)\/(.+)$/.exec(id);
		const x = m && this.list.find((e) => e.id === m[1]);
		const e = x?.elements.find((y) => y.id === m![2]);
		return x && e ? withSrc(x, e) : undefined;
	}
}

export const extensions = new Extensions();
