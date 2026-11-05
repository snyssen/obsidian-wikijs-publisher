// Development only (registered when __DEV__): exercises the API layer end to end from inside Obsidian.
import { Notice } from 'obsidian';
import type WikiJsPublisherPlugin from '../main';
import { errorMessage, showPushedNotice } from '../ui/notices';
import { createClient } from '../wiki/factory';
import { obsidianHttp } from '../wiki/obsidian-http';
import { toWikiPath } from '../wiki/paths';

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="80" viewBox="0 0 240 80">
	<rect x="1" y="1" width="238" height="78" rx="8" fill="#7c3aed" />
	<text x="120" y="47" font-family="sans-serif" font-size="16" fill="#fff" text-anchor="middle">Pushed from Obsidian</text>
</svg>`;

export async function pushTestPage(plugin: WikiJsPublisherPlugin): Promise<void> {
	const progress = new Notice('Pushing test page…', 0);
	try {
		const client = await createClient(obsidianHttp, plugin.getWikiConfig());
		const path = toWikiPath(`${plugin.settings.defaultDestination}/obsidian-test`);
		// Assets and pages share one tree on v3: keep the folder name distinct from the page path
		const image = await client.uploadAsset(`${path}-assets`, 'banner.svg', new TextEncoder().encode(SVG).buffer, 'image/svg+xml');

		const page = await client.upsertPage({
			path,
			title: 'Obsidian test page',
			description: 'Pushed by the Wiki.js Publisher dev command',
			tags: ['obsidian', 'test'],
			content: [
				'# Obsidian test page',
				'',
				`Pushed on ${new Date().toISOString()} to Wiki.js ${client.version}.`,
				'',
				`![Banner](${image.path})`,
				'',
				'- A **bold** item and some `inline code`',
				'- A link to the [home page](/home)',
				'',
				'> This is an info callout.',
				'{.is-info}',
			].join('\n'),
		});

		showPushedNotice('Test page pushed', page);
	} catch (error) {
		new Notice(`Push failed: ${errorMessage(error)}`, 10000);
	} finally {
		progress.hide();
	}
}
