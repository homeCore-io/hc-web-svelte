/**
 * The house as the rule editor's parts read it (A3), set up once for a
 * component that edits rule pieces: the rule editor itself, and a mode's
 * definition (its on and off conditions are rule checks). Call during
 * component setup — it reads homeCore's vocabulary and, for an admin, the
 * notification channels, then provides the editor context.
 */
import { onMount } from 'svelte';
import { devices } from '../../devices.svelte.js';
import { rooms } from '../../rooms.svelte.js';
import { scenes } from '../../scenes.svelte.js';
import { session } from '../../me.svelte.js';
import { roomOf } from '../../summary.js';
import { loadConfig } from '../../config.js';
import { channelsOf } from '../../notify.js';
import { houseOf } from '../../ruleList.js';
import { featuresOf, variablesIn, type Lists, type Vocabulary } from '../../ruleEdit.js';
import { displayName } from '../../devices.js';
import { loadVocabulary } from '../../ruleAdmin.js';
import type { Rule } from '../../ruleWords.js';
import { provideEditor, type EditorContext } from './context.js';

export function provideHouse(rules: () => Rule[]): EditorContext {
	let vocab = $state<Vocabulary | null>(null);
	let configChannels = $state<string[]>([]);
	let calendars = $state<string[]>([]);
	onMount(async () => {
		void fetch('/api/v1/calendars')
			.then((r) => (r.ok ? r.json() : []))
			.then((list: { id: string }[]) => (calendars = list.map((c) => c.id).sort()))
			.catch(() => {});
		vocab = await loadVocabulary();
		// Channel names live in homecore.toml, which only an admin reads.
		if (session.isAdmin) {
			const got = await loadConfig();
			if (typeof got !== 'string')
				configChannels = channelsOf(got.config.parsed).map((c) => c.name);
		}
	});
	const all = $derived(Object.values(devices.byId));
	const house = $derived(houseOf(devices.byId, scenes.list, rules()));
	const features = $derived(featuresOf(vocab));
	const usedChannels = $derived(
		[...JSON.stringify(rules().map((r) => r.actions)).matchAll(/"channel":"([^"]+)"/g)].map(
			(m) => m[1]!
		)
	);
	const lists = $derived<Lists>({
		rules: rules().map((r) => ({ id: r.id, name: r.name })),
		calendars,
		modes: all
			.filter((d) => d.plugin_id === 'core.mode')
			.map((d) => ({ id: d.device_id, name: displayName(d) })),
		variables: variablesIn(rules())
	});
	const ctx: EditorContext = {
		get house() {
			return house;
		},
		get devices() {
			return all;
		},
		roomOf: (d) => roomOf(d, rooms.list)?.name,
		get scenes() {
			return scenes.list;
		},
		get modes() {
			return all.filter((d) => d.plugin_id === 'core.mode');
		},
		get vocab() {
			return vocab;
		},
		get features() {
			return features;
		},
		get channels() {
			return [...new Set([...configChannels, ...usedChannels])];
		},
		get lists() {
			return lists;
		}
	};
	provideEditor(ctx);
	return ctx;
}
