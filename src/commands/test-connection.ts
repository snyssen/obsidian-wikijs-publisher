import { Notice } from 'obsidian';
import type WikiJsPublisherPlugin from '../main';
import { testConnection } from '../wiki/factory';
import { obsidianHttp } from '../wiki/obsidian-http';

export async function runConnectionTest(plugin: WikiJsPublisherPlugin): Promise<void> {
	const progress = new Notice('Testing connection…', 0);
	try {
		const info = await testConnection(obsidianHttp, plugin.getWikiConfig());
		const version = info.serverVersion ?? info.version.replace('v', '');
		const site = info.site ? ` (site: ${info.site})` : '';
		new Notice(`Connected to Wiki.js ${version}${site}.`);
	} catch (error) {
		new Notice(`Connection failed: ${error instanceof Error ? error.message : String(error)}`, 10000);
	} finally {
		progress.hide();
	}
}
