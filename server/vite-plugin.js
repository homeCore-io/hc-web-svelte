/**
 * The pass-through to homeCore, in the dev server.
 *
 * The same `proxy.js` the production server uses, mounted ahead of SvelteKit,
 * so development behaves like what ships — sessions, the event stream and
 * all — rather than like Vite's own proxy, which knows nothing about them.
 */
import { coreUrl } from './config.js';
import { isCorePath, proxyRequest, proxyUpgrade } from './proxy.js';
import { isVideoPath, videoRequest, videoUpgrade } from './video.js';

/** @returns {import('vite').Plugin} */
export function coreProxy() {
	/** @param {import('vite').ViteDevServer | import('vite').PreviewServer} server */
	const mount = (server) => {
		server.middlewares.use((req, res, next) => {
			if (isVideoPath(req.url)) return void videoRequest(req, res, coreUrl());
			if (!isCorePath(req.url)) return next();
			void proxyRequest(req, res, coreUrl());
		});
		// Vite's own hot reload also upgrades on this server; only ours is taken.
		server.httpServer?.on('upgrade', (req, socket, head) => {
			if (isCorePath(req.url)) void proxyUpgrade(req, socket, head, coreUrl());
			else if (isVideoPath(req.url)) void videoUpgrade(req, socket, head, coreUrl());
		});
	};
	return { name: 'hc-core-proxy', configureServer: mount, configurePreviewServer: mount };
}
