import { getFrontMatterInfo, Notice, parseYaml, TFile } from 'obsidian';
import { convertMarkdown, dialectFor, referencedLinkpaths } from '../convert';
import type WikiJsPublisherPlugin from '../main';
import { Note, notePagePath, toPageInput } from '../publish/note';
import { resolveLinks } from '../publish/resolve';
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
		const note = await readNote(plugin, file);
		const pagePath = notePagePath(destination, file.basename);
		const config = plugin.getWikiConfig();
		const client = await createClient(obsidianHttp, config);

		const targets = await resolveLinks(referencedLinkpaths(note.body), {
			app: plugin.app,
			client,
			registry: plugin.registry,
			wikiUrl: config.url,
			file,
			pagePath,
			attachmentFolder: settings.attachmentFolder,
		});
		const converted = convertMarkdown(note.body, {
			dialect: dialectFor(client.version),
			resolve: (linkpath) => targets.get(linkpath),
		});

		const input = toPageInput({ ...note, body: converted.content, inlineTags: converted.tags }, destination);
		const page = await client.upsertPage(input);
		await plugin.registry.set(config.url, file.path, input.path);
		showPushedNotice(`${file.basename} pushed`, page);
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
