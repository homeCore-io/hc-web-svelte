/**
 * Home's grouping in a look (13 §8.3): the order its sections start in,
 * which start hidden, and its layout, written as the changes Customise and
 * Edit write. They come first, so the household's and a person's own
 * arranging go on from them, and picking a Home layout reads them back.
 */
import type { Change } from '../layers.js';
import { sectionRef } from '../page.js';
import { styleChanges } from '../styles.js';
import type { HomeGrouping } from './model.js';

export function homeChanges(h: HomeGrouping | undefined): Change[] {
	if (!h) return [];
	return [
		// Each to the end in turn leaves them in this order, the rest after.
		...h.order.map((id): Change => ({ op: 'move', ref: sectionRef(id), before: null })),
		...h.hidden.map((id): Change => ({ op: 'hide', ref: sectionRef(id) })),
		...styleChanges(h.layout).changes
	];
}
