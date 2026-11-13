<!--
	Every room, as a list: the Rooms section of the console's look on a
	phone draws it (phone/PhoneRooms). Elsewhere Home lists the rooms, so
	this address goes there.
-->
<script lang="ts">
	import { goto } from '$app/navigation';

	$effect(() => void goto('/', { replaceState: true }));
</script>
