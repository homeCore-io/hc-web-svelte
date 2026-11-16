/**
 * The Catalog's words for a plugin that's already installed (A4). Its own
 * module so that only the Catalog loads it.
 */
import { compareVersions, versionOf, type PluginRecord } from './plugins.js';

/** What an installed plugin is, in the Catalog's words: its version, or that it isn't known. */
export const installedText = (p: PluginRecord) => {
	const v = versionOf(p);
	return v ? `Installed · ${v}` : 'Installed, version unknown';
};

/**
 * The Catalog's button for `version` of `name`: an update only when the
 * installed version is known and older, a reinstall when it's the same one.
 * Over an unknown one it's an install, which may be a reinstall or an earlier
 * version.
 */
export function installLabel(name: string, version: string, installed?: PluginRecord): string {
	if (!installed) return `Install ${name}`;
	const have = versionOf(installed);
	if (have && compareVersions(version, have) === 0) return `Reinstall ${version}`;
	return have && compareVersions(version, have) > 0 ? `Update to ${version}` : `Install ${version}`;
}

/** Whether `version` is the one already installed, so installing it again is the quiet choice. */
export const isInstalledVersion = (version: string, installed?: PluginRecord) => {
	const have = installed ? versionOf(installed) : undefined;
	return !!have && compareVersions(version, have) === 0;
};
