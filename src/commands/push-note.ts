import { getFrontMatterInfo, Notice, parseYaml, TFile } from 'obsidian';
import type WikiJsPublisherPlugin from '../main';
import { Note, notePagePath, toPageInput } from '../publish/note';
import { askDestination } from '../ui/destination-modal';
import { errorMessage, showPushedNotice } from '../ui/notices';
import { createClient } from '../wiki/factory';
import { obsidianHttp } from '../wiki/obsidian-http';

export function isPushable(file: TFile | null): file is TFile {
	return file?.extension === 'md';
}

/** Asks for a destination, then creates or overwrites the note's page on the wiki. */
export async function pushNote(plugin: WikiJsPublisherPlugin, file: TFile): Promise<void> {
	const { settings } = plugin;
	const destination = await askDestination(plugin.app, {
		initial: settings.lastDestination ?? settings.defaultDestination,
		pagePath: (dest) => notePagePath(dest, file.basename),
	});
	if (destination === null) return;
	settings.lastDestination = destination;
	await plugin.saveSettings();

	const progress = new Notice(`Pushing ${file.basename}…`, 0);
	try {
		const input = toPageInput(await readNote(plugin, file), destination);
		const client = await createClient(obsidianHttp, plugin.getWikiConfig());
		showPushedNotice(`${file.basename} pushed`, await client.upsertPage(input));
	} catch (error) {
		new Notice(`Could not push ${file.basename}: ${errorMessage(error)}`, 10000);
	} finally {
		progress.hide();
	}
}

async function readNote(plugin: WikiJsPublisherPlugin, file: TFile): Promise<Note> {
	// Parsed from the content just read rather than the metadata cache, which can lag behind recent edits
	const content = await plugin.app.vault.read(file);
	const info = getFrontMatterInfo(content);
	let frontmatter: unknown;
	if (info.exists) {
		try {
			frontmatter = parseYaml(info.frontmatter);
		} catch (error) {
			throw new Error(`its frontmatter is not valid YAML (${errorMessage(error)})`);
		}
	}
	return { basename: file.basename, frontmatter, body: content.slice(info.contentStart) };
}
