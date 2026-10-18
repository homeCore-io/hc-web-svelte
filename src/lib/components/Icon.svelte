<!--
	The app's icons by meaning, not by Lucide name, so the card model never
	names a drawing. Each is imported on its own, so only these ship.
-->
<script lang="ts" module>
	import Lightbulb from '@lucide/svelte/icons/lightbulb';
	import ToggleRight from '@lucide/svelte/icons/toggle-right';
	import Fan from '@lucide/svelte/icons/fan';
	import Lock from '@lucide/svelte/icons/lock';
	import LockOpen from '@lucide/svelte/icons/lock-open';
	import Tv from '@lucide/svelte/icons/tv';
	import Speaker from '@lucide/svelte/icons/speaker';
	import Timer from '@lucide/svelte/icons/timer';
	import DoorClosed from '@lucide/svelte/icons/door-closed';
	import DoorOpen from '@lucide/svelte/icons/door-open';
	import Droplets from '@lucide/svelte/icons/droplets';
	import PersonStanding from '@lucide/svelte/icons/person-standing';
	import Thermometer from '@lucide/svelte/icons/thermometer';
	import CloudSun from '@lucide/svelte/icons/cloud-sun';
	import CloudRain from '@lucide/svelte/icons/cloud-rain';
	import CloudLightning from '@lucide/svelte/icons/cloud-lightning';
	import Vibrate from '@lucide/svelte/icons/vibrate';
	import Grid from '@lucide/svelte/icons/grid-3x3';
	import CircleDot from '@lucide/svelte/icons/circle-dot';
	import Router from '@lucide/svelte/icons/router';
	import SunMoon from '@lucide/svelte/icons/sun-moon';
	import Sparkles from '@lucide/svelte/icons/sparkles';
	import Box from '@lucide/svelte/icons/box';
	import House from '@lucide/svelte/icons/house';
	import Alert from '@lucide/svelte/icons/triangle-alert';
	import type { IconName } from '#lib/card.js';

	export type Name = IconName | 'room' | 'alert';

	const ICONS = {
		light: Lightbulb,
		switch: ToggleRight,
		fan: Fan,
		lock: Lock,
		unlock: LockOpen,
		tv: Tv,
		speaker: Speaker,
		timer: Timer,
		door: DoorClosed,
		'door-open': DoorOpen,
		water: Droplets,
		motion: PersonStanding,
		thermometer: Thermometer,
		weather: CloudSun,
		rain: CloudRain,
		lightning: CloudLightning,
		vibration: Vibrate,
		keypad: Grid,
		remote: CircleDot,
		router: Router,
		mode: SunMoon,
		scene: Sparkles,
		device: Box,
		room: House,
		alert: Alert
	} satisfies Record<Name, unknown>;

	/** Whether the app draws this meaning — a plugin may name one it doesn't. */
	export const drawn = (name: string | undefined): name is Name =>
		name !== undefined && Object.hasOwn(ICONS, name);
</script>

<script lang="ts">
	let { name, size = 20 }: { name: Name; size?: number } = $props();
	const Drawn = $derived(ICONS[name]);
</script>

<Drawn {size} strokeWidth={1.8} aria-hidden="true" />
