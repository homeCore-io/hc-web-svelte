/**
 * Home's page document from the house as it is now (G1): its devices, rooms,
 * scenes, the person's favorites, the household's pinned cards. Home draws
 * it; the look editor's preview draws it too (13 §11).
 */
import { cardFor } from './card.js';
import { houseChips } from './summary.js';
import { cardRef } from './layers.js';
import { homePage, type Page } from './page.js';
import { devices } from './devices.svelte.js';
import { houseNow } from './houseNow.svelte.js';
import { rooms } from './rooms.svelte.js';
import { scenes } from './scenes.svelte.js';
import { personal } from './personal.svelte.js';
import { view } from './view.svelte.js';
import { alerts } from './alerts.svelte.js';
import { clock } from './clock.svelte.js';
import { pluginUis } from './pluginUi/uis.svelte.js';

const HOME = 'home';

export function homeDocument(): Page {
	return homePage({
		devices: devices.byId,
		rooms: rooms.list,
		scenes: scenes.list,
		favourites: personal.doc.favourites ?? [],
		// Cards the household pinned to Home (M2 `add`).
		added: view.added(HOME),
		pluginCard: (r) => {
			const c = cardRef(r);
			const found = c ? pluginUis.card(c.pluginId, c.element) : undefined;
			return found
				? { label: found.slot.label ?? 'A plugin’s card', forms: found.slot.forms }
				: undefined;
		},
		alerts: alerts.list.length,
		chips: houseChips(
			Object.values(devices.byId).map((d) => cardFor(d, clock.now)),
			houseNow.lightIds
		),
		mode: view.mode(HOME)
	});
}
