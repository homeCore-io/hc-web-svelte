/**
 * A descriptor form's state: the values as loaded, the draft being edited,
 * and what's wrong with it. The page around it decides where values come
 * from and how they're saved; see `descriptor.ts` for the rules.
 */
import {
	changes,
	getter,
	problems,
	fieldShown,
	sectionShown,
	sectionTucked,
	type Change,
	type Descriptor,
	type Section
} from './descriptor.js';

export class FormState {
	descriptor = $state<Descriptor>({ sections: [] });
	original = $state<Record<string, unknown>>({});
	draft = $state<Record<string, unknown>>({});
	/** Text typed into a field that doesn't parse yet, by key. */
	typing = $state<Record<string, string>>({});

	constructor(descriptor?: Descriptor, values?: Record<string, unknown>) {
		if (descriptor) this.descriptor = descriptor;
		if (values) this.load(values);
	}

	/** New values from the source; drops the draft. */
	load(values: Record<string, unknown>) {
		this.original = values;
		this.draft = structuredClone($state.snapshot(values));
		this.typing = {};
	}

	readonly get = $derived(getter(this.descriptor, this.draft));
	readonly changes: Change[] = $derived(changes(this.descriptor, this.original, this.draft));
	readonly errors: Record<string, string> = $derived.by(() => {
		const out = problems(this.descriptor, this.draft);
		for (const s of [...this.sections, ...this.tucked])
			for (const f of s.fields)
				if (f.key && this.typing[f.key] && fieldShown(f, this.get))
					out[f.key] = this.typing[f.key]!;
		return out;
	});
	/** Sections shown, in order. */
	readonly sections: Section[] = $derived(
		this.descriptor.sections.filter((s) => sectionShown(s, this.get))
	);
	/** Sections kept out of the list but editable, listed apart. */
	readonly tucked: Section[] = $derived(
		this.descriptor.sections.filter((s) => sectionTucked(s, this.get))
	);
	readonly dirty = $derived(this.changes.length > 0);
	readonly blocked = $derived(Object.keys(this.errors).length > 0);

	set(key: string, value: unknown) {
		this.draft[key] = value;
		delete this.typing[key];
	}

	/** Typed text that doesn't parse; null when it's fine again. */
	fail(key: string, problem: string | null) {
		if (problem === null) delete this.typing[key];
		else this.typing[key] = problem;
	}

	discard() {
		this.draft = structuredClone($state.snapshot(this.original));
		this.typing = {};
	}

	/** Whether any field in `section` is changed. */
	changedIn(section: Section): boolean {
		return this.changes.some((c) => c.section.id === section.id);
	}
	/** Whether any shown field in `section` has a problem. */
	wrongIn(section: Section): boolean {
		return section.fields.some((f) => f.key !== undefined && f.key in this.errors);
	}
}
