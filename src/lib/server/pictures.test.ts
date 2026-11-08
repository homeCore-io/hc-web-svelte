import { describe, expect, it } from 'vitest';
import { sniff } from './pictures.js';

describe('pictures (14 §6)', () => {
	it('takes PNG, JPEG, WebP and GIF by their first bytes', () => {
		expect(sniff(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe('png');
		expect(sniff(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg');
		expect(
			sniff(new Uint8Array([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]))
		).toBe('webp');
		expect(sniff(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]))).toBe('gif');
	});

	it('refuses anything else, an SVG above all', () => {
		expect(
			sniff(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg">'))
		).toBeUndefined();
		expect(sniff(new Uint8Array([]))).toBeUndefined();
	});
});
