/**
 * The UI extensions in the app's data directory (`GET /ui/extensions`): their
 * elements, by their ids in a look (`ext:{extension}/{element}`). Read once
 * while the app is open.
 */

interface Element {
	id: string;
	label: string;
	/** The look family it draws. */
	draws: string;
}
export type ExtensionElement =
	| (Element & { kind: 'rive'; file: string; artboard?: string; stateMachine?: string })
	| (Element & { kind: 'code'; module: string; element: string });

export interface Extension {
	id: string;
	name: string;
	version: string;
	elements: ExtensionElement[];
	installed?: { from: 'catalog' | 'file'; version: string; at: string };
}

/** One element, with its id in a look and where its file is. */
export interface ExtElement {
	id: string;
	extension: Extension;
	element: ExtensionElement;
	/** Its `.riv` file, or its code's module. */
	src: string;
}

export const extId = (ext: string, element: string) => `ext:${ext}/${element}`;

/** One of an extension's files; the version, so a new one isn't read from the cache. */
export const fileUrl = (x: Pick<Extension, 'id' | 'version'>, file: string) =>
	`/ui/extensions/${encodeURIComponent(x.id)}/${file.split('/').map(encodeURIComponent).join('/')}?v=${encodeURIComponent(x.version)}`;

const withSrc = (extension: Extension, element: ExtensionElement): ExtElement => ({
	id: extId(extension.id, element.id),
	extension,
	element,
	src: fileUrl(extension, element.kind === 'rive' ? element.file : element.module)
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

	/** A code element for a family by its id in a look, while its extension offers it. */
	code(id: string, family: string): (ExtElement & { element: { kind: 'code' } }) | undefined {
		const x = id.startsWith('ext:') ? this.find(id) : undefined;
		return x?.element.kind === 'code' && x.element.draws === family
			? (x as ExtElement & { element: { kind: 'code' } })
			: undefined;
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
