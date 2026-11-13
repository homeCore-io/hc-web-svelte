<!--
	A room on the phone's Home (the PhonePlan board), as the console's Home
	draws it: its drawing, or the household's photo, lit live by its lights,
	its name and what's going on, its temperature, and a dot while a light is
	on, red when something needs attention.
-->
<script lang="ts">
	import RoomPicture from '../RoomPicture.svelte';
	import RoomPhoto from '../RoomPhoto.svelte';
	import { anyLit } from '../pictures.js';
	import { photoLit } from '../photo.js';
	import type { HomeNow } from '../homeNow.svelte.js';

	let { t }: { t: HomeNow['tiles'][number] } = $props();
</script>

<a
	class="tile"
	class:alarm={t.alarm}
	href={`/rooms/${t.room.id}`}
	aria-label={`${t.room.name}, ${[t.temp, t.status].filter(Boolean).join(', ')}`}
>
	{#if t.photo}<RoomPhoto
			src={t.photo.src}
			focus={t.photo.focus}
			glow={t.glow}
			size="tile"
			shade={false}
		/>{:else if !t.plain}<RoomPicture picture={t.picture} g={t.g} />{/if}
	<span
		class="tdim"
		class:off={t.photo ? !photoLit(t.glow) : !anyLit(t.picture, t.g)}
		aria-hidden="true"
	></span>
	<span class="tshade" aria-hidden="true"></span>
	<span class="tinfo"><b>{t.room.name}</b><small>{t.status}</small></span>
	{#if t.temp}<span class="ttemp">{t.temp}</span>{/if}
	<span class="tdot" class:on={t.lightsOn > 0} class:bad={t.alarm} aria-hidden="true"></span>
</a>

<style>
	.tile {
		position: relative;
		display: block;
		height: 104px;
		border-radius: 18px;
		overflow: hidden;
		text-decoration: none;
		color: #e9ecf2;
		background: #12141a;
		box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.06);
		-webkit-tap-highlight-color: transparent;
	}
	.tile:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.tile.alarm {
		box-shadow:
			inset 0 0 0 1.5px rgba(255, 107, 91, 0.7),
			0 0 18px rgba(255, 107, 91, 0.25);
	}
	.tdim {
		position: absolute;
		inset: 0;
		background: #07080b;
		opacity: 0;
		pointer-events: none;
	}
	.tdim.off {
		opacity: 0.18;
	}
	.tshade {
		position: absolute;
		inset: 0;
		pointer-events: none;
		background: linear-gradient(0deg, rgba(6, 7, 10, 0.88), rgba(6, 7, 10, 0.1) 70%);
	}
	.tinfo {
		position: absolute;
		left: 12px;
		right: 44px;
		bottom: 9px;
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.tinfo b,
	.tinfo small {
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.tinfo b {
		font-size: 14px;
		font-weight: 700;
	}
	.tinfo small {
		color: #aab1be;
		font-size: 11px;
	}
	.ttemp {
		position: absolute;
		right: 11px;
		bottom: 9px;
		font-size: 14px;
		font-weight: 700;
	}
	.tdot {
		position: absolute;
		right: 10px;
		top: 10px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}
	.tdot.on {
		background: #ffc46b;
		box-shadow: 0 0 8px #ffc46b;
	}
	.tdot.bad {
		background: #ff6b5b;
		box-shadow: 0 0 8px #ff6b5b;
	}
</style>
