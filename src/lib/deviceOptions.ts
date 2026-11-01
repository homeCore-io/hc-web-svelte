/**
 * A device card's settings sheet (G23–G26): what it can lead with, what else
 * it can say, Large's extras, tapping, its symbol and its size — built for
 * the device in hand from what its card already found, so it never offers
 * what the device doesn't have. The settings are applied in `cardFor`.
 */
import { SYMBOLS, cardFor, cardReadings, extraKey, kindOf, type Extra } from './card.js';
import type { Descriptor, Field, Section } from './descriptor.js';
import type { CoreDevice } from './devices.js';
import { kindLabel } from './inventory.js';
import type { Form } from './layers.js';

export { DEVICE_BUILT_IN, deviceKind } from './options.js';

/** "light", "motion sensor": the device's type in words, for "Same for every … card". */
export const typeWords = (d: CoreDevice): string => kindLabel(kindOf(d)).toLowerCase();

const FORM_LABELS: Record<Form, string> = {
	compact: 'Compact',
	standard: 'Standard',
	large: 'Large'
};

function extraLabel(e: Extra): string {
	return e.kind === 'transport' ? 'Previous and next' : e.label;
}

export interface DeviceSheet {
	/** The sizes it can be, and the one it is; none for a type's default. */
	forms?: { all: Form[]; now: Form };
	/** Its plugin draws the card: only its size is the app's (G26). */
	pluginDrawn?: boolean;
	/** Every card of the type, rather than this one: no symbol or size. */
	everyCard?: boolean;
}

export function deviceDescriptor(d: CoreDevice, o: DeviceSheet = {}): Descriptor {
	const sections: Section[] = [];
	if (o.forms && o.forms.all.length > 1)
		sections.push({
			id: 'size',
			title: 'Size',
			fields: [
				{
					kind: 'enum',
					key: 'size',
					label: 'Size',
					render: 'segmented',
					options: o.forms.all.map((f) => ({ value: f, label: FORM_LABELS[f] })),
					default: o.forms.now
				}
			]
		});
	if (o.pluginDrawn) {
		sections.push({
			id: 'plugin',
			title: 'Its plugin',
			fields: [
				{ kind: 'note', text: 'Its plugin draws this card; the rest of it is the plugin’s.' }
			]
		});
		return { title: 'Card', sections };
	}

	const plain = cardFor(d, Date.now());
	const readings = cardReadings(d);
	const line: Field[] = [];
	if (readings.length > 0)
		line.push({
			kind: 'enum',
			key: 'main',
			label: 'It leads with',
			options: [
				{ value: 'auto', label: `As usual — ${plain.stateLine || '—'}` },
				...readings.map((r) => ({ value: r.attr, label: `${r.label} — ${r.value}` }))
			],
			default: 'auto'
		});
	if (plain.channels.length === 0)
		for (const r of readings)
			line.push({
				kind: 'toggle',
				key: `show_${r.attr}`,
				label: `Also: ${r.label}`,
				default: false
			});
	line.push({ kind: 'toggle', key: 'last', label: 'When it last changed', default: false });
	sections.push({ id: 'line', title: 'What it says', fields: line });

	if (plain.extras.length > 0 && (o.forms === undefined || o.forms.all.includes('large')))
		sections.push({
			id: 'large',
			title: 'On Large',
			fields: plain.extras.map((e): Field => ({
				kind: 'toggle',
				key: `extra_${extraKey(e)}`,
				label: extraLabel(e),
				default: true
			}))
		});

	const c = plain.control;
	if (c && (c.kind === 'switch' || c.kind === 'lock' || c.kind === 'play'))
		sections.push({
			id: 'tap',
			title: 'Tapping the card',
			fields: [
				{
					kind: 'enum',
					key: 'tap',
					label: 'What a tap does',
					render: 'segmented',
					options: [
						{ value: 'details', label: 'Opens its page' },
						{
							value: 'control',
							label:
								c.kind === 'lock'
									? 'Locks or unlocks it'
									: c.kind === 'play'
										? 'Plays or pauses it'
										: 'Switches it'
						}
					],
					default: 'details'
				},
				{
					kind: 'note',
					text: 'When the card switches it, its page opens from the arrow, or by pressing and holding.',
					visible_when: { field: 'tap', eq: 'control' }
				}
			]
		});

	if (!o.everyCard)
		sections.push({
			id: 'symbol',
			title: 'Symbol',
			fields: [
				{
					kind: 'enum',
					key: 'symbol',
					label: 'Symbol',
					render: 'icons',
					options: [
						{ value: 'auto', label: 'Its own' },
						...SYMBOLS.map((s) => ({ value: s.icon, label: s.label }))
					],
					default: 'auto'
				}
			]
		});
	return { title: 'Card', sections };
}
