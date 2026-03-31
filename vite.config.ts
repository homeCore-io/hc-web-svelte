import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, '.', '');
	const proxyTarget =
		env.HOMECORE_DEV_PROXY_TARGET || env.VITE_HOMECORE_DEV_PROXY_TARGET || 'http://localhost:8080';

	return {
		plugins: [sveltekit()],
		server: {
			host: '0.0.0.0',
			proxy: {
				'/api/v1': {
					target: proxyTarget,
					changeOrigin: true,
					ws: true
				}
			}
		},
		preview: {
			host: '0.0.0.0'
		}
	};
});
