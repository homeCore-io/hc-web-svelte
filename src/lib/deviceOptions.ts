/**
 * A device card's settings sheet (G23–G26): what it can lead with, what else
 * it can say, Large's extras, tapping, its symbol and its size — built for
 * the device in hand from what its card already found, so it never offers
 * what the device doesn't have. The settings are applied in `cardFor`.
 */
import { SYMBOLS, cap, cardFor, extraKey, kindOf, reading, words, type Extra } from './card.js';
import type { Descriptor, Field, Section } from './descriptor.js';
import type { CoreDevice, Schema } from './devices.js';
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

/** An extra's value now, for its toggle's second line. */
function extraNow(e: Extra): string {
	if (e.kind === 'slider')
		return ` · ${Math.round(e.value * 10) / 10}${e.unit ? (e.unit === '%' ? '%' : ` ${e.unit}`) : ''}`;
	if (e.kind === 'steps' || e.kind === 'reading') return e.value ? ` · ${e.value}` : '';
	return '';
}

function extraLabel(e: Extra): string {
	return e.kind === 'transport' ? 'Previous and next' : e.label;
}

// The readings a card offers — only the sheet needs these, so they load with it.

/** A battery's reading: offered on a card though plugins file it as a diagnostic. */
const BATTERY = new Set(['battery', 'battery_pct']);

/** Readings worth a card, most useful first; anything else ranks after them. */
const USEFUL = [
	'on',
	'locked',
	'open',
	'contact',
	'contact_open',
	'motion',
	'occupied',
	'occupancy',
	'water_detected',
	'smoke',
	'temperature',
	'humidity',
	'illuminance',
	'brightness_pct',
	'color_temp',
	'speed',
	'volume',
	'power_w',
	'energy_kwh',
	'co2',
	'pressure',
	'wind_speed',
	'rain_rate',
	'door_open',
	'battery',
	'battery_pct'
];
/**
 * Not readings, whatever a plugin files them as: an effect engine's state
 * (Hue's dynamics), whether a feature is on, a sensor's own settings, how
 * the last change was made (that goes on the last-changed line), and its
 * bookkeeping.
 */
const NOT_READINGS =
	/(^|_)(dynamic|dynamics|effect|effects|scene|enabled|sensitivity|supports|valid|identify|method|source|event|mirek|raw|id|kind|type|mode_values)(_|$)|^last_/;
/** How many readings a card offers to say. */
const OFFERED = 6;

/**
 * The device's readings a card can lead with or add (G23): what it reports
 * now, most useful first, at most six. Not its settings (`config`) or
 * diagnostics — but its battery — not what only looks like a reading
 * (`NOT_READINGS`), and not a second form of another (`temperature_f`).
 */
export function cardReadings(d: CoreDevice): { attr: string; label: string; value: string }[] {
	const s: Schema = d.schema ?? { attributes: {} };
	const primary = s.primary ?? [];
	const rank = (a: string) => {
		const u = USEFUL.indexOf(a);
		if (u >= 0) return u;
		const p = primary.indexOf(a);
		return p >= 0 ? 100 + p : 500;
	};
	const names = Object.keys(d.attributes).filter((n) => {
		const spec = s.attributes[n];
		const v = d.attributes[n];
		return (
			!n.endsWith('_unit') &&
			(BATTERY.has(n) ||
				(spec?.category !== 'diagnostic' &&
					spec?.category !== 'config' &&
					!NOT_READINGS.test(n))) &&
			spec?.kind !== 'json' &&
			v !== undefined &&
			v !== null &&
			typeof v !== 'object'
		);
	});
	const another = (n: string) => names.some((m) => m !== n && n.startsWith(`${m}_`));
	return names
		.filter((n) => !another(n))
		.map((attr) => ({
			attr,
			// "Battery %" says its unit in its name; the value says it again.
			label: (s.attributes[attr]?.display_name ?? cap(words(attr))).replace(/\s*%$/, ''),
			value: reading(d.attributes, s, attr) ?? ''
		}))
		.filter((r) => r.value !== '')
		.sort((a, b) => rank(a.attr) - rank(b.attr) || a.label.localeCompare(b.label))
		.slice(0, OFFERED);
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

	const now = Date.now();
	const plain = cardFor(d, now);
	// What "As usual" leads with isn't offered again under another name
	// ("Lock · Unlocked" beside "As usual · Unlocked").
	const usual = (plain.stateLine.split(' · ')[0] ?? '').trim().toLowerCase();
	const readings = cardReadings(d).filter((r) => r.value.trim().toLowerCase() !== usual);
	if (readings.length > 0)
		sections.push({
			id: 'main',
			title: 'Main reading',
			fields: [
				{
					kind: 'enum',
					key: 'main',
					label: 'Main reading',
					render: 'choices',
					options: [
						{ value: 'auto', label: 'As usual', sub: plain.stateLine || '—' },
						...readings.map((r) => ({ value: r.attr, label: r.label, sub: r.value }))
					],
					default: 'auto'
				}
			]
		});

	// A light's card is its sliders; anything else's, its other readings.
	const light = plain.kind === 'light';
	const large = o.forms === undefined || o.forms.all.includes('large');
	const shown: Field[] = [];
	if (large)
		for (const e of plain.extras)
			shown.push({
				kind: 'toggle',
				key: `extra_${extraKey(e)}`,
				label: e.kind === 'slider' ? `${e.label} slider` : extraLabel(e),
				help: `Large size only${extraNow(e)}`,
				default: true
			});
	if (!light && plain.channels.length === 0)
		for (const r of readings)
			shown.push({
				kind: 'toggle',
				key: `show_${r.attr}`,
				label: r.label,
				help: r.value,
				default: false,
				// The main reading isn't also shown beside itself.
				visible_when: { field: 'main', ne: r.attr }
			});
	const last = cardFor(d, now, { last: true }).last;
	shown.push({
		kind: 'toggle',
		key: 'last',
		label: 'When it last changed',
		...(last ? { help: last } : {}),
		default: false
	});
	sections.push({ id: 'shown', title: light ? 'On the card' : 'Also show', fields: shown });

	const c = plain.control;
	if (c && (c.kind === 'switch' || c.kind === 'lock' || c.kind === 'play'))
		sections.push({
			id: 'tap',
			title: 'Tapping the card',
			fields: [
				{
					kind: 'enum',
					key: 'tap',
					label: 'Tapping the card',
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
					text: `As now: its ${c.kind === 'switch' ? 'switch' : 'button'} acts, the rest of the card opens its page.`,
					visible_when: { field: 'tap', eq: 'details' }
				},
				{
					kind: 'note',
					text: 'A big target for wall panels. Its page opens from the arrow, or by pressing and holding.',
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
