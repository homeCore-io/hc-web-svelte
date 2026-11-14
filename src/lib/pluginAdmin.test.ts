import { afterEach, describe, expect, test, vi } from 'vitest';
import { updateAll } from './pluginAdmin.js';

describe('updateAll', () => {
	afterEach(() => vi.unstubAllGlobals());
	test('one at a time, keeping a runtime, going on past a failure', async () => {
		const sent: { id: string; version?: string; runtime_id?: string }[] = [];
		let busy = false;
		vi.stubGlobal('fetch', async (url: string, init?: RequestInit) => {
			if (url.includes('/placements'))
				return Response.json({
					placements: [{ runtime_id: 'pi', plugin_id: 'plugin.b', version: '1', placed_at: '' }]
				});
			expect(busy).toBe(false);
			busy = true;
			await new Promise((r) => setTimeout(r, 1));
			busy = false;
			const body = JSON.parse(String(init?.body));
			sent.push(body);
			return body.id === 'plugin.b'
				? Response.json({ error: 'signature mismatch' }, { status: 422 })
				: Response.json({
						installed: body.id,
						version: body.version,
						reinstall: false,
						activated: true
					});
		});
		const steps: string[] = [];
		const done = await updateAll(
			[
				{ id: 'plugin.a', name: 'A', version: '2' },
				{ id: 'plugin.b', name: 'B', version: '3' },
				{ id: 'plugin.c', name: 'C', version: '4' }
			],
			(i, p) => steps.push(`${i}:${p.name}`)
		);
		expect(steps).toEqual(['0:A', '1:B', '2:C']);
		expect(sent).toEqual([
			{ id: 'plugin.a', version: '2' },
			{ id: 'plugin.b', version: '3', runtime_id: 'pi' },
			{ id: 'plugin.c', version: '4' }
		]);
		expect(done.map((d) => [d.plugin.id, !!d.error])).toEqual([
			['plugin.a', false],
			['plugin.b', true],
			['plugin.c', false]
		]);
	});
});
