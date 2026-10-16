<!--
	A room's icon (D10), chosen in Settings from a short list and kept in the
	household's document by room id. A room nobody chose one for is a house.
-->
<script lang="ts" module>
	import Sofa from '@lucide/svelte/icons/sofa';
	import Bed from '@lucide/svelte/icons/bed-double';
	import CookingPot from '@lucide/svelte/icons/cooking-pot';
	import Utensils from '@lucide/svelte/icons/utensils';
	import Bath from '@lucide/svelte/icons/bath';
	import Tv from '@lucide/svelte/icons/tv';
	import Briefcase from '@lucide/svelte/icons/briefcase';
	import BookOpen from '@lucide/svelte/icons/book-open';
	import Baby from '@lucide/svelte/icons/baby';
	import Gamepad from '@lucide/svelte/icons/gamepad-2';
	import Armchair from '@lucide/svelte/icons/armchair';
	import Shirt from '@lucide/svelte/icons/shirt';
	import Dumbbell from '@lucide/svelte/icons/dumbbell';
	import DoorOpen from '@lucide/svelte/icons/door-open';
	import Car from '@lucide/svelte/icons/car';
	import Warehouse from '@lucide/svelte/icons/warehouse';
	import Trees from '@lucide/svelte/icons/trees';
	import Flower from '@lucide/svelte/icons/flower-2';
	import Sun from '@lucide/svelte/icons/sun';
	import House from '@lucide/svelte/icons/house';

	export const ROOM_ICONS = {
		house: { icon: House, label: 'House' },
		sofa: { icon: Sofa, label: 'Living' },
		bed: { icon: Bed, label: 'Bedroom' },
		kitchen: { icon: CookingPot, label: 'Kitchen' },
		dining: { icon: Utensils, label: 'Dining' },
		bath: { icon: Bath, label: 'Bathroom' },
		tv: { icon: Tv, label: 'TV' },
		office: { icon: Briefcase, label: 'Office' },
		study: { icon: BookOpen, label: 'Study' },
		nursery: { icon: Baby, label: 'Nursery' },
		games: { icon: Gamepad, label: 'Games' },
		lounge: { icon: Armchair, label: 'Lounge' },
		laundry: { icon: Shirt, label: 'Laundry' },
		gym: { icon: Dumbbell, label: 'Gym' },
		hall: { icon: DoorOpen, label: 'Hall' },
		garage: { icon: Car, label: 'Garage' },
		shed: { icon: Warehouse, label: 'Shed' },
		garden: { icon: Trees, label: 'Garden' },
		flowers: { icon: Flower, label: 'Flowers' },
		outside: { icon: Sun, label: 'Outside' }
	} as const;

	export type RoomIconName = keyof typeof ROOM_ICONS;
</script>

<script lang="ts">
	let { name, size = 20 }: { name?: string; size?: number } = $props();
	const Drawn = $derived(ROOM_ICONS[(name ?? 'house') as RoomIconName]?.icon ?? House);
</script>

<Drawn {size} strokeWidth={1.8} aria-hidden="true" />
