<!--
	Every camera in the house on the phone (the PhonePlan board): the
	console's camera wall laid out for one hand (CamPhone).
-->
<script lang="ts">
	import { devices } from '#lib/devices.svelte.js';
	import { camerasOf } from '../cameras.js';
	import CamPhone from './CamPhone.svelte';
	import PhoneTop from './PhoneTop.svelte';

	const all = $derived(Object.values(devices.byId));
	const n = $derived(camerasOf(all, devices.byId).length);
</script>

<PhoneTop title="Cameras">
	<p class="sub">
		{n === 1 ? '1 camera' : `${n} cameras`} · live plays while it’s on screen
	</p>
</PhoneTop>
<div class="pad"><CamPhone list={all} /></div>

<style>
	.sub {
		margin: 2px 0 0;
		color: var(--ink-muted);
		font-size: 13px;
	}
	.pad {
		padding: 14px 16px 20px;
	}
</style>
