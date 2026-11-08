import { describe, expect, it } from 'vitest';
import { isVideoPath, videoHeaders, videoTarget } from './video.js';

describe('live video, passed to go2rtc', () => {
	it('is everything under /video', () => {
		expect(isVideoPath('/video/api/ws?src=reolink_nvr_1')).toBe(true);
		expect(isVideoPath('/videos')).toBe(false);
		expect(isVideoPath('/api/v1/devices')).toBe(false);
	});

	it('passes on only what is for watching', () => {
		expect(videoTarget('/video/api/ws?src=reolink_nvr_1')).toEqual({
			ok: true,
			path: '/api/ws?src=reolink_nvr_1'
		});
		expect(videoTarget('/video/api/frame.jpeg?src=reolink_nvr_1').ok).toBe(true);
		expect(videoTarget('/video/api/stream.mp4?src=cam').ok).toBe(true);
		// go2rtc's own API: its streams carry the cameras' passwords.
		expect(videoTarget('/video/api/streams')).toEqual({ ok: false, status: 404 });
		expect(videoTarget('/video/api/config')).toEqual({ ok: false, status: 404 });
		expect(videoTarget('/video/api/exit').ok).toBe(false);
		expect(videoTarget('/video/../api/streams').ok).toBe(false);
	});

	it('asks for a stream by name, never an address go2rtc would fetch', () => {
		expect(videoTarget('/video/api/ws?src=rtsp://10.0.0.9/x')).toEqual({ ok: false, status: 400 });
		expect(videoTarget('/video/api/ws?src=exec:rm')).toEqual({ ok: false, status: 400 });
		expect(videoTarget('/video/api/ws')).toEqual({ ok: false, status: 400 });
		expect(videoTarget('/video/api/ws?src=a&src=b').ok).toBe(false);
	});

	it('sends go2rtc none of the browser’s credentials', () => {
		const h = videoHeaders(
			{ cookie: 'hc_at=x', authorization: 'Bearer y', origin: 'https://home', 'user-agent': 'z' },
			'127.0.0.1:1984'
		);
		expect(h).toEqual({ 'user-agent': 'z', host: '127.0.0.1:1984' });
	});
});
