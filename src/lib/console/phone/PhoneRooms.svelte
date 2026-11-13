<!--
	Rooms on the phone (the PhonePlan board): every room in Home's order, a
	row each with its drawing or photo lit by its lights, what's going on and
	its temperature. A row opens the room.
-->
<script lang="ts">
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import { devices } from '#lib/devices.svelte.js';
	import RoomPicture from '../RoomPicture.svelte';
	import RoomPhoto from '../RoomPhoto.svelte';
	import { HomeNow } from '../homeNow.svelte.js';
	import PhoneTop from './PhoneTop.svelte';

	const h = new HomeNow();
</script>

<PhoneTop title="Rooms" />
{#if !devices.loaded}
	<p class="quiet">Loading the house…</p>
{:else if h.tiles.length === 0}
	<p class="quiet">No rooms yet.</p>
{:else}
	<ul class="list" aria-label="Rooms">
		{#each h.tiles as t (t.room.id)}
			<li>
				<a class="room" class:alarm={t.alarm} href={`/rooms/${t.room.id}`}>
					<span class="pic" aria-hidden="true">
						{#if t.photo}<RoomPhoto
								src={t.photo.src}
								focus={t.photo.focus}
								glow={t.glow}
								size="tile"
								shade={false}
							/>{:else if !t.plain}<RoomPicture picture={t.picture} g={t.g} />{/if}
					</span>
					<span class="nm"><b>{t.room.name}</b><small>{t.status}</small></span>
					{#if t.temp}<span class="tp">{t.temp}</span>{/if}
					<span class="dot" class:on={t.lightsOn > 0} class:bad={t.alarm} aria-hidden="true"></span>
					<span class="chev"><ChevronRight size={18} strokeWidth={2} aria-hidden="true" /></span>
				</a>
			</li>
		{/each}
	</ul>
{/if}

<style>
	.quiet {
		padding: 16px;
		color: var(--ink-muted);
	}
	.list {
		list-style: none;
		margin: 0;
		padding: 10px 16px 20px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.room {
		display: flex;
		align-items: center;
		gap: 12px;
		min-height: 64px;
		padding: 8px 10px 8px 8px;
		border-radius: 16px;
		background: color-mix(in srgb, var(--ink) 4%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--ink) 5%, transparent);
		color: var(--ink);
		text-decoration: none;
	}
	.room.alarm {
		box-shadow: inset 0 0 0 1.5px rgba(255, 107, 91, 0.6);
	}
	.pic {
		position: relative;
		flex: none;
		width: 76px;
		height: 48px;
		border-radius: 10px;
		overflow: hidden;
		background: #12141a;
	}
	.nm {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.nm b,
	.nm small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.nm b {
		font-size: 15px;
		font-weight: 700;
	}
	.nm small {
		color: var(--ink-muted);
		font-size: 12px;
	}
	.tp {
		font-size: 15px;
		font-weight: 700;
	}
	.dot {
		width: 8px;
		height: 8px;
		flex: none;
		border-radius: 50%;
	}
	.dot.on {
		background: #ffc46b;
		box-shadow: 0 0 8px #ffc46b;
	}
	.dot.bad {
		background: #ff6b5b;
		box-shadow: 0 0 8px #ff6b5b;
	}
	.chev {
		display: flex;
		flex: none;
		color: var(--ink-muted);
	}
</style>
